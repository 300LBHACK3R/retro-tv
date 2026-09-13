import { expect, test } from "@playwright/test";
import {
  CACHE_SCHEMA_STORAGE_KEY,
  CACHE_SCHEMA_VERSION,
  migrateProductionCache,
} from "../lib/serviceWorkerCache";

function environment(controlled = false, current = false) {
  const data = new Map<string, string>();
  if (current) data.set(CACHE_SCHEMA_STORAGE_KEY, CACHE_SCHEMA_VERSION);
  const removed: string[] = [];
  let unregistered = 0;
  return {
    data,
    removed,
    get unregistered() {
      return unregistered;
    },
    storage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    },
    serviceWorker: {
      controller: controlled ? ({} as ServiceWorker) : null,
      getRegistrations: async () =>
        controlled
          ? [
              {
                unregister: async () => {
                  unregistered += 1;
                  return true;
                },
              } as ServiceWorkerRegistration,
            ]
          : [],
    },
    cacheStorage: {
      keys: async () => ["tates-tv-legacy", "another-app-cache"],
      delete: async (key: string) => {
        removed.push(key);
        return true;
      },
    },
  };
}

test("fresh visitors migrate cache without reloading or losing their inputs", async () => {
  const env = environment();
  expect(await migrateProductionCache(env)).toBe(false);
  expect(env.data.get(CACHE_SCHEMA_STORAGE_KEY)).toBe(CACHE_SCHEMA_VERSION);
  expect(env.removed).toEqual(["tates-tv-legacy"]);
  expect(env.unregistered).toBe(0);
});

test("an old controlling worker is removed and requests a one-time reload", async () => {
  const env = environment(true);
  expect(await migrateProductionCache(env)).toBe(true);
  expect(env.unregistered).toBe(1);
  expect(env.removed).toEqual(["tates-tv-legacy"]);
  expect(await migrateProductionCache(env)).toBe(false);
  expect(env.unregistered).toBe(1);
});

test("current cache schema leaves existing registrations and caches alone", async () => {
  const env = environment(true, true);
  expect(await migrateProductionCache(env)).toBe(false);
  expect(env.unregistered).toBe(0);
  expect(env.removed).toEqual([]);
});

test("unavailable cache storage never forces a reload or records a completed migration", async () => {
  const env = environment(true);
  env.cacheStorage.keys = async () => {
    throw new Error("Storage unavailable");
  };
  expect(await migrateProductionCache(env)).toBe(false);
  expect(env.data.has(CACHE_SCHEMA_STORAGE_KEY)).toBe(false);
});
