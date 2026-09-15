"use client";
import { useMemo, useState } from "react";
import {
  CHANNEL_CATEGORIES,
  channelCategory,
  kidsChannelReview,
  kidsLineupReview,
  approveReviewedKidsLineup,
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
  const [confirmedSignature, setConfirmedSignature] = useState("");
  const [notice, setNotice] = useState("");
  const selected = channels.find((channel) => channel.id === selectedId);
  const review = useMemo(() => selected ? kidsLineupReview(selected, media) : null, [selected, media]);
  const fullLineupVisible = !!review && !query.trim() && !unreviewed && limit >= review.items.length;
  const confirmed = !!review && confirmedSignature === review.signature;
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
          Main and other parent profiles can watch the full lineup. Kids profiles
          only see programmes and channels you have approved for children.
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
                  setUnreviewed(false);
                  setConfirmedSignature("");
                  setNotice("");
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
              setConfirmedSignature("");
              setNotice("");
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
      {selected && review && (
        <section className="ttv-audience-notice ttv-audience-approve" aria-label="Add reviewed lineup to Kids">
          <h3>Add {selected.branding?.displayName || selected.name} to Kids</h3>
          <p>
            This approval covers {review.programmeCount} programme{review.programmeCount === 1 ? "" : "s"}
            {" "}and {review.adCount} eligible ad{review.adCount === 1 ? "" : "s"}, including recurring blocks
            and future ad campaigns. Check every item for children’s suitability.
            Animation, faith, or family categories alone do not mean a show is for children.
          </p>
          {review.missingIds.length > 0 && <p role="alert">{review.missingIds.length} assigned programme(s) are missing. Restore or remove them before approval.</p>}
          {!review.programmeCount && <p>Assign children’s programmes to this channel first.</p>}
          {selected.isEnabled === false && <p>Enable this channel before adding it to Kids.</p>}
          {!fullLineupVisible && review.items.length > 0 && (
            <button type="button" onClick={() => {
              setQuery(""); setUnreviewed(false); setLimit(review.items.length);
              document.getElementById("audience-media-title")?.focus();
            }}>Show the complete lineup for review</button>
          )}
          <label className="ttv-profile-check">
            <input type="checkbox" checked={confirmed && fullLineupVisible}
              disabled={!review.canApprove || !fullLineupVisible}
              onChange={(event) => {
                setConfirmedSignature(event.target.checked ? review.signature : "");
                setNotice("");
              }} />
            <span>I have reviewed every programme and ad in this lineup for children.</span>
          </label>
          <button type="button" className="ttv-profile-primary"
            disabled={!confirmed || !fullLineupVisible || !review.canApprove}
            onClick={() => {
              try {
                useStore.setState((state) => approveReviewedKidsLineup(
                  state.channels, state.media, selected.id, confirmedSignature,
                ));
                setConfirmedSignature("");
                setNotice("Added to Kids in this programming draft. Use Save beside the cloud status in the admin toolbar to publish it to viewers.");
              } catch (error) {
                setConfirmedSignature("");
                setNotice(error instanceof Error ? error.message : "Please review the lineup again.");
              }
            }}>Add reviewed lineup to Kids</button>
          <p role="status">{notice}</p>
        </section>
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
