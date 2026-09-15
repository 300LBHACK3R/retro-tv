import type { StateStorage } from "zustand/middleware";

// Storage can exist yet reject writes (quota, privacy settings, embedded views).
// Keep Zustand's in-memory state usable without clearing saved household data.
export const browserStorage: StateStorage = {
  getItem(name) {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem(name, value) {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* Memory-only. */
    }
  },
  removeItem(name) {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* Storage unavailable. */
    }
  },
};
