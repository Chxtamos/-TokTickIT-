import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import multer from "multer";
import { Prisma, type PrismaClient, type RequestedPriority } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPrisma } from "./prisma.js";

export type ReferenceDataPrisma = Pick<
  PrismaClient,
  "category" | "relatedSystem" | "requesterUser" | "ticket" | "attachment" | "$transaction" | "$queryRaw"
>;

const requestedPriorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const ticketBodyFields = new Set([
  "clientRequestId",
  "categoryId",
  "relatedSystemId",
  "summary",
  "requestedPriority",
  "description",
]);

type TicketCreateInput = {
  clientRequestId: string;
  categoryId: number;
  relatedSystemId: number;
  summary: string;
  requestedPriority: RequestedPriority;
  description: string;
};

type TicketListQuery = {
  search: string;
  categoryId: number | null;
  relatedSystemId: number | null;
  requestedPriority: RequestedPriority | null;
  currentStatus: "NEW" | null;
  sortBy: "createdAt" | "updatedAt" | "ticketNumber";
  sortDirection: "asc" | "desc";
  page: number;
  pageSize: 10 | 20 | 50;
};

const ticketListQueryFields = new Set([
  "search",
  "categoryId",
  "relatedSystemId",
  "requestedPriority",
  "currentStatus",
  "sortBy",
  "sortDirection",
  "page",
  "pageSize",
]);

const MAX_ATTACHMENT_SIZE = 5_242_880;
const MAX_ACTIVE_ATTACHMENTS = 5;
function attachmentStorageDirectory(): string {
  return path.resolve(process.env.ATTACHMENT_STORAGE_DIR ?? path.join(process.cwd(), "storage", "attachments"));
}
const attachmentTypes = {
  ".jpg": { mimeType: "image/jpeg", extension: ".jpg" },
  ".jpeg": { mimeType: "image/jpeg", extension: ".jpeg" },
  ".png": { mimeType: "image/png", extension: ".png" },
  ".webp": { mimeType: "image/webp", extension: ".webp" },
  ".pdf": { mimeType: "application/pdf", extension: ".pdf" },
} as const;
const attachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ATTACHMENT_SIZE, files: 1 },
});

function errorResponse(
  res: Response,
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
) {
  const error: { code: string; message: string; fieldErrors?: Record<string, string[]>; correlationId?: string } = {
    code,
    message,
  };
  if (fieldErrors && Object.keys(fieldErrors).length > 0) error.fieldErrors = fieldErrors;
  if (status >= 500) error.correlationId = randomUUID();
  return res.status(status).json({ error });
}

function parseRequesterId(req: Request): number | null {
  const value = req.header("X-Requester-Id");
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function validateTicketBody(body: unknown): { input?: TicketCreateInput; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { fieldErrors: { body: ["Request body must be a JSON object."] } };
  }

  const raw = body as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!ticketBodyFields.has(key)) fieldErrors[key] = ["This field is not supported."];
  }

  const clientRequestId = raw.clientRequestId;
  if (typeof clientRequestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)) {
    fieldErrors.clientRequestId = ["clientRequestId must be a valid UUID."];
  }

  for (const field of ["categoryId", "relatedSystemId"] as const) {
    const value = raw[field];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
      fieldErrors[field] = ["Must be a positive integer."];
    }
  }

  const summary = typeof raw.summary === "string" ? raw.summary.trim() : "";
  if (summary.length < 5 || summary.length > 120) {
    fieldErrors.summary = ["Summary must contain 5 to 120 characters."];
  }

  if (!requestedPriorities.includes(raw.requestedPriority as (typeof requestedPriorities)[number])) {
    fieldErrors.requestedPriority = ["Requested priority is invalid."];
  }

  const description = typeof raw.description === "string" ? raw.description.trim() : "";
  if (description.length < 10 || description.length > 5000) {
    fieldErrors.description = ["Description must contain 10 to 5,000 characters."];
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };
  return {
    fieldErrors,
    input: {
      clientRequestId: clientRequestId as string,
      categoryId: raw.categoryId as number,
      relatedSystemId: raw.relatedSystemId as number,
      summary,
      requestedPriority: raw.requestedPriority as RequestedPriority,
      description,
    },
  };
}

