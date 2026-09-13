"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  activateProfile,
  AVATARS,
  deleteProfile,
  newProfileId,
  saveProfile,
  setParentPin,
  useProfiles,
  verifyParentPin,
  type Profile,
} from "@/lib/deviceProfiles";
import { ProfileAvatar } from "./ProfileAvatar";
import { useSpatialNavigation } from "./useSpatialNavigation";

type Home = { kind: "choose" | "manage"; focus?: string; notice?: string };
type Intent =
  | { kind: "watch"; profile: Profile }
  | { kind: "manage" | "add" | "change" };
type PinScreen = { kind: "pin"; create: boolean; intent: Intent; back: Home };
type Screen = Home | PinScreen | { kind: "edit"; profile: Profile; back: Home };

function Symbol({ name }: { name: "back" | "lock" | "edit" | "add" }) {
  const paths = {
    back: "m14 6-6 6 6 6M8 12h13",
    lock: "M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5zM12 14v3",
    edit: "m15 4 5 5M4 20l1-6L16 3l5 5-11 11z",
    add: "M12 5v14M5 12h14",
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function useEscape(back: () => void) {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      event.preventDefault();
      back();
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [back]);
}

function BackButton({
  onClick,
  disabled = false,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="ttv-profile-back"
      onClick={onClick}
      disabled={disabled}
    >
      <Symbol name="back" />
      Back
    </button>
  );
}

function PinEntry({
  screen,
  onBack,
  onSuccess,
}: {
  screen: PinScreen;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [pin, setPin] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  const input = useRef<HTMLInputElement>(null);
  const confirmInput = useRef<HTMLInputElement>(null);
  const lockedUntil = useProfiles((state) => state.lockedUntil);
  const [clock, setClock] = useState(() => Date.now());
  const seconds = screen.create
    ? 0
    : Math.max(0, Math.ceil((lockedUntil - clock) / 1000));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setClock(now);
      if (now >= lockedUntil) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [lockedUntil]);
  const back = () => {
    if (!busyRef.current) onBack();
  };
  useEscape(back);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busyRef.current || seconds > 0) return;
    setError("");
    if (screen.create && pin !== confirmation) {
      setError("The PINs don't match. Enter the same PIN in both fields.");
      confirmInput.current?.focus();
      confirmInput.current?.select();
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      if (screen.create) await setParentPin(pin);
      else if (!(await verifyParentPin(pin)))
        throw new Error("That PIN wasn't right. Please try again.");
      if (mounted.current) onSuccess();
    } catch (reason) {
      if (mounted.current) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Couldn't unlock. Please try again.",
        );
        setClock(Date.now());
        input.current?.focus();
        input.current?.select();
      }
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const profile = screen.intent.kind === "watch" ? screen.intent.profile : null;
  const title = screen.create
    ? "Set a parent PIN"
    : profile
      ? `Hi, ${profile.name}.`
      : "Parent PIN";
  const description = screen.create
    ? "A parent PIN keeps the full lineup and profile settings locked when Kids are watching."
    : profile
      ? "Enter your PIN to open the full lineup."
      : "Enter your PIN to change profiles and settings.";
  return (
    <section className="ttv-profile-panel" aria-labelledby="profile-heading">
      <BackButton onClick={back} disabled={busy} />
      <div className="ttv-profile-panel-icon">
        {profile ? <ProfileAvatar profile={profile} /> : <Symbol name="lock" />}
      </div>
      <h1 id="profile-heading">{title}</h1>
      <p className="ttv-profile-intro">{description}</p>
      <form className="ttv-profile-form" onSubmit={submit} aria-busy={busy}>
        <label htmlFor="parent-pin">Parent PIN</label>
        <div className="ttv-pin-input">
          <input
            ref={input}
            id="parent-pin"
            autoFocus
            type={visible ? "text" : "password"}
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            minLength={4}
            maxLength={8}
            required
            autoComplete={screen.create ? "new-password" : "current-password"}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? "profile-pin-error profile-pin-hint" : "profile-pin-hint"
            }
            readOnly={busy}
            value={pin}
            onChange={(event) => {
              setPin(event.target.value.replace(/\D/g, ""));
              setError("");
            }}
          />
          <button
            type="button"
            aria-label={visible ? "Hide PIN" : "Show PIN"}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? "Hide" : "Show"}
          </button>
        </div>
        <p className="ttv-profile-field-hint" id="profile-pin-hint">
          {screen.create
            ? "Choose 4–8 numbers you’ll remember."
            : "Your 4–8 digit parent PIN."}
        </p>
        {screen.create && (
          <label>
            Confirm PIN
            <input
              ref={confirmInput}
              type={visible ? "text" : "password"}
              inputMode="numeric"
              pattern="[0-9]{4,8}"
              minLength={4}
              maxLength={8}
              required
              autoComplete="new-password"
              readOnly={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "profile-pin-error" : undefined}
              value={confirmation}
              onChange={(event) => {
                setConfirmation(event.target.value.replace(/\D/g, ""));
                setError("");
              }}
            />
          </label>
        )}
        {error && (
          <p className="ttv-profile-error" role="alert" id="profile-pin-error">
            {error}
          </p>
        )}
        <div className="ttv-profile-actions">
          <button
            disabled={busy || seconds > 0}
            className="ttv-profile-primary"
          >
            {busy
              ? "Opening…"
              : seconds > 0
                ? `Try again in ${seconds}s`
                : screen.create
                  ? "Save PIN & continue"
                  : "Continue"}
          </button>
        </div>
        <details className="ttv-profile-help">
          <summary>
            {screen.create ? "About your parent PIN" : "Forgot your PIN?"}
          </summary>
          <p>
            Profiles and the PIN are saved in this browser. There’s no email
            recovery yet. Clearing this site’s browser data resets the PIN and
            removes profiles, saved items and viewing progress. This is a device
            convenience, not an account lock.
          </p>
        </details>
      </form>
    </section>
  );
}

