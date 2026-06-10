export const dynamic = "force-static";

export function GET() {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "",
      "Sitemap: https://www.tatestv.ca/sitemap.xml",
      "",
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    },
  );
}
