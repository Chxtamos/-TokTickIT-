import { createHash } from "node:crypto";
import type { UserRole } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";

const origin = "http://127.0.0.1:5173";
const token = "comments-notes-api-session";
const tokenHash = createHash("sha256").update(token).digest("hex");
const cookie = `toktickit.sid=${token}`;
const csrfToken = "c".repeat(64);

type Failure = "ticket" | "comments-list" | "comments-create" | "notes-list" | "notes-create" | "touch";

function userFor(role: UserRole) {
  const id = role === "REQUESTER" ? 1 : role === "IT_STAFF" ? 10 : 20;
  return {
    id,
    name: role === "REQUESTER" ? "Requester Current" : role === "IT_STAFF" ? "Staff Current" : "Admin Current",
    email: `${role.toLowerCase()}@example.test`,
    role,
    isActive: true,
    passwordHash: "unused",
    mustChangePassword: false,
    passwordChangedAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 1,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };
}

function ticketFixture(status = "IN_PROGRESS") {
  const createdAt = new Date("2026-09-18T00:00:00.000Z");
  return {
    id: 42,
    ticketNumber: "TKT-2026-000042",
    requesterId: 1,
    categoryId: 2,
    relatedSystemId: 7,
    ticketOwnerId: 10,
    summary: "Conversation contract fixture",
    description: "A complete Ticket used to prove conversation isolation.",
    requestedPriority: "HIGH" as const,
    itPriority: "URGENT" as const,
    currentStatus: status as any,
    version: 9,
    resolutionSummary: "Existing public resolution",
    resolvedAt: new Date("2026-09-18T03:00:00.000Z"),
    closedAt: status === "CLOSED" ? new Date("2026-09-18T04:00:00.000Z") : null,
    requesterResolvedAt: new Date("2026-09-18T02:00:00.000Z"),
    requesterResolvedById: 1,
    lastStatusReason: "Existing public reason",
    clientRequestId: "f13f2298-1153-4cea-966d-3bc466d53d7b",
    requestPayloadHash: "p".repeat(64),
    createdAt,
    updatedAt: new Date("2026-09-18T05:00:00.000Z"),
    requester: { id: 1, name: "Requester Current", email: "requester@example.test", role: "REQUESTER" as const },
    owner: { id: 10, name: "Staff Current", email: "staff@example.test", role: "IT_STAFF" as const },
    requesterResolved: { id: 1, name: "Requester Current", email: "requester@example.test", role: "REQUESTER" as const },
    category: { id: 2, name: "Network" },
    relatedSystem: { id: 7, name: "VPN" },
    attachments: [],
    internalNotes: [{ id: 999, content: "PRIVATE-NOTE-FRAGMENT" }],
  };
}

