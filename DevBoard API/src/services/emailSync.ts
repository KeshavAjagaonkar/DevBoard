import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import db from "../config/db";
import redis from "../config/redis";
import { parseEmail } from "./emailParser";
import { decrypt } from "../utils/crypto";
import { logger } from "../config/logger";
import { Status, LogSource, Prisma } from "@prisma/client";

export interface SyncResult {
  syncedCount: number;
  updatedCount: number;
}

/**
 * Normalizes company and role, checks for matches, and inserts or updates applications.
 * Returns true if the database was modified.
 */
async function processParsedEmail(
  userId: string,
  company: string,
  role: string,
  detectedStatus: Status,
  emailSubject: string,
  emailContent: string
): Promise<boolean> {
  const normalizedCompany = company.trim();
  const normalizedRole = role.trim();

  // 1. Search for existing applications for this company (case-insensitive)
  const existingApps = await db.application.findMany({
    where: {
      userId,
      company: { equals: normalizedCompany, mode: "insensitive" }
    },
    orderBy: { updatedAt: "desc" }
  });

  let existingApp = null;
  if (existingApps.length > 0) {
    // A. Check for exact role match (case-insensitive)
    existingApp = existingApps.find(
      (app) => app.role.toLowerCase() === normalizedRole.toLowerCase()
    );

    // B. Check for any active (non-terminal) application for this company
    if (!existingApp) {
      existingApp = existingApps.find(
        (app) =>
          app.status !== Status.OFFER &&
          app.status !== Status.REJECTED &&
          app.status !== Status.GHOSTED
      );
    }

    // C. If the detected status is NOT a new application (APPLIED) and we have existing terminal ones,
    // update the most recent one instead of creating a duplicate
    if (!existingApp && detectedStatus !== Status.APPLIED) {
      existingApp = existingApps[0];
    }
  }

  if (existingApp) {
    // Status priority mapping to prevent downgrading stages (except to OFFER/REJECTED)
    const statusPriority: Record<string, number> = {
      [Status.APPLIED]: 1,
      [Status.OA]: 2,
      [Status.PHONE_SCREEN]: 3,
      [Status.TECHNICAL]: 4,
      [Status.ONSITE]: 5,
      [Status.OFFER]: 6,
      [Status.REJECTED]: 7,
      [Status.GHOSTED]: 8
    };

    const currentPriority = statusPriority[existingApp.status];
    const newPriority = statusPriority[detectedStatus];

    // Update if the status is different and is either a higher priority, or a definitive terminal state (OFFER/REJECTED)
    if (
      existingApp.status !== detectedStatus &&
      (newPriority > currentPriority ||
        detectedStatus === Status.REJECTED ||
        detectedStatus === Status.OFFER)
    ) {
      await db.$transaction(async (tx: Prisma.TransactionClient) => {
        await tx.application.update({
          where: { id: existingApp.id },
          data: { status: detectedStatus }
        });

        await tx.statusLog.create({
          data: {
            applicationId: existingApp.id,
            fromStatus: existingApp.status,
            toStatus: detectedStatus,
            source: LogSource.EMAIL_SCAN,
            emailSubject,
            emailContent
          }
        });
      });

      logger.info(`Updated application ${existingApp.id} (${normalizedCompany}) to ${detectedStatus} via email sync`);
      return true;
    }
  } else {
    // Create new application automatically if it doesn't exist yet
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const newApp = await tx.application.create({
        data: {
          userId,
          company: normalizedCompany,
          role: normalizedRole,
          status: detectedStatus
        }
      });

      await tx.statusLog.create({
        data: {
          applicationId: newApp.id,
          fromStatus: detectedStatus,
          toStatus: detectedStatus,
          source: LogSource.EMAIL_SCAN,
          emailSubject,
          emailContent
        }
      });
    });

    logger.info(`Created new application for ${normalizedCompany} (${normalizedRole}) at stage ${detectedStatus} via email sync`);
    return true;
  }

  return false;
}

/**
 * Invalidates the Redis analytics cache for a user
 */
async function invalidateUserCache(userId: string): Promise<void> {
  const cacheKey = `analytics:${userId}`;
  try {
    await redis.del(cacheKey);
    logger.info(`Invalidated Redis cache: ${cacheKey}`);
  } catch (err) {
    logger.warn(`Failed to invalidate Redis cache: ${cacheKey}`, { error: err });
  }
}

