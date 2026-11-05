import { createHash, randomBytes } from "node:crypto";

export function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomToken(bytes = 32): string {
  return base64url(randomBytes(bytes));
}

export function codeChallenge(verifier: string): string {
  return base64url(createHash("sha256").update(verifier).digest());
}
