# Website live preview — v0.1.12

The programme already playing stays visible while the viewer opens Library or
TV Guide. Desktop browsers show a small picture at the upper right; phones
keep a compact live row above Library and the existing player above Guide.

## Playback rules

- Navigation between `/`, `/library`, and `/tv` keeps the same video element,
  channel, source and profile session. Browser Back and Forward use that same
  player while the shared layout remains mounted.
- Opening a title's details does not interrupt live TV. Starting its on-demand
  video pauses live TV and disconnects an existing Cast session. Closing the
  title resumes live TV only when it was playing or loading before suspension.
- **Stop live preview** pauses the video and gives Library its full width.
  **Live TV** returns to the full player. **Back to TV** does the same from an
  active preview.
- A direct Library visit does not start a hidden live channel. Selecting a
  channel in Guide or opening Live TV starts a live session.
- Profile switching removes the old player. The existing account, Kids
  catalog and parental PIN checks remain in force.
- Browser sound permissions still apply. Background tabs, sleep and mobile
  operating systems can pause media independently of route navigation.

## Ownership

`app/(watch)/layout.tsx` owns `WatchLayout` and the shared `TatesTvHome` player.
Keep one `ProfileGate` here; do not wrap `PublicLibrary` in another gate or
create a second live video in the Library. Routes retain their existing URLs
and metadata.

`BrowsePlaybackContext` coordinates live/on-demand audio ownership.
`Player.suspended` guards autoplay, recovery and late media events; it also
remembers deliberate pauses. Guide channel selection has its own callback,
so tuning does not depend on schedule cells having finished preparing.

The layout rules live in `app/styles/browse-player.css`. Library reserves
space for the preview and the Guide dialog contains the existing video,
including keyboard focus handling. No DOM reparenting or video cloning is
used.

## Release

This is a website update based on the published v0.1.11 source. It also pins
Next.js and eslint-config-next to 16.4.6, including the framework security
patch identified during validation. There is no database migration and no
new native Roku package. The existing Roku v0.1.11 remains the current TV
package; its physical-device acceptance is separate.

Publish the feature branch, require the complete **Viewer quality** workflow
to pass, then fast-forward production master and wait for Vercel Ready. The
release helper refuses to overwrite a newer production commit or local work.

## Verification

`tests/browse-playback.browser.ts` uses synthetic video and programming. It
checks actual playback, video identity and source reloads across Library,
Guide and browser history; live/on-demand audio ownership; direct Library
entry; Stop; and profile switching across all seven browser/device projects.
Existing viewer, library and profile suites cover themes, Kids restrictions,
keyboard focus, mobile rotation and TV controls.

After production is Ready, start a live channel, open Library, search and
scroll, open/close Guide, play an on-demand title, then close it and return
to Live TV. Confirm sound and video on the user's actual browser. Automated
device emulation does not replace physical Safari, Cast or Roku acceptance.
