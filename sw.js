/* Service Worker: 解説データのキャッシュとオフライン対応
 * デプロイ時は `npm run deploy` を使うと CACHE_NAME のバージョンが自動で1つ上がる。
 */
const CACHE_NAME = "rikeich-explanations-v8";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if (!url.includes("/data/explanations/") && !url.includes("/data/materials/")) {
    return;
  }
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200 && response.type === "basic") {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    )
  );
});
