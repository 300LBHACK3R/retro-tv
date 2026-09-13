"use client";
import { useEffect } from "react";
import { DEVICE_LIBRARY_KEY, useDeviceLibrary } from "@/lib/deviceLibrary";
import {
  initializeProfiles,
  PROFILE_STORAGE_KEY,
  refreshProfiles,
  saveProfile,
  useProfiles,
} from "@/lib/deviceProfiles";
import { useStore } from "@/lib/store";
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
    const unsubscribe = useStore.subscribe((state, previous) => {
      if (state.themeId === previous.themeId) return;
      const profile = useProfiles
        .getState()
        .profiles.find((item) => item.id === useProfiles.getState().activeId);
      if (profile) saveProfile({ ...profile, theme: state.themeId });
    });
    return () => {
      window.removeEventListener("storage", sync);
      unsubscribe();
    };
  }, []);
  return null;
}
