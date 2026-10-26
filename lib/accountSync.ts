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
function snapshot(): Household {
  const { profiles, pin } = useProfiles.getState();
  return {
    profiles,
    pin,
    library: useDeviceLibrary.getState().profiles,
    showMemberBadge: useAccount.getState().showMemberBadge,
  };
}
function applyHousehold(household: Household | null) {
  applying = true;
  const data: Household = household ?? {
    profiles: defaults.map((profile) => ({ ...profile })),
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
    useProfiles.setState({ ready: false });
    await useDeviceLibrary.persist.rehydrate();
    initializeProfiles();
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
    start = refreshAccount().catch(async () => {
      useAccount.setState({
        ...EMPTY_ACCOUNT,
        ready: true,
        error:
          "Account services are unavailable. Free viewing still works; account changes are not syncing.",
      });
      await useDeviceLibrary.persist.rehydrate();
      initializeProfiles();
    });
  return start;
}
export async function flushAccountChanges() {
  clearTimeout(timer);
  if (pending) await pending;
  const account = useAccount.getState();
  if (!account.user || applying || paused) return;
  const household = snapshot();
  const value = JSON.stringify(household);
  if (value === lastSaved) return;
  const ownerId = account.user.id;
  useAccount.setState({ saving: true, syncError: "" });
  pending = (async () => {
    try {
      const result = await accountRequest(
        "/api/account/household",
        { household, revision: account.revision },
        "PUT",
      );
      if (useAccount.getState().user?.id !== ownerId) return;
      lastSaved = value;
      useAccount.setState({ revision: result.revision, household });
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
      pending = null;
    }
  })();
  await pending;
  if (!paused && JSON.stringify(snapshot()) !== lastSaved)
    await flushAccountChanges();
}
export function watchAccountChanges() {
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
  return () => {
    clearTimeout(timer);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    window.removeEventListener("beforeunload", beforeUnload);
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