function ProfileEditor({
  initial,
  onBack,
  onSave,
  onDelete,
}: {
  initial: Profile;
  onBack: () => void;
  onSave: (profile: Profile) => void;
  onDelete: () => void;
}) {
  const [profile, setProfile] = useState(initial);
  const [deleting, setDeleting] = useState(false);
  const existing = useProfiles((state) =>
    state.profiles.some((item) => item.id === initial.id),
  );
  const parentPin = useProfiles((state) => state.pin);
  const nameInput = useRef<HTMLInputElement>(null);
  const deleteHeading = useRef<HTMLHeadingElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const wasDeleting = useRef(false);
  const back = () => {
    if (deleting) {
      setDeleting(false);
    } else onBack();
  };
  useEscape(back);
  useEffect(() => {
    if (deleting) deleteHeading.current?.focus();
    else if (wasDeleting.current) deleteButton.current?.focus();
    wasDeleting.current = deleting;
  }, [deleting]);
  if (deleting)
    return (
      <section className="ttv-profile-panel" aria-labelledby="profile-heading">
        <BackButton onClick={back} />
        <div className="ttv-profile-panel-icon">
          <ProfileAvatar profile={profile} />
        </div>
        <h1 id="profile-heading" ref={deleteHeading} tabIndex={-1}>
          Delete {profile.name}?
        </h1>
        <p className="ttv-profile-intro">
          Their saved items and viewing progress will be removed from this
          device. This can’t be undone.
        </p>
        <div className="ttv-profile-actions ttv-profile-stacked-actions">
          <button
            type="button"
            className="ttv-profile-primary"
            autoFocus
            onClick={() => setDeleting(false)}
          >
            Keep profile
          </button>
          <button type="button" onClick={onDelete}>
            Yes, delete profile
          </button>
        </div>
      </section>
    );
  return (
    <section className="ttv-profile-panel" aria-labelledby="profile-heading">
      <BackButton onClick={onBack} />
      <h1 id="profile-heading">
        {existing ? "Edit profile" : "Add a profile"}
      </h1>
      <p className="ttv-profile-intro">A little space of your own.</p>
      <form
        className="ttv-profile-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (!profile.name.trim()) {
            nameInput.current?.focus();
            return;
          }
          onSave({ ...profile, name: profile.name.trim() });
        }}
      >
        <div className="ttv-profile-editor-preview">
          <ProfileAvatar profile={profile} />
          <span>
            {profile.name.trim() || "Your profile"}
            <small>{profile.kids ? "Kids lineup" : "Full lineup"}</small>
          </span>
        </div>
        <label>
          Profile name
          <input
            ref={nameInput}
            autoFocus
            required
            maxLength={24}
            autoComplete="off"
            enterKeyHint="done"
            placeholder="Enter a name"
            value={profile.name}
            onChange={(event) =>
              setProfile({ ...profile, name: event.target.value })
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
                aria-pressed={profile.avatar === avatar}
                onClick={() => setProfile({ ...profile, avatar })}
              >
                <ProfileAvatar profile={{ avatar }} />
              </button>
            ))}
          </div>
        </fieldset>
        {profile.id !== "main" && (
          <label className="ttv-profile-check ttv-profile-kids-option">
            <input
              type="checkbox"
              checked={profile.kids}
              onChange={(event) =>
                setProfile({ ...profile, kids: event.target.checked })
              }
            />
            <span>
              Kids profile
              <small>
                Only channels and programmes approved for Kids.
                {!parentPin &&
                  " You’ll set a parent PIN before their first watch."}
              </small>
            </span>
          </label>
        )}
        <div className="ttv-profile-actions">
          <button
            className="ttv-profile-primary"
            disabled={!profile.name.trim()}
          >
            Save profile
          </button>
          <button type="button" onClick={onBack}>
            Cancel
          </button>
        </div>
        {existing && profile.id !== "main" && (
          <button
            ref={deleteButton}
            className="ttv-profile-delete"
            type="button"
            onClick={() => setDeleting(true)}
          >
            Delete profile
          </button>
        )}
      </form>
    </section>
  );
}

