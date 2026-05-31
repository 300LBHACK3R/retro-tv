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

function assertBrowserIndexedDb(): void {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }
}

function formatBytes(bytes: number): string {
  const safeBytes = Math.max(0, Math.floor(bytes));

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
    size: file.size,
    type: file.type || "application/octet-stream",
    updatedAt: new Date().toISOString(),
  };
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
      reject(request.error ?? new Error("Failed to open media database."));
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
      let rejected = false;

      const rejectOnce = (error: Error) => {
        if (rejected) return;
        rejected = true;
        reject(error);
      };

      const request = callback(store);

      if (request) {
        request.onsuccess = () => {
          requestResult = request.result;
        };

        request.onerror = () => {
          rejectOnce(
            request.error ?? new Error("Media database request failed."),
          );
        };
      }

      tx.oncomplete = () => {
        if (!rejected) {
          resolve(requestResult);
        }
      };

      tx.onerror = () => {
        rejectOnce(tx.error ?? new Error("Media database transaction failed."));
      };

      tx.onabort = () => {
        rejectOnce(tx.error ?? new Error("Media database transaction aborted."));
      };
    });
  } finally {
    db.close();
  }
}

async function withTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  callback: (stores: Record<string, IDBObjectStore>) => void,
): Promise<T | undefined> {
  const db = await openDb();

  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(storeNames, mode);

      const stores = storeNames.reduce<Record<string, IDBObjectStore>>(
        (acc, storeName) => {
          acc[storeName] = tx.objectStore(storeName);
          return acc;
        },
        {},
      );

      let rejected = false;

      const rejectOnce = (error: Error) => {
        if (rejected) return;
        rejected = true;
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
        if (!rejected) {
          resolve(undefined);
        }
      };

      tx.onerror = () => {
        rejectOnce(tx.error ?? new Error("Media database transaction failed."));
      };

      tx.onabort = () => {
        rejectOnce(tx.error ?? new Error("Media database transaction aborted."));
      };
    });
  } finally {
    db.close();
  }
}

function assertValidStorageKey(storageKey: MediaDbKey): string {
  const cleanKey = storageKey.trim();

  if (!cleanKey) {
    throw new Error("A valid storage key is required.");
  }

  return cleanKey;
}

export async function saveMediaBlob(
  storageKey: MediaDbKey,
  file: Blob,
): Promise<void> {
  const cleanKey = assertValidStorageKey(storageKey);

  if (!(file instanceof Blob)) {
    throw new Error("A valid Blob/File is required to save media.");
  }

  await withTransaction(
    [FILE_STORE_NAME, META_STORE_NAME],
    "readwrite",
    (stores) => {
      const fileStore = stores[FILE_STORE_NAME];
      const metaStore = stores[META_STORE_NAME];

      if (!fileStore || !metaStore) {
        throw new Error("Media database stores are unavailable.");
      }

      fileStore.put(file, cleanKey);
      metaStore.put(createMediaMeta(cleanKey, file));
    },
  );
}

export async function loadMediaBlob(
  storageKey: MediaDbKey,
): Promise<Blob | null> {
  const cleanKey = storageKey.trim();

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

export async function getMediaBlobMeta(
  storageKey: MediaDbKey,
): Promise<StoredMediaMeta | null> {
  const cleanKey = storageKey.trim();

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
  const cleanKey = storageKey.trim();

  if (!cleanKey) {
    return;
  }

  await withTransaction(
    [FILE_STORE_NAME, META_STORE_NAME],
    "readwrite",
    (stores) => {
      const fileStore = stores[FILE_STORE_NAME];
      const metaStore = stores[META_STORE_NAME];

      if (!fileStore || !metaStore) {
        throw new Error("Media database stores are unavailable.");
      }

      fileStore.delete(cleanKey);
      metaStore.delete(cleanKey);
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
      const fileStore = stores[FILE_STORE_NAME];
      const metaStore = stores[META_STORE_NAME];

      if (!fileStore || !metaStore) {
        throw new Error("Media database stores are unavailable.");
      }

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

  const estimate = await navigator.storage.estimate();
  const usage = Math.max(0, Math.floor(estimate.usage ?? 0));
  const quota = Math.max(0, Math.floor(estimate.quota ?? 0));

  return {
    usage,
    quota,
    usageLabel: formatBytes(usage),
    quotaLabel: quota > 0 ? formatBytes(quota) : "Unknown",
    percentUsed: quota > 0 ? Math.round((usage / quota) * 100) : 0,
  };
}