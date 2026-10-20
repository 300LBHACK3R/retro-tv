import { batchFileType } from "./batchMedia";

export type SignedBatchUpload = { uploadUrl: string; publicUrl: string; expiresAt: number };
export async function signBatchUpload(file: File, folder: string, signal: AbortSignal): Promise<SignedBatchUpload> {
  const response = await fetch("/api/admin/uploads/sign", { method: "POST", credentials: "same-origin", signal,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, contentType: batchFileType(file), size: file.size, folder }) });
  const result = await response.json();
  if (!response.ok || !result.ok || !result.uploadUrl || !result.publicUrl) throw new Error(result.error || "Could not prepare upload. Check your admin session.");
  return { uploadUrl: result.uploadUrl, publicUrl: result.publicUrl, expiresAt: Date.now() + (result.expiresInSeconds || 3600) * 1000 };
}

export function putBatchVideo(file: File, signed: SignedBatchUpload, signal: AbortSignal, progress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    const finish = (error?: Error) => { signal.removeEventListener("abort", abort); if (error) reject(error); else resolve(); };
    if (signal.aborted) { finish(new DOMException("Paused", "AbortError")); return; }
    xhr.open("PUT", signed.uploadUrl);
    xhr.setRequestHeader("Content-Type", batchFileType(file));
    xhr.timeout = 60 * 60 * 1000;
    xhr.upload.onprogress = event => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => finish(xhr.status >= 200 && xhr.status < 300 ? undefined : new Error(`Upload returned ${xhr.status}. Retry this file.`));
    xhr.onerror = () => finish(new Error("Upload failed. Check your connection and R2 CORS, then retry."));
    xhr.ontimeout = () => finish(new Error("Upload timed out. Retry on a faster connection."));
    xhr.onabort = () => finish(new DOMException("Paused", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    xhr.send(file);
  });
}
