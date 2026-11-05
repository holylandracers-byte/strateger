// ==========================================
// In-race section tabs (phone + tablet portrait).
// Shows one section at a time under the pinned stint card:
//   live = live timing / connect form, plan = strategy, penalties and the drivers table.
// CSS (css/style.css, "ONE SECTION AT A TIME") does the hiding and animating; this only
// keeps data-mtab, the sliding pill, the pinned card height and the penalty dot in sync.
// ==========================================
(function () {
    'use strict';
    const TABS = ['live', 'plan'];
    let cur = null;
    let userPicked = false;
    let lastCardH = 0;

    const $ = (id) => document.getElementById(id);
    const isRtl = () => getComputedStyle(document.documentElement).direction === 'rtl';

    function movePill() {
        const nav = $('mobileTabs');
        const pill = nav && nav.querySelector('.m-tabs-pill');
        const btn = nav && nav.querySelector('.m-tab.on');
        if (!pill || !btn || !btn.offsetWidth) return;
        pill.style.width = btn.offsetWidth + 'px';
        pill.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
    }

    function select(id, user) {
        const wrap = $('racePanelsWrapper');
        if (!wrap || TABS.indexOf(id) < 0 || id === cur) return;
        const from = TABS.indexOf(cur);
        const to = TABS.indexOf(id);
        // new content slides in from the side the tab sits on (mirrored for RTL)
        const dir = (from < 0 || to > from ? 1 : -1) * (isRtl() ? -1 : 1);
        wrap.style.setProperty('--mt-dx', (dir * 28) + 'px');
        cur = id;
        if (user) userPicked = true;
        wrap.setAttribute('data-mtab', id);
        document.querySelectorAll('#mobileTabs .m-tab').forEach((b) => {
            const on = b.dataset.mtab === id;
            b.classList.toggle('on', on);
            b.setAttribute('aria-selected', String(on));
        });
        movePill();
        if (user) wrap.scrollTo({ top: 0 });
    }
    window.selectRaceTab = (id) => select(id, true);

    // Live tab when a feed is connected, otherwise open on the plan (the connect form is one tap away)
    function autoPick() {
        if (userPicked) return;
        const lt = $('liveTimingWidgetWrapper');
        select(lt && !lt.classList.contains('hidden') ? 'live' : 'plan', false);
    }

    function tick() {
        const dash = $('raceDashboard');
        if (!dash || dash.classList.contains('hidden')) return;
        autoPick();
        // keep the pinned card height available to the sticky tab bar
        const card = document.querySelector('#raceControlDock > div:first-child');
        const wrap = $('racePanelsWrapper');
        if (card && wrap) {
            const h = Math.round(card.getBoundingClientRect().height) + 6;
            if (h > 6 && h !== lastCardH) { lastCardH = h; wrap.style.setProperty('--mt-card-h', h + 'px'); }
        }
        // a queued penalty / warning lives in the Plan section: flag it while another tab is open
        const pq = $('penaltyQueuePanel');
        const dot = $('mtabPlanDot');
        if (dot) dot.classList.toggle('hidden', !(pq && !pq.classList.contains('hidden') && cur !== 'plan'));
        movePill();
    }

    function init() {
        const nav = $('mobileTabs');
        if (!nav) return;
        nav.addEventListener('click', (e) => {
            const b = e.target.closest('.m-tab');
            if (b) select(b.dataset.mtab, true);
        });
        window.addEventListener('resize', movePill);
        window.addEventListener('orientationchange', () => setTimeout(movePill, 250));
        if (window.ResizeObserver) {
            const card = document.querySelector('#raceControlDock > div:first-child');
            if (card) new ResizeObserver(tick).observe(card);
        }
        // a new race starts from the automatic choice again
        const dash = $('raceDashboard');
        if (dash) new MutationObserver(() => { if (dash.classList.contains('hidden')) { userPicked = false; cur = null; } })
            .observe(dash, { attributes: true, attributeFilter: ['class'] });
        setInterval(tick, 700);
        tick();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
