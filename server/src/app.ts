import express, { Request, Response } from "express";
import cors from "cors";
import { Prisma, type PrismaClient, type RequestedPriority } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { getPrisma } from "./prisma.js";

export type ReferenceDataPrisma = Pick<
  PrismaClient,
  "category" | "relatedSystem" | "requesterUser" | "ticket" | "$transaction" | "$queryRaw"
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
  return Number(value);
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
    if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
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
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
