"use client";

import Image from "next/image";
import { useState } from "react";
import { getChannelCallsign, getChannelLogoUrl } from "@/lib/viewer";
import type { Channel } from "@/lib/types";

/** Remote station art keeps its original URL; a failed image falls back to its callsign. */
export default function ChannelLogo({ channel, className, eager = false }: {
  channel: Channel | undefined;
  className: string;
  eager?: boolean;
}) {
  const src = getChannelLogoUrl(channel);
  const [failedSrc, setFailedSrc] = useState<string>();
  return (
    <span className={className} aria-hidden="true">
      {src && failedSrc !== src ? (
        <Image src={src} alt="" width={160} height={100} unoptimized
          loading={eager ? "eager" : "lazy"}
          onError={() => setFailedSrc(src)} />
      ) : <span>{getChannelCallsign(channel).slice(0, 12)}</span>}
    </span>
  );
}
