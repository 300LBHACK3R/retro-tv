"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { buildLibrary, type LibraryGroup } from "@/lib/libraryCatalog";
import { safeArtworkUrl, type UpcomingTitle } from "@/lib/libraryPresentation";
import ProgrammeArtwork from "@/components/viewer/ProgrammeArtwork";
import ArtworkEditor from "@/components/library/ArtworkEditor";
import styles from "./library/library.module.css";

function TitleEditor({ group }: { group: LibraryGroup }) {
  const existing = useStore((state) => state.libraryArtwork[group.key]);
  const setArtwork = useStore((state) => state.setTitleArtwork);
  const updateMedia = useStore((state) => state.updateMedia);
  const [poster, setPoster] = useState(existing?.poster ?? group.poster ?? "");
  const [approved, setApproved] = useState(existing?.kidsApproved ?? false);
  const [message, setMessage] = useState("");
  const [limit, setLimit] = useState(20);
  return (
    <>
      <div className={styles.editorGrid}>
        <div className={styles.poster}>
          <ProgrammeArtwork src={poster} title={group.title} />
        </div>
        <div className={styles.fields}>
          <h3>{group.title}</h3>
          <ArtworkEditor
            value={poster}
            onChange={(url) => {
              setPoster(url);
              setApproved(false);
            }}
          />
          <label>
            <input
              type="checkbox"
              checked={approved}
              onChange={(event) => setApproved(event.target.checked)}
            />
            I reviewed this poster for Kids profiles
          </label>
          <div className={styles.actions}>
            <button
              className={styles.primary}
              disabled={!safeArtworkUrl(poster)}
              onClick={() => {
                setArtwork(group.key, { poster, kidsApproved: approved });
                setMessage(
                  "Artwork saved locally. Wait for Global saved before leaving.",
                );
              }}
            >
              Save title artwork
            </button>
            <button
              className={styles.button}
              disabled={!existing}
              onClick={() => {
                setArtwork(group.key, null);
                setPoster(
                  group.items.find((item) => item.media.poster)?.media.poster ??
                    "",
                );
                setApproved(false);
                setMessage(
                  "Shared poster removed. Episode artwork will be used.",
                );
              }}
            >
              Use episode artwork
            </button>
          </div>
          <p className={styles.status} role="status">
            {message}
          </p>
          <p className={styles.muted}>
            One shared poster covers this title and future episodes. Kids
            artwork approval is separate from video approval.
          </p>
        </div>
      </div>
      <section className={styles.adminSection}>
        <h3>Kids library access</h3>
        <p className={styles.muted}>
          Reviewed programmes from approved Kids channels already appear
          automatically. Approve additional videos below after reviewing their
          content and existing episode artwork. This approval also applies to
          Kids live programming. New uploads still need review.
        </p>
        <div className={styles.reviewList}>
          {group.items.slice(0, limit).map((item) => (
            <label key={item.media.id}>
              <input
                type="checkbox"
                checked={item.media.kidsApproved === true}
                onChange={(event) =>
                  updateMedia(item.media.id, {
                    kidsApproved: event.target.checked,
                  })
                }
              />
              {item.displayTitle}
            </label>
          ))}
        </div>
        {group.items.length > limit && (
          <button
            className={styles.button}
            onClick={() => setLimit(limit + 20)}
          >
            Show more episodes
          </button>
        )}
      </section>
    </>
  );
}
function UpcomingEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: UpcomingTitle;
  onSave: (value: UpcomingTitle) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const channels = useStore((state) => state.channels);
  const [error, setError] = useState("");
  function patch(value: Partial<UpcomingTitle>) {
    setDraft((previous) => ({ ...previous, ...value, kidsApproved: false }));
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.title.trim()) {
          setError("Add a title.");
          return;
        }
        if (draft.published && !safeArtworkUrl(draft.poster)) {
          setError("Add a poster before publishing.");
          return;
        }
        onSave(draft);
      }}
    >
      <div className={styles.editorGrid}>
        <div className={styles.poster}>
          <ProgrammeArtwork
            src={draft.poster}
            title={draft.title || "Your next premiere"}
          />
        </div>
        <div className={styles.fields}>
          <label>
            Upcoming title
            <input
              required
              maxLength={160}
              value={draft.title}
              onChange={(event) => patch({ title: event.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              maxLength={600}
              rows={3}
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </label>
          <label>
            Format
            <select
              value={draft.type}
              onChange={(event) =>
                patch({ type: event.target.value as UpcomingTitle["type"] })
              }
            >
              <option value="show">Show</option>
              <option value="movie">Movie</option>
              <option value="music">Music</option>
            </select>
          </label>
          <label>
            Arrival label
            <input
              maxLength={80}
              placeholder="This Friday · 8 PM MT"
              value={draft.releaseLabel}
              onChange={(event) => patch({ releaseLabel: event.target.value })}
            />
          </label>
          <label>
            Channel
            <select
              value={draft.channelId || ""}
              onChange={(event) =>
                patch({ channelId: event.target.value || undefined })
              }
            >
              <option value="">Station announcement</option>
              {channels.map((channel) => (
                <option key={channel.id} value={channel.id}>
                  CH {channel.number ?? channel.id} ·{" "}
                  {channel.branding?.displayName ?? channel.name}
                </option>
              ))}
            </select>
          </label>
          <ArtworkEditor
            value={draft.poster}
            onChange={(poster) => patch({ poster })}
          />
          <label>
            <input
              type="checkbox"
              checked={draft.kidsApproved}
              onChange={(event) =>
                setDraft({ ...draft, kidsApproved: event.target.checked })
              }
            />
            I reviewed this title, artwork and description for Kids
          </label>
          <label>
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(event) =>
                setDraft({ ...draft, published: event.target.checked })
              }
            />
            Publish in Coming Soon
          </label>
          <p className={styles.muted}>
            Unpublished drafts are private to the admin panel. Arrival labels
            are announcements; schedule the actual broadcast in Programming.
          </p>
          <div className={styles.actions}>
            <button className={styles.primary} type="submit">
              Save announcement
            </button>
            <button className={styles.button} type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>
          {error && <p role="alert">{error}</p>}
        </div>
      </div>
    </form>
  );
}
export default function LibraryPresentationPanel() {
  const media = useStore((state) => state.media);
  const artwork = useStore((state) => state.libraryArtwork);
  const upcoming = useStore((state) => state.upcomingTitles);
  const setUpcoming = useStore((state) => state.setUpcomingTitles);
  const library = useMemo(() => buildLibrary(media, artwork), [media, artwork]);
  const [query, setQuery] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [selected, setSelected] = useState("");
  const [editing, setEditing] = useState<UpcomingTitle | null>(null);
  const [notice, setNotice] = useState("");
  const filtered = library.filter(
    (group) =>
      (!missingOnly || !group.poster) &&
      group.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const group = filtered.find((item) => item.key === selected) ?? filtered[0];
  function move(index: number, delta: number) {
    const next = [...upcoming];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(index + delta, 0, item);
    setUpcoming(next);
  }
  return (
    <section className={styles.admin}>
      <h2>Artwork & Coming Soon</h2>
      <p className={styles.muted}>
        Give every title a face, and give viewers something to look forward to.
      </p>
      <p className={styles.notice}>
        {library.filter((group) => group.poster).length} of {library.length}{" "}
        titles have artwork. Changes sync with your station; wait for{" "}
        <strong>Global saved</strong> before closing admin.
      </p>
      <section className={styles.adminSection}>
        <h3>Title artwork</h3>
        <div className={styles.fields}>
          <label>
            Find a title
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search your shows, movies and music"
            />
          </label>
          <label>
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(event) => setMissingOnly(event.target.checked)}
            />
            Only titles missing artwork
          </label>
          <label>
            Choose title
            <select
              value={group?.key ?? ""}
              onChange={(event) => setSelected(event.target.value)}
            >
              {!filtered.length && <option value="">No matching titles</option>}
              {filtered.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.title} · {item.items.length} video(s)
                </option>
              ))}
            </select>
          </label>
        </div>
        {group && <TitleEditor key={group.key} group={group} />}
      </section>
      <section className={styles.adminSection}>
        <div className={styles.sectionHead}>
          <h3>Coming soon to Tate’s TV</h3>
          <button
            className={styles.button}
            disabled={!!editing || upcoming.length >= 100}
            onClick={() =>
              setEditing({
                id: crypto.randomUUID(),
                title: "",
                description: "",
                poster: "",
                type: "show",
                releaseLabel: "",
                kidsApproved: false,
                published: false,
              })
            }
          >
            Add upcoming title
          </button>
        </div>
        <p className={styles.muted}>
          Published announcements appear in the library and below the live
          channels. Kids see only reviewed announcements; linked channels must
          also be approved.
        </p>
        {!upcoming.length && !editing && (
          <p className={styles.notice}>
            No announcements yet. Add a title when you are ready to share it.
          </p>
        )}
        {upcoming.map((title, index) => (
          <div key={title.id} className={styles.upcomingAdmin}>
            <strong>
              {title.title}{" "}
              <small>· {title.published ? "Published" : "Draft"}</small>
            </strong>
            <button
              className={styles.button}
              disabled={!!editing}
              onClick={() => setEditing(title)}
            >
              Edit {title.title}
            </button>
            <button
              className={styles.button}
              disabled={!!editing || index === 0}
              aria-label={`Move ${title.title} up`}
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              className={styles.button}
              disabled={!!editing || index === upcoming.length - 1}
              aria-label={`Move ${title.title} down`}
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
            <button
              className={styles.button}
              disabled={!!editing}
              onClick={() => {
                if (window.confirm(`Remove “${title.title}” from Coming Soon?`))
                  setUpcoming(upcoming.filter((item) => item.id !== title.id));
              }}
            >
              Remove
            </button>
          </div>
        ))}
        {editing && (
          <UpcomingEditor
            key={editing.id}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSave={(value) => {
              const current = useStore.getState().upcomingTitles;
              setUpcoming(
                current.some((item) => item.id === value.id)
                  ? current.map((item) => (item.id === value.id ? value : item))
                  : [...current, value],
              );
              setEditing(null);
              setNotice(
                "Announcement saved locally. Wait for Global saved before leaving.",
              );
            }}
          />
        )}
        <p className={styles.status} role="status">
          {notice}
        </p>
      </section>
    </section>
  );
}
