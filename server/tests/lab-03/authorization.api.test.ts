import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createHash } from "node:crypto";
import type { UserRole } from "@prisma/client";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";

const origin = "http://127.0.0.1:5173";
const token = "authorization-test-session-token";
const tokenHash = createHash("sha256").update(token).digest("hex");
const csrfToken = "a".repeat(64);
const cookie = `toktickit.sid=${token}`;

function detail(requesterId = 1) {
  const createdAt = new Date("2026-09-18T00:00:00.000Z");
  return {
    id: 42,
    ticketNumber: "TKT-2026-000042",
    requesterId,
    categoryId: 2,
    relatedSystemId: 7,
    ticketOwnerId: null,
    summary: "Authenticated Requester Ticket",
    description: "A preserved Ticket detail returned through authenticated ownership.",
    requestedPriority: "MEDIUM" as const,
    itPriority: "MEDIUM" as const,
    currentStatus: "OPEN" as const,
    version: 1,
    resolutionSummary: null,
    resolvedAt: null,
    closedAt: null,
    requesterResolvedAt: null,
    requesterResolvedById: null,
    lastStatusReason: null,
    clientRequestId: "f13f2298-1153-4cea-966d-3bc466d53d7b",
    requestPayloadHash: "b".repeat(64),
    createdAt,
    updatedAt: createdAt,
    requester: { id: requesterId, name: "Requester A", email: "requester.a@example.test", role: "REQUESTER" as const },
    owner: null,
    requesterResolved: null,
    category: { id: 2, name: "Hardware" },
    relatedSystem: { id: 7, name: "Corporate Laptop" },
    attachments: [],
  };
}