function parseTicketListQuery(query: Request["query"]): { input?: TicketListQuery; fieldErrors: Record<string, string[]> } {
  const fieldErrors: Record<string, string[]> = {};
  const raw = query as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!ticketListQueryFields.has(key)) fieldErrors[key] = ["This query parameter is not supported."];
  }

  const read = (field: string): string | undefined => {
    const value = raw[field];
    if (value === undefined) return undefined;
    if (typeof value !== "string") {
      fieldErrors[field] = ["This query parameter must be provided once."];
      return undefined;
    }
    return value;
  };

  const searchValue = read("search");
  const search = searchValue?.trim() ?? "";
  if (search.length > 120) fieldErrors.search = ["Search must contain at most 120 characters."];

  const parseId = (field: "categoryId" | "relatedSystemId"): number | null => {
    const value = read(field);
    if (value === undefined) return null;
    if (!/^[1-9]\d*$/.test(value)) {
      fieldErrors[field] = ["Must be a positive integer."];
      return null;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      fieldErrors[field] = ["Must be a safe positive integer."];
      return null;
    }
    return parsed;
  };

  const categoryId = parseId("categoryId");
  const relatedSystemId = parseId("relatedSystemId");
  const priorityValue = read("requestedPriority");
  const requestedPriority = priorityValue === undefined ? null : requestedPriorities.includes(priorityValue as (typeof requestedPriorities)[number])
    ? (priorityValue as RequestedPriority)
    : null;
  if (priorityValue !== undefined && requestedPriority === null) {
    fieldErrors.requestedPriority = ["Requested priority is invalid."];
  }

  const statusValue = read("currentStatus");
  const currentStatus = statusValue === undefined ? null : statusValue === "NEW" ? "NEW" : null;
  if (statusValue !== undefined && currentStatus === null) fieldErrors.currentStatus = ["Current status is invalid."];

  const sortByValue = read("sortBy");
  const sortBy = sortByValue === undefined ? "updatedAt" : ["createdAt", "updatedAt", "ticketNumber"].includes(sortByValue)
    ? (sortByValue as TicketListQuery["sortBy"])
    : null;
  if (sortByValue !== undefined && sortBy === null) fieldErrors.sortBy = ["Sort field is invalid."];

  const sortDirectionValue = read("sortDirection");
  const sortDirection = sortDirectionValue === undefined ? "desc" : ["asc", "desc"].includes(sortDirectionValue)
    ? (sortDirectionValue as TicketListQuery["sortDirection"])
    : null;
  if (sortDirectionValue !== undefined && sortDirection === null) fieldErrors.sortDirection = ["Sort direction is invalid."];

  const parsePage = (): number => {
    const value = read("page");
    if (value === undefined) return 1;
    if (!/^[1-9]\d*$/.test(value)) {
      fieldErrors.page = ["Page must be a positive integer."];
      return 1;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      fieldErrors.page = ["Page must be a safe positive integer."];
      return 1;
    }
    return parsed;
  };

  const parsePageSize = (): 10 | 20 | 50 => {
    const value = read("pageSize");
    if (value === undefined) return 10;
    if (value !== "10" && value !== "20" && value !== "50") {
      fieldErrors.pageSize = ["Page size must be 10, 20, or 50."];
      return 10;
    }
    return Number(value) as 10 | 20 | 50;
  };

  const page = parsePage();
  const pageSize = parsePageSize();
  if (Object.keys(fieldErrors).length > 0 || sortBy === null || sortDirection === null) return { fieldErrors };

  return {
    fieldErrors,
    input: {
      search,
      categoryId,
      relatedSystemId,
      requestedPriority,
      currentStatus,
      sortBy,
      sortDirection,
      page,
      pageSize,
    },
  };
}

