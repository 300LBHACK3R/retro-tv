# Tate's TV Premium Upload and Submission Setup

## 1. Apply the Supabase migration

Run this file in the Supabase SQL editor:

`supabase/migrations/20260725_content_submissions.sql`

The table has RLS enabled and intentionally has no public policies. The public
submission route and protected admin route both use the server-only Supabase
service-role client.

## 2. Configure Cloudflare R2 credentials in Vercel

Add these server-only variables to the Vercel project's Production environment:

| Variable | Value |
| --- | --- |
| R2_ACCOUNT_ID | Cloudflare account ID owning the buckets |
| R2_ACCESS_KEY_ID | R2 S3 access-key ID with object access to the intended buckets |
| R2_SECRET_ACCESS_KEY | Matching R2 S3 secret access key; keep sensitive |
| R2_MEDIA_BUCKET_NAME | Existing media bucket name; the code defaults to tates-tv-media |
| R2_MEDIA_PUBLIC_BASE_URL | Public HTTPS URL serving that media bucket |
| R2_SUBMISSIONS_BUCKET_NAME | Private submissions bucket name |

Keep credentials in Vercel, never in chat or Git. The media credential needs
object write permission for uploads, and submission review needs object read
permission. Rebuild after saving the environment variables. Verify a real
small poster upload and publish it using **Save title artwork**.

The October 27 project environment review did not find these R2 settings;
production upload readiness remains unverified until they are supplied and tested.

Create a separate private bucket named
`tates-tv-submissions`. The admin moderation API creates temporary signed GET
links for reviewing private clips.

## 3. Add R2 CORS rules

Direct browser uploads require CORS on both the media bucket and submissions
bucket. Use the Cloudflare dashboard or API to allow:

- Origins: `https://tatestv.ca` and `https://www.tatestv.ca`
- Methods: `PUT`, `GET`, `HEAD`
- Headers: `Content-Type`
- Expose headers: `ETag`
- Max age: `3600`

Add local development origins only while testing, such as
`http://localhost:3000`.

## 4. Security model

- R2 secret keys stay server-side.
- The browser receives a short-lived signed URL for one randomized object key.
- Public submission metadata is validated again on the server.
- Every clip remains pending until reviewed in Admin > Submissions.
- Official admin uploads require an authorized Tate's TV admin session.
- Public submission uploads are limited to 2 GB.
- Admin direct uploads are limited to 4.9 GB because this first version uses one signed PUT request.
- Continue using `rclone` for larger media or when resumable multipart transfer is preferred.
- The submissions API accepts only object keys created under `Submissions/FailZone/`.
- Raw IP addresses and browser user-agent strings are not stored in the submissions table.
- The in-memory API rate limiter is best-effort; production abuse controls should also be enabled at Cloudflare or Vercel.

## 5. First test

1. Deploy the environment variables and migration.
2. Open `/submit` in a private browser window.
3. Upload a short MP4 and complete every required confirmation.
4. Copy the reference code from the success screen.
5. Open `/admin`, unlock it, and select `Submissions`.
6. Review the video and update its status.


## 6. Large-file note

The direct browser uploader is intentionally a single-request convenience path.
For large movies, unreliable connections, or resumable uploads, keep using the
existing `rclone` workflow. Multipart browser uploads can be added as a later
media-pipeline upgrade without changing the public submission records.

## Library posters

Small prepared posters upload through the authenticated same-origin `POST /api/admin/artwork` endpoint. It accepts JPG, PNG and WebP up to 3 MB after browser resizing, checks the image format and actual byte count, then writes to the existing R2 media bucket. Poster uploads no longer depend on browser-to-R2 CORS. Direct video uploads still require the bucket's existing CORS setup.

The R2 token must have object write access to `R2_MEDIA_BUCKET_NAME` (or `R2_BUCKET_NAME`), with `R2_MEDIA_PUBLIC_BASE_URL` (or `R2_PUBLIC_BASE_URL`) pointing to the public HTTPS media domain. The UI distinguishes an expired admin session, missing storage configuration and a storage permission failure. After the preview changes, select **Save title artwork** and wait for **Global saved** to publish the cover.
