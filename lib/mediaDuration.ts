export type DurationProbeResult = {
  duration: number;
  durationLabel: string;
};

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

export function probeVideoDuration(src: string): Promise<DurationProbeResult> {
  return new Promise((resolve, reject) => {
    const cleanSrc = src.trim();

    if (!cleanSrc) {
      reject(new Error("Missing video URL."));
      return;
    }

    const video = document.createElement("video");

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
    };

    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Could not detect duration. Check the URL/CORS settings."));
    }, 15000);

    video.preload = "metadata";
    video.crossOrigin = "anonymous";
    video.src = cleanSrc;

    video.onloadedmetadata = () => {
      window.clearTimeout(timeout);

      const duration = Math.round(video.duration);

      cleanup();

      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("Video duration was not readable."));
        return;
      }

      resolve({
        duration,
        durationLabel: formatDuration(duration),
      });
    };

    video.onerror = () => {
      window.clearTimeout(timeout);
      cleanup();
      reject(new Error("Failed to load video metadata."));
    };
  });
}