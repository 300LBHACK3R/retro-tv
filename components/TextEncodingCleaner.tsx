"use client";

import { useEffect } from "react";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

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

  ["â€œ", "\""],
  ["â€�", "\""],
  ["“", "\""],
  ["”", "\""],

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

function cleanLocalStorage(): number {
  let changedCount = 0;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);

    if (!key) {
      continue;
    }

    const value = window.localStorage.getItem(key);

    if (!value) {
      continue;
    }

    const cleaned = cleanStorageValue(value);

    if (cleaned !== value) {
      window.localStorage.setItem(key, cleaned);
      changedCount += 1;
    }
  }

  return changedCount;
}

export default function TextEncodingCleaner() {
  useEffect(() => {
    try {
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