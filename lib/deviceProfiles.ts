"use client";
import { create } from "zustand";
import { useDeviceLibrary } from "./deviceLibrary";
import { useStore } from "./store";
import { useAccount } from "./accountStore";
import { canUseTheme, isThemeId } from "./themes";
import type { ThemeId } from "./types";
import { getEntranceThemeId, rememberLoginTheme, PROFILE_STORAGE_KEY, PROFILE_SESSION_KEY } from "./themePreferences";
import { PROGRESS_STORAGE_KEY } from "./libraryCatalog";

export { PROFILE_STORAGE_KEY } from "./themePreferences";
import { defaults, sanitizeProfiles, type Profile, type ProfileData as Data } from "./profiles";
export { AVATARS, sanitizeProfiles, type Profile } from "./profiles";
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
    // Keep valid saved choices, including choices from older profile versions.
    profiles: sanitizeProfiles(data.profiles, 10),
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
    entranceTheme: ThemeId | null;
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
  entranceTheme: null,
  storageAvailable: true,
  revision: 0,
}));
function saveData() {
  if (useAccount.getState().user) return;
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
export function initializeProfiles(accountData?: Data & { entranceTheme?: ThemeId }) {
  if (useProfiles.getState().ready && !accountData) return;
  const data = accountData ?? readData();
  let activeId: string | null = null;
  try {
    const session = JSON.parse(
      sessionStorage.getItem(PROFILE_SESSION_KEY) || "null",
    );
    const profile = data.profiles.slice(0, useAccount.getState().profileLimit).find((profile) => profile.id === session?.id);
    if (
      profile &&
      session.pinHash === (data.pin?.hash ?? null) &&
      (!profile.kids || data.pin)
    )
      activeId = profile.id;
    if (!accountData) localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    useProfiles.setState({ storageAvailable: false });
  }
  const accountEntrance = accountData
    ? accountData.entranceTheme ?? data.profiles.find((profile) => profile.id === "main")?.theme
    : undefined;
  const preferred = data.profiles.find((profile) => profile.id === activeId)?.theme ?? accountEntrance;
  const theme = preferred && canUseTheme(preferred, useAccount.getState().ownedThemeIds, false)
    ? preferred : getEntranceThemeId();
  useProfiles.setState({ ...data, activeId, ready: true, entranceTheme: accountData && preferred ? theme : null });
  useStore.getState().setTheme(theme);
  if (accountData && useAccount.getState().user) rememberLoginTheme(preferred ? theme : null);
  if (activeId) {
    useDeviceLibrary.getState().selectProfile(activeId);
  }
}
export function lockProfiles() {
  const entrance = useAccount.getState().user ? useProfiles.getState().entranceTheme : null;
  useStore.getState().setTheme(entrance && canUseTheme(entrance, useAccount.getState().ownedThemeIds, false) ? entrance : getEntranceThemeId());
  useProfiles.setState({ activeId: null });
  saveSession(null);
}
export function refreshProfiles() {
  if (useAccount.getState().user) return;
  const data = readData();
  const current = useProfiles.getState();
  const withoutThemes = (profiles: Profile[]) => profiles.map(({ id, name, kids, avatar }) => ({ id, name, kids, avatar }));
  // A theme change in another tab must not interrupt playback or sign out the
  // household. Profile/PIN changes still invalidate the current session.
  if (JSON.stringify({ ...data, profiles: withoutThemes(data.profiles) }) ===
      JSON.stringify({ profiles: withoutThemes(current.profiles), pin: current.pin, failures: current.failures, lockedUntil: current.lockedUntil })) {
    useProfiles.setState({ profiles: data.profiles });
    const theme = data.profiles.find((profile) => profile.id === current.activeId)?.theme;
    if (theme) useStore.getState().setTheme(theme);
    return;
  }
  lockProfiles();
  useProfiles.setState((state) => ({
    ...data,
    revision: state.revision + 1,
  }));
}
export function activateProfile(id: string) {
  const profile = useProfiles
    .getState()
    .profiles.slice(0, useAccount.getState().profileLimit).find((profile) => profile.id === id);
  if (!profile || (profile.kids && !useProfiles.getState().pin)) return;
  useDeviceLibrary.getState().selectProfile(id);
  const state = useStore.getState();
  const preferred = profile.theme ?? getEntranceThemeId();
  const theme = canUseTheme(preferred, useAccount.getState().ownedThemeIds, false) ? preferred : getEntranceThemeId();
  state.setTheme(theme);
  state.setChannel(
    state.channels.find((channel) => Number(channel.number ?? channel.id) === 1)
      ?.id ?? "1",
  );
  state.closeGuide();
  state.setSettingsOpen(false);
  state.setPlayerViewMode("normal");
  const accountTheme = useAccount.getState().user && profile.theme ? theme : null;
  useProfiles.setState({ activeId: id, entranceTheme: accountTheme });
  if (useAccount.getState().user) rememberLoginTheme(accountTheme);
  saveSession(id);
}
export function saveProfile(profile: Profile) {
  const state = useProfiles.getState();
  if (!state.profiles.some((item) => item.id === profile.id) && state.profiles.length >= useAccount.getState().profileLimit) return;
  const profiles = state.profiles.some((item) => item.id === profile.id)
    ? state.profiles.map((item) => (item.id === profile.id ? { ...item, ...profile } : item))
    : [...state.profiles, profile];
  useProfiles.setState({ profiles: sanitizeProfiles(profiles, 10) });
  saveData();
}
export function setProfileTheme(theme: ThemeId) {
  if (!isThemeId(theme) || !canUseTheme(theme, useAccount.getState().ownedThemeIds, false)) return;
  if (!useAccount.getState().user) {
    useStore.getState().setTheme(theme);
    return; // Guest choices last only in memory for this visit.
  }
  const { activeId } = useProfiles.getState();
  if (!activeId) return;
  useProfiles.setState((state) => ({
    profiles: state.profiles.map((profile) => profile.id === activeId ? { ...profile, theme } : profile),
    entranceTheme: theme,
  }));
  useStore.getState().setTheme(theme);
  rememberLoginTheme(theme);
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
  const owner = useAccount.getState().user?.id;
  return owner ? `${PROGRESS_STORAGE_KEY}:account:${owner}:${id}` : id === "main" ? PROGRESS_STORAGE_KEY : `${PROGRESS_STORAGE_KEY}:${id}`;
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
