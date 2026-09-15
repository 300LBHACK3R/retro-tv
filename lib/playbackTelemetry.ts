"use client";
import { postTelemetry } from "./analyticsClient";

export interface PlaybackSample {
  id: string;
  channelId: string;
  mediaId: string;
  mode: "live" | "library";
  watchSeconds: number;
  bufferSeconds: number;
  starts: number;
  errors: number;
  startupMs: number;
  reports: number;
}

export async function sendPlaybackSample(
  sample: Omit<PlaybackSample, "id">,
): Promise<boolean> {
  try {
    return await postTelemetry({
      ...sample,
      watchSeconds: Math.min(65, sample.watchSeconds),
      bufferSeconds: Math.min(65, sample.bufferSeconds),
      errors: Math.min(20, sample.errors),
      id: crypto.randomUUID(),
    });
  } catch {
    return false;
  }
}
