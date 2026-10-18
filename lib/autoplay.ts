export type AutoplayResult = "playing" | "blocked" | "superseded";

/** A cancelled source request is not an autoplay denial. Never mute a newer tune. */
export async function playWithAutoplayFallback(
  video: Pick<HTMLVideoElement, "play" | "muted">,
  isCurrent: () => boolean,
  onMuted: () => void,
): Promise<AutoplayResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await video.play();
      return isCurrent() ? "playing" : "superseded";
    } catch (error) {
      if (!isCurrent()) return "superseded";
      const name = error instanceof Error ? error.name : "";
      if (name === "AbortError") return "superseded";
      if (name !== "NotAllowedError") throw error;
      if (video.muted) return "blocked";
      video.muted = true;
      onMuted();
    }
  }
  return "blocked";
}
