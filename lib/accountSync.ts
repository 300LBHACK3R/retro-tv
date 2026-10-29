"use client";
import { defaults } from "./profiles";
import {
  EMPTY_ACCOUNT,
  sanitizeHousehold,
  type AccountView,
  type Household,
} from "./accountModel";
import { useAccount, accountRequest } from "./accountStore";
import {
  initializeProfiles,
  lockProfiles,
  useProfiles,
} from "./deviceProfiles";
import { useDeviceLibrary, DEVICE_LIBRARY_KEY } from "./deviceLibrary";
import { PROFILE_STORAGE_KEY } from "./themePreferences";
import { canUseTheme } from "./themes";

let applying = false;
let lastSaved = "";
let pending: Promise<void> | null = null;
let paused = false;
let start: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout>;
const HOUSEHOLD_CHANGE = "ttv-household-change";
let changeChannel: BroadcastChannel | null = null;

function announceHouseholdSave(userId: string, revision: number) {
  const change = { userId, revision };
  try {
    if (changeChannel) changeChannel.postMessage(change);
    else localStorage.setItem(HOUSEHOLD_CHANGE, JSON.stringify(change));
  } catch {
    // Saving to the account still works when cross-tab messaging is unavailable.
  }
}
function snapshot(): Household {
  const { profiles, pin, entranceTheme } = useProfiles.getState();
  return {
    profiles,
    pin,
    ...(entranceTheme ? { entranceTheme } : {}),
    library: useDeviceLibrary.getState().profiles,
    showMemberBadge: useAccount.getState().showMemberBadge,
  };
}
function applyHousehold(household: Household | null) {
  applying = true;
  const data: Household = household ?? {
    profiles: defaults.filter((profile) => !profile.kids).map((profile) => ({ ...profile })),
    pin: null,
    library: {},
    showMemberBadge: false,
  };
  useAccount.setState({ showMemberBadge: data.showMemberBadge });
  useDeviceLibrary.setState({
    profiles: data.library,
    favouriteChannels: [],
    watchlist: [],
  });
  initializeProfiles({
    profiles: data.profiles,
    pin: data.pin,
    entranceTheme: data.entranceTheme,
    failures: 0,
    lockedUntil: 0,
  });
  useDeviceLibrary
    .getState()
    .selectProfile(useProfiles.getState().activeId ?? "main");
  lastSaved = JSON.stringify(snapshot());
  applying = false;
}
export async function refreshAccount(replacePreferences = false) {
  const response = await fetch("/api/account", {
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await response.json()) as AccountView & { error?: string };
  if (!response.ok)
    throw new Error(data.error || "Could not load your account.");
  const previous = useAccount.getState();
  const ownerChanged = previous.user?.id !== data.user?.id;
  const dirty = previous.user && JSON.stringify(snapshot()) !== lastSaved;
  // A GET started before a successful save can arrive after that save finishes.
  // Entitlements may refresh, but an older preference revision must never win.
  if (!ownerChanged && data.revision < previous.revision) {
    data.revision = previous.revision;
    data.household = previous.household;
  }
  useAccount.setState({
    ...data,
    ready: true,
    error: "",
    ...(replacePreferences ? { syncError: "" } : {}),
  });
  if (ownerChanged && previous.ready) lockProfiles();
  if (data.user) {
    if (
      ownerChanged ||
      replacePreferences ||
      !useProfiles.getState().ready ||
      (!dirty &&
        (data.revision !== previous.revision ||
          data.member !== previous.member))
    )
      applyHousehold(data.household);
    // Keep the local revision while edits are pending so the server can detect conflicts.
    if (dirty && !replacePreferences && !ownerChanged)
      useAccount.setState({ revision: previous.revision });
  } else if (ownerChanged || !useProfiles.getState().ready) {
    lockProfiles();
    useProfiles.setState({ profiles: [], pin: null, ready: true, entranceTheme: null });
    useDeviceLibrary.setState({ profiles: {}, favouriteChannels: [], watchlist: [] });
  }
  const activeIndex = useProfiles
    .getState()
    .profiles.findIndex(
      (profile) => profile.id === useProfiles.getState().activeId,
    );
  if (activeIndex >= data.profileLimit) lockProfiles();
  if (replacePreferences || ownerChanged) paused = false;
}
export function startAccount() {
  if (!start)
    start = refreshAccount().catch(() => {
      useAccount.setState({
        ...EMPTY_ACCOUNT,
        ready: true,
        error:
          "Account services are unavailable. Please try again shortly to sign in.",
      });
      lockProfiles();
      useProfiles.setState({ profiles: [], pin: null, ready: true, entranceTheme: null });
      useDeviceLibrary.setState({ profiles: {}, favouriteChannels: [], watchlist: [] });
    });
  return start;
}
export async function flushAccountChanges() {
  clearTimeout(timer);
  // Every caller joins one writer, including edits made while a save is in flight.
  // Awaiting a writer and then starting independently lets several callers submit
  // the same revision, producing a false cross-device conflict.
  if (pending) return pending;
  pending = (async () => {
    while (true) {
      const account = useAccount.getState();
      if (!account.user || applying || paused) return;
      const household = snapshot();
      const value = JSON.stringify(household);
      if (value === lastSaved) return;
      const ownerId = account.user.id;
      useAccount.setState({ saving: true, syncError: "" });
      try {
        const result = await accountRequest(
          "/api/account/household",
          { household, revision: account.revision },
          "PUT",
        );
        if (useAccount.getState().user?.id !== ownerId) return;
        lastSaved = value;
        useAccount.setState({ revision: result.revision, household });
        announceHouseholdSave(ownerId, result.revision);
      } catch (error) {
        if (useAccount.getState().user?.id !== ownerId) return;
        paused = true;
        useAccount.setState({
          syncError:
            error instanceof Error
              ? error.message
              : "Preferences could not be saved.",
        });
      } finally {
        if (useAccount.getState().user?.id === ownerId)
          useAccount.setState({ saving: false });
      }
    }
  })().finally(() => { pending = null; });
  return pending;
}
export function watchAccountChanges() {
  const receiveChange = (change: unknown) => {
    if (!change || typeof change !== "object") return;
    const { userId, revision } = change as { userId?: unknown; revision?: unknown };
    const account = useAccount.getState();
    if (!account.user || userId !== account.user.id ||
        typeof revision !== "number" || !Number.isSafeInteger(revision) ||
        revision <= account.revision) return;
    // A message is only a refresh hint. Preferences and access always come from
    // the authenticated server, and refreshAccount preserves unsaved local edits.
    void refreshAccount().catch(() => {
      useAccount.setState({ error: "Account connection interrupted. Your current viewing session can continue." });
    });
  };
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(HOUSEHOLD_CHANGE);
    channel.onmessage = (event) => receiveChange(event.data);
    changeChannel = channel;
  } catch {
    // Older or restricted browsers can still use storage events.
  }
  const storageChanged = (event: StorageEvent) => {
    if (event.key !== HOUSEHOLD_CHANGE || !event.newValue) return;
    try { receiveChange(JSON.parse(event.newValue)); } catch { /* Ignore invalid hints. */ }
  };
  const changed = () => {
    if (
      applying ||
      !useAccount.getState().user ||
      paused ||
      JSON.stringify(snapshot()) === lastSaved
    )
      return;
    clearTimeout(timer);
    timer = setTimeout(() => void flushAccountChanges(), 700);
  };
  const unsubscribers = [
    useProfiles.subscribe(changed),
    useDeviceLibrary.subscribe(changed),
    useAccount.subscribe((state, previous) => {
      if (state.showMemberBadge !== previous.showMemberBadge) changed();
    }),
  ];
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (
      useAccount.getState().user &&
      JSON.stringify(snapshot()) !== lastSaved
    ) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  window.addEventListener("beforeunload", beforeUnload);
  window.addEventListener("storage", storageChanged);
  return () => {
    clearTimeout(timer);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    window.removeEventListener("beforeunload", beforeUnload);
    window.removeEventListener("storage", storageChanged);
    channel?.close();
    if (changeChannel === channel) changeChannel = null;
  };
}
export async function retryAccountSave() {
  paused = false;
  await flushAccountChanges();
}
export async function importDeviceProfiles() {
  if (!useAccount.getState().user || useAccount.getState().household)
    throw new Error(
      "Device profiles can only be imported into an empty account.",
    );
  const profiles = JSON.parse(
    localStorage.getItem(PROFILE_STORAGE_KEY) || "{}",
  );
  const library = JSON.parse(localStorage.getItem(DEVICE_LIBRARY_KEY) || "{}");
  const household = sanitizeHousehold({
    ...profiles,
    library: library.state?.profiles ?? {},
    showMemberBadge: false,
  });
  if (!household)
    throw new Error("There are no valid device profiles to import.");
  // Local theme metadata is a preference, never evidence of a purchase.
  for (const profile of household.profiles) {
    if (
      profile.theme &&
      !canUseTheme(profile.theme, useAccount.getState().ownedThemeIds, false)
    )
      delete profile.theme;
  }
  applyHousehold(household);
  lastSaved = "";
  await flushAccountChanges();
}
