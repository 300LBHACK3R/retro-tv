import type { MetadataRoute } from "next";

const appName = "TatesTv";
const appShortName = "TatesTv";
const appDescription =
  "TatesTv is a browser-based retro cable TV simulator with live-style channels, classic guide listings, custom themes, and on-demand show libraries.";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: appName,
    short_name: appShortName,
    description: appDescription,

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
        description: "Open the TatesTv live viewer.",
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
        description: "Open TatesTv and jump into the live channel guide.",
        url: "/?guide=1",
        icons: [
          {
            src: "/icon.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      {
        name: "Open Library",
        short_name: "Library",
        description: "Open TatesTv and browse shows in order.",
        url: "/?library=1",
        icons: [
          {
            src: "/icon.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
      {
        name: "Themes",
        short_name: "Themes",
        description: "Open TatesTv and switch visual themes.",
        url: "/?themes=1",
        icons: [
          {
            src: "/icon.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    ],

    screenshots: [
      {
        src: "/opengraph-image.png",
        sizes: "1200x630",
        type: "image/png",
        form_factor: "wide",
        label: "TatesTv live retro cable viewer",
      },
    ],
  };
}