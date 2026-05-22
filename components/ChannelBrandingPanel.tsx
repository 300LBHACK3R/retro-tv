"use client";

import { useMemo } from "react";
import { useStore } from "@/lib/store";
import type { Channel, ChannelBranding } from "@/lib/types";

const DEFAULT_ACCENT_COLOR = "#2563eb";

function getFallbackBranding(channel: Channel): ChannelBranding {
  return {
    displayName: channel.branding?.displayName ?? channel.name,
    callsign: channel.branding?.callsign ?? channel.name,
    description: channel.branding?.description ?? "",
    accentColor: channel.branding?.accentColor ?? DEFAULT_ACCENT_COLOR,
    logoText: channel.branding?.logoText ?? channel.name,
  };
}

function getChannelLabel(channel: Channel): string {
  return `CH ${channel.number ?? channel.id}`;
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export default function ChannelBrandingPanel() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const updateChannelBranding = useStore((state) => state.updateChannelBranding);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
  );

  if (!activeChannel) {
    return (
      <section
        className="rounded-2xl border p-4"
        style={{
          background: "var(--panel-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        <div className="text-sm font-semibold">No active channel.</div>
        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Select a channel before editing branding.
        </div>
      </section>
    );
  }

  const branding = getFallbackBranding(activeChannel);
  const accentColor = isValidHexColor(branding.accentColor)
    ? branding.accentColor
    : DEFAULT_ACCENT_COLOR;

  const updateBranding = (patch: Partial<ChannelBranding>) => {
    updateChannelBranding(activeChannel.id, patch);
  };

  return (
    <section
      className="rounded-2xl border p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold tracking-wide">Channel Branding</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            Customize the active channel identity, overlay label, and guide accent.
          </p>
        </div>

        <div
          className="rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: "var(--text-muted)",
          }}
        >
          {getChannelLabel(activeChannel)}
        </div>
      </div>

      <div
        className="mb-4 overflow-hidden rounded-xl border"
        style={{
          borderColor: accentColor,
          background:
            "linear-gradient(135deg, rgba(0,0,0,0.72), rgba(0,0,0,0.38))",
          boxShadow: `0 0 24px ${accentColor}22`,
        }}
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-xs font-black uppercase tracking-tight text-white shadow-2xl"
            style={{
              background: accentColor,
              boxShadow: `0 0 18px ${accentColor}66`,
            }}
          >
            {branding.callsign.slice(0, 4)}
          </div>

          <div className="min-w-0">
            <div className="truncate text-base font-bold uppercase tracking-[0.12em] text-white">
              {branding.logoText || branding.displayName}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              <span>{branding.callsign}</span>
              <span className="text-white/35">•</span>
              <span>{getChannelLabel(activeChannel)}</span>
              <span className="text-white/35">•</span>
              <span>Live</span>
            </div>

            {branding.description ? (
              <div className="mt-1 truncate text-xs text-white/60">
                {branding.description}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <label
            htmlFor="channel-display-name"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Display Name
          </label>

          <input
            id="channel-display-name"
            value={branding.displayName}
            onChange={(event) =>
              updateBranding({
                displayName: event.target.value,
              })
            }
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="channel-callsign"
              className="mb-1 block text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Callsign
            </label>

            <input
              id="channel-callsign"
              value={branding.callsign}
              onChange={(event) =>
                updateBranding({
                  callsign: event.target.value.toUpperCase(),
                })
              }
              className="w-full rounded-lg border px-3 py-2 text-sm uppercase outline-none transition focus:ring-2"
              maxLength={12}
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          <div>
            <label
              htmlFor="channel-logo-text"
              className="mb-1 block text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Logo Text
            </label>

            <input
              id="channel-logo-text"
              value={branding.logoText}
              onChange={(event) =>
                updateBranding({
                  logoText: event.target.value,
                })
              }
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="channel-description"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Description
          </label>

          <textarea
            id="channel-description"
            value={branding.description}
            onChange={(event) =>
              updateBranding({
                description: event.target.value,
              })
            }
            rows={3}
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
            style={{
              background: "var(--panel-alt-bg)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }}
          />
        </div>

        <div>
          <label
            htmlFor="channel-accent-color"
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Accent Color
          </label>

          <div className="flex items-center gap-2">
            <input
              id="channel-accent-color"
              type="color"
              value={accentColor}
              onChange={(event) =>
                updateBranding({
                  accentColor: event.target.value,
                })
              }
              className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border"
              style={{
                borderColor: "var(--border)",
                background: "var(--panel-alt-bg)",
              }}
            />

            <input
              value={accentColor}
              onChange={(event) => {
                const nextColor = event.target.value.trim();

                updateBranding({
                  accentColor: nextColor,
                });
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
              placeholder="#2563eb"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: isValidHexColor(accentColor)
                  ? "var(--border)"
                  : "#f87171",
                color: "var(--text)",
              }}
            />
          </div>

          {!isValidHexColor(branding.accentColor) ? (
            <div className="mt-1 text-[11px] text-red-300">
              Use a valid 6-digit hex color like #2563eb.
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}