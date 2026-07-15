"use client";

import { type FormEvent, useMemo, useState } from "react";

const SUBMISSION_EMAIL = "submissions@tatestv.ca";

type FormState = {
  name: string;
  email: string;
  creditName: string;
  clipTitle: string;
  clipLink: string;
  description: string;
  location: string;
  filmedByYou: boolean;
  ownRights: boolean;
  peopleConsent: boolean;
  ageConfirm: boolean;
  contentConfirm: boolean;
  rightsAgreement: boolean;
};

const initialState: FormState = {
  name: "",
  email: "",
  creditName: "",
  clipTitle: "",
  clipLink: "",
  description: "",
  location: "",
  filmedByYou: false,
  ownRights: false,
  peopleConsent: false,
  ageConfirm: false,
  contentConfirm: false,
  rightsAgreement: false,
};

function normalize(value: string): string {
  return value.trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isLikelyUrl(value: string): boolean {
  const text = value.trim();

  if (!text) {
    return false;
  }

  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildSubmissionBody(form: FormState): string {
  return [
    "FailZone Clip Submission",
    "========================",
    "",
    `Name: ${normalize(form.name)}`,
    `Email: ${normalize(form.email)}`,
    `Optional credit name: ${normalize(form.creditName) || "Not provided"}`,
    "",
    `Clip title: ${normalize(form.clipTitle)}`,
    `Clip link: ${normalize(form.clipLink)}`,
    `Where / when it happened: ${normalize(form.location) || "Not provided"}`,
    "",
    "Description:",
    normalize(form.description),
    "",
    "Rights confirmations:",
    `- I filmed this myself or was directly involved in creating it: ${form.filmedByYou ? "Yes" : "No"}`,
    `- I own the clip or have permission from the owner: ${form.ownRights ? "Yes" : "No"}`,
    `- Recognizable people have consented to public sharing: ${form.peopleConsent ? "Yes" : "No"}`,
    `- I am 18+ or have parent/guardian permission: ${form.ageConfirm ? "Yes" : "No"}`,
    `- The clip follows the content rules: ${form.contentConfirm ? "Yes" : "No"}`,
    "- I accepted the Tate's TV / FailZone clip release terms: Yes",
    "",
    "Release terms accepted:",
    "By submitting this clip, I confirm that I am the owner of the submitted content or that I have full legal permission to submit it. I confirm that I have obtained permission from any recognizable people appearing or speaking in the clip. I grant Tate's TV and its related brands, including FailZone, a non-exclusive, worldwide, royalty-free, transferable license to use, edit, reproduce, publish, display, broadcast, stream, distribute, monetize, promote, and create derivative works from the submitted clip across Tate's TV websites, apps, channels, social media pages, advertisements, promotional materials, and future distribution platforms. I understand that submission does not guarantee that my clip will be used. I understand that I will not receive payment unless a separate written agreement is made.",
  ].join("\n");
}

export default function SubmitClipForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [message, setMessage] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const errors = useMemo(() => {
    const nextErrors: string[] = [];

    if (!normalize(form.name)) {
      nextErrors.push("Add your name.");
    }

    if (!isValidEmail(form.email)) {
      nextErrors.push("Add a valid email address.");
    }

    if (!normalize(form.clipTitle)) {
      nextErrors.push("Add a clip title.");
    }

    if (!isLikelyUrl(form.clipLink)) {
      nextErrors.push("Add a valid public or shareable clip link.");
    }

    if (!normalize(form.description)) {
      nextErrors.push("Add a short description of the clip.");
    }

    if (!form.filmedByYou) {
      nextErrors.push("Confirm you filmed it yourself or were directly involved in creating it.");
    }

    if (!form.ownRights) {
      nextErrors.push("Confirm you own the clip or have the owner&apos;s permission.");
    }

    if (!form.peopleConsent) {
      nextErrors.push("Confirm recognizable people consented to public sharing.");
    }

    if (!form.ageConfirm) {
      nextErrors.push("Confirm you are 18+ or have parent/guardian permission.");
    }

    if (!form.contentConfirm) {
      nextErrors.push("Confirm the clip follows the content rules.");
    }

    if (!form.rightsAgreement) {
      nextErrors.push("Accept the Tate&apos;s TV / FailZone clip release terms.");
    }

    return nextErrors;
  }, [form]);

  const submissionBody = useMemo(() => buildSubmissionBody(form), [form]);

  const canSubmit = errors.length === 0;

  const updateText = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
    setCopied(false);
  };

  const updateCheckbox = (key: keyof FormState, value: boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage("");
    setCopied(false);
  };

  const copySubmission = async () => {
    try {
      await navigator.clipboard.writeText(submissionBody);
      setCopied(true);
      setMessage("Submission details copied. Paste them into your email if your mail app does not open automatically.");
    } catch {
      setCopied(false);
      setMessage("Could not copy automatically. You can still use the email button below.");
    }
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setMessage("Please finish the required fields and confirmations before submitting.");
      return;
    }

    await copySubmission();

    const subject = encodeURIComponent(`FailZone Clip Submission - ${normalize(form.clipTitle)}`);
    const body = encodeURIComponent(submissionBody);

    window.location.href = `mailto:${SUBMISSION_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <form className="ttv-submit-form" onSubmit={submitForm}>
      <div className="ttv-submit-form-grid">
        <label>
          <span>Your name *</span>
          <input
            value={form.name}
            onChange={(event) => updateText("name", event.target.value)}
            placeholder="Full name"
            required
          />
        </label>

        <label>
          <span>Email *</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateText("email", event.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>

        <label>
          <span>Credit name</span>
          <input
            value={form.creditName}
            onChange={(event) => updateText("creditName", event.target.value)}
            placeholder="Name to show on screen, or leave blank"
          />
        </label>

        <label>
          <span>Clip title *</span>
          <input
            value={form.clipTitle}
            onChange={(event) => updateText("clipTitle", event.target.value)}
            placeholder="Example: Hoverboard Pool Fail"
            required
          />
        </label>
      </div>

      <label>
        <span>Clip link *</span>
        <input
          type="url"
          value={form.clipLink}
          onChange={(event) => updateText("clipLink", event.target.value)}
          placeholder="Paste a Google Drive, Dropbox, iCloud, OneDrive, or unlisted YouTube link"
          required
        />
      </label>

      <label>
        <span>Where / when did it happen?</span>
        <input
          value={form.location}
          onChange={(event) => updateText("location", event.target.value)}
          placeholder="City, event, rough date, or short context"
        />
      </label>

      <label>
        <span>Short description *</span>
        <textarea
          value={form.description}
          onChange={(event) => updateText("description", event.target.value)}
          placeholder="Tell us what happens in the clip and why it belongs on FailZone."
          rows={5}
          required
        />
      </label>

      <div className="ttv-submit-checks">
        <label>
          <input
            type="checkbox"
            checked={form.filmedByYou}
            onChange={(event) => updateCheckbox("filmedByYou", event.target.checked)}
          />
          <span>I filmed this clip myself or was directly involved in creating it.</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.ownRights}
            onChange={(event) => updateCheckbox("ownRights", event.target.checked)}
          />
          <span>I own this clip or have full permission from the owner to submit it.</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.peopleConsent}
            onChange={(event) => updateCheckbox("peopleConsent", event.target.checked)}
          />
          <span>Any recognizable people shown or heard have consented to public sharing.</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.ageConfirm}
            onChange={(event) => updateCheckbox("ageConfirm", event.target.checked)}
          />
          <span>I am 18 or older, or I am submitting with parent/legal guardian permission.</span>
        </label>

        <label>
          <input
            type="checkbox"
            checked={form.contentConfirm}
            onChange={(event) => updateCheckbox("contentConfirm", event.target.checked)}
          />
          <span>The clip does not contain prohibited content listed on this page.</span>
        </label>
      </div>

      <div className="ttv-submit-release-box">
        <strong>Required clip release</strong>
        <p>
          By submitting this clip, I confirm that I am the owner of the
          submitted content or that I have full legal permission to submit it. I
          confirm that I have obtained permission from any recognizable people
          appearing or speaking in the clip.
        </p>
        <p>
          I grant Tate&apos;s TV and its related brands, including FailZone, a
          non-exclusive, worldwide, royalty-free, transferable license to use,
          edit, reproduce, publish, display, broadcast, stream, distribute,
          monetize, promote, and create derivative works from the submitted
          clip across Tate&apos;s TV websites, apps, channels, social media pages,
          advertisements, promotional materials, and future distribution
          platforms.
        </p>
        <p>
          I understand that Tate&apos;s TV may edit the clip for length, format,
          captions, commentary, branding, scheduling, and broadcast standards. I
          understand that submission does not guarantee that my clip will be
          used. I understand that I will not receive payment unless a separate
          written agreement is made.
        </p>

        <label>
          <input
            type="checkbox"
            checked={form.rightsAgreement}
            onChange={(event) => updateCheckbox("rightsAgreement", event.target.checked)}
          />
          <span>I agree to the Tate&apos;s TV / FailZone clip release terms.</span>
        </label>
      </div>

      {errors.length > 0 ? (
        <div className="ttv-submit-errors" aria-live="polite">
          <strong>Before submitting:</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {message ? (
        <div className="ttv-submit-message" data-success={copied ? "true" : "false"}>
          {message}
        </div>
      ) : null}

      <div className="ttv-submit-actions">
        <button type="submit" disabled={!canSubmit}>
          Submit Clip for Review
        </button>
        <button type="button" onClick={copySubmission}>
          Copy Submission Details
        </button>
      </div>

      <p className="ttv-submit-note">
        Large video files should be uploaded to a shareable cloud link first.
        Keep the link accessible until Tate&apos;s TV finishes review.
      </p>
    </form>
  );
}
