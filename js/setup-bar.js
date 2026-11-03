// ==========================================
// SETUP BAR
// One-line summary beside the pinned Start button. It only reads the real setup
// inputs, so the setup page stays the single source of truth.
// ==========================================
(function () {
    const t = (k) => (window.t ? window.t(k) : k);
    const $ = (id) => document.getElementById(id);

    function summary() {
        const el = $('setupBarSummary');
        if (!el) return;
        const bad = $('invalidStrategyWarning') && !$('invalidStrategyWarning').classList.contains('hidden');
        const lapRace = !!(window.isLapRace && window.isLapRace());
        const len = lapRace
            ? ($('raceLaps')?.value || '') + ' ' + t('laps')
            : ($('raceDuration')?.value || '') + 'h';
        const stops = $('reqPitStops')?.value;
        const drivers = (window._driverGroupParticipants && window._driverGroupParticipants.size) || document.querySelectorAll('#driversList > *').length;
        const parts = [len];
        if (stops) parts.push(stops + ' ' + t('xPitStops'));
        parts.push(drivers + ' ' + t('xWzDrivers'));
        const warn = '';
        el.textContent = warn + parts.join(' · ');
        el.classList.toggle('is-bad', !!bad);
    }

    let pending = 0;
    const schedule = () => { clearTimeout(pending); pending = setTimeout(summary, 120); };

    window.addEventListener('DOMContentLoaded', () => {
        const root = $('setupScreen');
        if (!root) return;
        root.addEventListener('input', schedule);
        root.addEventListener('change', schedule);
        root.addEventListener('click', schedule);
        const warn = $('invalidStrategyWarning');
        if (warn) new MutationObserver(schedule).observe(warn, { attributes: true, attributeFilter: ['class'] });
        const list = $('driversList');
        if (list) new MutationObserver(schedule).observe(list, { childList: true });
        summary();
    });
    window.addEventListener('load', () => setTimeout(summary, 600));
    window.updateSetupBarSummary = summary;
})();
