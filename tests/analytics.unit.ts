import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import {
  analyticsEnvironment,
  analyticsPath,
  parseAnalyticsEvent,
  trafficSource,
} from "../lib/analyticsEvents";

const event = {
  id: "6406ea15-c50f-4b79-bec0-538adcc52f11",
  name: "page_view",
  path: "/",
  detail: "",
  source: "direct",
  value: 0,
};
test("analytics accepts only known events and rejects private paths and arbitrary data", () => {
  expect(parseAnalyticsEvent(event)).toEqual(event);
  for (const patch of [
    { path: "/admin" },
    { path: "/?email=private" },
    { name: "typed_password" },
    { detail: "John Smith" },
    { profileId: "main" },
    { pin: "1234" },
    { value: NaN },
    { value: 1 },
    { id: "invalid" },
    { source: "https://private.test" },
  ])
    expect(parseAnalyticsEvent({ ...event, ...patch })).toBeNull();
  expect(
    parseAnalyticsEvent({
      ...event,
      name: "startup_time",
      detail: "live",
      value: 1900,
    }),
  ).not.toBeNull();
  expect(
    parseAnalyticsEvent({
      ...event,
      name: "startup_time",
      detail: "live",
      value: 120001,
    }),
  ).toBeNull();
  expect(
    parseAnalyticsEvent({
      ...event,
      name: "theme_change",
      detail: "halloween-night",
    }),
  ).not.toBeNull();
});

test("traffic and device dimensions never include raw URLs or user agents", () => {
  expect(
    trafficSource(
      "https://www.google.ca/search?q=private",
      "https://www.tatestv.ca",
    ),
  ).toBe("search");
  expect(
    trafficSource(
      "https://facebook.com/private-person",
      "https://www.tatestv.ca",
    ),
  ).toBe("social");
  expect(
    trafficSource(
      "https://www.tatestv.ca/library?secret=x",
      "https://www.tatestv.ca",
    ),
  ).toBe("internal");
  expect(
    trafficSource("https://other.test/private", "https://www.tatestv.ca"),
  ).toBe("referral");
  expect(
    analyticsEnvironment(
      "Mozilla/5.0 (iPhone) Version/18.0 Mobile/15 Safari/604.1",
    ),
  ).toEqual({ browser: "Safari", device: "Phone" });
  expect(
    analyticsEnvironment(
      "Mozilla/5.0 Android Mobile Chrome/140 SamsungBrowser/28",
    ),
  ).toEqual({ browser: "Samsung Internet", device: "Phone" });
});

test("Kids, unsigned profile selection, private routes and privacy signals exclude all optional telemetry", () => {
  const state = {
    ready: true,
    activeId: "main" as string | null,
    profiles: [
      { id: "main", kids: false },
      { id: "kids", kids: true },
    ],
  };
  const navigator = { doNotTrack: "0", globalPrivacyControl: false };
  const window = { location: { pathname: "/" }, dispatchEvent: () => true };
  let saved = "0";
  const exports = {} as {
    analyticsAllowed: () => boolean;
    setAnalyticsDisabled: (disabled: boolean) => void;
  };
  vm.runInNewContext(
    ts.transpileModule(readFileSync("lib/analyticsPrivacy.ts", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    {
      exports,
      require: (name: string) =>
        name === "./deviceProfiles"
          ? { useProfiles: { getState: () => state } }
          : { analyticsPath },
      navigator,
      window,
      Event,
      localStorage: {
        getItem: () => saved,
        setItem: (_key: string, value: string) => {
          saved = value;
        },
      },
    },
  );
  expect(exports.analyticsAllowed()).toBe(true);
  state.activeId = "kids";
  expect(exports.analyticsAllowed()).toBe(false);
  state.activeId = null;
  expect(exports.analyticsAllowed()).toBe(false);
  state.activeId = "main";
  for (const path of ["/admin", "/backup", "/recovery"]) {
    window.location.pathname = path;
    expect(exports.analyticsAllowed()).toBe(false);
  }
  window.location.pathname = "/";
  navigator.doNotTrack = "1";
  expect(exports.analyticsAllowed()).toBe(false);
  navigator.doNotTrack = "0";
  navigator.globalPrivacyControl = true;
  expect(exports.analyticsAllowed()).toBe(false);
  navigator.globalPrivacyControl = false;
  exports.setAnalyticsDisabled(true);
  expect(exports.analyticsAllowed()).toBe(false);
  exports.setAnalyticsDisabled(false);
  expect(exports.analyticsAllowed()).toBe(true);
});
