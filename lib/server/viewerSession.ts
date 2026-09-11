import "server-only";

import { cookies } from "next/headers";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const COOKIE = "ttv_viewer";
const MAX_AGE = 30 * 86400;
function secret() {
  return process.env.ADMIN_SESSION_SECRET?.trim();
}
function sign(value: string, key: string) {
  return createHmac("sha256", key)
    .update(`ttv-playback-v1:${value}`)
    .digest("hex");
}

export async function getViewerSession(create = false) {
  const key = secret();
  if (!key || key.length < 16) return null;
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value ?? "";
  const [id, issued, signature] = token.split(".");
  const created = Number(issued);
  const now = Math.floor(Date.now() / 1000);
  if (
    id &&
    /^[0-9a-f-]{36}$/.test(id) &&
    Number.isInteger(created) &&
    created <= now &&
    created > now - MAX_AGE &&
    signature &&
    /^[0-9a-f]{64}$/.test(signature)
  ) {
    const expected = sign(`${id}.${issued}`, key);
    if (timingSafeEqual(Buffer.from(signature), Buffer.from(expected)))
      return {
        id,
        created,
        returning: Math.floor(created / 86400) < Math.floor(now / 86400),
      };
  }
  if (!create) return null;
  const nextId = randomUUID();
  const payload = `${nextId}.${now}`;
  jar.set(COOKIE, `${payload}.${sign(payload, key)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
  return { id: nextId, created: now, returning: false };
}
