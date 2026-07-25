"use client";

import {
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type FormState = {
  name: string;
  email: string;
  creditName: string;
  clipTitle: string;
  description: string;
  location: string;
  shareUrl: string;
  website: string;
  filmedByYou: boolean;
  ownRights: boolean;
  peopleConsent: boolean;
  ageConfirm: boolean;
  contentConfirm: boolean;
  rightsAgreement: boolean;
};

type UploadMode = "file" | "link";
type SubmissionStatus =
  | "idle"
  | "signing"
  | "uploading"
  | "saving"
  | "success"
  | "error";

type SignedUploadResponse = {
  ok?: boolean;
  uploadUrl?: string;
  objectKey?: string;
  error?: string;
};

type SubmissionResponse = {
  ok?: boolean;
  referenceCode?: string;
  message?: string;
  error?: string;
};

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
]);

const initialState: FormState = {
  name: "",
  email: "",
  creditName: "",
  clipTitle: "",
  description: "",
  location: "",
  shareUrl: "",
  website: "",
  filmedByYou: false,
  ownRights: false,
  peopleConsent: false,
  ageConfirm: false,
  contentConfirm: false,
  rightsAgreement: false,
};

function clean(value: string): string {
  return value.trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value));
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(clean(value));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** index;

  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function inferMimeType(file: File): string {
  if (ACCEPTED_MIME_TYPES.has(file.type)) {
    return file.type;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "mp4") return "video/mp4";
  if (extension === "webm") return "video/webm";
  if (extension === "mov") return "video/quicktime";
  if (extension === "m4v") return "video/x-m4v";

  return file.type;
}

function readJsonSafe<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null) as Promise<T | null>;
}

function uploadWithProgress({
  url,
  file,
  contentType,
  onProgress,
  onRequest,
}: {
  url: string;
  file: File;
  contentType: string;
  onProgress: (progress: number) => void;
  onRequest: (request: XMLHttpRequest) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    onRequest(xhr);

    xhr.open("PUT", url, true);
    xhr.setRequestHeader("Content-Type", contentType);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onerror = () =>
      reject(
        new Error(
          "The video upload failed. Check your connection and try again.",
        ),
      );
    xhr.onabort = () =>
      reject(new DOMException("Upload cancelled.", "AbortError"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }

      reject(new Error(`The upload service returned status ${xhr.status}.`));
    };

    xhr.send(file);
  });
}

