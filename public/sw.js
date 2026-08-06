// Service worker mínimo: existe para o app poder ser instalado e para mostrar
// uma tela decente sem conexão. Nada de cachear HTML ou JS da aplicação, senão
// uma versão antiga ficaria presa no aparelho depois de um deploy.
const CACHE = "doublerec-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_URL)) ?? Response.error();
    }),
  );
});
