import { test, expect } from "@playwright/test";
import { serverModule } from "./server-harness";
import { create } from "zustand";
import { PROFILE_SESSION_KEY } from "../lib/themePreferences";
import * as model from "../lib/accountModel";
import * as profiles from "../lib/profiles";
import * as themes from "../lib/themes";
import * as themePreferences from "../lib/themePreferences";

function guardHarness() {
  const local = new Map<string, string>();
  const session = new Map<string, string>();
  const storage = (data: Map<string, string>) => ({
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  });
  const window = { localStorage: storage(local), sessionStorage: storage(session) };
  const reload = () => serverModule("lib/kidsSession.ts", {
    zustand: { create }, "./themePreferences": { PROFILE_SESSION_KEY },
  }, {}, { window });
  return { local, session, window, reload, guard: reload() };
}

test("Kids restriction survives reload and account outage without restoring private data", async () => {
  const h = guardHarness();
  h.guard.rememberKidsSession!(true);
  const guard = h.reload();
  let account = { ...model.EMPTY_ACCOUNT, ready: false, error: "" };
  let local = { profiles: profiles.defaults, pin: null, activeId: "kids" as string | null, ready: false };
  const sync = serverModule("lib/accountSync.ts", {
    "./kidsSession": guard, "./profiles": profiles, "./accountModel": model,
    "./accountStore": { useAccount: {
      getState: () => account, setState: (patch: Partial<typeof account>) => { account = { ...account, ...patch }; },
    } },
    "./deviceProfiles": {
      useProfiles: { getState: () => local, setState: (patch: Partial<typeof local>) => { local = { ...local, ...patch }; } },
      lockProfiles: () => { local.activeId = null; },
    },
    "./deviceLibrary": { useDeviceLibrary: { setState() {} } },
    "./themePreferences": {}, "./themes": {},
  }, {}, { fetch: async () => { throw new Error("Offline"); }, clearTimeout, setTimeout });
  await sync.startAccount!();
  expect(account.user).toBeNull();
  expect(account.ready).toBe(true);
  expect(local.profiles).toEqual([]);
  expect((guard.useKidsSession as unknown as {getState(): {parentRequired: boolean}}).getState().parentRequired).toBe(true);
});

test("explicit parent release removes the saved device restriction", () => {
  const h = guardHarness();
  h.guard.rememberKidsSession!(true);
  h.guard.rememberKidsSession!(false);
  const reloaded = h.reload();
  reloaded.restoreKidsSession!();
  expect((reloaded.useKidsSession as unknown as {getState(): {parentRequired: boolean}}).getState().parentRequired).toBe(false);
  expect(h.local.size).toBe(0);
  expect(h.session.size).toBe(0);
});

test("older PIN-protected sessions fail closed; ordinary guests remain free", () => {
  const h = guardHarness();
  h.guard.restoreKidsSession!();
  expect((h.guard.useKidsSession as unknown as {getState(): {parentRequired: boolean}}).getState().parentRequired).toBe(false);
  h.session.set(PROFILE_SESSION_KEY, JSON.stringify({ id: "kids", pinHash: "a".repeat(64) }));
  h.guard.restoreKidsSession!();
  expect((h.guard.useKidsSession as unknown as {getState(): {parentRequired: boolean}}).getState().parentRequired).toBe(true);
  h.session.clear();
  const reloaded = h.reload();
  reloaded.restoreKidsSession!();
  expect((reloaded.useKidsSession as unknown as {getState(): {parentRequired: boolean}}).getState().parentRequired).toBe(true);
});

test("blocked storage cannot remove the current Kids restriction", () => {
  const h = guardHarness();
  Object.defineProperty(h.window, "localStorage", { get() { throw new Error("Blocked"); } });
  Object.defineProperty(h.window, "sessionStorage", { get() { throw new Error("Blocked"); } });
  expect(() => h.guard.rememberKidsSession!(true)).not.toThrow();
  expect(() => h.guard.restoreKidsSession!()).not.toThrow();
  expect((h.guard.useKidsSession as unknown as {getState(): {parentRequired: boolean}}).getState().parentRequired).toBe(true);
});

test("Kids entry and the locked chooser retain the guard; adult activation releases it", () => {
  const h = guardHarness();
  const store = { setTheme() {}, setChannel() {}, closeGuide() {}, setSettingsOpen() {}, setPlayerViewMode() {}, channels: [] };
  const device = serverModule("lib/deviceProfiles.ts", {
    zustand: { create }, "./kidsSession": h.guard,
    "./profiles": profiles, "./themes": themes, "./themePreferences": themePreferences,
    "./libraryCatalog": { PROGRESS_STORAGE_KEY: "test-progress" },
    "./accountStore": { useAccount: { getState: () => ({ ...model.EMPTY_ACCOUNT, user: { id: "parent" } }) } },
    "./deviceLibrary": { useDeviceLibrary: { getState: () => ({ selectProfile() {} }) } },
    "./store": { useStore: { getState: () => store } },
  }, {}, { window: h.window, localStorage: h.window.localStorage, sessionStorage: h.window.sessionStorage });
  const restricted = () => (h.guard.useKidsSession as unknown as {getState(): {parentRequired: boolean}}).getState().parentRequired;
  device.initializeProfiles!({
    profiles: [{ id: "main", name: "Parent", avatar: "sun", kids: false }, { id: "kids", name: "Kids", avatar: "sun", kids: true }],
    pin: { salt: "a".repeat(32), hash: "b".repeat(64) }, failures: 0, lockedUntil: 0,
  });
  expect(restricted()).toBe(true);
  // ProfilePicker performs PIN verification before calling adult activation.
  device.activateProfile!("main");
  expect(restricted()).toBe(false);
  device.lockProfiles!();
  expect(restricted()).toBe(true);
  device.activateProfile!("kids");
  expect(restricted()).toBe(true);
});
