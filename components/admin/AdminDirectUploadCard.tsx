"use client";

import { useEffect, useRef, useState } from "react";

type SignedUploadResponse = {
  ok?: boolean;
  uploadUrl?: string;
  objectKey?: string;
  publicUrl?: string;
  error?: string;
};

type UploadStatus = "idle" | "signing" | "uploading" | "complete" | "error";

const ACCEPTED_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
];

const MAX_FILE_SIZE_BYTES = Math.floor(4.9 * 1024 * 1024 * 1024);

function inferMimeType(file: File): string {
  if (ACCEPTED_TYPES.includes(file.type)) return file.type;

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "mp4") return "video/mp4";
  if (extension === "webm") return "video/webm";
  if (extension === "mov") return "video/quicktime";
  if (extension === "m4v") return "video/x-m4v";

  return file.type;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024)),
  );
  const value = bytes / 1024 ** index;

  return `${value >= 100 || index === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[index]}`;
}

function readJsonSafe<T>(response: Response): Promise<T | null> {
  return response.json().catch(() => null) as Promise<T | null>;
}

export default function AdminDirectUploadCard({
  defaultFolder,
  onUploaded,
}: {
  defaultFolder: string;
  onUploaded: (payload: {
    publicUrl: string;
    objectKey: string;
    filename: string;
  }) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState(defaultFolder);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState(
    "Choose a browser-ready video and upload it directly to Cloudflare R2.",
  );

  useEffect(() => {
    if (status === "idle" && !file) {
      setFolder(defaultFolder);
    }
  }, [defaultFolder, file, status]);

  useEffect(() => {
    return () => {
      xhrRef.current?.abort();
    };
  }, []);

  const chooseFile = (nextFile: File | null) => {
    setProgress(0);
    setStatus("idle");

    if (!nextFile) {
      setFile(null);
      setMessage("Choose a browser-ready video and upload it directly to Cloudflare R2.");
      return;
    }

    const contentType = inferMimeType(nextFile);

    if (!ACCEPTED_TYPES.includes(contentType)) {
      setFile(null);
      setStatus("error");
      setMessage("Use an MP4, WebM, MOV, or M4V file.");
      return;
    }

    if (nextFile.size <= 0 || nextFile.size > MAX_FILE_SIZE_BYTES) {
      setFile(null);
      setStatus("error");
      setMessage("The selected file is empty or exceeds the 4.9 GB direct-upload limit. Use rclone for larger media.");
      return;
    }

    setFile(nextFile);
    setMessage(`${nextFile.name} selected • ${formatBytes(nextFile.size)}.`);
  };

  const cancelUpload = () => {
    xhrRef.current?.abort();
    xhrRef.current = null;
    setStatus("idle");
    setProgress(0);
    setMessage("Upload cancelled. The media form was not changed.");
  };

  const upload = async () => {
    if (!file || status === "signing" || status === "uploading") {
      return;
    }

    setStatus("signing");
    setProgress(0);
    setMessage("Preparing a secure R2 upload URL...");

    try {
      const signResponse = await fetch("/api/admin/uploads/sign", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: inferMimeType(file),
          size: file.size,
          folder,
        }),
      });

      const signed = await readJsonSafe<SignedUploadResponse>(signResponse);

      if (
        !signResponse.ok ||
        !signed?.ok ||
        !signed.uploadUrl ||
        !signed.publicUrl ||
        !signed.objectKey
      ) {
        throw new Error(signed?.error || "Could not prepare the R2 upload.");
      }

      setStatus("uploading");
      setMessage("Uploading directly to Cloudflare R2. Keep this page open.");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.open("PUT", signed.uploadUrl!, true);
        xhr.setRequestHeader("Content-Type", inferMimeType(file));

        xhr.upload.onprogress = (event) => {
          if (!event.lengthComputable) return;
          setProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
        };

        xhr.onerror = () => reject(new Error("The R2 upload failed. Check bucket CORS and try again."));
        xhr.onabort = () => reject(new DOMException("Upload cancelled.", "AbortError"));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
            return;
          }

          reject(new Error(`R2 rejected the upload with status ${xhr.status}.`));
        };

        xhr.send(file);
      });

      xhrRef.current = null;
      setProgress(100);
      setStatus("complete");
      setMessage("Upload complete. The public R2 URL was inserted into the media form.");

      onUploaded({
        publicUrl: signed.publicUrl,
        objectKey: signed.objectKey,
        filename: file.name,
      });
    } catch (error) {
      xhrRef.current = null;

      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      setStatus("error");
      setMessage(error instanceof Error ? error.message : "The upload failed.");
    }
  };

  const busy = status === "signing" || status === "uploading";

  return (
    <section
      className="overflow-hidden rounded-3xl border"
      style={{
        borderColor: "color-mix(in srgb, var(--primary) 42%, var(--border))",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--primary) 11%, var(--panel-bg)), var(--panel-bg) 70%)",
        boxShadow: "0 20px 55px rgba(0,0,0,0.2)",
      }}
    >
      <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_minmax(16rem,0.55fr)]">
        <div className="min-w-0">
          <div
            className="text-[10px] font-black uppercase tracking-[0.2em]"
            style={{ color: "var(--primary)" }}
          >
            Direct R2 Upload
          </div>
          <h3 className="mt-1 text-lg font-black tracking-tight">
            Upload the file without leaving Admin
          </h3>
          <p className="mt-2 max-w-3xl text-xs leading-5" style={{ color: "var(--text-muted)" }}>
            The browser uploads straight to Cloudflare R2 through a short-lived signed URL.
            Your R2 keys never reach the browser or the saved programming data.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.45fr)]">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="ttv-touch-target rounded-2xl border px-4 py-4 text-left transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                borderColor: file ? "var(--primary)" : "var(--border)",
                background: "var(--panel-alt-bg)",
                color: "var(--text)",
              }}
            >
              <span className="block text-xs font-black uppercase tracking-[0.12em]">
                {file ? "Change Video" : "Choose Video"}
              </span>
              <span className="mt-1 block truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                {file ? `${file.name} • ${formatBytes(file.size)}` : "MP4, WebM, MOV, or M4V • up to 4.9 GB"}
              </span>
            </button>

            <label className="grid gap-1.5">
              <span className="text-xs font-black">R2 Folder</span>
              <input
                value={folder}
                onChange={(event) => setFolder(event.target.value.slice(0, 120))}
                disabled={busy}
                className="min-w-0 rounded-2xl border px-4 py-3 text-sm outline-none disabled:opacity-60"
                style={{
                  background: "var(--panel-alt-bg)",
                  borderColor: "var(--border)",
                  color: "var(--text)",
                }}
                placeholder="Movies"
              />
            </label>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov,.m4v"
            className="sr-only"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div
          className="flex min-w-0 flex-col justify-between rounded-2xl border p-4"
          style={{
            borderColor: status === "error" ? "rgba(248,113,113,0.45)" : "var(--border)",
            background: "var(--panel-alt-bg)",
          }}
        >
          <div>
            <div className="flex items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span>{status === "complete" ? "Complete" : busy ? "Uploading" : "Ready"}</span>
              <span style={{ color: "var(--primary)" }}>{progress}%</span>
            </div>

            <div
              className="mt-3 h-2 overflow-hidden rounded-full"
              style={{ background: "rgba(255,255,255,0.08)" }}
              aria-label={`Upload progress ${progress}%`}
            >
              <div
                className="h-full rounded-full transition-[width] duration-200"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, var(--primary), #ffffff)",
                  boxShadow: "0 0 18px color-mix(in srgb, var(--primary) 55%, transparent)",
                }}
              />
            </div>

            <p className="mt-3 text-xs leading-5" style={{ color: status === "error" ? "#fca5a5" : "var(--text-muted)" }}>
              {message}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void upload()}
              disabled={!file || busy}
              className="ttv-action-button ttv-touch-target flex-1 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {status === "signing" ? "Preparing" : status === "uploading" ? "Uploading" : "Upload to R2"}
            </button>

            {busy ? (
              <button
                type="button"
                onClick={cancelUpload}
                className="ttv-touch-target rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-[0.12em]"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--button-bg)",
                  color: "var(--text)",
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
