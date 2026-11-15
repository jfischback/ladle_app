import Link from "next/link";
import { resetTarget } from "@/lib/password-reset";
import { ResetForm } from "./ResetForm";

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const target = await resetTarget(token);
  if (!target) {
    return (
      <div className="mx-auto max-w-sm space-y-4 pt-10 text-center">
        <p className="text-5xl" aria-hidden="true">🔑</p>
        <h1 className="text-3xl font-semibold">This link no longer works</h1>
        <p className="text-lg text-muted">Reset links work once, for an hour. Ask for a new one.</p>
        <Link href="/forgot" className="btn-primary">Get a new link</Link>
      </div>
    );
  }
  return <ResetForm token={token} email={target.email} />;
}
