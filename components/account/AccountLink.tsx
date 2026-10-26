"use client";
import Link from "next/link";
import { useAccount } from "@/lib/accountStore";
import { useProfiles } from "@/lib/deviceProfiles";
export default function AccountLink() {
  const user = useAccount((state) => state.user);
  const error = useAccount((state) => state.syncError);
  const kids = useProfiles(
    (state) =>
      state.profiles.find((profile) => profile.id === state.activeId)?.kids,
  );
  if (kids) return null;
  return (
    <Link
      href="/account"
      className="ttv-account-link"
      aria-label={user ? "Your account" : "Sign in or create an account"}
    >
      {user ? "Account" : "Sign in"}
      {error ? (
        <span
          title="Some preferences have not synced"
          aria-label="Sync needs attention"
        >
          {" "}
          •
        </span>
      ) : null}
    </Link>
  );
}
