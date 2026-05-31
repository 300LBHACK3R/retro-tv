import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tate’s Retro TV",
    short_name: "Retro TV",
    description:
      "A browser-based retro cable TV simulator with live-style channels, classic guide listings, and curated programming.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "browser"],
    orientation: "any",
    background_color: "#020617",
    theme_color: "#020617",
    categories: ["entertainment", "video", "tv"],
    lang: "en-CA",
    dir: "ltr",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "32x32",
        type: "image/x-icon",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
    shortcuts: [
      {
        name: "Watch Live TV",
        short_name: "Watch",
        description: "Open Tate’s Retro TV live viewer.",
        url: "/",
        icons: [
          {
            src: "/icon.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      {
        name: "Open Channel Guide",
        short_name: "Guide",
        description: "Open Tate’s Retro TV and use the live guide.",
        url: "/?guide=1",
        icons: [
          {
            src: "/icon.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    ],
  };
}