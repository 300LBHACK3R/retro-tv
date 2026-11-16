import Image from "next/image";
import type { Profile } from "@/lib/deviceProfiles";

import { PROFILE_PORTRAITS } from "@/lib/profilePortraits";
export { PROFILE_PORTRAITS, PROFILE_AVATAR_GROUPS } from "@/lib/profilePortraits";

export function ProfileAvatar({ profile }: { profile: Pick<Profile, "avatar"> }) {
  const portrait = PROFILE_PORTRAITS[profile.avatar] ?? PROFILE_PORTRAITS.sun;
  return (
    <span className="ttv-profile-avatar" data-avatar={profile.avatar} aria-hidden="true">
      <Image
        // These small WebP assets are generated before development/build. Direct
        // delivery remains retryable if a navigation interrupts an image load.
        src={portrait.src.replace("/avatars/", "/avatars/portraits/").replace(/\.png$/, ".webp")}
        alt=""
        width={512}
        height={512}
        unoptimized
        className="ttv-profile-portrait"
      />
    </span>
  );
}
