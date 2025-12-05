self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
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
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

const CACHE_NAME = "checklist-afm-cache-v2";
const API_PATHS = ["/rest/", "/auth/", "/storage/", "/realtime/", "/functions/"];

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(self.location.origin)) {
    return;
  }

  const { pathname } = new URL(request.url);
  const isApiRequest = API_PATHS.some((path) => pathname.startsWith(path));
  if (isApiRequest) {
    // Nunca cacheia requisições da API Supabase
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
          caches.open(CACHE_NAME).then((cache) => {
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
