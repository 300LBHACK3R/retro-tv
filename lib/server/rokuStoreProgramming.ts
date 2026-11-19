import "server-only";
import { viewerCatalog } from "../audience";
import { programmeIds, rokuStream, type RokuAudience } from "../rokuCatalog";
import type { ProgrammingSnapshot } from "../programmingSnapshot";
import { rokuChannelAllowlist, rokuProgramming } from "./rokuProgramming";

const MAX_STORE_VIDEO_SECONDS = 15 * 60 - 1;
type RokuEdition = "standard" | "store";

export function rokuEdition(params: URLSearchParams): RokuEdition | null {
  const editions = params.getAll("edition");
  if (!editions.length) return "standard";
  return editions.length === 1 && editions[0] === "store" ? "store" : null;
}

function idsFromEnv(value: string | undefined): Set<string> {
  return new Set(value?.split(",").map(id => id.trim()).filter(Boolean));
}

function restrictStoreSnapshot(snapshot: ProgrammingSnapshot, audience: RokuAudience): ProgrammingSnapshot {
  const channelIds = idsFromEnv(process.env.TTV_ROKU_STORE_CHANNEL_IDS);
  const mediaIds = idsFromEnv(process.env.TTV_ROKU_STORE_MEDIA_IDS);
  if (!channelIds.size || !mediaIds.size) return { ...snapshot, channels: [], media: [] };

  // Use the original Kids policy before filtering the release inventory.
  const visible = viewerCatalog(snapshot.channels, snapshot.media, audience === "kids");
  const allowedMedia = visible.media.filter(item =>
    mediaIds.has(item.id) && (item.type === "show" || item.type === "movie") &&
    Number.isFinite(item.duration) && item.duration > 0 && item.duration <= MAX_STORE_VIDEO_SECONDS &&
    rokuStream(item) !== null,
  );
  const allowedMediaIds = new Set(allowedMedia.map(item => item.id));
  const channels = visible.channels
    .filter(channel => channelIds.has(channel.id) && channel.isEnabled !== false)
    .map(channel => ({
      ...channel,
      mediaIds: channel.mediaIds.filter(id => allowedMediaIds.has(id)),
      programmeBlocks: channel.programmeBlocks?.map(block => ({
        ...block,
        mediaIds: block.mediaIds.filter(id => allowedMediaIds.has(id)),
      })).filter(block => block.mediaIds.length > 0),
      commercialBreakMode: "none" as const,
      defaultSlotLengthSeconds: undefined,
      adPolicy: { enabled: false },
    }))
    .filter(channel => programmeIds(channel).length > 0);
  const scheduledIds = new Set(channels.flatMap(programmeIds));
  const media = allowedMedia.filter(item => scheduledIds.has(item.id)).map(item => ({
    ...item,
    breakpoints: undefined,
    breakDurations: undefined,
    slotLengthSeconds: undefined,
    fillSlotWithCommercials: false,
  }));

  return { ...snapshot, channels, media };
}

export async function rokuEditionProgramming(edition: RokuEdition, audience: RokuAudience) {
  const snapshot = await rokuProgramming();
  if (edition === "store") return { snapshot: restrictStoreSnapshot(snapshot, audience), channelIds: undefined };
  return { snapshot, channelIds: rokuChannelAllowlist() };
}
