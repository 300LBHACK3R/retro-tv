"use client";
import { useEffect, useState, type ReactNode } from "react";
import { useGoogleCast } from "@/components/GoogleCastProvider";
import GlobalProgrammingSync from "@/components/GlobalProgrammingSync";
import { useStore } from "@/lib/store";
import {
  initializeProfiles,
  lockProfiles,
  useProfiles,
} from "@/lib/deviceProfiles";
import { ProfileAvatar } from "./ProfileAvatar";
import ProfilePicker from "./ProfilePicker";

export function ProfileButton() {
  const profile = useProfiles((state) =>
    state.profiles.find((item) => item.id === state.activeId),
  );
  const { disconnect } = useGoogleCast();
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
        <small>{profile?.kids ? "Kids profile" : "Switch profile"}</small>
      </span>
    </button>
  );
}
export default function ProfileGate({ children }: { children: ReactNode }) {
  const ready = useProfiles((state) => state.ready);
  const activeId = useProfiles((state) => state.activeId);
  const revision = useProfiles((state) => state.revision);
  const [prepared, setPrepared] = useState(false);
  const { disconnect, sdkState } = useGoogleCast();
  useEffect(() => {
    initializeProfiles();
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
    if (!activeId)
      document
        .querySelectorAll<HTMLMediaElement>("video, audio")
        .forEach((media) => media.pause());
  }, [activeId, disconnect, sdkState]);
  return (
    <>
      <GlobalProgrammingSync isAdminAuthorized={false} visibility="problems" />
      {!ready || !prepared ? (
        <main className="ttv-profile-screen">
          <div>
            <h1>Tate’s TV</h1>
            <p role="status">Getting your TV ready…</p>
          </div>
        </main>
      ) : activeId ? (
        <div key={activeId}>{children}</div>
      ) : (
        <ProfilePicker key={revision} />
      )}
    </>
  );
}
