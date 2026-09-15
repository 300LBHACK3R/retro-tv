"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { nativeTvKind, promptNativeTv, type NativeTvKind, type NativeTvVideo } from "@/lib/tvPlayback";

export function useNativeTvPlayback(videoRef: RefObject<HTMLVideoElement | null>, sourceKey: string) {
  const [kind, setKind] = useState<NativeTvKind>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const video = videoRef.current as NativeTvVideo | null;
    setKind(nativeTvKind(video));
    if (!video) { setConnected(false); return; }
    const update = () => setConnected(
      Boolean(video.webkitCurrentPlaybackTargetIsWireless) || video.remote?.state === "connected",
    );
    update();
    video.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", update);
    video.remote?.addEventListener("connect", update);
    video.remote?.addEventListener("disconnect", update);
    return () => {
      video.removeEventListener("webkitcurrentplaybacktargetiswirelesschanged", update);
      video.remote?.removeEventListener("connect", update);
      video.remote?.removeEventListener("disconnect", update);
    };
  }, [videoRef, sourceKey]);

  const request = useCallback(() => promptNativeTv(videoRef.current as NativeTvVideo | null), [videoRef]);
  return { kind, connected, request };
}
