import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Starting database cleanup for junk email applications...");

  // 1. Identify applications that only have EMAIL_SCAN logs (never touched or created manually)
  const junkApps = await prisma.application.findMany({
    where: {
      statusLogs: {
        none: {
          source: "MANUAL"
        }
      }
    },
    select: {
      id: true,
      company: true,
      role: true
    }
  });

  console.log(`🔍 Found ${junkApps.length} junk applications to clean up.`);

  if (junkApps.length > 0) {
    const ids = junkApps.map(app => app.id);

    // Delete them (cascading constraints delete status logs automatically)
    const result = await prisma.application.deleteMany({
      where: {
        id: { in: ids }
      }
    });

    console.log(`✅ Successfully deleted ${result.count} junk applications from database.`);
  }

  // 2. Reset lastSyncedAt for all users so they can do a fresh clean sync
  const userResult = await prisma.user.updateMany({
    data: {
      lastSyncedAt: null
    }
  });
  console.log(`🔄 Reset lastSyncedAt timestamp for ${userResult.count} users.`);

  // 3. Clear Redis cache
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    retryStrategy: () => null // Don't block if not running
  });

  try {
    // Ping to see if running
    await redis.ping();
    // Flush all cache keys related to analytics
    const keys = await redis.keys("analytics:*");
    if (keys.length > 0) {
      await redis.del(...keys);
      console.log(`⚡ Cleared ${keys.length} cached analytics keys from Redis.`);
    }
  } catch (err) {
    console.log("ℹ️ Redis was offline or couldn't connect, skipping cache flush.");
  } finally {
    redis.disconnect();
  }

  console.log("✨ Cleanup finished successfully!");
}

main()
  .catch(err => {
    console.error("❌ Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
