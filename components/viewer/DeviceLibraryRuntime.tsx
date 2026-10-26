"use client";
import { useEffect } from "react";
import { DEVICE_LIBRARY_KEY, useDeviceLibrary } from "@/lib/deviceLibrary";
import { PROFILE_STORAGE_KEY, refreshProfiles } from "@/lib/deviceProfiles";
import { useAccount } from "@/lib/accountStore";
import { startAccount, refreshAccount, watchAccountChanges } from "@/lib/accountSync";
export default function DeviceLibraryRuntime() {
  useEffect(() => {
    let disposed = false;
    let stop = () => {};
    void startAccount().then(() => { if (!disposed) stop = watchAccountChanges(); });
    const refresh = () => {
      if (document.visibilityState === "visible") void refreshAccount().catch(() => {
        useAccount.setState({ error: "Account connection interrupted. Your current viewing session can continue." });
      });
    };
    const sync = (event: StorageEvent) => {
      if (event.key === "ttv-account-change") { window.location.reload(); return; }
      if (useAccount.getState().user) return;
      if (event.key === PROFILE_STORAGE_KEY || event.key === null) refreshProfiles();
      if (event.key === DEVICE_LIBRARY_KEY || event.key === null) void useDeviceLibrary.persist.rehydrate();
    };
    const interval = setInterval(refresh, 300_000);
    window.addEventListener("storage", sync);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true; stop(); clearInterval(interval);
      window.removeEventListener("storage", sync);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return null;
}
