# Tate’s TV / Retro TV

A browser-based retro cable TV simulation built with **Next.js App Router**, **TypeScript**, and **Tailwind CSS**.

The project is designed to feel like an old-school live cable television experience, with scheduled channels, themed guides, live playback, commercial breaks, admin tools, and Cloudflare R2-hosted media.

The long-term goal is to launch the web version first, then package the experience into installable app formats such as a PWA, desktop app, Android app, and eventually iOS app.

---

## Project Vision

Tate’s TV / Retro TV is a custom retro cable simulator where viewers can open the site and watch live-style channels that are always running on a synchronized broadcast clock.

Instead of clicking individual videos like a normal media library, users experience channels as if they are watching real cable television.

Core goals:

* Live channel playback
* Retro TV guide experience
* Scheduled shows, movies, cartoons, and commercials
* 30-minute and 60-minute broadcast block support
* Commercial filler engine
* Hidden admin tools
* Premium themes
* Mobile-friendly viewing
* Future app packaging

---

## Current Architecture

```txt
Vercel / GitHub
- Next.js application code
- UI components
- Player, guide, schedule, admin, and theme logic
- API routes
- No production video files stored in the repo

Cloudflare R2
- MP4 shows
- MP4 movies
- MP4 commercials
- Bumpers/promos
- Future thumbnails/trailers

Supabase
- Global programming state
- Channel data
- Media metadata
- Theme/state information
- Schedule/admin configuration

Browser / Client
- Live playback
- Channel switching
- Guide rendering
- Admin quick edits
- Theme selection
- Local UI preferences
```

---

## Tech Stack

* **Next.js App Router**
* **React**
* **TypeScript**
* **Tailwind CSS**
* **Zustand**
* **Supabase**
* **Cloudflare R2**
* **Vercel**
* **GitHub**

---

## Core Features

### Viewer Experience

* Retro-style live TV layout
* Channel-based playback
* Synchronized broadcast schedule
* Now/Next display
* Multi-channel guide
* Custom remote control
* Retro visual themes
* Fullscreen/theater-style viewing
* Future mini-player mode
* Mobile-friendly layout

### Admin Experience

* Password-protected admin access
* Add media by URL
* Edit loaded shows without deleting/re-uploading
* Move media between channels
* Edit title, runtime, type, breakpoints, ad durations, and air days
* Set channel branding
* Configure channel schedule mode
* Sync global programming state

### Broadcast Engine

* Ordered channel playback
* Daily random channel playback
* Air-day filtering
* Manual breakpoints
* Commercial slot filler support
* 30-minute and 60-minute block planning
* Hidden commercials in guide display
* Real playback schedule separate from clean viewer guide schedule

---

## Media Standards

For best cross-browser playback, production media should use:

```txt
Container: MP4
Video: H.264 / AVC
Audio: AAC
Fast Start: Enabled
Resolution: 720p or 1080p
```

Recommended FFmpeg conversion command:

```bash
ffmpeg -i "input.mkv" -c:v libx264 -preset medium -crf 22 -c:a aac -b:a 160k -movflags +faststart "output-browser-ready.mp4"
```

Smaller 720p streaming version:

```bash
ffmpeg -i "input.mkv" -vf "scale=-2:720" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 128k -movflags +faststart "output-720p-browser-ready.mp4"
```

MKV may work in some browsers, but MP4/H.264/AAC is the safer production standard.

---

## Commercial Slot Logic

The project is moving toward a real broadcast-style ad system.

Example 30-minute show block:

```txt
Show runtime: 21:56
Slot length: 30:00
Breakpoints: 7:30, 15:00
Ad blocks: 2:00, 2:00
End filler: auto-fill remaining slot time
```

Viewer guide should show:

```txt
Martin Mystery S01E01 — 30 min
```

Playback should actually run:

```txt
Show Part 1
Commercial Block
Show Part 2
Commercial Block
Show Part 3
End Filler Commercials
```

Commercials and bumpers should be hidden from the public guide while still playing during the real playback schedule.

---

## Environment Variables

Required local environment variables should be stored in `.env.local`.

```env
ADMIN_PASSWORD=your-admin-password
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Production values should be configured in Vercel Environment Variables.

Important:

* Never expose `SUPABASE_SERVICE_ROLE_KEY` to the frontend.
* Never commit `.env.local`.
* Admin-only actions should stay protected by server-side API routes.
* Public routes should only expose safe schedule/viewer data.

---

## Development

Install dependencies:

```bash
npm install
```

Run local dev server:

```bash
npm run dev
```

Typecheck:

```bash
npm run typecheck
```

Build:

```bash
npm run build
```

Push changes:

```bash
git status
git add .
git commit -m "Describe the change"
git push origin master
```

---

## Production Checklist

Before public launch:

* [ ] No TypeScript errors
* [ ] No build errors
* [ ] No `.backup.ts` or `.backup.tsx` files inside the project
* [ ] No secrets committed to Git
* [ ] Admin access hidden from normal viewer UI
* [ ] Viewer layout polished on desktop
* [ ] Viewer layout polished on mobile
* [ ] Player works on Chrome
* [ ] Player works on Firefox
* [ ] Player works on mobile browsers
* [ ] Channel switching does not black-screen
* [ ] Commercials play correctly
* [ ] Commercials are hidden from guide/Now Next
* [ ] Global sync works
* [ ] SEO metadata is complete
* [ ] Manifest/icons are complete
* [ ] Security headers are configured
* [ ] R2 media URLs are stable
* [ ] Supabase state is stable

---

## Launch Roadmap

### Phase 1 — Stable Website

* Finalize viewer layout
* Finalize player reliability
* Finalize hidden admin access
* Finalize quick edit tools
* Finalize commercial slot filler logic
* Finalize guide display
* Add real channel content
* Test on desktop and mobile

### Phase 2 — PWA

* Add install support
* Add proper manifest
* Add icons and splash visuals
* Add offline fallback
* Add polished mobile app-like layout

### Phase 3 — Desktop App

* Package with Electron or similar wrapper
* Add fullscreen/kiosk-style viewing
* Add desktop installer
* Test Windows first

### Phase 4 — Android App

* Package as a Trusted Web Activity or native shell
* Add Play Store assets
* Add privacy policy
* Submit to Google Play

### Phase 5 — iOS App

* Package with Capacitor or native shell
* Add iOS-safe UI polish
* Add Apple App Store assets
* Submit after web/PWA version is stable

---

## Branding Direction

The public-facing brand should feel:

* Retro
* Premium
* Nostalgic
* Cable-TV inspired
* Smooth and modern enough for launch

Avoid directly copying real network names, logos, or copyrighted branding. Themes and channels should be original while still capturing the general feeling of old-school cable TV.

Potential premium theme concepts:

* Neon Arcade 2005
* Saturday Morning Max
* Obsidian Gold
* Original Console
* Classic Cable

---

## Long-Term Ideas

* Bulk R2 importer
* Media health checker
* Duplicate detector
* Channel packs
* Premium themes
* Watch-party links
* Mini-player
* Theater mode
* User profiles
* Viewer favourites
* Public channel schedule page
* App-store versions
* Optional paid theme/channel marketplace

---

## Project Rule

The website must be stable before app wrapping.

If playback, scheduling, mobile layout, or admin editing is broken on the website, the app version will only package those same problems. The web version is the source of truth.
