"use client";

import { useId } from "react";
import { useStore } from "@/lib/store";
import HauntedArcadeScene from "@/components/HauntedArcadeScene";

/** Decorative, bounded scenery: never overlays playback or intercepts a remote. */
export default function HalloweenScene({ entrance = false }: { entrance?: boolean }) {
  const theme = useStore((state) => state.themeId);
  const id = useId().replace(/:/g, "");
  if (theme === "halloween-haunted-arcade") {
    return <HauntedArcadeScene entrance={entrance} />;
  }
  if (theme !== "halloween-night") return null;

  return (
    <aside className="ttv-halloween-scene" data-entrance={entrance} data-variant="moonlit" aria-label="Halloween on Tate’s TV">
      <svg className="ttv-halloween-pumpkins" viewBox="0 0 220 160" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={`${id}-pumpkin`} cx="35%" cy="25%" r="80%">
            <stop stopColor="#ffbc62" /><stop offset=".55" stopColor="#ed781e" /><stop offset="1" stopColor="#8c3516" />
          </radialGradient>
          <radialGradient id={`${id}-light`}>
            <stop stopColor="#ffb356" stopOpacity=".3" /><stop offset="1" stopColor="#ffb356" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="111" cy="126" rx="105" ry="30" fill={`url(#${id}-light)`} />
        <g transform="translate(14 47) rotate(-9 50 55)">
          <path d="M49 18q-8-17 4-24l7 4q-12 8-3 21" fill="#6d8150" />
          <path d="M53 23C1 2-6 87 31 94q24 9 49-4c31-18 16-85-27-67Z" fill={`url(#${id}-pumpkin)`} />
          <path d="M43 24Q15 61 42 94m17-72q26 45 3 73" fill="none" stroke="#9a411a" strokeWidth="3" opacity=".55" />
          <g className="ttv-halloween-lantern" fill="#ffefaf">
            <path d="m24 54 18-4-7-13Zm38-5 16 7-9-19ZM47 62l6-9 7 9Z" />
            <path d="M25 70q26 10 52 0-7 23-27 19-17-2-25-19Z" />
          </g>
          <path d="m39 72 3 9 9-1-1-6m10 2-1 8 8-4 1-7" fill="#a3481b" />
        </g>
        <g transform="translate(92 24) rotate(6 53 65)">
          <path d="M49 28q10-14 2-24l9-2q12 15-1 29" fill="#748951" />
          <path d="M55 31C-4 6-10 109 34 117q22 8 48-3c37-18 19-106-27-83Z" fill={`url(#${id}-pumpkin)`} />
          <path d="M45 32Q17 78 43 118m20-86q28 45 1 86" fill="none" stroke="#9a411a" strokeWidth="3" opacity=".55" />
          <g className="ttv-halloween-lantern" fill="#ffefaf">
            <path d="m21 68 22-5-9-15Zm45-4 19 7-7-21ZM49 80l7-10 8 11Z" />
            <path d="M23 88q34 12 65 0-13 28-35 23-18-2-30-23Z" />
          </g>
          <path d="m36 91 5 10 9 1-2-9m16 1-1 10 8-3 2-9" fill="#a3481b" />
        </g>
        <path d="m14 137 12-10 1 10 12 5-14 3-4 10-3-12-11-3Zm183-93 7 3 10-5-4 9 5 8-10-2-7 8 1-11-8-5Z" fill="#c6834c" opacity=".75" />
      </svg>
      <div className="ttv-halloween-copy">
        <span className="ttv-halloween-eyebrow">Halloween on Tate’s TV</span>
        <p>{entrance ? "A little magic. A lot of TV." : "Your moonlit movie night."}</p>
      </div>
      <svg className="ttv-halloween-sky" viewBox="0 0 270 160" aria-hidden="true" focusable="false">
        <circle cx="194" cy="70" r="64" fill="#c4a0ff" opacity=".07" />
        <circle cx="194" cy="70" r="51" fill="#c4a0ff" opacity=".1" />
        <circle cx="194" cy="70" r="41" fill="#ffe0a4" />
        <g fill="#dfb777" opacity=".35"><circle cx="207" cy="47" r="8" /><circle cx="178" cy="78" r="12" /><circle cx="211" cy="84" r="6" /></g>
        <g className="ttv-halloween-witch" fill="#1c1224">
          <path d="m128 101 102-18" stroke="#8a593c" strokeWidth="4" strokeLinecap="round" />
          <path d="m223 77 30-10-5 8 11-1-8 8 8 5-31 2Z" fill="#cc8e48" />
          <path d="m168 65-15 27 33 5-10-25Z" />
          <path d="m160 72-16 6-6 13 7 2 6-10 17-5m5 11 10 10 16-1 1 6-21 2-15-12" />
          <circle cx="169" cy="58" r="10" />
          <path d="m158 51 7-23 10 9 2 16 13 7-42-4Z" />
          <path d="m157 56-9 12 16-5m13-5 9 4-9 4m-9 1-28 8 15 13 10-17" />
          <path d="m162 46 13 2" stroke="#ab78ce" strokeWidth="4" />
        </g>
        <g className="ttv-halloween-bats" fill="#b893da">
          <path d="M43 49q-7-14-20-16l5 14 9-1 5 10 5-9 10 3 6-13q-14 1-20 12Z" />
          <path d="M91 104q-4-10-15-11l3 10 7-1 5 7 4-6 8 2 4-10q-11 1-16 9Z" />
        </g>
        <g fill="#ffd99e"><path d="m107 20 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm140 92 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" /><circle cx="69" cy="24" r="1.5" /><circle cx="126" cy="131" r="2" /><circle cx="242" cy="29" r="1.5" /></g>
      </svg>
    </aside>
  );
}
