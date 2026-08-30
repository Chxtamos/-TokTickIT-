import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { createApp, type ReferenceDataPrisma } from "../../src/app.js";

const storageDirectory = path.resolve(process.cwd(), "storage", "attachments");
const pdfBytes = Buffer.from("%PDF-1.7\nfixture");
const validFixtures = [
  { extension: "jpg", mimeType: "image/jpeg", bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
  { extension: "jpeg", mimeType: "image/jpeg", bytes: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
  { extension: "png", mimeType: "image/png", bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { extension: "webp", mimeType: "image/webp", bytes: Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]) },
  { extension: "pdf", mimeType: "application/pdf", bytes: pdfBytes },
] as const;

function makeAttachment(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    originalName: "report.pdf",
    mimeType: "application/pdf",
    sizeBytes: pdfBytes.length,
    uploadedAt: new Date("2026-08-24T10:02:00.000Z"),
    removedAt: null,
    removedReason: null,
    storageKey: randomUUID(),
    ...overrides,
  };
}

function makePrisma(options: {
  attachment?: unknown;
  attachments?: unknown[];
  activeCount?: number;
  inactiveRequester?: boolean;
  missingTicket?: boolean;
  fail?: boolean;
  failTransaction?: boolean;
} = {}) {
  const attachmentResult = Object.prototype.hasOwnProperty.call(options, "attachment") ? options.attachment : makeAttachment();
  const transaction = {
    attachment: {
      count: vi.fn().mockResolvedValue(options.activeCount ?? 0),
      create: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...makeAttachment(),
        ...data,
        id: 12,
        uploadedAt: new Date("2026-08-24T10:02:00.000Z"),
        removedAt: null,
        removedReason: null,
      })),
      findFirst: vi.fn().mockResolvedValue(attachmentResult),
      update: vi.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...makeAttachment({ removedAt: new Date("2026-08-25T10:00:00.000Z"), removedReason: "No longer needed" }),
        ...data,
      })),
      findMany: vi.fn().mockResolvedValue(options.attachments ?? [makeAttachment()]),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    requesterUser: {
      findFirst: vi.fn().mockResolvedValue(options.inactiveRequester ? null : { id: 1 }),
    },
    ticket: {
      findFirst: options.fail ? vi.fn().mockRejectedValue(new Error("database unavailable")) : vi.fn().mockResolvedValue(options.missingTicket ? null : { id: 42 }),
    },
  };
  const prisma = {
    ...transaction,
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => {
      if (options.failTransaction) throw new Error("database unavailable");
      return callback(transaction);
    }),
  } as unknown as ReferenceDataPrisma;
  return { prisma, transaction };
}

afterEach(async () => {
  await rm(storageDirectory, { recursive: true, force: true });
});

