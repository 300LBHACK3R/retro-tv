"use client";

import { useEffect } from "react";
import { DEVICE_LIBRARY_KEY, useDeviceLibrary } from "@/lib/deviceLibrary";

export default function DeviceLibraryRuntime() {
  useEffect(() => {
    void useDeviceLibrary.persist.rehydrate();
    const sync = (event: StorageEvent) => {
      if (event.key === DEVICE_LIBRARY_KEY || event.key === null)
        void useDeviceLibrary.persist.rehydrate();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return null;
}
