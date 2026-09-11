"use client";

import { useDeviceLibrary } from "@/lib/deviceLibrary";

export default function SaveButton({
  id,
  title,
  kind,
  compact = false,
}: {
  id: string;
  title: string;
  kind: "channel" | "programme";
  compact?: boolean;
}) {
  const saved = useDeviceLibrary((state) =>
    (kind === "channel" ? state.favouriteChannels : state.watchlist).includes(
      id,
    ),
  );
  const toggle = useDeviceLibrary((state) =>
    kind === "channel" ? state.toggleChannel : state.toggleWatchlist,
  );
  const destination = kind === "channel" ? "favourites" : "watchlist";
  return (
    <button
      type="button"
      className={`ttv-save-button ${compact ? "ttv-save-button--compact" : ""}`}
      aria-pressed={saved}
      aria-label={`${saved ? "Remove" : "Save"} ${title} ${saved ? "from" : "to"} ${destination}`}
      title={`${saved ? "Remove from" : "Save to"} ${destination}`}
      onClick={() => toggle(id)}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d={
            kind === "channel"
              ? "m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2L12 17.3l-5.7 2.9 1.1-6.2L2.9 9.6l6.3-.9Z"
              : "M6 3h12v18l-6-4-6 4Z"
          }
        />
      </svg>
      {!compact && (
        <span>
          {saved ? "Saved" : kind === "channel" ? "Favourite" : "Watchlist"}
        </span>
      )}
    </button>
  );
}
