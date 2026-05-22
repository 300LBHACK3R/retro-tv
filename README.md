# Tate’s TV / Retro TV

A browser-based retro cable TV simulation built with **Next.js App Router**, **TypeScript**, and **Tailwind CSS**.

The app is designed to feel like an old-school live cable guide experience, with scheduled channels, retro themes, a custom video player, admin tools, and Cloudflare R2-hosted media.

## Current Architecture

```txt
Vercel / GitHub
- Next.js app code
- UI components
- Schedule/player/admin logic
- No production video files

Cloudflare R2
- MP4 shows
- MP4 movies
- MP4 commercials
- Future thumbnails/trailers