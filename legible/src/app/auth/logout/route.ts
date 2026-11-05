import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  const session = await getSession();
  session.destroy();
  return NextResponse.redirect(new URL("/", req.nextUrl.origin), { status: 303 });
}
