import { Prisma, type PrismaClient, type UserRole } from "@prisma/client";

const conversationBodyFields = new Set(["content"]);

export type ConversationEntry = {
  id: number;
  ticketId: number;
  content: string;
  author: { id: number; name: string; role: UserRole };
  createdAt: string;
};

type ConversationEntryRecord = {
  id: number;
  ticketId: number;
  content: string;
  author: { id: number; name: string; role: UserRole };
  createdAt: Date;
};

type ConversationTransaction = Pick<
  Prisma.TransactionClient,
  "ticket" | "publicComment" | "internalNote" | "$executeRaw"
>;

export type ConversationPrisma = Pick<
  PrismaClient,
  "ticket" | "publicComment" | "internalNote"
> & {
  $transaction<T>(callback: (tx: ConversationTransaction) => Promise<T>): Promise<T>;
};

export const publicCommentEntrySelect = Prisma.validator<Prisma.PublicCommentSelect>()({
  id: true,
  ticketId: true,
  content: true,
  author: { select: { id: true, name: true, role: true } },
  createdAt: true,
});

export const internalNoteEntrySelect = Prisma.validator<Prisma.InternalNoteSelect>()({
  id: true,
  ticketId: true,
  content: true,
  author: { select: { id: true, name: true, role: true } },
  createdAt: true,
});

export function validateConversationBody(body: unknown): {
  input?: { content: string };
  fieldErrors: Record<string, string[]>;
} {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { fieldErrors: { body: ["Request body must be a JSON object."] } };
  }

  const raw = body as Record<string, unknown>;
  const fieldErrors: Record<string, string[]> = {};
  for (const key of Object.keys(raw)) {
    if (!conversationBodyFields.has(key)) {
      fieldErrors[key] = ["This field is not supported."];
    }
  }

  if (typeof raw.content !== "string") {
    fieldErrors.content = ["Content must be a string containing 1 to 5,000 characters."];
  } else {
    const content = raw.content.trim();
    if (content.length < 1 || content.length > 5000) {
      fieldErrors.content = ["Content must contain 1 to 5,000 characters."];
    }
    if (Object.keys(fieldErrors).length === 0) {
      return { input: { content }, fieldErrors };
    }
  }

  return { fieldErrors };
}

function projectEntry(entry: ConversationEntryRecord): ConversationEntry {
  return {
    id: entry.id,
    ticketId: entry.ticketId,
    content: entry.content,
    author: {
      id: entry.author.id,
      name: entry.author.name,
      role: entry.author.role,
    },
    createdAt: entry.createdAt.toISOString(),
  };
}

export function projectPublicCommentEntry(entry: ConversationEntryRecord): ConversationEntry {
  return projectEntry(entry);
}

export function projectInternalNoteEntry(entry: ConversationEntryRecord): ConversationEntry {
  return projectEntry(entry);
}

export class ConversationResourceNotFoundError extends Error {
  constructor() {
    super("RESOURCE_NOT_FOUND");
  }
}

function ticketWhere(ticketId: number, requesterId: number | null) {
  return requesterId === null ? { id: ticketId } : { id: ticketId, requesterId };
}

async function touchTicketUpdatedAt(
  tx: Pick<Prisma.TransactionClient, "$executeRaw">,
  ticketId: number,
  requesterId: number | null,
  candidate: Date,
): Promise<number> {
  if (requesterId === null) {
    return tx.$executeRaw`
      UPDATE "Ticket"
      SET "updatedAt" = GREATEST("updatedAt", ${candidate})
      WHERE "id" = ${ticketId}
    `;
  }

  return tx.$executeRaw`
    UPDATE "Ticket"
    SET "updatedAt" = GREATEST("updatedAt", ${candidate})
    WHERE "id" = ${ticketId}
      AND "requesterId" = ${requesterId}
  `;
}

export async function listPublicComments(
  prisma: ConversationPrisma,
  ticketId: number,
  requesterId: number | null,
): Promise<ConversationEntry[]> {
  const parent = await prisma.ticket.findFirst({
    where: ticketWhere(ticketId, requesterId),
    select: { id: true },
  });
  if (!parent) throw new ConversationResourceNotFoundError();

  const entries = await prisma.publicComment.findMany({
    where: { ticketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: publicCommentEntrySelect,
  });
  return entries.map(projectPublicCommentEntry);
}

export async function createPublicComment(
  prisma: ConversationPrisma,
  ticketId: number,
  requesterId: number | null,
  authorId: number,
  content: string,
): Promise<ConversationEntry> {
  return prisma.$transaction(async (tx) => {
    const where = ticketWhere(ticketId, requesterId);
    const parent = await tx.ticket.findFirst({ where, select: { id: true } });
    if (!parent) throw new ConversationResourceNotFoundError();

    const createdAt = new Date();
    const entry = await tx.publicComment.create({
      data: { ticketId, authorId, content, createdAt },
      select: publicCommentEntrySelect,
    });
    const touched = await touchTicketUpdatedAt(tx, ticketId, requesterId, createdAt);
    if (touched !== 1) throw new ConversationResourceNotFoundError();
    return projectPublicCommentEntry(entry);
  });
}

export async function listInternalNotes(
  prisma: ConversationPrisma,
  ticketId: number,
): Promise<ConversationEntry[]> {
  const parent = await prisma.ticket.findFirst({
    where: { id: ticketId },
    select: { id: true },
  });
  if (!parent) throw new ConversationResourceNotFoundError();

  const entries = await prisma.internalNote.findMany({
    where: { ticketId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: internalNoteEntrySelect,
  });
  return entries.map(projectInternalNoteEntry);
}

export async function createInternalNote(
  prisma: ConversationPrisma,
  ticketId: number,
  authorId: number,
  content: string,
): Promise<ConversationEntry> {
  return prisma.$transaction(async (tx) => {
    const parent = await tx.ticket.findFirst({
      where: { id: ticketId },
      select: { id: true },
    });
    if (!parent) throw new ConversationResourceNotFoundError();

    const createdAt = new Date();
    const entry = await tx.internalNote.create({
      data: { ticketId, authorId, content, createdAt },
      select: internalNoteEntrySelect,
    });
    const touched = await touchTicketUpdatedAt(tx, ticketId, null, createdAt);
    if (touched !== 1) throw new ConversationResourceNotFoundError();
    return projectInternalNoteEntry(entry);
  });
}
