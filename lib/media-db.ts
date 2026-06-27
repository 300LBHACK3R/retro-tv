const DB_NAME = "tates-tv-media-db";
const FILE_STORE_NAME = "mediaFiles";
const META_STORE_NAME = "mediaFileMeta";
const DB_VERSION = 2;

type MediaDbKey = string;

export type StoredMediaMeta = {
  storageKey: string;
  size: number;
  type: string;
  updatedAt: string;
};

export type MediaStorageEstimate = {
  usage: number;
  quota: number;
  usageLabel: string;
  quotaLabel: string;
  percentUsed: number;
};

export type MediaStorageSummary = MediaStorageEstimate & {
  storedFileCount: number;
  storedFileBytes: number;
  storedFileBytesLabel: string;
  persistent: boolean | null;
  quotaRisk: "unknown" | "safe" | "warning" | "critical";
};

const STORAGE_WARNING_PERCENT = 75;
const STORAGE_CRITICAL_PERCENT = 90;

function assertBrowserIndexedDb(): void {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }
}

function formatBytes(bytes: number): string {
  const safeBytes = Math.max(0, Math.floor(Number(bytes) || 0));

  if (safeBytes < 1024) return `${safeBytes} B`;

  const kb = safeBytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;

  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;

  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

function createMediaMeta(storageKey: string, file: Blob): StoredMediaMeta {
  return {
    storageKey,
    size: Math.max(0, Math.floor(file.size)),
    type: file.type || "application/octet-stream",
    updatedAt: new Date().toISOString(),
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.message) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return "";
}

function createDbError(message: string, error?: unknown): Error {
  const details = getErrorMessage(error);

  if (details) {
    return new Error(`${message} ${details}`);
  }

  return new Error(message);
}

function assertValidStorageKey(storageKey: MediaDbKey): string {
  const cleanKey = String(storageKey ?? "").trim();

  if (!cleanKey) {
    throw new Error("A valid storage key is required.");
  }

  return cleanKey;
}

function assertValidBlob(file: Blob): void {
  if (!(file instanceof Blob)) {
    throw new Error("A valid Blob/File is required to save media.");
  }

  if (file.size <= 0) {
    throw new Error("Cannot save an empty media file.");
  }
}

function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED"
    );
  }

  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("quotaexceedederror") ||
    message.includes("quota exceeded") ||
    message.includes("quota_reached") ||
    message.includes("storage quota")
  );
}

function openDb(): Promise<IDBDatabase> {
  assertBrowserIndexedDb();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
        db.createObjectStore(FILE_STORE_NAME);
      }

      if (!db.objectStoreNames.contains(META_STORE_NAME)) {
        db.createObjectStore(META_STORE_NAME, {
          keyPath: "storageKey",
        });
      }
    };

    request.onsuccess = () => {
      const db = request.result;

      db.onversionchange = () => {
        db.close();
      };

      resolve(db);
    };

    request.onerror = () => {
      reject(createDbError("Failed to open media database.", request.error));
    };

    request.onblocked = () => {
      reject(
        new Error(
          "Media database upgrade was blocked. Close other Tate's TV tabs and try again.",
        ),
      );
    };
  });
}

function readRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(createDbError("Media database request failed.", request.error));
    };
  });
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();

  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);

      let requestResult: T | undefined;
      let settled = false;

      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      try {
        const request = callback(store);

        if (request) {
          request.onsuccess = () => {
            requestResult = request.result;
          };

          request.onerror = () => {
            rejectOnce(
              createDbError("Media database request failed.", request.error),
            );
          };
        }
      } catch (error) {
        rejectOnce(
          error instanceof Error
            ? error
            : new Error("Media database callback failed."),
        );
        return;
      }

      tx.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve(requestResult);
        }
      };

      tx.onerror = () => {
        rejectOnce(
          createDbError("Media database transaction failed.", tx.error),
        );
      };

      tx.onabort = () => {
        rejectOnce(
          createDbError("Media database transaction aborted.", tx.error),
        );
      };
    });
  } finally {
    db.close();
  }
}

