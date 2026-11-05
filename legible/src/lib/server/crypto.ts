import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

const VERSION = 1;

function key(): Buffer {
  return Buffer.from(env().TOKEN_ENC_KEY, "base64");
}

/** AES-256-GCM. Output: base64(version | iv(12) | tag(16) | ciphertext). */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, ct]).toString("base64");
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  if (buf[0] !== VERSION) throw new Error("Unsupported token encryption version");
  const iv = buf.subarray(1, 13);
  const tag = buf.subarray(13, 29);
  const ct = buf.subarray(29);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
