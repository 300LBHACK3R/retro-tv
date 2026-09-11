import { pageMetadata } from "@/lib/metadata";
import TatesTvHome from "@/components/TatesTvHome";

export const metadata = pageMetadata(
  "Watch on your TV",
  "Watch Tate’s TV with a television-friendly player, live guide and remote navigation.",
  "/tv",
  true,
);

export default function TvModePage() {
  return <TatesTvHome tvMode />;
}
