// ==========================================
// 🎓 IN-APP WALKTHROUGH
// Language picker → spotlight tour → accelerated demo race
// ==========================================

(function () {
    'use strict';

    const LANG_KEY = 'strateger_lang_explicit';
    const DONE_KEY = 'strateger_onboarded';
    const TIME_MULT = 90; // race clock runs ~90× faster during guided sim

    let _stepIndex = 0;
    let _steps = [];
    let _timeBoostInterval = null;
    let _resizeObserver = null;
    let _highlightResizeObserver = null;
    let _highlightMutationObserver = null;
    let _repositionTimer = null;

    const PRIMARY_LANGS = ['en', 'he', 'fr', 'pt'];

    // ── Setup steps (before race) ──
    const SETUP_STEPS = [
        {
            id: 'welcome',
            titleKey: 'wtTitleWelcome',
            descKey: 'wtDescWelcome',
            center: true
        },
        {
            id: 'hero',
            target: '#setupHeroCard',
            titleKey: 'wtTitleHero',
            descKey: 'wtDescHero',
            before: () => {
                ensureHeroExpanded();
                scrollToEl('#setupHeroCard');
            }
        },
        {
            id: 'rules',
            target: '#raceDuration',
            wrap: 'collapsible',
            titleKey: 'wtTitleRules',
            descKey: 'wtDescRules',
            before: () => {
                expandCollapsible('#raceDuration');
                scrollToEl('#raceDuration');
                if (typeof window.runSim === 'function') window.runSim();
            }
        },
        {
            id: 'liveTiming',
            target: '#liveTimingUrl',
            wrap: 'collapsible',
            titleKey: 'wtTitleLT',
            descKey: 'wtDescLT',
            before: () => {
                expandCollapsible('#liveTimingUrl');
                scrollToEl('#liveTimingUrl');
            }
        },
        {
            id: 'drivers',
            target: '#driversList',
            wrap: 'collapsible',
            titleKey: 'wtTitleDrivers',
            descKey: 'wtDescDrivers',
            before: () => {
                expandCollapsible('#driversList');
                scrollToEl('#driversList');
            }
        },
        {
            id: 'preview',
            target: '#setupActionCard',
            titleKey: 'wtTitlePreview',
            descKey: 'wtDescPreview',
            before: () => scrollToEl('#setupActionCard')
        },
        {
            id: 'simulation',
            titleKey: 'wtTitleSim',
            descKey: 'wtDescSim',
            center: true,
            actionLabelKey: 'wtStartSim',
            action: () => launchGuidedSimulation()
        }
    ];

    // ── Race dashboard steps (after sim starts) ──
    const RACE_STEPS = [
        {
            id: 'raceTimer',
            target: '#raceTimerDisplay',
            titleKey: 'wtTitleRaceTimer',
            descKey: 'wtDescRaceTimer',
            before: () => scrollToEl('#raceTimerDisplay')
        },
        {
            id: 'strategy',
            target: '#remainingStintsPanel',
            wrap: 'parent-panel',
            titleKey: 'wtTitleStrategy',
            descKey: 'wtDescStrategy',
            before: () => {
                const panel = document.getElementById('remainingStintsPanel');
                if (panel) panel.classList.remove('hidden');
                scrollToEl('#remainingStintsPanel');
            }
        },
        {
            id: 'liveTimingRace',
            target: '#liveTimingWidgetWrapper',
            wrap: 'self',
            titleKey: 'wtTitleLTRace',
            descKey: 'wtDescLTRace',
            before: () => {
                const wrapper = document.getElementById('liveTimingWidgetWrapper');
                if (wrapper) wrapper.classList.remove('hidden');
                scrollToEl('#liveTimingWidgetWrapper');
            }
        },
        {
            id: 'pit',
            target: '#pitEntryBtn',
            titleKey: 'wtTitlePit',
            descKey: 'wtDescPit',
            before: () => scrollToEl('#pitEntryBtn')
        },
        {
            id: 'done',
            titleKey: 'wtTitleDone',
            descKey: 'wtDescDone',
            center: true,
            done: true
        }
    ];

    // ── Helpers ──

    function t(key) {
        return (window.t && window.t(key)) || key;
    }

    function ensureHeroExpanded() {
        if (window._heroCollapsed && typeof window.toggleHero === 'function') {
            window.toggleHero();
        } else {
            const body = document.getElementById('heroBody');
            if (body) body.classList.remove('hidden');
        }
    }

    function expandCollapsible(fromSelector) {
        const el = document.querySelector(fromSelector);
        if (!el) return;
        const section = el.closest('.collapsible-section');
        if (section) section.classList.remove('collapsed');
    }

    /** Resolve the outer container to highlight (full section, not inner input). */
    function resolveHighlightEl(step) {
        const inner = step.target ? document.querySelector(step.target) : null;
        if (!inner) return null;

        if (step.target === '#setupHeroCard') return inner;

        switch (step.wrap) {
            case 'collapsible': {
                const section = inner.closest('.collapsible-section');
                return section || inner;
            }
            case 'action-card': {
                return inner.closest('.rounded-xl.border') || inner.closest('[class*="rounded-xl"]') || inner.parentElement?.parentElement || inner;
            }
            case 'parent-panel': {
                return inner.closest('#raceInfoPanel') || inner.parentElement || inner;
            }
            default:
                return inner;
        }
    }

    function isElementVisible(el) {
        if (!el || el.classList.contains('hidden')) return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function getElementRect(el) {
        const rect = el.getBoundingClientRect();
        // Include visible descendants when wrapper rect is suspiciously small
        if (rect.height < 40 && el.querySelector) {
            const kids = el.querySelectorAll(':scope > *');
            let top = rect.top, left = rect.left, bottom = rect.bottom, right = rect.right;
            kids.forEach(k => {
                if (k.classList?.contains('hidden')) return;
                const kr = k.getBoundingClientRect();
                if (kr.width <= 0 || kr.height <= 0) return;
                top = Math.min(top, kr.top);
                left = Math.min(left, kr.left);
                bottom = Math.max(bottom, kr.bottom);
                right = Math.max(right, kr.right);
            });
            if (bottom > top && right > left) {
                return { top, left, width: right - left, height: bottom - top, bottom, right };
            }
        }
        return rect;
    }

    function scrollToEl(selector) {
        const el = document.querySelector(selector);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }

    function shouldShowWalkthrough() {
        if (window.role !== 'host') return false;
        if (localStorage.getItem(DONE_KEY) === 'true') return false;
        const savedRaceModal = document.getElementById('savedRaceModal');
        if (savedRaceModal && !savedRaceModal.classList.contains('hidden')) return false;
        return true;
    }

    function shouldShowLanguagePicker() {
        return !localStorage.getItem(LANG_KEY);
    }

    // ── Language picker ──

    function buildLanguagePicker() {
        const grid = document.getElementById('langPickerGrid');
        if (!grid) return;
        grid.innerHTML = '';
        const langs = window.SUPPORTED_LANGUAGES || [];
        const browserLang = (navigator.language || 'en').split('-')[0];
        const suggested = langs.find(l => l.code === browserLang)?.code || 'en';

        langs.forEach(lang => {
            const btn = document.createElement('button');
            const isPrimary = PRIMARY_LANGS.includes(lang.code);
            btn.type = 'button';
            btn.className = [
                'lang-pick-btn flex items-center gap-2 px-3 py-2.5 rounded-xl border transition text-left',
                isPrimary ? 'border-ice/40 bg-navy-800 hover:bg-navy-700 hover:border-ice/60' : 'border-gray-700/50 bg-navy-950/50 hover:bg-navy-800 opacity-80',
                lang.code === suggested ? 'ring-2 ring-ice/50' : ''
            ].join(' ');
            btn.dataset.lang = lang.code;
            btn.innerHTML = `<span class="text-lg">${lang.flag}</span><span class="text-sm font-bold text-white">${lang.name}</span>`;
            btn.onclick = () => confirmLanguage(lang.code);
            grid.appendChild(btn);
        });
    }

    window.showLanguagePicker = function () {
        buildLanguagePicker();
        const overlay = document.getElementById('languageOverlay');
        if (overlay) overlay.classList.remove('hidden');
    };

    window.confirmLanguage = function (lang) {
        localStorage.setItem(LANG_KEY, 'true');
        if (typeof window.setLanguage === 'function') window.setLanguage(lang);
        const overlay = document.getElementById('languageOverlay');
        if (overlay) overlay.classList.add('hidden');
        if (shouldShowWalkthrough()) {
            setTimeout(() => window.startWalkthrough(), 400);
        }
    };

    // ── Time boost for guided simulation ──

    window.startWalkthroughTimeBoost = function (multiplier) {
        window.stopWalkthroughTimeBoost();
        window._walkthroughTimeMultiplier = multiplier || TIME_MULT;
        _timeBoostInterval = setInterval(() => {
            const mult = window._walkthroughTimeMultiplier || 1;
            if (mult <= 1) return;
            window._walkthroughTimeOffset = (window._walkthroughTimeOffset || 0) + 100 * (mult - 1);
            if (typeof window.renderFrame === 'function') window.renderFrame();
        }, 100);
    };

    window.stopWalkthroughTimeBoost = function () {
        if (_timeBoostInterval) {
            clearInterval(_timeBoostInterval);
            _timeBoostInterval = null;
        }
        window._walkthroughTimeMultiplier = 1;
    };

    // ── Guided demo race (sprint, simulated live timing) ──

    function launchGuidedSimulation() {
        hideWalkthroughUI();
        window._walkthroughMode = true;

        window.demoConfig = {
            raceLength: 'sprint',
            gridSize: 20,
            chaosLevel: 'normal',
            rain: false,
            penalties: false,
            tires: false,
            squads: false,
            fuel: false,
            safetyCar: false,
            incidents: false
        };

        if (typeof window.startDemoRace === 'function') window.startDemoRace();
        window.startWalkthroughTimeBoost(TIME_MULT);

        _steps = RACE_STEPS.slice();
        _stepIndex = 0;

        const waitForRace = () => {
            const dash = document.getElementById('raceDashboard');
            if (dash && !dash.classList.contains('hidden')) {
                setTimeout(() => showStep(0), 600);
                return;
            }
            requestAnimationFrame(waitForRace);
        };
        waitForRace();
    }

    // ── Spotlight positioning ──

    function disconnectHighlightObservers() {
        if (_highlightResizeObserver) {
            _highlightResizeObserver.disconnect();
            _highlightResizeObserver = null;
        }
        if (_highlightMutationObserver) {
            _highlightMutationObserver.disconnect();
            _highlightMutationObserver = null;
        }
        if (_repositionTimer) {
            clearTimeout(_repositionTimer);
            _repositionTimer = null;
        }
    }

    function observeHighlightEl(el, step) {
        disconnectHighlightObservers();
        if (!el || !window.ResizeObserver) return;

        _highlightResizeObserver = new ResizeObserver(() => {
            positionSpotlightForStep(step);
        });
        _highlightResizeObserver.observe(el);

        // Also watch collapse-body transitions inside the wrapper
        el.querySelectorAll('.collapse-body, #heroBody').forEach(body => {
            _highlightResizeObserver.observe(body);
        });

        _highlightMutationObserver = new MutationObserver(() => {
            scheduleSpotlightRefresh(step, [50, 320]);
        });
        _highlightMutationObserver.observe(el, {
            attributes: true,
            attributeFilter: ['class', 'style'],
            subtree: true
        });
    }

    function scheduleSpotlightRefresh(step, delays) {
        delays.forEach(ms => {
            setTimeout(() => positionSpotlightForStep(step), ms);
        });
    }

    function positionSpotlightForStep(step) {
        if (!step || step.center || !step.target) return;
        const el = resolveHighlightEl(step);
        if (!el || !isElementVisible(el)) return;
        applySpotlightRect(getElementRect(el));
    }

    function applySpotlightRect(rect) {
        const spotlight = document.getElementById('wtSpotlight');
        const ring = document.getElementById('wtSpotlightRing');
        if (!ring) return;

        const pad = 10;
        const top = Math.max(0, rect.top - pad);
        const left = Math.max(0, rect.left - pad);
        const width = rect.width + pad * 2;
        const height = rect.height + pad * 2;

        ring.style.top = top + 'px';
        ring.style.left = left + 'px';
        ring.style.width = width + 'px';
        ring.style.height = height + 'px';
        if (spotlight) spotlight.classList.add('hidden');
        ring.classList.remove('hidden');

        positionTooltip(rect, width, height);
    }

    function positionSpotlight(step) {
        const spotlight = document.getElementById('wtSpotlight');
        const ring = document.getElementById('wtSpotlightRing');
        if (!spotlight || !ring) return;

        if (!step || !step.target) {
            spotlight.classList.add('hidden');
            ring.classList.add('hidden');
            disconnectHighlightObservers();
            return;
        }

        const el = resolveHighlightEl(step);
        if (!el || !isElementVisible(el)) {
            spotlight.classList.add('hidden');
            ring.classList.add('hidden');
            return;
        }

        applySpotlightRect(getElementRect(el));
        observeHighlightEl(el, step);
    }

    function positionTooltip(targetRect, tw, th) {
        const tooltip = document.getElementById('wtTooltip');
        if (!tooltip) return;

        tooltip.classList.remove('hidden', 'wt-tooltip-center');
        const tipRect = tooltip.getBoundingClientRect();
        const margin = 12;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const isRtl = document.documentElement.dir === 'rtl';

        let top = targetRect.bottom + margin;
        let left = targetRect.left + (tw / 2) - (tipRect.width / 2);

        if (top + tipRect.height > vh - margin) {
            top = targetRect.top - tipRect.height - margin;
        }
        if (top < margin) top = margin;
        if (left < margin) left = margin;
        if (left + tipRect.width > vw - margin) left = vw - tipRect.width - margin;

        tooltip.style.top = top + 'px';
        tooltip.style.left = (isRtl ? 'auto' : left + 'px');
        tooltip.style.right = isRtl ? (vw - left - tipRect.width) + 'px' : 'auto';
    }

    function positionCenterTooltip() {
        const spotlight = document.getElementById('wtSpotlight');
        const ring = document.getElementById('wtSpotlightRing');
        const tooltip = document.getElementById('wtTooltip');
        if (ring) ring.classList.add('hidden');
        if (spotlight) spotlight.classList.remove('hidden');
        if (!tooltip) return;
        tooltip.classList.add('wt-tooltip-center');
        tooltip.style.top = '50%';
        tooltip.style.left = '50%';
        tooltip.style.right = 'auto';
        tooltip.style.transform = 'translate(-50%, -50%)';
        tooltip.classList.remove('hidden');
    }

    // ── Step rendering ──

    function showStep(index) {
        const overlay = document.getElementById('walkthroughOverlay');
        if (!overlay) return;

        overlay.classList.remove('hidden');
        document.body.classList.add('wt-active');

        const step = _steps[index];
        if (!step) {
            finishWalkthrough();
            return;
        }

        _stepIndex = index;

        const titleEl = document.getElementById('wtTitle');
        const descEl = document.getElementById('wtDesc');
        const progressEl = document.getElementById('wtProgress');
        const nextBtn = document.getElementById('wtNextBtn');
        const actionBtn = document.getElementById('wtActionBtn');
        const skipBtn = document.getElementById('wtSkipBtn');

        if (titleEl) titleEl.textContent = t(step.titleKey);
        if (descEl) descEl.textContent = t(step.descKey);
        if (progressEl) progressEl.textContent = `${index + 1} / ${_steps.length}`;

        if (step.before) {
            try { step.before(); } catch (e) { console.warn('walkthrough before hook', e); }
        }

        const tooltip = document.getElementById('wtTooltip');
        if (tooltip) tooltip.style.transform = '';

        if (step.center || !step.target) {
            disconnectHighlightObservers();
            positionCenterTooltip();
        } else {
            scheduleSpotlightRefresh(step, [80, 350, 450]);
            const el = resolveHighlightEl(step);
            if (el) observeHighlightEl(el, step);
        }

        if (actionBtn) {
            if (step.action) {
                actionBtn.classList.remove('hidden');
                actionBtn.textContent = t(step.actionLabelKey || 'wtStartSim');
                actionBtn.onclick = () => {
                    hideWalkthroughUI();
                    step.action();
                };
            } else {
                actionBtn.classList.add('hidden');
            }
        }

        if (nextBtn) {
            nextBtn.textContent = step.done ? t('onboardDone') : t('onboardNext');
            nextBtn.onclick = () => {
                if (step.done) finishWalkthrough();
                else nextWalkthroughStep();
            };
        }

        if (skipBtn) skipBtn.textContent = t('onboardSkip');
    }

    function hideWalkthroughUI() {
        const overlay = document.getElementById('walkthroughOverlay');
        if (overlay) overlay.classList.add('hidden');
        document.body.classList.remove('wt-active');
    }

    function bindResize() {
        if (_resizeObserver) return;
        const onReposition = () => {
            const step = _steps[_stepIndex];
            if (!step || step.center || !step.target) return;
            positionSpotlightForStep(step);
        };
        window.addEventListener('resize', onReposition);
        window.addEventListener('scroll', onReposition, true);
        // Reposition when user toggles hero or collapsible sections during tour
        document.addEventListener('click', (e) => {
            if (!document.getElementById('walkthroughOverlay')?.classList.contains('hidden')) {
                if (e.target.closest('.collapsible-section h2, .setup-hero, [onclick*="toggleHero"]')) {
                    scheduleSpotlightRefresh(_steps[_stepIndex], [50, 320]);
                }
            }
        }, true);
        _resizeObserver = { disconnect: () => {
            window.removeEventListener('resize', onReposition);
            window.removeEventListener('scroll', onReposition, true);
        }};
    }

    // ── Public API ──

    window.startWalkthrough = function (fromRace) {
        if (!fromRace && !shouldShowWalkthrough()) return;

        window.stopWalkthroughTimeBoost();
        window._walkthroughTimeOffset = 0;
        window._walkthroughMode = false;

        _steps = fromRace ? RACE_STEPS.slice() : SETUP_STEPS.slice();
        _stepIndex = 0;
        bindResize();
        showStep(0);
    };

    window.nextWalkthroughStep = function () {
        showStep(_stepIndex + 1);
    };

    window.skipWalkthrough = function () {
        finishWalkthrough();
    };

    window.restartWalkthrough = function () {
        localStorage.removeItem(DONE_KEY);
        window.stopWalkthroughTimeBoost();
        window._walkthroughTimeOffset = 0;

        const dash = document.getElementById('raceDashboard');
        const setup = document.getElementById('setupScreen');
        if (dash && !dash.classList.contains('hidden')) {
            if (typeof window.stopAllClocks === 'function') window.stopAllClocks();
            if (window.state) {
                window.state.isRunning = false;
                window.state.isFinished = false;
            }
            dash.classList.add('hidden');
            if (setup) setup.classList.remove('hidden');
            const badge = document.getElementById('demoBadge');
            if (badge) badge.classList.add('hidden');
        }

        setTimeout(() => window.startWalkthrough(false), 300);
    };

    window._refreshWalkthroughStep = function () {
        if (document.getElementById('walkthroughOverlay')?.classList.contains('hidden')) return;
        const step = _steps[_stepIndex];
        if (!step) return;
        scheduleSpotlightRefresh(step, [0, 80, 320]);
    };

    function finishWalkthrough() {
        hideWalkthroughUI();
        disconnectHighlightObservers();
        window.stopWalkthroughTimeBoost();
        window._walkthroughMode = false;
        localStorage.setItem(DONE_KEY, 'true');
        if (_resizeObserver) {
            _resizeObserver.disconnect();
            _resizeObserver = null;
        }
        if (typeof window.showToast === 'function') {
            window.showToast(t('wtFinishedToast'), 'success', 3500);
        }
    }

    // Entry point called from main.js after init
    window.initWalkthroughFlow = function () {
        if (window.role !== 'host') return;

        if (shouldShowLanguagePicker()) {
            setTimeout(() => window.showLanguagePicker(), 500);
            return;
        }

        if (shouldShowWalkthrough()) {
            setTimeout(() => window.startWalkthrough(), 800);
        }
    };

    // Legacy aliases
    window.startOnboarding = function () {
        if (shouldShowLanguagePicker()) {
            window.showLanguagePicker();
        } else if (shouldShowWalkthrough()) {
            window.startWalkthrough();
        }
    };
    window.skipOnboarding = window.skipWalkthrough;

})();
