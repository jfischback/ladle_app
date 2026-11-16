import "server-only";
import webpush from "web-push";

// Phone alerts (web push) are on only when the server has its VAPID keys (generate once with
// `npx web-push generate-vapid-keys` and add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to the environment).
const PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";

export const pushEnabled = () => !!PUBLIC && !!PRIVATE;
export const pushPublicKey = () => (pushEnabled() ? PUBLIC : null);

let ready = false;
function setup() {
  if (ready) return;
  const site = process.env.VAPID_SUBJECT ?? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "ladle-app.vercel.app"}`;
  webpush.setVapidDetails(site, PUBLIC, PRIVATE);
  ready = true;
}

export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url: string; tag: string };

/** Send one alert to one phone. "gone" means the phone unsubscribed (or the browser dropped it): forget it. */
export async function sendPush(to: PushTarget, msg: PushMessage): Promise<"sent" | "gone" | "failed"> {
  if (!pushEnabled()) return "failed";
  setup();
  try {
    await webpush.sendNotification({ endpoint: to.endpoint, keys: { p256dh: to.p256dh, auth: to.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 12 });
    return "sent";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "failed";
  }
}
