"use client";

import { getImageProps } from "next/image";
import desktopWorld from "@/public/themes/christmas-neon-noel-world.webp";
import mobileWorld from "@/public/themes/christmas-neon-noel-mobile.webp";

const common = { alt: "", loading: "eager" as const, unoptimized: true };
const { props: desktop } = getImageProps({ ...common, src: desktopWorld });
const { props: mobile } = getImageProps({ ...common, src: mobileWorld });

/** One responsive image, with decorative motion behind the viewer controls. */
export default function NeonNoelScene() {
  return (
    <div className="ttv-seasonal-world ttv-noel-world" aria-hidden="true">
      <picture>
        <source media="(orientation: portrait)" srcSet={mobile.src} />
        <img {...desktop} alt="" className="ttv-noel-art" />
      </picture>
      <div className="ttv-noel-scrim" />
      <div className="ttv-noel-aurora" />
      <div className="ttv-noel-snow"><i /><i /><i /><i /><i /><i /><i /><i /></div>
    </div>
  );
}
