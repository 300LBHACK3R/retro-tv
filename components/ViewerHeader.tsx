"use client";

import { useEffect, useMemo, useState } from "react";
import { cleanDisplayText } from "@/lib/textClean";
import type { Channel } from "@/lib/types";

interface ViewerHeaderProps {
  channel: Channel | undefined;
}

const LIVE_TICK_MS = 15_000;
const DEFAULT_TITLE = "TATE'S TV";
const DEFAULT_SUBTITLE = "A curated live channel experience";

function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

function isValidHexColor(value: string | undefined): value is string {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value.trim()));
}

function getSafeAccent(channel: Channel | undefined): string {
  const accent = channel?.branding?.accentColor?.trim();

  if (isValidHexColor(accent)) {
    return accent.toLowerCase();
  }

  return "var(--primary)";
}

function normalizeLogoUrl(value: string | undefined): string | undefined {
  const clean = value?.trim();

  if (!clean) {
    return undefined;
  }

  if (
    clean.startsWith("/") ||
    clean.startsWith("data:image/") ||
    /^https?:\/\//i.test(clean)
  ) {
    return clean;
  }

  return undefined;
}

function formatHeaderTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function ChannelLogo({
  logoUrl,
  fallbackText,
  accent,
}: {
  logoUrl: string | undefined;
  fallbackText: string;
  accent: string;
}) {
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    setFailedLogoUrl(null);
  }, [logoUrl]);

  const canShowImage = Boolean(logoUrl && failedLogoUrl !== logoUrl);

  return (
    <div
      className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border text-center text-sm font-black uppercase tracking-tight shadow-2xl shadow-black/20 sm:h-20 sm:w-20"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--primary) 18%, transparent), var(--panel-alt-bg))",
        borderColor: accent,
        color: "var(--text)",
      }}
      aria-hidden="true"
    >
      {canShowImage && logoUrl ? (
        // Use a plain img here because channel logos can be remote URLs,
        // data URLs, or locally served public assets.
        <img
          src={logoUrl}
          alt=""
          className="h-full w-full object-contain p-2"
          loading="eager"
          decoding="async"
          onError={() => setFailedLogoUrl(logoUrl)}
        />
      ) : (
        <span className="line-clamp-2 px-2 leading-4">
          {fallbackText.slice(0, 18)}
        </span>
      )}
    </div>
  );
}

export default function ViewerHeader({ channel }: ViewerHeaderProps) {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(new Date());

    const interval = window.setInterval(() => {
      setNow(new Date());
    }, LIVE_TICK_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const branding = channel?.branding;
  const accent = getSafeAccent(channel);
  const logoUrl = normalizeLogoUrl(branding?.logoUrl);

  const title = useMemo(
    () =>
      cleanDisplayText(
        branding?.displayName ||
          branding?.logoText ||
          channel?.name ||
          DEFAULT_TITLE,
      ),
    [branding?.displayName, branding?.logoText, channel?.name],
  );

  const logoText = useMemo(
    () =>
      cleanDisplayText(
        branding?.logoText || branding?.callsign || title || DEFAULT_TITLE,
      ),
    [branding?.callsign, branding?.logoText, title],
  );

  const subtitle = useMemo(
    () => cleanDisplayText(branding?.description || DEFAULT_SUBTITLE),
    [branding?.description],
  );

  const callsign = useMemo(
    () => cleanDisplayText(branding?.callsign || channel?.name || "LIVE"),
    [branding?.callsign, channel?.name],
  );

  const clockLabel = mounted && now ? formatHeaderTime(now) : "--:--";

  return (
    <header
      className="relative overflow-hidden rounded-2xl border px-4 py-4 shadow-2xl shadow-black/20 sm:px-5"
      style={{
        background:
          "radial-gradient(circle at top right, color-mix(in srgb, var(--primary) 22%, transparent), transparent 34%), var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--primary), transparent)",
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-20 blur-3xl"
        style={{ background: accent }}
        aria-hidden="true"
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <ChannelLogo logoUrl={logoUrl} fallbackText={logoText} accent={accent} />

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="text-[11px] font-black uppercase tracking-[0.22em]"
                style={{ color: "var(--text-muted)" }}
              >
                Tate&apos;s TV
              </div>

              <div
                className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--panel-alt-bg)",
                  color: accent,
                }}
              >
                ● Live
              </div>

              <div
                className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--panel-alt-bg)",
                  color: "var(--text-muted)",
                }}
              >
                {clockLabel}
              </div>

              {channel ? (
                <div
                  className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--panel-alt-bg)",
                    color: "var(--text-muted)",
                  }}
                >
                  {getChannelLabel(channel)}
                </div>
              ) : null}
            </div>

            <h1
              className="mt-4 truncate text-4xl font-black tracking-tight sm:text-5xl"
              title={title}
            >
              {title}
            </h1>

            <p
              className="mt-3 line-clamp-2 max-w-5xl text-sm leading-6 sm:text-base"
              style={{ color: "var(--text-muted)" }}
              title={subtitle}
            >
              {subtitle}
            </p>
          </div>
        </div>

        {channel ? (
          <aside
            className="shrink-0 rounded-2xl border px-5 py-4 text-left shadow-2xl shadow-black/20 sm:min-w-[14rem] sm:text-right"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              borderTopColor: accent,
            }}
            aria-label="Current channel"
          >
            <div
              className="text-[11px] font-black uppercase tracking-[0.22em]"
              style={{ color: "var(--text-muted)" }}
            >
              Channel
            </div>

            <div className="mt-2 text-2xl font-black">
              {getChannelLabel(channel)}
            </div>

            <div
              className="mt-1 max-w-[14rem] truncate text-xs font-black uppercase tracking-[0.16em]"
              style={{ color: "var(--text-muted)" }}
              title={callsign}
            >
              {callsign}
            </div>
          </aside>
        ) : null}
      </div>
    </header>
  );
}