/**
 * Syncs emails for a single user by connecting to their configured IMAP box
 */
export async function syncUserEmails(userId: string): Promise<SyncResult> {
  // 1. Fetch user IMAP configuration
  const user = await db.user.findUnique({
    where: { id: userId }
  });

  if (
    !user ||
    !user.imapEnabled ||
    !user.imapHost ||
    !user.imapPort ||
    !user.imapUser ||
    !user.imapPassword
  ) {
    logger.warn(`Email sync skipped: User ${userId} has incomplete or disabled IMAP config`);
    return { syncedCount: 0, updatedCount: 0 };
  }

  // Decrypt App Password
  let decryptedPassword = "";
  try {
    decryptedPassword = decrypt(user.imapPassword);
  } catch (err) {
    logger.error(`Crypto error: Failed to decrypt password for user ${userId}`, { error: err });
    return { syncedCount: 0, updatedCount: 0 };
  }

  // Configure IMAP Flow Client
  const client = new ImapFlow({
    host: user.imapHost,
    port: user.imapPort,
    secure: user.imapPort === 993,
    auth: {
      user: user.imapUser,
      pass: decryptedPassword
    },
    logger: false // Disable console verbose log
  });

  // Attach error handler to prevent unhandled EventEmitter error crashes
  client.on("error", (err) => {
    logger.error(`IMAP Client Event Error for user ${userId}: ${err.message}`, { error: err });
  });

  let syncedCount = 0;
  let updatedCount = 0;
  let didModifyDatabase = false;

  try {
    await client.connect();
    
    // Select Inbox
    const lock = await client.getMailboxLock("INBOX");
    try {
      // Calculate scan window dynamically: 14 days for initial sync, lastSyncedAt - 2 days for subsequent syncs
      let sinceDate: Date;
      if (user.lastSyncedAt) {
        sinceDate = new Date(user.lastSyncedAt.getTime() - 2 * 24 * 60 * 60 * 1000);
      } else {
        sinceDate = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      }
      
      // Get messages
      const messages = await client.search({ since: sinceDate });
      if (messages && messages.length > 0) {
        syncedCount = messages.length;

        for (const seq of messages) {
          const message = await client.fetchOne(seq, { source: true });
          if (message && message.source) {
            // Parse MIME body with mailparser
            const parsed = await simpleParser(message.source);
            const subject = parsed.subject || "";
            const bodyText = parsed.text || parsed.html || "";
            const fromAddress = parsed.from && parsed.from.text ? parsed.from.text : "";

            // Run custom regex and keyword matching
            const matchResult = parseEmail(subject, bodyText as string, fromAddress);
            if (matchResult) {
              const { company, role, status } = matchResult;
              const emailSnippet = (bodyText as string).substring(0, 1000);
              const updated = await processParsedEmail(
                userId,
                company,
                role,
                status,
                subject,
                emailSnippet
              );
              if (updated) {
                updatedCount++;
                didModifyDatabase = true;
              }
            }
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    // 4. Update lastSyncedAt and invalidates Redis cache
    await db.user.update({
      where: { id: userId },
      data: { lastSyncedAt: new Date() }
    });

    if (didModifyDatabase) {
      await invalidateUserCache(userId);
    }

  } catch (err: any) {
    logger.error(`IMAP Sync Error for user ${userId}: ${err.message}`, { error: err });
    throw err;
  }

  return { syncedCount, updatedCount };
}

/**
 * Syncs emails for all users who have IMAP enabled
 */
export async function syncAllUsers(): Promise<void> {
  logger.info("Starting background IMAP email sync for all active users...");

  try {
    const activeUsers = await db.user.findMany({
      where: { imapEnabled: true }
    });

    logger.info(`Found ${activeUsers.length} users with active IMAP sync`);

    for (const user of activeUsers) {
      try {
        const res = await syncUserEmails(user.id);
        logger.info(`Successfully synced user ${user.email}: Synced ${res.syncedCount} emails, updated ${res.updatedCount} applications`);
      } catch (err: any) {
        logger.error(`Skipping user ${user.email} due to error during sync: ${err.message}`);
      }
    }
  } catch (err: any) {
    logger.error(`Critical error in syncAllUsers background task: ${err.message}`);
  }
}
