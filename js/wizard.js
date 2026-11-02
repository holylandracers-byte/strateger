// ==========================================
// 🧭 NEW-RACE WIZARD
// Guided, skippable front door to the full setup screen. It never keeps its own
// copy of the settings: every field reads from and writes to the real setup inputs,
// so the long setup page stays the single source of truth (and the advanced view).
// ==========================================
(function () {
    const SEEN_KEY = 'strateger_wizard_seen';
    const t = (k) => (window.t ? window.t(k) : k);
    const $ = (id) => document.getElementById(id);

    const state = { step: 0, mode: 'race' };

    // Steps depend on the scenario: qualifying adds its own step before the race basics.
    function steps() {
        const list = [{ id: 'type', label: 'xWzType' }];
        if (state.mode === 'qualify') list.push({ id: 'quali', label: 'qualifyTitle' });
        list.push(
            { id: 'basics', label: 'xWzBasics' },
            { id: 'drivers', label: 'xWzDrivers' },
            { id: 'rules', label: 'xWzRules' },
            { id: 'review', label: 'xWzReview' }
        );
        return list;
    }

    // Write a value into a real setup input and fire its own change handler (runs the sim).
    function setReal(id, value) {
        const el = $(id);
        if (!el) return;
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const getReal = (id, fallback = '') => $(id)?.value || fallback;

    function esc(s) {
        const d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    }

    function numField(id, label, { min = 0, step = 1, hint = '' } = {}) {
        return `<div class="wz-field">
            <label class="wz-label" for="wz_${id}">${esc(label)}</label>
            <div class="wz-stepper">
                <button type="button" class="wz-step-btn" data-bump="-${step}" data-for="${id}" data-min="${min}" aria-label="-">&minus;</button>
                <input class="wz-input" id="wz_${id}" type="number" inputmode="decimal" min="${min}" step="${step}" value="${esc(getReal(id))}" data-real="${id}">
                <button type="button" class="wz-step-btn" data-bump="${step}" data-for="${id}" data-min="${min}" aria-label="+">+</button>
            </div>
            ${hint ? `<p class="wz-hint">${esc(hint)}</p>` : ''}
        </div>`;
    }

    function segmented(name, options, current) {
        return `<div class="wz-seg" role="group" data-seg="${name}">${options.map(o =>
            `<button type="button" class="wz-seg-btn${String(o.value) === String(current) ? ' is-on' : ''}" data-value="${o.value}">${esc(o.label)}</button>`
        ).join('')}</div>`;
    }

    const bodies = {
        type() {
            const card = (mode, icon, title, desc) => `
                <button type="button" class="wz-card${state.mode === mode ? ' is-on' : ''}" data-mode="${mode}">
                    <i class="fas ${icon} wz-card-icon"></i>
                    <span class="wz-card-title">${esc(title)}</span>
                    <span class="wz-card-desc">${esc(desc)}</span>
                </button>`;
            return `<h3 class="wz-q">${esc(t('xWzQType'))}</h3>
                <div class="wz-cards">
                    ${card('race', 'fa-flag-checkered', t('xWzRaceOnly'), t('xWzRaceOnlyD'))}
                    ${card('qualify', 'fa-stopwatch', t('xWzQuali'), t('xWzQualiD'))}
                </div>`;
        },
        quali() {
            const seg = (window._qualifyConfig && window._qualifyConfig.segments) || 3;
            const part = (window._qualifyConfig && window._qualifyConfig.participation) || 'all';
            return `<h3 class="wz-q">${esc(t('qualifyTitle'))}</h3>
                ${numField('qualifyDuration', t('qualifyDuration'), { min: 1 })}
                <div class="wz-field">
                    <span class="wz-label">${esc(t('qualifySegments'))}</span>
                    ${segmented('qsegs', [{ value: 1, label: 'Q1' }, { value: 2, label: 'Q1+Q2' }, { value: 3, label: 'Q1+Q2+Q3' }], seg)}
                </div>
                <div class="wz-field">
                    <span class="wz-label">${esc(t('qualifyParticipation'))}</span>
                    ${segmented('qpart', [
                        { value: 'one', label: t('qualifyPartOne') },
                        { value: 'multi', label: t('qualifyPartMulti') },
                        { value: 'all', label: t('qualifyPartAll') }], part)}
                </div>`;
        },
        basics() {
            const dur = parseFloat(getReal('raceDuration', '12'));
            const presets = [1, 3, 6, 12, 24].map(h =>
                `<button type="button" class="wz-chip${dur === h ? ' is-on' : ''}" data-hours="${h}">${h}h</button>`).join('');
            return `<h3 class="wz-q">${esc(t('xWzQBasics'))}</h3>
                <div class="wz-field">
                    <label class="wz-label" for="wz_raceDuration">${esc(t('lblDuration'))}</label>
                    <input class="wz-input wz-big" id="wz_raceDuration" type="number" inputmode="decimal" min="0.5" step="0.5" value="${esc(getReal('raceDuration', '12'))}" data-real="raceDuration">
                    <div class="wz-chips">${presets}</div>
                </div>
                ${numField('reqPitStops', t('lblStops'), { min: 0 })}
                <div class="wz-field">
                    <label class="wz-label" for="wz_raceStartTime">${esc(t('lblStartTime'))}</label>
                    <input class="wz-input" id="wz_raceStartTime" type="time" value="${esc(getReal('raceStartTime'))}" data-real="raceStartTime">
                </div>`;
        },
        drivers() {
            const pool = window.getDriverPool ? window.getDriverPool() : [];
            const on = window._driverGroupParticipants || new Set();
            const chips = pool.map(d => `
                <button type="button" class="wz-driver${on.has(d.name) ? ' is-on' : ''}" data-driver="${esc(d.name)}" style="--dc:${esc(d.color || '#22d3ee')}">
                    <span class="wz-driver-dot"></span>${esc(d.name)}
                </button>`).join('');
            return `<h3 class="wz-q">${esc(t('xWzQDrivers'))}</h3>
                <p class="wz-hint">${esc(t('xWzQDriversD'))}</p>
                <div class="wz-drivers">${chips}</div>
                <div class="wz-add">
                    <input class="wz-input" id="wz_newDriver" type="text" placeholder="${esc(t('xDriverNamePh'))}" autocomplete="off">
                    <button type="button" class="wz-add-btn" id="wz_addDriver" aria-label="+"><i class="fas fa-plus"></i></button>
                </div>`;
        },
        rules() {
            return `<h3 class="wz-q">${esc(t('xWzQRules'))}</h3>
                <p class="wz-hint">${esc(t('xWzQRulesD'))}</p>
                <div class="wz-row">
                    ${numField('minStint', t('lblMinStint'), { min: 0 })}
                    ${numField('maxStint', t('lblMaxStint'), { min: 0 })}
                </div>
                ${numField('minPitTime', t('lblPitTime'), { min: 0 })}
                ${numField('pitNotifyLeadMin', t('xWzMinWarn'), { min: 0, step: 0.5, hint: t('xWzMinWarnD') })}`;
        },
        review() {
            const pool = window.getDriverPool ? window.getDriverPool() : [];
            const on = window._driverGroupParticipants || new Set();
            const names = pool.filter(d => on.has(d.name)).map(d => d.name).join(', ') || '—';
            const rows = [
                ['type', t('xWzType'), state.mode === 'qualify' ? t('xWzQuali') : t('xWzRaceOnly')],
                ['basics', t('xWzDuration'), getReal('raceDuration', '12') + 'h'],
                ['basics', t('xPitStops'), getReal('reqPitStops', '—')],
                ['drivers', t('xWzDrivers'), names],
                ['rules', t('lblMinStint') + ' / ' + t('lblMaxStint'), getReal('minStint') + ' – ' + getReal('maxStint')]
            ];
            return `<h3 class="wz-q">${esc(t('xWzReady'))}</h3>
                <dl class="wz-sum">${rows.map(([id, k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd><button type="button" class="wz-edit" data-goto="${id}">${esc(t('xWzEdit'))}</button></div>`).join('')}</dl>`;
        }
    };

    function render() {
        const root = $('raceWizard');
        if (!root) return;
        const list = steps();
        state.step = Math.min(state.step, list.length - 1);
        const cur = list[state.step];
        const last = state.step === list.length - 1;

        root.querySelector('.wz-progress').innerHTML = list.map((s, i) =>
            `<li class="${i === state.step ? 'is-now' : i < state.step ? 'is-done' : ''}"${i === state.step ? ' aria-current="step"' : ''}>
                <span class="wz-dot">${i < state.step ? '<i class="fas fa-check"></i>' : i + 1}</span>
                <span class="wz-step-name">${esc(t(s.label))}</span></li>`).join('');
        root.querySelector('.wz-count').textContent = t('xWzStepOf').replace('{{a}}', state.step + 1).replace('{{b}}', list.length);
        root.querySelector('.wz-bar-fill').style.width = ((state.step + 1) / list.length * 100) + '%';
        root.querySelector('.wz-body').innerHTML = bodies[cur.id]();
        syncStyleSwitch();
        root.querySelector('.wz-back').style.visibility = state.step === 0 ? 'hidden' : 'visible';
        root.querySelector('.wz-back').textContent = t('xBack');
        root.querySelector('.wz-next').textContent = last ? t('xWzBuild') : t('xWzNext');
        root.querySelector('.wz-title').textContent = t('xWzTitle');
        root.querySelector('.wz-body').scrollTop = 0;
    }

    function onBodyClick(e) {
        const modeBtn = e.target.closest('[data-mode]');
        if (modeBtn) {
            state.mode = modeBtn.dataset.mode;
            if (window.setSessionMode) window.setSessionMode(state.mode);
            return render();
        }
        const bump = e.target.closest('[data-bump]');
        if (bump) {
            const inp = $('wz_' + bump.dataset.for);
            const v = Math.max(parseFloat(bump.dataset.min) || 0, (parseFloat(inp.value) || 0) + parseFloat(bump.dataset.bump));
            inp.value = v;
            return setReal(bump.dataset.for, v);
        }
        const go = e.target.closest('[data-goto]');
        if (go) {
            const idx = steps().findIndex(x => x.id === go.dataset.goto);
            if (idx >= 0) { state.step = idx; render(); }
            return;
        }
        const hours = e.target.closest('[data-hours]');
        if (hours) { setReal('raceDuration', hours.dataset.hours); return render(); }
        const seg = e.target.closest('.wz-seg-btn');
        if (seg) {
            const kind = seg.parentElement.dataset.seg;
            if (kind === 'qsegs' && window.setQSegments) window.setQSegments(parseInt(seg.dataset.value));
            if (kind === 'qpart' && window.setQParticipation) window.setQParticipation(seg.dataset.value);
            seg.parentElement.querySelectorAll('.wz-seg-btn').forEach(b => b.classList.toggle('is-on', b === seg));
            return;
        }
        const drv = e.target.closest('[data-driver]');
        if (drv) {
            if (window.toggleDriverParticipant) window.toggleDriverParticipant(drv.dataset.driver);
            return render();
        }
        if (e.target.closest('#wz_addDriver')) return addDriver();
    }

    function addDriver() {
        const input = $('wz_newDriver');
        const name = input?.value.trim();
        if (!name) return;
        if (window.addDriverToPool) window.addDriverToPool(name);
        if (window.applyDriverGroupToRace) window.applyDriverGroupToRace(false);
        render();
        $('wz_newDriver')?.focus();
    }

    function onBodyChange(e) {
        const real = e.target.dataset?.real;
        if (real) setReal(real, e.target.value);
    }

    function next() {
        if (state.step < steps().length - 1) { state.step++; return render(); }
        finish();
    }

    function finish() {
        close(true);
        if (typeof window.runSim === 'function') window.runSim();
        const target = $('startRaceBtn') || $('setupActionCard');
        if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center' });
    }

    function close(markSeen) {
        syncStyleSwitch();
        const root = $('raceWizard');
        if (root) root.classList.add('hidden');
        document.body.classList.remove('wz-open');
        try { if (markSeen) localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    }

    function build() {
        if ($('raceWizard')) return $('raceWizard');
        const root = document.createElement('div');
        root.id = 'raceWizard';
        root.className = 'wz hidden';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.innerHTML = `
            <div class="wz-sheet">
                <header class="wz-head">
                    <h2 class="wz-title"></h2>
                    <span class="wz-count"></span>
                </header>
                <div class="wz-style-row">${styleSwitchHtml()}</div>
                <div class="wz-bar"><div class="wz-bar-fill"></div></div>
                <ol class="wz-progress"></ol>
                <div class="wz-body"></div>
                <footer class="wz-foot">
                    <button type="button" class="wz-back"></button>
                    <button type="button" class="wz-next"></button>
                </footer>
            </div>`;
        root.querySelector('.wz-body').addEventListener('click', onBodyClick);
        root.querySelector('.wz-body').addEventListener('change', onBodyChange);
        root.querySelector('.wz-body').addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.target.id === 'wz_newDriver') { e.preventDefault(); addDriver(); }
        });
        root.querySelector('.wz-next').onclick = next;
        root.querySelector('.wz-back').onclick = () => { if (state.step > 0) { state.step--; render(); } };
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !root.classList.contains('hidden')) window.setSetupStyle('full');
        });
        document.body.appendChild(root);
        return root;
    }

    // Setup style: Guided (this wizard) vs Full setup (the long page). Remembered per device.
    const STYLE_KEY = 'strateger_setup_style';
    const getStyle = () => { try { return localStorage.getItem(STYLE_KEY) || ''; } catch (e) { return ''; } };

    function styleSwitchHtml() {
        return `<div class="wz-style" role="group" aria-label="${esc(t('xStyleLabel'))}">
            <button type="button" class="wz-style-btn" data-style="guided" onclick="window.setSetupStyle('guided')"><i class="fas fa-route"></i><span data-i18n="xStyleGuided">${esc(t('xStyleGuided'))}</span></button>
            <button type="button" class="wz-style-btn" data-style="full" onclick="window.setSetupStyle('full')"><i class="fas fa-sliders-h"></i><span data-i18n="xStyleFull">${esc(t('xStyleFull'))}</span></button>
        </div>`;
    }

    function syncStyleSwitch() {
        const cur = getStyle() || 'full';
        document.querySelectorAll('[data-style]').forEach(b => {
            const on = b.dataset.style === cur;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    window.setSetupStyle = function (style) {
        try { localStorage.setItem(STYLE_KEY, style); localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
        syncStyleSwitch();
        if (style === 'guided') window.openRaceWizard();
        else close(false);
    };
    window.addEventListener('DOMContentLoaded', () => {
        const slot = document.getElementById('setupStyleSlot');
        if (slot) { slot.innerHTML = styleSwitchHtml(); syncStyleSwitch(); }
    });

    window.openRaceWizard = function () {
        const root = build();
        state.step = 0;
        state.mode = window._sessionMode === 'qualify' ? 'qualify' : 'race';
        root.classList.remove('hidden');
        document.body.classList.add('wz-open');
        render();
    };

    // After the first-run tour: open the wizard if Guided is chosen (or never decided yet), on the setup screen, never mid-race.
    window.addEventListener('load', () => {
        setTimeout(() => {
            try { if (localStorage.getItem('strateger_onboarded') !== 'true') return; } catch (e) { return; }  // first-run language picker + tour go first
            const style = getStyle();
            if (style === 'full') return;                 // chose the full page: respect it
            try { if (!style && localStorage.getItem(SEEN_KEY)) return; } catch (e) { return; }
            const setup = $('setupScreen');
            if (setup && !setup.classList.contains('hidden') && window.role !== 'client' && window.role !== 'viewer') window.openRaceWizard();
        }, 900);
    });
})();
