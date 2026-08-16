// Self-destructing service worker (kill-switch).
//
// The legacy Vite app shipped a vite-plugin-pwa (Workbox) service worker at
// this same path (`/sw.js`, scope `/`) with `registerType: 'autoUpdate'`. It
// precached the old Vite+Supabase SPA shell and served it as the navigation
// fallback — so browsers that ever loaded the old app keep rendering it (e.g.
// the old `/signin` page hitting Supabase → "Invalid login credentials"),
// even though the site is now a Next.js app.
//
// A 404 at `/sw.js` does NOT evict the old worker: when the update fetch fails
// the browser keeps the last good worker. Serving THIS valid worker instead
// lets the update check succeed, so it replaces the old one and then tears
// everything down: clears all caches, unregisters itself, and reloads any
// open tabs so they load the live Next.js app straight from the network.
//
// Keep this shipped indefinitely — it is harmless for anyone who never had
// the old worker, and it self-removes for anyone who did.

self.addEventListener("install", () => {
  // Activate immediately instead of waiting for existing tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // 1. Drop every cache the old Workbox worker created.
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      } catch {
        // best-effort
      }

      // 2. Remove this worker so future navigations bypass the SW entirely.
      try {
        await self.registration.unregister();
      } catch {
        // best-effort
      }

      // 3. Reload open tabs so they re-fetch the real app from the network.
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          try {
            client.navigate(client.url);
          } catch {
            // some clients may not allow navigate(); ignore
          }
        }
      } catch {
        // best-effort
      }
    })()
  );
});
