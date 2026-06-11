import { NextResponse } from "next/server";

export const dynamic = "force-static";

const assetLinks = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: "ca.tatestv.app",
      sha256_cert_fingerprints: [
        "REPLACE_WITH_RELEASE_KEY_SHA256_FINGERPRINT"
      ]
    }
  }
];

export function GET() {
  return NextResponse.json(assetLinks, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600"
    }
  });
}
