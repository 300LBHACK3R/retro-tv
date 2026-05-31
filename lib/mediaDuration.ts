export type DurationProbeResult = {
  duration: number;
  durationLabel: string;
};

const DEFAULT_PROBE_TIMEOUT_MS = 15000;
const FALLBACK_SEEK_TIME_SECONDS = 24 * 60 * 60;

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainingSeconds}s`;
  }

  return `${minutes}m ${remainingSeconds}s`;
}

function getReadableDuration(video: HTMLVideoElement): number | null {
  const duration = Math.round(video.duration);

  if (Number.isFinite(duration) && duration > 0) {
    return duration;
  }

  return null;
}

function createProbeError(message: string): Error {
  return new Error(message);
}

export function probeVideoDuration(
  src: string,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
): Promise<DurationProbeResult> {
  return new Promise((resolve, reject) => {
    const cleanSrc = src.trim();

    if (!cleanSrc) {
      reject(createProbeError("Missing video URL."));
      return;
    }

    if (typeof document === "undefined") {
      reject(createProbeError("Video duration probing requires a browser."));
      return;
    }

    const video = document.createElement("video");
    let settled = false;
    let attemptedFallbackSeek = false;

    const cleanup = () => {
      video.onloadedmetadata = null;
      video.ondurationchange = null;
      video.onseeked = null;
      video.onerror = null;

      video.pause();
      video.removeAttribute("src");
      video.load();
    };

    const finish = (duration: number) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      cleanup();

      resolve({
        duration,
        durationLabel: formatDuration(duration),
      });
    };

    const fail = (message: string) => {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      cleanup();
      reject(createProbeError(message));
    };

    const tryResolveDuration = () => {
      const duration = getReadableDuration(video);

      if (duration) {
        finish(duration);
        return;
      }

      /**
       * Some media/CDN/browser combinations report duration as Infinity
       * until the video is seeked near the end. This fallback can recover
       * durations for certain MP4/MKV/transcoded files.
       */
      if (!attemptedFallbackSeek && video.readyState >= 1) {
        attemptedFallbackSeek = true;

        try {
          video.currentTime = FALLBACK_SEEK_TIME_SECONDS;
        } catch {
          fail("Video metadata loaded, but duration was not readable.");
        }
      }
    };

    const timeout = window.setTimeout(() => {
      fail("Could not detect duration. Check the URL, CORS settings, and video encoding.");
    }, timeoutMs);

    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.src = cleanSrc;

    video.onloadedmetadata = tryResolveDuration;
    video.ondurationchange = tryResolveDuration;
    video.onseeked = tryResolveDuration;

    video.onerror = () => {
      fail("Failed to load video metadata. Check the file URL, CORS permissions, and format.");
    };

    video.load();
  });
}