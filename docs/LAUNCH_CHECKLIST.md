# Tate's TV Launch Checklist

## Core playback
- [ ] Home page loads
- [ ] First channel plays
- [ ] Channel up works
- [ ] Channel down works
- [ ] Guide opens
- [ ] Guide scrolls
- [ ] Fullscreen works
- [ ] Mobile scroll works

## Admin
- [ ] Admin login works
- [ ] Upload panel opens
- [ ] Media saves
- [ ] Programming saves
- [ ] Refresh does not wipe schedule unexpectedly

## Themes
- [ ] Theme picker opens
- [ ] Classic/default theme works
- [ ] Electric Blue appears
- [ ] Electric Blue applies without breaking playback
- [ ] Mobile still scrolls after theme change

## Production
- [ ] /api/health returns healthy
- [ ] /health loads
- [ ] /recovery loads
- [ ] /manifest.webmanifest opens
- [ ] /robots.txt opens
- [ ] /sitemap.xml opens
- [ ] Vercel deployment is green

## Smoke test

Run:

```powershell
.\scripts\smoke-test.ps1
```
