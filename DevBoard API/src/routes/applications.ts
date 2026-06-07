import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { Status } from "@prisma/client";
import db from "../config/db";
import redis from "../config/redis";
import { logger } from "../config/logger";

const router = Router();

const createSchema = z.object({
  company: z.string().trim().min(1, "Company name is required"),
  role: z.string().trim().min(1, "Role is required"),
  jdUrl: z.string().url("Invalid URL format").optional().or(z.literal("")),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  status: z.nativeEnum(Status).optional(),
  notes: z.string().optional(),
});

async function invalidateCache(userId: string): Promise<void> {
  try {
    await redis.del(`analytics:${userId}`);
  } catch (err) {
    logger.warn("Redis cache invalidation failed", { userId, error: err instanceof Error ? err.message : String(err) });
  }
}

router.post("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.errors[0].message });
      return;
    }

    const { company, role, jdUrl, notes } = parsed.data;
    const userId = req.user!.id;

    const application = await db.$transaction(async (tx) => {
      const app = await tx.application.create({
        data: {
          userId,
          company,
          role,
          jdUrl: jdUrl || null,
          notes: notes || null,
          status: Status.APPLIED,
        },
      });

      await tx.statusLog.create({
        data: {
          applicationId: app.id,
          fromStatus: Status.APPLIED,
          toStatus: Status.APPLIED,
          source: "MANUAL",
        },
      });

      return app;
    });

    await invalidateCache(userId);

    res.status(201).json(application);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const applications = await db.application.findMany({
      where: { userId },
      include: { statusLogs: { orderBy: { changedAt: "desc" } } },
      orderBy: { appliedAt: "desc" },
    });
    res.status(200).json(applications);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const application = await db.application.findFirst({
      where: { id, userId },
      include: { statusLogs: { orderBy: { changedAt: "asc" } } },
    });

    if (!application) {
      res.status(404).json({ error: "not_found", message: "Application not found" });
      return;
    }

    res.status(200).json(application);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.errors[0].message });
      return;
    }

    const userId = req.user!.id;
    const { id } = req.params;
    const { status, notes } = parsed.data;

    const currentApp = await db.application.findFirst({
      where: { id, userId },
    });

    if (!currentApp) {
      res.status(404).json({ error: "not_found", message: "Application not found" });
      return;
    }

    const updatedApp = await db.$transaction(async (tx) => {
      const dataToUpdate: { status?: Status; notes?: string } = {};
      if (status !== undefined) dataToUpdate.status = status;
      if (notes !== undefined) dataToUpdate.notes = notes;

      const app = await tx.application.update({
        where: { id },
        data: dataToUpdate,
      });

      if (status !== undefined && status !== currentApp.status) {
        await tx.statusLog.create({
          data: {
            applicationId: id,
            fromStatus: currentApp.status,
            toStatus: status,
            source: "MANUAL",
          },
        });
      }

      return app;
    });

    await invalidateCache(userId);

    res.status(200).json(updatedApp);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const application = await db.application.findFirst({
      where: { id, userId },
    });

    if (!application) {
      res.status(404).json({ error: "not_found", message: "Application not found" });
      return;
    }

    await db.application.delete({
      where: { id },
    });

    await invalidateCache(userId);

    res.status(200).json({ success: true, message: "Application deleted successfully" });
  } catch (error) {
    next(error);
  }
});

export default router;