function ticketResponse(ticket: {
  id: number;
  ticketNumber: string;
  createdAt: Date;
  updatedAt: Date;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  currentStatus: string;
  requester: { id: number; name: string; email: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
}) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketDate: ticket.createdAt.toISOString(),
    requester: ticket.requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    summary: ticket.summary,
    requestedPriority: ticket.requestedPriority,
    description: ticket.description,
    currentStatus: ticket.currentStatus,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

function ticketSummaryResponse(ticket: {
  id: number;
  ticketNumber: string;
  summary: string;
  requestedPriority: RequestedPriority;
  currentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
}) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    summary: ticket.summary,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    requestedPriority: ticket.requestedPriority,
    currentStatus: ticket.currentStatus,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

function ticketDetailResponse(ticket: {
  id: number;
  ticketNumber: string;
  createdAt: Date;
  updatedAt: Date;
  summary: string;
  description: string;
  requestedPriority: RequestedPriority;
  currentStatus: string;
  requester: { id: number; name: string; email: string };
  category: { id: number; name: string };
  relatedSystem: { id: number; name: string };
  attachments: Array<{
    id: number;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: Date;
    removedAt: Date | null;
    removedReason: string | null;
  }>;
}) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    ticketDate: ticket.createdAt.toISOString(),
    requester: ticket.requester,
    category: ticket.category,
    relatedSystem: ticket.relatedSystem,
    summary: ticket.summary,
    requestedPriority: ticket.requestedPriority,
    description: ticket.description,
    currentStatus: ticket.currentStatus,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    attachments: ticket.attachments.map((attachment) => ({
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      state: attachment.removedAt ? "REMOVED" : "ACTIVE",
      uploadedAt: attachment.uploadedAt.toISOString(),
      removedAt: attachment.removedAt?.toISOString() ?? null,
      removedReason: attachment.removedReason,
      downloadUrl: attachment.removedAt ? null : `/api/tickets/${ticket.id}/attachments/${attachment.id}/download`,
    })),
  };
}

type AttachmentRecord = {
  id: number;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: Date;
  removedAt: Date | null;
  removedReason: string | null;
};

type AttachmentUploadRequest = Request & {
  attachmentContext?: { requesterId: number; ticketId: number };
};

function attachmentResponse(attachment: AttachmentRecord, ticketId: number) {
  return {
    id: attachment.id,
    originalName: attachment.originalName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    state: attachment.removedAt ? "REMOVED" : "ACTIVE",
    uploadedAt: attachment.uploadedAt.toISOString(),
    removedAt: attachment.removedAt?.toISOString() ?? null,
    removedReason: attachment.removedReason,
    downloadUrl: attachment.removedAt ? null : `/api/tickets/${ticketId}/attachments/${attachment.id}/download`,
  };
}

