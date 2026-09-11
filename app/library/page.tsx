import { pageMetadata } from "@/lib/metadata";
import PublicLibrary from "@/components/PublicLibrary";

export const metadata = pageMetadata(
  "On-demand library",
  "Browse shows, movies and music on Tate’s TV. Save a watchlist and continue watching on your device.",
  "/library",
  true,
);

export default function LibraryPage() {
  return <PublicLibrary />;
}
