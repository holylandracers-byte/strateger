// ==========================================
// SETUP: HOME + EDITOR + PINNED BAR
// Home lists the saved strategies; a race starts from there. The editor is the long
// setup form (the single source of truth for every setting). The pinned bar belongs
// to the editor: a one-line summary, Preview, and Save.
// ==========================================
(function () {
    const t = (k, fb) => { const v = window.t ? window.t(k) : null; return (v && v !== k) ? v : (fb || k); };
    const $ = (id) => document.getElementById(id);
    const esc = (x) => (window._escHtml ? window._escHtml(x) : String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
    const CARDS = ['qualifyingPanel', 'generalCard', 'driversCard', 'rulesCard', 'liveCard'];

    // ---------- bar summary ----------
    function summary() {
        const el = $('setupBarSummary');
        if (!el) return;
        const bad = $('invalidStrategyWarning') && !$('invalidStrategyWarning').classList.contains('hidden');
        const lapRace = !!(window.isLapRace && window.isLapRace());
        const len = lapRace ? ($('raceLaps')?.value || '') + ' ' + t('laps') : ($('raceDuration')?.value || '') + 'h';
        const stops = $('reqPitStops')?.value;
        const drivers = driverNames().length;
        const parts = [len];
        if (stops) parts.push(stops + ' ' + t('xPitStops'));
        parts.push(drivers + ' ' + t('xWzDrivers'));
        // The stint result box is hidden; its count rides in the bar, and its errors replace the summary.
        const sim = ($('simResult')?.textContent || '').trim();
        const err = /^⚠/.test(sim) ? sim : '';
        const stints = !err && !$('simResult')?.classList.contains('hidden') ? (sim.match(/\d+/) || [])[0] : '';
        if (stints) parts.splice(1, 0, stints + ' ' + t('xStintsWord'));
        el.textContent = err || parts.join(' · ');
        el.title = el.textContent;
        el.classList.toggle('is-bad', !!bad || !!err);
        cardSummaries();
        subSummaries();
    }

    function driverNames() {
        return Array.from(document.querySelectorAll('#driversList .driver-row'))
            .filter(r => !r.classList.contains('opacity-50'))
            .map(r => r.querySelector('.driver-input')?.value).filter(Boolean);
    }

    // ---------- section heads: one-line readout ----------
    const SECTIONS = {
        generalCard: () => {
            const lap = !!(window.isLapRace && window.isLapRace());
            const len = lap ? ($('raceLaps')?.value || '') + ' ' + t('laps') : ($('raceDuration')?.value || '') + 'h';
            const stops = $('reqPitStops')?.value;
            return [len, stops ? stops + ' ' + t('xPitStops') : '', $('raceStartTime')?.value || ''].filter(Boolean).join(' · ');
        },
        driversCard: () => driverNames().join(' · '),
        rulesCard: () => $('rulesActiveCount') && !$('rulesActiveCount').classList.contains('hidden') ? $('rulesActiveCount').textContent : '',
        qualifyingPanel: () => {
            const segs = (window._qualifyConfig && window._qualifyConfig.segments) || '';
            return ($('qualifyDuration')?.value || '') + ' min' + (segs ? ' · Q1' + (segs > 1 ? '–Q' + segs : '') : '');
        },
        liveCard: () => ($('liveTimingUrl')?.value || '').replace(/^https?:\/\//, '').slice(0, 40)
    };
    function cardSummaries() {
        Object.keys(SECTIONS).forEach(id => {
            const card = $(id);
            const head = card && card.querySelector(':scope > h2');
            if (!head) return;
            let span = head.querySelector('.sec-sum');
            if (!span) {
                span = document.createElement('span');
                span.className = 'sec-sum';
                head.insertBefore(span, head.querySelector('.collapse-icon') || null);
            }
            let txt = '';
            try { txt = SECTIONS[id](); } catch (e) {}
            if (span.textContent !== txt) span.textContent = txt;
        });
    }

    // ---------- inner collapses: each card's sub-sections fold on their own ----------
    const SUB_SUM = {
        xSecLength: () => {
            const lap = !!(window.isLapRace && window.isLapRace());
            const len = lap ? ($('raceLaps')?.value || '') + ' ' + t('laps') : ($('raceDuration')?.value || '') + 'h';
            const stops = $('reqPitStops')?.value;
            return len + (stops ? ' · ' + stops + ' ' + t('xPitStops') : '');
        },
        lblRaceStart: () => [$('raceStartDate')?.value, $('raceStartTime')?.value].filter(Boolean).join(' · '),
        xSecStints: () => {
            const a = $('minStint')?.value, b = $('maxStint')?.value, p = $('minPitTime')?.value;
            return [a || b ? (a || '–') + '–' + (b || '–') + ' min' : '', p ? p + ' s' : ''].filter(Boolean).join(' · ');
        },
        lblTrackLocation: () => $('raceLocation')?.value || '',
        qualifyFormat: () => {
            const q = window._qualifyConfig || {};
            const segs = q.format === 'simple' ? '' : ' · Q1' + (q.segments > 1 ? '–Q' + q.segments : '');
            return ($('qualifyDuration')?.value || '') + ' min' + segs + ' · ' + ($('qualifyRuns')?.value || 1) + '×';
        },
        qualifyParticipation: () => ({ one: t('qualifyPartOne'), multi: t('qualifyPartMulti'), all: t('qualifyPartAll') }[(window._qualifyConfig || {}).participation || 'all']),
        qualifyPitRule: () => ({ none: t('qualifyPitNone'), any: t('qualifyPitAny'), min: t('qualifyPitMin') + ' ' + ($('qPitMinTime')?.value || '') + ' s' }[(window._qualifyConfig || {}).pitRule || 'none']),
        grpRotation: () => ($('allowDouble')?.checked ? t('lblDoubles') + ($('doubleStintsWanted')?.value ? ' · ' + $('doubleStintsWanted').value : '') : '') + (parseInt($('numSquads')?.value) ? ' · ' + $('numSquads').value + ' ' + t('lblSquads') : ''),
        grpDriverLimits: () => { const a = $('minDriverTime')?.value, b = $('maxDriverTime')?.value; return a || b ? (a || '–') + '–' + (b || '–') + ' min' : ''; },
        grpPitRules: () => { const a = $('pitClosedStart')?.value, b = $('pitClosedEnd')?.value; return (a || b ? (a || '0') + '–' + (b || '–') + ' min' : '') + ($('trackFuel')?.checked ? ' · ' + t('lblFuel') : ''); },
        grpAlerts: () => ($('pitNotifyLeadMin')?.value || '') ? $('pitNotifyLeadMin').value + ' min' : ''
    };
    const subs = [];
    const isSubHead = (n) => n.nodeType === 1 && n.tagName === 'H3' && /(sec-sub|rules-group-title)/.test(n.className);
    function initInnerCollapse() {
        [['qualifyingPanel', true], ['generalCard', true], ['rulesCard', false]].forEach(([cardId, firstOpen]) => {
            const body = $(cardId)?.querySelector(':scope > .collapse-body');
            if (!body) return;
            Array.from(body.children).filter(isSubHead).forEach((h, idx) => {
                const wrap = document.createElement('div');
                wrap.className = 'sub' + (idx === 0 && firstOpen ? '' : ' is-collapsed');
                const inner = document.createElement('div');
                inner.className = 'sub-body';
                let n = h.nextSibling;
                while (n && !isSubHead(n)) { const nx = n.nextSibling; inner.appendChild(n); n = nx; }
                h.parentNode.insertBefore(wrap, h);
                const key = h.getAttribute('data-i18n') || '';
                const label = h.textContent;
                h.className = 'sub-head-wrap';
                h.innerHTML = '<button type="button" class="sub-head" aria-expanded="' + (wrap.classList.contains('is-collapsed') ? 'false' : 'true') + '"><span class="sub-title"' + (key ? ' data-i18n="' + key + '"' : '') + '>' + esc(label) + '</span><span class="sub-sum"></span><i class="fas fa-chevron-down sub-chev"></i></button>';
                wrap.appendChild(h); wrap.appendChild(inner);
                h.querySelector('button').addEventListener('click', () => {
                    const c = wrap.classList.toggle('is-collapsed');
                    h.querySelector('button').setAttribute('aria-expanded', c ? 'false' : 'true');
                });
                subs.push({ wrap, key, sum: h.querySelector('.sub-sum') });
            });
        });
    }
    function subSummaries() {
        subs.forEach(o => {
            let txt = '';
            try { txt = (SUB_SUM[o.key] && SUB_SUM[o.key]()) || ''; } catch (e) {}
            if (o.sum.textContent !== txt) o.sum.textContent = txt;
        });
    }
    // open the sub-section that holds a field (tour, validation messages)
    window._openSubFor = function (el) {
        const w = el && el.closest && el.closest('.sub');
        if (w) { w.classList.remove('is-collapsed'); const b = w.querySelector('.sub-head'); if (b) b.setAttribute('aria-expanded', 'true'); }
    };

    // ---------- accordion: one section open at a time ----------
    let accordionBusy = false;
    function openOnly(id) {
        accordionBusy = true;
        CARDS.forEach(c => { const el = $(c); if (el) el.classList.toggle('collapsed', c !== id); });
        accordionBusy = false;
    }
    function initAccordion() {
        CARDS.forEach(id => {
            const el = $(id);
            if (!el) return;
            new MutationObserver(() => {
                if (accordionBusy || el.classList.contains('collapsed')) return;
                openOnly(id);
            }).observe(el, { attributes: true, attributeFilter: ['class'] });
        });
        openOnly('generalCard');
    }

    // ---------- home / editor ----------
    function show(el, on) { if (el) el.classList.toggle('hidden', !on); }
    window.showStrategyHome = function () {
        show($('strategyHome'), true); show($('strategyEditor'), false); show($('setupActionCard'), false);
        window.refreshStrategyHome();
        window.scrollTo(0, 0);
    };
    window.showStrategyEditor = function () {
        show($('strategyHome'), false); show($('strategyEditor'), true); show($('setupActionCard'), true);
        if (typeof window.runSim === 'function') { try { window.runSim(); } catch (e) {} }
        openOnly(window._sessionMode === 'qualify' ? 'qualifyingPanel' : 'generalCard');
        schedule();
        window.scrollTo(0, 0);
    };
    window.saveStrategyFromEditor = function () {
        if (!window.cachedStrategy && typeof window.runSim === 'function') window.runSim();
        if (!window.cachedStrategy) return window.showToast && window.showToast(window.tt('Please generate a strategy first!'), 'warning');
        window.saveStrategy();
    };
    document.addEventListener('strategy:saved', () => window.showStrategyHome());

    function metaOf(s) {
        const c = s.config || {};
        const size = c.raceTarget === 'laps' ? (c.raceLaps || 0) + ' ' + t('laps') : (Math.round((c.duration || 0) * 100) / 100) + 'h';
        const names = (s.drivers || []).map(d => d.name);
        const date = new Date(s.timestamp).toLocaleDateString([], { day: 'numeric', month: 'short' });
        return { line: [size, (c.reqStops || 0) + ' ' + t('xPitStops'), names.length + ' ' + t('xWzDrivers'), date].join(' · '), names };
    }

    function card(s, i) {
        const m = metaOf(s);
        const qual = s.config && s.config.sessionMode === 'qualify';
        const cloud = s.synced ? '<i class="fas fa-cloud" title="Cloud"></i>' : '<i class="fas fa-mobile-alt" title="' + esc(t('savedOnDevice', 'Saved on this device')) + '"></i>';
        const go = (qual ? '<button type="button" class="home-go is-quali" data-act="quali" data-i="' + i + '">' + esc(t('xStartQualiShort', 'Qualifying')) + '</button>' : '')
            + '<button type="button" class="home-go" data-act="preview" data-i="' + i + '">' + esc(t('xPreviewStart', 'Preview and start')) + '</button>';
        return '<article class="home-card">'
            + '<div class="home-card-main"><h2 class="home-card-name">' + cloud + '<span>' + esc(s.name) + '</span></h2>'
            + '<p class="home-card-meta">' + esc(m.line) + '</p>'
            + (m.names.length ? '<p class="home-card-drivers">' + esc(m.names.join(' · ')) + '</p>' : '') + '</div>'
            + '<div class="home-card-act">' + go
            + '<button type="button" class="home-ghost" data-act="edit" data-i="' + i + '">' + esc(t('xWzEdit', 'Edit')) + '</button>'
            + (s._local ? '<button type="button" class="home-ghost home-del" data-act="del" data-i="' + i + '" aria-label="Delete"><i class="fas fa-trash"></i></button>' : '')
            + '</div></article>';
    }

    function renderHome(list) {
        const main = list.filter(s => !s.auto).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const drafts = list.filter(s => s.auto).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        window.currentStrategies = main.concat(drafts);
        const box = $('homeList');
        if (!box) return;
        box.innerHTML = main.length
            ? main.map((s, i) => card(s, i)).join('')
            : '<div class="home-empty"><p>' + esc(t('xHomeEmpty', 'No saved strategies yet. Build one, save it, and start your race from here.')) + '</p></div>';
        const dt = $('homeDraftsToggle'), dl = $('homeDrafts');
        show(dt, drafts.length > 0);
        if (dt) dt.textContent = t('xDrafts', 'Auto-saved drafts') + ' (' + drafts.length + ')';
        if (dl) dl.innerHTML = drafts.map((s, i) => card(s, main.length + i)).join('');
    }

    window.refreshStrategyHome = function () {
        if (typeof window.getStrategyList === 'function') window.getStrategyList(renderHome);
        else renderHome([]);
    };

    function openFromHome(i, then) {
        window.applyStrategy(i);                              // fills the editor and opens the preview
        const prev = $('previewScreen');
        if (then === 'edit') {
            show(prev, false); show($('setupScreen'), true);
            window.showStrategyEditor();
        } else {
            // Nothing starts on its own: the preview is where the last-minute changes happen and Start Race lives.
            if (then === 'quali') setTimeout(() => { show(prev, false); window.startQualifyingDirect(); }, 60);
        }
    }

    function initHome() {
        const home = $('strategyHome');
        if (!home) return;
        home.addEventListener('click', (e) => {
            const dt = e.target.closest('#homeDraftsToggle');
            if (dt) { $('homeDrafts').classList.toggle('hidden'); return; }
            const b = e.target.closest('[data-act]');
            if (!b) return;
            const i = parseInt(b.dataset.i);
            if (b.dataset.act === 'del') return window.deleteStrategy(i);
            if (!(window.currentStrategies || [])[i]) return;
            openFromHome(i, b.dataset.act);
        });
    }

    // ---------- plumbing ----------
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
        const simEl = $('simResult');
        if (simEl) new MutationObserver(schedule).observe(simEl, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
        const list = $('driversList');
        if (list) new MutationObserver(schedule).observe(list, { childList: true, subtree: false });
        const origMode = window.setSessionMode;
        if (typeof origMode === 'function') {
            window.setSessionMode = function (mode) {
                const r = origMode.apply(this, arguments);
                if (!$('strategyEditor')?.classList.contains('hidden')) openOnly(mode === 'qualify' ? 'qualifyingPanel' : 'generalCard');
                schedule();
                return r;
            };
        }
        initInnerCollapse();
        initAccordion();
        initHome();
        window.showStrategyHome();
        summary();
    });
    window.addEventListener('load', () => setTimeout(summary, 600));
    window.updateSetupBarSummary = summary;
})();
