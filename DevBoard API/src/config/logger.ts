import winston from "winston";
import { env } from "./env";

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "warn" : "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === "production"
      ? winston.format.json()
      : winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
          return `${timestamp} [${level.toUpperCase()}] ${message}${extra}`;
        })
  ),
  transports: [new winston.transports.Console()],
});
