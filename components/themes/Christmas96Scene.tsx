"use client";

import { getImageProps } from "next/image";
import desktopWorld from "@/public/themes/christmas-96-world.webp";
import mobileWorld from "@/public/themes/christmas-96-mobile.webp";

const common = { alt: "", sizes: "100vw", loading: "eager" as const };
const { props: desktop } = getImageProps({ ...common, src: desktopWorld });
const { props: mobile } = getImageProps({ ...common, src: mobileWorld });

/** Scenery stays behind the app; shared seasonal rules pause or disable motion. */
export default function Christmas96Scene() {
  return (
    <div className="ttv-seasonal-world ttv-christmas96-world" aria-hidden="true">
      <picture>
        <source media="(max-width: 760px) and (orientation: portrait)" srcSet={mobile.srcSet} sizes={mobile.sizes} />
        {/* Art-directed Next.js sources keep the Christmas details visible on phones. */}
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
