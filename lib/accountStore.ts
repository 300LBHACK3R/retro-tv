"use client";
import { create } from "zustand";
import { EMPTY_ACCOUNT, type AccountView } from "./accountModel";
export const useAccount = create<
  AccountView & {
    ready: boolean;
    error: string;
    syncError: string;
    saving: boolean;
    showMemberBadge: boolean;
  }
>(() => ({
  ...EMPTY_ACCOUNT,
  ready: false,
  error: "",
  syncError: "",
  saving: false,
  showMemberBadge: false,
}));
export async function accountRequest(
  path: string,
  body?: unknown,
  method = "POST",
) {
  const response = await fetch(path, {
    method,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || "The request could not be completed.");
  return data;
}
export function announceAccountChange() {
  try {
    localStorage.setItem("ttv-account-change", crypto.randomUUID());
  } catch {
    /* This tab still changes account safely. */
  }
}
