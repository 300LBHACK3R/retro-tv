import { test, expect } from "@playwright/test";
import { mediaResponse } from "./media-response";

const bytes = Buffer.from("0123456789");
test("media fixtures advertise seeking and honor Chromium's initial range request", () => {
  expect(mediaResponse(bytes)).toMatchObject({ status: 200, headers: { "accept-ranges": "bytes", "content-length": "10" }, body: bytes });
  expect(mediaResponse(bytes, "bytes=0-")).toMatchObject({ status: 206, headers: { "content-range": "bytes 0-9/10", "content-length": "10" }, body: bytes });
});
test("media fixture range bodies match the requested offsets and lengths", () => {
  for (const [range, body, contentRange] of [
    ["bytes=3-5", "345", "bytes 3-5/10"],
    ["bytes=7-", "789", "bytes 7-9/10"],
    ["bytes=8-99", "89", "bytes 8-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
  ] as const) {
    const response = mediaResponse(bytes, range);
    expect(response.status).toBe(206);
    expect(response.body.toString()).toBe(body);
    expect(response.headers).toMatchObject({ "content-range": contentRange, "content-length": String(body.length) });
  }
});
test("invalid media ranges fail instead of silently returning the whole movie", () => {
  for (const range of ["bytes=10-", "bytes=8-2", "bytes=-0", "bytes=-", "invalid", "bytes=0-1,3-4"]) {
    expect(mediaResponse(bytes, range)).toMatchObject({ status: 416, headers: { "content-range": "bytes */10" }, body: Buffer.alloc(0) });
  }
});
