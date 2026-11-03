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
        const go = qual
            ? '<button type="button" class="home-go is-quali" data-act="quali" data-i="' + i + '">' + esc(t('xStartQualiShort', 'Qualifying')) + '</button>'
              + '<button type="button" class="home-go" data-act="race" data-i="' + i + '">' + esc(t('xStartRaceShort', 'Race')) + '</button>'
            : '<button type="button" class="home-go" data-act="race" data-i="' + i + '">' + esc(t('xStartRaceShort', 'Race')) + '</button>';
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
            setTimeout(() => {
                if (then === 'quali') { show(prev, false); window.startQualifyingDirect(); }
                else window.initRace();
            }, 60);
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
        initAccordion();
        initHome();
        window.showStrategyHome();
        summary();
    });
    window.addEventListener('load', () => setTimeout(summary, 600));
    window.updateSetupBarSummary = summary;
})();
