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
            before: () => scrollToEl('#setupHeroCard')
        },
        {
            id: 'rules',
            target: '#raceDuration',
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
            titleKey: 'wtTitleDrivers',
            descKey: 'wtDescDrivers',
            before: () => {
                expandCollapsible('#driversList');
                scrollToEl('#driversList');
            }
        },
        {
            id: 'preview',
            target: '#wtPreviewBtn',
            titleKey: 'wtTitlePreview',
            descKey: 'wtDescPreview',
            before: () => scrollToEl('#wtPreviewBtn')
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
            titleKey: 'wtTitleLTRace',
            descKey: 'wtDescLTRace',
            before: () => scrollToEl('#liveTimingWidgetWrapper')
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

    function expandCollapsible(fromSelector) {
        const el = document.querySelector(fromSelector);
        if (!el) return;
        const section = el.closest('.collapsible-section');
        if (section) section.classList.remove('collapsed');
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

    function positionSpotlight(targetSelector) {
        const spotlight = document.getElementById('wtSpotlight');
        const ring = document.getElementById('wtSpotlightRing');
        if (!spotlight || !ring) return;

        if (!targetSelector) {
            spotlight.classList.add('hidden');
            ring.classList.add('hidden');
            return;
        }

        const el = document.querySelector(targetSelector);
        if (!el || el.offsetParent === null && !el.getBoundingClientRect().width) {
            spotlight.classList.add('hidden');
            ring.classList.add('hidden');
            return;
        }

        const rect = el.getBoundingClientRect();
        const pad = 8;
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
            positionCenterTooltip();
        } else {
            setTimeout(() => positionSpotlight(step.target), 350);
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
            positionSpotlight(step.target);
        };
        window.addEventListener('resize', onReposition);
        window.addEventListener('scroll', onReposition, true);
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
        showStep(_stepIndex);
    };

    function finishWalkthrough() {
        hideWalkthroughUI();
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