export default function SubmitClipForm() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null);

  const [form, setForm] = useState<FormState>(initialState);
  const [uploadMode, setUploadMode] = useState<UploadMode>("file");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState<SubmissionStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(
    "Choose your clip, complete the details, and confirm the required rights.",
  );
  const [referenceCode, setReferenceCode] = useState("");

  useEffect(() => {
    return () => {
      uploadRequestRef.current?.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const fileMimeType = useMemo(() => (file ? inferMimeType(file) : ""), [file]);

  const errors = useMemo(() => {
    const nextErrors: string[] = [];

    if (!clean(form.name)) nextErrors.push("Add your full name.");
    if (!isValidEmail(form.email)) nextErrors.push("Add a valid email address.");
    if (!clean(form.clipTitle)) nextErrors.push("Add a clip title.");
    if (!clean(form.description)) nextErrors.push("Describe what happens in the clip.");

    if (uploadMode === "file") {
      if (!file) {
        nextErrors.push("Choose a video file.");
      } else if (!ACCEPTED_MIME_TYPES.has(fileMimeType)) {
        nextErrors.push("Use an MP4, WebM, MOV, or M4V video file.");
      } else if (file.size <= 0 || file.size > MAX_FILE_SIZE_BYTES) {
        nextErrors.push("The video must be larger than 0 bytes and no more than 2 GB.");
      }
    } else if (!isValidUrl(form.shareUrl)) {
      nextErrors.push("Add a valid Google Drive, Dropbox, OneDrive, iCloud, or other shareable link.");
    }

    if (!form.filmedByYou) {
      nextErrors.push("Confirm you filmed or helped create the clip.");
    }
    if (!form.ownRights) {
      nextErrors.push("Confirm you own the clip or have the owner’s permission.");
    }
    if (!form.peopleConsent) {
      nextErrors.push("Confirm recognizable people consented to public sharing.");
    }
    if (!form.ageConfirm) {
      nextErrors.push("Confirm you are 18+ or have parent/legal guardian permission.");
    }
    if (!form.contentConfirm) {
      nextErrors.push("Confirm the clip follows the content rules.");
    }
    if (!form.rightsAgreement) {
      nextErrors.push("Accept the Tate’s TV / FailZone release terms.");
    }

    return nextErrors;
  }, [file, fileMimeType, form, uploadMode]);

  const busy =
    status === "signing" || status === "uploading" || status === "saving";
  const canSubmit = errors.length === 0 && !busy;

  const updateText = (key: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (status === "error") setStatus("idle");
  };

  const updateCheckbox = (key: keyof FormState, value: boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (status === "error") setStatus("idle");
  };

  const chooseFile = (nextFile: File | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setFile(nextFile);
    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : "");
    setProgress(0);
    setReferenceCode("");
    setStatus("idle");

    if (!nextFile) {
      setMessage("Choose an MP4, WebM, MOV, or M4V clip up to 2 GB.");
      return;
    }

    const mimeType = inferMimeType(nextFile);

    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      setMessage("That file format is not supported. Use MP4, WebM, MOV, or M4V.");
      setStatus("error");
      return;
    }

    if (nextFile.size <= 0 || nextFile.size > MAX_FILE_SIZE_BYTES) {
      setMessage("That file is empty or exceeds the 2 GB submission limit.");
      setStatus("error");
      return;
    }

    setMessage(`${nextFile.name} selected • ${formatBytes(nextFile.size)}.`);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);

    if (busy) return;
    chooseFile(event.dataTransfer.files?.[0] ?? null);
  };

  const cancelUpload = () => {
    uploadRequestRef.current?.abort();
    uploadRequestRef.current = null;
    setStatus("idle");
    setProgress(0);
    setMessage("Upload cancelled. Your form details are still here.");
  };

  const reset = () => {
    uploadRequestRef.current?.abort();
    uploadRequestRef.current = null;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setForm(initialState);
    setUploadMode("file");
    setFile(null);
    setPreviewUrl("");
    setProgress(0);
    setStatus("idle");
    setReferenceCode("");
    setMessage("Choose your clip, complete the details, and confirm the required rights.");
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canSubmit) {
      setStatus("error");
      setMessage("Complete every required field and confirmation before submitting.");
      return;
    }

    let objectKey = "";

    try {
      if (uploadMode === "file" && file) {
        setStatus("signing");
        setProgress(0);
        setMessage("Preparing a secure Tate’s TV upload...");

        const signResponse = await fetch("/api/submissions/upload-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            contentType: fileMimeType,
            size: file.size,
            website: form.website,
          }),
        });
        const signed = await readJsonSafe<SignedUploadResponse>(signResponse);

        if (!signResponse.ok || !signed?.ok || !signed.uploadUrl || !signed.objectKey) {
          throw new Error(
            signed?.error ||
              "Direct uploading is temporarily unavailable. Switch to a shareable link or try again.",
          );
        }

        objectKey = signed.objectKey;
        setStatus("uploading");
        setMessage("Uploading your clip directly to Tate’s TV. Keep this page open.");

        await uploadWithProgress({
          url: signed.uploadUrl,
          file,
          contentType: fileMimeType,
          onProgress: setProgress,
          onRequest: (request) => {
            uploadRequestRef.current = request;
          },
        });

        uploadRequestRef.current = null;
        setProgress(100);
      }

      setStatus("saving");
      setMessage("Saving your submission and rights confirmations...");

      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "failzone",
          name: clean(form.name),
          email: clean(form.email),
          creditName: clean(form.creditName),
          clipTitle: clean(form.clipTitle),
          description: clean(form.description),
          location: clean(form.location),
          objectKey,
          originalFilename: uploadMode === "file" ? file?.name ?? "" : "",
          mimeType: uploadMode === "file" ? fileMimeType : "",
          fileSize: uploadMode === "file" ? file?.size ?? 0 : 0,
          shareUrl: uploadMode === "link" ? clean(form.shareUrl) : "",
          filmedByYou: form.filmedByYou,
          ownRights: form.ownRights,
          peopleConsent: form.peopleConsent,
          ageConfirm: form.ageConfirm,
          contentConfirm: form.contentConfirm,
          rightsAgreement: form.rightsAgreement,
          website: form.website,
        }),
      });
      const result = await readJsonSafe<SubmissionResponse>(response);

      if (!response.ok || !result?.ok || !result.referenceCode) {
        throw new Error(result?.error || "The submission could not be saved.");
      }

      setStatus("success");
      setReferenceCode(result.referenceCode);
      setMessage(
        result.message ||
          "Your clip was submitted for manual review. Submission does not guarantee publication.",
      );
    } catch (error) {
      uploadRequestRef.current = null;

      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The submission failed.");
    }
  };

  if (status === "success") {
    return (
      <div className="ttv-submit-success" role="status">
        <div className="ttv-submit-success-icon" aria-hidden="true">
          ✓
        </div>
        <p className="ttv-submit-kicker">Submission received</p>
        <h3>Your clip is in the review queue</h3>
        <p>{message}</p>
        <div className="ttv-submit-reference">
          <span>Reference code</span>
          <strong>{referenceCode}</strong>
        </div>
        <p className="ttv-submit-note">
          Keep this code for your records. Tate’s TV may contact you at {clean(form.email)} if
          clarification or additional permission is required.
        </p>
        <button type="button" onClick={reset} className="ttv-submit-primary-button">
          Submit Another Clip
        </button>
      </div>
    );
  }

  return (
    <form className="ttv-submit-form" onSubmit={submitForm} noValidate>
      <input
        type="text"
        name="website"
        value={form.website}
        onChange={(event) => updateText("website", event.target.value)}
        tabIndex={-1}
        autoComplete="off"
        className="ttv-submit-honeypot"
        aria-hidden="true"
      />

      <section className="ttv-submit-form-section">
        <div className="ttv-submit-form-section-heading">
          <span>1</span>
          <div>
            <h3>Choose your clip</h3>
            <p>Upload directly to Tate’s TV or provide a secure shareable cloud link.</p>
          </div>
        </div>

        <div className="ttv-submit-mode-switch" role="group" aria-label="Clip submission method">
          <button
            type="button"
            data-active={uploadMode === "file"}
            onClick={() => {
              if (!busy) setUploadMode("file");
            }}
          >
            Direct Video Upload
          </button>
          <button
            type="button"
            data-active={uploadMode === "link"}
            onClick={() => {
              if (!busy) setUploadMode("link");
            }}
          >
            Shareable Link
          </button>
        </div>

        {uploadMode === "file" ? (
          <div
            className="ttv-submit-dropzone"
            data-active={dragActive ? "true" : "false"}
            data-has-file={file ? "true" : "false"}
            onDragEnter={(event) => {
              event.preventDefault();
              if (!busy) setDragActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              event.preventDefault();
              if (event.currentTarget === event.target) setDragActive(false);
            }}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              className="sr-only"
            />

            <div className="ttv-submit-dropzone-copy">
              <strong>{file ? file.name : "Drop your video here"}</strong>
              <span>
                {file
                  ? `${formatBytes(file.size)} • ${fileMimeType || "video"}`
                  : "MP4, WebM, MOV, or M4V • maximum 2 GB"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              {file ? "Choose Different File" : "Browse Files"}
            </button>
          </div>
        ) : (
          <label>
            <span>Shareable video link *</span>
            <input
              type="url"
              value={form.shareUrl}
              onChange={(event) => updateText("shareUrl", event.target.value)}
              placeholder="Google Drive, Dropbox, OneDrive, iCloud, or another accessible link"
              disabled={busy}
            />
          </label>
        )}

        {previewUrl && uploadMode === "file" ? (
          <div className="ttv-submit-preview">
            <video src={previewUrl} controls preload="metadata" playsInline />
          </div>
        ) : null}
      </section>

      <section className="ttv-submit-form-section">
        <div className="ttv-submit-form-section-heading">
          <span>2</span>
          <div>
            <h3>Clip and contact details</h3>
            <p>Tell Tate’s TV who submitted it, what happened, and how you want to be credited.</p>
          </div>
        </div>

        <div className="ttv-submit-form-grid">
          <label>
            <span>Your full name *</span>
            <input
              value={form.name}
              onChange={(event) => updateText("name", event.target.value)}
              placeholder="Full legal name"
              maxLength={120}
              disabled={busy}
            />
          </label>

          <label>
            <span>Email *</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateText("email", event.target.value)}
              placeholder="you@example.com"
              maxLength={254}
              disabled={busy}
            />
          </label>

          <label>
            <span>Credit name</span>
            <input
              value={form.creditName}
              onChange={(event) => updateText("creditName", event.target.value)}
              placeholder="Name shown on screen, or leave blank"
              maxLength={120}
              disabled={busy}
            />
          </label>

          <label>
            <span>Clip title *</span>
            <input
              value={form.clipTitle}
              onChange={(event) => updateText("clipTitle", event.target.value)}
              placeholder="Example: Hoverboard Pool Fail"
              maxLength={160}
              disabled={busy}
            />
          </label>
        </div>

        <label>
          <span>Where / when did it happen?</span>
          <input
            value={form.location}
            onChange={(event) => updateText("location", event.target.value)}
            placeholder="City, event, approximate date, or useful context"
            maxLength={240}
            disabled={busy}
          />
        </label>

        <label>
          <span>What happens in the clip? *</span>
          <textarea
            value={form.description}
            onChange={(event) => updateText("description", event.target.value)}
            placeholder="Describe the moment, who is involved, and why it belongs on FailZone."
            rows={6}
            maxLength={3000}
            disabled={busy}
          />
          <small>{form.description.length}/3000 characters</small>
        </label>
      </section>

      <section className="ttv-submit-form-section">
        <div className="ttv-submit-form-section-heading">
          <span>3</span>
          <div>
            <h3>Rights, consent, and safety</h3>
            <p>Every confirmation is required before a clip enters the moderation queue.</p>
          </div>
        </div>

        <div className="ttv-submit-checks">
          <label>
            <input
              type="checkbox"
              checked={form.filmedByYou}
              onChange={(event) => updateCheckbox("filmedByYou", event.target.checked)}
              disabled={busy}
            />
            <span>I filmed this clip myself or was directly involved in creating it.</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.ownRights}
              onChange={(event) => updateCheckbox("ownRights", event.target.checked)}
              disabled={busy}
            />
            <span>I own this clip or have full permission from the owner to submit it.</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.peopleConsent}
              onChange={(event) => updateCheckbox("peopleConsent", event.target.checked)}
              disabled={busy}
            />
            <span>Any recognizable people shown or heard have consented to public sharing.</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.ageConfirm}
              onChange={(event) => updateCheckbox("ageConfirm", event.target.checked)}
              disabled={busy}
            />
            <span>I am 18 or older, or I am submitting with parent/legal guardian permission.</span>
          </label>

          <label>
            <input
              type="checkbox"
              checked={form.contentConfirm}
              onChange={(event) => updateCheckbox("contentConfirm", event.target.checked)}
              disabled={busy}
            />
            <span>The clip does not contain prohibited content listed on this page.</span>
          </label>
        </div>

        <div className="ttv-submit-release-box">
          <strong>Required Tate’s TV / FailZone clip release</strong>
          <p>
            I confirm that I own the submitted content or have full legal permission to submit
            it, and that I have obtained permission from recognizable people appearing or
            speaking in the clip.
          </p>
          <p>
            I grant Tate’s TV and its related brands, including FailZone, a non-exclusive,
            worldwide, royalty-free, transferable licence to use, edit, reproduce, publish,
            display, broadcast, stream, distribute, monetize, promote, and create derivative
            works from the submitted clip across current and future Tate’s TV platforms and
            promotional materials.
          </p>
          <p>
            I understand that Tate’s TV may edit the clip for length, format, captions,
            commentary, branding, scheduling, and broadcast standards; submission does not
            guarantee use; and payment applies only when separately agreed in writing.
          </p>

          <label>
            <input
              type="checkbox"
              checked={form.rightsAgreement}
              onChange={(event) => updateCheckbox("rightsAgreement", event.target.checked)}
              disabled={busy}
            />
            <span>I agree to the Tate’s TV / FailZone clip release terms.</span>
          </label>
        </div>
      </section>

      {errors.length > 0 ? (
        <div className="ttv-submit-errors" aria-live="polite">
          <strong>Before submitting</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className="ttv-submit-progress-panel"
        data-state={status}
        aria-live="polite"
      >
        <div className="ttv-submit-progress-copy">
          <strong>
            {status === "signing"
              ? "Preparing upload"
              : status === "uploading"
                ? "Uploading clip"
                : status === "saving"
                  ? "Saving submission"
                  : status === "error"
                    ? "Needs attention"
                    : "Ready for review"}
          </strong>
          <span>{message}</span>
        </div>

        <div className="ttv-submit-progress-track" aria-label={`Upload progress ${progress}%`}>
          <div style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="ttv-submit-actions">
        <button type="submit" disabled={!canSubmit} className="ttv-submit-primary-button">
          {status === "signing"
            ? "Preparing Upload"
            : status === "uploading"
              ? `Uploading ${progress}%`
              : status === "saving"
                ? "Saving Submission"
                : "Submit Clip for Review"}
        </button>

        {status === "uploading" ? (
          <button type="button" onClick={cancelUpload}>
            Cancel Upload
          </button>
        ) : (
          <button type="button" onClick={reset} disabled={busy}>
            Reset Form
          </button>
        )}
      </div>

      <p className="ttv-submit-note">
        Every submission is manually reviewed. Uploading does not automatically publish your
        clip or guarantee that Tate’s TV will use it.
      </p>
    </form>
  );
}
