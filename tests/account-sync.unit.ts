import { test, expect } from "@playwright/test";
import { serverModule } from "./server-harness";
import * as model from "../lib/accountModel";
import * as profiles from "../lib/profiles";
import { createStore } from "zustand/vanilla";

test("an auth outage clears private profiles for isolated guest viewing", async () => {
  let account = { ...model.EMPTY_ACCOUNT, ready: false, error: "" };
  let local = { profiles: profiles.defaults, pin: null, activeId: "main" as string | null, ready: false };
  let initialized = false;
  const sync = serverModule("lib/accountSync.ts", {
    "./profiles": profiles,
    "./accountModel": model,
    "./accountStore": {
      useAccount: { getState: () => account, setState: (patch: Partial<typeof account>) => { account = { ...account, ...patch }; } },
    },
    "./deviceProfiles": {
      useProfiles: { getState: () => local, setState: (patch: Partial<typeof local>) => { local = { ...local, ...patch }; } },
      lockProfiles: () => { local.activeId = null; },
      initializeProfiles: () => { initialized = true; },
    },
    "./deviceLibrary": { useDeviceLibrary: { setState: () => {} } },
    "./themePreferences": {}, "./themes": {},
  }, {}, { fetch: async () => { throw new Error("Offline"); }, clearTimeout, setTimeout });
  await sync.startAccount!();
  expect(account.user).toBeNull();
  expect(account.ready).toBe(true);
  expect(account.error).toContain("sign in");
  expect(local.activeId).toBeNull();
  expect(local.profiles).toEqual([]);
  expect(initialized).toBe(false);
});

test("overlapping save callers serialize edits and never submit the same revision twice", async () => {
  let account = { ...model.EMPTY_ACCOUNT, user: { id: "alice", email: "alice@example.test" }, saving: false, syncError: "", showMemberBadge: false };
  const local = { profiles: profiles.defaults, pin: null };
  let finishFirst!: (value: { revision: number }) => void;
  const firstResponse = new Promise<{ revision: number }>(resolve => { finishFirst = resolve; });
  const writes: { revision: number; household: model.Household }[] = [];
  const sync = serverModule("lib/accountSync.ts", {
    "./profiles": profiles,
    "./accountModel": model,
    "./accountStore": {
      useAccount: { getState: () => account, setState: (patch: Partial<typeof account>) => { account = { ...account, ...patch }; } },
      accountRequest: async (_path: string, body: typeof writes[number]) => {
        writes.push(body);
        return writes.length === 1 ? firstResponse : { revision: body.revision + 1 };
      },
    },
    "./deviceProfiles": { useProfiles: { getState: () => local } },
    "./deviceLibrary": { useDeviceLibrary: { getState: () => ({ profiles: {} }) } },
    "./themePreferences": {},
    "./themes": {},
  }, {}, { clearTimeout, setTimeout });
  const first = sync.flushAccountChanges!();
  account.showMemberBadge = true;
  const second = sync.flushAccountChanges!();
  const third = sync.flushAccountChanges!();
  finishFirst({ revision: 1 });
  await Promise.all([first, second, third]);
  expect(writes.map(write => write.revision)).toEqual([0, 1]);
  expect(writes[1]!.household.showMemberBadge).toBe(true);
  expect(account.revision).toBe(2);
  expect(account.saving).toBe(false);
});