function makePrisma(role: UserRole = "REQUESTER", options: { nonOwned?: boolean; status?: string; version?: number; restricted?: boolean } = {}) {
  const user = {
    id: role === "REQUESTER" ? 1 : role === "IT_STAFF" ? 10 : 20,
    name: `${role} User`,
    email: `${role.toLowerCase()}@example.test`,
    role,
    isActive: true,
    passwordHash: "unused",
    mustChangePassword: options.restricted ?? false,
    passwordChangedAt: new Date("2026-09-01T00:00:00.000Z"),
    version: 1,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  };
  const ticket: any = detail();
  ticket.currentStatus = options.status ?? "OPEN";
  ticket.version = options.version ?? 1;

  const transaction: any = {
    requesterUser: {
      findFirst: vi.fn().mockResolvedValue(ticket.requester),
    },
    category: {
      findFirst: vi.fn().mockResolvedValue(ticket.category),
    },
    relatedSystem: {
      findFirst: vi.fn().mockResolvedValue(ticket.relatedSystem),
    },
    ticket: {
      findMany: vi.fn().mockResolvedValue([ticket]),
      count: vi.fn().mockResolvedValue(1),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn(async (args: any) => {
        if (options.nonOwned && args.where?.requesterId !== undefined) return null;
        if (args.select?.version && !args.select?.ticketNumber) {
          return {
            id: ticket.id,
            version: ticket.version,
            currentStatus: ticket.currentStatus,
            requesterResolvedAt: ticket.requesterResolvedAt,
          };
        }
        if (args.select?.ticketNumber) return ticket;
        return { id: ticket.id };
      }),
      create: vi.fn(async () => ticket),
      updateMany: vi.fn(async () => {
        ticket.requesterResolvedAt = new Date("2026-09-18T01:00:00.000Z");
        ticket.requesterResolved = ticket.requester;
        ticket.version += 1;
        return { count: 1 };
      }),
    },
    attachment: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ nextval: 42n }]),
  };
  const prisma = {
    ...transaction,
    category: {
      ...transaction.category,
      findMany: vi.fn().mockResolvedValue([{ id: 1, name: "Hardware" }]),
    },
    relatedSystem: {
      ...transaction.relatedSystem,
      findMany: vi.fn().mockResolvedValue([{ id: 1, name: "Email" }]),
    },
    requesterUser: transaction.requesterUser,
    session: {
      findUnique: vi.fn(async (args: any) => args.where.tokenHash === tokenHash ? {
        id: "00000000-0000-4000-8000-000000000001",
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
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(transaction)),
  } as unknown as ReferenceDataPrisma;
  return { prisma, transaction, ticket };
}

function authenticated(application: ReturnType<typeof createApp>) {
  return {
    get: (path: string) => request(application).get(path).set("Cookie", cookie),
    post: (path: string) => request(application).post(path).set("Cookie", cookie).set("Origin", origin).set("X-CSRF-Token", csrfToken),
    delete: (path: string) => request(application).delete(path).set("Cookie", cookie).set("Origin", origin).set("X-CSRF-Token", csrfToken),
  };
}

describe("Lab 3 authorization and Requester regression", () => {
  beforeEach(() => {
    process.env.CLIENT_ORIGIN = origin;
    delete process.env.LAB2_E2E_LEGACY_AUTH;
  });

  it("protects both reference-data APIs for anonymous/restricted sessions and permits every normal role", async () => {
    for (const path of ["/api/categories", "/api/related-systems"]) {
      const anonymousFixture = makePrisma();
      const anonymous = await request(createApp(anonymousFixture.prisma)).get(path);
      expect(anonymous.status, `${path} anonymous`).toBe(401);
      expect(anonymous.body.error.code, `${path} anonymous code`).toBe("SESSION_REQUIRED");
      expect((anonymousFixture.prisma as any).category.findMany, `${path} anonymous category lookup`).not.toHaveBeenCalled();
      expect((anonymousFixture.prisma as any).relatedSystem.findMany, `${path} anonymous system lookup`).not.toHaveBeenCalled();

      const legacyHeaderFixture = makePrisma();
      const legacyHeader = await request(createApp(legacyHeaderFixture.prisma))
        .get(path)
        .set("X-Requester-Id", "999");
      expect(legacyHeader.status, `${path} legacy header`).toBe(401);
      expect(legacyHeader.body.error.code, `${path} legacy header code`).toBe("SESSION_REQUIRED");

      for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const) {
        const restrictedFixture = makePrisma(role, { restricted: true });
        const restricted = await authenticated(createApp(restrictedFixture.prisma)).get(path);
        expect(restricted.status, `${path} ${role} restricted`).toBe(403);
        expect(restricted.body.error.code, `${path} ${role} restricted code`).toBe("PASSWORD_CHANGE_REQUIRED");

        const fixture = makePrisma(role);
        const references = await authenticated(createApp(fixture.prisma)).get(path);
        expect(references.status, `${path} ${role}`).toBe(200);
      }
    }

    const staff = makePrisma("IT_STAFF");
    const forbidden = await authenticated(createApp(staff.prisma)).get("/api/tickets");
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("ROLE_FORBIDDEN");
    expect(staff.transaction.ticket.findMany).not.toHaveBeenCalled();
  });

  it("fails closed when the session delegate is unavailable unless the explicit legacy E2E gate is enabled", async () => {
    const fixture = makePrisma("REQUESTER");
    const withoutSession = { ...fixture.prisma } as any;
    delete withoutSession.session;

    const denied = await request(createApp(withoutSession))
      .get("/api/tickets")
      .set("X-Requester-Id", "1");

    expect(denied.status).toBe(401);
    expect(denied.body.error.code).toBe("SESSION_REQUIRED");
  });

  it("never enables the legacy identity/CSRF adapter from its flag alone in a normal runtime", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousCi = process.env.CI;
    process.env.LAB2_E2E_LEGACY_AUTH = "1";
    process.env.NODE_ENV = "production";
    delete process.env.CI;
    try {
      const fixture = makePrisma("REQUESTER");
      const withoutSession = { ...fixture.prisma } as any;
      delete withoutSession.session;
      const response = await request(createApp(withoutSession))
        .post("/api/tickets")
        .set("X-Requester-Id", "1")
        .set("Origin", origin)
        .send({});
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("SESSION_REQUIRED");
    } finally {
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnv;
      if (previousCi === undefined) delete process.env.CI;
      else process.env.CI = previousCi;
      delete process.env.LAB2_E2E_LEGACY_AUTH;
    }
  });

  it("covers every protected resource endpoint against anonymous, restricted and all normal roles", async () => {
    type MatrixCase = {
      name: string;
      allowed: UserRole[];
      expectedAllowed: { status: number; errorCode?: string };
      run: (application: ReturnType<typeof createApp>, authenticatedRequest: boolean) => Promise<request.Response>;
    };
    const cases: MatrixCase[] = [
      { name: "categories GET", allowed: ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"], expectedAllowed: { status: 200 }, run: (app, auth) => (auth ? authenticated(app).get("/api/categories") : request(app).get("/api/categories")) },
      { name: "related systems GET", allowed: ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"], expectedAllowed: { status: 200 }, run: (app, auth) => (auth ? authenticated(app).get("/api/related-systems") : request(app).get("/api/related-systems")) },
      { name: "ticket list GET", allowed: ["REQUESTER"], expectedAllowed: { status: 200 }, run: (app, auth) => (auth ? authenticated(app).get("/api/tickets") : request(app).get("/api/tickets")) },
      { name: "ticket detail GET", allowed: ["REQUESTER"], expectedAllowed: { status: 200 }, run: (app, auth) => (auth ? authenticated(app).get("/api/tickets/42") : request(app).get("/api/tickets/42")) },
      { name: "attachment list GET", allowed: ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"], expectedAllowed: { status: 200 }, run: (app, auth) => (auth ? authenticated(app).get("/api/tickets/42/attachments") : request(app).get("/api/tickets/42/attachments")) },
      { name: "attachment download GET", allowed: ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"], expectedAllowed: { status: 404, errorCode: "RESOURCE_NOT_FOUND" }, run: (app, auth) => (auth ? authenticated(app).get("/api/tickets/42/attachments/1/download") : request(app).get("/api/tickets/42/attachments/1/download")) },
      { name: "attachment upload POST", allowed: ["REQUESTER"], expectedAllowed: { status: 400, errorCode: "ATTACHMENT_REQUIRED" }, run: (app, auth) => {
        const call = request(app).post("/api/tickets/42/attachments");
        if (auth) call.set("Cookie", cookie).set("Origin", origin).set("X-CSRF-Token", csrfToken);
        return call;
      } },
      { name: "attachment remove DELETE", allowed: ["REQUESTER"], expectedAllowed: { status: 404, errorCode: "RESOURCE_NOT_FOUND" }, run: (app, auth) => {
        const call = request(app).delete("/api/tickets/42/attachments/1");
        if (auth) call.set("Cookie", cookie).set("Origin", origin).set("X-CSRF-Token", csrfToken);
        return call.send({ reason: "matrix removal" });
      } },
      { name: "ticket create POST", allowed: ["REQUESTER"], expectedAllowed: { status: 201 }, run: (app, auth) => {
        const call = request(app).post("/api/tickets");
        if (auth) call.set("Cookie", cookie).set("Origin", origin).set("X-CSRF-Token", csrfToken);
        return call.send({ clientRequestId: "f13f2298-1153-4cea-966d-3bc466d53d7b", categoryId: 2, relatedSystemId: 7, summary: "Matrix create", requestedPriority: "MEDIUM", description: "Authorization matrix request." });
      } },
      { name: "resolution indication POST", allowed: ["REQUESTER"], expectedAllowed: { status: 200 }, run: (app, auth) => {
        const call = request(app).post("/api/tickets/42/resolution-indication");
        if (auth) call.set("Cookie", cookie).set("Origin", origin).set("X-CSRF-Token", csrfToken);
        return call.send({ expectedVersion: 1 });
      } },
    ];

    for (const entry of cases) {
      const anonymousFixture = makePrisma("REQUESTER");
      const anonymous = await entry.run(createApp(anonymousFixture.prisma), false);
      expect(anonymous.status, `${entry.name} anonymous`).toBe(401);
      expect(anonymous.body.error.code, `${entry.name} anonymous code`).toBe("SESSION_REQUIRED");

      for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const) {
        const restrictedFixture = makePrisma(role, { restricted: true });
        const restricted = await entry.run(createApp(restrictedFixture.prisma), true);
        expect(restricted.status, `${entry.name} ${role} restricted`).toBe(403);
        expect(restricted.body.error.code, `${entry.name} ${role} restricted code`).toBe("PASSWORD_CHANGE_REQUIRED");

        const fixture = makePrisma(role);
        const response = await entry.run(createApp(fixture.prisma), true);
        if (entry.allowed.includes(role)) {
          expect(response.status, `${entry.name} ${role} allowed status`).toBe(entry.expectedAllowed.status);
          if (entry.expectedAllowed.errorCode) {
            expect(response.body.error.code, `${entry.name} ${role} allowed contract`).toBe(entry.expectedAllowed.errorCode);
          }
        } else {
          expect(response.status, `${entry.name} ${role} denied`).toBe(403);
          expect(response.body.error.code, `${entry.name} ${role} denied code`).toBe("ROLE_FORBIDDEN");
        }
      }
    }
  });

  it("tests the current Internal Note authorization stub without claiming unimplemented Staff/Admin success", async () => {
    for (const method of ["get", "post"] as const) {
      const anonymousFixture = makePrisma("REQUESTER");
      const anonymousCall = request(createApp(anonymousFixture.prisma))[method]("/api/tickets/42/notes");
      const anonymous = method === "post" ? await anonymousCall.send({ content: "private" }) : await anonymousCall;
      expect(anonymous.status, `internal notes ${method} anonymous`).toBe(401);
      expect(anonymous.body.error.code).toBe("SESSION_REQUIRED");

      for (const role of ["REQUESTER", "IT_STAFF", "ADMINISTRATOR"] as const) {
        const restrictedFixture = makePrisma(role, { restricted: true });
        const restrictedApp = createApp(restrictedFixture.prisma);
        const restricted = method === "get"
          ? await authenticated(restrictedApp).get("/api/tickets/42/notes")
          : await authenticated(restrictedApp).post("/api/tickets/42/notes").send({ content: "private" });
        expect(restricted.status, `internal notes ${method} ${role} restricted`).toBe(403);
        expect(restricted.body.error.code).toBe("PASSWORD_CHANGE_REQUIRED");
      }

      const requesterFixture = makePrisma("REQUESTER");
      const requesterApp = createApp(requesterFixture.prisma);
      const requesterResponse = method === "get"
        ? await authenticated(requesterApp).get("/api/tickets/42/notes")
        : await authenticated(requesterApp).post("/api/tickets/42/notes").send({ content: "private" });
      expect(requesterResponse.status).toBe(403);
      expect(requesterResponse.body.error.code).toBe("ROLE_FORBIDDEN");
    }
  });

  it("uses the authenticated Requester and ignores spoofed requester headers and fields", async () => {
    const fixture = makePrisma("REQUESTER");
    const application = createApp(fixture.prisma);
    const list = await authenticated(application).get("/api/tickets").set("X-Requester-Id", "999");
    expect(list.status).toBe(200);
    expect(fixture.transaction.ticket.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ requesterId: 1 }),
    }));

    const querySpoof = await authenticated(application).get("/api/tickets?requesterId=999");
    expect(querySpoof.status).toBe(400);
    expect(querySpoof.body.error.code).toBe("INVALID_QUERY");

    const bodySpoof = await authenticated(application).post("/api/tickets").send({
      requesterId: 999,
      clientRequestId: "f13f2298-1153-4cea-966d-3bc466d53d7b",
      categoryId: 2,
      relatedSystemId: 7,
      summary: "Authenticated request body",
      requestedPriority: "MEDIUM",
      description: "Requester identity cannot be supplied by the client.",
    });
    expect(bodySpoof.status).toBe(400);
    expect(bodySpoof.body.error.fieldErrors.requesterId).toBeDefined();
  });

  it("retires the Development Requester endpoint and denies Internal Notes before parent lookup", async () => {
    const fixture = makePrisma("REQUESTER");
    const application = createApp(fixture.prisma);
    const retired = await authenticated(application).get("/api/development-requesters");
    expect(retired.status).toBe(404);
    expect(retired.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const getNotes = await authenticated(application).get("/api/tickets/999999/notes");
    const postNotes = await authenticated(application).post("/api/tickets/999999/notes").send({ content: "private" });
    expect(getNotes.status).toBe(403);
    expect(postNotes.status).toBe(403);
    expect(getNotes.body.error.code).toBe("ROLE_FORBIDDEN");
    expect(fixture.transaction.ticket.findFirst).not.toHaveBeenCalled();
  });

  it("requires CSRF for Requester writes and rejects Staff upload/remove before resource lookup", async () => {
    const requesterFixture = makePrisma("REQUESTER");
    const requesterApp = createApp(requesterFixture.prisma);
    const missingCsrf = await request(requesterApp)
      .post("/api/tickets")
      .set("Cookie", cookie)
      .set("Origin", origin)
      .send({});
    expect(missingCsrf.status).toBe(403);
    expect(missingCsrf.body.error.code).toBe("CSRF_INVALID");

    const multipart = await request(requesterApp)
      .post("/api/tickets/42/attachments")
      .set("Cookie", cookie)
      .set("Origin", origin)
      .attach("file", Buffer.from("%PDF-1.7\nfixture"), "fixture.pdf");
    expect(multipart.status).toBe(403);

    const staffFixture = makePrisma("IT_STAFF");
    const staffApp = createApp(staffFixture.prisma);
    const upload = await request(staffApp)
      .post("/api/tickets/42/attachments")
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set("X-CSRF-Token", csrfToken)
      .attach("file", Buffer.from("%PDF-1.7\nfixture"), "fixture.pdf");
    const remove = await authenticated(staffApp).delete("/api/tickets/42/attachments/1").send({ reason: "Not permitted" });
    expect(upload.status).toBe(403);
    expect(remove.status).toBe(403);
    expect(staffFixture.transaction.ticket.findFirst).not.toHaveBeenCalled();
  });

  it("allows operational Attachment reads while keeping Requester reads owner-scoped", async () => {
    const staff = makePrisma("IT_STAFF");
    const staffList = await authenticated(createApp(staff.prisma)).get("/api/tickets/42/attachments");
    expect(staffList.status).toBe(200);
    expect(staff.transaction.ticket.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42 } }));

    const nonOwner = makePrisma("REQUESTER", { nonOwned: true });
    const denied = await authenticated(createApp(nonOwner.prisma)).get("/api/tickets/42/attachments");
    expect(denied.status).toBe(404);
    expect(denied.body.error.code).toBe("RESOURCE_NOT_FOUND");
  });

  it("records an owner-only resolution indication without changing status", async () => {
    const fixture = makePrisma("REQUESTER");
    const response = await authenticated(createApp(fixture.prisma))
      .post("/api/tickets/42/resolution-indication")
      .send({ expectedVersion: 1 });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: 42,
      currentStatus: "OPEN",
      version: 2,
      requesterResolvedAt: "2026-09-18T01:00:00.000Z",
      requesterResolvedBy: { id: 1, role: "REQUESTER" },
    });
    expect(fixture.transaction.ticket.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 42, requesterId: 1, version: 1 },
      data: expect.objectContaining({ requesterResolvedById: 1, version: { increment: 1 } }),
    }));
  });
});
