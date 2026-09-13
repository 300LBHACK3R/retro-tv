import type { ReactNode } from "react";
import type { Profile } from "@/lib/deviceProfiles";

const avatarArt: Record<Profile["avatar"], ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5" />
    </>
  ),
  moon: <path d="M20 14A8.5 8.5 0 0 1 10 4a8.5 8.5 0 1 0 10 10Z" />,
  star: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
  ),
  bolt: <path d="m14 2-9 12h6l-1 8 9-12h-6Z" />,
  flower: (
    <>
      <path d="M12 8c-6-8-11 1-4 4-8 6 1 11 4 4 6 8 11-1 4-4 8-6-1-11-4-4Z" />
      <circle cx="12" cy="12" r="2" />
    </>
  ),
};
export function ProfileAvatar({
  profile,
}: {
  profile: Pick<Profile, "avatar">;
}) {
  return (
    <span
      className="ttv-profile-avatar"
      data-avatar={profile.avatar}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        {avatarArt[profile.avatar]}
      </svg>
    </span>
  );
}
