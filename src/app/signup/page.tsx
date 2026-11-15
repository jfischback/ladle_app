import { googleEnabled } from "@/auth";
import { AuthForm } from "@/components/AuthForm";
import { inviteOnly, ownerStillToCome, validInvite } from "@/lib/signup-policy";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string; callbackUrl?: string; invite?: string }> }) {
  const q = await searchParams;
  // Where to go after signing in: only our own invite links (never another site).
  let next = q.next ?? "";
  if (!next && q.callbackUrl) { try { next = new URL(q.callbackUrl, "http://x").pathname; } catch {} }
  const joinNext = /^\/join\/[A-Za-z0-9_-]+$/.test(next) ? next : undefined;
  // A "new family" invite link: /signup?invite=CODE
  const invite = q.invite && (await validInvite(q.invite, "family")) ? q.invite : undefined;
  const closed = inviteOnly() && !invite && !joinNext && !(await ownerStillToCome());
  return <AuthForm mode="signup" googleEnabled={googleEnabled} next={joinNext} invite={invite} inviteOnlyNote={closed} />;
}
