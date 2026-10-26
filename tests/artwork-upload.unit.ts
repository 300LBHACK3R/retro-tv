import { test, expect } from "@playwright/test";
import { serverModule } from "./server-harness";

test("poster uploads authenticate first, bound actual image bytes and hide storage credentials", async () => {
  let admin = false;
  let uploads = 0;
  let upstreamStatus = 200;
  const http = serverModule("lib/server/http.ts");
  const security = serverModule("lib/server/requestSecurity.ts");
  const route = serverModule(
    "app/api/admin/artwork/route.ts",
    {
      "@/lib/server/http": http,
      "@/lib/server/requestSecurity": security,
      "@/lib/server/adminAuth": { isAdminRequestAuthorized: async () => admin },
      "@/lib/server/r2Presign": {
        createDatedObjectKey: () => "Artwork/qa.webp",
        createR2UploadUrl: () => ({
          signedUrl: "https://storage.example/private-signature",
          publicUrl: "https://media.example/Artwork/qa.webp",
        }),
      },
    },
    {},
    {
      fetch: async (url: string, init: RequestInit) => {
        uploads++;
        expect(url).toContain("private-signature");
        expect(init.method).toBe("PUT");
        expect(init.redirect).toBe("error");
        return new Response(null, { status: upstreamStatus });
      },
    },
  );
  const image = Buffer.from("RIFF1234WEBP1234");
  const post = (
    body: Buffer,
    type = "image/webp",
    origin = "https://www.tatestv.ca",
  ) =>
    route.POST!(
      new Request("https://www.tatestv.ca/api/admin/artwork", {
        method: "POST",
        headers: { "content-type": type, origin },
        body: new Uint8Array(body),
      }),
    );
  expect((await post(image)).status).toBe(401);
  admin = true;
  expect((await post(image, "image/webp", "https://evil.test")).status).toBe(
    403,
  );
  expect((await post(Buffer.from("<svg>not an image</svg>"))).status).toBe(400);
  expect((await post(image, "image/svg+xml")).status).toBe(400);
  expect((await post(Buffer.alloc(3 * 1024 * 1024 + 1))).status).toBe(413);
  expect(uploads).toBe(0);
  const response = await post(image);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    ok: true,
    publicUrl: "https://media.example/Artwork/qa.webp",
  });
  upstreamStatus = 403;
  const rejected = await post(image);
  expect(rejected.status).toBe(502);
  expect((await rejected.json()).error).toContain("write permission");
});
