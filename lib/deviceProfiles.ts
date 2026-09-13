"use client";
import { create } from "zustand";
import { useDeviceLibrary } from "./deviceLibrary";
import { useStore } from "./store";
import { DEFAULT_THEME_ID, isThemeId } from "./themes";
import { PROGRESS_STORAGE_KEY } from "./libraryCatalog";
import type { ThemeId } from "./types";

export const PROFILE_STORAGE_KEY = "ttv-profiles-v1";
export const PROFILE_SESSION_KEY = "ttv-profile-session-v1";
export const AVATARS = ["sun", "moon", "star", "bolt", "flower"] as const;
export type Profile = {
  id: string;
  name: string;
  kids: boolean;
  avatar: (typeof AVATARS)[number];
  theme?: ThemeId;
};
type Pin = { salt: string; hash: string };
type Data = {
  profiles: Profile[];
  pin: Pin | null;
  failures: number;
  lockedUntil: number;
};
const defaults: Profile[] = [
  { id: "main", name: "Main", kids: false, avatar: "sun" },
  { id: "kids", name: "Kids", kids: true, avatar: "star" },
];
export function sanitizeProfiles(value: unknown): Profile[] {
  if (!Array.isArray(value)) return defaults.map((profile) => ({ ...profile }));
  const unique = new Map<string, Profile>();
  for (const entry of value.slice(0, 5)) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.id !== "string" ||
      !/^[a-z0-9-]{1,60}$/.test(entry.id) ||
      typeof entry.name !== "string"
    )
      continue;
    const name = entry.name.trim().slice(0, 24);
    if (!name) continue;
    unique.set(entry.id, {
      id: entry.id,
      name,
      kids: entry.id === "main" ? false : entry.kids === true,
      avatar: AVATARS.includes(entry.avatar) ? entry.avatar : "sun",
      theme: isThemeId(entry.theme) ? entry.theme : undefined,
    });
  }
  if (!unique.has("main")) unique.set("main", { ...defaults[0]! });
  return [
    unique.get("main")!,
    ...[...unique.values()].filter((profile) => profile.id !== "main"),
  ].slice(0, 5);
}
function readData(): Data {
  let data: Partial<Data> = {};
  try {
    data = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || "{}") || {};
  } catch {
    /* Memory-only mode. */
  }
  const pin =
    data.pin &&
    typeof data.pin.salt === "string" &&
    typeof data.pin.hash === "string" &&
    /^[a-f0-9]{32}$/.test(data.pin.salt) &&
    /^[a-f0-9]{64}$/.test(data.pin.hash)
      ? data.pin
      : null;
  return {
    profiles: sanitizeProfiles(data.profiles),
    pin,
    failures: Number.isInteger(data.failures)
      ? Math.min(5, Math.max(0, data.failures!))
      : 0,
    lockedUntil: Number.isFinite(data.lockedUntil)
      ? Math.min(Date.now() + 30000, Math.max(0, data.lockedUntil!))
      : 0,
  };
}
export const useProfiles = create<
  Data & {
    ready: boolean;
    activeId: string | null;
    storageAvailable: boolean;
    revision: number;
  }
