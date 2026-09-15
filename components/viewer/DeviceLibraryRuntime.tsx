"use client";
import { useEffect } from "react";
import { DEVICE_LIBRARY_KEY, useDeviceLibrary } from "@/lib/deviceLibrary";
import {
  initializeProfiles,
  PROFILE_STORAGE_KEY,
  refreshProfiles,
} from "@/lib/deviceProfiles";
export default function DeviceLibraryRuntime() {
  useEffect(() => {
    void useDeviceLibrary.persist.rehydrate();
    initializeProfiles();
    const sync = (event: StorageEvent) => {
      if (event.key === PROFILE_STORAGE_KEY || event.key === null)
        refreshProfiles();
      if (event.key === DEVICE_LIBRARY_KEY || event.key === null)
        void useDeviceLibrary.persist.rehydrate();
    };
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
    };
  }, []);
  return null;
}
