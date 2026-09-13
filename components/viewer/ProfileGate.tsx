"use client";
import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import { useSpatialNavigation } from "./useSpatialNavigation";
import { useGoogleCast } from "@/components/GoogleCastProvider";
import GlobalProgrammingSync from "@/components/GlobalProgrammingSync";
import { useStore } from "@/lib/store";
import {
  activateProfile,
  AVATARS,
  deleteProfile,
  initializeProfiles,
  lockProfiles,
  newProfileId,
  saveProfile,
  setParentPin,
  useProfiles,
  verifyParentPin,
  type Profile,
} from "@/lib/deviceProfiles";

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
function ProfilePicker() {
  useSpatialNavigation(true);
  const profiles = useProfiles((state) => state.profiles);
  const parentPin = useProfiles((state) => state.pin);
  const storageAvailable = useProfiles((state) => state.storageAvailable);
  const [managing, setManaging] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const needsNewPin =
    pending !== null && (!parentPin || pending === "change-pin");
  const editingId = editing?.id;
  useEffect(() => {
    if (!pending && !editingId) heading.current?.focus();
  }, [pending, managing, editingId]);
  function choose(profile: Profile) {
    setError("");
    if ((profile.kids && !parentPin) || (!profile.kids && parentPin))
      setPending(profile.id);
    else activateProfile(profile.id);
  }
  function cancelPin() {
    setPending(null);
    setPin("");
    setConfirmation("");
    setError("");
  }
  async function unlock(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (needsNewPin) {
        if (pin !== confirmation)
          throw new Error("The PINs don't match. Please try again.");
        await setParentPin(pin);
      } else if (!(await verifyParentPin(pin)))
        throw new Error("That PIN wasn't right. Please try again.");
      if (pending === "manage" || pending === "change-pin") {
        setManaging(true);
        cancelPin();
      } else if (pending) activateProfile(pending);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Couldn't unlock. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="ttv-profile-screen">
      <div className="ttv-profile-content">
        <Link className="ttv-profile-wordmark" href="/">
          TATE’S TV<span>GOOD TV. YOUR WAY.</span>
        </Link>
        <span className="ttv-section-kicker">Your seat is waiting</span>
        <h1 ref={heading} tabIndex={-1}>
          {pending
            ? needsNewPin
              ? "Set a parent PIN"
              : "Parent PIN"
            : editing
              ? "Make it yours"
              : managing
                ? "Your household"
                : "Who’s watching?"}
        </h1>
        <p className="ttv-profile-intro">
          {pending
            ? needsNewPin
              ? "Keep the full lineup and profile settings behind a PIN on this device."
              : "Enter your PIN to open the full lineup or manage profiles."
            : editing
              ? "A name, a little personality, and a space of your own."
              : "Your favourites. Your watchlist. Your place to pick up again."}
        </p>
        {pending ? (
          <form className="ttv-profile-form" onSubmit={unlock}>
            <label>
              Parent PIN
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4,8}"
                minLength={4}
                maxLength={8}
                required
                autoComplete={needsNewPin ? "new-password" : "current-password"}
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, ""))
                }
              />
            </label>
            {needsNewPin && (
              <>
                <label>
                  Confirm PIN
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]{4,8}"
                    minLength={4}
                    maxLength={8}
                    required
                    autoComplete="new-password"
                    value={confirmation}
                    onChange={(event) =>
                      setConfirmation(event.target.value.replace(/\D/g, ""))
                    }
                  />
                </label>
                <p className="ttv-profile-note">
                  Use 4–8 numbers. Remember this PIN: device profiles have no
                  email recovery. Clearing browser data removes the PIN and
                  profiles.
                </p>
              </>
            )}
            {error && <p role="alert">{error}</p>}
            <div className="ttv-profile-actions">
              <button disabled={busy} className="ttv-profile-primary">
                {busy
                  ? "Please wait…"
                  : needsNewPin
                    ? "Save PIN & continue"
                    : "Continue"}
              </button>
              <button type="button" disabled={busy} onClick={cancelPin}>
                Back
              </button>
            </div>
          </form>
        ) : editing ? (
          <form
            className="ttv-profile-form"
            onSubmit={(event) => {
              event.preventDefault();
              saveProfile(editing);
              setEditing(null);
              setDeleting(false);
            }}
          >
            <label>
              Profile name
              <input
                autoFocus
                required
                maxLength={24}
                value={editing.name}
                onChange={(event) =>
                  setEditing({ ...editing, name: event.target.value })
                }
              />
            </label>
            <fieldset>
              <legend>Choose an avatar</legend>
              <div className="ttv-avatar-options">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar}
                    type="button"
                    aria-label={`${avatar} avatar`}
                    aria-pressed={editing.avatar === avatar}
                    onClick={() => setEditing({ ...editing, avatar })}
                  >
                    <ProfileAvatar profile={{ avatar }} />
                  </button>
                ))}
              </div>
            </fieldset>
            {editing.id !== "main" && (
              <label className="ttv-profile-check">
                <input
                  type="checkbox"
                  checked={editing.kids}
                  onChange={(event) =>
                    setEditing({ ...editing, kids: event.target.checked })
                  }
                />
                <span>
                  Kids profile
                  <small>
                    Only programming explicitly approved by the station. A
                    parent PIN is required before use.
                  </small>
                </span>
              </label>
            )}
            <div className="ttv-profile-actions">
              <button
                className="ttv-profile-primary"
                disabled={!editing.name.trim()}
              >
                Save profile
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setDeleting(false);
                }}
              >
                Cancel
              </button>
            </div>
            {editing.id !== "main" &&
              profiles.some((profile) => profile.id === editing.id) &&
              (deleting ? (
                <div>
                  <p>
                    Delete {editing.name} and their saved items and viewing
                    progress from this device?
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      deleteProfile(editing.id);
                      setEditing(null);
                      setDeleting(false);
                    }}
                  >
                    Yes, delete profile
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setDeleting(true)}>
                  Delete profile
                </button>
              ))}
          </form>
        ) : (
          <>
            <div className="ttv-profile-grid">
              {profiles.map((profile) => (
                <button
                  type="button"
                  className="ttv-profile-card"
                  key={profile.id}
                  onClick={() =>
                    managing ? setEditing({ ...profile }) : choose(profile)
                  }
                  aria-label={
                    managing
                      ? `Edit ${profile.name}`
                      : `Watch as ${profile.name}`
                  }
                >
                  <ProfileAvatar profile={profile} />
                  <strong>{profile.name}</strong>
                  <small>
                    {managing
                      ? "Edit profile"
                      : profile.kids
                        ? "Kids · approved lineup"
                        : parentPin
                          ? "Full lineup · PIN"
                          : "Full lineup"}
                  </small>
                </button>
              ))}
              {managing && profiles.length < 5 && (
                <button
                  type="button"
                  className="ttv-profile-card"
                  onClick={() =>
                    setEditing({
                      id: newProfileId(),
                      name: "",
                      kids: false,
                      avatar: "moon",
                    })
                  }
                >
                  <span
                    className="ttv-profile-avatar ttv-profile-add"
                    aria-hidden="true"
                  >
                    +
                  </span>
                  <strong>Add profile</strong>
                  <small>Up to five on this device</small>
                </button>
              )}
            </div>
            <div className="ttv-profile-actions">
              <button
                type="button"
                onClick={() => {
                  if (managing) setManaging(false);
                  else if (parentPin) setPending("manage");
                  else setManaging(true);
                }}
              >
                {managing ? "Done" : "Manage profiles"}
              </button>
              {managing && (
                <button type="button" onClick={() => setPending("change-pin")}>
                  {parentPin ? "Change parent PIN" : "Set parent PIN"}
                </button>
              )}
            </div>
          </>
        )}
        {!storageAvailable && (
          <p role="status">
            Browser storage is unavailable. Profiles and saved items will only
            last for this visit.
          </p>
        )}
        <p className="ttv-profile-note">
          No signup. Profiles stay on this browser and device. The parent PIN is
          a convenience control that can be reset by clearing browser data.
        </p>
      </div>
    </main>
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
