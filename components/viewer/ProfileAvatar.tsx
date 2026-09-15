import Image from "next/image";
import type { Profile } from "@/lib/deviceProfiles";

// Stable IDs preserve existing profiles, favourites, PINs, and watch history.
export const PROFILE_PORTRAITS = {
  sun: { name: "Fox", src: "/avatars/fox.png" },
  moon: { name: "Space explorer", src: "/avatars/explorer.png" },
  star: { name: "Dinosaur", src: "/avatars/dinosaur.png" },
  bolt: { name: "Robot", src: "/avatars/robot.png" },
  flower: { name: "Cat", src: "/avatars/cat.png" },
} satisfies Record<Profile["avatar"], { name: string; src: string }>;

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
