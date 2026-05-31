"use client";

import { useEffect } from "react";

const REPLACEMENTS: Array<[string, string]> = [
  ["â€¢", " / "],
  ["â€˘", " / "],
  ["Â·", " / "],
  ["•", " / "],
  ["â€”", "-"],
  ["—", "-"],
  ["â€“", "-"],
  ["–", "-"],
  ["â€™", "'"],
  ["’", "'"],
  ["â€œ", "\""],
  ["â€�", "\""],
  ["“", "\""],
  ["”", "\""],
  ["Â", ""],
];

function cleanText(value: string): string {
  return REPLACEMENTS.reduce(
    (current, [bad, good]) => current.split(bad).join(good),
    value,
  );
}

export default function TextEncodingCleaner() {
  useEffect(() => {
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);

        if (!key) continue;

        const value = window.localStorage.getItem(key);

        if (!value) continue;

        const cleaned = cleanText(value);

        if (cleaned !== value) {
          window.localStorage.setItem(key, cleaned);
        }
      }
    } catch {
      // Local storage may be unavailable in strict browser modes.
    }
  }, []);

  return null;
}
