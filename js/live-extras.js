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
    // The race clock always follows the timing clock while a feed is connected: if the strategist
    // does not want that, they stop live timing. (The old on/off switch let it drift and was removed.)
    window._clockSyncOn = true;
    let lastApplied = 0, warnedFar = false, pendingSkews = 0;
    try { localStorage.removeItem('strateger_clock_sync'); } catch (e) {}
    window.toggleClockSync = function() { /* no longer switchable */ };

    window.toggleAutoPit = function() {
        window._autoPitEnabled = !window._autoPitEnabled;
        store.set('strateger_auto_pit', window._autoPitEnabled ? '1' : '0');
        window._updateClockSyncBtn(true);
        if (typeof window.broadcast === 'function') window.broadcast();
    };

    // Detach the race clock from the live-timing clock (this device): the app's own timer runs alone.
    window._clockFeedOn = store.get ? store.get('strateger_clock_feed') !== '0' : true;
    window.toggleClockFeed = function() {
        window._clockFeedOn = !window._clockFeedOn;
        store.set('strateger_clock_feed', window._clockFeedOn ? '1' : '0');
        window._updateClockSyncBtn(true);
    };

    window._updateClockSyncBtn = function(hasFeed) {
        const cf = $('clockFeedBtn');
        if (cf) {
            const on = window._clockFeedOn !== false;
            cf.classList.toggle('hidden', !hasFeed);
            cf.classList.toggle('is-on', on);
            cf.setAttribute('aria-checked', String(on));
            if (typeof window.tt === 'function') cf.title = window.tt('Race clock follows the live timing clock. Turn off to run on the app timer only.');
        }
        const ap = $('autoPitBtn');
        if (ap) {
            const on = !!window._autoPitEnabled;
            ap.classList.toggle('hidden', !hasFeed);
            ap.classList.toggle('is-on', on);
            ap.setAttribute('aria-checked', String(on));
        }
        const b = $('clockSyncBtn');
        if (!b) return;
        b.classList.toggle('hidden', !hasFeed);
        b.textContent = '⏱ ' + tr('clockSynced', 'synced');
    };

    window._syncRaceClockToFeed = function() {
        const st = window.state, ld = window.liveData, cfg = window.config;
        const live = !!(st && st.isRunning && !st.isFinished && ld && ld.raceTimeLeftMs != null && ld.raceTimeLeftMs > 0 && cfg && cfg.raceMs);
        window._updateClockSyncBtn(live);
        if (!live || !window._clockSyncOn || window._clockFeedOn === false || window.role !== 'host') return;

        const now = window.getSyncedNow();
        if (now - lastApplied < 10000) return;
        const received = ld._raceTimeReceivedAt || now;
        if (now - received > 20000) return;                       // stale feed: keep the local clock
        const feedRemaining = Math.max(0, ld.raceTimeLeftMs - (now - received));
        const raceMs = cfg.raceMs;
        const localRemaining = raceMs - (now - st.startTime);
        const skew = feedRemaining - localRemaining;
        if (Math.abs(skew) <= 1500) { pendingSkews = 0; return; }   // already together (the displayed clock follows the feed directly)
        if (++pendingSkews < 2) return;                            // must persist for two checks: one odd poll never moves the clock
        pendingSkews = 0;

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
            if (Math.abs(skew) > 2500) window.showToast('⏱ ' + tr('clockSyncedTo', 'Race clock synced to live timing') + ' (' + (skew > 0 ? '+' : '') + Math.round(skew / 1000) + 's)', 'success', 3500);
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

// ----- Plan for spectators and delegates (they have no plan object, only what the host synced) -----
// Shows who is driving NOW (from the live state, not the original plan), real times for the stints still to
// come, and the rule check. A delegate holding "Edit the plan" also gets minute steppers and move arrows;
// each tap is sent to the host, which enforces the stint limits and refuses anything that
// would break a rule.
(function() {
    const esc = function(x) { return String(x == null ? '' : x).replace(/[&<>"']/g, function(c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
    const hm = function(v) { const d = new Date(v); return isNaN(d) ? '--:--' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const T = function(x) { return window.tt ? window.tt(x) : x; };
    let timer = null;

    // The plan as a list of stints, each with the facts the screen needs
    function buildPlan() {
        const st = window.state || {}, cfg = window.config || {}, drivers = window.drivers || [];
        const cur = Math.max(0, (st.globalStintNumber || 1) - 1);
        const live = !!(st.isRunning && !st.isFinished);
        const targets = Array.isArray(st.stintTargets) ? st.stintTargets : [];
        const pitMs = (parseFloat(cfg.minPitTime) || parseFloat(cfg.minPitSec) || parseFloat(cfg.pitTime) || parseFloat(cfg.planPitTime) || 0) * 1000;
        let items = [];   // {type, driverIdx, name, color, duration, done, pitMs}
        const rp = window._receivedPlan;
        if (rp && Array.isArray(rp.items) && rp.items.length) {
            rp.items.forEach(function(x) {
                items.push({ type: x.t === 'p' ? 'pit' : 'stint', driverIdx: x.d, name: x.n, color: x.c, squad: x.q, duration: x.u, done: !!x.a });
            });
            if (rp.rules && window.role !== 'host') window.raceRules = rp.rules;
        } else {
            (window._receivedTimeline || []).forEach(function(s, i) {
                if (i) items.push({ type: 'pit', duration: pitMs });
                items.push({ type: 'stint', driverIdx: s.driverIdx, name: s.driverName, duration: s.duration, done: (s.stintNumber || i + 1) <= cur });
            });
        }
        const stints = items.filter(function(x) { return x.type === 'stint'; });
        stints.forEach(function(s, i) {
            s.idx = i;
            if (i < cur) s.done = true;
            // what the live race says wins over the original plan: the stint on track is driven by currentDriverIdx
            if (live && i === cur && drivers[st.currentDriverIdx]) { s.driverIdx = st.currentDriverIdx; s.name = drivers[st.currentDriverIdx].name; s.color = drivers[st.currentDriverIdx].color; }
            else if (live && i === cur + 1 && st.nextDriverIdx != null && drivers[st.nextDriverIdx]) { s.driverIdx = st.nextDriverIdx; s.name = drivers[st.nextDriverIdx].name; s.color = drivers[st.nextDriverIdx].color; }
            const d = drivers[s.driverIdx];
            if (d) { s.color = s.color || d.color; s.name = s.name || d.name; }
            // stints still to run follow the live targets
            if (live && i >= cur && targets[i] != null) s.duration = (i === cur && st.targetStintMs) ? st.targetStintMs : targets[i];
        });
        // times for what has not finished: from the real start of the current stint on
        if (live && st.stintStart) {
            let t = st.stintStart - (st.stintOffset || 0);
            let k = 0;
            items.forEach(function(it) {
                if (it.type === 'stint') {
                    if (it.idx < cur) return;
                    it.start = t; t += it.duration; it.end = t; k++;
                } else if (it.idx === undefined && k > 0) {
                    t += it.duration || pitMs;
                }
            });
        }
        return { items: items, stints: stints, cur: cur, live: live };
    }

    function canEdit() { const co = window._coAdmin; return !!(co && co.granted && co.perms && co.perms.plan); }

    function complianceHtml(plan) {
        if (typeof window.checkCompliance !== 'function') return '';
        const tl = plan.items.map(function(x) { return { type: x.type, driverIdx: x.driverIdx, duration: x.duration || 0, _actual: x.done, _done: x.done }; });
        const c = window.checkCompliance(tl, window.config);
        if (!c.total) return '';
        const ok = c.failing.length === 0;
        const F = function(k, v) { return typeof window.tf === 'function' ? window.tf(k, v) : k; };
        const head = ok ? F('cpHeadOk', { n: c.total }) : F('cpHeadBad', { b: c.failing.length, n: c.total });
        const list = (ok ? [] : c.failing).map(function(i) { return '<li class="bad"><i class="fas fa-times"></i> ' + esc(i.text) + '</li>'; }).join('');
        return '<div class="cp-rules ' + (ok ? 'is-ok' : 'is-bad') + '"><div class="cp-rules-head"><i class="fas fa-' + (ok ? 'shield-alt' : 'exclamation-triangle') + '"></i> ' + esc(head) + '</div>' + (list ? '<ul class="cp-rules-list">' + list + '</ul>' : '') + '</div>';
    }

    function rowsHtml(plan) {
        const edit = canEdit() && plan.live;
        const unit = (window.t && window.t('unitMin') !== 'unitMin') ? window.t('unitMin') : 'm';
        return plan.stints.map(function(s) {
            const i = s.idx, done = i < plan.cur, now = i === plan.cur && plan.live;
            const state = done ? 'done' : (now ? 'now' : 'next');
            const mins = Math.round((s.duration || 0) / 60000);
            let dur = '<span class="cp-dur">' + mins + unit + '</span>';
            let mv = '';
            if (edit && !done) {
                dur = '<span class="cp-step"><button type="button" class="cp-btn" data-act="min" data-i="' + i + '" data-v="' + (mins - 1) + '" aria-label="-1">&minus;</button>'
                    + '<span class="cp-mins">' + mins + '</span>'
                    + '<button type="button" class="cp-btn" data-act="min" data-i="' + i + '" data-v="' + (mins + 1) + '" aria-label="+1">+</button></span>';
                if (!now) mv = '<span class="cp-move"><button type="button" class="cp-btn cp-mini" data-act="move" data-i="' + i + '" data-v="-1" aria-label="' + esc(T('Move up')) + '"' + (i - 1 <= plan.cur ? ' disabled' : '') + '>&#9650;</button>'
                    + '<button type="button" class="cp-btn cp-mini" data-act="move" data-i="' + i + '" data-v="1" aria-label="' + esc(T('Move down')) + '"' + (i + 1 >= plan.stints.length ? ' disabled' : '') + '>&#9660;</button></span>';
            }
            return '<div class="cp-row cp-' + state + '"><span class="cp-n">' + (done ? '&#10003;' : (now ? '&#9654;' : (i + 1))) + '</span>'
                + '<span class="cp-dot" style="background:' + esc(s.color || '#22d3ee') + '"></span>'
                + '<span class="cp-name">' + esc(s.name || '') + '</span>'
                + (s.start ? '<span class="cp-time" dir="ltr">' + hm(s.start) + '–' + hm(s.end) + '</span>' : '')
                + dur + mv + '</div>';
        }).join('');
    }

    function render(ov) {
        const plan = buildPlan();
        const list = ov.querySelector('.cp-list');
        const keep = list ? list.scrollTop : 0;
        const edit = canEdit() && plan.live;
        const html = complianceHtml(plan)
            + '<div class="cp-list">' + (rowsHtml(plan) || '<p class="cp-empty">…</p>') + '</div>'
            + '';
        if (ov._last === html) return;     // nothing changed: do not rebuild under a finger
        ov._last = html;
        ov.querySelector('.cp-body').innerHTML = html;
        const nl = ov.querySelector('.cp-list');
        if (nl) {
            nl.scrollTop = keep;
            if (!keep) { const nowRow = nl.querySelector('.cp-now'); if (nowRow) nowRow.scrollIntoView({ block: 'center' }); }
        }
    }

    window.openClientPlan = function() {
        let ov = document.getElementById('clientPlanOverlay');
        if (ov) ov.remove();
        if (timer) { clearInterval(timer); timer = null; }
        ov = document.createElement('div');
        ov.id = 'clientPlanOverlay';
        ov.className = 'client-plan';
        ov.innerHTML = '<div class="cp-sheet"><div class="cp-head"><b>' + esc(T('Race plan')) + '</b><button type="button" class="cp-close" aria-label="Close">&times;</button></div><div class="cp-body"></div></div>';
        ov.addEventListener('click', function(e) {
            if (e.target === ov || e.target.closest('.cp-close')) { ov.remove(); clearInterval(timer); timer = null; return; }
            const b = e.target.closest('[data-act]');
            if (!b || b.disabled || !canEdit()) return;
            const act = b.dataset.act;
            if (act === 'min') window.coSetStintMin(Number(b.dataset.i), Number(b.dataset.v));
            else if (act === 'move') window.coMoveStint(Number(b.dataset.i), Number(b.dataset.v));
        });
        document.body.appendChild(ov);
        render(ov);
        // the host's replies arrive as ordinary updates: keep the sheet in step while it is open
        timer = setInterval(function() { if (!document.body.contains(ov)) { clearInterval(timer); timer = null; return; } render(ov); }, 1200);
    };
})();
