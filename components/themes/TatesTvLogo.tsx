"use client";

import Image, { type ImageProps } from "next/image";
import { useStore } from "@/lib/store";

type LogoProps = Pick<ImageProps, "width" | "height" | "sizes" | "className" | "priority">;

/** Seasonal wordmark shares the original logo's footprint and accessible name. */
export default function TatesTvLogo({ className, ...props }: LogoProps) {
  const themeId = useStore((state) => state.themeId);

  if (themeId === "christmas-neon-noel") {
    return (
      <span className={`ttv-noel-brand ${className ?? ""}`} role="img" aria-label="Tate's TV">
        <span aria-hidden="true" className="ttv-noel-brand__name">Tate&apos;s <b>TV</b></span>
        <span aria-hidden="true" className="ttv-noel-brand__edition">✦ Neon Noël ✦</span>
      </span>
    );
  }

  if (themeId === "christmas-96-living-room") {
    return (
      <span className={`ttv-christmas96-brand ${className ?? ""}`} role="img" aria-label="Tate's TV">
        <span aria-hidden="true" className="ttv-christmas96-brand__stars">✦ · ✦ · ✦</span>
        <span aria-hidden="true" className="ttv-christmas96-brand__name">Tate&apos;s <b>TV</b></span>
        <span aria-hidden="true" className="ttv-christmas96-brand__edition">Christmas &apos;96</span>
      </span>
    );
  }

  return <Image {...props} className={className} src="/tatestv-logo.png" alt="Tate's TV" draggable={false} />;
}
