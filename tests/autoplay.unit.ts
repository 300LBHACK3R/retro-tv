import { expect, test } from "@playwright/test";
import { playWithAutoplayFallback } from "../lib/autoplay";

test("allowed playback starts with the viewer's audio choice in one attempt", async () => {
  let calls = 0;
  const video = { muted: false, play: async () => { calls += 1; } };
  expect(await playWithAutoplayFallback(video, () => true, () => { throw new Error("Unexpected mute"); })).toBe("playing");
  expect(calls).toBe(1);
  expect(video.muted).toBe(false);
});

test("an audible autoplay denial starts muted without stopping at a Play screen", async () => {
  const audioStates: boolean[] = [];
  let notices = 0;
  const video = { muted: false, play: async () => {
    audioStates.push(video.muted);
    if (!video.muted) throw new DOMException("Needs gesture", "NotAllowedError");
  } };
  expect(await playWithAutoplayFallback(video, () => true, () => { notices += 1; })).toBe("playing");
  expect(audioStates).toEqual([false, true]);
  expect(notices).toBe(1);
});

test("a browser that also blocks muted playback gets a bounded manual fallback", async () => {
  let calls = 0;
  const video = { muted: false, play: async () => {
    calls += 1;
    throw new DOMException("Device policy", "NotAllowedError");
  } };
  expect(await playWithAutoplayFallback(video, () => true, () => {})).toBe("blocked");
  expect(calls).toBe(2);
});

test("source interruption does not become an autoplay denial", async () => {
  const video = { muted: false, play: async () => { throw new DOMException("New source", "AbortError"); } };
  expect(await playWithAutoplayFallback(video, () => true, () => { throw new Error("Unexpected mute"); })).toBe("superseded");
  expect(video.muted).toBe(false);
});

test("a late rejection cannot mute or pause the next channel", async () => {
  let reject!: (reason: Error) => void;
  let current = true;
  const video = { muted: false, play: () => new Promise<void>((_, fail) => { reject = fail; }) };
  const result = playWithAutoplayFallback(video, () => current, () => { throw new Error("Stale mute"); });
  current = false;
  reject(new DOMException("Old channel", "NotAllowedError"));
  expect(await result).toBe("superseded");
  expect(video.muted).toBe(false);
});

test("a late successful play cannot mark the next channel as already playing", async () => {
  let resolve!: () => void;
  let current = true;
  const video = { muted: false, play: () => new Promise<void>((done) => { resolve = done; }) };
  const result = playWithAutoplayFallback(video, () => current, () => {});
  current = false;
  resolve();
  expect(await result).toBe("superseded");
});

test("unsupported media keeps its actual error instead of asking for autoplay permission", async () => {
  const error = new DOMException("Codec unavailable", "NotSupportedError");
  const video = { muted: false, play: async () => { throw error; } };
  await expect(playWithAutoplayFallback(video, () => true, () => {})).rejects.toBe(error);
  expect(video.muted).toBe(false);
});
