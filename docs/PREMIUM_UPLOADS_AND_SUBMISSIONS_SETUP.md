# Tate's TV Premium Upload and Submission Setup

## 1. Apply the Supabase migration

Run this file in the Supabase SQL editor:

`supabase/migrations/20260725_content_submissions.sql`

The table has RLS enabled and intentionally has no public policies. The public
submission route and protected admin route both use the server-only Supabase
service-role client.

## 2. Configure Cloudflare R2 credentials in Vercel

Add the variables shown in `.env.example`.

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
