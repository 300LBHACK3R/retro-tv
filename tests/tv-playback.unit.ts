import { test, expect } from "@playwright/test";
import { nativeTvKind, promptNativeTv, tvConnectionError, type NativeTvVideo } from "../lib/tvPlayback";

test("AirPlay picker runs in the tap stack, uses its video receiver and does not invoke a second picker", async () => {
  let called = 0;
  const video = {
    webkitShowPlaybackTargetPicker() { expect(this).toBe(video); called += 1; },
    remote: { prompt() { throw new Error("Do not launch a second protocol"); } },
  } as unknown as NativeTvVideo;
  const result = promptNativeTv(video);
  // User activation must survive: the picker has already run before awaiting.
  expect(called).toBe(1);
  expect(nativeTvKind(video)).toBe("airplay");
  expect(await result).toBe("");
});

test("browser picker retains its receiver and user cancellation is not an error", async () => {
  let called = false;
  const remote = { prompt() {
    expect(this).toBe(remote);
    called = true;
    return Promise.reject(new DOMException("Cancelled", "AbortError"));
  } };
  const video = { remote } as unknown as NativeTvVideo;
  const result = promptNativeTv(video);
  expect(called).toBe(true);
  expect(nativeTvKind(video)).toBe("remote");
  expect(await result).toBe("");
});

test("unsupported devices and permission errors get actionable instructions", async () => {
  expect(nativeTvKind({} as NativeTvVideo)).toBeNull();
  expect(await promptNativeTv(null)).toContain("Start a channel");
  expect(await promptNativeTv({} as NativeTvVideo)).toContain("no TV picker");
  const blocked = { remote: { prompt: () => Promise.reject(new DOMException("Blocked", "NotAllowedError")) } } as unknown as NativeTvVideo;
  expect(await promptNativeTv(blocked)).toContain("allow the browser");
});

test("Cast SDK string and object errors distinguish cancellation, missing receivers and media failures", () => {
  expect(tvConnectionError("cancel")).toBe("");
  expect(tvConnectionError({ code: "cancel", description: "User closed picker" })).toBe("");
  expect(tvConnectionError({ code: "timeout" })).toContain("did not respond");
  expect(tvConnectionError({ code: "receiver_unavailable" })).toContain("Smart View");
  expect(tvConnectionError("load_media_failed")).toContain("could not play");
  expect(tvConnectionError({ code: "session_error" })).toContain("try again");
});
