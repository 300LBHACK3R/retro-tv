import type { Channel, MediaItem } from "./types";
import { couldAdvertiseOnChannel } from "./scheduler";

export const CHANNEL_CATEGORIES = [
  "Entertainment",
  "Kids & Family",
  "Faith",
  "Movies",
  "Animation & Anime",
  "Music",
  "Discovery",
  "Community",
] as const;
export type ChannelCategory = (typeof CHANNEL_CATEGORIES)[number];
export function validChannelCategory(
  value: unknown,
): ChannelCategory | undefined {
  return CHANNEL_CATEGORIES.includes(value as ChannelCategory)
    ? (value as ChannelCategory)
    : undefined;
}
// Genre and age suitability are independent. Existing channel identities retain their categories after renumbering.
export function channelCategory(channel: Channel): ChannelCategory {
  if (validChannelCategory(channel.category)) return channel.category!;
  const number = Number(channel.id);
  if ([3, 5].includes(number)) return "Kids & Family";
  if ([6, 14, 22, 23].includes(number)) return "Faith";
  if ([2, 10, 12].includes(number)) return "Movies";
  if ([4, 7].includes(number)) return "Animation & Anime";
  if ([20, 21].includes(number)) return "Music";
  if ([9, 18].includes(number)) return "Discovery";
  if ([15, 16, 17].includes(number)) return "Community";
  return "Entertainment";
}
export function kidsChannelReview(
  channel: Channel,
  media: readonly MediaItem[],
): string[] {
  const reasons: string[] = [];
  if (channel.adultOnly === true) reasons.push("Adults-only channel");
  if (channel.kidsApproved !== true)
    reasons.push("Channel needs Kids approval");
  const items = new Map(media.map((item) => [item.id, item]));
  const ids = new Set([
    ...channel.mediaIds,
    ...(channel.programmeBlocks ?? []).flatMap((block) => block.mediaIds),
  ]);
  if (!ids.size) reasons.push("No programmes assigned");
  const pending = [...ids].filter(
    (id) => items.get(id)?.kidsApproved !== true,
  ).length;
  if (pending) reasons.push(`${pending} programme(s) need review`);
  const ads = media.filter(
    (item) =>
      couldAdvertiseOnChannel(item, channel) && item.kidsApproved !== true,
  ).length;
  if (ads) reasons.push(`${ads} eligible ad(s) need review`);
  return reasons;
}
type Catalog = { channels: Channel[]; media: MediaItem[] };

/** A review covers every regular/block programme and every potentially eligible ad. */
export function kidsLineupReview(channel: Channel, media: readonly MediaItem[]) {
  const programmeIds = new Set([
    ...channel.mediaIds,
    ...(channel.programmeBlocks ?? []).flatMap((block) => block.mediaIds),
  ]);
  const items = media.filter(
    (item) => programmeIds.has(item.id) || couldAdvertiseOnChannel(item, channel),
  );
  const knownIds = new Set(items.map((item) => item.id));
  const missingIds = [...programmeIds].filter((id) => !knownIds.has(id));
  return {
    items,
    programmeCount: programmeIds.size,
    adCount: items.filter((item) => couldAdvertiseOnChannel(item, channel)).length,
    missingIds,
    // Include content and scheduling, not just IDs: edits invalidate consent.
    signature: JSON.stringify([channel, items]),
    canApprove: channel.adultOnly !== true && programmeIds.size > 0 && missingIds.length === 0 && channel.isEnabled !== false,
  };
}

export function approveReviewedKidsLineup(
  channels: Channel[],
  media: MediaItem[],
  channelId: string,
  reviewedSignature: string,
): Catalog {
  const channel = channels.find((item) => item.id === channelId);
  if (!channel) throw new Error("This channel is no longer available.");
  const review = kidsLineupReview(channel, media);
  if (review.signature !== reviewedSignature)
    throw new Error("The lineup changed. Review it again before adding it to Kids.");
  if (channel.adultOnly === true) throw new Error("Adults-only channels cannot be approved for Kids.");
  if (!review.canApprove)
    throw new Error("Enable the channel and resolve empty or missing programmes before approving it.");
  const ids = new Set(review.items.map((item) => item.id));
  return {
    channels: channels.map((item) => item.id === channelId
      ? { ...item, kidsApproved: true, category: "Kids & Family" }
      : item),
    media: media.map((item) => ids.has(item.id) ? { ...item, kidsApproved: true } : item),
  };
}

const cache = new WeakMap<Channel[], WeakMap<MediaItem[], Catalog>>();
export function viewerCatalog(
  channels: Channel[],
  media: MediaItem[],
  kids: boolean,
): Catalog {
  if (!kids) return { channels, media };
  const cached = cache.get(channels)?.get(media);
  if (cached) return cached;
  const approved = channels.filter(
    (channel) =>
      channel.isEnabled !== false &&
      kidsChannelReview(channel, media).length === 0,
  );
  // Library playback uses this catalog too. A stale media approval must not
  // expose an adults-only station's shows outside the guide. Shared specials
  // remain available when explicitly included in a reviewed Kids lineup.
  const programmeIds = (channel: Channel) => [
    ...channel.mediaIds,
    ...(channel.programmeBlocks ?? []).flatMap(block => block.mediaIds),
  ];
  const adultIds = new Set(channels.filter(channel => channel.adultOnly === true).flatMap(programmeIds));
  const approvedIds = new Set(approved.flatMap(programmeIds));
  // Hold whole channels, rather than removing programmes and changing their shared broadcast clock.
  if (!approved.some((channel) => Number(channel.number ?? channel.id) === 1))
    approved.unshift({
      id:
        channels.find((channel) => Number(channel.number ?? channel.id) === 1)
          ?.id ?? "1",
      number: 1,
      name: "Kids Welcome",
      mediaIds: [],
      kidsApproved: true,
      category: "Kids & Family",
      isEnabled: true,
      scheduleMode: "ordered",
      commercialBreakMode: "none",
      adPolicy: { enabled: false },
      branding: {
        displayName: "Kids Welcome",
        callsign: "KIDS",
        logoText: "KIDS",
        description: "Your approved channels, all in one place.",
        accentColor: "#22c55e",
      },
    });
  const result = {
    channels: approved,
    media: media.filter((item) => item.kidsApproved === true && (!adultIds.has(item.id) || approvedIds.has(item.id))),
  };
  const byMedia = cache.get(channels) ?? new WeakMap<MediaItem[], Catalog>();
  byMedia.set(media, result);
  cache.set(channels, byMedia);
  return result;
}
