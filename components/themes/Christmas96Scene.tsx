"use client";

import { getImageProps } from "next/image";
import desktopWorld from "@/public/themes/christmas-96-world.webp";
import mobileWorld from "@/public/themes/christmas-96-mobile.webp";

// These WebP assets are already encoded for delivery. Avoid another lossy pass
// through the image optimizer on the fine wallpaper, tinsel and game cases.
const common = { alt: "", loading: "eager" as const, unoptimized: true };
const { props: desktop } = getImageProps({ ...common, src: desktopWorld });
const { props: mobile } = getImageProps({ ...common, src: mobileWorld });

/** Scenery stays behind the app; shared seasonal rules pause or disable motion. */
export default function Christmas96Scene() {
  return (
    <div className="ttv-seasonal-world ttv-christmas96-world" aria-hidden="true">
      <picture>
        <source media="(orientation: portrait)" srcSet={mobile.src} />
        {/* A portrait composition keeps the room visible on phones and tablets. */}
        <img {...desktop} alt="" className="ttv-christmas96-art" />
      </picture>
      <div className="ttv-christmas96-scrim" />
      <div className="ttv-christmas96-tree-glow" />
      <div className="ttv-christmas96-tv-glow" />
      <div className="ttv-christmas96-lights"><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="ttv-christmas96-snow"><i /><i /><i /><i /><i /><i /></div>
    </div>
  );
}