async function withTransaction(
  storeNames: string[],
  mode: IDBTransactionMode,
  callback: (stores: Record<string, IDBObjectStore>) => void,
): Promise<void> {
  const db = await openDb();

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);

      const stores = storeNames.reduce<Record<string, IDBObjectStore>>(
        (acc, storeName) => {
          acc[storeName] = tx.objectStore(storeName);
          return acc;
        },
        {},
      );

      let settled = false;

      const rejectOnce = (error: Error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      try {
        callback(stores);
      } catch (error) {
        rejectOnce(
          error instanceof Error
            ? error
            : new Error("Media database transaction callback failed."),
        );
        return;
      }

      tx.oncomplete = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };

      tx.onerror = () => {
        rejectOnce(
          createDbError("Media database transaction failed.", tx.error),
        );
      };

      tx.onabort = () => {
        rejectOnce(
          createDbError("Media database transaction aborted.", tx.error),
        );
      };
    });
  } finally {
    db.close();
  }
}

function getQuotaRisk(
  percentUsed: number,
  quota: number,
): MediaStorageSummary["quotaRisk"] {
  if (quota <= 0) {
    return "unknown";
  }

  if (percentUsed >= STORAGE_CRITICAL_PERCENT) {
    return "critical";
  }

  if (percentUsed >= STORAGE_WARNING_PERCENT) {
    return "warning";
  }

  return "safe";
}

function getStoreOrThrow(
  stores: Record<string, IDBObjectStore>,
  storeName: string,
): IDBObjectStore {
  const store = stores[storeName];

  if (!store) {
    throw new Error(`Media database store is unavailable: ${storeName}.`);
  }

  return store;
}

export async function saveMediaBlob(
  storageKey: MediaDbKey,
  file: Blob,
): Promise<void> {
  const cleanKey = assertValidStorageKey(storageKey);
  assertValidBlob(file);

  try {
    await withTransaction(
      [FILE_STORE_NAME, META_STORE_NAME],
      "readwrite",
      (stores) => {
        const fileStore = getStoreOrThrow(stores, FILE_STORE_NAME);
        const metaStore = getStoreOrThrow(stores, META_STORE_NAME);

        fileStore.put(file, cleanKey);
        metaStore.put(createMediaMeta(cleanKey, file));
      },
    );
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new Error(
        "Browser storage quota is full. Delete local media blobs or use Cloudflare/R2 URLs for large files.",
      );
    }

    throw error;
  }
}

export async function loadMediaBlob(
  storageKey: MediaDbKey,
): Promise<Blob | null> {
  const cleanKey = String(storageKey ?? "").trim();

  if (!cleanKey) {
    return null;
  }

  const result = await withStore<Blob | undefined>(
    FILE_STORE_NAME,
    "readonly",
    (store) => store.get(cleanKey),
  );

  return result instanceof Blob ? result : null;
}

export async function hasMediaBlob(storageKey: MediaDbKey): Promise<boolean> {
  const cleanKey = String(storageKey ?? "").trim();

  if (!cleanKey) {
    return false;
  }

  const result = await withStore<IDBValidKey | undefined>(
    FILE_STORE_NAME,
    "readonly",
    (store) => store.getKey(cleanKey),
  );

  return typeof result !== "undefined";
}

export async function getMediaBlobMeta(
  storageKey: MediaDbKey,
): Promise<StoredMediaMeta | null> {
  const cleanKey = String(storageKey ?? "").trim();

  if (!cleanKey) {
    return null;
  }

  const result = await withStore<StoredMediaMeta | undefined>(
    META_STORE_NAME,
    "readonly",
    (store) => store.get(cleanKey),
  );

  return result?.storageKey ? result : null;
}

export async function listMediaBlobMeta(): Promise<StoredMediaMeta[]> {
  const result = await withStore<StoredMediaMeta[]>(
    META_STORE_NAME,
    "readonly",
    (store) => store.getAll(),
  );

  return result ?? [];
}

export async function deleteMediaBlob(storageKey: MediaDbKey): Promise<void> {
  const cleanKey = String(storageKey ?? "").trim();

  if (!cleanKey) {
    return;
  }

  await withTransaction(
    [FILE_STORE_NAME, META_STORE_NAME],
    "readwrite",
    (stores) => {
      const fileStore = getStoreOrThrow(stores, FILE_STORE_NAME);
      const metaStore = getStoreOrThrow(stores, META_STORE_NAME);

      fileStore.delete(cleanKey);
      metaStore.delete(cleanKey);
    },
  );
}

