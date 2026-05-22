"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel, ChannelBranding } from "@/lib/types";

const DEFAULT_ACCENT_COLOR = "#2563eb";

type BrandingDraft = ChannelBranding;

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

function normalizeDraft(draft: BrandingDraft, fallback: ChannelBranding): ChannelBranding {
  return {
    displayName: draft.displayName.trim() || fallback.displayName,
    callsign: draft.callsign.trim().toUpperCase() || fallback.callsign,
    logoText: draft.logoText.trim() || fallback.logoText,
    description: draft.description.trim(),
    accentColor: isValidHexColor(draft.accentColor)
      ? draft.accentColor
      : fallback.accentColor || DEFAULT_ACCENT_COLOR,
  };
}

function areBrandingValuesEqual(a: ChannelBranding, b: ChannelBranding): boolean {
  return (
    a.displayName === b.displayName &&
    a.callsign === b.callsign &&
    a.logoText === b.logoText &&
    a.description === b.description &&
    a.accentColor.toLowerCase() === b.accentColor.toLowerCase()
  );
}

export default function ChannelBrandingPanel() {
  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const updateChannelBranding = useStore((state) => state.updateChannelBranding);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === currentChannelId),
    [channels, currentChannelId],
  );

  const savedBranding = useMemo(() => {
    if (!activeChannel) {
      return null;
    }

    return getFallbackBranding(activeChannel);
  }, [activeChannel]);

  const [draft, setDraft] = useState<BrandingDraft | null>(savedBranding);
  const [message, setMessage] = useState("Edit the fields, then click Save Changes.");

  useEffect(() => {
    if (!savedBranding) {
      setDraft(null);
      return;
    }

    setDraft(savedBranding);
    setMessage("Edit the fields, then click Save Changes.");
  }, [activeChannel?.id, savedBranding]);

  if (!activeChannel || !savedBranding || !draft) {
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

  const accentColor = isValidHexColor(draft.accentColor)
    ? draft.accentColor
    : DEFAULT_ACCENT_COLOR;

  const normalizedDraft = normalizeDraft(draft, savedBranding);
  const hasUnsavedChanges = !areBrandingValuesEqual(
    normalizedDraft,
    normalizeDraft(savedBranding, savedBranding),
  );

  const updateDraft = (patch: Partial<BrandingDraft>) => {
    setDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        ...patch,
      };
    });

    setMessage("Unsaved changes.");
  };

  const saveChanges = () => {
    const nextBranding = normalizeDraft(draft, savedBranding);

    updateChannelBranding(activeChannel.id, nextBranding);

    setDraft(nextBranding);
    setMessage("Saved locally. Wait for the global sync badge to finish saving.");
  };

  const resetChanges = () => {
    setDraft(savedBranding);
    setMessage("Changes reset.");
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
            {draft.callsign.slice(0, 4) || "CH"}
          </div>

          <div className="min-w-0">
            <div className="truncate text-base font-bold uppercase tracking-[0.12em] text-white">
              {draft.logoText || draft.displayName || activeChannel.name}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
              <span>{draft.callsign || activeChannel.name}</span>
              <span className="text-white/35">•</span>
              <span>{getChannelLabel(activeChannel)}</span>
              <span className="text-white/35">•</span>
              <span>Live</span>
            </div>

            {draft.description ? (
              <div className="mt-1 truncate text-xs text-white/60">
                {draft.description}
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
            value={draft.displayName}
            onChange={(event) =>
              updateDraft({
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
              value={draft.callsign}
              onChange={(event) =>
                updateDraft({
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
              value={draft.logoText}
              onChange={(event) =>
                updateDraft({
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
            value={draft.description}
            onChange={(event) =>
              updateDraft({
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
                updateDraft({
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
              value={draft.accentColor}
              onChange={(event) =>
                updateDraft({
                  accentColor: event.target.value.trim(),
                })
              }
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:ring-2"
              placeholder="#2563eb"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: isValidHexColor(draft.accentColor)
                  ? "var(--border)"
                  : "#f87171",
                color: "var(--text)",
              }}
            />
          </div>

          {!isValidHexColor(draft.accentColor) ? (
            <div className="mt-1 text-[11px] text-red-300">
              Use a valid 6-digit hex color like #2563eb.
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="mt-4 rounded-xl border px-3 py-2 text-xs"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: hasUnsavedChanges
            ? "rgba(250, 204, 21, 0.45)"
            : "var(--border)",
          color: hasUnsavedChanges ? "#fde68a" : "var(--text-muted)",
        }}
      >
        {message}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveChanges}
          disabled={!hasUnsavedChanges || !isValidHexColor(draft.accentColor)}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "var(--primary)",
            color: "var(--text)",
          }}
        >
          Save Changes
        </button>

        <button
          type="button"
          onClick={resetChanges}
          disabled={!hasUnsavedChanges}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background: "var(--button-bg)",
            color: "var(--text)",
          }}
        >
          Reset
        </button>
      </div>
    </section>
  );
}