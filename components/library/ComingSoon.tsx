"use client";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { useProfiles } from "@/lib/deviceProfiles";
import { useViewerCatalog } from "@/lib/useViewerCatalog";
import { visibleUpcomingTitles } from "@/lib/libraryPresentation";
import ProgrammeArtwork from "@/components/viewer/ProgrammeArtwork";
import styles from "./library.module.css";

export default function ComingSoon({ compact = false }: { compact?: boolean }) {
  const titles = useStore((state) => state.upcomingTitles);
  const kids = useProfiles(
    (state) =>
      state.profiles.find((profile) => profile.id === state.activeId)?.kids ===
      true,
  );
  const { channels } = useViewerCatalog();
  const visible = visibleUpcomingTitles(titles, channels, kids);
  if (!visible.length) return null;
  return (
    <section className={styles.upcoming} aria-label="Coming soon to Tate’s TV">
      <div className={styles.sectionHead}>
        <div>
          <span className={styles.eyebrow}>Worth coming back for</span>
          <h2>Coming soon to Tate’s TV</h2>
        </div>
        {compact && (
          <Link className={styles.button} href="/library">
            Explore library
          </Link>
        )}
      </div>
      <div className={styles.rail} tabIndex={0} aria-label="Upcoming titles">
        {visible.map((title) => {
          const channel = channels.find((item) => item.id === title.channelId);
          return (
            <article key={title.id}>
              <div className={styles.poster}>
                <ProgrammeArtwork
                  src={title.poster}
                  title={title.title}
                  kind="Coming soon"
                />
              </div>
              <span className={styles.arrival}>
                {title.releaseLabel || "Coming soon"}
              </span>
              <h3>{title.title}</h3>
              {title.description && <p>{title.description}</p>}
              {channel && (
                <p>
                  CH {channel.number ?? channel.id} ·{" "}
                  {channel.branding?.displayName ?? channel.name}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
