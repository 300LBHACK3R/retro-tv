import { blocksOverlap, sanitizeProgrammeBlocks } from "./programmeBlocks";
import type { Channel, MediaItem } from "./types";

export interface StationIssue {
  id: string;
  subject: string;
  detail: string;
  level: "fix" | "polish";
}
export function inspectStation(
  media: MediaItem[],
  channels: Channel[],
): StationIssue[] {
  const issues: StationIssue[] = [];
  const ids = new Set(media.map((item) => item.id));
  for (const item of media) {
    if (!Number.isFinite(item.duration) || item.duration <= 0)
      issues.push({
        id: `${item.id}:duration`,
        subject: item.title,
        detail: "Missing or invalid runtime",
        level: "fix",
      });
    if (!item.file || !/^(https:\/\/|\/(?!\/))/.test(item.file))
      issues.push({
        id: `${item.id}:url`,
        subject: item.title,
        detail: "Video needs a secure HTTPS URL",
        level: "fix",
      });
    if (item.type !== "commercial" && item.type !== "bumper") {
      if (!item.poster)
        issues.push({
          id: `${item.id}:art`,
          subject: item.title,
          detail: "Add poster artwork; a title card is shown for now",
          level: "polish",
        });
      if (!item.description?.trim())
        issues.push({
          id: `${item.id}:description`,
          subject: item.title,
          detail: "Add a short programme description",
          level: "polish",
        });
    }
  }
  for (const channel of channels.filter((entry) => entry.isEnabled !== false)) {
    const subject = `CH ${channel.number ?? channel.id} · ${channel.branding?.displayName || channel.name}`;
    if (!channel.mediaIds.some((id) => ids.has(id)))
      issues.push({
        id: `${channel.id}:empty`,
        subject,
        detail: "Enabled channel has no available programming",
        level: "fix",
      });
    if (channel.mediaIds.some((id) => !ids.has(id)))
      issues.push({
        id: `${channel.id}:missing`,
        subject,
        detail: "Playlist contains removed media",
        level: "fix",
      });
    const blocks = sanitizeProgrammeBlocks(channel.programmeBlocks);
    for (const block of blocks) {
      if (
        block.mediaIds.some(
          (id) => !channel.mediaIds.includes(id) || !ids.has(id),
        )
      )
        issues.push({
          id: `${channel.id}:${block.id}:missing`,
          subject: `${subject} / ${block.title}`,
          detail: "Block includes media no longer assigned to this channel",
          level: "fix",
        });
      if (
        blocks.some((other) => other !== block && blocksOverlap(block, other))
      )
        issues.push({
          id: `${channel.id}:${block.id}:overlap`,
          subject: `${subject} / ${block.title}`,
          detail: "Recurring block overlaps another block",
          level: "fix",
        });
    }
  }
  return issues.sort(
    (a, b) => Number(a.level === "polish") - Number(b.level === "polish"),
  );
}
