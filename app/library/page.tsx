import type { Metadata } from "next";
import PublicLibrary from "@/components/PublicLibrary";

export const metadata: Metadata = {
  title: "TTV Library | Watch Tate's TV On Demand",
  description:
    "Browse Tate's TV shows, movies, music videos, and other on-demand programming without interrupting the live channels.",
};

export default function LibraryPage() {
  return <PublicLibrary />;
}
