"use client";

import { getImageProps } from "next/image";
import desktopWorld from "@/public/themes/halloween-after-dark-world.webp";
import mobileWorld from "@/public/themes/halloween-after-dark-mobile.webp";

const common = { alt: "", sizes: "100vw", loading: "eager" as const };
const { props: desktop } = getImageProps({ ...common, src: desktopWorld });
const { props: mobile } = getImageProps({ ...common, src: mobileWorld });

/** One decorative world behind every route. Never part of the player or focus order. */
export default function HalloweenAfterDark() {
  return (
    <div className="ttv-afterdark-world" aria-hidden="true">
      <picture>
        <source media="(max-width: 760px) and (orientation: portrait)" srcSet={mobile.srcSet} sizes={mobile.sizes} />
        {/* getImageProps supplies optimized responsive sources for the picture element. */}
        <img {...desktop} alt="" className="ttv-afterdark-art" />
      </picture>
      <div className="ttv-afterdark-scrim" />
      <div className="ttv-afterdark-moonlight" />
      <div className="ttv-afterdark-lanterns" />
      <div className="ttv-afterdark-fog" />
      <div className="ttv-afterdark-fog ttv-afterdark-fog-far" />
      <div className="ttv-afterdark-witch"><svg viewBox="0 0 160 90" focusable="false">
        <g fill="currentColor">
          <path d="m13 68 125-17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          <path d="m126 46 27-9-4 9 9-1-8 8 7 7-28-2ZM66 37 47 65l39-2-8-22ZM58 39 39 48l-7 15 7 2 7-12 20-7m8 8 14 13 17-1 1 6-22 2-17-13" />
          <circle cx="71" cy="29" r="10" />
          <path d="m59 24 7-23 12 8 1 17 15 6-45-3Zm0 5-13 14 18-7m17-5 8 4-9 3M63 35 32 42l20 12 9-13Z" />
        </g>
      </svg></div>
      <div className="ttv-afterdark-bats"><svg viewBox="0 0 150 100" focusable="false" fill="currentColor">
        <path d="M30 30Q20 8 1 6l9 19 10-2 9 15 9-13 14 3 10-21Q42 10 30 30Zm77 39Q99 54 86 53l5 14 10-1 6 10 6-9 10 2 7-15q-14 2-23 15Z" />
      </svg></div>
      <svg className="ttv-afterdark-skeleton" viewBox="0 0 120 240" focusable="false">
        <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
          <path fill="currentColor" stroke="none" d="M43 32c0-21 35-23 36 0l-4 13v12H48V45Z" />
          <g fill="#281a30" stroke="none"><ellipse cx="52" cy="32" rx="5" ry="6" /><ellipse cx="69" cy="32" rx="5" ry="6" /><path d="m60 36-4 8h8Z" /></g>
          <path d="M53 48v9m8-9v9m8-9v9" stroke="#281a30" strokeWidth="2" />
          <path d="M61 59v66m-3-59L40 74l3 37 17 6m5-51 19 8-4 37-16 6M43 81l17 7 21-7m-38 12 17 7 20-7m-36 12 16 6 20-6M40 75 25 104l7 26m23-5-10 10 10 13h15l9-13-12-10Z" />
          <path d="m53 148-9 37 6 40-12 6m29-83 10 37-4 40 12 6" />
          <g className="ttv-afterdark-skeleton-wave">
            <path d="m84 75 18 16 7-30m0-2-7-9m8 7-1-13m5 15 3-12m-2 17 8-6" />
          </g>
        </g>
      </svg>
      <div className="ttv-afterdark-embers"><i /><i /><i /><i /><i /><i /></div>
    </div>
  );
}
