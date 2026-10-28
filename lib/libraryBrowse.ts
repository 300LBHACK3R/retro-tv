import { channelCategory } from "./audience";
import type { Channel } from "./types";
import type { LibraryGroup, ProgressMap } from "./libraryCatalog";

export type WatchStatus = "not-started" | "in-progress" | "finished";
export function watchStatus(group: LibraryGroup, progress: ProgressMap): WatchStatus {
  const entries = group.items.map(item => progress[item.media.id]);
  if (entries.every(entry => entry && entry.position >= entry.duration - 10)) return "finished";
  return entries.some(entry => entry && entry.position >= 10) ? "in-progress" : "not-started";
}
export function titleLetter(title: string) {
  const first = title.replace(/^(the|an|a)\s+/i, "").trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : "#";
}
export function groupRuntime(group: LibraryGroup) {
  // A series is filtered by its shortest available episode, not its entire box set.
  return Math.min(...group.items.map(item => item.media.duration));
}
export function libraryCollections(groups: LibraryGroup[], channels: Channel[]) {
  const byMedia = new Map<string, Channel[]>();
  for (const channel of channels) {
    if (channel.isEnabled === false) continue;
    const ids = new Set([...channel.mediaIds, ...(channel.programmeBlocks ?? []).flatMap(block => block.mediaIds)]);
    for (const id of ids) byMedia.set(id, [...(byMedia.get(id) ?? []), channel]);
  }
  return new Map(groups.map(group => {
    const linked = [...new Map(group.items.flatMap(item => byMedia.get(item.media.id) ?? []).map(channel => [channel.id, channel])).values()];
    return [group.key, { channels: linked, categories: [...new Set(linked.map(channelCategory))] }];
  }));
}
export function sortLibrary(groups: LibraryGroup[], order: string) {
  const title = (a: LibraryGroup, b: LibraryGroup) => a.title.localeCompare(b.title, "en", { numeric: true, sensitivity: "base" });
  const recent = (g: LibraryGroup) => Math.max(...g.items.map(item => Date.parse(item.media.createdAt ?? "") || 0));
  return [...groups].sort((a, b) => {
    if (order === "za") return title(b, a);
    if (order === "recent") return recent(b) - recent(a) || title(a, b);
    if (order === "shortest") return groupRuntime(a) - groupRuntime(b) || title(a, b);
    if (order === "longest") return groupRuntime(b) - groupRuntime(a) || title(a, b);
    if (order === "episodes") return b.items.length - a.items.length || title(a, b);
    return title(a, b);
  });
}
