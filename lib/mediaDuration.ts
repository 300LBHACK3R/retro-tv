export type DurationProbeResult = {
  duration: number;
  durationLabel: string;
};

const DEFAULT_PROBE_TIMEOUT_MS = 15000;
const MIN_PROBE_TIMEOUT_MS = 3000;
const MAX_PROBE_TIMEOUT_MS = 60000;
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

function normalizeTimeoutMs(timeoutMs: number): number {
  const safeTimeout = Math.floor(Number(timeoutMs));

  if (!Number.isFinite(safeTimeout)) {
    return DEFAULT_PROBE_TIMEOUT_MS;
  }

  return Math.min(
    MAX_PROBE_TIMEOUT_MS,
    Math.max(MIN_PROBE_TIMEOUT_MS, safeTimeout),
  );
}

function createProbeError(message: string): Error {
  return new Error(message);
}

function getMediaErrorMessage(video: HTMLVideoElement): string {
  const error = video.error;

  if (!error) {
    return "Failed to load video metadata. Check the file URL, permissions, and format.";
  }

  if (error.code === MediaError.MEDIA_ERR_ABORTED) {
    return "Video metadata loading was aborted.";
  }

  if (error.code === MediaError.MEDIA_ERR_NETWORK) {
    return "Network error while loading video metadata. Check the URL and CDN access.";
  }

  if (error.code === MediaError.MEDIA_ERR_DECODE) {
    return "The browser could not decode this video. MP4/H.264/AAC is recommended.";
  }

  if (error.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "This video source or format is not supported by the browser.";
  }

  return "Failed to load video metadata. Check the file URL, permissions, and format.";
}

function getSeekableDuration(video: HTMLVideoElement): number | null {
  try {
    const seekable = video.seekable;

    if (!seekable || seekable.length <= 0) {
      return null;
    }

    const end = Math.round(seekable.end(seekable.length - 1));

    if (Number.isFinite(end) && end > 0) {
      return end;
    }

    return null;
  } catch {
    return null;
  }
}

function getReadableDuration(video: HTMLVideoElement): number | null {
  const duration = Math.round(video.duration);

  if (Number.isFinite(duration) && duration > 0) {
    return duration;
  }

  return getSeekableDuration(video);
}

function canUseBrowserVideo(): boolean {
  return typeof document !== "undefined" && typeof window !== "undefined";
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

    if (!canUseBrowserVideo()) {
      reject(createProbeError("Video duration probing requires a browser."));
      return;
    }

    const video = document.createElement("video");
    const safeTimeoutMs = normalizeTimeoutMs(timeoutMs);

    let settled = false;
    let attemptedFallbackSeek = false;
    let timeoutId: number | null = null;

    const cleanup = () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }

      video.removeEventListener("loadedmetadata", tryResolveDuration);
      video.removeEventListener("durationchange", tryResolveDuration);
      video.removeEventListener("loadeddata", tryResolveDuration);
      video.removeEventListener("canplay", tryResolveDuration);
      video.removeEventListener("seeked", tryResolveDuration);
      video.removeEventListener("error", handleError);

      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        // Detached probe cleanup should never break the caller.
      }
    };

    const finish = (duration: number) => {
      if (settled) {
        return;
      }

      settled = true;
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
      cleanup();
      reject(createProbeError(message));
    };

    function tryFallbackSeek() {
      if (attemptedFallbackSeek || video.readyState < 1) {
        return;
      }

      attemptedFallbackSeek = true;

      try {
        video.currentTime = FALLBACK_SEEK_TIME_SECONDS;
      } catch {
        fail("Video metadata loaded, but duration was not readable.");
      }
    }

    function tryResolveDuration() {
      const duration = getReadableDuration(video);

      if (duration) {
        finish(duration);
        return;
      }

      /**
       * Some media/CDN/browser combinations report duration as Infinity until
       * the video is seeked near the end. This can recover duration for some
       * MP4/MKV/transcoded files.
       */
      tryFallbackSeek();
    }

    function handleError() {
      fail(getMediaErrorMessage(video));
    }

    timeoutId = window.setTimeout(() => {
      fail(
        "Could not detect duration. Check the URL, CDN permissions, and video encoding.",
      );
    }, safeTimeoutMs);

    video.addEventListener("loadedmetadata", tryResolveDuration);
    video.addEventListener("durationchange", tryResolveDuration);
    video.addEventListener("loadeddata", tryResolveDuration);
    video.addEventListener("canplay", tryResolveDuration);
    video.addEventListener("seeked", tryResolveDuration);
    video.addEventListener("error", handleError);

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    /**
     * Do not force crossOrigin here.
     * A video can often play/probe metadata without CORS, while setting
     * crossOrigin="anonymous" can make public CDN files fail unless headers
     * are perfect.
     */
    video.src = cleanSrc;
    video.load();
  });
}