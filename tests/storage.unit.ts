import { test, expect } from "@playwright/test";
import { browserStorage } from "../lib/browserStorage";
import { useStore } from "../lib/store";
import { usePlayerControls } from "../lib/playerControls";
import { useDeviceLibrary } from "../lib/deviceLibrary";
import { initializeProfiles, useProfiles } from "../lib/deviceProfiles";

for (const failure of ["quota", "blocked"] as const) {
  test(`profile startup and controls survive ${failure} storage`, async () => {
    const descriptors = Object.fromEntries(
      ["window", "localStorage", "sessionStorage"].map((key) => [
        key,
        Object.getOwnPropertyDescriptor(globalThis, key),
      ]),
    );
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("Full", "QuotaExceededError");
      },
      removeItem: () => {
        throw new DOMException("Blocked", "SecurityError");
      },
    };
    const get = () => {
      if (failure === "blocked")
        throw new DOMException("Blocked", "SecurityError");
      return storage;
    };
    try {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: Object.defineProperty({}, "localStorage", { get }),
      });
      for (const key of ["localStorage", "sessionStorage"])
        Object.defineProperty(globalThis, key, { configurable: true, get });
      useProfiles.setState({
        ready: false,
        activeId: null,
        storageAvailable: true,
      });
      expect(() => initializeProfiles()).not.toThrow();
      expect(useProfiles.getState()).toMatchObject({
        ready: true,
        storageAvailable: false,
      });
      expect(() => useStore.getState().setChannel("1")).not.toThrow();
      expect(() => usePlayerControls.getState().setMuted(true)).not.toThrow();
      expect(usePlayerControls.getState().muted).toBe(true);
      await useDeviceLibrary.persist.rehydrate();
      expect(() =>
        useDeviceLibrary.getState().toggleChannel("storage-test"),
      ).not.toThrow();
      expect(browserStorage.getItem("missing")).toBeNull();
      expect(() => browserStorage.removeItem("missing")).not.toThrow();
    } finally {
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      }
      usePlayerControls.getState().resetPlayerControls();
    }
  });
}
