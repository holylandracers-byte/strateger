// ==========================================
// 🪶 LITE MODE — lighter rendering for slow tablets
// 'auto' turns it on for low-memory / few-core devices or when the OS asks for reduced
// motion; 'on' / 'off' are explicit. CSS does the heavy lifting (body.lite in style.css);
// window.liteTick lets timers back off from 500ms to 1s ticks.
// ==========================================
(function () {
    const KEY = 'strateger_lite';
    function pref() { try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; } }
    function weakDevice() {
        const mem = navigator.deviceMemory;
        const cores = navigator.hardwareConcurrency;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        return reduce || (mem && mem <= 4) || (cores && cores <= 4);
    }
    function apply() {
        const p = pref();
        window.LITE = p === 'on' || (p === 'auto' && !!weakDevice());
        if (document.body) document.body.classList.toggle('lite', window.LITE);
        document.querySelectorAll('[data-lite-opt]').forEach(b => b.classList.toggle('is-on', b.dataset.liteOpt === p));
    }
    window.setLiteMode = function (v) {
        try { localStorage.setItem(KEY, v); } catch (e) {}
        apply();
    };
    window.liteTick = (ms) => (window.LITE ? Math.max(ms, 1000) : ms);
    apply();
    document.addEventListener('DOMContentLoaded', apply);
    window.addEventListener('load', apply);
})();
