// ==========================================
// 📦 STRATEGER SERVICE WORKER — Offline-First PWA
// ==========================================
const CACHE_VERSION = 2;
const CACHE_NAME = `strateger-v${CACHE_VERSION}`;

// Core app shell — must be cached for offline
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/config.js',
    '/js/state.js',
    '/js/auth.js',
    '/js/network.js',
    '/js/strategy.js',
    '/js/live-timing.js',
    '/js/live-timing-manager.js',
    '/js/racefacer-scraper.js',
    '/js/apex-scraper.js',
    '/js/ui.js',
    '/js/main.js',
    '/icons/icon-192.svg',
    '/icons/icon-512.svg',
    '/manifest.json'
];

// CDN assets critical for UI — must be cached for offline look & feel
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdn.tailwindcss.com',
    'https://bernardo-castilho.github.io/DragDropTouch/DragDropTouch.js',
    'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// Paths that should NEVER be cached (live/server features)
const NETWORK_ONLY_PATTERNS = [
    '.netlify/functions',
    '/peerjs',
    'accounts.google.com',
    'apis.google.com',
    'google.com/gsi'
];

// Install: pre-cache all static + CDN assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('[SW] Caching app shell + CDN assets');

            // Cache local assets — don't fail install if one file is missing
            const localPromises = STATIC_ASSETS.map(url =>
                cache.add(url).catch(err => console.warn(`[SW] Skip cache ${url}:`, err))
            );

            // Cache CDN assets with proper opaque handling
            const cdnPromises = CDN_ASSETS.map(async (url) => {
                try {
                    const response = await fetch(url, { mode: 'cors' });
                    if (response.ok) {
                        await cache.put(url, response);
                        console.log(`[SW] Cached CDN: ${url}`);
                    }
                } catch (err) {
                    // Try no-cors for stubborn CDNs (opaque response is fine for cache)
                    try {
                        const response = await fetch(url, { mode: 'no-cors' });
                        await cache.put(url, response);
                        console.log(`[SW] Cached CDN (opaque): ${url}`);
                    } catch (e) {
                        console.warn(`[SW] Failed CDN cache ${url}:`, e);
                    }
                }
            });

            await Promise.all([...localPromises, ...cdnPromises]);
        })
    );
    // Activate immediately
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => {
                    console.log('[SW] Removing old cache:', k);
                    return caches.delete(k);
                })
            )
        )
    );
    self.clients.claim();
});

// Helper: check if URL matches network-only patterns
function isNetworkOnly(url) {
    return NETWORK_ONLY_PATTERNS.some(p => url.includes(p)) ||
           url.startsWith('ws:') || url.startsWith('wss:');
}

// Fetch strategy
self.addEventListener('fetch', (event) => {
    const url = event.request.url;

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip network-only resources (API, Google Auth, WebSocket, PeerJS)
    if (isNetworkOnly(url)) return;

    // Navigation requests (HTML pages): network-first with offline fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match('/index.html'))
        );
        return;
    }

    // Font Awesome webfont files (woff2) — cache-first
    if (url.includes('cdnjs.cloudflare.com/ajax/libs/font-awesome') && !url.endsWith('.css')) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) return cached;
                return fetch(event.request).then(response => {
                    if (response.ok || response.type === 'opaque') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => new Response('', { status: 404 }));
            })
        );
        return;
    }

    // Local assets: stale-while-revalidate
    if (new URL(url).origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                const networkFetch = fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                }).catch(() => cached);

                return cached || networkFetch;
            })
        );
        return;
    }

    // CDN assets: cache-first with network fallback
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (response.ok || response.type === 'opaque') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => new Response('', { status: 404 }));
        })
    );
});