>(() => ({
  profiles: defaults,
  pin: null,
  failures: 0,
  lockedUntil: 0,
  ready: false,
  activeId: null,
  storageAvailable: true,
  revision: 0,
}));
function saveData() {
  const { profiles, pin, failures, lockedUntil } = useProfiles.getState();
  try {
    localStorage.setItem(
      PROFILE_STORAGE_KEY,
      JSON.stringify({ profiles, pin, failures, lockedUntil }),
    );
  } catch {
    useProfiles.setState({ storageAvailable: false });
  }
}
function saveSession(id: string | null) {
  try {
    if (id)
      sessionStorage.setItem(
        PROFILE_SESSION_KEY,
        JSON.stringify({
          id,
          pinHash: useProfiles.getState().pin?.hash ?? null,
        }),
      );
    else sessionStorage.removeItem(PROFILE_SESSION_KEY);
  } catch {
    /* This tab remains usable. */
  }
}
export function initializeProfiles() {
  if (useProfiles.getState().ready) return;
  const data = readData();
  const main = data.profiles.find((profile) => profile.id === "main");
  if (main && !main.theme) main.theme = useStore.getState().themeId;
  let activeId: string | null = null;
  try {
    const session = JSON.parse(
      sessionStorage.getItem(PROFILE_SESSION_KEY) || "null",
    );
    const profile = data.profiles.find((profile) => profile.id === session?.id);
    if (
      profile &&
      session.pinHash === (data.pin?.hash ?? null) &&
      (!profile.kids || data.pin)
    )
      activeId = profile.id;
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    useProfiles.setState({ storageAvailable: false });
  }
  useProfiles.setState({ ...data, activeId, ready: true });
  if (activeId) {
    useDeviceLibrary.getState().selectProfile(activeId);
    const theme = data.profiles.find(
      (profile) => profile.id === activeId,
    )?.theme;
    if (theme) useStore.getState().setTheme(theme);
  }
}
export function lockProfiles() {
  useProfiles.setState({ activeId: null });
  saveSession(null);
}
export function refreshProfiles() {
  lockProfiles();
  useProfiles.setState((state) => ({
    ...readData(),
    revision: state.revision + 1,
  }));
}
export function activateProfile(id: string) {
  const profile = useProfiles
    .getState()
    .profiles.find((profile) => profile.id === id);
  if (!profile || (profile.kids && !useProfiles.getState().pin)) return;
  useDeviceLibrary.getState().selectProfile(id);
  const state = useStore.getState();
  state.setTheme(
    profile.theme ?? (id === "main" ? state.themeId : DEFAULT_THEME_ID),
  );
  state.setChannel(
    state.channels.find((channel) => Number(channel.number ?? channel.id) === 1)
      ?.id ?? "1",
  );
  state.closeGuide();
  state.setSettingsOpen(false);
  state.setPlayerViewMode("normal");
  useProfiles.setState({ activeId: id });
  saveSession(id);
}
export function saveProfile(profile: Profile) {
  const state = useProfiles.getState();
  const profiles = state.profiles.some((item) => item.id === profile.id)
    ? state.profiles.map((item) => (item.id === profile.id ? profile : item))
    : [...state.profiles, profile];
  useProfiles.setState({ profiles: sanitizeProfiles(profiles) });
  saveData();
}
export function deleteProfile(id: string) {
  if (id === "main") return;
  useProfiles.setState((state) => ({
    profiles: state.profiles.filter((profile) => profile.id !== id),
  }));
  useDeviceLibrary.getState().removeProfile(id);
  try {
    localStorage.removeItem(profileProgressKey(id));
  } catch {
    /* Storage may be disabled. */
  }
  saveData();
}
export function profileProgressKey(
  id = useProfiles.getState().activeId ?? "main",
) {
  return id === "main" ? PROGRESS_STORAGE_KEY : `${PROGRESS_STORAGE_KEY}:${id}`;
}
function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
export function newProfileId() {
  return `p-${hex(crypto.getRandomValues(new Uint8Array(12)))}`;
}
async function pinHash(pin: string, salt: string) {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      "PIN protection needs HTTPS. Open the live site or localhost.",
    );
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: 210000,
      salt: Uint8Array.from(salt.match(/../g)!, (byte) => parseInt(byte, 16)),
    },
    key,
    256,
  );
  return hex(new Uint8Array(bits));
}
export async function setParentPin(value: string) {
  if (!/^\d{4,8}$/.test(value))
    throw new Error("Use a PIN with 4 to 8 numbers.");
  const revision = useProfiles.getState().revision;
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await pinHash(value, salt);
  if (useProfiles.getState().revision !== revision)
    throw new Error("Profiles changed in another tab. Please try again.");
  useProfiles.setState({ pin: { salt, hash }, failures: 0, lockedUntil: 0 });
  saveData();
}
export async function verifyParentPin(value: string) {
  const state = useProfiles.getState();
  if (state.lockedUntil > Date.now())
    throw new Error("Too many attempts. Wait 30 seconds, then try again.");
  if (!state.pin) return false;
  const hash = await pinHash(value, state.pin.salt);
  if (
    useProfiles.getState().pin?.hash !== state.pin.hash ||
    useProfiles.getState().revision !== state.revision
  )
    return false;
  if (hash === state.pin.hash) {
    useProfiles.setState({ failures: 0, lockedUntil: 0 });
    saveData();
    return true;
  }
  const failures = state.failures + 1;
  useProfiles.setState({
    failures: failures >= 5 ? 0 : failures,
    lockedUntil: failures >= 5 ? Date.now() + 30000 : 0,
  });
  saveData();
  return false;
}
