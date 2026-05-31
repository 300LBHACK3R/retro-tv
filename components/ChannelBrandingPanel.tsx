"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import type { Channel, ChannelBranding } from "@/lib/types";

const DEFAULT_ACCENT_COLOR = "#2563eb";
const MAX_CALLSIGN_LENGTH = 12;
const MAX_LOGO_TEXT_LENGTH = 32;
const MAX_DISPLAY_NAME_LENGTH = 48;
const MAX_DESCRIPTION_LENGTH = 120;

const COLOR_PRESETS = [
  { label: "Blue", value: "#2563eb" },
  { label: "Gold", value: "#d4af37" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Red", value: "#dc2626" },
  { label: "Green", value: "#16a34a" },
  { label: "Cyan", value: "#0891b2" },
] as const;

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

function normalizeHexColor(value: string, fallback = DEFAULT_ACCENT_COLOR): string {
  const clean = value.trim();

  if (isValidHexColor(clean)) {
    return clean.toLowerCase();
  }

  const withoutHash = clean.replace(/^#/, "");

  if (/^[0-9a-f]{6}$/i.test(withoutHash)) {
    return `#${withoutHash.toLowerCase()}`;
  }

  return fallback;
}

function normalizeCallsign(value: string, fallback: string): string {
  const clean = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 -]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, MAX_CALLSIGN_LENGTH);

  return clean || fallback.slice(0, MAX_CALLSIGN_LENGTH).toUpperCase();
}

function normalizeText(value: string, fallback: string, maxLength: number): string {
  const clean = value.trim().replace(/\s+/g, " ").slice(0, maxLength);

  return clean || fallback.slice(0, maxLength);
}

function normalizeDescription(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, MAX_DESCRIPTION_LENGTH);
}

