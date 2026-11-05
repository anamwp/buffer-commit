import "server-only";
import { z } from "zod";

const schema = z.object({
  BUFFER_CLIENT_ID: z.string().min(1),
  BUFFER_CLIENT_SECRET: z.string().min(1),
  /** Must match a redirect URI registered on the app client, character for character. */
  REDIRECT_URI: z.string().url().transform((s) => s.trim()),
  /** iron-session password: at least 32 characters. */
  SESSION_SECRET: z.string().min(32),
  /** 32 random bytes, base64. Encrypts OAuth tokens at rest. */
  TOKEN_ENC_KEY: z
    .string()
    .refine((s) => Buffer.from(s, "base64").length === 32, "TOKEN_ENC_KEY must be 32 bytes, base64-encoded"),
  /** Postgres URL (Neon). If unset, a local embedded PGlite database is used (dev only). */
  DATABASE_URL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  BUFFER_API_URL: z.string().url().default("https://api.buffer.com"),
  BUFFER_AUTH_URL: z.string().url().default("https://auth.buffer.com"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}. See .env.example.`);
  }
  cached = parsed.data;
  return cached;
}

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
