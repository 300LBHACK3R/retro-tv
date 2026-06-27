"use client";

import { useEffect } from "react";
import { programmingStoreName } from "@/lib/store";

type JsonPrimitive = string | number | boolean | null;

type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

const CLEANER_VERSION = "2026-06-27-v2";
const CLEANER_FLAG_KEY = "ttv:text-encoding-cleaner-version";

const REPLACEMENTS: Array<[string, string]> = [
  ["â€¢", " / "],
  ["â€˘", " / "],
  ["Â·", " / "],
  ["•", " / "],

  ["â€”", "-"],
  ["â€“", "-"],
  ["—", "-"],
  ["–", "-"],

  ["â€™", "'"],
  ["â€˜", "'"],
  ["’", "'"],
  ["‘", "'"],

  ["â€œ", '"'],
  ["â€�", '"'],
  ["“", '"'],
  ["”", '"'],

  ["â€¦", "..."],
  ["…", "..."],

  ["Â©", "(c)"],
  ["Â®", "(r)"],
  ["â„¢", "TM"],

  ["Â", ""],
];

function cleanText(value: string): string {
  return REPLACEMENTS.reduce(
    (current, [bad, good]) => current.split(bad).join(good),
    value,
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s+\/\s+/g, " / ")
    .trim();
}

function isJsonObject(value: unknown): value is Record<string, JsonValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cleanJsonValue(value: JsonValue): JsonValue {
  if (typeof value === "string") {
    return cleanText(value);
  }

  if (Array.isArray(value)) {
    return value.map(cleanJsonValue);
  }

  if (isJsonObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cleanJsonValue(item)]),
    );
  }

  return value;
}

function tryCleanJsonString(value: string): string | null {
  const trimmed = value.trim();

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as JsonValue;
    const cleaned = cleanJsonValue(parsed);

    return JSON.stringify(cleaned);
  } catch {
    return null;
  }
}

function cleanStorageValue(value: string): string {
  const cleanedJson = tryCleanJsonString(value);

  if (cleanedJson !== null) {
    return cleanedJson;
  }

  return cleanText(value);
}

function shouldCleanStorageKey(key: string): boolean {
  const normalized = key.toLowerCase();

  return (
    key === programmingStoreName ||
    key === CLEANER_FLAG_KEY ||
    normalized.startsWith("ttv") ||
    normalized.startsWith("tates-tv") ||
    normalized.startsWith("tatestv") ||
    normalized.includes("programming")
  );
}

function getLocalStorageKeys(): string[] {
  return Array.from({ length: window.localStorage.length })
    .map((_, index) => window.localStorage.key(index))
    .filter((key): key is string => Boolean(key));
}

function cleanLocalStorage(): number {
  let changedCount = 0;
  const keys = getLocalStorageKeys().filter(shouldCleanStorageKey);

  keys.forEach((key) => {
    const value = window.localStorage.getItem(key);

    if (!value) {
      return;
    }

    const cleaned = cleanStorageValue(value);

    if (cleaned !== value) {
      window.localStorage.setItem(key, cleaned);
      changedCount += 1;
    }
  });

  window.localStorage.setItem(CLEANER_FLAG_KEY, CLEANER_VERSION);

  return changedCount;
}

function hasCleanerAlreadyRun(): boolean {
  return window.localStorage.getItem(CLEANER_FLAG_KEY) === CLEANER_VERSION;
}

export default function TextEncodingCleaner() {
  useEffect(() => {
    try {
      if (hasCleanerAlreadyRun()) {
        return;
      }

      cleanLocalStorage();
    } catch {
      /**
       * Local storage can be unavailable in strict/private browser modes.
       * This component should never block the app from rendering.
       */
    }
  }, []);

  return null;
}