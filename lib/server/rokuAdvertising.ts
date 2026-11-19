import "server-only";
import { createHash } from "node:crypto";
import { ROKU_AD_START_GRACE_SECONDS, rokuPlayback, type RokuAudience } from "../rokuCatalog";

const AD_ENDPOINT = "https://www.tatestv.ca/api/roku/ad";
const adEvents = ["impression", "start", "firstQuartile", "midpoint", "thirdQuartile", "complete"];
export const ROKU_VAST_MAX_AGE_SECONDS = 10;
export const ROKU_AD_EVENT_MAX_AGE_SECONDS = 180;

type ScheduledPlayback = NonNullable<ReturnType<typeof rokuPlayback>> & {
  adSlot: { id: string; whole: boolean; eligibleBreak: boolean; category: string; kids: boolean };
};
type Creative = { width: number; height: number; duration: number };

// Probed from the hosted MP4s. The digest keys bind measurements to a specific
// asset URL. The longer commercial reels need their own Roku-ready edits.
const measuredCreatives: Record<string, Creative> = {
  "37a2805deb437d3ca3cb25b44566c9be930d3f1a8fbefa3da4d989dc12e2e034": { width: 1920, height: 1080, duration: 51.641 },
  "c741000e89efe90f189ca9674a273ccfb16708e33f71574564f5d3899ecede30": { width: 1920, height: 1080, duration: 55.937 },
  "c89bfcc8160d11af105b1568d2d0eb6388fa3edcaa6f00e178246049f6fa8dfc": { width: 1920, height: 1080, duration: 51.711 },
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function creativeMetadata(url: string): Creative | null {
  // Metadata must be measured from the exact rendition offered to Roku.
  // An unverified replacement cannot inherit the old creative's measurements.
  try {
    const configured = JSON.parse(process.env.TTV_ROKU_AD_VIDEO_METADATA ?? "{}");
    const mediaKey = sha256(url);
    const creative = (configured?.[mediaKey] ?? measuredCreatives[mediaKey]) as Creative | undefined;
    if (creative && [creative.width, creative.height].every(value =>
      Number.isInteger(value) && value > 0 && value <= 8192) &&
      Number.isFinite(creative.duration) && creative.duration > 0 && creative.duration <= 120) return creative;
  } catch {
    // Invalid configuration produces no fill while keeping the station clock.
  }
  return null;
}

export function resolveRokuAd(playback: ScheduledPlayback, audience: RokuAudience, zone: string | null) {
  if (!playback.adSlot.whole || !playback.adSlot.eligibleBreak ||
    playback.start >= ROKU_AD_START_GRACE_SECONDS || playback.remaining < 4 ||
    playback.streamFormat !== "mp4" || !/\.mp4$/i.test(new URL(playback.url).pathname)) return null;
  const creative = creativeMetadata(playback.url);
  if (!creative || Math.abs(playback.end - creative.duration) >= 1) return null;
  const at = Date.parse(playback.generatedAt);
  const creativeId = sha256(playback.url);
  const key = sha256(JSON.stringify([playback.id, audience, zone, at, playback.adSlot.id, playback.url]));
  const endpoint = new URL(AD_ENDPOINT);
  endpoint.searchParams.set("id", playback.id);
  endpoint.searchParams.set("audience", audience);
  if (zone !== null) endpoint.searchParams.set("tz", zone);
  endpoint.searchParams.set("at", String(at));
  endpoint.searchParams.set("slot", key);
  return { endpoint, creative, creativeId, key };
}

function escapeXml(text: string) {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/[<>&"']/g, char => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;",
  }[char]!));
}

export function isRokuAdEvent(value: string) {
  return adEvents.includes(value);
}

export function rokuVast(playback: ScheduledPlayback, ad: NonNullable<ReturnType<typeof resolveRokuAd>>) {
  const duration = new Date(Math.round(ad.creative.duration * 1000)).toISOString().slice(11, 23);
  const tracker = (event: string) => {
    const url = new URL(ad.endpoint);
    url.searchParams.set("event", event);
    return escapeXml(url.href);
  };
  const events = adEvents.slice(1).map(event => `<Tracking event="${event}">${tracker(event)}</Tracking>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<VAST version="3.0"><Ad id="${ad.key}"><InLine>
<AdSystem version="1.0">Tate&apos;s TV</AdSystem>
<AdTitle>${escapeXml(playback.title)}</AdTitle>
<Impression>${tracker("impression")}</Impression>
<Creatives><Creative id="${ad.creativeId}"><Linear><Duration>${duration}</Duration>
<TrackingEvents>${events}</TrackingEvents>
<MediaFiles><MediaFile delivery="progressive" type="video/mp4" width="${ad.creative.width}" height="${ad.creative.height}" scalable="true" maintainAspectRatio="true">${escapeXml(playback.url)}</MediaFile></MediaFiles>
</Linear></Creative></Creatives></InLine></Ad></VAST>`;
}