describe("Attachment APIs", () => {
  it.each(validFixtures)("accepts .$extension with matching MIME and signature", async ({ extension, mimeType, bytes }) => {
    const { prisma } = makePrisma();
    const res = await request(createApp(prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", bytes, { filename: `valid.${extension}`, contentType: mimeType });

    expect(res.status).toBe(201);
    expect(res.body.mimeType).toBe(mimeType);
    expect(res.body.originalName).toBe(`valid.${extension}`);
  });

  it("uploads one supported file and returns active metadata", async () => {
    const { prisma, transaction } = makePrisma();
    const res = await request(createApp(prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", pdfBytes, "../battery report.pdf");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      id: 12,
      originalName: "battery report.pdf",
      mimeType: "application/pdf",
      state: "ACTIVE",
      removedAt: null,
      removedReason: null,
      downloadUrl: "/api/tickets/42/attachments/12/download",
    });
    expect(res.body.storageKey).toBeUndefined();
    expect(transaction.attachment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ticketId: 42, originalName: "battery report.pdf", mimeType: "application/pdf" }),
    }));
    expect((await readdir(storageDirectory)).length).toBe(1);
  });

  it("accepts the exact 5 MiB boundary", async () => {
    const { prisma } = makePrisma();
    const exactLimit = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(5_242_880 - 9)]);
    const res = await request(createApp(prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", exactLimit, "exact-limit.pdf");

    expect(res.status).toBe(201);
    expect(res.body.sizeBytes).toBe(5_242_880);
  });

  it("rejects missing, unsupported, signature-mismatched, oversized, and sixth active files", async () => {
    const missing = await request(createApp(makePrisma().prisma)).post("/api/tickets/42/attachments").set("X-Requester-Id", "1");
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("ATTACHMENT_REQUIRED");

    const unsupported = await request(createApp(makePrisma().prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", Buffer.from("plain text"), "notes.txt");
    expect(unsupported.status).toBe(415);
    expect(unsupported.body.error.code).toBe("ATTACHMENT_TYPE_UNSUPPORTED");

    const mismatch = await request(createApp(makePrisma().prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", Buffer.from("plain text"), "notes.pdf");
    expect(mismatch.status).toBe(415);

    const mimeMismatch = await request(createApp(makePrisma().prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", validFixtures[2].bytes, { filename: "image.png", contentType: "image/jpeg" });
    expect(mimeMismatch.status).toBe(415);

    const oversized = await request(createApp(makePrisma().prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", Buffer.alloc(5_242_881), "large.pdf");
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe("ATTACHMENT_TOO_LARGE");

    const limited = await request(createApp(makePrisma({ activeCount: 5 }).prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", pdfBytes, "limited.pdf");
    expect(limited.status).toBe(409);
    expect(limited.body.error.code).toBe("ATTACHMENT_LIMIT_REACHED");
  });

  it("lists owned active and removed Attachment metadata in deterministic order", async () => {
    const attachments = [
      makeAttachment({ id: 10, originalName: "first.pdf", uploadedAt: new Date("2026-08-24T10:00:00.000Z") }),
      makeAttachment({ id: 11, originalName: "removed.pdf", uploadedAt: new Date("2026-08-24T10:00:00.000Z"), removedAt: new Date("2026-08-25T10:00:00.000Z"), removedReason: "Duplicate" }),
    ];
    const { prisma, transaction } = makePrisma({ attachments });
    const res = await request(createApp(prisma)).get("/api/tickets/42/attachments").set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.body.map((item: { originalName: string }) => item.originalName)).toEqual(["first.pdf", "removed.pdf"]);
    expect(res.body[0]).toMatchObject({ state: "ACTIVE", downloadUrl: "/api/tickets/42/attachments/10/download" });
    expect(res.body[1]).toMatchObject({ state: "REMOVED", downloadUrl: null, removedReason: "Duplicate" });
    expect(transaction.attachment.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ticketId: 42 },
      orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
    }));
  });

  it("returns safe list errors and does not expose non-owned Tickets", async () => {
    const missing = await request(createApp(makePrisma({ missingTicket: true }).prisma))
      .get("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1");
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe("RESOURCE_NOT_FOUND");

    const failed = await request(createApp(makePrisma({ fail: true }).prisma))
      .get("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1");
    expect(failed.status).toBe(500);
    expect(failed.body.error.code).toBe("ATTACHMENT_LIST_FAILED");
  });

  it("downloads only active owned files with safe headers", async () => {
    const attachment = makeAttachment({ originalName: "résumé.pdf", storageKey: randomUUID() });
    await mkdir(storageDirectory, { recursive: true });
    await writeFile(path.join(storageDirectory, `${attachment.storageKey}.pdf`), pdfBytes);
    const { prisma, transaction } = makePrisma({ attachment });
    const res = await request(createApp(prisma)).get("/api/tickets/42/attachments/12/download").set("X-Requester-Id", "1");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-disposition"]).toContain("filename*=UTF-8''r%C3%A9sum%C3%A9.pdf");
    expect(Buffer.from(res.body).equals(pdfBytes)).toBe(true);
    expect(transaction.attachment.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 12, ticketId: 42, removedAt: null, ticket: { requesterId: 1 } } }));
  });

  it("rejects removed or unavailable downloads safely", async () => {
    const removed = await request(createApp(makePrisma({ attachment: null }).prisma))
      .get("/api/tickets/42/attachments/12/download")
      .set("X-Requester-Id", "1");
    expect(removed.status).toBe(404);

    const unavailable = await request(createApp(makePrisma().prisma))
      .get("/api/tickets/42/attachments/12/download")
      .set("X-Requester-Id", "1");
    expect(unavailable.status).toBe(500);
    expect(unavailable.body.error.code).toBe("ATTACHMENT_DOWNLOAD_FAILED");
  });

  it("soft-removes an active owned Attachment and validates the reason", async () => {
    const { prisma, transaction } = makePrisma();
    const res = await request(createApp(prisma))
      .delete("/api/tickets/42/attachments/12")
      .set("X-Requester-Id", "1")
      .send({ reason: "No longer needed" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ state: "REMOVED", removedReason: "No longer needed", downloadUrl: null });
    expect(transaction.attachment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 12 },
      data: expect.objectContaining({ removedReason: "No longer needed", removedByRequesterId: 1 }),
    }));

    const invalid = await request(createApp(makePrisma().prisma))
      .delete("/api/tickets/42/attachments/12")
      .set("X-Requester-Id", "1")
      .send({ reason: "bad" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VALIDATION_FAILED");
  });

  it("accepts exact removal-reason boundaries and rejects an already removed file", async () => {
    const minimum = await request(createApp(makePrisma().prisma))
      .delete("/api/tickets/42/attachments/12")
      .set("X-Requester-Id", "1")
      .send({ reason: "12345" });
    expect(minimum.status).toBe(200);

    const maximum = await request(createApp(makePrisma().prisma))
      .delete("/api/tickets/42/attachments/12")
      .set("X-Requester-Id", "1")
      .send({ reason: "r".repeat(250) });
    expect(maximum.status).toBe(200);

    const alreadyRemoved = await request(createApp(makePrisma({ attachment: null }).prisma))
      .delete("/api/tickets/42/attachments/12")
      .set("X-Requester-Id", "1")
      .send({ reason: "No longer needed" });
    expect(alreadyRemoved.status).toBe(404);
  });

  it("removes a written file when metadata transaction fails", async () => {
    const res = await request(createApp(makePrisma({ failTransaction: true }).prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", pdfBytes, "failed.pdf");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("ATTACHMENT_UPLOAD_FAILED");
    expect(await readdir(storageDirectory).catch(() => [])).toEqual([]);
  });

  it("rejects unknown or inactive Requesters before Ticket/Attachment access", async () => {
    const unknown = makePrisma();
    vi.mocked(unknown.prisma.requesterUser.findFirst).mockResolvedValue(null);
    const unknownResponse = await request(createApp(unknown.prisma)).get("/api/tickets/42/attachments").set("X-Requester-Id", "999");
    expect(unknownResponse.status).toBe(400);
    expect(unknown.transaction.ticket.findFirst).not.toHaveBeenCalled();
    expect(unknown.transaction.attachment.findMany).not.toHaveBeenCalled();

    const inactive = makePrisma({ inactiveRequester: true });
    const inactiveResponse = await request(createApp(inactive.prisma)).get("/api/tickets/42/attachments").set("X-Requester-Id", "1");
    expect(inactiveResponse.status).toBe(400);
    expect(inactive.transaction.ticket.findFirst).not.toHaveBeenCalled();
  });

  it("sanitizes unsafe names and truncates Unicode names without splitting emoji", async () => {
    const { prisma } = makePrisma();
    const unsafe = await request(createApp(prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", pdfBytes, "../bad\nname.pdf");
    expect(unsafe.status).toBe(201);
    expect(unsafe.body.originalName).toBe("bad_name.pdf");

    const longName = `${"😀".repeat(300)}.pdf`;
    const unicode = await request(createApp(makePrisma().prisma))
      .post("/api/tickets/42/attachments")
      .set("X-Requester-Id", "1")
      .attach("file", pdfBytes, longName);
    expect(unicode.status).toBe(201);
    expect(Array.from(unicode.body.originalName).length).toBe(255);
    expect(unicode.body.originalName.endsWith(".pdf")).toBe(true);
    expect(unicode.body.originalName).not.toMatch(/[\ud800-\udfff](?![\udc00-\udfff])/);
  });
});
