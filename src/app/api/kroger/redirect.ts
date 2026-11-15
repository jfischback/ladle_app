import type { NextRequest } from "next/server";

/** The address Kroger sends people back to. It must be registered in the Kroger developer portal. */
export function redirectUri(req: NextRequest): string {
  return process.env.KROGER_REDIRECT_URI || `${req.nextUrl.origin}/api/kroger/callback`;
}
