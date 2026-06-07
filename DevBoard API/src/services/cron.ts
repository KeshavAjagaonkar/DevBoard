import cron from "node-cron";
import { syncAllUsers } from "./emailSync";
import { logger } from "../config/logger";

/**
 * Initializes and schedules background cron jobs
 */
export function initCronJobs(): void {
  logger.info("Initializing background cron schedulers...");

  // Run the email sync scanner every 10 minutes
  cron.schedule("*/10 * * * *", async () => {
    logger.info("Cron Trigger: Scanning all active IMAP mailboxes");
    try {
      await syncAllUsers();
    } catch (err: any) {
      logger.error("Error running cron task syncAllUsers", { error: err.message });
    }
  });

  logger.info("Email synchronization scheduled: Runs every 10 minutes ('*/10 * * * *')");
}
