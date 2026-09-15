export type NativeTvKind = "airplay" | "remote" | null;

export interface NativeTvVideo extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
}

export function nativeTvKind(video: NativeTvVideo | null): NativeTvKind {
  if (typeof video?.webkitShowPlaybackTargetPicker === "function") return "airplay";
  if (typeof video?.remote?.prompt === "function") return "remote";
  return null;
}

/** SDK errors can be strings, Error objects or { code, description } objects. */
export function tvConnectionError(error: unknown): string {
  const details = error && typeof error === "object"
    ? error as { code?: unknown; name?: unknown; message?: unknown }
    : {};
  const code = [error, details.code, details.name, details.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ").toLowerCase();
  if (/cancel|aborterror/.test(code)) return "";
  if (/notfound|receiver_unavailable/.test(code)) {
    return "No compatible TV was found. Check the same Wi-Fi connection and try again. For Roku on Samsung, use Smart View below.";
  }
  if (/notallowed|invalidstate/.test(code)) {
    return "Tap Choose TV again and allow the browser's connection request.";
  }
  if (/timeout/.test(code)) return "The TV did not respond. Make sure it is awake, then try again.";
  if (/load_media|media_error/.test(code)) {
    return "The TV connected but could not play this programme. Try another channel or reconnect.";
  }
  return "The TV connection could not be completed. Check your Wi-Fi connection and try again.";
}

/** Invoke the picker before yielding so the browser retains the user's tap. */
export async function promptNativeTv(video: NativeTvVideo | null): Promise<string> {
  if (!video) return "Start a channel before choosing a TV.";
  try {
    if (nativeTvKind(video) === "airplay") {
      video.webkitShowPlaybackTargetPicker!();
      return "";
    }
    if (nativeTvKind(video) === "remote") {
      await video.remote.prompt();
      return "";
    }
    return "This browser has no TV picker. Use the connection steps below.";
  } catch (error) {
    return tvConnectionError(error);
  }
}
