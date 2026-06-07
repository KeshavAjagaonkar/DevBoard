import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import db from "../config/db";
import { auth } from "../middleware/auth";
import { encrypt, decrypt } from "../utils/crypto";
import { syncUserEmails } from "../services/emailSync";
import { ImapFlow } from "imapflow";
import { logger } from "../config/logger";

const router = Router();

const profileUpdateSchema = z.object({
  imapEnabled: z.boolean().optional(),
  imapHost: z.string().min(1, "Host cannot be empty").nullable().optional(),
  imapPort: z.number().int().positive().nullable().optional(),
  imapUser: z.string().min(1, "Email/Username cannot be empty").nullable().optional(),
  imapPassword: z.string().nullable().optional()
});

/**
 * GET /profile
 * Returns the current authenticated user's profile metadata and IMAP configurations
 */
router.get("/", auth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user!.id;

    const user = await db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    res.status(200).json({
      id: user.id,
      email: user.email,
      imapEnabled: user.imapEnabled,
      imapHost: user.imapHost,
      imapPort: user.imapPort,
      imapUser: user.imapUser,
      hasImapPassword: !!user.imapPassword,
      lastSyncedAt: user.lastSyncedAt
    });
  } catch (err: any) {
    next(err);
  }
});

/**
 * PATCH /profile
 * Updates the user's profile/IMAP settings.
 */
router.patch("/", auth, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).user!.id;

    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "bad_request", message: "Validation failed", details: parsed.error.format() });
      return;
    }

    const { imapEnabled, imapHost, imapPort, imapUser, imapPassword } = parsed.data;

    // Build update payload
    const updateData: any = {};

    if (imapEnabled !== undefined) updateData.imapEnabled = imapEnabled;
    if (imapHost !== undefined) updateData.imapHost = imapHost;
    if (imapPort !== undefined) updateData.imapPort = imapPort;
    if (imapUser !== undefined) updateData.imapUser = imapUser;

    // Encrypt password if provided
    if (imapPassword !== undefined) {
      if (imapPassword === null || imapPassword === "") {
        updateData.imapPassword = null;
      } else {
        updateData.imapPassword = encrypt(imapPassword);
      }
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData
    });

    res.status(200).json({
      id: updatedUser.id,
      email: updatedUser.email,
      imapEnabled: updatedUser.imapEnabled,
      imapHost: updatedUser.imapHost,
      imapPort: updatedUser.imapPort,
      imapUser: updatedUser.imapUser,
      hasImapPassword: !!updatedUser.imapPassword,
      lastSyncedAt: updatedUser.lastSyncedAt
    });
  } catch (err: any) {
    next(err);
  }
});

/**
 * POST /profile/test-imap
 * Verifies the credentials and hosts by attempting a login with IMAP
 */
router.post("/test-imap", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.id;
    let { imapHost, imapPort, imapUser, imapPassword } = req.body;

    // Get user state for empty fields
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    // Use input parameters or fallback to database parameters
    const host = imapHost !== undefined ? imapHost : user.imapHost;
    const port = imapPort !== undefined ? imapPort : user.imapPort;
    const email = imapUser !== undefined ? imapUser : user.imapUser;
    
    let pass = "";
    if (imapPassword !== undefined) {
      pass = imapPassword;
    } else if (user.imapPassword) {
      pass = decrypt(user.imapPassword);
    }

    if (!host || !port || !email || !pass) {
      res.status(400).json({ error: "bad_request", message: "Incomplete IMAP settings provided for testing" });
      return;
    }

    // Configure connection check
    const client = new ImapFlow({
      host,
      port,
      secure: port === 993,
      auth: {
        user: email,
        pass
      },
      logger: false
    });

    client.on("error", (err) => {
      logger.error(`IMAP Test Client Event Error for user ${userId}: ${err.message}`, { error: err });
    });

    try {
      await client.connect();
      await client.logout();
      res.status(200).json({ ok: true, message: "IMAP connection test successful!" });
    } catch (err: any) {
      res.status(400).json({ ok: false, error: "imap_connection_failed", message: err.message });
    }
  } catch (err: any) {
    logger.error("IMAP diagnostic test errored", { error: err.message });
    res.status(500).json({ error: "internal_error", message: err.message });
  }
});

/**
 * POST /profile/sync
 * Triggers manual email synchronization for the logged-in user
 */
router.post("/sync", auth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.id;

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ error: "not_found", message: "User not found" });
      return;
    }

    if (!user.imapEnabled || !user.imapHost || !user.imapUser || !user.imapPassword) {
      res.status(400).json({ error: "bad_request", message: "IMAP sync is disabled or configuration is incomplete" });
      return;
    }

    const syncStats = await syncUserEmails(userId);
    res.status(200).json({
      ok: true,
      message: "Sync completed successfully",
      stats: syncStats
    });
  } catch (err: any) {
    logger.error(`Manual synchronization trigger failed for user ${(req as any).user!.id}`, { error: err.message });
    res.status(400).json({ error: "sync_failed", message: err.message });
  }
});

export default router;
