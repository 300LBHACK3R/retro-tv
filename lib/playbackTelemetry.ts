"use client";

export interface PlaybackSample {
  id: string;
  channelId: string;
  mediaId: string;
  mode: "live" | "library";
  watchSeconds: number;
  bufferSeconds: number;
  starts: number;
  errors: number;
  startupMs: number;
  reports: number;
}

let disabled = false;
let session: Promise<boolean> | null = null;

function optedOut() {
  return (
    navigator.doNotTrack === "1" ||
    (navigator as Navigator & { globalPrivacyControl?: boolean })
      .globalPrivacyControl === true
  );
}

export async function sendPlaybackSample(
  sample: Omit<PlaybackSample, "id">,
): Promise<boolean> {
  if (disabled || optedOut()) return false;
  // Safari may disallow starting a session as a page is being hidden or left.
  // Drop that optional sample; a visible page can establish the session later.
  if (!session && document.visibilityState !== "visible") return false;
  try {
    session ??= fetch("/api/engagement", {
      mode: "same-origin",
      cache: "no-store",
      credentials: "same-origin",
      keepalive: true,
    })
      .then((response) => response.ok)
      .catch(() => false);
    if (!(await session)) {
      disabled = true;
      return false;
    }
    const response = await fetch("/api/engagement", {
      method: "POST",
      mode: "same-origin",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...sample,
        watchSeconds: Math.min(65, sample.watchSeconds),
        bufferSeconds: Math.min(65, sample.bufferSeconds),
        errors: Math.min(20, sample.errors),
        id: crypto.randomUUID(),
      }),
    });
    if (response.status === 503) disabled = true;
    return response.ok;
  } catch {
    return false;
  }
}
