"use client";

import { getImageProps } from "next/image";
import desktopWorld from "@/public/themes/halloween-90s-world.webp";
import mobileWorld from "@/public/themes/halloween-90s-mobile.webp";

const common = { alt: "", sizes: "100vw", loading: "eager" as const };
const { props: desktop } = getImageProps({ ...common, src: desktopWorld });
const { props: mobile } = getImageProps({ ...common, src: mobileWorld });

/** Background-only atmosphere. Motion follows the shared seasonal accessibility rules. */
export default function Halloween90sScene() {
  return (
    <div className="ttv-seasonal-world ttv-halloween90-world" aria-hidden="true">
      <picture>
        <source media="(max-width: 760px) and (orientation: portrait)" srcSet={mobile.srcSet} sizes={mobile.sizes} />
        {/* Responsive Next.js image sources; the scenery never covers the video. */}
        <img {...desktop} alt="" className="ttv-halloween90-art" />
      </picture>
      <div className="ttv-halloween90-scrim" />
      <div className="ttv-halloween90-lamplight" />
      <div className="ttv-halloween90-screen-glow" />
      <div className="ttv-halloween90-scanlines" />
      <div className="ttv-halloween90-dust"><i /><i /><i /><i /></div>
    </div>
  );
}
