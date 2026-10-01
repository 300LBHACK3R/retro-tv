import type { StaticImageData } from "next/image";
import type { ThemeId } from "@/lib/types";
import halloween95 from "@/public/themes/halloween-90s-world.webp";
import afterDark from "@/public/themes/halloween-after-dark-world.webp";
import hauntedArcade from "@/public/themes/haunted-arcade-world.webp";
import neonCrt from "@/public/themes/previews/ttv-neon-crt.webp";
import classicCable from "@/public/themes/previews/shaw-2006.webp";
import brightCable from "@/public/themes/previews/telus-2008-inspired.webp";
import obsidian from "@/public/themes/previews/obsidian-gold.webp";
import midas from "@/public/themes/previews/midas-gold.webp";
import consoleGreen from "@/public/themes/previews/halo-2008-inspired.webp";
import neonArcade from "@/public/themes/previews/neon-arcade-2005.webp";
import saturdayMax from "@/public/themes/previews/saturday-morning-max.webp";
import electricBlue from "@/public/themes/previews/electric-blue-live.webp";

// Seasonal scenery and screenshots of the real guide with sample programming.
// A complete map makes a missing preview a type error when adding a new theme.
export const THEME_PREVIEWS = {
  "halloween-90s-night": { image: halloween95, className: "ttv-halloween90-preview-art" },
  "halloween-night": { image: afterDark, className: "ttv-afterdark-preview-art" },
  "halloween-haunted-arcade": { image: hauntedArcade, className: "ttv-haunted-preview-art" },
  "ttv-neon-crt": { image: neonCrt },
  "shaw-2006": { image: classicCable },
  "telus-2008-inspired": { image: brightCable },
  "obsidian-gold": { image: obsidian },
  "midas-gold": { image: midas },
  "halo-2008-inspired": { image: consoleGreen },
  "neon-arcade-2005": { image: neonArcade },
  "saturday-morning-max": { image: saturdayMax },
  "electric-blue-live": { image: electricBlue },
} satisfies Record<ThemeId, { image: StaticImageData; className?: string }>;