export default function ProfilePicker() {
  useSpatialNavigation(true);
  const profiles = useProfiles((state) => state.profiles);
  const parentPin = useProfiles((state) => state.pin);
  const storageAvailable = useProfiles((state) => state.storageAvailable);
  const [screen, setScreen] = useState<Screen>({ kind: "choose" });
  const root = useRef<HTMLElement>(null);
  const home = screen.kind === "choose" || screen.kind === "manage";
  const focus = home ? screen.focus : undefined;
  useEffect(() => {
    if (!home) return;
    const target = Array.from(
      root.current?.querySelectorAll<HTMLElement>("[data-profile-focus]") ?? [],
    ).find((element) => element.dataset.profileFocus === focus);
    (target ?? root.current?.querySelector<HTMLElement>("h1"))?.focus({
      preventScroll: true,
    });
  }, [home, screen.kind, focus]);

  function add(back: Home) {
    setScreen({
      kind: "edit",
      profile: { id: newProfileId(), name: "", kids: false, avatar: "moon" },
      back,
    });
  }
  function request(intent: Intent, back: Home) {
    if (intent.kind === "watch") {
      if (
        (intent.profile.kids && !parentPin) ||
        (!intent.profile.kids && parentPin)
      )
        setScreen({ kind: "pin", create: !parentPin, intent, back });
      else activateProfile(intent.profile.id);
    } else if (intent.kind === "change")
      setScreen({ kind: "pin", create: true, intent, back });
    else if (parentPin && back.kind !== "manage")
      setScreen({ kind: "pin", create: false, intent, back });
    else if (intent.kind === "add") add(back);
    else setScreen({ kind: "manage" });
  }
  function pinSuccess(current: PinScreen) {
    if (current.intent.kind === "watch")
      activateProfile(current.intent.profile.id);
    else if (current.intent.kind === "add") add(current.back);
    else
      setScreen({
        kind: "manage",
        notice: current.create ? "Parent PIN saved." : undefined,
      });
  }
  useEscape(() => {
    if (screen.kind === "manage")
      setScreen({ kind: "choose", focus: "manage" });
  });

  return (
    <main
      ref={root}
      className="ttv-profile-screen"
      data-view={home ? "chooser" : "form"}
      aria-labelledby="profile-heading"
    >
      <header className="ttv-profile-header">
        <span className="ttv-profile-wordmark">
          TATE’S <span>TV</span>
        </span>
        <span className="ttv-profile-device">Your TV. Your people.</span>
      </header>
      <div className="ttv-profile-content">
        {screen.kind === "pin" ? (
          <PinEntry
            screen={screen}
            onBack={() => setScreen(screen.back)}
            onSuccess={() => pinSuccess(screen)}
          />
        ) : screen.kind === "edit" ? (
          <ProfileEditor
            key={screen.profile.id}
            initial={screen.profile}
            onBack={() => setScreen(screen.back)}
            onSave={(profile) => {
              saveProfile(profile);
              setScreen({
                ...screen.back,
                focus: profile.id,
                notice: `${profile.name} saved.`,
              });
            }}
            onDelete={() => {
              deleteProfile(screen.profile.id);
              setScreen({
                ...screen.back,
                focus: "add",
                notice: "Profile deleted.",
              });
            }}
          />
        ) : (
          <section
            className="ttv-profile-chooser"
            aria-labelledby="profile-heading"
          >
            <h1 id="profile-heading" tabIndex={-1}>
              {screen.kind === "manage" ? "Your household" : "Who’s watching?"}
            </h1>
            <p className="ttv-profile-intro">
              {screen.kind === "manage"
                ? "Choose a profile to make changes."
                : "Pick your profile. Settle into something good."}
            </p>
            <div className="ttv-profile-grid">
              {profiles.map((profile) => (
                <button
                  type="button"
                  className="ttv-profile-card"
                  key={profile.id}
                  data-profile-focus={profile.id}
                  aria-label={
                    screen.kind === "manage"
                      ? `Edit ${profile.name}`
                      : `Watch as ${profile.name}`
                  }
                  onClick={() =>
                    screen.kind === "manage"
                      ? setScreen({
                          kind: "edit",
                          profile: { ...profile },
                          back: { kind: "manage", focus: profile.id },
                        })
                      : request(
                          { kind: "watch", profile },
                          { kind: "choose", focus: profile.id },
                        )
                  }
                >
                  <span className="ttv-profile-art">
                    <ProfileAvatar profile={profile} />
                    {screen.kind === "manage" && (
                      <span className="ttv-profile-edit-badge">
                        <Symbol name="edit" />
                      </span>
                    )}
                  </span>
                  <strong>{profile.name}</strong>
                  <small>
                    {screen.kind === "manage" ? (
                      "Edit profile"
                    ) : profile.kids ? (
                      "Kids"
                    ) : (
                      <>{parentPin && <Symbol name="lock" />}Full lineup</>
                    )}
                  </small>
                </button>
              ))}
              {profiles.length < 5 && (
                <button
                  type="button"
                  className="ttv-profile-card"
                  data-profile-focus="add"
                  aria-label="Add profile"
                  onClick={() =>
                    request(
                      { kind: "add" },
                      { kind: screen.kind, focus: "add" },
                    )
                  }
                >
                  <span className="ttv-profile-art">
                    <span className="ttv-profile-avatar ttv-profile-add">
                      <Symbol name="add" />
                    </span>
                  </span>
                  <strong>Add profile</strong>
                  <small>A space of their own</small>
                </button>
              )}
            </div>
            <div className="ttv-profile-actions ttv-profile-management">
              <button
                type="button"
                data-profile-focus="manage"
                className={
                  screen.kind === "manage" ? "ttv-profile-primary" : undefined
                }
                onClick={() =>
                  screen.kind === "manage"
                    ? setScreen({ kind: "choose", focus: "manage" })
                    : request(
                        { kind: "manage" },
                        { kind: "choose", focus: "manage" },
                      )
                }
              >
                {screen.kind === "manage" ? (
                  "Done"
                ) : (
                  <>
                    <Symbol name="edit" />
                    Manage profiles
                  </>
                )}
              </button>
              {screen.kind === "manage" && (
                <button
                  type="button"
                  data-profile-focus="pin"
                  onClick={() =>
                    request(
                      { kind: "change" },
                      { kind: "manage", focus: "pin" },
                    )
                  }
                >
                  {parentPin ? "Change parent PIN" : "Set parent PIN"}
                </button>
              )}
            </div>
            <p role="status" className="ttv-profile-feedback">
              {screen.notice ?? ""}
            </p>
          </section>
        )}
      </div>
      <footer className="ttv-profile-footer">
        {storageAvailable ? (
          <p>Profiles are saved on this device. No signup needed.</p>
        ) : (
          <p role="status">
            Browser storage is unavailable. Profiles and saved items will only
            last for this visit.
          </p>
        )}
      </footer>
    </main>
  );
}
