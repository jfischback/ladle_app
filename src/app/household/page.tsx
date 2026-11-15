import Link from "next/link";
import { and, eq, gt, isNull, ne, or } from "drizzle-orm";
import { GUEST_EMAIL, currentAccount, loginRequired } from "@/auth";
import { getDb } from "@/db";
import { householdInvites, users } from "@/db/schema";
import { HouseholdClient } from "./HouseholdClient";

export default async function HouseholdPage() {
  const me = await currentAccount();
  const db = await getDb();
  const members = loginRequired
    ? await db
        .select({ id: users.id, name: users.name, email: users.email, owner: users.ownsHousehold, householdId: users.householdId })
        .from(users)
        .where(and(or(eq(users.householdId, me.householdId), eq(users.id, me.householdId)), ne(users.email, GUEST_EMAIL)))
    : [];
  const invites = loginRequired
    ? await db.select({ code: householdInvites.code, expiresAt: householdInvites.expiresAt }).from(householdInvites)
        .where(and(eq(householdInvites.householdId, me.householdId), isNull(householdInvites.usedAt), gt(householdInvites.expiresAt, new Date())))
    : [];
  return (
    <div className="space-y-5">
      <div>
        <Link href="/setup" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← Settings</Link>
        <p className="eyebrow mt-3">Plan together</p>
        <h1 className="text-4xl font-semibold">Share my household</h1>
        <p className="mt-1 text-lg text-muted">Invite your partner (or a grandma who helps out). You&apos;ll share the same recipes, weekly plan, grocery list, pantry and store cart, and each of you signs in with your own account.</p>
      </div>
      {!loginRequired ? (
        <p className="card p-5 text-lg">Sharing needs sign-in turned on, so each person has their own account. Until then, everyone using this site already shares one household.</p>
      ) : (
        <HouseholdClient
          me={me.accountId}
          members={members.map((m) => ({ id: m.id, label: m.name || m.email, email: m.email, owner: m.owner || !m.householdId }))}
          invites={invites.map((i) => ({ code: i.code, expires: i.expiresAt.toISOString() }))}
          canLeave={!me.isOwner}
        />
      )}
    </div>
  );
}
