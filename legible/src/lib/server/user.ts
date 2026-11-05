import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getDb, schema } from "../db";
import { getSession } from "./session";

/** For server components and actions: the signed-in user, or a redirect to /. */
export async function requireUser() {
  const session = await getSession();
  if (!session.userId) redirect("/?signin=1");
  const db = await getDb();
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, session.userId));
  const [conn] = await db
    .select({ needsReauth: schema.connections.needsReauth })
    .from(schema.connections)
    .where(eq(schema.connections.userId, session.userId));
  if (!user || !conn) {
    session.destroy();
    redirect("/?signin=1");
  }
  const orgId = session.orgId && user.organizations.some((o) => o.id === session.orgId) ? session.orgId : user.organizations[0]?.id;
  return { user, session, orgId: orgId ?? null, needsReauth: conn.needsReauth };
}
