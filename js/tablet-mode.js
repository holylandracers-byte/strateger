// Marks touch tablets with <html class="is-tablet"> so css/tablet.css can retune type size and
// touch targets for them. Orientation is handled in CSS (portrait = phone layout, landscape =
// desktop layout), so only the device class is decided here.
// Force on/off for testing: localStorage.setItem('strateger-tablet', '1' | '0').
(function () {
    'use strict';
    const root = document.documentElement;
    function detect() {
        let forced = null;
        try { forced = localStorage.getItem('strateger-tablet'); } catch (e) { /* storage blocked */ }
        if (forced === '1' || forced === '0') return forced === '1';
        const touch = (navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer: coarse)').matches;
        const shortSide = Math.min(screen.width || innerWidth, screen.height || innerHeight);
        const longSide = Math.max(screen.width || innerWidth, screen.height || innerHeight);
        // tablets: shortest edge >= 600 CSS px (phones top out ~450), longest <= ~1400
        return touch && shortSide >= 600 && longSide <= 1500;
    }
    function apply() { root.classList.toggle('is-tablet', detect()); }
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
})();
