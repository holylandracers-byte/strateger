// Live timing extras for the race screen:
//   - the "not connected" panel can be hidden without connecting (a chip brings it back)
//   - an explicit "which car is yours" choice (team / kart / driver / everything)
//   - view the real timing page, connected or not
//   - the race clock follows the timing clock when the feed provides one

(function() {
    const tr = function(k, fb) { const v = window.t ? window.t(k) : null; return (v && v !== k) ? v : fb; };
    const $ = function(id) { return document.getElementById(id); };
    const store = {
        get: function(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
        set: function(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    };

    // ----- 1) hide / bring back the panel -----
    window.setNoLiveDismissed = function(on) {
        document.body.classList.toggle('nolive-dismissed', !!on);
        store.set('strateger_nolive_dismissed', on ? '1' : '0');
    };
    if (store.get('strateger_nolive_dismissed') === '1') document.body.classList.add('nolive-dismissed');

    // ----- 3) what to match on -----
    const FILTERS = {
        team:   { ph: 'ltPhTeam', hint: 'ltHintTeam' },
        kart:   { ph: 'ltPhKart', hint: 'ltHintKart' },
        driver: { ph: 'ltPhDriver', hint: 'ltHintDriver' },
        all:    { ph: '', hint: 'ltHintAll' }
    };
    window.onRaceLtFilterBy = function(kind) {
        const f = FILTERS[kind] || FILTERS.team;
        window._ltFilterKind = FILTERS[kind] ? kind : 'team';
        const input = $('raceLtValue');
        if (input) { input.placeholder = f.ph ? tr(f.ph, '') : ''; input.disabled = kind === 'all'; if (kind === 'all') input.value = ''; }
        const hint = $('raceLtFilterHint');
        if (hint) hint.textContent = tr(f.hint, '');
        // the setup screen holds the real radios the timing code reads
        const radio = document.querySelector('input[name="searchType"][value="' + (kind === 'all' ? 'team' : kind) + '"]');
        if (radio) radio.checked = true;
    };
    document.addEventListener('DOMContentLoaded', function() {
        const picked = document.querySelector('input[name="searchType"]:checked');
        const sel = $('raceLtFilterBy');
        if (sel && picked) sel.value = picked.value;
        window.onRaceLtFilterBy(sel ? sel.value : 'team');
    });

    // ----- 2) the real page -----
    window.openTimingPage = function() {
        const url = ($('raceLtUrl') && $('raceLtUrl').value.trim()) || (window.liveTimingConfig && window.liveTimingConfig.url) || '';
        if (!url) { const st = $('raceLtStatus'); if (st) { st.textContent = tr('enterUrl', 'Enter the timing URL first'); st.className = 'no-live-status is-error'; } return; }
        let ov = $('ltPageViewer');
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'ltPageViewer';
            ov.className = 'lt-page-viewer';
            ov.innerHTML = '<div class="lt-page-bar"><span class="lt-page-title"></span>'
                + '<a class="lt-page-open" target="_blank" rel="noopener">' + tr('ltOpenTab', 'Open in new tab') + ' &#8599;</a>'
                + '<button type="button" class="lt-page-close" aria-label="Close">&times;</button></div>'
                + '<iframe class="lt-page-frame" sandbox="allow-scripts allow-same-origin allow-forms allow-popups"></iframe>'
                + '<p class="lt-page-note">' + tr('ltPageNote', '') + '</p>';
            ov.querySelector('.lt-page-close').onclick = function() { ov.classList.add('hidden'); ov.querySelector('iframe').removeAttribute('src'); };
            document.body.appendChild(ov);
        }
        ov.querySelector('.lt-page-title').textContent = url.replace(/^https?:\/\//, '');
        ov.querySelector('.lt-page-open').href = url;
        ov.querySelector('iframe').src = url;
        ov.classList.remove('hidden');
    };
    // the widget's own "Original" toggle gets the same new-tab fallback
    const origToggle = window.toggleApexIframe;
    window.toggleApexIframe = function() {
        const link = $('apexIframeOpen');
        const url = window.liveTimingConfig && window.liveTimingConfig.url;
        if (link && url) link.href = url;
        const r = typeof origToggle === 'function' ? origToggle.apply(this, arguments) : undefined;
        // original page showing: the six stat boxes go away and the page gets the whole widget
        const box = $('apexIframeContainer');
        document.body.classList.toggle('lt-original', !!box && !box.classList.contains('hidden'));
        return r;
    };
    const origStop = window.stopLiveTiming;
    window.stopLiveTiming = function() {
        document.body.classList.remove('lt-original');
        return typeof origStop === 'function' ? origStop.apply(this, arguments) : undefined;
    };

    // ----- 4) race clock follows the timing clock -----
    window._clockSyncOn = store.get('strateger_clock_sync') !== '0';
    let lastApplied = 0, warnedFar = false;

    window.toggleClockSync = function() {
        window._clockSyncOn = !window._clockSyncOn;
        store.set('strateger_clock_sync', window._clockSyncOn ? '1' : '0');
        lastApplied = 0;
        window._updateClockSyncBtn(true);
        if (window._clockSyncOn) window._syncRaceClockToFeed();
    };

    window._updateClockSyncBtn = function(hasFeed) {
        const b = $('clockSyncBtn');
        if (!b) return;
        b.classList.toggle('hidden', !hasFeed);
        b.textContent = window._clockSyncOn ? '⏱ ' + tr('clockSynced', 'synced') : '⏱ ' + tr('clockOff', 'sync off');
        b.classList.toggle('is-on', !!window._clockSyncOn);
    };

    window._syncRaceClockToFeed = function() {
        const st = window.state, ld = window.liveData, cfg = window.config;
        const live = !!(st && st.isRunning && !st.isFinished && ld && ld.raceTimeLeftMs != null && ld.raceTimeLeftMs > 0 && cfg && cfg.raceMs);
        window._updateClockSyncBtn(live);
        if (!live || !window._clockSyncOn || window.role !== 'host') return;

        const now = window.getSyncedNow();
        if (now - lastApplied < 15000) return;
        const received = ld._raceTimeReceivedAt || now;
        if (now - received > 20000) return;                       // stale feed: keep the local clock
        const feedRemaining = Math.max(0, ld.raceTimeLeftMs - (now - received));
        const raceMs = cfg.raceMs;
        const localRemaining = raceMs - (now - st.startTime);
        const skew = feedRemaining - localRemaining;
        if (Math.abs(skew) <= 2000) return;                        // already together

        lastApplied = now;
        if (feedRemaining > raceMs) {
            // The board has more time left than the plan: the race is longer than configured.
            cfg.raceMs = (now - st.startTime) + feedRemaining;
            cfg.duration = cfg.raceMs / 3600000;
            window._durationMismatchWarned = true;
            window.showToast('⏱ ' + tr('clockLengthAdjusted', 'Race length set from live timing') + ': ' + (cfg.duration).toFixed(2) + 'h', 'info', 6000);
        } else if (Math.abs(skew) > 600000) {
            // Ten minutes apart usually means the board is showing another session: do not rewrite the clock.
            if (!warnedFar) { warnedFar = true; window.showToast('⚠️ ' + tr('clockFar', 'Live timing clock differs by more than 10 min - not synced'), 'warning', 9000); }
            return;
        } else {
            st.startTime = now - (raceMs - feedRemaining);
            window.showToast('⏱ ' + tr('clockSyncedTo', 'Race clock synced to live timing') + ' (' + (skew > 0 ? '+' : '') + Math.round(skew / 1000) + 's)', 'success', 3500);
        }
        if (typeof window.saveRaceState === 'function') window.saveRaceState();
        if (typeof window.broadcast === 'function') window.broadcast();
        if (typeof window.renderFrame === 'function') window.renderFrame();
    };
    setInterval(function() { try { window._syncRaceClockToFeed(); } catch (e) { console.warn('clock sync', e); } }, 2000);
})();

// keep the car-filter placeholder and hint in the chosen language when it changes
(function() {
    const orig = window.setLanguage;
    if (typeof orig !== 'function') return;
    window.setLanguage = function() {
        const r = orig.apply(this, arguments);
        if (typeof window.onRaceLtFilterBy === 'function') window.onRaceLtFilterBy(window._ltFilterKind || 'team');
        return r;
    };
})();
