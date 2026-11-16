import { googleEnabled } from "@/auth";
import { AuthForm } from "@/components/AuthForm";
import { inviteOnly, ownerStillToCome, sharedHouseholdUnclaimed, validClaimCode, validInvite } from "@/lib/signup-policy";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; callbackUrl?: string; invite?: string; claim?: string }> }) {
  const q = await searchParams;
  // Where to go after signing in: only our own invite links (never another site).
  let next = q.next ?? "";
  if (!next && q.callbackUrl) { try { next = new URL(q.callbackUrl, "http://x").pathname; } catch {} }
  const joinNext = /^\/join\/[A-Za-z0-9_-]+$/.test(next) ? next : undefined;
  // A "new family" invite link: /signup?invite=CODE
  const invite = q.invite && (await validInvite(q.invite, "family")) ? q.invite : undefined;
  // The owner's claim link: /signup?claim=CODE takes over the household set up before sign-in was turned on.
  const claim = validClaimCode(q.claim) && (await sharedHouseholdUnclaimed()) ? q.claim : undefined;
  const closed = inviteOnly() && !invite && !joinNext && !(await ownerStillToCome(claim));
  return <AuthForm mode="signup" googleEnabled={googleEnabled && !claim} next={joinNext} invite={invite} claim={claim} inviteOnlyNote={closed} />;
}
