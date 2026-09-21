"use client";
import { useEffect, useRef, useState } from "react";
import { safeArtworkUrl } from "@/lib/libraryPresentation";
import styles from "./library.module.css";

async function prepareImage(file: File): Promise<Blob> {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024 ||
    !file.size
  )
    throw new Error("Choose a JPG, PNG or WebP image under 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () =>
        reject(new Error("This image could not be opened."));
    });
    const scale = Math.min(1, 1500 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error(
        "Image preparation is unavailable in this browser. Use an artwork URL instead.",
      );
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.85),
    );
    if (
      !blob ||
      !["image/webp", "image/png", "image/jpeg"].includes(blob.type) ||
      blob.size > 3 * 1024 * 1024
    )
      throw new Error(
        "Use a smaller image; the prepared poster must be under 3 MB.",
      );
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export default function ArtworkEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [url, setUrl] = useState(value);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => setUrl(value), [value]);
  async function upload(file: File) {
    setBusy(true);
    setMessage("Preparing your poster…");
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 90000);
    try {
      const blob = await prepareImage(file);
      if (!mounted.current) return;
      setMessage("Uploading artwork…");
      const response = await fetch("/api/admin/artwork/sign", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: blob.type, size: blob.size }),
        signal: abort.signal,
      });
      const signed = await response.json();
      if (!response.ok || !signed.ok)
        throw new Error(signed.error || "Artwork upload could not start.");
      if (
        !safeArtworkUrl(signed.publicUrl) ||
        typeof signed.uploadUrl !== "string"
      )
        throw new Error("Storage returned an invalid artwork link.");
      const put = await fetch(signed.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": blob.type },
        body: blob,
        signal: abort.signal,
      });
      if (!put.ok)
        throw new Error(
          "Storage did not accept the artwork. Check the R2 upload configuration.",
        );
      if (mounted.current) {
        onChange(signed.publicUrl);
        setUrl(signed.publicUrl);
        setMessage("Poster ready. Save your artwork changes below.");
      }
    } catch (error) {
      if (mounted.current)
        setMessage(
          error instanceof Error
            ? error.name === "AbortError"
              ? "Upload timed out. Please try again."
              : error.message
            : "Upload failed.",
        );
    } finally {
      window.clearTimeout(timeout);
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className={styles.fields}>
      <label>
        Upload poster
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      <p className={styles.muted}>
        Portrait artwork works best (2:3). JPG, PNG or WebP, up to 10 MB.
        Uploads are resized for faster browsing.
      </p>
      <label>
        Artwork URL
        <input
          type="text"
          inputMode="url"
          maxLength={2048}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
        />
      </label>
      <button
        type="button"
        className={styles.button}
        disabled={busy}
        onClick={() => {
          const safe = safeArtworkUrl(url);
          if (safe) {
            onChange(safe);
            setMessage("Artwork selected. Save your changes below.");
          } else
            setMessage("Use an HTTPS image URL or a path starting with /.");
        }}
      >
        Use artwork URL
      </button>
      <p className={styles.status} role="status">
        {message}
      </p>
    </div>
  );
}
