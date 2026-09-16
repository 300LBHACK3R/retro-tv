import type { Channel } from "./types";

export function sortChannelLineup(channels: readonly Channel[]): Channel[] {
  const number = (channel: Channel) => {
    const value = Number(channel.number ?? channel.id);
    return Number.isSafeInteger(value) && value > 0 ? value : Number.MAX_SAFE_INTEGER;
  };
  return [...channels].sort((a, b) => number(a) - number(b) || a.id.localeCompare(b.id));
}

/** Move a station, not its identity. All references continue to use channel.id. */
export function moveChannelToPosition(channels: Channel[], id: string, position: number): Channel[] {
  if (!Number.isInteger(position) || position < 1 || position > channels.length) return channels;
  const ordered = sortChannelLineup(channels);
  const from = ordered.findIndex(channel => channel.id === id);
  if (from < 0 || from === position - 1) return channels;
  const [channel] = ordered.splice(from, 1);
  ordered.splice(position - 1, 0, channel!);
  return ordered.map((item, index) => item.number === index + 1 ? item : { ...item, number: index + 1 });
}

export const HALLOWEEN_CHANNELS = [
  {
    id: "seasonal-friday-night-horror",
    name: "Friday Night Horror",
    callsign: "FRIGHT",
    description: "Horror movies, Halloween specials and late-night scares. Adults only.",
    accentColor: "#fb923c",
    category: "Movies",
    adultOnly: true,
  },
  {
    id: "seasonal-halloween-kids",
    name: "Halloween Kids",
    callsign: "BOO!",
    description: "Friendly frights, Halloween cartoons and family specials, reviewed for children.",
    accentColor: "#c4b5fd",
    category: "Kids & Family",
    adultOnly: false,
  },
] as const;

/** Explicit admin action only: never inject empty channels into cloud programming. */
export function addHalloweenChannels(channels: Channel[]): Channel[] {
  const missing = HALLOWEEN_CHANNELS.filter(preset => !channels.some(channel => channel.id === preset.id));
  if (!missing.length) return channels;
  let number = Math.max(channels.length, ...channels.map(channel => {
    const value = Number(channel.number ?? channel.id);
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  }));
  return [...channels, ...missing.map(preset => ({
    id: preset.id,
    number: ++number,
    name: preset.name,
    category: preset.category,
    adultOnly: preset.adultOnly,
    kidsApproved: false,
    isEnabled: false,
    mediaIds: [],
    programmeBlocks: [],
    scheduleMode: "ordered" as const,
    randomSeed: preset.id,
    commercialBreakMode: "none" as const,
    commercialStrategy: "best-fit" as const,
    adPolicy: { enabled: false },
    branding: {
      displayName: preset.name,
      callsign: preset.callsign,
      description: preset.description,
      accentColor: preset.accentColor,
      logoText: preset.callsign,
    },
  }))];
}
