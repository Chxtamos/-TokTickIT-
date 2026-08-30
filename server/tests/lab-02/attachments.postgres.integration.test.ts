import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app.js";

const runIntegration = process.env.RUN_DB_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
const integration = runIntegration ? describe : describe.skip;
const storageDirectory = path.resolve(process.cwd(), "storage", "attachments-integration");
const pdfBytes = Buffer.from("%PDF-1.7\npostgres integration fixture");

integration("Attachment APIs PostgreSQL integration", () => {
  let prisma: PrismaClient;
  let requesterA: number;
  let requesterB: number;
  let categoryId: number;
  let relatedSystemId: number;
  const ticketIds: number[] = [];

  async function createTicket(requesterId: number, summary: string) {
    const [{ nextval }] = await prisma.$queryRaw<Array<{ nextval: bigint }>>(
      Prisma.sql`SELECT nextval('"TicketNumberSequence"')`,
    );
    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber: `TKT-${new Date().getUTCFullYear()}-${nextval.toString().padStart(6, "0")}`,
        requesterId,
        categoryId,
        relatedSystemId,
        summary,
        description: "Attachment API PostgreSQL integration fixture.",
        requestedPriority: "MEDIUM",
        currentStatus: "NEW",
        clientRequestId: randomUUID(),
        requestPayloadHash: "b".repeat(64),
      },
    });
    ticketIds.push(ticket.id);
    return ticket.id;
  }

  beforeAll(async () => {
    process.env.ATTACHMENT_STORAGE_DIR = storageDirectory;
    await rm(storageDirectory, { recursive: true, force: true });
    prisma = new PrismaClient();
    await prisma.$connect();
    const [requesters, category, relatedSystem] = await Promise.all([
      prisma.requesterUser.findMany({ where: { isActive: true }, select: { id: true }, orderBy: { id: "asc" }, take: 2 }),
      prisma.category.findFirst({ where: { isActive: true }, select: { id: true } }),
      prisma.relatedSystem.findFirst({ where: { isActive: true }, select: { id: true } }),
    ]);
    if (requesters.length < 2 || !category || !relatedSystem) {
      throw new Error("Integration test requires two active Requesters and seeded reference data.");
    }
    requesterA = requesters[0].id;
    requesterB = requesters[1].id;
    categoryId = category.id;
    relatedSystemId = relatedSystem.id;
  });

  afterAll(async () => {
    if (prisma) {
      if (ticketIds.length > 0) await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      await prisma.$disconnect();
    }
    await rm(storageDirectory, { recursive: true, force: true });
    delete process.env.ATTACHMENT_STORAGE_DIR;
  });

  it("persists real metadata, enforces ownership, downloads, and soft-removes", async () => {
    const ticketId = await createTicket(requesterA, "Attachment lifecycle integration");
    const app = createApp(prisma);
    const uploaded = await request(app)
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", String(requesterA))
      .attach("file", pdfBytes, "lifecycle.pdf");
    expect(uploaded.status).toBe(201);

    const attachmentId = uploaded.body.id as number;
    const stored = await prisma.attachment.findUnique({ where: { id: attachmentId } });
    expect(stored).toMatchObject({ ticketId, originalName: "lifecycle.pdf", mimeType: "application/pdf", removedAt: null });

    const listed = await request(app).get(`/api/tickets/${ticketId}/attachments`).set("X-Requester-Id", String(requesterA));
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0]).toMatchObject({ id: attachmentId, state: "ACTIVE", downloadUrl: `/api/tickets/${ticketId}/attachments/${attachmentId}/download` });

    const downloaded = await request(app).get(`/api/tickets/${ticketId}/attachments/${attachmentId}/download`).set("X-Requester-Id", String(requesterA));
    expect(downloaded.status).toBe(200);
    expect(Buffer.from(downloaded.body).equals(pdfBytes)).toBe(true);
    expect(downloaded.headers["x-content-type-options"]).toBe("nosniff");

    const nonOwner = await request(app).get(`/api/tickets/${ticketId}/attachments`).set("X-Requester-Id", String(requesterB));
    expect(nonOwner.status).toBe(404);

    const removed = await request(app)
      .delete(`/api/tickets/${ticketId}/attachments/${attachmentId}`)
      .set("X-Requester-Id", String(requesterA))
      .send({ reason: "No longer required" });
    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({ state: "REMOVED", downloadUrl: null, removedReason: "No longer required" });
    await expect(prisma.attachment.findUnique({ where: { id: attachmentId } })).resolves.toMatchObject({ removedAt: expect.any(Date), removedReason: "No longer required" });

    const removedDownload = await request(app).get(`/api/tickets/${ticketId}/attachments/${attachmentId}/download`).set("X-Requester-Id", String(requesterA));
    expect(removedDownload.status).toBe(404);
  });

  it("does not leave metadata when storage preparation fails", async () => {
    const ticketId = await createTicket(requesterA, "Attachment storage rollback integration");
    const failurePath = path.resolve(process.cwd(), "storage", "attachment-storage-failure-marker");
    await rm(failurePath, { recursive: true, force: true });
    await mkdir(path.dirname(failurePath), { recursive: true });
    await writeFile(failurePath, "not a directory");
    const before = await prisma.attachment.count({ where: { ticketId } });
    process.env.ATTACHMENT_STORAGE_DIR = failurePath;

    const response = await request(createApp(prisma))
      .post(`/api/tickets/${ticketId}/attachments`)
      .set("X-Requester-Id", String(requesterA))
      .attach("file", pdfBytes, "storage-failure.pdf");

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("ATTACHMENT_UPLOAD_FAILED");
    await expect(prisma.attachment.count({ where: { ticketId } })).resolves.toBe(before);
    process.env.ATTACHMENT_STORAGE_DIR = storageDirectory;
    await rm(failurePath, { force: true });
  });

  it("serializes concurrent uploads at the five-active limit without orphan files", async () => {
    const ticketId = await createTicket(requesterA, "Attachment concurrency integration");
    await rm(storageDirectory, { recursive: true, force: true });
    await mkdir(storageDirectory, { recursive: true });
    const existingKeys = Array.from({ length: 4 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
    await prisma.attachment.createMany({
      data: existingKeys.map((storageKey, index) => ({
        ticketId,
        originalName: `existing-${index}.pdf`,
        storageKey,
        mimeType: "application/pdf",
        sizeBytes: pdfBytes.length,
      })),
    });
    await Promise.all(existingKeys.map((storageKey) => writeFile(path.join(storageDirectory, `${storageKey}.pdf`), pdfBytes)));

    const app = createApp(prisma);
    const results = await Promise.all([
      request(app).post(`/api/tickets/${ticketId}/attachments`).set("X-Requester-Id", String(requesterA)).attach("file", pdfBytes, "race-a.pdf"),
      request(app).post(`/api/tickets/${ticketId}/attachments`).set("X-Requester-Id", String(requesterA)).attach("file", pdfBytes, "race-b.pdf"),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    await expect(prisma.attachment.count({ where: { ticketId, removedAt: null } })).resolves.toBe(5);
    expect(await readdir(storageDirectory)).toHaveLength(5);
  });
});
