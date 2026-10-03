const CACHE_NAME = "porsh-invoice-v12";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css?v=12",
  "./app.js?v=12",
  "./manifest.webmanifest",
  "./PORSH%20logo-01.png",
  "./PORSH%20logo-02%202.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: event.request.mode === "navigate" }).then((cached) => {
      const refresh = fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => null);

      if (cached) {
        event.waitUntil(refresh);
        return cached;
      }

      return refresh.then((response) => {
        if (response) return response;
        if (event.request.mode === "navigate") return caches.match("./index.html");
        return Response.error();
      });
    })
  );
});
