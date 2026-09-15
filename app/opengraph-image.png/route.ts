import { ImageResponse } from "next/og";
import { createElement as h } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const dynamic = "force-static";
export const runtime = "nodejs";

// Keep the existing public share URL working. Generated once at build time;
// it uses the station's retained icon rather than duplicating a logo asset.
export async function GET() {
  const logo = await readFile(join(process.cwd(), "public/favicon-512.png"));
  return new ImageResponse(
    h("div", { style: {
      display: "flex", width: "100%", height: "100%", padding: 70,
      alignItems: "center", gap: 58, background: "linear-gradient(120deg, #06121e, #170d27)",
      color: "#f5f5ff", borderBottom: "12px solid #20c5ed", fontFamily: "sans-serif",
    } },
      h("img", { src: `data:image/png;base64,${logo.toString("base64")}`, width: 360, height: 360, alt: "Tate's TV", style: { borderRadius: 48 } }),
      h("div", { style: { display: "flex", flexDirection: "column", flex: 1 } },
        h("div", { style: { fontSize: 25, letterSpacing: 5, color: "#70d9f5", marginBottom: 25 } }, "TATE’S TV"),
        h("div", { style: { fontSize: 68, fontWeight: 700, lineHeight: 1.06 } }, "Good TV. Your way."),
        h("div", { style: { fontSize: 27, lineHeight: 1.4, color: "#ccd2e7", marginTop: 25 } }, "Free live channels. A familiar guide. Something worth watching."),
        h("div", { style: { fontSize: 24, color: "#70d9f5", marginTop: 35 } }, "tatestv.ca"),
      ),
    ),
    { width: 1200, height: 630 },
  );
}
