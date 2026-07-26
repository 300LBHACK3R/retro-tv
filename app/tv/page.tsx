import type { Metadata } from "next";
import TatesTvHome from "@/components/TatesTvHome";

export const metadata: Metadata = {
  title: "TV Mode",
  description: "Fullscreen-first living-room mode for Tate's TV.",
  alternates: {
    canonical: "/tv",
  },
};

export default function TvModePage() {
  return <TatesTvHome tvMode />;
}
