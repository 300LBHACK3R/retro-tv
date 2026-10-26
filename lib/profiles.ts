import { isThemeId } from "./themes";
import type { ThemeId } from "./types";

// Preserve Fox, Robot and Cat IDs. Retired Dinosaur profiles migrate to
// Boy dragon, and Space explorer profiles fall back to Boy fox.
export const AVATARS = [
  "sun",
  "girlfox",
  "dadfox",
  "momfox",
  "flower",
  "boycat",
  "bolt",
  "girlrobot",
  "boydragon",
  "girldragon",
  "daddragon",
  "momdragon",
  "malepirate",
  "femalepirate",
  "malemechanic",
  "femalemechanic",
  "maledoctors",
  "femaledoctors",
  "maleserver",
  "femaleserver",
  "jesus",
  "kidsjesus",
] as const;
export type Profile = {
  id: string;
  name: string;
  kids: boolean;
  avatar: (typeof AVATARS)[number];
  theme?: ThemeId;
};
export type Pin = { salt: string; hash: string };
export type ProfileData = {
  profiles: Profile[];
  pin: Pin | null;
  failures: number;
  lockedUntil: number;
};
export const defaults: Profile[] = [
  { id: "main", name: "Main", kids: false, avatar: "sun" },
  { id: "kids", name: "Kids", kids: true, avatar: "boydragon" },
];
export function sanitizeProfiles(value: unknown, limit = 5): Profile[] {
  if (!Array.isArray(value)) return defaults.map((profile) => ({ ...profile }));
  const unique = new Map<string, Profile>();
  for (const entry of value.slice(0, Math.min(10, limit))) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.id !== "string" ||
      !/^[a-z0-9-]{1,60}$/.test(entry.id) ||
      typeof entry.name !== "string"
    )
      continue;
    const name = entry.name.trim().slice(0, 24);
    if (!name) continue;
    unique.set(entry.id, {
      id: entry.id,
      name,
      kids: entry.id === "main" ? false : entry.kids === true,
      avatar:
        entry.avatar === "star"
          ? "boydragon"
          : AVATARS.includes(entry.avatar)
            ? entry.avatar
            : "sun",
      ...(isThemeId(entry.theme) ? { theme: entry.theme } : {}),
    });
  }
  if (!unique.has("main")) unique.set("main", { ...defaults[0]! });
  return [
    unique.get("main")!,
    ...[...unique.values()].filter((profile) => profile.id !== "main"),
  ].slice(0, Math.min(10, limit));
}
