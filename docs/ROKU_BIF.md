# Roku seek thumbnails

Use Node.js 22 or newer and put `ffmpeg` on your `PATH`. Run the commands from the repository root. The workflow resumes from the same `roku-bif-work` directory. Each generated file covers one video source and can be reused by catalog entries that share that exact source.

## Prepare a batch

Download the programming snapshot and the Roku catalog together. The planner requires both to have the same revision. `curl.exe` is the equivalent of `curl` in PowerShell.

```sh
mkdir roku-bif-work
curl -fSso roku-bif-work/programming.json https://www.tatestv.ca/api/programming
curl -fSso roku-bif-work/catalog.json 'https://www.tatestv.ca/api/roku/catalog?audience=all'
node roku/scripts/build-bif-library.mjs plan --dir roku-bif-work --programming roku-bif-work/programming.json --catalog roku-bif-work/catalog.json --source-origin https://pub-84f28dd5f9cd442aa30785cc1837eb3f.r2.dev
node roku/scripts/build-bif-library.mjs build --dir roku-bif-work --limit 5
node roku/scripts/build-bif-library.mjs status --dir roku-bif-work
```

Run `build` again to process the next batch. The workflow downloads one source at a time, removes its temporary copy after processing and caps each source at 5 GiB by default. If you already have uploaded videos whose bytes were verified against the live sources, add `--seeds verified-local-seeds.json` to process only those copies. The seed file has `schemaVersion: 1` and a `seeds` array with `sourceFile`, `localFile` and `sha256` fields. Use the exact catalog source URL, an absolute local path and the SHA-256 verified against the live source.

## Upload and verify

After the BIF signing route is deployed, run the Admin upload command in a terminal. Use your Tate’s TV Admin login when prompted. The password is hidden and the session stays in memory for the batch. Set `--public-base` to the media bucket’s configured public URL.

```sh
node roku/scripts/build-bif-library.mjs upload --dir roku-bif-work --admin --limit 5 --public-base https://pub-84f28dd5f9cd442aa30785cc1837eb3f.r2.dev
```

If your machine already has an authorized R2 `rclone` remote, you can supply `--remote YOUR_REMOTE:tates-tv-media` in place of `--admin`. Either upload path verifies the public object byte for byte before recording a receipt.

## Publish to Roku playback

Generate a transaction once the batch has verified receipts. Choose a new output filename when generating a later transaction.

```sh
node roku/scripts/build-bif-library.mjs sql --dir roku-bif-work --public-base https://pub-84f28dd5f9cd442aa30785cc1837eb3f.r2.dev --output roku-bif-work/apply-01.sql
```

Review and run the generated transaction in the production Supabase SQL editor. The transaction includes only verified uploads and aborts if a target video changed or received a conflicting index. It is safe to apply the same transaction twice. After applying it, open an indexed title on Roku and check that fast-forward and rewind display thumbnails. `status` reports locally prepared titles, verified upload receipts and titles needing a different workflow.
