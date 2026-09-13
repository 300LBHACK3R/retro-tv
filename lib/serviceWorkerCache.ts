export const CACHE_SCHEMA_VERSION = "20260909-premium-viewer-v3";
export const CACHE_SCHEMA_STORAGE_KEY = "ttv-cache-schema-version";

type CacheMigrationEnvironment = {
  storage: Pick<Storage, "getItem" | "setItem">;
  serviceWorker: Pick<
    ServiceWorkerContainer,
    "controller" | "getRegistrations"
  >;
  cacheStorage?: Pick<CacheStorage, "keys" | "delete">;
};

/** Return true only when an existing worker still controls this document. */
export async function migrateProductionCache({
  storage,
  serviceWorker,
  cacheStorage,
}: CacheMigrationEnvironment): Promise<boolean> {
  try {
    if (storage.getItem(CACHE_SCHEMA_STORAGE_KEY) === CACHE_SCHEMA_VERSION)
      return false;

    // Unregistering does not detach a controller from an already open document.
    // A fresh visitor has no controller and must not lose input to a reload.
    const needsReload = serviceWorker.controller !== null;
    const registrations = await serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map((registration) => registration.unregister()),
    );
    if (cacheStorage) {
      const keys = await cacheStorage.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("tates-tv-"))
          .map((key) => cacheStorage.delete(key)),
      );
    }
    storage.setItem(CACHE_SCHEMA_STORAGE_KEY, CACHE_SCHEMA_VERSION);
    return needsReload;
  } catch {
    // An unavailable storage/cache API must not interrupt viewing.
    return false;
  }
}
