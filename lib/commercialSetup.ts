import type { Channel, MediaItem } from "./types";

export const isCommercial = (item: MediaItem) => item.type === "commercial" || item.type === "bumper";

function programmeIds(channel: Channel) {
  return new Set([...channel.mediaIds, ...(channel.programmeBlocks ?? []).flatMap(block => block.mediaIds)]);
}

// Plan first so the operator can see exactly what a bulk action will change.
export function planEndBreaks(media: MediaItem[], channels: Channel[], channelId: string, seconds: number) {
  if (!Number.isInteger(seconds) || seconds < 15 || seconds > 300) throw new Error("Choose an end break between 15 and 300 seconds.");
  const channel = channels.find(item => item.id === channelId);
  if (!channel) throw new Error("Choose an existing channel.");
  const ids = programmeIds(channel);
  const shared = new Set(channels.filter(item => item.id !== channelId).flatMap(item => [...programmeIds(item)]));
  const updates: MediaItem[] = [];
  const skipped: { title: string; reason: string }[] = [];
  for (const item of media) {
    if (!ids.has(item.id) || (item.type !== "show" && item.type !== "movie")) continue;
    if (!item.file || !Number.isFinite(item.duration) || item.duration < 1) {
      skipped.push({ title: item.title, reason: "Missing playable file or runtime" });
    } else if (shared.has(item.id)) {
      skipped.push({ title: item.title, reason: "Shared with another channel; edit individually" });
    } else if (item.breakpoints?.length || item.breakDurations?.length || item.slotLengthSeconds || item.fillSlotWithCommercials || item.airStartTime) {
      skipped.push({ title: item.title, reason: "Existing timing or custom break settings" });
    } else {
      updates.push({ ...item, slotLengthSeconds: Math.floor(item.duration) + seconds, fillSlotWithCommercials: true });
    }
  }
  return { updates, skipped };
}

export function applyEndBreaks(media: MediaItem[], channels: Channel[], channelId: string, seconds: number) {
  const plan = planEndBreaks(media, channels, channelId, seconds);
  if (!plan.updates.length) return { media, channels };
  const updates = new Map(plan.updates.map(item => [item.id, item]));
  return {
    media: media.map(item => updates.get(item.id) ?? item),
    channels: channels.map(channel => channel.id !== channelId ? channel : {
      ...channel,
      adPolicy: { ...channel.adPolicy, enabled: true, allowChannelTargetedAds: true,
        placements: [...new Set([...(channel.adPolicy?.placements ?? ["between-programs", "filler"]), "filler" as const])] },
    }),
  };
}
