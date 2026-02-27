// ==========================================
// 📦 STRATEGER SERVICE WORKER
// ==========================================
const CACHE_NAME = 'strateger-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/style.css',
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

// CDN assets we also want to cache (fonts, icons, etc.)
const CDN_ASSETS = [
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// Install: cache all static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching static assets');
            // Cache local assets — ignore failures for individual files
            const localPromises = STATIC_ASSETS.map(url =>
                cache.add(url).catch(err => console.warn(`[SW] Failed to cache ${url}:`, err))
            );
            const cdnPromises = CDN_ASSETS.map(url =>
                cache.add(url).catch(err => console.warn(`[SW] Failed to cache CDN ${url}:`, err))
            );
            return Promise.all([...localPromises, ...cdnPromises]);
        })
    );
    // Activate immediately — don't wait for old tabs to close
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
    // Take control of all open pages immediately
    self.clients.claim();
});

// Fetch: Network-first for API/dynamic, Cache-first for static assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip PeerJS signaling, WebSocket, and Netlify API calls — always go to network
    if (url.pathname.includes('.netlify/') ||
        url.pathname.includes('/peerjs') ||
        url.hostname.includes('peerjs') ||
        url.protocol === 'ws:' || url.protocol === 'wss:') {
        return;
    }

    // For navigation requests (HTML pages): network-first with cache fallback
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Update cache with fresh copy
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request) || caches.match('/index.html'))
        );
        return;
    }

    // For local static assets: cache-first with network fallback
    if (url.origin === self.location.origin) {
        event.respondWith(
            caches.match(event.request).then(cached => {
                if (cached) {
                    // Return cached, but also update in background (stale-while-revalidate)
                    fetch(event.request).then(response => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then(cache => cache.put(event.request, response));
                        }
                    }).catch(() => {});
                    return cached;
                }
                return fetch(event.request).then(response => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // CDN assets: cache-first
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
