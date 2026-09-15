"use client";
import { analyticsAllowed } from "./analyticsPrivacy";
import {
  parseAnalyticsEvent,
  trafficSource,
  type AnalyticsName,
  type AnalyticsEvent,
} from "./analyticsEvents";
import { useProfiles } from "./deviceProfiles";

let session: Promise<boolean> | null = null;
let retryAt = 0;
// Analytics must never hold up startup, playback, or a native TV picker.
export async function postTelemetry(body: unknown): Promise<boolean> {
  if (!analyticsAllowed() || Date.now() < retryAt) return false;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 7000);
  try {
    if (!session && document.visibilityState !== "visible") return false;
    session ??= fetch("/api/engagement", {
      cache: "no-store",
      credentials: "same-origin",
      mode: "same-origin",
      signal: controller.signal,
    })
      .then((response) => response.ok)
      .catch(() => false);
    if (!(await session)) {
      session = null;
      retryAt = Date.now() + 60000;
      return false;
    }
    if (!analyticsAllowed()) return false;
    const response = await fetch("/api/engagement", {
      method: "POST",
      mode: "same-origin",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 401) session = null;
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}
let pending: { profileId: string; event: AnalyticsEvent }[] = [];
let flushTimer: number | undefined;
let eventRetryAt = 0;
let budgetUntil = 0;
let eventCount = 0;
export function clearAnalyticsQueue() {
  pending = [];
  window.clearTimeout(flushTimer);
  flushTimer = undefined;
}
export async function flushAnalytics() {
  window.clearTimeout(flushTimer);
  flushTimer = undefined;
  const profileId = useProfiles.getState().activeId;
  const events = pending
    .filter((entry) => entry.profileId === profileId)
    .slice(0, 10)
    .map((entry) => entry.event);
  pending = [];
  if (!events.length || !analyticsAllowed()) return;
  if (!(await postTelemetry({ type: "events", events })))
    eventRetryAt = Date.now() + 60000;
}
export function trackAnalytics(name: AnalyticsName, detail = "", value = 0) {
  try {
    if (!analyticsAllowed() || Date.now() < eventRetryAt) return;
    if (Date.now() > budgetUntil) {
      eventCount = 0;
      budgetUntil = Date.now() + 60000;
    }
    if (eventCount >= 60 || pending.length >= 10) return;
    const event = parseAnalyticsEvent({
      id: crypto.randomUUID(),
      name,
      path: window.location.pathname,
      detail,
      source: trafficSource(document.referrer, window.location.origin),
      value: Math.min(120000, Math.max(0, Math.round(value))),
    });
    if (!event) return;
    eventCount += 1;
    pending.push({ profileId: useProfiles.getState().activeId!, event });
    flushTimer ??= window.setTimeout(() => void flushAnalytics(), 1500);
  } catch {
    /* Optional measurement never interrupts the viewer. */
  }
}
