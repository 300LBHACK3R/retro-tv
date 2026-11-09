import type { ThemeId } from "@/lib/types";
import type { ThemeDefinition } from "@/lib/themes";

export const THEME_COLLECTIONS = [
  { id: "christmas", label: "Christmas", description: "Cosy rooms & neon winter nights", preview: "christmas-96-living-room" },
  { id: "halloween", label: "Halloween", description: "Haunted arcades & nostalgic nights", preview: "halloween-90s-night" },
  { id: "retro-tv", label: "Retro TV", description: "Classic cable & glowing CRTs", preview: "shaw-2006" },
  { id: "gold", label: "Gold", description: "Warm metallics & cinema style", preview: "midas-gold" },
  { id: "arcade-gaming", label: "Arcade & Gaming", description: "Neon arcades & console classics", preview: "neon-arcade-2005" },
  { id: "futuristic", label: "Futuristic", description: "Electric colour & modern controls", preview: "electric-blue-live" },
  { id: "cartoons", label: "Cartoon Classics", description: "Bright Saturday-morning colour", preview: "saturday-morning-max" },
] as const satisfies ReadonlyArray<{ id: string; label: string; description: string; preview: ThemeId }>;

export type ThemeCollectionId = typeof THEME_COLLECTIONS[number]["id"];

export function themeInCollection(theme: ThemeDefinition, collection: ThemeCollectionId): boolean {
  switch (collection) {
    case "christmas": return theme.season === "christmas";
    case "halloween": return theme.season === "halloween";
    case "retro-tv": return theme.category === "classic" || theme.id === "ttv-neon-crt";
    case "gold": return theme.id === "obsidian-gold" || theme.id === "midas-gold";
    case "arcade-gaming": return theme.category === "arcade" || theme.category === "console";
    case "futuristic": return theme.layout === "electric-command";
    case "cartoons": return theme.category === "cartoon";
  }
}
