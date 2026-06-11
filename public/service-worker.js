const CACHE_NAME = "fretboard-reaction-v2";
const PRECACHE_URLS = ["/icon.svg", "/manifest.webmanifest"];
const CRITICAL_DESTINATIONS = new Set(["document", "script", "style", "worker"]);
const STATIC_DESTINATIONS = new Set(["font", "image", "manifest"]);

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

function isNavigationOrCriticalAsset(request) {
  return request.mode === "navigate" || CRITICAL_DESTINATIONS.has(request.destination);
}

function shouldUseStaticCache(request) {
  return STATIC_DESTINATIONS.has(request.destination);
}

function canCache(response) {
  return response && response.ok && response.type === "basic";
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);

    if (request.mode === "navigate" && canCache(response)) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (canCache(response)) {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }

  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET" || !isSameOrigin(request)) {
    return;
  }

  if (isNavigationOrCriticalAsset(request)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (shouldUseStaticCache(request)) {
    event.respondWith(cacheFirst(request));
  }
});
