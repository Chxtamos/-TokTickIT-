import express, { Request, Response } from "express";
import cors from "cors";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "./prisma.js";

export type ReferenceDataPrisma = Pick<PrismaClient, "category" | "relatedSystem" | "requesterUser">;

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

  return app;
}

export const app = createApp();

export default app;
