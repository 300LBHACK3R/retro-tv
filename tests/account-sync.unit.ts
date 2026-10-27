import { test, expect } from "@playwright/test";
import { serverModule } from "./server-harness";
import * as model from "../lib/accountModel";
import * as profiles from "../lib/profiles";

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