function parsePositiveId(value: string): number | null {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function sanitizeAttachmentName(originalName: string): string {
  const baseName = path.basename(originalName).replace(/[\u0000-\u001f\u007f]/g, "_").replace(/[<>:"/\\|?*]/g, "_").trim() || "attachment";
  const extension = path.extname(baseName);
  const stem = path.basename(baseName, extension);
  const maxStemCodePoints = Math.max(1, 255 - Array.from(extension).length);
  return `${Array.from(stem).slice(0, maxStemCodePoints).join("")}${extension}`;
}

function hasMatchingSignature(buffer: Buffer, extension: keyof typeof attachmentTypes): boolean {
  if (extension === ".jpg" || extension === ".jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (extension === ".png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === ".webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function attachmentStoragePath(storageKey: string, originalName: string): string {
  const extension = path.extname(originalName).toLowerCase();
  return path.join(attachmentStorageDirectory(), `${storageKey}${extension}`);
}

function isIdempotencyUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : typeof target === "string" ? [target] : [];
  return fields.includes("requesterId") && fields.includes("clientRequestId");
}

export function createApp(prisma: ReferenceDataPrisma = getPrisma()): express.Express {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      service: "TokTickIT API",
    });
  });

  app.get("/api/categories", async (_req: Request, res: Response) => {
    try {
      const categories = await prisma.category.findMany({
        select: {
          id: true,
          name: true,
        },
        where: { isActive: true },
        orderBy: {
          id: "asc",
        },
      });

      res.status(200).json(categories);
    } catch {
      res.status(500).json({ error: "REFERENCE_DATA_UNAVAILABLE" });
    }
  });

  app.get("/api/related-systems", async (_req: Request, res: Response) => {
    try {
      const relatedSystems = await prisma.relatedSystem.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });

      res.status(200).json(relatedSystems);
    } catch {
      res.status(500).json({ error: "REFERENCE_DATA_UNAVAILABLE" });
    }
  });

  app.get("/api/development-requesters", async (_req: Request, res: Response) => {
    try {
      const requesters = await prisma.requesterUser.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      });

      res.status(200).json(requesters);
    } catch {
      res.status(500).json({ error: "REFERENCE_DATA_UNAVAILABLE" });
    }
  });

  app.get("/api/tickets", async (req: Request, res: Response) => {
    const requesterId = parseRequesterId(req);
    if (!requesterId) {
      return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
    }

    const { input, fieldErrors } = parseTicketListQuery(req.query);
    if (!input) return errorResponse(res, 400, "INVALID_QUERY", "Please correct the query parameters.", fieldErrors);

    try {
      const requester = await prisma.requesterUser.findFirst({
        where: { id: requesterId, isActive: true },
        select: { id: true },
      });
      if (!requester) {
        return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
      }

      const where: Prisma.TicketWhereInput = { requesterId };
      if (input.search) {
        where.OR = [
          { ticketNumber: { contains: input.search, mode: "insensitive" } },
          { summary: { contains: input.search, mode: "insensitive" } },
        ];
      }
      if (input.categoryId !== null) where.categoryId = input.categoryId;
      if (input.relatedSystemId !== null) where.relatedSystemId = input.relatedSystemId;
      if (input.requestedPriority !== null) where.requestedPriority = input.requestedPriority;
      if (input.currentStatus !== null) where.currentStatus = input.currentStatus;

      const direction = input.sortDirection;
      const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
        { [input.sortBy]: direction },
        { id: direction },
      ];
      const [tickets, totalItems] = await Promise.all([
        prisma.ticket.findMany({
          where,
          orderBy,
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
          select: {
            id: true,
            ticketNumber: true,
            summary: true,
            requestedPriority: true,
            currentStatus: true,
            createdAt: true,
            updatedAt: true,
            category: { select: { id: true, name: true } },
            relatedSystem: { select: { id: true, name: true } },
          },
        }),
        prisma.ticket.count({ where }),
      ]);

      const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize);
      return res.status(200).json({
        items: tickets.map(ticketSummaryResponse),
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          totalItems,
          totalPages,
          hasPreviousPage: input.page > 1,
          hasNextPage: input.page < totalPages,
        },
        applied: {
          search: input.search,
          categoryId: input.categoryId,
          relatedSystemId: input.relatedSystemId,
          requestedPriority: input.requestedPriority,
          currentStatus: input.currentStatus,
          sortBy: input.sortBy,
          sortDirection: input.sortDirection,
        },
      });
    } catch {
      return errorResponse(res, 500, "TICKET_LIST_FAILED", "Unable to load Tickets.");
    }
  });

  app.get("/api/tickets/:ticketId", async (req: Request, res: Response) => {
    const requesterId = parseRequesterId(req);
    if (!requesterId) {
      return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
    }

    const ticketIdValue = req.params.ticketId;
    if (!/^[1-9]\d*$/.test(ticketIdValue) || !Number.isSafeInteger(Number(ticketIdValue))) {
      return errorResponse(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a positive integer.");
    }
    const ticketId = Number(ticketIdValue);

    try {
      const requester = await prisma.requesterUser.findFirst({
        where: { id: requesterId, isActive: true },
        select: { id: true },
      });
      if (!requester) {
        return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
      }

      const ticket = await prisma.ticket.findFirst({
        where: { id: ticketId, requesterId },
        select: {
          id: true,
          ticketNumber: true,
          createdAt: true,
          updatedAt: true,
          summary: true,
          description: true,
          requestedPriority: true,
          currentStatus: true,
          requester: { select: { id: true, name: true, email: true } },
          category: { select: { id: true, name: true } },
          relatedSystem: { select: { id: true, name: true } },
          attachments: {
            orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              originalName: true,
              mimeType: true,
              sizeBytes: true,
              uploadedAt: true,
              removedAt: true,
              removedReason: true,
            },
          },
        },
      });
      if (!ticket) return errorResponse(res, 404, "RESOURCE_NOT_FOUND", "Ticket not found.");
      return res.status(200).json(ticketDetailResponse(ticket));
    } catch {
      return errorResponse(res, 500, "TICKET_DETAIL_FAILED", "Unable to load Ticket details.");
    }
  });

  app.post(
    "/api/tickets/:ticketId/attachments",
    async (req: AttachmentUploadRequest, res: Response, next: NextFunction) => {
      const requesterId = parseRequesterId(req);
      if (!requesterId) return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
      const ticketId = parsePositiveId(req.params.ticketId);
      if (!ticketId) return errorResponse(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a positive integer.");
      try {
        const requester = await prisma.requesterUser.findFirst({ where: { id: requesterId, isActive: true }, select: { id: true } });
        if (!requester) return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
        const ownedTicket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } });
        if (!ownedTicket) return errorResponse(res, 404, "RESOURCE_NOT_FOUND", "Ticket not found.");
        req.attachmentContext = { requesterId, ticketId };
        return next();
      } catch {
        return errorResponse(res, 500, "ATTACHMENT_UPLOAD_FAILED", "Unable to upload Attachment.");
      }
    },
    (req: Request, res: Response, next: NextFunction) => {
      attachmentUpload.single("file")(req, res, (error: unknown) => {
        if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
          return errorResponse(res, 413, "ATTACHMENT_TOO_LARGE", "Attachment must be 5 MiB or smaller.");
        }
        if (error instanceof multer.MulterError && error.code === "LIMIT_UNEXPECTED_FILE") {
          return errorResponse(res, 400, "ATTACHMENT_REQUIRED", "Upload exactly one file using the file field.");
        }
        if (error) return errorResponse(res, 400, "ATTACHMENT_REQUIRED", "Upload exactly one file using the file field.");
        next();
      });
    },
    async (req: AttachmentUploadRequest, res: Response) => {
      const context = req.attachmentContext;
      if (!context) return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
      const { requesterId, ticketId } = context;

      try {
        if (!req.file) return errorResponse(res, 400, "ATTACHMENT_REQUIRED", "Upload exactly one file using the file field.");

        const extension = path.extname(req.file.originalname).toLowerCase() as keyof typeof attachmentTypes;
        const type = attachmentTypes[extension];
        if (!type || req.file.mimetype !== type.mimeType || !hasMatchingSignature(req.file.buffer, extension)) {
          return errorResponse(res, 415, "ATTACHMENT_TYPE_UNSUPPORTED", "Attachment type or file signature is unsupported.");
        }

        const storageKey = randomUUID();
        const originalName = sanitizeAttachmentName(req.file.originalname);
        const storagePath = attachmentStoragePath(storageKey, originalName);
        try {
          const created = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} FOR UPDATE`);
            const activeCount = await tx.attachment.count({ where: { ticketId, removedAt: null } });
            if (activeCount >= MAX_ACTIVE_ATTACHMENTS) throw new Error("ATTACHMENT_LIMIT_REACHED");
            await mkdir(attachmentStorageDirectory(), { recursive: true });
            await writeFile(storagePath, req.file!.buffer, { flag: "wx" });
            return tx.attachment.create({
              data: {
                ticketId,
                originalName,
                storageKey,
                mimeType: type.mimeType,
                sizeBytes: req.file!.size,
              },
              select: { id: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true, removedReason: true },
            });
          });
          return res.status(201).json(attachmentResponse(created, ticketId));
        } catch (error) {
          await unlink(storagePath).catch(() => undefined);
          if (error instanceof Error && error.message === "ATTACHMENT_LIMIT_REACHED") {
            return errorResponse(res, 409, "ATTACHMENT_LIMIT_REACHED", "A Ticket can have at most five active Attachments.");
          }
          return errorResponse(res, 500, "ATTACHMENT_UPLOAD_FAILED", "Unable to upload Attachment.");
        }
      } catch {
        return errorResponse(res, 500, "ATTACHMENT_UPLOAD_FAILED", "Unable to upload Attachment.");
      }
    },
  );

  app.get("/api/tickets/:ticketId/attachments", async (req: Request, res: Response) => {
    const requesterId = parseRequesterId(req);
    if (!requesterId) return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
    const ticketId = parsePositiveId(req.params.ticketId);
    if (!ticketId) return errorResponse(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a positive integer.");

    try {
      const requester = await prisma.requesterUser.findFirst({ where: { id: requesterId, isActive: true }, select: { id: true } });
      if (!requester) return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
      const ownedTicket = await prisma.ticket.findFirst({ where: { id: ticketId, requesterId }, select: { id: true } });
      if (!ownedTicket) return errorResponse(res, 404, "RESOURCE_NOT_FOUND", "Ticket not found.");
      const attachments = await prisma.attachment.findMany({
        where: { ticketId },
        orderBy: [{ uploadedAt: "asc" }, { id: "asc" }],
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true, removedReason: true },
      });
      return res.status(200).json(attachments.map((attachment) => attachmentResponse(attachment, ticketId)));
    } catch {
      return errorResponse(res, 500, "ATTACHMENT_LIST_FAILED", "Unable to load Attachments.");
    }
  });

  app.get("/api/tickets/:ticketId/attachments/:attachmentId/download", async (req: Request, res: Response) => {
    const requesterId = parseRequesterId(req);
    if (!requesterId) return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
    const ticketId = parsePositiveId(req.params.ticketId);
    const attachmentId = parsePositiveId(req.params.attachmentId);
    if (!ticketId) return errorResponse(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a positive integer.");
    if (!attachmentId) return errorResponse(res, 400, "INVALID_ATTACHMENT_ID", "Attachment ID must be a positive integer.");

    try {
      const requester = await prisma.requesterUser.findFirst({ where: { id: requesterId, isActive: true }, select: { id: true } });
      if (!requester) return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
      const attachment = await prisma.attachment.findFirst({
        where: { id: attachmentId, ticketId, removedAt: null, ticket: { requesterId } },
        select: { id: true, originalName: true, mimeType: true, storageKey: true },
      });
      if (!attachment) return errorResponse(res, 404, "RESOURCE_NOT_FOUND", "Attachment not found.");
      const bytes = await readFile(attachmentStoragePath(attachment.storageKey, attachment.originalName));
      res.setHeader("Content-Type", attachment.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(sanitizeAttachmentName(attachment.originalName))}`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      return res.status(200).send(bytes);
    } catch {
      return errorResponse(res, 500, "ATTACHMENT_DOWNLOAD_FAILED", "Unable to download Attachment.");
    }
  });

  app.delete("/api/tickets/:ticketId/attachments/:attachmentId", async (req: Request, res: Response) => {
    const requesterId = parseRequesterId(req);
    if (!requesterId) return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
    const ticketId = parsePositiveId(req.params.ticketId);
    const attachmentId = parsePositiveId(req.params.attachmentId);
    if (!ticketId) return errorResponse(res, 400, "INVALID_TICKET_ID", "Ticket ID must be a positive integer.");
    if (!attachmentId) return errorResponse(res, 400, "INVALID_ATTACHMENT_ID", "Attachment ID must be a positive integer.");
    const reason = req.body && typeof req.body === "object" && !Array.isArray(req.body) && typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    if (reason.length < 5 || reason.length > 250) {
      return errorResponse(res, 400, "VALIDATION_FAILED", "Please provide a removal reason between 5 and 250 characters.", { reason: ["Reason must contain 5 to 250 characters."] });
    }

    try {
      const requester = await prisma.requesterUser.findFirst({ where: { id: requesterId, isActive: true }, select: { id: true } });
      if (!requester) return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
      const removed = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "Ticket" WHERE "id" = ${ticketId} AND "requesterId" = ${requesterId} FOR UPDATE`);
        const existing = await tx.attachment.findFirst({ where: { id: attachmentId, ticketId, removedAt: null, ticket: { requesterId } }, select: { id: true } });
        if (!existing) throw new Error("RESOURCE_NOT_FOUND");
        return tx.attachment.update({
          where: { id: attachmentId },
          data: { removedAt: new Date(), removedReason: reason, removedByRequesterId: requesterId },
          select: { id: true, originalName: true, mimeType: true, sizeBytes: true, uploadedAt: true, removedAt: true, removedReason: true },
        });
      });
      return res.status(200).json(attachmentResponse(removed, ticketId));
    } catch (error) {
      if (error instanceof Error && error.message === "RESOURCE_NOT_FOUND") return errorResponse(res, 404, "RESOURCE_NOT_FOUND", "Attachment not found.");
      return errorResponse(res, 500, "ATTACHMENT_REMOVE_FAILED", "Unable to remove Attachment.");
    }
  });

  app.post("/api/tickets", async (req: Request, res: Response) => {
    const requesterId = parseRequesterId(req);
    if (!requesterId) {
      return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
    }

    const { input, fieldErrors } = validateTicketBody(req.body);
    if (!input) return errorResponse(res, 400, "VALIDATION_FAILED", "Please correct the highlighted fields.", fieldErrors);

    const normalizedPayload = JSON.stringify({
      categoryId: input.categoryId,
      relatedSystemId: input.relatedSystemId,
      summary: input.summary,
      requestedPriority: input.requestedPriority,
      description: input.description,
    });
    const requestPayloadHash = createHash("sha256").update(normalizedPayload).digest("hex");

    try {
      const ticket = await prisma.$transaction(async (tx) => {
        const requester = await tx.requesterUser.findFirst({
          where: { id: requesterId, isActive: true },
          select: { id: true, name: true, email: true },
        });
        if (!requester) throw new Error("REQUESTER_CONTEXT_INVALID");

        const [category, relatedSystem] = await Promise.all([
          tx.category.findFirst({ where: { id: input.categoryId, isActive: true }, select: { id: true, name: true } }),
          tx.relatedSystem.findFirst({ where: { id: input.relatedSystemId, isActive: true }, select: { id: true, name: true } }),
        ]);
        const referenceErrors: Record<string, string[]> = {};
        if (!category) referenceErrors.categoryId = ["Category does not exist or is inactive."];
        if (!relatedSystem) referenceErrors.relatedSystemId = ["Related System does not exist or is inactive."];
        if (Object.keys(referenceErrors).length > 0) throw new Error(`VALIDATION_FAILED:${JSON.stringify(referenceErrors)}`);

        const existing = await tx.ticket.findUnique({
          where: { requesterId_clientRequestId: { requesterId, clientRequestId: input.clientRequestId } },
          include: { requester: true, category: true, relatedSystem: true },
        });
        if (existing) {
          if (existing.requestPayloadHash !== requestPayloadHash) throw new Error("IDEMPOTENCY_CONFLICT");
          return { ticket: existing, replayed: true };
        }

        const [{ nextval }] = await tx.$queryRaw<Array<{ nextval: bigint }>>(
          Prisma.sql`SELECT nextval('"TicketNumberSequence"')`,
        );
        const createdAt = new Date();
        const ticketNumber = `TKT-${createdAt.getUTCFullYear()}-${nextval.toString().padStart(6, "0")}`;
        const created = await tx.ticket.create({
          data: {
            ticketNumber,
            requesterId,
            categoryId: input.categoryId,
            relatedSystemId: input.relatedSystemId,
            summary: input.summary,
            description: input.description,
            requestedPriority: input.requestedPriority,
            clientRequestId: input.clientRequestId,
            requestPayloadHash,
            createdAt,
          },
          include: { requester: true, category: true, relatedSystem: true },
        });
        return { ticket: created, replayed: false };
      });

      return res.status(ticket.replayed ? 200 : 201).json({
        ticket: ticketResponse(ticket.ticket),
        replayed: ticket.replayed,
      });
    } catch (error) {
      if (error instanceof Error && error.message === "REQUESTER_CONTEXT_INVALID") {
        return errorResponse(res, 400, "REQUESTER_CONTEXT_INVALID", "A valid Development Requester is required.");
      }
      if (error instanceof Error && error.message === "IDEMPOTENCY_CONFLICT") {
        return errorResponse(res, 409, "IDEMPOTENCY_CONFLICT", "This request ID was already used for different ticket data.");
      }
      if (error instanceof Error && error.message.startsWith("VALIDATION_FAILED:")) {
        const parsed = JSON.parse(error.message.slice("VALIDATION_FAILED:".length)) as Record<string, string[]>;
        return errorResponse(res, 400, "VALIDATION_FAILED", "Please correct the highlighted fields.", parsed);
      }
      if (isIdempotencyUniqueViolation(error)) {
        try {
          const existing = await prisma.ticket.findUnique({
            where: { requesterId_clientRequestId: { requesterId, clientRequestId: input.clientRequestId } },
            include: { requester: true, category: true, relatedSystem: true },
          });
          if (existing) {
            if (existing.requestPayloadHash !== requestPayloadHash) {
              return errorResponse(res, 409, "IDEMPOTENCY_CONFLICT", "This request ID was already used for different ticket data.");
            }
            return res.status(200).json({ ticket: ticketResponse(existing), replayed: true });
          }
        } catch {
          // Fall through to the safe generic error response.
        }
      }
      return errorResponse(res, 500, "TICKET_CREATE_FAILED", "Unable to create the Ticket.");
    }
  });

  return app;
}

export const app = createApp();

export default app;