export async function deleteMediaBlobs(storageKeys: MediaDbKey[]): Promise<void> {
  const cleanKeys = Array.from(
    new Set(storageKeys.map((key) => String(key ?? "").trim()).filter(Boolean)),
  );

  if (cleanKeys.length === 0) {
    return;
  }

  await withTransaction(
    [FILE_STORE_NAME, META_STORE_NAME],
    "readwrite",
    (stores) => {
      const fileStore = getStoreOrThrow(stores, FILE_STORE_NAME);
      const metaStore = getStoreOrThrow(stores, META_STORE_NAME);

      cleanKeys.forEach((key) => {
        fileStore.delete(key);
        metaStore.delete(key);
      });
    },
  );
}

export async function listMediaBlobKeys(): Promise<string[]> {
  const result = await withStore<IDBValidKey[]>(
    FILE_STORE_NAME,
    "readonly",
    (store) => store.getAllKeys(),
  );

  return (result ?? []).map(String);
}

export async function clearMediaBlobs(): Promise<void> {
  await withTransaction(
    [FILE_STORE_NAME, META_STORE_NAME],
    "readwrite",
    (stores) => {
      const fileStore = getStoreOrThrow(stores, FILE_STORE_NAME);
      const metaStore = getStoreOrThrow(stores, META_STORE_NAME);

      fileStore.clear();
      metaStore.clear();
    },
  );
}

export async function blobToObjectUrl(
  storageKey: MediaDbKey,
): Promise<string | null> {
  const blob = await loadMediaBlob(storageKey);

  if (!blob) {
    return null;
  }

  return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url: string | null | undefined): void {
  if (!url || !url.startsWith("blob:")) {
    return;
  }

  URL.revokeObjectURL(url);
}

export function isLocalObjectUrl(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("blob:");
}

export async function getMediaStorageEstimate(): Promise<MediaStorageEstimate> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.estimate !== "function"
  ) {
    return {
      usage: 0,
      quota: 0,
      usageLabel: "Unknown",
      quotaLabel: "Unknown",
      percentUsed: 0,
    };
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = Math.max(0, Math.floor(estimate.usage ?? 0));
    const quota = Math.max(0, Math.floor(estimate.quota ?? 0));
    const percentUsed = quota > 0 ? Math.round((usage / quota) * 100) : 0;

    return {
      usage,
      quota,
      usageLabel: formatBytes(usage),
      quotaLabel: quota > 0 ? formatBytes(quota) : "Unknown",
      percentUsed,
    };
  } catch {
    return {
      usage: 0,
      quota: 0,
      usageLabel: "Unknown",
      quotaLabel: "Unknown",
      percentUsed: 0,
    };
  }
}

export async function getMediaStorageSummary(): Promise<MediaStorageSummary> {
  const [estimate, meta, persistent] = await Promise.all([
    getMediaStorageEstimate(),
    listMediaBlobMeta().catch(() => []),
    isStoragePersisted().catch(() => null),
  ]);

  const storedFileBytes = meta.reduce(
    (sum, item) => sum + Math.max(0, Math.floor(item.size)),
    0,
  );

  return {
    ...estimate,
    storedFileCount: meta.length,
    storedFileBytes,
    storedFileBytesLabel: formatBytes(storedFileBytes),
    persistent,
    quotaRisk: getQuotaRisk(estimate.percentUsed, estimate.quota),
  };
}

export async function isStoragePersisted(): Promise<boolean | null> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.persisted !== "function"
  ) {
    return null;
  }

  return navigator.storage.persisted();
}

export async function requestPersistentStorage(): Promise<boolean | null> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.persist !== "function"
  ) {
    return null;
  }

  return navigator.storage.persist();
}

export function createObjectUrlManager() {
  const urls = new Set<string>();
  let disposed = false;

  return {
    async create(storageKey: MediaDbKey): Promise<string | null> {
      if (disposed) {
        return null;
      }

      const url = await blobToObjectUrl(storageKey);

      if (!url) {
        return null;
      }

      if (disposed) {
        revokeObjectUrl(url);
        return null;
      }

      urls.add(url);

      return url;
    },

    revoke(url: string | null | undefined): void {
      if (!url) {
        return;
      }

      revokeObjectUrl(url);
      urls.delete(url);
    },

    revokeAll(): void {
      urls.forEach((url) => {
        revokeObjectUrl(url);
      });

      urls.clear();
    },

    dispose(): void {
      disposed = true;
      this.revokeAll();
    },

    size(): number {
      return urls.size;
    },
  };
}