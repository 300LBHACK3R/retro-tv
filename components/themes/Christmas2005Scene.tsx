"use client";

import { getImageProps } from "next/image";
import desktopWorld from "@/public/themes/christmas-2005-world.webp";
import mobileWorld from "@/public/themes/christmas-2005-mobile.webp";

const common = { alt: "", loading: "eager" as const, unoptimized: true };
const { props: desktop } = getImageProps({ ...common, src: desktopWorld });
const { props: mobile } = getImageProps({ ...common, src: mobileWorld });

export default function Christmas2005Scene() {
  return <div className="ttv-seasonal-world ttv-christmas2005-world" aria-hidden="true">
    <picture>
      <source media="(orientation: portrait)" srcSet={mobile.src} />
      <img {...desktop} alt="" className="ttv-christmas2005-art" />
    </picture>
    <div className="ttv-christmas2005-scrim" />
    <div className="ttv-christmas2005-glow" />
    <div className="ttv-christmas2005-snow">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ left: `${(index * 37 + 9) % 100}%`, animationDelay: `${-index * 3.7}s`, animationDuration: `${18 + index % 7}s` }} />)}</div>
  </div>;
}
