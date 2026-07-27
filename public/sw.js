const CACHE_NAME = "tates-tv-app-shell-v4-mobile-guide";
const APP_SHELL_URLS = ["/offline", "/help", "/install", "/compat", "/health", "/manifest.webmanifest", "/favicon.ico", "/favicon.svg", "/retro-logo.png", "/apple-icon-180.png", "/favicon-512.png", "/maskable-icon.svg", "/safari-pinned-tab.svg"];
function isVideoOrAudio(pathname) { return /\.(mp4|webm|mov|m4v|avi|mkv|mp3|wav|ogg|m3u8|ts)$/i.test(pathname); }
function isNextAsset(pathname) { return pathname.startsWith("/_next/"); }
function isSafeShellRequest(request) {
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith("/api/") || isNextAsset(url.pathname) || isVideoOrAudio(url.pathname)) return false;
  return true;
}
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL_URLS)).catch(() => undefined)); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener("message", (event) => { if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (!isSafeShellRequest(request)) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      if (response.ok) { const clone = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, clone).catch(() => undefined)); }
      return response;
    }).catch(() => caches.match(request).then((cached) => cached || caches.match("/offline"))));
    return;
  }
  event.respondWith(fetch(request).then((response) => {
    if (response.ok) { const clone = response.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(request, clone).catch(() => undefined)); }
    return response;
  }).catch(() => caches.match(request)));
});
