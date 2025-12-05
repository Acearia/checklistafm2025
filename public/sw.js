self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("checklist-afm-cache-v1").then((cache) =>
      cache.addAll([
        "/",
        "/manifest.webmanifest",
      ]).catch(() => {
        // ignore cache errors during install
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== "checklist-afm-cache-v1")
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open("checklist-afm-cache-v1").then((cache) => {
            cache.put(request, responseClone).catch(() => {
              // ignore cache put errors
            });
          });
          return response;
        })
        .catch(() => cachedResponse || Response.error());
    })
  );
});
