"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const BrowsePlaybackContext = createContext<{ onDemandActive: boolean; setOnDemandActive: (active: boolean) => void }>({
  onDemandActive: false,
  setOnDemandActive: () => {},
});

export function BrowsePlaybackProvider({ children }: { children: ReactNode }) {
  const [onDemandActive, setOnDemandActive] = useState(false);
  const value = useMemo(() => ({ onDemandActive, setOnDemandActive }), [onDemandActive]);
  return <BrowsePlaybackContext.Provider value={value}>{children}</BrowsePlaybackContext.Provider>;
}

export const useBrowsePlayback = () => useContext(BrowsePlaybackContext);
