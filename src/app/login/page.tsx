import { googleEnabled } from "@/auth";
import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; callbackUrl?: string }> }) {
  const q = await searchParams;
  // Where to go after signing in: only our own invite links (never another site).
  let next = q.next ?? "";
  if (!next && q.callbackUrl) { try { next = new URL(q.callbackUrl, "http://x").pathname; } catch {} }
  return <AuthForm mode="login" googleEnabled={googleEnabled} next={/^\/join\/[A-Za-z0-9_-]+$/.test(next) ? next : undefined} />;
}
