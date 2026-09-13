"use client";
import { useMemo } from "react";
import { useStore } from "./store";
import { useProfiles } from "./deviceProfiles";
import { viewerCatalog } from "./audience";
export function useViewerCatalog() {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const kids = useProfiles(
    (state) =>
      state.profiles.find((profile) => profile.id === state.activeId)?.kids ===
      true,
  );
  return useMemo(
    () => viewerCatalog(channels, media, kids),
    [channels, media, kids],
  );
}
