importScripts("/pwa-build.js");

const VERSION_URL = "/pwa-version.json";
const BUILD_URL = "/pwa-build.js";
const FALLBACK_VERSION = "0.0.0-dev";
const APP_SHELL = [
  "/",
  "/index.html",
  VERSION_URL,
  BUILD_URL,
  "/manifest.webmanifest",
  "/gaveteira-splash.png",
  "/icons/favicon-16.png",
  "/icons/favicon-32.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

let currentVersion = normalizeVersion(self.__GAVETEIRA_PWA_VERSION__);
let versionRequest = null;

function normalizeVersion(payload) {
  const version = typeof payload?.version === "string" && payload.version.trim()
    ? payload.version.trim()
    : FALLBACK_VERSION;
  const cacheName = typeof payload?.cacheName === "string" && payload.cacheName.trim()
    ? payload.cacheName.trim()
    : `gaveteira-pwa-${version}`;

  return {
    version,
    cacheName,
    generatedAt: typeof payload?.generatedAt === "string" ? payload.generatedAt : null,
  };
}

function readVersion({ fresh = false } = {}) {
  if (fresh) versionRequest = null;
  if (!versionRequest) {
    versionRequest = fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        currentVersion = normalizeVersion(payload);
        return currentVersion;
      })
      .catch(() => currentVersion);
  }

  return versionRequest;
}

async function notifyClients(type, detail = currentVersion) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: "window" });
  clients.forEach((client) => client.postMessage({ type, detail }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    readVersion({ fresh: true }).then(async ({ cacheName }) => {
      const cache = await caches.open(cacheName);
      await cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: "reload" })));
      await notifyClients("GAVETEIRA_PWA_WAITING", currentVersion);
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    readVersion({ fresh: true }).then(async ({ cacheName }) => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("gaveteira-pwa-") && key !== cacheName)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
      await notifyClients("GAVETEIRA_PWA_ACTIVE", currentVersion);
    }),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "GAVETEIRA_SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "GAVETEIRA_GET_VERSION") {
    readVersion({ fresh: true }).then((detail) => {
      event.source?.postMessage({ type: "GAVETEIRA_PWA_VERSION", detail });
    });
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname === "/sw.js" || url.pathname === VERSION_URL || url.pathname === BUILD_URL) {
    event.respondWith(fetch(new Request(request, { cache: "no-store" })));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      readVersion().then(({ cacheName }) => (
        fetch(request)
          .then(async (response) => {
            const copy = response.clone();
            const cache = await caches.open(cacheName);
            await cache.put("/index.html", copy);
            return response;
          })
          .catch(() => caches.match("/index.html"))
      )),
    );
    return;
  }

  event.respondWith(
    readVersion().then(({ cacheName }) => (
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then(async (response) => {
            if (response.ok) {
              const copy = response.clone();
              const cache = await caches.open(cacheName);
              await cache.put(request, copy);
            }
            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    )),
  );
});
