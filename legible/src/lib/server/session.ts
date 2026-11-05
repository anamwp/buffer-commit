import "server-only";
import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";
import { env } from "./env";

export interface SessionData {
  userId?: string;
  orgId?: string;
  /** Present only between /auth/buffer/start and the callback. */
  oauth?: { state: string; verifier: string; createdAt: number };
}

function options(): SessionOptions {
  return {
    password: env().SESSION_SECRET,
    cookieName: "legible_session",
    ttl: 60 * 60 * 24 * 30,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || env().REDIRECT_URI.startsWith("https://"),
      sameSite: "lax",
      path: "/",
    },
  };
}

export async function getSession() {
  return getIronSession<SessionData>(await cookies(), options());
}
