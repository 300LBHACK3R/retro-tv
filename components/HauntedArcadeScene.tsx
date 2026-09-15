"use client";

import { getImageProps } from "next/image";
import hauntedWorld from "@/public/themes/haunted-arcade-world.webp";
import hauntedMobile from "@/public/themes/haunted-arcade-mobile.webp";

const common = { alt: "", sizes: "100vw", loading: "eager" as const };
const { props: desktop } = getImageProps({ ...common, src: hauntedWorld });
const { props: mobile } = getImageProps({ ...common, src: hauntedMobile });

function ArcadeGhost({ variant }: { variant: "mint" | "violet" | "amber" }) {
  return (
    <div className={`ttv-haunted-ghost ttv-haunted-ghost--${variant}`}>
      <svg viewBox="0 0 96 112" focusable="false" shapeRendering="crispEdges">
        <path d="M30 24h36v6h12v12h6v54l-12-9-12 9-12-9-12 9-12-9-12 9V42h6V30h12Z" fill="currentColor" />
        <path d="M24 45v34m6-43h12" stroke="#fff" strokeOpacity=".35" strokeWidth="5" />
        <path d="M32 48h8v13h-8Zm24 0h8v13h-8Z" fill="#16202d" />
        <path d="M33 48h3v4h-3Zm24 0h3v4h-3Z" fill="#fff" />
        <path d="M40 70h16v5H40Z" fill="#425267" />
        <path d="M25 65h10v4H25Zm36 0h10v4H61Z" fill="#ef91bc" opacity=".8" />
        {variant === "mint" ? (
          <g fill="#8056bb">
            <path d="M18 48V28h12v-7h36v7h12v20h-6V33H60v-6H36v6H24v15Z" />
            <path d="M13 45h12v25H13Zm58 0h12v25H71Z" />
            <path d="M16 51h5v12h-5Zm58 0h5v12h-5Z" fill="#e6bcff" />
          </g>
        ) : variant === "violet" ? (
          <g>
            <path d="M18 27h61v7H18ZM31 27l11-23 12 5 9 18Z" fill="#252036" />
            <path d="M34 21h26v6H34Z" fill="#f4a854" />
            <path d="M44 21h7v6h-7Z" fill="#e7fbba" />
          </g>
        ) : (
          <g fill="#334932">
            <path d="M45 8h7v17h-7Zm5 0h9v6h-9Z" />
            <path d="M36 19h10v6H36Zm17-3h12v5H53Z" />
          </g>
        )}
      </svg>
    </div>
  );
}

/** The arcade surrounds every route without occupying player or guide space. */
export default function HauntedArcadeScene() {
  return (
    <div className="ttv-seasonal-world ttv-haunted-world" aria-hidden="true">
      <picture>
        <source media="(max-width: 760px) and (orientation: portrait)" srcSet={mobile.srcSet} sizes={mobile.sizes} />
        <img {...desktop} alt="" className="ttv-haunted-backdrop" />
      </picture>
      <div className="ttv-haunted-scrim" />
      <div className="ttv-haunted-moonlight" />
      <div className="ttv-haunted-cabinet-light" />
      <div className="ttv-haunted-mist ttv-haunted-mist--near" />
      <div className="ttv-haunted-mist ttv-haunted-mist--far" />
      <div className="ttv-haunted-embers">
        {[0, 1, 2, 3, 4, 5].map((spark) => <i key={spark} />)}
      </div>
      <ArcadeGhost variant="mint" />
      <ArcadeGhost variant="violet" />
      <ArcadeGhost variant="amber" />
    </div>
  );
}
