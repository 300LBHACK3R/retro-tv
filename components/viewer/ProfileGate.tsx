"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useGoogleCast } from "@/components/GoogleCastProvider";
import GlobalProgrammingSync from "@/components/GlobalProgrammingSync";
import { useAccount } from "@/lib/accountStore";
import { useStore } from "@/lib/store";
import {
  lockProfiles,
  useProfiles,
} from "@/lib/deviceProfiles";
import { ProfileAvatar } from "./ProfileAvatar";
import ProfilePicker from "./ProfilePicker";
import Link from "next/link";

export function ProfileButton() {
  const user = useAccount((state) => state.user);
  const badge = useAccount((state) => state.member && state.showMemberBadge);
  const profile = useProfiles((state) =>
    state.profiles.find((item) => item.id === state.activeId),
  );
  const { disconnect } = useGoogleCast();
  if (!user) return <Link href="/account" className="ttv-profile-switch">Guest · Sign in to save</Link>;
  return (
    <button
      type="button"
      className="ttv-profile-switch"
      aria-label={`Switch profile: ${profile?.name ?? "Viewer"}`}
      onClick={() => {
        document
          .querySelectorAll<HTMLMediaElement>("video, audio")
          .forEach((media) => media.pause());
        lockProfiles();
        disconnect();
      }}
    >
      <ProfileAvatar profile={profile ?? { avatar: "sun" }} />
      <span>
        {profile?.name ?? "Profiles"}
        {badge && !profile?.kids ? <span className="ttv-member-badge">★ Member</span> : null}
        <small>{profile?.kids ? "Kids profile" : "Switch profile"}</small>
      </span>
    </button>
  );
}
export default function ProfileGate({ children }: { children: ReactNode }) {
  const accountReady = useAccount((state) => state.ready);
  const user = useAccount((state) => state.user?.id);
  const ready = useProfiles((state) => state.ready);
  const activeId = useProfiles((state) => state.activeId);
  const revision = useProfiles((state) => state.revision);
  const [prepared, setPrepared] = useState(false);
  const [programmingReady, setProgrammingReady] = useState(false);
  const handleProgrammingReady = useCallback(() => setProgrammingReady(true), []);
  const { disconnect, sdkState } = useGoogleCast();
  useEffect(() => {
    const state = useStore.getState();
    state.setChannel(
      state.channels.find(
        (channel) => Number(channel.number ?? channel.id) === 1,
      )?.id ?? "1",
    );
    setPrepared(true);
  }, []);
  useEffect(() => {
    disconnect();
    if (user && !activeId)
      document
        .querySelectorAll<HTMLMediaElement>("video, audio")
        .forEach((media) => media.pause());
  }, [user, activeId, disconnect, sdkState]);
  // Guests can watch public programming; authenticated households retain their PIN gate.
  return (
    <>
      <GlobalProgrammingSync
        isAdminAuthorized={false}
        visibility="problems"
        onReady={handleProgrammingReady}
      />
      {!accountReady || !ready || !prepared || ((activeId || !user) && !programmingReady) ? (
        <main className="ttv-profile-screen">
          <div>
            <h1>Tate’s TV</h1>
            <p role="status">Getting your TV ready…</p>
          </div>
        </main>
      ) : !user || activeId ? (
        <div key={user ? `${user}:${activeId}` : "guest"}>{children}</div>
      ) : (
        <ProfilePicker key={revision} />
      )}
    </>
  );
}
