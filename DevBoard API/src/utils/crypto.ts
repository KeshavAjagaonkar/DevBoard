import crypto from "crypto";
import { env } from "../config/env";

const ALGORITHM = "aes-256-cbc";
// We require a 32-byte key. We take ENCRYPTION_KEY from environment.
const key = Buffer.from(env.ENCRYPTION_KEY.substring(0, 32));
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string): string {
  const textParts = text.split(":");
  if (textParts.length < 2) {
    throw new Error("Invalid encrypted format");
  }
  const iv = Buffer.from(textParts.shift()!, "hex");
  const encryptedHex = textParts.join(":");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