function syncHarness(storageFallback = false) {
  let server: model.AccountView = {
    ...structuredClone(model.EMPTY_ACCOUNT), enabled: true,
    user: { id: "alice", email: "alice@example.test" },
    household: { profiles: structuredClone(profiles.defaults), pin: null, library: {}, showMemberBadge: false },
  };
  const account = createStore(() => ({ ...server, ready: false, error: "", syncError: "", saving: false, showMemberBadge: false }));
  const local = createStore(() => ({ profiles: [] as profiles.Profile[], pin: null as profiles.Pin | null, activeId: "main" as string | null, ready: false }));
  const library = createStore(() => ({ profiles: {}, selectProfile: () => {} }));
  const listeners = new Map<string, (event: unknown) => void>();
  const notifications: unknown[] = [];
  let reads = 0;
  const channels: FakeChannel[] = [];
  class FakeChannel {
    onmessage: ((event: { data: unknown }) => void) | null = null;
    closed = false;
    constructor() {
      if (storageFallback) throw new Error("Unavailable");
      channels.push(this);
    }
    postMessage(value: unknown) { notifications.push(value); }
    close() { this.closed = true; }
  }
  const sync = serverModule("lib/accountSync.ts", {
    "./profiles": profiles, "./accountModel": model,
    "./accountStore": {
      useAccount: account,
      accountRequest: async (_path: string, input: { household: model.Household; revision: number }) => {
        if (input.revision !== server.revision) throw new Error("Preference conflict");
        server = { ...server, household: input.household, revision: server.revision + 1 };
        return { revision: server.revision };
      },
    },
    "./deviceProfiles": {
      useProfiles: local,
      lockProfiles: () => local.setState({ activeId: null }),
      initializeProfiles: (value: Pick<model.Household, "profiles" | "pin">) => local.setState({ ...value, ready: true }),
    },
    "./deviceLibrary": { useDeviceLibrary: library },
    "./themePreferences": {}, "./themes": {},
  }, {}, {
    clearTimeout, setTimeout, BroadcastChannel: FakeChannel,
    fetch: async () => { reads++; return Response.json(server); },
    window: {
      addEventListener: (name: string, listener: (event: unknown) => void) => listeners.set(name, listener),
      removeEventListener: (name: string) => listeners.delete(name),
    },
    localStorage: { setItem: (_key: string, value: string) => notifications.push(JSON.parse(value)) },
  });
  return {
    sync, account, local, notifications, listeners,
    get reads() { return reads; },
    get closed() { return channels[0]?.closed; },
    update: (household: model.Household) => { server = { ...server, household, revision: server.revision + 1 }; },
    notify: (data: unknown) => {
      if (storageFallback) listeners.get("storage")?.({ key: "ttv-household-change", newValue: JSON.stringify(data) });
      else channels[0]!.onmessage?.({ data });
    },
  };
}

for (const fallback of [false, true]) {
  test(`cross-tab ${fallback ? "storage" : "broadcast"} hints refresh verified preferences and stop on cleanup`, async () => {
    const h = syncHarness(fallback);
    await h.sync.startAccount!();
    const stop = h.sync.watchAccountChanges!();
    try {
      h.notify({ userId: "someone-else", revision: 99 });
      h.notify({ userId: "alice", revision: 0 });
      expect(h.reads).toBe(1);
      h.update({ ...h.account.getState().household!, profiles: [{ ...profiles.defaults[0]!, theme: "midas-gold" }] });
      h.notify({ userId: "alice", revision: 1, household: { profiles: [] }, member: true });
      await expect.poll(() => h.account.getState().revision).toBe(1);
      expect(h.local.getState().profiles[0]!.theme).toBe("midas-gold");
      expect(h.account.getState().member).toBe(false);
      expect(h.local.getState().activeId).toBe("main");
      h.account.setState({ showMemberBadge: true });
      await h.sync.flushAccountChanges!();
      expect(h.notifications).toEqual([{ userId: "alice", revision: 2 }]);
    } finally { stop(); }
    expect(h.listeners.size).toBe(0);
    if (!fallback) expect(h.closed).toBe(true);
  });
}

test("a remote theme save preserves unsaved local edits and reports a revision conflict", async () => {
  const h = syncHarness();
  await h.sync.startAccount!();
  const stop = h.sync.watchAccountChanges!();
  try {
    h.local.setState({ profiles: [{ ...profiles.defaults[0]!, name: "Local edit" }] });
    h.update({ ...h.account.getState().household!, profiles: [{ ...profiles.defaults[0]!, theme: "midas-gold" }] });
    h.notify({ userId: "alice", revision: 1 });
    await expect.poll(() => h.reads).toBe(2);
    await h.sync.refreshAccount!();
    expect(h.account.getState().revision).toBe(0);
    expect(h.local.getState().profiles[0]!.name).toBe("Local edit");
    await h.sync.flushAccountChanges!();
    expect(h.account.getState().syncError).toBe("Preference conflict");
    expect(h.notifications).toEqual([]);
  } finally { stop(); }
});
