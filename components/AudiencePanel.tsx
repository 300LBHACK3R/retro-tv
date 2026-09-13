"use client";
import { useMemo, useState } from "react";
import {
  CHANNEL_CATEGORIES,
  channelCategory,
  kidsChannelReview,
  type ChannelCategory,
} from "@/lib/audience";
import { couldAdvertiseOnChannel } from "@/lib/scheduler";
import { useStore } from "@/lib/store";
import { sortEnabledChannels } from "@/lib/viewer";
export default function AudiencePanel() {
  const channels = useStore((state) => state.channels);
  const media = useStore((state) => state.media);
  const updateChannel = useStore((state) => state.updateChannelSettings);
  const updateMedia = useStore((state) => state.updateMedia);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [unreviewed, setUnreviewed] = useState(false);
  const [limit, setLimit] = useState(40);
  const selected = channels.find((channel) => channel.id === selectedId);
  const visible = useMemo(() => {
    const ids = new Set(
      selected
        ? [
            ...selected.mediaIds,
            ...(selected.programmeBlocks ?? []).flatMap(
              (block) => block.mediaIds,
            ),
          ]
        : [],
    );
    return media.filter(
      (item) =>
        (!selected ||
          ids.has(item.id) ||
          couldAdvertiseOnChannel(item, selected)) &&
        (!unreviewed || item.kidsApproved !== true) &&
        item.title.toLowerCase().includes(query.trim().toLowerCase()),
    );
  }, [media, selected, unreviewed, query]);
  return (
    <section className="ttv-audience-panel" aria-labelledby="audience-title">
      <header>
        <span className="ttv-section-kicker">Programming with care</span>
        <h2 id="audience-title">Audience & channels</h2>
        <p>
          Review each programme and ad before approving it for Kids. Categories
          organize browsing; they do not grant Kids access.
        </p>
      </header>
      <div className="ttv-audience-notice">
        <strong>How a channel enters Kids mode</strong>
        <p>
          Approve the channel and every programme in its regular lineup and
          recurring blocks, plus all ads that could run on it. Unreviewed
          content keeps the entire channel out of Kids mode, preserving the
          shared live schedule. Channel 1 shows a welcome slate until its lineup
          qualifies.
        </p>
      </div>
      <div className="ttv-audience-channels">
        {sortEnabledChannels(channels).map((channel) => {
          const reasons = kidsChannelReview(channel, media);
          return (
            <article key={channel.id} className="ttv-audience-channel">
              <div>
                <span className="ttv-section-kicker">
                  CH {channel.number ?? channel.id}
                </span>
                <h3>{channel.branding?.displayName || channel.name}</h3>
                <p>{reasons.length ? reasons.join(" · ") : "Ready for Kids"}</p>
              </div>
              <label>
                Category
                <select
                  aria-label={`Category for ${channel.name}`}
                  value={channelCategory(channel)}
                  onChange={(event) =>
                    updateChannel(channel.id, {
                      category: event.target.value as ChannelCategory,
                    })
                  }
                >
                  {CHANNEL_CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <label className="ttv-profile-check">
                <input
                  type="checkbox"
                  checked={channel.kidsApproved === true}
                  onChange={(event) =>
                    updateChannel(channel.id, {
                      kidsApproved: event.target.checked,
                    })
                  }
                />
                <span>Approve channel for Kids</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setSelectedId(channel.id);
                  setQuery("");
                  setLimit(40);
                  const heading = document.getElementById(
                    "audience-media-title",
                  );
                  heading?.scrollIntoView({ block: "start" });
                  heading?.focus({ preventScroll: true });
                }}
              >
                Review this lineup
              </button>
            </article>
          );
        })}
      </div>
      <h2 id="audience-media-title" tabIndex={-1}>
        Review programmes & ads
      </h2>
      <div className="ttv-audience-tools">
        <label>
          Lineup
          <select
            value={selectedId}
            onChange={(event) => {
              setSelectedId(event.target.value);
              setLimit(40);
            }}
          >
            <option value="">All media</option>
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                CH {channel.number ?? channel.id} ·{" "}
                {channel.branding?.displayName || channel.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Find media
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(40);
            }}
            placeholder="Search titles"
          />
        </label>
        <label className="ttv-profile-check">
          <input
            type="checkbox"
            checked={unreviewed}
            onChange={(event) => {
              setUnreviewed(event.target.checked);
              setLimit(40);
            }}
          />
          <span>Needs review only</span>
        </label>
      </div>
      <p role="status">
        {visible.length} item{visible.length === 1 ? "" : "s"}. Only approve
        content you have reviewed, including language, imagery, and subject
        matter.
      </p>
      <div className="ttv-audience-media">
        {visible.slice(0, limit).map((item) => (
          <article key={item.id}>
            <div>
              <strong>{item.title}</strong>
              <small>
                {item.type} · {Math.round(item.duration / 60)} min
              </small>
            </div>
            <a href={item.file} target="_blank" rel="noopener noreferrer">
              Open media
              <span className="sr-only">: {item.title} (new tab)</span>
            </a>
            <label className="ttv-profile-check">
              <input
                type="checkbox"
                aria-label={`Kids approved: ${item.title}`}
                checked={item.kidsApproved === true}
                onChange={(event) =>
                  updateMedia(item.id, { kidsApproved: event.target.checked })
                }
              />
              <span>Kids approved</span>
            </label>
          </article>
        ))}
      </div>
      {visible.length > limit && (
        <button type="button" onClick={() => setLimit(limit + 40)}>
          Show more
        </button>
      )}
      <p className="ttv-profile-note">
        Changing a media file, title, poster, description, or runtime clears its
        Kids approval. Save reviewed programming to the cloud with the existing
        admin controls. Device profiles and the parent PIN do not restrict
        public media URLs.
      </p>
    </section>
  );
}
