import { applyBillingEvent, stripeClient } from "@/lib/server/billing";
import { privateJson } from "@/lib/server/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY)
    return privateJson({ error: "Webhook unavailable" }, 503);
  const signature = request.headers.get("stripe-signature");
  if (
    !signature ||
    !request.body ||
    Number(request.headers.get("content-length") ?? 0) > 262144
  )
    return privateJson({ error: "Invalid webhook" }, 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 262144) {
        await reader.cancel();
        return privateJson({ error: "Webhook too large" }, 413);
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  let event;
  try {
    event = stripeClient().webhooks.constructEvent(
      Buffer.concat(chunks),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
    const live = /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY);
    if (event.livemode !== live || event.account)
      return privateJson({ error: "Webhook mode mismatch" }, 400);
  } catch {
    return privateJson({ error: "Invalid signature" }, 400);
  }
  try {
    await applyBillingEvent(event);
    return privateJson({ received: true });
  } catch {
    return privateJson({ error: "Processing failed; retry required" }, 500);
  }
}
