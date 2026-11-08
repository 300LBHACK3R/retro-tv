# The Rewind Room

Open `/rewind-room` for the VHS-style on-demand movie shelf. Links are in the desktop live navigation, the Library header, and **More → Rewind Room** on phones. Existing movies are not added automatically; the room has an intentional empty state until it is stocked.

## Stocking the shelf

1. Open **Admin → Rewind Room → Upload a movie**.
2. Upload a browser-ready video to the existing R2 storage, or paste its public HTTPS URL. MP4 with H.264 video and AAC audio is the most broadly supported choice.
3. Enter the movie title and runtime, using **Detect runtime** or seconds / `HH:MM:SS`. A synopsis and cover are optional.
4. Select **Add movie to shelf** and wait for **Global saved**. The movie is saved as on-demand content; no live channel is changed.

For an existing movie, use its checkbox in **Admin → Rewind Room**. Removing the checkbox removes shelf membership, not the video or its live assignments. Use **Edit covers & Kids approval** to manage artwork and audience review. New uploads do not receive Kids approval automatically. Adults-only channel restrictions and existing poster review rules also apply.

## Playback and profiles

Choose a tape, then **Play tape** or **Resume tape**. The deck offers play/pause, 10-second rewind/forward, start over, and fullscreen. Native video controls remain available for scrubbing, volume, and captions when provided by the media/browser. **Eject tape** closes the player and returns keyboard focus to the tape.

Watchlists use the existing account/profile preferences. Playback progress uses the existing account-and-profile-specific local progress store, shared with the ordinary Library. It is retained on that browser for signed-in viewers; this feature does not introduce cross-device playback-progress syncing. Guests can play movies without permanently storing progress.

## Validation

`rewind-room.unit.ts` covers opt-in filtering, Kids and artwork restrictions, programming export/restore, strict boolean membership, and new-movie validation. `rewind-room.browser.ts` exercises empty/stocked shelves, search/watchlists, playback, resume/start-over, Kids filtering, and admin uploads. All configured browser/device projects run those cases. `test:http` verifies the route, metadata, linked stylesheet, and sitemap entry.
