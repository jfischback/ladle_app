import Link from "next/link";
import { and, eq, gt, isNull } from "drizzle-orm";
import { GUEST_EMAIL, currentAccount } from "@/auth";
import { getDb } from "@/db";
import { householdInvites, users } from "@/db/schema";
import { JoinButton } from "./JoinButton";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const me = await currentAccount();
  const db = await getDb();
  const [inv] = await db.select().from(householdInvites).where(and(eq(householdInvites.code, code), eq(householdInvites.kind, "join"), isNull(householdInvites.usedAt), gt(householdInvites.expiresAt, new Date())));
  const [from] = inv ? await db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, inv.createdBy)) : [];
  const who = from ? from.name || (from.email === GUEST_EMAIL ? "someone" : from.email) : "someone";
  return (
    <div className="mx-auto max-w-md space-y-4 pt-4 text-center">
      <p className="text-6xl" aria-hidden="true">🏡</p>
      {!inv ? (
        <>
          <h1 className="text-3xl font-semibold">This invite link no longer works</h1>
          <p className="text-lg text-muted">It was already used, or it is more than 7 days old. Ask for a new one.</p>
          <Link href="/" className="btn-primary">Go to Ladle</Link>
        </>
      ) : inv.householdId === me.householdId ? (
        <>
          <h1 className="text-3xl font-semibold">You&apos;re already in!</h1>
          <Link href="/" className="btn-primary">See this week</Link>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-semibold">Join {who}&apos;s household?</h1>
          <p className="text-lg text-muted">You&apos;ll share recipes, the weekly plan, the grocery list, the pantry and the store cart. Anything you set up on your own stays saved; you can leave anytime and go back to it.</p>
          <JoinButton code={code} />
        </>
      )}
    </div>
  );
}