function normalizeDraft(
  draft: BrandingDraft,
  fallback: ChannelBranding,
): ChannelBranding {
  return {
    displayName: normalizeText(
      draft.displayName,
      fallback.displayName,
      MAX_DISPLAY_NAME_LENGTH,
    ),
    callsign: normalizeCallsign(draft.callsign, fallback.callsign),
    logoText: normalizeText(draft.logoText, fallback.logoText, MAX_LOGO_TEXT_LENGTH),
    description: normalizeDescription(draft.description),
    accentColor: normalizeHexColor(
      draft.accentColor,
      fallback.accentColor || DEFAULT_ACCENT_COLOR,
    ),
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

function getInitials(value: string): string {
  const clean = value.trim();

  if (!clean) {
    return "CH";
  }

  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}`.toUpperCase();
  }

  return clean.slice(0, 4).toUpperCase();
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
  const [message, setMessage] = useState(
    "Edit the fields, then click Save Changes.",
  );

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

  const normalizedDraft = normalizeDraft(draft, savedBranding);
  const normalizedSavedBranding = normalizeDraft(savedBranding, savedBranding);
  const accentColor = normalizeHexColor(draft.accentColor);

  const hasUnsavedChanges = !areBrandingValuesEqual(
    normalizedDraft,
    normalizedSavedBranding,
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

  const applyPreset = (color: string) => {
    updateDraft({
      accentColor: color,
    });
  };

  const displayNameCount = draft.displayName.length;
  const logoTextCount = draft.logoText.length;
  const descriptionCount = draft.description.length;

  return (
    <section
      className="rounded-2xl border p-3 sm:p-4"
      style={{
        background: "var(--panel-bg)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            Branding
          </div>

          <h2 className="mt-1 text-sm font-semibold tracking-wide">
            Channel Branding
          </h2>

          <p className="mt-1 text-xs leading-5" style={{ color: "var(--text-muted)" }}>
            Customize the active channel identity, viewer overlay, guide accent,
            callsign, logo label, and channel description.
          </p>
        </div>

        <div
          className="rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
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
        className="mb-4 overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: accentColor,
          background:
            "radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.82), rgba(0,0,0,0.42))",
          boxShadow: `0 0 26px ${accentColor}30, 0 18px 55px rgba(0,0,0,0.35)`,
        }}
      >
        <div
          className="h-px w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
          }}
        />

        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xs font-black uppercase tracking-tight text-white shadow-2xl"
              style={{
                background: accentColor,
                boxShadow: `0 0 20px ${accentColor}70`,
              }}
            >
              {getInitials(draft.callsign || draft.logoText || activeChannel.name)}
            </div>

            <div className="min-w-0">
              <div className="truncate text-base font-black uppercase tracking-[0.13em] text-white">
                {draft.logoText || draft.displayName || activeChannel.name}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/72">
                <span>{draft.callsign || activeChannel.name}</span>
                <span className="text-white/35">•</span>
                <span>{getChannelLabel(activeChannel)}</span>
                <span className="text-white/35">•</span>
                <span>Live</span>
              </div>

              {draft.description ? (
                <div className="mt-1 line-clamp-2 text-xs leading-5 text-white/58">
                  {draft.description}
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/70"
            style={{
              borderColor: `${accentColor}88`,
              background: "rgba(0,0,0,0.28)",
            }}
          >
            Preview
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label
              htmlFor="channel-display-name"
              className="block text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Display Name
            </label>

            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {displayNameCount}/{MAX_DISPLAY_NAME_LENGTH}
            </span>
          </div>

          <input
            id="channel-display-name"
            value={draft.displayName}
            onChange={(event) =>
              updateDraft({
                displayName: event.target.value.slice(0, MAX_DISPLAY_NAME_LENGTH),
              })
            }
            className="w-full rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
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
                  callsign: event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z0-9 -]/g, "")
                    .slice(0, MAX_CALLSIGN_LENGTH),
                })
              }
              className="w-full rounded-xl border px-3 py-3 text-base uppercase outline-none transition focus:ring-2 sm:text-sm"
              maxLength={MAX_CALLSIGN_LENGTH}
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label
                htmlFor="channel-logo-text"
                className="block text-xs font-medium"
                style={{ color: "var(--text-muted)" }}
              >
                Logo Text
              </label>

              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {logoTextCount}/{MAX_LOGO_TEXT_LENGTH}
              </span>
            </div>

            <input
              id="channel-logo-text"
              value={draft.logoText}
              onChange={(event) =>
                updateDraft({
                  logoText: event.target.value.slice(0, MAX_LOGO_TEXT_LENGTH),
                })
              }
              className="w-full rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: "var(--border)",
                color: "var(--text)",
              }}
            />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label
              htmlFor="channel-description"
              className="block text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Description
            </label>

            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
              {descriptionCount}/{MAX_DESCRIPTION_LENGTH}
            </span>
          </div>

          <textarea
            id="channel-description"
            value={draft.description}
            onChange={(event) =>
              updateDraft({
                description: event.target.value.slice(0, MAX_DESCRIPTION_LENGTH),
              })
            }
            rows={3}
            className="w-full resize-none rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
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

          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <input
              id="channel-accent-color"
              type="color"
              value={accentColor}
              onChange={(event) =>
                updateDraft({
                  accentColor: event.target.value,
                })
              }
              className="h-12 w-full shrink-0 cursor-pointer rounded-xl border sm:w-16"
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
              onBlur={() =>
                updateDraft({
                  accentColor: normalizeHexColor(
                    draft.accentColor,
                    savedBranding.accentColor,
                  ),
                })
              }
              className="w-full rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
              placeholder="#2563eb"
              style={{
                background: "var(--panel-alt-bg)",
                borderColor: isValidHexColor(normalizeHexColor(draft.accentColor))
                  ? "var(--border)"
                  : "#f87171",
                color: "var(--text)",
              }}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() => applyPreset(preset.value)}
                className="rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition hover:scale-[1.02]"
                style={{
                  background:
                    draft.accentColor.toLowerCase() === preset.value
                      ? preset.value
                      : "var(--button-bg)",
                  borderColor: preset.value,
                  color:
                    draft.accentColor.toLowerCase() === preset.value
                      ? "#fff"
                      : "var(--text)",
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {!isValidHexColor(normalizeHexColor(draft.accentColor)) ? (
            <div className="mt-1 text-[11px] text-red-300">
              Use a valid 6-digit hex color like #2563eb.
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="mt-4 rounded-xl border px-3 py-2 text-xs leading-5"
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

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={saveChanges}
          disabled={!hasUnsavedChanges}
          className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), rgba(212,175,55,0.72))",
            color: "var(--text)",
          }}
        >
          Save Changes
        </button>

        <button
          type="button"
          onClick={resetChanges}
          disabled={!hasUnsavedChanges}
          className="rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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