function makePrisma(role: UserRole, options: {
  missing?: boolean;
  nonOwned?: boolean;
  restricted?: boolean;
  status?: string;
  fail?: Failure;
  comments?: any[];
  notes?: any[];
} = {}) {
  const user = { ...userFor(role), mustChangePassword: options.restricted ?? false };
  const ticket = ticketFixture(options.status);
  const comments = [...(options.comments ?? [])];
  const notes = [...(options.notes ?? [])];
  let nextCommentId = 100;
  let nextNoteId = 200;
  const author = { id: user.id, name: user.name, role: user.role };

  const ticketFindFirst = vi.fn(async ({ where, select }: any) => {
    if (options.fail === "ticket") throw new Error("SELECT private_note FROM InternalNote");
    if (options.missing || where.id !== 42) return null;
    if (options.nonOwned && where.requesterId !== undefined) return null;
    if (select?.ticketNumber) return ticket;
    return { id: ticket.id };
  });
  const ticketTouch = vi.fn(async (_query: TemplateStringsArray, ...values: unknown[]) => {
    if (options.fail === "touch") throw new Error("SQL touch failed PRIVATE-NOTE-FRAGMENT");
    const [candidate, ticketId, requesterId] = values as [Date, number, number?];
    if (options.missing || ticketId !== 42 || (options.nonOwned && requesterId !== undefined)) return 0;
    ticket.updatedAt = new Date(Math.max(ticket.updatedAt.getTime(), candidate.getTime()));
    return 1;
  });

  const publicComment = {
    findMany: vi.fn(async () => {
      if (options.fail === "comments-list") throw new Error("SQL public failure PRIVATE-NOTE-FRAGMENT");
      return [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
    }),
    create: vi.fn(async ({ data }: any) => {
      if (options.fail === "comments-create") throw new Error(`INSERT failed: ${data.content}`);
      const entry = { id: nextCommentId++, ...data, author };
      comments.push(entry);
      return entry;
    }),
  };
  const internalNote = {
    findMany: vi.fn(async () => {
      if (options.fail === "notes-list") throw new Error("SQL notes failure PRIVATE-NOTE-FRAGMENT");
      return [...notes].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id);
    }),
    create: vi.fn(async ({ data }: any) => {
      if (options.fail === "notes-create") throw new Error(`INSERT private failed: ${data.content}`);
      const entry = { id: nextNoteId++, ...data, author };
      notes.push(entry);
      return entry;
    }),
  };
  const transaction = {
    ticket: { findFirst: ticketFindFirst },
    publicComment,
    internalNote,
    $executeRaw: ticketTouch,
  };
  const prisma = {
    ...transaction,
    session: {
      findUnique: vi.fn(async ({ where }: any) => where.tokenHash === tokenHash ? {
        id: "00000000-0000-4000-8000-000000000061",
        tokenHash,
        userId: user.id,
        csrfToken,
        createdAt: new Date(),
        lastSeenAt: new Date(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        user,
      } : null),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => {
      const ticketBefore = { ...ticket };
      const commentsLength = comments.length;
      const notesLength = notes.length;
      try {
        return await callback(transaction);
      } catch (error) {
        Object.assign(ticket, ticketBefore);
        comments.length = commentsLength;
        notes.length = notesLength;
        throw error;
      }
    }),
  } as unknown as ReferenceDataPrisma;
  return { prisma, ticket, comments, notes, publicComment, internalNote, ticketFindFirst, ticketTouch };
}

function get(app: ReturnType<typeof createApp>, path: string) {
  return request(app).get(path).set("Cookie", cookie);
}

function write(app: ReturnType<typeof createApp>, method: "post" | "put" | "patch" | "delete", path: string) {
  return request(app)[method](path).set("Cookie", cookie).set("Origin", origin).set("X-CSRF-Token", csrfToken);
}

beforeEach(() => {
  process.env.CLIENT_ORIGIN = origin;
});

describe("Lab 3 Public Comments and Internal Notes APIs", () => {
  it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const)("lists exact chronological Public Comment DTOs for %s", async (role) => {
    const sameTime = new Date("2026-09-19T01:00:00.000Z");
    const fixture = makePrisma(role, { comments: [
      { id: 2, ticketId: 42, content: "second", author: { id: 10, name: "Staff", role: "IT_STAFF", email: "hidden@example.test" }, createdAt: sameTime },
      { id: 1, ticketId: 42, content: "first", author: { id: 1, name: "Requester", role: "REQUESTER", email: "hidden@example.test" }, createdAt: sameTime },
    ] });
    const response = await get(createApp(fixture.prisma), "/api/tickets/42/comments");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [
      { id: 1, ticketId: 42, content: "first", author: { id: 1, name: "Requester", role: "REQUESTER" }, createdAt: sameTime.toISOString() },
      { id: 2, ticketId: 42, content: "second", author: { id: 10, name: "Staff", role: "IT_STAFF" }, createdAt: sameTime.toISOString() },
    ] });
    expect(JSON.stringify(response.body)).not.toContain("email");
    expect(fixture.ticketFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: role === "REQUESTER" ? { id: 42, requesterId: 1 } : { id: 42 },
    }));
  });

  it("returns empty Public Comment and Internal Note arrays", async () => {
    const fixture = makePrisma("IT_STAFF");
    const app = createApp(fixture.prisma);
    expect((await get(app, "/api/tickets/42/comments")).body).toEqual({ items: [] });
    expect((await get(app, "/api/tickets/42/internal-notes")).body).toEqual({ items: [] });
  });

  it.each(["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const)("creates one trimmed Public Comment with backend author/time for %s", async (role) => {
    const fixture = makePrisma(role);
    const before = { ...fixture.ticket };
    const response = await write(createApp(fixture.prisma), "post", "/api/tickets/42/comments")
      .send({ content: "  line one\n  line two  " });
    expect(response.status).toBe(201);
    expect(response.body.entry).toMatchObject({
      id: 100,
      ticketId: 42,
      content: "line one\n  line two",
      author: { id: userFor(role).id, name: userFor(role).name, role },
    });
    expect(new Date(response.body.entry.createdAt).toString()).not.toBe("Invalid Date");
    expect(response.body.entry.author.email).toBeUndefined();
    expect(fixture.publicComment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ authorId: userFor(role).id, content: "line one\n  line two", createdAt: expect.any(Date) }),
    }));
    expect(fixture.ticket.version).toBe(before.version);
    expect(fixture.ticket.currentStatus).toBe(before.currentStatus);
    expect(fixture.ticket.ticketOwnerId).toBe(before.ticketOwnerId);
    expect(fixture.ticket.requestedPriority).toBe(before.requestedPriority);
    expect(fixture.ticket.itPriority).toBe(before.itPriority);
    expect(fixture.ticket.resolutionSummary).toBe(before.resolutionSummary);
    expect(fixture.ticket.requesterResolvedAt).toEqual(before.requesterResolvedAt);
    expect(fixture.ticket.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  it("does not deduplicate two valid Public Comment POSTs", async () => {
    const fixture = makePrisma("REQUESTER", { status: "CANCELLED" });
    const app = createApp(fixture.prisma);
    const first = await write(app, "post", "/api/tickets/42/comments").send({ content: "same" });
    const second = await write(app, "post", "/api/tickets/42/comments").send({ content: "same" });
    expect([first.status, second.status]).toEqual([201, 201]);
    expect(first.body.entry.id).not.toBe(second.body.entry.id);
    expect(fixture.comments).toHaveLength(2);
    expect(fixture.ticket.currentStatus).toBe("CANCELLED");
  });

  it("does not regress Ticket.updatedAt when a comment or note touch is older", async () => {
    const fixture = makePrisma("IT_STAFF");
    const futureUpdatedAt = new Date("2099-01-01T00:00:00.000Z");
    fixture.ticket.updatedAt = futureUpdatedAt;
    const app = createApp(fixture.prisma);

    const comment = await write(app, "post", "/api/tickets/42/comments").send({ content: "stale public touch" });
    const note = await write(app, "post", "/api/tickets/42/internal-notes").send({ content: "stale private touch" });

    expect([comment.status, note.status]).toEqual([201, 201]);
    expect(fixture.ticket.updatedAt).toEqual(futureUpdatedAt);
    expect(fixture.ticketTouch).toHaveBeenCalledTimes(2);
  });

  it("rolls back a created entry when the monotonic Ticket touch fails", async () => {
    const fixture = makePrisma("IT_STAFF", { fail: "touch" });
    const before = { ...fixture.ticket };

    const response = await write(createApp(fixture.prisma), "post", "/api/tickets/42/comments")
      .send({ content: "must roll back" });

    expect(response.status).toBe(500);
    expect(fixture.comments).toHaveLength(0);
    expect(fixture.ticket).toEqual(before);
  });

  it("uses a generic 404 for a missing or non-owned Public Comment parent", async () => {
    for (const options of [{ missing: true }, { nonOwned: true }]) {
      const fixture = makePrisma("REQUESTER", options);
      const app = createApp(fixture.prisma);
      for (const method of ["get", "post"] as const) {
        const response = method === "get"
          ? await get(app, "/api/tickets/42/comments")
          : await write(app, "post", "/api/tickets/42/comments").send({ content: "public" });
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: { code: "RESOURCE_NOT_FOUND", message: "Resource not found." } });
      }
      expect(fixture.comments).toHaveLength(0);
    }
  });

  it.each(["IT_STAFF", "ADMINISTRATOR"] as const)("creates and lists exact private Entries for %s on terminal Tickets", async (role) => {
    for (const status of ["CLOSED", "CANCELLED"]) {
      const fixture = makePrisma(role, { status });
      const app = createApp(fixture.prisma);
      const created = await write(app, "post", "/api/tickets/42/internal-notes").send({ content: "  private <b>data</b>  " });
      expect(created.status).toBe(201);
      expect(created.body.entry).toMatchObject({ content: "private <b>data</b>", author: { id: userFor(role).id, role } });
      const listed = await get(app, "/api/tickets/42/internal-notes");
      expect(listed.status).toBe(200);
      expect(listed.body.items).toEqual([created.body.entry]);
      expect(fixture.ticket.currentStatus).toBe(status);
      expect(fixture.ticket.version).toBe(9);
    }
  });

  it("denies Requester Internal Notes before ID, body, query, parent, or note lookup", async () => {
    const fixture = makePrisma("REQUESTER", { missing: true });
    const app = createApp(fixture.prisma);
    const responses = [
      await get(app, "/api/tickets/not-an-id/internal-notes?unknown=PRIVATE-NOTE-FRAGMENT"),
      await write(app, "post", "/api/tickets/999999/internal-notes").send({ content: 7, authorId: 1 }),
      await request(app).post("/api/tickets/999999/internal-notes").set("Cookie", cookie).send({ content: "private" }),
    ];
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
      expect(JSON.stringify(response.body)).not.toContain("PRIVATE-NOTE-FRAGMENT");
    }
    expect(fixture.ticketFindFirst).not.toHaveBeenCalled();
    expect(fixture.internalNote.findMany).not.toHaveBeenCalled();
    expect(fixture.internalNote.create).not.toHaveBeenCalled();
  });

  it("enforces session, restricted-session, Origin, and CSRF before conversation mutation", async () => {
    const anonymousFixture = makePrisma("REQUESTER");
    const anonymous = await request(createApp(anonymousFixture.prisma)).post("/api/tickets/42/comments").send({ content: "x" });
    expect(anonymous.status).toBe(401);

    const restrictedFixture = makePrisma("IT_STAFF", { restricted: true });
    const restricted = await write(createApp(restrictedFixture.prisma), "post", "/api/tickets/42/internal-notes").send({ content: "x" });
    expect(restricted.status).toBe(403);
    expect(restricted.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");

    const fixture = makePrisma("REQUESTER");
    const missingOrigin = await request(createApp(fixture.prisma)).post("/api/tickets/42/comments").set("Cookie", cookie).set("X-CSRF-Token", csrfToken).send({ content: "x" });
    expect(missingOrigin.status).toBe(403);
    expect(missingOrigin.body.error.code).toBe("CSRF_INVALID");
    expect(fixture.publicComment.create).not.toHaveBeenCalled();
  });

  it("rejects any Public Comment or Internal Note GET body before resource lookup", async () => {
    for (const path of ["/api/tickets/42/comments", "/api/tickets/42/internal-notes"]) {
      for (const body of [{}, { content: "not accepted" }]) {
        const fixture = makePrisma("IT_STAFF");
        const response = await get(createApp(fixture.prisma), path).send(body);
        expect(response.status).toBe(400);
        expect(response.body.error).toMatchObject({
          code: "VALIDATION_FAILED",
          fieldErrors: { body: ["This endpoint does not accept a request body."] },
        });
        expect(fixture.ticketFindFirst).not.toHaveBeenCalled();
        expect(fixture.publicComment.findMany).not.toHaveBeenCalled();
        expect(fixture.internalNote.findMany).not.toHaveBeenCalled();
      }
    }
  });

  it("rejects unsupported GET parameters, unsafe IDs, content boundaries, and every client-owned field before create", async () => {
    const fixture = makePrisma("IT_STAFF");
    const app = createApp(fixture.prisma);
    expect((await get(app, "/api/tickets/42/comments?page=1")).status).toBe(400);
    expect((await get(app, "/api/tickets/9007199254740992/comments")).status).toBe(400);
    expect((await get(app, "/api/tickets/-1/internal-notes")).status).toBe(400);

    for (const content of ["", " \n ", 4, "x".repeat(5001)]) {
      const response = await write(app, "post", "/api/tickets/42/comments").send({ content });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_FAILED");
    }
    for (const field of ["authorId", "createdAt", "visibility", "clientRequestId", "requesterId", "unknown"]) {
      const response = await write(app, "post", "/api/tickets/42/internal-notes").send({ content: "valid", [field]: "client value" });
      expect(response.status).toBe(400);
      expect(response.body.error.fieldErrors[field]).toBeDefined();
    }
    expect((await write(app, "post", "/api/tickets/42/comments?unknown=1").send({ content: "valid" })).status).toBe(400);
    expect((await write(app, "post", "/api/tickets/42/comments").send({ content: "x" })).status).toBe(201);
    expect((await write(app, "post", "/api/tickets/42/comments").send({ content: "x".repeat(5000) })).status).toBe(201);
    expect(fixture.internalNote.create).not.toHaveBeenCalled();
  });

  it("never embeds Internal Notes in Public Comments or Requester Ticket detail", async () => {
    const fixture = makePrisma("REQUESTER", { comments: [
      { id: 1, ticketId: 42, content: "public only", author: { id: 1, name: "Requester", role: "REQUESTER" }, createdAt: new Date() },
    ] });
    const app = createApp(fixture.prisma);
    const comments = await get(app, "/api/tickets/42/comments");
    const detail = await get(app, "/api/tickets/42");
    for (const response of [comments, detail]) {
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain("PRIVATE-NOTE-FRAGMENT");
      expect(serialized).not.toContain("internalNotes");
      expect(serialized).not.toContain("noteCount");
    }
  });

  it.each(["put", "patch", "delete"] as const)("returns safe 405 + Allow for unsupported %s without mutation", async (method) => {
    const publicFixture = makePrisma("REQUESTER");
    const publicResponse = await write(createApp(publicFixture.prisma), method, "/api/tickets/42/comments").send({ content: "must not save" });
    expect(publicResponse.status).toBe(405);
    expect(publicResponse.headers.allow).toBe("GET, POST");
    expect(publicResponse.body.error.code).toBe("METHOD_NOT_ALLOWED");
    expect(publicFixture.publicComment.create).not.toHaveBeenCalled();
    expect(publicFixture.ticketFindFirst).not.toHaveBeenCalled();

    const noteFixture = makePrisma("IT_STAFF");
    const noteResponse = await write(createApp(noteFixture.prisma), method, "/api/tickets/42/internal-notes").send({ content: "PRIVATE-NOTE-FRAGMENT" });
    expect(noteResponse.status).toBe(405);
    expect(noteResponse.headers.allow).toBe("GET, POST");
    expect(JSON.stringify(noteResponse.body)).not.toContain("PRIVATE-NOTE-FRAGMENT");
    expect(noteFixture.internalNote.create).not.toHaveBeenCalled();
  });

  it("processes anonymous and restricted sessions before unsupported-method 405 responses", async () => {
    const anonymousFixture = makePrisma("REQUESTER");
    const anonymous = await request(createApp(anonymousFixture.prisma)).delete("/api/tickets/42/comments");
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe("SESSION_REQUIRED");

    const restrictedFixture = makePrisma("IT_STAFF", { restricted: true });
    const restricted = await write(createApp(restrictedFixture.prisma), "patch", "/api/tickets/42/internal-notes");
    expect(restricted.status).toBe(403);
    expect(restricted.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
  });

  it("keeps Requester role-first denial for unsupported Internal Note methods", async () => {
    const fixture = makePrisma("REQUESTER", { missing: true });
    const response = await write(createApp(fixture.prisma), "delete", "/api/tickets/999999/internal-notes");
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("ROLE_FORBIDDEN");
    expect(fixture.ticketFindFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["REQUESTER", "get", "/api/tickets/42/comments", "comments-list"],
    ["REQUESTER", "post", "/api/tickets/42/comments", "comments-create"],
    ["IT_STAFF", "get", "/api/tickets/42/internal-notes", "notes-list"],
    ["IT_STAFF", "post", "/api/tickets/42/internal-notes", "notes-create"],
  ] as const)("returns exact safe INTERNAL_ERROR for injected %s %s failure", async (role, method, path, fail) => {
    const fixture = makePrisma(role, { fail });
    const response = method === "get"
      ? await get(createApp(fixture.prisma), path)
      : await write(createApp(fixture.prisma), "post", path).send({ content: "SENSITIVE-CONTENT" });
    expect(response.status).toBe(500);
    expect(response.body.error).toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Unable to complete this request. Please try again.",
      correlationId: expect.any(String),
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("SENSITIVE-CONTENT");
    expect(serialized).not.toContain("PRIVATE-NOTE-FRAGMENT");
    expect(serialized).not.toContain("SQL");
  });
});
