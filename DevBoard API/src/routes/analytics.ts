import { Router, Request, Response, NextFunction } from "express";
import { Status } from "@prisma/client";
import db from "../config/db";
import redis from "../config/redis";
import { logger } from "../config/logger";

const router = Router();

interface AnalyticsResponse {
  total: number;
  byStatus: Record<Status, number>;
  interviewRate: number;
}

router.get("/", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id;
    const cacheKey = `analytics:${userId}`;

    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.status(200).json(JSON.parse(cached));
        return;
      }
    } catch (err) {
      logger.warn("Redis analytics cache read failed, falling back to DB", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const apps = await db.application.findMany({
      where: { userId },
      select: { status: true },
    });

    const total = apps.length;

    const byStatus = Object.values(Status).reduce((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {} as Record<Status, number>);

    apps.forEach((app) => {
      byStatus[app.status] = (byStatus[app.status] || 0) + 1;
    });

    const interviewStagesCount =
      byStatus.PHONE_SCREEN +
      byStatus.TECHNICAL +
      byStatus.OA +
      byStatus.ONSITE +
      byStatus.OFFER;

    const interviewRate = total > 0 ? parseFloat(((interviewStagesCount / total) * 100).toFixed(2)) : 0;

    const responseData: AnalyticsResponse = {
      total,
      byStatus,
      interviewRate,
    };

    try {
      await redis.setex(cacheKey, 300, JSON.stringify(responseData));
    } catch (err) {
      logger.warn("Redis analytics cache write failed", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    res.status(200).json(responseData);
  } catch (error) {
    next(error);
  }
});

export default router;
