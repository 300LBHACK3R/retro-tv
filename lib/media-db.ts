const DB_NAME = "tates-tv-media-db";
const STORE_NAME = "mediaFiles";
const DB_VERSION = 1;

type MediaDbKey = string;

function assertBrowserIndexedDb(): void {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is only available in the browser.");
  }
}

function openDb(): Promise<IDBDatabase> {
  assertBrowserIndexedDb();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open media database."));
    };

    request.onblocked = () => {
      reject(
        new Error(
          "Media database upgrade was blocked. Close other tabs using Tate's TV and try again.",
        ),
      );
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  const db = await openDb();

  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);

      let requestResult: T | undefined;

      const request = callback(store);

      if (request) {
        request.onsuccess = () => {
          requestResult = request.result;
        };

        request.onerror = () => {
          reject(request.error ?? new Error("Media database request failed."));
        };
      }

      tx.oncomplete = () => {
        resolve(requestResult);
      };

      tx.onerror = () => {
        reject(tx.error ?? new Error("Media database transaction failed."));
      };

      tx.onabort = () => {
        reject(tx.error ?? new Error("Media database transaction aborted."));
      };
    });
  } finally {
    db.close();
  }
}

export async function saveMediaBlob(
  storageKey: MediaDbKey,
  file: Blob,
): Promise<void> {
  if (!storageKey.trim()) {
    throw new Error("A valid storage key is required to save media.");
  }

  if (!(file instanceof Blob)) {
    throw new Error("A valid Blob/File is required to save media.");
  }

  await withStore("readwrite", (store) => {
    store.put(file, storageKey);
  });
}

export async function loadMediaBlob(
  storageKey: MediaDbKey,
): Promise<Blob | null> {
  if (!storageKey.trim()) {
    return null;
  }

  const result = await withStore<Blob | undefined>("readonly", (store) =>
    store.get(storageKey),
  );

  return result instanceof Blob ? result : null;
}

export async function deleteMediaBlob(storageKey: MediaDbKey): Promise<void> {
  if (!storageKey.trim()) {
    return;
  }

  await withStore("readwrite", (store) => {
    store.delete(storageKey);
  });
}

export async function listMediaBlobKeys(): Promise<string[]> {
  const result = await withStore<IDBValidKey[]>("readonly", (store) =>
    store.getAllKeys(),
  );

  return (result ?? []).map(String);
}

export async function clearMediaBlobs(): Promise<void> {
  await withStore("readwrite", (store) => {
    store.clear();
  });
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