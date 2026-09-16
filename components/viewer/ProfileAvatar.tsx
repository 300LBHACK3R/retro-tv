import Image from "next/image";
import type { Profile } from "@/lib/deviceProfiles";

// Stable IDs preserve existing profiles, favourites, PINs, and watch history.
export const PROFILE_PORTRAITS = {
  sun: { name: "Boy fox", src: "/avatars/boyfox.png" },
  girlfox: { name: "Girl fox", src: "/avatars/girlfox.png" },
  dadfox: { name: "Dad fox", src: "/avatars/dadfox.png" },
  momfox: { name: "Mom fox", src: "/avatars/momfox.png" },
  bolt: { name: "Boy robot", src: "/avatars/boyrobot.png" },
  girlrobot: { name: "Girl robot", src: "/avatars/girlrobot.png" },
  boydragon: { name: "Boy dragon", src: "/avatars/boydragon.png" },
  girldragon: { name: "Girl dragon", src: "/avatars/girldragon.png" },
  daddragon: { name: "Dad dragon", src: "/avatars/daddragon.png" },
  momdragon: { name: "Mom dragon", src: "/avatars/momdragon.png" },
  malepirate: { name: "Male pirate", src: "/avatars/malepirate.png" },
  femalepirate: { name: "Female pirate", src: "/avatars/femalepirate.png" },
  malemechanic: { name: "Male mechanic", src: "/avatars/malemechanic.png" },
  femalemechanic: { name: "Female mechanic", src: "/avatars/femalemechanic.png" },
  maledoctors: { name: "Male doctor", src: "/avatars/maledoctors.png" },
  femaledoctors: { name: "Female doctor", src: "/avatars/femaledoctors.png" },
  maleserver: { name: "Male server", src: "/avatars/maleserver.png" },
  femaleserver: { name: "Female server", src: "/avatars/femaleserver.png" },
  flower: { name: "Girl cat", src: "/avatars/girlcat.png" },
  boycat: { name: "Boy cat", src: "/avatars/boycat.png" },
  jesus: { name: "Jesus", src: "/avatars/jesus.png" },
  kidsjesus: { name: "Jesus for Kids", src: "/avatars/kidsjesus.png" },
} satisfies Record<Profile["avatar"], { name: string; src: string }>;

export const PROFILE_AVATAR_GROUPS = [
  { name: "Fox family", avatars: ["sun", "girlfox", "dadfox", "momfox"] },
  { name: "Cats & robots", avatars: ["flower", "boycat", "bolt", "girlrobot"] },
  { name: "Dragon family", avatars: ["boydragon", "girldragon", "daddragon", "momdragon"] },
  { name: "Pirates", avatars: ["malepirate", "femalepirate"] },
  { name: "Everyday heroes", avatars: ["malemechanic", "femalemechanic", "maledoctors", "femaledoctors", "maleserver", "femaleserver"] },
  { name: "Faith", avatars: ["jesus", "kidsjesus"] },
] satisfies { name: string; avatars: Profile["avatar"][] }[];

export function ProfileAvatar({ profile }: { profile: Pick<Profile, "avatar"> }) {
  const portrait = PROFILE_PORTRAITS[profile.avatar] ?? PROFILE_PORTRAITS.sun;
  return (
    <span className="ttv-profile-avatar" data-avatar={profile.avatar} aria-hidden="true">
      <Image
        src={portrait.src}
        alt=""
        width={1254}
        height={1254}
        sizes="(max-width: 560px) 112px, 160px"
        className="ttv-profile-portrait"
      />
    </span>
  );
}
