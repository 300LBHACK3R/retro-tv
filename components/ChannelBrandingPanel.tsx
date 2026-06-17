"use client";

import { useEffect, useMemo, useState, useId } from "react";
import { useStore } from "@/lib/store";
import type { Channel, ChannelBranding } from "@/lib/types";

const DEFAULT_ACCENT_COLOR = "#2563eb";
const MAX_CALLSIGN_LENGTH = 12;
const MAX_LOGO_TEXT_LENGTH = 32;
const MAX_DISPLAY_NAME_LENGTH = 48;
const MAX_DESCRIPTION_LENGTH = 140;

const COLOR_PRESETS = [
  { label: "Blue", value: "#2563eb" },
  { label: "Cyan", value: "#0891b2" },
  { label: "Electric", value: "#22d3ee" },
  { label: "Gold", value: "#d4af37" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Red", value: "#dc2626" },
  { label: "Green", value: "#16a34a" },
  { label: "Pink", value: "#db2777" },
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

function getChannelName(channel: Channel): string {
  return channel.branding?.displayName ?? channel.name;
}

function sortChannels(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => {
    const aNumber = Number(a.number ?? a.id);
    const bNumber = Number(b.number ?? b.id);

    if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
      return aNumber - bNumber;
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value.trim());
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

  return fallback.toLowerCase();
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
    logoText: normalizeText(
      draft.logoText,
      fallback.logoText,
      MAX_LOGO_TEXT_LENGTH,
    ),
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

function getBrandingQualityScore(branding: ChannelBranding): number {
  let score = 0;

  if (branding.displayName.trim().length >= 2) score += 25;
  if (branding.callsign.trim().length >= 2) score += 25;
  if (branding.logoText.trim().length >= 2) score += 20;
  if (branding.description.trim().length >= 18) score += 20;
  if (isValidHexColor(branding.accentColor)) score += 10;

  return score;
}

function CharacterCount({
  current,
  max,
}: {
  current: number;
  max: number;
}) {
  const isNearLimit = current >= max * 0.85;

  return (
    <span
      className="text-[10px] font-semibold"
      style={{ color: isNearLimit ? "#fde68a" : "var(--text-muted)" }}
    >
      {current}/{max}
    </span>
  );
}

function TextInput({
  id,
  label,
  value,
  maxLength,
  onChange,
  uppercase = false,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  uppercase?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="block text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          {label}
        </label>

        <CharacterCount current={value.length} max={maxLength} />
      </div>

      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        maxLength={maxLength}
        className={[
          "w-full rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 sm:text-sm",
          uppercase ? "uppercase" : "",
        ].join(" ")}
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      />
    </div>
  );
}

function PreviewCard({
  channel,
  draft,
  accentColor,
}: {
  channel: Channel;
  draft: BrandingDraft;
  accentColor: string;
}) {
  const initials = getInitials(draft.callsign || draft.logoText || channel.name);
  const channelLabel = getChannelLabel(channel);
  const qualityScore = getBrandingQualityScore(
    normalizeDraft(draft, getFallbackBranding(channel)),
  );

  return (
    <div
      className="mb-4 overflow-hidden rounded-2xl border shadow-2xl"
      style={{
        borderColor: accentColor,
        background:
          "radial-gradient(circle at top left, rgba(255,255,255,0.18), transparent 34%), linear-gradient(135deg, rgba(0,0,0,0.84), rgba(0,0,0,0.48))",
        boxShadow: `0 0 28px ${accentColor}36, 0 18px 55px rgba(0,0,0,0.35)`,
      }}
    >
      <div
        className="h-px w-full"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        }}
      />

      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-xs font-black uppercase tracking-tight text-white shadow-2xl"
            style={{
              background: accentColor,
              boxShadow: `0 0 20px ${accentColor}70`,
            }}
          >
            {initials}
          </div>

          <div className="min-w-0">
            <div className="truncate text-base font-black uppercase tracking-[0.13em] text-white">
              {draft.logoText || draft.displayName || channel.name}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white/72">
              <span>{draft.callsign || channel.name}</span>
              <span className="text-white/35">•</span>
              <span>{channelLabel}</span>
              <span className="text-white/35">•</span>
              <span>Live</span>
            </div>

            {draft.description ? (
              <div className="mt-1 line-clamp-2 text-xs leading-5 text-white/58">
                {draft.description}
              </div>
            ) : (
              <div className="mt-1 text-xs leading-5 text-white/40">
                Add a channel description to improve the guide and overlay feel.
              </div>
            )}
          </div>
        </div>

        <div
          className="rounded-2xl border p-3"
          style={{
            borderColor: `${accentColor}66`,
            background: "rgba(0,0,0,0.32)",
          }}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/55">
            Viewer Overlay Preview
          </div>

          <div className="mt-2 flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: accentColor,
                boxShadow: `0 0 14px ${accentColor}`,
              }}
            />
            <div className="min-w-0 truncate text-xs font-black uppercase tracking-[0.12em] text-white">
              {draft.displayName || channel.name}
            </div>
          </div>

          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
            {draft.callsign || "LIVE"} / {channelLabel}
          </div>

          <div className="mt-3 rounded-xl bg-white/10 px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
            Brand Score: {qualityScore}%
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChannelBrandingPanel() {
  const fieldId = useId();

  const channels = useStore((state) => state.channels);
  const currentChannelId = useStore((state) => state.currentChannelId);
  const updateChannelBranding = useStore((state) => state.updateChannelBranding);

  const sortedChannels = useMemo(() => sortChannels(channels), [channels]);

  const [selectedChannelId, setSelectedChannelId] = useState(currentChannelId);
  const [draft, setDraft] = useState<BrandingDraft | null>(null);
  const [message, setMessage] = useState(
    "Edit the fields, then click Save Changes.",
  );

  useEffect(() => {
    setSelectedChannelId(currentChannelId);
  }, [currentChannelId]);

  const selectedChannel = useMemo(
    () =>
      sortedChannels.find((channel) => channel.id === selectedChannelId) ??
      sortedChannels.find((channel) => channel.id === currentChannelId) ??
      sortedChannels[0],
    [currentChannelId, selectedChannelId, sortedChannels],
  );

  const savedBranding = useMemo(() => {
    if (!selectedChannel) {
      return null;
    }

    return getFallbackBranding(selectedChannel);
  }, [selectedChannel]);

  useEffect(() => {
    if (!selectedChannel || !savedBranding) {
      setDraft(null);
      return;
    }

    setDraft(savedBranding);
    setMessage("Edit the fields, then click Save Changes.");
  }, [selectedChannel?.id, savedBranding]);

  if (!selectedChannel || !savedBranding || !draft) {
    return (
      <section className="ttv-glass-panel rounded-2xl p-4">
        <div className="text-sm font-semibold">No channel available.</div>
        <div className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
          Create or enable a channel before editing branding.
        </div>
      </section>
    );
  }

  const normalizedDraft = normalizeDraft(draft, savedBranding);
  const normalizedSavedBranding = normalizeDraft(savedBranding, savedBranding);
  const accentColor = normalizeHexColor(draft.accentColor, savedBranding.accentColor);
  const normalizedCurrentColor = normalizeHexColor(
    draft.accentColor,
    savedBranding.accentColor,
  );

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

  const selectChannel = (channelId: string) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        "You have unsaved branding changes. Switch channels and discard them?",
      );

      if (!confirmed) {
        return;
      }
    }

    setSelectedChannelId(channelId);
  };

  const saveChanges = () => {
    const nextBranding = normalizeDraft(draft, savedBranding);

    updateChannelBranding(selectedChannel.id, nextBranding);
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

  const descriptionCount = draft.description.length;
  const qualityScore = getBrandingQualityScore(normalizedDraft);

  return (
    <section
      className="ttv-glass-panel rounded-2xl p-3 sm:p-4"
      style={{ color: "var(--text)" }}
    >
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div
            className="text-xs font-black uppercase tracking-[0.18em]"
            style={{ color: "var(--primary)" }}
          >
            Branding
          </div>

          <h2 className="mt-1 text-base font-black tracking-tight">
            Channel Branding
          </h2>

          <p
            className="mt-1 max-w-3xl text-xs leading-5"
            style={{ color: "var(--text-muted)" }}
          >
            Customize channel identity, viewer overlay, guide accent, callsign,
            logo label, and channel description.
          </p>
        </div>

        <div
          className="w-fit rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em]"
          style={{
            borderColor: "var(--border)",
            background: "var(--panel-alt-bg)",
            color: "var(--text-muted)",
          }}
        >
          {getChannelLabel(selectedChannel)} / {qualityScore}%
        </div>
      </div>

      <div
        className="mb-4 rounded-2xl border p-3"
        style={{
          background: "var(--panel-alt-bg)",
          borderColor: "var(--border)",
        }}
      >
        <label
          htmlFor={`${fieldId}-channel`}
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--text-muted)" }}
        >
          Edit Channel
        </label>

        <select
          id={`${fieldId}-channel`}
          value={selectedChannel.id}
          onChange={(event) => selectChannel(event.target.value)}
          className="w-full rounded-xl border px-3 py-3 text-base outline-none transition focus:ring-2 sm:text-sm"
          style={{
            background: "var(--panel-bg)",
            borderColor: "var(--border)",
            color: "var(--text)",
          }}
        >
          {sortedChannels.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {getChannelLabel(channel)} / {getChannelName(channel)}
            </option>
          ))}
        </select>
      </div>

      <PreviewCard
        channel={selectedChannel}
        draft={draft}
        accentColor={accentColor}
      />

      <div className="grid gap-3">
        <TextInput
          id={`${fieldId}-display-name`}
          label="Display Name"
          value={draft.displayName}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          onChange={(value) => updateDraft({ displayName: value })}
          placeholder="Example: TTV Vortex"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <TextInput
            id={`${fieldId}-callsign`}
            label="Callsign"
            value={draft.callsign}
            maxLength={MAX_CALLSIGN_LENGTH}
            uppercase
            onChange={(value) =>
              updateDraft({
                callsign: value
                  .toUpperCase()
                  .replace(/[^A-Z0-9 -]/g, "")
                  .slice(0, MAX_CALLSIGN_LENGTH),
              })
            }
            placeholder="VORTEX"
          />

          <TextInput
            id={`${fieldId}-logo-text`}
            label="Logo Text"
            value={draft.logoText}
            maxLength={MAX_LOGO_TEXT_LENGTH}
            onChange={(value) => updateDraft({ logoText: value })}
            placeholder="TTV Vortex"
          />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label
              htmlFor={`${fieldId}-description`}
              className="block text-xs font-medium"
              style={{ color: "var(--text-muted)" }}
            >
              Description
            </label>

            <CharacterCount
              current={descriptionCount}
              max={MAX_DESCRIPTION_LENGTH}
            />
          </div>

          <textarea
            id={`${fieldId}-description`}
            value={draft.description}
            onChange={(event) =>
              updateDraft({
                description: event.target.value.slice(0, MAX_DESCRIPTION_LENGTH),
              })
            }
            rows={3}
            placeholder="Example: High-energy cartoons, anime, action, and after-school chaos."
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
            htmlFor={`${fieldId}-accent-color`}
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Accent Color
          </label>

          <div className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <input
              id={`${fieldId}-accent-color`}
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
                borderColor: isValidHexColor(normalizedCurrentColor)
                  ? "var(--border)"
                  : "#f87171",
                color: "var(--text)",
              }}
            />
          </div>

          <div className="mt-2 flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => {
              const active = normalizedCurrentColor === preset.value;

              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => applyPreset(preset.value)}
                  className="ttv-touch-target rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition hover:scale-[1.02]"
                  style={{
                    background: active ? preset.value : "var(--button-bg)",
                    borderColor: preset.value,
                    color: active ? "#fff" : "var(--text)",
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          {!isValidHexColor(normalizedCurrentColor) ? (
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
        aria-live="polite"
      >
        {message}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={saveChanges}
          disabled={!hasUnsavedChanges}
          className="ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), color-mix(in srgb, var(--primary) 58%, transparent))",
            color: "var(--text)",
          }}
        >
          Save Changes
        </button>

        <button
          type="button"
          onClick={resetChanges}
          disabled={!hasUnsavedChanges}
          className="ttv-action-button ttv-touch-target rounded-xl px-4 py-3 text-sm font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reset
        </button>
      </div>
    </section>
  );
}