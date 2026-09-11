"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";

export default function ProgrammeArtwork({
  src,
  title,
  kind = "Tate's TV",
}: {
  src?: string;
  title: string;
  kind?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const hue = Array.from(title).reduce(
    (sum, char) => (sum * 31 + char.charCodeAt(0)) % 360,
    0,
  );
  return (
    <div
      className="ttv-programme-art"
      style={{ "--art-hue": hue } as CSSProperties}
    >
      {src && src !== failedSource ? (
        <Image
          unoptimized
          src={src}
          alt=""
          width={640}
          height={360}
          loading="lazy"
          onError={() => setFailedSource(src)}
        />
      ) : (
        <div className="ttv-programme-art__type" aria-hidden="true">
          <span>{kind}</span>
          <strong>{title}</strong>
          <small>TATE&apos;S TV</small>
        </div>
      )}
    </div>
  );
}
