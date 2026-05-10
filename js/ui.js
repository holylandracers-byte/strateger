// ==========================================
// 🎨 UI MANAGER (Updated Visuals)
// ==========================================

// ==========================================
// 👥 DRIVER GROUP SYSTEM (per DeviceID)
// ==========================================

const _DRIVER_POOL_KEY = 'strateger_driver_pool';

window.getDriverPool = function() {
    const deviceId = window.getDeviceId();
    try {
        const all = JSON.parse(localStorage.getItem(_DRIVER_POOL_KEY) || '{}');
        return all[deviceId] || [];
    } catch(e) { return []; }
};

window.saveDriverPool = function(pool) {
    const deviceId = window.getDeviceId();
    try {
        const all = JSON.parse(localStorage.getItem(_DRIVER_POOL_KEY) || '{}');
        all[deviceId] = pool;
        localStorage.setItem(_DRIVER_POOL_KEY, JSON.stringify(all));
    } catch(e) {}
};

// ── minimum-2 guarantee ──────────────────────────────────────────────────────
// The race always has at least 2 active driver slots.
// Slot 0 = Driver 1 placeholder, Slot 1 = Driver 2 placeholder.
// As real drivers are added to the pool they replace placeholders in order.
// A slot is only removed when the pool contains ≥ 3 real (non-placeholder) drivers.

window._PLACEHOLDER_NAMES = function() {
    const t = window.t || (k => k);
    return [`${t('ltDriver')} 1`, `${t('ltDriver')} 2`];
};

// Return the effective active driver list: pool drivers + placeholder fill to min 2
window._effectiveDriverSlots = function() {
    const pool = window.getDriverPool();
    const selected = pool.filter(d => window._driverGroupParticipants.has(d.name));
    const ph = window._PLACEHOLDER_NAMES();
    const slots = [...selected];
    // Pad with placeholders until we have at least 2 slots
    let phIdx = 0;
    while (slots.length < 2) {
        slots.push({ name: ph[phIdx], color: '#4b5563', _placeholder: true });
        phIdx++;
    }
    return slots;
};

window.addDriverToPool = function(name) {
    if (!name || !name.trim()) return;
    const pool = window.getDriverPool();
    const trimmed = name.trim();
    if (!pool.find(d => d.name.toLowerCase() === trimmed.toLowerCase())) {
        pool.push({ name: trimmed, color: window._nextDriverColor() });
        window.saveDriverPool(pool);
    }
    // Auto-select newly added driver
    window._driverGroupParticipants.add(trimmed);
    window.renderDriverGroupUI();
};

window.removeDriverFromPool = function(name) {
    const newPool = window.getDriverPool().filter(d => d.name !== name);
    window.saveDriverPool(newPool);
    window._driverGroupParticipants.delete(name);
    window.renderDriverGroupUI();
    window.applyDriverGroupToRace(true);
};

window._nextDriverColor = function() {
    const PALETTE = ['#22d3ee','#a3e635','#f97316','#ef4444','#8b5cf6','#ec4899','#facc15','#34d399',
                     '#f472b6','#38bdf8','#4ade80','#fb923c','#a78bfa','#fbbf24','#34d399','#e879f9'];
    const pool = window.getDriverPool();
    const used = new Set(pool.map(d => d.color));
    const unused = PALETTE.filter(c => !used.has(c));
    const pick = unused.length > 0 ? unused : PALETTE;
    return pick[Math.floor(Math.random() * pick.length)];
};

window._driverGroupParticipants = new Set();

window.toggleDriverParticipant = function(name) {
    if (window._driverGroupParticipants.has(name)) {
        // Block deselect if it would leave fewer than 2 active slots
        const currentSelected = window.getDriverPool().filter(d => window._driverGroupParticipants.has(d.name));
        if (currentSelected.length <= 2) return; // already at minimum — do nothing
        window._driverGroupParticipants.delete(name);
    } else {
        window._driverGroupParticipants.add(name);
    }
    window.renderDriverGroupUI();
    window.applyDriverGroupToRace();
};

window.applyDriverGroupToRace = function(triggerSim = true) {
    const list = document.getElementById('driversList');
    if (!list) return;

    const slots = window._effectiveDriverSlots();
    const numSquads = parseInt(document.getElementById('numSquads')?.value) || 0;

    list.innerHTML = '';
    slots.forEach((d, i) => {
        const squadIdx = numSquads > 0 ? i % numSquads : 0;
        window.createDriverInput(d.name, i === 0, squadIdx);
        const rows = list.querySelectorAll('.driver-row');
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
            const colorPicker = lastRow.querySelector('.driver-color-picker');
            if (colorPicker && d.color) {
                colorPicker.value = d.color;
                const swatch = lastRow.querySelector('.driver-color-swatch');
                const accent = lastRow.querySelector('.driver-accent-bar');
                if (swatch) swatch.style.background = d.color;
                if (accent) accent.style.background = d.color;
            }
            if (d._placeholder) {
                lastRow.classList.add('opacity-50');
                const inp = lastRow.querySelector('.driver-input');
                if (inp) inp.dataset.placeholder = 'true';
            }
        }
    });

    if (triggerSim && typeof window.runSim === 'function') window.runSim();
};

window.renderDriverGroupUI = function() {
    const container = document.getElementById('driverGroupContainer');
    if (!container) return;
    const pool = window.getDriverPool();
    const t = window.t || (k => k);

    container.innerHTML = '';

    // Pool tags
    const tagsDiv = document.createElement('div');
    tagsDiv.className = 'flex flex-wrap gap-1.5 mb-2';

    const selectedCount = pool.filter(d => window._driverGroupParticipants.has(d.name)).length;

    pool.forEach(d => {
        const active = window._driverGroupParticipants.has(d.name);
        // A selected driver is locked (cannot deselect) when doing so would drop below 2
        const locked = active && selectedCount <= 2;

        const tag = document.createElement('button');
        tag.type = 'button';
        tag.className = `driver-group-tag flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold border transition select-none ${
            active
                ? 'text-navy-950 border-transparent shadow-md'
                : 'bg-navy-950 text-gray-400 border-gray-600 hover:border-gray-400'
        }${locked ? ' cursor-default' : ''}`;
        if (active) {
            tag.style.background = d.color;
            tag.style.borderColor = d.color;
        }
        tag.title = locked
            ? (t('minTwoDrivers') || 'Minimum 2 drivers required')
            : active ? t('clickToRemoveFromRace') : t('clickToAddToRace');
        tag.onclick = () => locked ? null : window.toggleDriverParticipant(d.name);

        const nameSpan = document.createElement('span');
        nameSpan.textContent = d.name;

        const removeBtn = document.createElement('span');
        removeBtn.innerHTML = '&times;';
        removeBtn.className = 'ml-0.5 opacity-60 hover:opacity-100 cursor-pointer text-[10px]';
        removeBtn.title = t('removeFromGroup');
        removeBtn.onclick = (e) => { e.stopPropagation(); window.removeDriverFromPool(d.name); };

        tag.appendChild(nameSpan);
        tag.appendChild(removeBtn);
        tagsDiv.appendChild(tag);
    });

    container.appendChild(tagsDiv);

    // Add driver input
    const addRow = document.createElement('div');
    addRow.className = 'flex gap-1.5';

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'driverGroupInput';
    input.placeholder = t('addDriverToGroup') || 'Add driver…';
    input.className = 'driver-input flex-1 bg-navy-950 border border-gray-600 focus:border-ice text-white text-xs rounded px-2 py-1.5 outline-none';
    input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); window._commitDriverGroupInput(); }
    };

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+';
    addBtn.className = 'bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded text-sm transition';
    addBtn.onclick = () => window._commitDriverGroupInput();

    addRow.appendChild(input);
    addRow.appendChild(addBtn);
    container.appendChild(addRow);

    if (pool.length > 0) {
        const hint = document.createElement('p');
        hint.className = 'text-[10px] text-gray-500 mt-1.5';
        hint.textContent = t('driverGroupHint') || 'Tap a driver to include/exclude from this race';
        container.appendChild(hint);
    }
};

window._commitDriverGroupInput = function() {
    const input = document.getElementById('driverGroupInput');
    if (!input || !input.value.trim()) return;
    const name = input.value.trim();
    window.addDriverToPool(name);
    window._driverGroupParticipants.add(name);
    input.value = '';
    window.applyDriverGroupToRace(true);
};

window.initDriverGroupUI = function() {
    const pool = window.getDriverPool();
    // Pre-select all pool members if no selection yet
    if (window._driverGroupParticipants.size === 0 && pool.length > 0) {
        pool.forEach(d => window._driverGroupParticipants.add(d.name));
    }
    window.renderDriverGroupUI();
    // Always apply — even empty pool produces 2 placeholder slots
    window.applyDriverGroupToRace(false);
};

window.toggleConfigPanel = function(event) {
    if (event && event.target.closest('.starter-indicator, .starter-radio, .driver-input')) return;
    const panel = document.getElementById('configPanel');
    const arrow = document.getElementById('configArrow');
    if (panel) {
        panel.classList.toggle('hidden');
        if (arrow) arrow.innerText = panel.classList.contains('hidden') ? '▼' : '▲';
    }
};

// Smart "Add Driver" button: routes through the pool when one exists,
// falls back to bare addDriverField when the pool is empty (first-time use).
window._addDriverSmartBtn = function() {
    const pool = window.getDriverPool();
    if (pool.length > 0) {
        // Pool exists — focus the pool name input so user adds via the group system
        const input = document.getElementById('driverGroupInput');
        if (input) { input.focus(); input.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    } else {
        // No pool yet — create a bare driver row as before
        window.addDriverField();
        window.runSim();
    }
};

window.ensureMinimumDrivers = function(n) {
    const list = document.getElementById('driversList');
    if (!list) return;
    while (list.children.length < n) window.addDriverField();
};

window.addDriverField = function() {
    const list = document.getElementById('driversList');
    if (!list) return;
    const count = list.children.length + 1;
    const numSquads = parseInt(document.getElementById('numSquads')?.value) || 0;
    const squadIdx = numSquads > 0 ? (count - 1) % numSquads : 0;
    window.createDriverInput(`${window.t('ltDriver')} ${count}`, count === 1, squadIdx);
    window.toggleSquadsInput();
};

window.removeDriverField = function() {
    const list = document.getElementById('driversList');
    if (list && list.children.length > 2) list.removeChild(list.lastChild);
};

window.createDriverInput = function(val, checked, squad) {
    const div = document.createElement('div');
    div.className = "driver-row cursor-default";
    div.onclick = (e) => e.stopPropagation();

    const radioId = 'starter_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

    // ── Color swatch (left edge accent bar + clickable swatch) ──
    const DRIVER_PALETTE = ['#22d3ee','#a3e635','#f97316','#ef4444','#8b5cf6','#ec4899','#facc15','#34d399',
                            '#f472b6','#38bdf8','#4ade80','#fb923c','#a78bfa','#fbbf24','#e879f9'];
    const usedColors = new Set([...document.querySelectorAll('#driversList .driver-color-picker')].map(el => el.value));
    const unusedPalette = DRIVER_PALETTE.filter(c => !usedColors.has(c));
    const pickFrom = unusedPalette.length > 0 ? unusedPalette : DRIVER_PALETTE;
    const chosenColor = pickFrom[Math.floor(Math.random() * pickFrom.length)];

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'driver-color-picker';
    colorPicker.value = chosenColor;
    colorPicker.title = 'Driver color';
    colorPicker.addEventListener('click', (e) => e.stopPropagation());
    colorPicker.onchange = () => {
        accentBar.style.background = colorPicker.value;
        colorSwatch.style.background = colorPicker.value;
        window.runSim();
    };

    // Left accent bar
    const accentBar = document.createElement('div');
    accentBar.className = 'driver-accent-bar';
    accentBar.style.background = chosenColor;

    // Color swatch circle (wraps hidden <input type=color>)
    const colorSwatch = document.createElement('div');
    colorSwatch.className = 'driver-color-swatch';
    colorSwatch.style.background = chosenColor;
    colorSwatch.title = 'Change color';
    colorSwatch.addEventListener('click', (e) => { e.stopPropagation(); colorPicker.click(); });
    colorSwatch.appendChild(colorPicker);

    // ── Starter toggle ──
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'starter';
    radio.id = radioId;
    radio.className = 'starter-radio sr-only';
    radio.checked = checked;

    const starterBtn = document.createElement('button');
    starterBtn.type = 'button';
    starterBtn.className = 'driver-starter-btn' + (checked ? ' is-starter' : '');
    starterBtn.title = 'Set as race starter';
    starterBtn.innerHTML = '<svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M2 2h12v2L8 9l6 5H2V2z"/></svg>';
    starterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.starter-radio').forEach(r => r.checked = false);
        radio.checked = true;
        window.updateStarterVisuals();
        window.runSim();
    });

    const indicator = document.createElement('div');
    indicator.className = 'starter-indicator hidden';

    // ── Name input ──
    const nameWrap = document.createElement('div');
    nameWrap.className = 'driver-name-wrap';

    const driverInput = document.createElement('input');
    driverInput.type = 'text';
    driverInput.value = val;
    driverInput.className = 'driver-input';
    driverInput.placeholder = 'Driver name';
    driverInput.addEventListener('click', (e) => e.stopPropagation());
    driverInput.oninput = () => {
        if (typeof window.scheduleRunSim === 'function') window.scheduleRunSim(400);
        else if (typeof window.runSim === 'function') window.runSim();
    };
    driverInput.onchange = () => { if (typeof window.runSim === 'function') window.runSim(); };

    const starterLabel = document.createElement('span');
    starterLabel.className = 'driver-starter-label' + (checked ? '' : ' hidden');
    starterLabel.textContent = 'STARTER';

    nameWrap.appendChild(driverInput);
    nameWrap.appendChild(starterLabel);

    // ── Squad toggle ──
    const SQUAD_COLORS = ['#3b82f6','#06b6d4','#a855f7','#f97316'];
    const SQUAD_LABELS = ['A','B','C','D'];
    const squadIdx = typeof squad === 'number' ? squad : (squad === 'B' ? 1 : squad === 'C' ? 2 : squad === 'D' ? 3 : 0);

    const squadLabel = document.createElement('div');
    squadLabel.className = 'squad-toggle-container hidden select-none';
    squadLabel.addEventListener('click', (e) => e.stopPropagation());

    const squadHidden = document.createElement('input');
    squadHidden.type = 'hidden';
    squadHidden.className = 'squad-value';
    squadHidden.value = String(squadIdx);

    const squadDisplay = document.createElement('div');
    squadDisplay.innerText = SQUAD_LABELS[squadIdx];
    squadDisplay.style.background = SQUAD_COLORS[squadIdx];
    squadDisplay.className = 'squad-badge';
    squadDisplay.onclick = function(e) {
        e.stopPropagation();
        const numSquads = parseInt(document.getElementById('numSquads')?.value) || 2;
        let cur = parseInt(squadHidden.value) || 0;
        cur = (cur + 1) % numSquads;
        squadHidden.value = String(cur);
        squadDisplay.innerText = SQUAD_LABELS[cur];
        squadDisplay.style.background = SQUAD_COLORS[cur];
        window.runSim();
    };

    squadLabel.appendChild(squadHidden);
    squadLabel.appendChild(squadDisplay);

    div.appendChild(accentBar);
    div.appendChild(colorSwatch);
    div.appendChild(radio);
    div.appendChild(indicator);
    div.appendChild(starterBtn);
    div.appendChild(nameWrap);
    div.appendChild(squadLabel);

    document.getElementById('driversList').appendChild(div);
};

window.updateStarterVisuals = function() {
    const scrollY = window.scrollY;
    document.querySelectorAll('.driver-row').forEach(row => {
        const radio = row.querySelector('.starter-radio');
        const btn = row.querySelector('.driver-starter-btn');
        const lbl = row.querySelector('.driver-starter-label');
        if (!radio) return;
        if (radio.checked) {
            btn && btn.classList.add('is-starter');
            lbl && lbl.classList.remove('hidden');
            row.classList.add('is-starter-row');
        } else {
            btn && btn.classList.remove('is-starter');
            lbl && lbl.classList.add('hidden');
            row.classList.remove('is-starter-row');
        }
    });
    window.scrollTo(0, scrollY);
};

window.toggleMaxConsecutive = function() {
    const allowed = document.getElementById('allowDouble')?.checked;
    const row = document.getElementById('maxConsecutiveRow');
    if (row) row.classList.toggle('hidden', !allowed);
};

window.toggleSquadsInput = function() {
    const numSquads = parseInt(document.getElementById('numSquads')?.value) || 0;
    const useSquads = numSquads > 0;

    // Pro gate: squads is a Pro feature
    if (useSquads && !window.checkProFeature('squads')) {
        document.getElementById('numSquads').value = '0';
        window.showProGate(window.t('lblSquads'));
        return;
    }

    // Update hint text dynamically based on selected count
    const hintEl = document.querySelector('[data-i18n="lblSquadsHint"]');
    if (hintEl) {
        const t = window.t || (k => k);
        if (numSquads >= 2) {
            hintEl.innerText = t('lblSquadsHintActive').replace('{n}', numSquads);
        } else {
            hintEl.innerText = t('lblSquadsHint');
        }
    }

    document.querySelectorAll('.squad-toggle-container').forEach(el => 
        el.classList.toggle('hidden', !useSquads)
    );
    
    // Show/hide night mode button based on squads
    const btnNightMode = document.getElementById('btnNightMode');
    if (btnNightMode) {
        useSquads ? btnNightMode.classList.remove('hidden') : btnNightMode.classList.add('hidden');
    }

    // Show/hide squad window inputs & set smart defaults
    const schedContainer = document.getElementById('squadScheduleContainer');
    if (schedContainer) {
        if (!useSquads) {
            schedContainer.classList.add('hidden');
        } else {
            schedContainer.classList.remove('hidden');
            const startInput = document.getElementById('squadWindowStart');
            const endInput = document.getElementById('squadWindowEnd');
            if (startInput && !startInput.value) {
                const raceStartInput = document.getElementById('raceStartTime');
                const raceHours = parseFloat(document.getElementById('raceDuration')?.value) || 12;
                let baseH = 0, baseM = 0;
                if (raceStartInput && raceStartInput.value) {
                    const p = raceStartInput.value.split(':');
                    baseH = parseInt(p[0]) || 0;
                    baseM = parseInt(p[1]) || 0;
                }
                // Default squad window: middle third of race
                const startOffsetMin = Math.round(raceHours * 60 / 3);
                const endOffsetMin = Math.round(raceHours * 60 * 2 / 3);
                const sH = Math.floor((baseH * 60 + baseM + startOffsetMin) / 60) % 24;
                const sM = (baseH * 60 + baseM + startOffsetMin) % 60;
                const eH = Math.floor((baseH * 60 + baseM + endOffsetMin) / 60) % 24;
                const eM = (baseH * 60 + baseM + endOffsetMin) % 60;
                startInput.value = `${String(sH).padStart(2,'0')}:${String(sM).padStart(2,'0')}`;
                endInput.value = `${String(eH).padStart(2,'0')}:${String(eM).padStart(2,'0')}`;
            }
        }
    }

    // Translate dropdown options
    window.translateSquadDropdown();

    // Auto-assign drivers equally across squads
    if (useSquads) window.autoAssignSquads(numSquads);
};

window.translateSquadDropdown = function() {
    const sel = document.getElementById('numSquads');
    if (!sel) return;
    sel.querySelectorAll('option[data-i18n-opt]').forEach(opt => {
        const key = opt.getAttribute('data-i18n-opt');
        if (key && window.t) opt.textContent = window.t(key);
    });
};

window.autoAssignSquads = function(numSquads) {
    const SQUAD_COLORS = ['#3b82f6','#06b6d4','#a855f7','#f97316'];
    const SQUAD_LABELS = ['A','B','C','D'];
    const rows = document.querySelectorAll('.driver-row');
    rows.forEach((row, i) => {
        const hidden = row.querySelector('.squad-value');
        const display = row.querySelector('.squad-toggle-container > div:last-child');
        if (!hidden || !display) return;
        const sq = i % numSquads;
        hidden.value = String(sq);
        display.innerText = SQUAD_LABELS[sq];
        display.style.background = SQUAD_COLORS[sq];
    });
};

window.toggleFuelInput = function() {
    const trackFuel = document.getElementById('trackFuel');
    const fuelDiv = document.getElementById('fuelInputDiv');
    if (!trackFuel || !fuelDiv) return;

    // Pro gate: fuel tracking is a Pro feature
    if (trackFuel.checked && !window.checkProFeature('fuelTracking')) {
        trackFuel.checked = false;
        window.showProGate(window.t('lblFuel'));
        return;
    }

    trackFuel.checked ? fuelDiv.classList.remove('hidden') : fuelDiv.classList.add('hidden');
};

const _PHOTO_OVERLAY = 'linear-gradient(rgba(0,0,0,0.62), rgba(0,0,0,0.62))';
const _photo = (id) =>
    `background-image: ${_PHOTO_OVERLAY}, url(https://images.unsplash.com/${id}?auto=format&fit=crop&w=1920&q=70); background-size: cover; background-position: center; background-repeat: no-repeat;`;
const _PHOTO_THEME_IDS = new Set(['kart-race', 'kart-night', 'kart-pit', 'kart-onboard', 'kart-wet', 'kart-grid', 'kart-blaze', 'kart-helmet']);

const _BG_THEMES = {
    '': '', // Default — CSS handles it
    'checkered': 'background-color:#111; background-image: repeating-conic-gradient(#1a1a1a 0% 25%, #111 0% 50%); background-size: 20px 20px;',
    'carbon': 'background: repeating-linear-gradient(45deg, #0a0a0a, #0a0a0a 3px, #161616 3px, #161616 6px);',
    'stripes-red': 'background: linear-gradient(180deg, #080000 0%, #150303 35%, #2a0505 48%, #cc0000 49.5%, #cc0000 50.5%, #2a0505 52%, #cc0000 55%, #cc0000 55.5%, #150303 57%, #080000 100%);',
    'night-circuit': 'background: radial-gradient(ellipse at 30% 80%, rgba(34,211,238,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 20%, rgba(168,85,247,0.12) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 0%, #050a12 100%); background-color: #050a12;',
    'pit-lane': 'background: linear-gradient(180deg, #0c0c0c 0%, #0c0c0c 92%, transparent 92%), repeating-linear-gradient(90deg, #d4a017 0px, #d4a017 10px, #111 10px, #111 20px); background-color: #0c0c0c;',
    'tarmac': "background-color:#181818; background-image: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%23181818'/%3E%3Crect width='1' height='1' fill='%23202020'/%3E%3Crect width='1' height='1' x='2' y='2' fill='%23141414'/%3E%3C/svg%3E\"), linear-gradient(180deg, transparent 47%, rgba(255,255,255,0.15) 49%, rgba(255,255,255,0.15) 51%, transparent 53%);",
    'black': 'background: #000000;',
    // === COLOR THEMES ===
    'midnight-blue': 'background: linear-gradient(180deg, #020820 0%, #0a1640 50%, #020820 100%);',
    'deep-red': 'background: linear-gradient(180deg, #1a0505 0%, #2d0a0a 50%, #1a0505 100%);',
    'forest': 'background: linear-gradient(180deg, #051a0a 0%, #0a2d15 50%, #051a0a 100%);',
    'purple-night': 'background: linear-gradient(180deg, #0d0520 0%, #1a0a35 50%, #0d0520 100%);',
    'hot-pink': 'background: linear-gradient(180deg, #150005 0%, #250a1a 30%, #3a0a28 50%, #250a1a 70%, #150005 100%);',
    'amber-heat': 'background: linear-gradient(180deg, #1a1000 0%, #2d1a05 50%, #1a1000 100%);',
    'neon-grid': 'background-color:#050510; background-image: linear-gradient(rgba(0,255,200,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,200,0.05) 1px, transparent 1px); background-size: 40px 40px;',
    'sunset-racing': 'background: linear-gradient(180deg, #1a0520 0%, #2d0a15 25%, #4a1a08 50%, #2d0a15 75%, #1a0520 100%);',
    'martini-stripe': 'background: linear-gradient(180deg, #0e0e14 0%, #0e0e14 44%, #1a3a6e 44.5%, #1a3a6e 47%, #cc2222 47.5%, #cc2222 50.5%, #1a3a6e 51%, #1a3a6e 53.5%, #0e0e14 54%, #0e0e14 100%);',
    'ferrari-rosso': 'background: linear-gradient(180deg, #0e0000 0%, #2a0808 25%, #4a0a0a 50%, #2a0808 75%, #0e0000 100%);',
    'mclaren-papaya': 'background: linear-gradient(180deg, #100800 0%, #201505 25%, #3a2008 40%, #4a2a0a 50%, #3a2008 60%, #201505 75%, #100800 100%);',
    'volcanic': 'background: linear-gradient(180deg, #0a0000 0%, #1a0500 20%, #2d0800 35%, #401005 50%, #2d0800 65%, #1a0500 80%, #0a0000 100%);',
    // === 📸 PHOTO THEMES (requires internet) ===
    'kart-race':    _photo('photo-1558618666-fcd25c85cd64'),
    'kart-night':   _photo('photo-1568605117036-5fe5e7bab0b7'),
    'kart-pit':     _photo('photo-1541348263662-e068662d82af'),
    'kart-onboard': _photo('photo-1503376780353-7e6692767b70'),
    'kart-wet':     _photo('photo-1543466835-00a7b8755b4c'),
    'kart-grid':    _photo('photo-1504707748692-419802cf939d'),
    'kart-blaze':   _photo('photo-1583394293214-fb28a5a16b6d'),
    'kart-helmet':  _photo('photo-1594398901-e69f3a2c1e23'),
};

// Dashboard tint colors per theme — applied to dashboard elements
const _THEME_TINTS = {
    '': { main: '', panel: '', border: '' },
    'checkered': { main: '#0e0e0e', panel: '#181818', border: '#2a2a2a' },
    'carbon': { main: '#0a0a0a', panel: '#141414', border: '#252525' },
    'stripes-red': { main: '#0e0202', panel: '#180505', border: '#3a1010' },
    'night-circuit': { main: '#050a12', panel: '#0a1225', border: '#1a2545' },
    'pit-lane': { main: '#0c0c0c', panel: '#161610', border: '#2a2a1a' },
    'tarmac': { main: '#141414', panel: '#1a1a1a', border: '#2a2a2a' },
    'black': { main: '#000000', panel: '#0a0a0a', border: '#1a1a1a' },
    'midnight-blue': { main: '#020820', panel: '#081535', border: '#102050' },
    'deep-red': { main: '#1a0505', panel: '#220808', border: '#401515' },
    'forest': { main: '#051a0a', panel: '#082510', border: '#104020' },
    'purple-night': { main: '#0d0520', panel: '#150a30', border: '#251545' },
    'hot-pink': { main: '#150510', panel: '#1e0818', border: '#3a1030' },
    'amber-heat': { main: '#1a1000', panel: '#221805', border: '#403015' },
    'neon-grid': { main: '#050510', panel: '#0a0a1a', border: '#0f2a25' },
    'sunset-racing': { main: '#1a0520', panel: '#250a18', border: '#401530' },
    'martini-stripe': { main: '#0e0e14', panel: '#15151e', border: '#252535' },
    'ferrari-rosso': { main: '#0e0000', panel: '#1a0505', border: '#3a1010' },
    'mclaren-papaya': { main: '#100800', panel: '#1a1208', border: '#352510' },
    'volcanic': { main: '#0a0000', panel: '#150500', border: '#301008' },
    // === 📸 PHOTO THEME TINTS (near-black so UI stays readable over any photo) ===
    'kart-race':    { main: '#050505', panel: '#0c0c0c', border: '#222222' },
    'kart-night':   { main: '#03060e', panel: '#08101e', border: '#1a2030' },
    'kart-pit':     { main: '#060606', panel: '#0e0e0e', border: '#202020' },
    'kart-onboard': { main: '#050505', panel: '#0c0c0c', border: '#1e1e1e' },
    'kart-wet':     { main: '#050810', panel: '#0a1020', border: '#182030' },
    'kart-grid':    { main: '#060505', panel: '#100a0a', border: '#201515' },
    'kart-blaze':   { main: '#080403', panel: '#100806', border: '#201410' },
    'kart-helmet':  { main: '#050505', panel: '#0c0c0c', border: '#202020' },
};

window.setPageBackground = function(bg) {
    if (_PHOTO_THEME_IDS.has(bg) && !window._proUnlocked) {
        if (typeof window.showProGate === 'function') {
            window.showProGate('Photo Themes');
        }
        if (typeof window.showToast === 'function') {
            window.showToast('Photo themes are available for Pro users', 'warning', 2500);
        }
        return;
    }

    // Clear all inline background styles first
    document.body.style.cssText = document.body.style.cssText.replace(/background[^;]*;?/gi, '');
    
    if (bg && _BG_THEMES[bg]) {
        // Apply named theme CSS
        const styles = _BG_THEMES[bg];
        // Parse and apply each property
        styles.split(';').forEach(rule => {
            const [prop, ...valParts] = rule.split(':');
            if (prop && valParts.length) {
                const cssProp = prop.trim();
                const val = valParts.join(':').trim();
                if (cssProp.startsWith('background')) {
                    document.body.style.setProperty(cssProp, val);
                }
            }
        });
    } else if (bg) {
        // Fallback for legacy saved values (old hex colors)
        document.body.style.background = bg;
    }
    // else: empty = default, CSS handles it
    
    // Apply dashboard tint
    const tint = _THEME_TINTS[bg] || _THEME_TINTS[''];
    const dashboard = document.getElementById('raceDashboard');
    const infoBar = document.getElementById('dashboardInfoBar');
    const headerEl = document.querySelector('header');
    if (tint.main) {
        if (dashboard) dashboard.style.backgroundColor = tint.main;
        if (infoBar) infoBar.style.backgroundColor = tint.panel;
        if (headerEl) headerEl.style.backgroundColor = tint.panel;
        // Set CSS variables for panels that use bg-navy-900/bg-navy-950
        document.documentElement.style.setProperty('--theme-main', tint.main);
        document.documentElement.style.setProperty('--theme-panel', tint.panel);
        document.documentElement.style.setProperty('--theme-border', tint.border);
    } else {
        if (dashboard) dashboard.style.backgroundColor = '';
        if (infoBar) infoBar.style.backgroundColor = '';
        if (headerEl) headerEl.style.backgroundColor = '';
        document.documentElement.style.removeProperty('--theme-main');
        document.documentElement.style.removeProperty('--theme-panel');
        document.documentElement.style.removeProperty('--theme-border');
    }
    
    localStorage.setItem('strateger_bg', bg);
    // Highlight active swatch
    document.querySelectorAll('.bg-swatch').forEach(s => {
        s.classList.toggle('active', s.dataset.bg === bg);
    });
    // Auto-close theme panel after selection
    const tp = document.getElementById('themePanel');
    if (tp && !tp.classList.contains('hidden')) {
        setTimeout(() => tp.classList.add('hidden'), 250);
    }
};

// Toggle theme picker panel (nav button)
window.toggleThemePanel = function() {
    const panel = document.getElementById('themePanel');
    if (!panel) return;
    panel.classList.toggle('hidden');
    // Re-sync active swatch highlight when opening
    if (!panel.classList.contains('hidden')) {
        const current = localStorage.getItem('strateger_bg') || '';
        panel.querySelectorAll('.bg-swatch').forEach(s => {
            s.classList.toggle('active', s.dataset.bg === current);
            const isPhoto = _PHOTO_THEME_IDS.has(s.dataset.bg || '');
            const locked = isPhoto && !window._proUnlocked;
            s.classList.toggle('opacity-50', locked);
            s.classList.toggle('cursor-not-allowed', locked);
            s.title = locked ? `${s.title || 'Photo'} (Pro)` : (s.title || '');
        });
    }
};

// פונקציית עזר לפורמט שעות:דקות (3:35)
function formatHours(ms) {
    let h = Math.floor(ms / 3600000);
    let m = Math.floor((ms % 3600000) / 60000);
    return `${h}:${m.toString().padStart(2, '0')}`;
}

window.renderPreview = function() {
    if (!window.previewData || !window.previewData.timeline) return;

    const timeline = window.previewData.timeline;
    const t = window.t || ((k) => k);

    // === 1. קביעת זמן התחלה ===
    let startRef;
    const timeInput = document.getElementById('raceStartTime');
    const dateInput = document.getElementById('raceStartDate');
    const previewTimeDisplay = document.getElementById('previewStartTimeDisplay');

    if (timeInput && timeInput.value) {
        if (previewTimeDisplay) previewTimeDisplay.innerText = timeInput.value;
        startRef = dateInput && dateInput.value ? new Date(dateInput.value + 'T' + timeInput.value + ':00') : new Date();
        if (isNaN(startRef.getTime())) {
            startRef = new Date();
            const [h, m] = timeInput.value.split(':');
            startRef.setHours(parseInt(h), parseInt(m), 0, 0);
        }
    } else {
        startRef = new Date();
    }

    // === 1b. Weather banner (location weather) ===
    const weatherBanner = document.getElementById('previewLocationWeather');
    const raceDateMs = startRef.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const dateIsFarOut = (raceDateMs - Date.now()) > sevenDaysMs;
    if (weatherBanner) {
        if (window._venueWeather && window._venueWeather.locationName) {
            if (dateIsFarOut) {
                weatherBanner.textContent = `📍 ${window._venueWeather.locationName} — ${t('weatherTooFarOut') || 'Date too far — forecast unavailable'}`;
            } else {
                const forecast = typeof window.getVenueForecastAt === 'function' ? window.getVenueForecastAt(raceDateMs) : null;
                const fmtStr = forecast && typeof window.formatVenueForecastShort === 'function' ? window.formatVenueForecastShort(forecast) : '';
                weatherBanner.textContent = `📍 ${window._venueWeather.locationName}${fmtStr ? ' · ' + fmtStr : ''}`;
            }
            weatherBanner.classList.remove('hidden');
        } else {
            weatherBanner.classList.add('hidden');
        }
    }

    // Refresh weather data for selected location
    if (typeof window.refreshVenueWeather === 'function') {
        const locInput = document.getElementById('raceLocation');
        if (locInput && locInput.value) {
            const selectedPlace = typeof window.resolveVenueLocation === 'function' ? window.resolveVenueLocation(locInput.value) : null;
            window.refreshVenueWeather(locInput.value, selectedPlace);
        }
    }

    // === 2. בדיקת כיוון שפה ===
    const isRtl = document.documentElement.dir === 'rtl';
    const arrow = isRtl ? '⬅' : '➜';

    // === 3. עדכון חץ הכותרת ===
    const timelineArrow = document.getElementById('timelineArrow');
    if (timelineArrow) {
        timelineArrow.innerText = arrow;
    }

    // === 4. חישוב טיימליין עם זמנים מדויקים ===
    const stints = timeline.filter(t => t.type === 'stint');
    const pits = timeline.filter(t => t.type === 'pit');
    
    let currentTimeMs = startRef.getTime();

    // === 5. עדכון כותרות זמן התחלה/סיום ===
    const startEl = document.getElementById('timelineStart');
    if (startEl) startEl.innerText = startRef.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    // חישוב זמן סיום כולל (כל הסטינטים + כל הפיטים)
    const totalDriveTime = stints.reduce((a, s) => a + s.duration, 0);
    const totalPitTime = pits.reduce((a, p) => a + p.duration, 0);
    const raceEndTime = new Date(startRef.getTime() + totalDriveTime + totalPitTime);
    
    const endEl = document.getElementById('timelineEnd');
    if (endEl) endEl.innerText = raceEndTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    // === 6. רינדור רשימת הסטינטים (with drag-drop & editable durations) ===
    const minStintMin = window.config ? (window.config.minStint || 1) : 1;
    const maxStintMin = window.config ? (window.config.maxStint || 999) : 999;

    const listHtml = stints.map((stint, index) => {
        const stintStartMs = currentTimeMs;
        const startTime = new Date(currentTimeMs);
        const endTime = new Date(currentTimeMs + stint.duration);
        const durationMin = Math.round(stint.duration / 60000);

        const startTimeStr = startTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const endTimeStr = endTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

        currentTimeMs += stint.duration;

        const pit = pits[index];
        const isLast = index === stints.length - 1;
        const isFirst = index === 0;

        let pitIndicator = '';
        if (pit && !isLast) {
            const pitSec = Math.round(pit.duration / 1000);
            pitIndicator = `<span class="text-gold text-[10px] ml-1">🔧+${pitSec}s</span>`;
            currentTimeMs += pit.duration;
        }

        // Weather tag for this stint's start time
        const showWeatherChecked = document.getElementById('showWeatherInStints')?.checked !== false;
        let stintForecastTag = '';
        if (showWeatherChecked && window._venueWeather && typeof window.getVenueForecastAt === 'function') {
            if (dateIsFarOut) {
                stintForecastTag = `<span class="text-[9px] text-gray-600 ml-1">${t('weatherTooFarOut') || '—'}</span>`;
            } else {
                const fc = window.getVenueForecastAt(stintStartMs);
                if (fc && typeof window.formatVenueForecastShort === 'function') {
                    stintForecastTag = `<span class="text-[9px] text-blue-400 ml-1">${window.formatVenueForecastShort(fc)}</span>`;
                }
            }
        }

        const outOfBounds = durationMin < minStintMin || durationMin > maxStintMin;
        const borderWarning = outOfBounds ? 'ring-1 ring-red-500' : '';

        return `
            <div class="flex items-center gap-1 bg-navy-950 rounded border-l-4 mb-1 text-xs cursor-grab active:cursor-grabbing ${borderWarning}"
                 style="border-left-color: ${stint.color}"
                 draggable="${window._isTouchDevice ? 'false' : 'true'}" data-index="${index}"
                 ondragstart="window.handleDragStart(event)"
                 ondragover="window.handleDragOver(event)"
                 ondragleave="window.handleDragLeave(event)"
                 ondrop="window.handleDrop(event)">
                <div class="flex flex-col gap-0.5 shrink-0">
                    <button onclick="window.moveStint(${index}, -1)" class="text-gray-500 hover:text-white text-[10px] leading-none px-1 ${isFirst ? 'invisible' : ''}" title="Move Up">▲</button>
                    <span class="text-gray-500 text-center font-mono text-[10px]">#${index + 1}</span>
                    <button onclick="window.moveStint(${index}, 1)" class="text-gray-500 hover:text-white text-[10px] leading-none px-1 ${isLast ? 'invisible' : ''}" title="Move Down">▼</button>
                </div>
                <div class="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span class="font-bold text-white truncate max-w-[6rem]">${stint.driverName}</span>
                    <span class="text-gray-600 text-[10px]">|</span>
                    <span class="text-gray-400 text-[10px]">${startTimeStr}</span>
                    <span class="text-ice text-[10px]">${arrow}</span>
                    <span class="text-gray-400 text-[10px]">${endTimeStr}</span>
                    ${isLast ? `<span class="inline-flex items-center ml-1" title="Final stint">
                        <svg width="14" height="10" viewBox="0 0 14 10" aria-hidden="true">
                            <rect x="0.5" y="0.5" width="13" height="9" rx="1" fill="#111" stroke="#666"/>
                            <rect x="1" y="1" width="3" height="4" fill="#fff"/>
                            <rect x="4" y="1" width="3" height="4" fill="#111"/>
                            <rect x="7" y="1" width="3" height="4" fill="#fff"/>
                            <rect x="10" y="1" width="3" height="4" fill="#111"/>
                            <rect x="1" y="5" width="3" height="4" fill="#111"/>
                            <rect x="4" y="5" width="3" height="4" fill="#fff"/>
                            <rect x="7" y="5" width="3" height="4" fill="#111"/>
                            <rect x="10" y="5" width="3" height="4" fill="#fff"/>
                        </svg>
                    </span>` : ''}
                    ${pitIndicator}
                    ${stintForecastTag}
                </div>
                <input type="number" value="${durationMin}" min="${minStintMin}" max="${maxStintMin}"
                       onchange="window.updateStintDuration(${index}, this.value)"
                       class="w-14 bg-navy-800 border border-gray-600 text-white text-center text-xs rounded px-1 py-0.5 font-mono focus:border-ice focus:outline-none ${outOfBounds ? 'border-red-500 text-red-300' : ''}"
                       title="Stint duration (min)">
                <span class="text-gray-500 text-[10px]">m</span>
            </div>
        `;
    }).join('');

    // Total bar showing drive time + pit time = race time
    const totalDrive = stints.reduce((a, s) => a + s.duration, 0);
    const totalPit = pits.reduce((a, p) => a + p.duration, 0);
    const raceTimeMs = window.config ? (window.config.raceMs || 0) : 0;
    const diffMs = (totalDrive + totalPit) - raceTimeMs;
    const diffClass = Math.abs(diffMs) <= 60000 ? 'text-neon' : 'text-red-400';
    const totalBar = `
        <div class="bg-navy-800 p-2 rounded border border-gray-700 text-[10px] text-gray-400 flex justify-between items-center mt-2">
            <span>${window.t ? window.t('driveNoun') : 'Drive'}: <b class="text-white">${(totalDrive/60000).toFixed(0)}m</b> + ${window.t ? window.t('pitNoun') : 'Pit'}: <b class="text-gold">${(totalPit/60000).toFixed(0)}m</b></span>
            <span class="${diffClass} font-bold">= ${((totalDrive+totalPit)/60000).toFixed(0)}m ${diffMs !== 0 ? '(' + (diffMs > 0 ? '+' : '') + (diffMs/60000).toFixed(0) + 'm)' : '✅'}</span>
        </div>
    `;
    
    const scheduleEl = document.getElementById('driverScheduleList');
    if (scheduleEl) {
        scheduleEl.innerHTML = listHtml + totalBar;
        // Re-init touch drag for mobile reorder
        window.initTouchDrag(scheduleEl);
    }

    // === 7. סיכום נהגים ===
    const summary = {};
    stints.forEach(s => {
        if (!summary[s.driverName]) summary[s.driverName] = { time: 0, stints: 0, color: s.color };
        summary[s.driverName].time += s.duration;
        summary[s.driverName].stints += 1;
    });

    // Compact inline chip: color dot + name + time + stints count
    const summaryHtml = Object.entries(summary).map(([name, data]) => {
        const timeStr = window.formatTimeHMS(data.time);
        return `<span class="inline-flex items-center gap-1 bg-navy-950 border rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap text-[9px]" style="border-color:${data.color}40">
            <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${data.color}"></span>
            <span class="font-bold text-gray-200 max-w-[5rem] truncate">${name}</span>
            <span class="font-mono text-white">${timeStr}</span>
            <span class="text-gray-600">${data.stints}×</span>
        </span>`;
    }).join('');

    const summaryEl = document.getElementById('strategySummary');
    if (summaryEl) {
        summaryEl.className = "flex items-center gap-1.5 flex-wrap";
        summaryEl.innerHTML = summaryHtml;
    }
};

// פונקציית עדכון לוגים בזמן אמת
window.updateStats = function(currentStintMs) {
    const tb = document.getElementById('statsTable'); 
    if (!tb || !window.drivers) return;
    
    tb.innerHTML = '';
    
    // Calculate total race driving time for % bar
    let grandTotal = 0;
    const driverTimes = window.drivers.map((d, i) => {
        let t = d.totalTime || 0;
        if (i === window.state.currentDriverIdx && !window.state.isInPit) t += currentStintMs;
        grandTotal += t;
        return t;
    });
    
    window.drivers.forEach((d, i) => {
        // חישוב זמן כולל לתצוגה
        let displayTotalTime = driverTimes[i];
        
        const mainRow = document.createElement('tr');
        const isCurrent = (i === window.state.currentDriverIdx);
        mainRow.className = isCurrent ? "bg-white/10 font-bold text-white border-b border-gray-600" : "border-b border-gray-700 text-gray-300";
        
        // Show squad info if night mode is active and squads are enabled
        const SQUAD_COLOR_MAP = { A: '#3b82f6', B: '#06b6d4', C: '#a855f7', D: '#f97316' };
        let squadBadge = '';
        if (window.config.useSquads && window.state.isNightMode) {
            const driverSquad = d.squad || 'A';
            const activeSquad = window.state.activeSquad || 'A';
            const isActive = driverSquad === activeSquad;
            const squadStatus = isActive ? '🟢' : '😴';
            squadBadge = `<span class="text-xs font-bold px-2 py-0.5 rounded ml-1" style="background:${isActive ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.3)'}; color:${isActive ? '#86efac' : '#9ca3af'}">${driverSquad} ${squadStatus}</span>`;
        } else if (window.config.useSquads) {
            const driverSquad = d.squad || 'A';
            squadBadge = `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded ml-1" style="background:${SQUAD_COLOR_MAP[driverSquad] || '#3b82f6'}; color:#fff">${driverSquad}</span>`;
        }
        
        // Driver colour dot
        const colorDot = `<span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5 shrink-0" style="background:${d.color || '#3b82f6'}"></span>`;
        
        // Driver % share
        const pct = grandTotal > 0 ? Math.round((displayTotalTime / grandTotal) * 100) : 0;
        const pctBar = `<div class="w-full bg-gray-800 rounded-full h-1.5 mt-0.5"><div class="h-1.5 rounded-full" style="width:${pct}%;background:${d.color || '#3b82f6'}"></div></div>`;
        
        mainRow.innerHTML = `
            <td class="text-center cursor-pointer p-2 hover:text-ice" onclick="window.toggleLog(${i})">${d.isExpanded ? '▲' : '▼'}</td>
            <td class="py-2 pr-2"><div class="flex items-center">${colorDot}${d.name} ${isCurrent ? '🏎️' : ''}${squadBadge}</div></td>
            <td class="py-2 text-center">${d.stints || 0}</td> <td class="py-2 text-right font-mono"><div>${window.formatTimeHMS(displayTotalTime)}</div><div class="flex items-center gap-1 justify-end"><span class="text-[9px] text-gray-500">${pct}%</span><div class="w-10">${pctBar}</div></div></td>
        `;
        tb.appendChild(mainRow);

        if (d.isExpanded) {
            const logRow = document.createElement('tr');
            const logCell = document.createElement('td');
            logCell.colSpan = 4;
            logCell.className = "bg-navy-950 p-2 text-[10px]";
            
            let logsHtml = '<div class="flex justify-between text-gray-500 border-b border-gray-700 pb-1 mb-1"><span>#</span><span>Drive</span><span>Pit</span></div>';
            
            // לוגים היסטוריים (מה שנשמר ב-main.js)
            if (d.logs && d.logs.length > 0) {
                d.logs.forEach((log, idx) => {
                    logsHtml += `
                        <div class="flex justify-between items-center py-1 border-b border-gray-800">
                            <span class="text-gray-500">${idx + 1}</span>
                            <span class="text-ice font-mono">${window.formatTimeHMS(log.drive)}</span>
                            <span class="text-fuel font-mono">${log.pit ? window.formatTimeHMS(log.pit) : '--'}</span>
                        </div>
                    `;
                });
            }
            
            // סטינט נוכחי (רץ) - לא נכנס ללוג הקבוע, רק מוצג כ"חי"
            if (isCurrent && !window.state.isInPit) {
                logsHtml += `
                    <div class="flex justify-between items-center py-1 bg-ice/10 text-white font-bold animate-pulse">
                        <span class="text-ice">LIVE</span>
                        <span class="text-ice font-mono">${window.formatTimeHMS(currentStintMs)}</span>
                        <span class="text-gray-500">...</span>
                    </div>
                `;
            }
            
            if ((!d.logs || d.logs.length === 0) && (!isCurrent || window.state.isInPit)) {
                 logsHtml += '<div class="text-center text-gray-600 py-1">No history</div>';
            }

            logCell.innerHTML = logsHtml;
            logRow.appendChild(logCell);
            tb.appendChild(logRow);
        }
    });
};

window.toggleLog = function(idx) {
    if (window.drivers[idx]) {
        window.drivers[idx].isExpanded = !window.drivers[idx].isExpanded;
        // עדכון מיידי
        const now = Date.now();
        const stintTime = window.state.isInPit ? 0 : (now - window.state.stintStart + window.state.stintOffset);
        window.updateStats(stintTime);
    }
};

// ... (Drag & Drop ושאר הפונקציות נשארים ללא שינוי) ...
window.draggedStintIndex = null;
window.handleDragStart = function(e) {
    window.draggedStintIndex = parseInt(e.currentTarget.getAttribute('data-index'));
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.classList.add('draggable-source');
};
window.handleDragOver = function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.classList.add('drag-over'); };
window.handleDragLeave = function(e) { e.currentTarget.classList.remove('drag-over'); };
window.handleDrop = function(e) {
    e.preventDefault(); e.stopPropagation();
    const targetRow = e.currentTarget;
    targetRow.classList.remove('drag-over');
    document.querySelector('.draggable-source')?.classList.remove('draggable-source');
    const targetIndex = parseInt(targetRow.getAttribute('data-index'));
    if (window.draggedStintIndex !== null && window.draggedStintIndex !== targetIndex) {
        window.swapStints(window.draggedStintIndex, targetIndex);
    }
    window.draggedStintIndex = null;
};

// === Touch-based reorder (long-press on mobile) ===
window._touchDragState = null;

window.initTouchDrag = function(container) {
    if (!container || !window._isTouchDevice) return;
    
    let longPressTimer = null;
    let touchItem = null;
    
    container.addEventListener('touchstart', function(e) {
        const item = e.target.closest('[data-index]');
        if (!item) return;
        // Don't start drag on input elements or buttons
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;

        touchItem = item;
        longPressTimer = setTimeout(() => {
            // Long press activated — start drag
            window.haptic && window.haptic('medium');
            const idx = parseInt(item.getAttribute('data-index'));
            window._touchDragState = { fromIdx: idx, el: item };
            item.style.opacity = '0.5';
            item.style.outline = '2px solid #22d3ee';
            window.showToast('🔀 Drag to reorder, or use ▲▼', 'info', 2000);
        }, 500); // 500ms long press
    }, { passive: false });

    container.addEventListener('touchmove', function(e) {
        // Cancel long-press if finger moves before drag is activated (user is scrolling)
        if (longPressTimer && !window._touchDragState) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            return; // Let the scroll happen normally
        }

        if (!window._touchDragState) return;
        e.preventDefault(); // Safe: only called after drag is confirmed active
        
        // Find which item we're over
        const touch = e.touches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetItem = el?.closest('[data-index]');
        
        // Highlight drop target
        container.querySelectorAll('[data-index]').forEach(i => i.classList.remove('drag-over'));
        if (targetItem && targetItem !== window._touchDragState.el) {
            targetItem.classList.add('drag-over');
        }
    }, { passive: false });
    
    container.addEventListener('touchend', function(e) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        
        if (!window._touchDragState) return;
        
        // Find drop target
        const touch = e.changedTouches[0];
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const targetItem = el?.closest('[data-index]');
        
        // Clean up highlights
        container.querySelectorAll('[data-index]').forEach(i => {
            i.classList.remove('drag-over');
            i.style.opacity = '';
            i.style.outline = '';
        });
        
        if (targetItem) {
            const toIdx = parseInt(targetItem.getAttribute('data-index'));
            if (toIdx !== window._touchDragState.fromIdx) {
                window.haptic && window.haptic('light');
                window.swapStints(window._touchDragState.fromIdx, toIdx);
            }
        }
        
        window._touchDragState = null;
    }, { passive: true });
    
    container.addEventListener('touchcancel', function() {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        if (window._touchDragState) {
            window._touchDragState.el.style.opacity = '';
            window._touchDragState.el.style.outline = '';
            window._touchDragState = null;
        }
        container.querySelectorAll('[data-index]').forEach(i => i.classList.remove('drag-over'));
    });
};

window.swapStints = function(fromIdx, toIdx) {
    if (!window.previewData || !window.previewData.timeline) return;
    const stints = window.previewData.timeline.filter(t => t.type === 'stint');
    const source = stints[fromIdx];
    const target = stints[toIdx];
    const temp = { name: source.driverName, idx: source.driverIdx, col: source.color, sq: source.squad };
    source.driverName = target.driverName; source.driverIdx = target.driverIdx; source.color = target.color; source.squad = target.squad;
    target.driverName = temp.name; target.driverIdx = temp.idx; target.color = temp.col; target.squad = temp.sq;
    window.renderPreview();
};
window.updateStintDuration = function(idx, val) {
    const newMs = parseFloat(val) * 60000;
    if (!(newMs > 0) || !window.previewData?.timeline) return;

    const stints = window.previewData.timeline.filter(t => t.type === 'stint');
    if (!stints[idx]) return;

    const pits = window.previewData.timeline.filter(t => t.type === 'pit');
    const totalPitMs = pits.reduce((a, p) => a + p.duration, 0);
    const raceMs = window.config ? (window.config.raceMs || 0) : 0;
    const targetDriveMs = raceMs - totalPitMs;

    const minMs = (window.config?.minStint || 1) * 60000;
    const maxMs = (window.config?.maxStint || 999) * 60000;

    // Clamp to bounds
    const clampedMs = Math.max(minMs, Math.min(maxMs, newMs));
    const oldMs = stints[idx].duration;
    const delta = clampedMs - oldMs;

    stints[idx].duration = clampedMs;

    // Rebalance: distribute the delta across the other stints proportionally
    if (delta !== 0 && stints.length > 1) {
        const others = stints.filter((_, i) => i !== idx);
        const othersTotal = others.reduce((a, s) => a + s.duration, 0);
        const newOthersTarget = targetDriveMs - clampedMs;

        if (othersTotal > 0 && newOthersTarget > 0) {
            const scale = newOthersTarget / othersTotal;
            let distributed = 0;
            others.forEach((s, i) => {
                if (i < others.length - 1) {
                    let adjusted = Math.round((s.duration * scale) / 1000) * 1000;
                    adjusted = Math.max(minMs, Math.min(maxMs, adjusted));
                    distributed += adjusted;
                    s.duration = adjusted;
                } else {
                    // Last stint absorbs remainder
                    let remainder = newOthersTarget - distributed;
                    remainder = Math.max(minMs, Math.min(maxMs, Math.round(remainder / 1000) * 1000));
                    s.duration = remainder;
                }
            });
        }
    }

    window.recalculateTimelineTimes();
    window.renderPreview();
};

window.moveStint = function(fromIdx, direction) {
    if (!window.previewData?.timeline) return;
    const stints = window.previewData.timeline.filter(t => t.type === 'stint');
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= stints.length) return;
    window.swapStints(fromIdx, toIdx);
};
window.closePreview = function() {
    document.getElementById('previewScreen').classList.add('hidden');
    document.getElementById('setupScreen').classList.remove('hidden');
};
window.openManualInput = function() {
    document.getElementById('manualInputModal').classList.remove('hidden');
    // Pre-fill all fields from current live data
    if (window.liveData.position) document.getElementById('manualPosition').value = window.liveData.position;
    if (window.liveData.laps) document.getElementById('manualLaps').value = window.liveData.laps;
    if (window.liveData.lastLap) {
        const lastMs = window.liveData.lastLap;
        document.getElementById('manualLastLap').value = lastMs > 1000 ? (lastMs / 1000).toFixed(3) : lastMs;
    }
    if (window.liveData.bestLap) {
        const bestMs = window.liveData.bestLap;
        document.getElementById('manualBestLap').value = bestMs > 1000 ? (bestMs / 1000).toFixed(3) : bestMs;
    }
    if (window.liveData.gap) {
        const gapStr = String(window.liveData.gap).replace('+', '');
        const gapVal = parseFloat(gapStr);
        if (!isNaN(gapVal)) document.getElementById('manualGap').value = gapVal;
    }
};
window.closeManualInput = function() { document.getElementById('manualInputModal').classList.add('hidden'); };
window.applyManualInput = function() {
    const pos = parseInt(document.getElementById('manualPosition').value);
    const laps = parseInt(document.getElementById('manualLaps').value);
    const lastLapSec = parseFloat(document.getElementById('manualLastLap').value);
    const bestLapSec = parseFloat(document.getElementById('manualBestLap').value);
    const gapVal = parseFloat(document.getElementById('manualGap').value);
    
    if (pos && pos > 0) window.liveData.position = pos;
    if (!isNaN(laps) && laps >= 0) window.liveData.laps = laps;
    if (lastLapSec && lastLapSec > 0) {
        // Store as milliseconds (convert from seconds input)
        window.liveData.lastLap = Math.round(lastLapSec * 1000);
    }
    if (bestLapSec && bestLapSec > 0) {
        window.liveData.bestLap = Math.round(bestLapSec * 1000);
    }
    if (!isNaN(gapVal)) {
        window.liveData.gap = gapVal >= 0 ? `+${gapVal.toFixed(3)}` : `${gapVal.toFixed(3)}`;
    }
    
    if (typeof window.updateLiveTimingUI === 'function') {
        window.liveTimingConfig.enabled = true;
        window.updateLiveTimingUI();
    }
    window.closeManualInput();
};

// פתיחת המודאל (מתקן את השגיאה Uncaught TypeError)
window.saveStrategy = function() {
    const modal = document.getElementById('saveStrategyModal');
    if (modal) {
        modal.classList.remove('hidden');
        // איפוס שדה השם
        const nameInput = document.getElementById('saveStrategyName');
        if (nameInput) nameInput.value = `Strategy ${new Date().toLocaleTimeString()}`;
    }
};

// סגירת המודאל
window.closeSaveStrategyModal = function() {
    const modal = document.getElementById('saveStrategyModal');
    if (modal) modal.classList.add('hidden');
};

// החלף את הפונקציה performStrategySave ב-js/ui.js בקוד הזה:
window.performStrategySave = async function() {
    const name = document.getElementById('saveStrategyName').value || 'Untitled';
    const visibility = document.querySelector('input[name="strategyVisibility"]:checked')?.value || 'private';
    
    if (!window.cachedStrategy) return window.showToast("No strategy generated yet!", 'warning');

    // הכנת הנתונים לשליחה לשרת
    const payload = {
        name: name,
        isPublic: visibility === 'public',
        config: window.config,
        drivers: window.drivers,
        timeline: window.cachedStrategy.timeline,
        driverSchedule: window.previewData.driverSchedule, // חשוב לתצוגה
        userId: window.myId || 'anonymous', // מזהה משתמש אם קיים
        deviceId: localStorage.getItem('strateger_host_id') // מזהה מכשיר
    };

    const btn = document.querySelector('#saveStrategyModal button.bg-ice');
    const originalText = btn ? btn.innerText : 'Save';
    if (btn) { btn.innerText = "Saving..."; btn.disabled = true; }

    try {
        // שליחה לקובץ save-strategy.js דרך השרת
        const response = await fetch(window.APP_CONFIG.API_BASE + '/.netlify/functions/save-strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Server error');
        }
        
        window.showToast('☁️ Strategy saved to cloud!', 'success');
        window.closeSaveStrategyModal();

    } catch (e) {
        console.error("Save failed:", e);
        window.showToast('Cloud save failed: ' + e.message, 'error');
        
        // אופציונלי: גיבוי ל-LocalStorage אם השרת נכשל
        // const saved = JSON.parse(localStorage.getItem('strateger_strategies') || '[]');
        // saved.push(payload);
        // localStorage.setItem('strateger_strategies', JSON.stringify(saved));
    } finally {
        if (btn) { btn.innerText = originalText; btn.disabled = false; }
    }
};

// ==========================================
// 📚 STRATEGY LIBRARY (DB Loaded)
// ==========================================

window.loadStrategyLibrary = async function() {
    const modal = document.getElementById('strategyModal');
    const list = document.getElementById('strategyList');
    
    if (modal) modal.classList.remove('hidden');
    if (list) list.innerHTML = '<div class="text-center text-gray-500 p-4">Loading strategies from Cloud... <span class="animate-spin inline-block">⏳</span></div>';

    let strategies = [];

    // 1. נסה לטעון מהשרת (DB)
    try {
        const deviceId = localStorage.getItem('strateger_host_id') || '';
        const response = await fetch(`/.netlify/functions/get-strategies?deviceId=${deviceId}`); 
        const result = await response.json();

        if (result.success && Array.isArray(result.strategies)) {
            // המרת הנתונים מהפורמט של DB לפורמט המקומי
            strategies = result.strategies.map(s => ({
                name: s.name,
                config: s.config || {
                    duration: (s.race_duration_ms || 0) / 3600000,
                    reqStops: s.required_stops || 0,
                    minStint: s.config?.minStint || 0,
                    maxStint: s.config?.maxStint || 0,
                    pitTime: s.config?.pitTime || 0,
                    allowDouble: s.config?.allowDouble || false,
                    useSquads: s.config?.useSquads || false,
                    ...s.config
                },
                drivers: s.drivers || [],
                timeline: s.timeline || [],
                driverSchedule: s.driver_schedule || [],
                timestamp: s.created_at || new Date().toISOString(),
                type: s.is_public ? 'public' : 'private',
                id: s.id
            }));
            console.log("Loaded from Cloud:", strategies.length);
        } else {
            console.warn("Cloud load returned empty or error, falling back to local.");
            throw new Error(result.error || "Unknown error");
        }

    } catch (e) {
        console.error("Could not load from DB:", e);
        
        // 2. במקרה של שגיאה או אם אין אינטרנט - טען מה-LocalStorage
        if (list) list.innerHTML = '<div class="text-center text-yellow-500 p-2 text-xs">Offline / DB Error - Showing Local Files</div>';
        try {
            const localData = JSON.parse(localStorage.getItem('strateger_strategies') || '[]');
            strategies = localData; 
        } catch (localErr) {
            console.error("Local load error:", localErr);
        }
    }
    
    // שמירת האסטרטגיות במשתנה גלובלי לשימוש ב-applyStrategy
    window.currentStrategies = strategies;
    
    // שליחה לפונקציית הרינדור
    window.renderStrategyList(strategies);
};

window.renderStrategyList = function(strategies) {
    const list = document.getElementById('strategyList');
    if (!list) return;

    if (strategies.length === 0) {
        list.innerHTML = `
            <div class="text-center py-8 opacity-50">
                <div class="text-4xl mb-2">📂</div>
                <div class="text-sm">No saved strategies found.</div>
            </div>`;
        return;
    }

    // מיון לפי תאריך (החדש ביותר למעלה)
    strategies.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    list.innerHTML = strategies.map((s, index) => `
        <div class="bg-navy-800 p-3 rounded border border-gray-700 flex justify-between items-center mb-2 hover:border-ice transition group">
            <div class="flex-1 cursor-pointer" onclick="window.applyStrategy(${index})">
                <div class="font-bold text-white text-sm flex items-center gap-2">
                    ${s.name}
                    ${s.type === 'public' ? '<span class="text-[9px] bg-green-900 text-green-300 px-1 rounded">PUB</span>' : ''}
                </div>
                <div class="text-[10px] text-gray-400 mt-1">
                    📅 ${new Date(s.timestamp).toLocaleString()} | 
                    ⏱️ ${(s.config.duration || 0)}h | 
                    🛑 ${s.config.reqStops || 0} Stops
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="window.applyStrategy(${index})" class="bg-ice/20 text-ice px-3 py-1.5 rounded text-xs font-bold hover:bg-ice/40 transition">Load</button>
                <button onclick="window.deleteStrategy(${index})" class="text-gray-600 hover:text-red-400 text-xs px-2 transition"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
};

window.applyStrategy = function(index) {
    try {
        // שימוש באסטרטגיות שנטענו (מהשרת או מ-localStorage)
        const strategies = window.currentStrategies || JSON.parse(localStorage.getItem('strateger_strategies') || '[]');
        const strategy = strategies[index];
        
        if (!strategy) {
            window.showToast('Strategy not found!', 'error');
            return;
        }

        console.log("Loading strategy:", strategy.name, strategy);

        // 1. שחזור נתונים לזיכרון - כולל כל הנתונים שנשמרו
        window.config = strategy.config || {};
        window.drivers = strategy.drivers || [];
        
        // שחזור ה-timeline המלא
        window.cachedStrategy = { 
            timeline: strategy.timeline || [],
            driverStats: strategy.driverStats || [], 
            config: strategy.config || {}
        };
        
        // בניית נתונים לתצוגה מקדימה - שימוש ב-driverSchedule שנשמר אם קיים
        window.previewData = {
            timeline: strategy.timeline || [],
            driverSchedule: strategy.driverSchedule || [], // שימוש ב-driverSchedule שנשמר
            startTime: new Date() // מתאפס לזמן הנוכחי
        };
        
        // 2. עדכון ה-UI (אינפוטים) - כל השדות
        if (strategy.config) {
            const setVal = (id, val) => { 
                const el = document.getElementById(id); 
                if (el && val !== undefined && val !== null) el.value = val; 
            };
            
            setVal('raceDuration', strategy.config.duration);
            setVal('reqPitStops', strategy.config.reqStops);
            setVal('minStint', strategy.config.minStint);
            setVal('maxStint', strategy.config.maxStint);
            setVal('minPitTime', strategy.config.pitTime);
            setVal('releaseBuffer', strategy.config.buffer);
            setVal('closedStart', strategy.config.closedStart);
            setVal('closedEnd', strategy.config.closedEnd);
            setVal('minDriverTotal', strategy.config.minDriverTotal);
            setVal('maxDriverTotal', strategy.config.maxDriverTotal);
            setVal('fuelTime', strategy.config.fuel);
            
            // עדכון צ'קבוקסים
            const setCheck = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.checked = !!val;
            };
            setCheck('allowDouble', strategy.config.allowDouble);
            const numSquadsEl = document.getElementById('numSquads');
            if (numSquadsEl) numSquadsEl.value = String(strategy.config.numSquads || (strategy.config.useSquads ? 2 : 0));
        }

        // 3. בניית רשימת הנהגים מחדש ב-UI
        const driversList = document.getElementById('driversList');
        if (driversList) {
            driversList.innerHTML = ''; // ניקוי
            if (strategy.drivers && strategy.drivers.length > 0) {
                strategy.drivers.forEach((d, i) => {
                    // שימוש בפונקציה הקיימת ליצירת שדה
                    window.createDriverInput(d.name, d.isStarter, d.squad);
                });
            }
        }

        // 4. אם יש driverSchedule שנשמר, נשתמש בו; אחרת נחשב מחדש
        if (strategy.driverSchedule && strategy.driverSchedule.length > 0) {
            // יש לנו driverSchedule שנשמר - נשתמש בו
            window.previewData.driverSchedule = strategy.driverSchedule;
        } else if (strategy.timeline && strategy.timeline.length > 0) {
            // אין driverSchedule שנשמר - נחשב מחדש מה-timeline
            window.recalculateDriverStatsFromTimeline();
        }
        
        window.closeStrategyModal();
        
        // הקפצת Preview
        window.generatePreview(false, true); 
        
        window.showToast(`✅ Strategy "${strategy.name}" loaded!`, 'success');

    } catch (e) {
        console.error("Error applying strategy:", e);
        window.showToast('Failed to load strategy: ' + e.message, 'error');
    }
};

window.deleteStrategy = function(index) {
    window.showConfirmModal(
        '🗑️ Delete Strategy',
        'This action cannot be undone.',
        'Delete permanently?',
        () => {
            try {
                const strategies = JSON.parse(localStorage.getItem('strateger_strategies') || '[]');
                strategies.splice(index, 1);
                localStorage.setItem('strateger_strategies', JSON.stringify(strategies));
                window.loadStrategyLibrary();
            } catch (e) {
                console.error(e);
            }
        }
    );
};

window.closeStrategyModal = function() {
    const modal = document.getElementById('strategyModal');
    if (modal) modal.classList.add('hidden');
};

// ==========================================
// 🛡️ VIEWER RESTRICTIONS
// ==========================================
window.enforceViewerMode = function() {
    if (window.role !== 'client') return;

    console.log("🔒 Enforcing Viewer Read-Only Mode");

    // Buttons that should be VISIBLE but DISABLED (view-only indicators)
    const viewOnlySelectors = ['#btnPush', '#btnBad', '#btnResetMode'];
    viewOnlySelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            el.disabled = true;
            el.style.pointerEvents = 'none';
            el.classList.add('opacity-60', 'cursor-not-allowed');
            el.removeAttribute('onclick');
            el.dataset.viewerDisabled = 'true';
        });
    });

    // Elements that should be completely HIDDEN for viewers
    const hideSelectors = [
        '#pitEntryBtn', 
        '#btnRain',
        '.starter-radio',
        '#addDriverBtn',
        '.penalty-btn',
        '#penaltyBtnMinus5',
        '#penaltyBtnPlus5',
        '#penaltyBtnPlus10',
        'input',
        'select',
        'button.btn-press'
    ];

    hideSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            // Don't hide chat, push/problem (view-only), or google sign-in
            if (el.closest('#chatPanel') || el.closest('#chatToggleBtn') || el.id === 'googleSignInBtn') return;
            if (el.dataset.viewerDisabled === 'true') return; // Already handled as view-only
            
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                el.disabled = true;
                el.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                el.classList.add('hidden');
            }
        });
    });

    // 🟢 Show penalty display and next driver info for viewers (read-only)
    const nextDriver = document.getElementById('nextDriverName');
    if (nextDriver) nextDriver.classList.remove('hidden');
    
    const penaltyDisplay = document.getElementById('dashboardPitAdjDisplay');
    if (penaltyDisplay) penaltyDisplay.classList.remove('hidden');

    // Hide driver link button for viewers (host-only feature)
    const driverLinkBtn = document.getElementById('driverLinkBtn');
    if (driverLinkBtn) driverLinkBtn.classList.add('hidden');

    // וידוא שהצ'אט זמין (לא במצב נהג)
    if (!window._autoDriverMode) {
        document.getElementById('chatToggleBtn').classList.remove('hidden');
    }
};

// ==========================================
// 💬 CHAT SYSTEM
// ==========================================
window.chatUnread = 0;

// Helper: update chat input placeholder based on role
window.updateChatPlaceholder = function() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    if (window.role === 'host') {
        input.placeholder = 'Message to viewers...';
    } else {
        input.placeholder = 'Send to Admin...';
    }
};

// Enter key support for chat inputs
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        if (e.target.id === 'chatInput') {
            e.preventDefault();
            window.sendChatMessage();
        } else if (e.target.id === 'chatUserName') {
            e.preventDefault();
            window.joinChat();
        }
    }
});

// === FIX: Consolidated toggleChat function (removes originalToggleChat dependency) ===
window.toggleChat = function() {
    const panel = document.getElementById('chatPanel');
    const badge = document.getElementById('chatUnreadBadge');
    const feed = document.getElementById('chatFeed');

    // 1. Load history if empty (First open)
    if (panel.classList.contains('hidden') && feed.children.length === 0) {
        try {
            const history = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
            history.forEach(msg => window.renderChatMessage(msg));
        } catch(e) { console.error("Error loading chat history:", e); }
    }

    // 2. Toggle Visibility
    panel.classList.toggle('hidden');

    // 3. Handle Unread Badge & View State
    if (!panel.classList.contains('hidden')) {
        window.chatUnread = 0;
        if (badge) {
            badge.innerText = '0';
            badge.classList.add('hidden');
        }
        
        // HOST: auto-join as ADMIN with team name (skip login screen)
        if (window.role === 'host' && !localStorage.getItem('strateger_chat_name')) {
            const teamName = window.searchConfig?.teamName || window.searchConfig?.driverName || 'Admin';
            localStorage.setItem('strateger_chat_name', teamName);
        }

        // If user already entered name, go straight to messages
        const savedName = localStorage.getItem('strateger_chat_name');
        if (savedName) {
            document.getElementById('chatLoginView').classList.add('hidden');
            document.getElementById('chatMessagesView').classList.remove('hidden');
            document.getElementById('chatMessagesView').classList.add('flex');

            // Show viewer selector for host
            if (window.role === 'host') {
                const selector = document.getElementById('chatViewerSelector');
                if (selector) selector.classList.remove('hidden');
            }

            // Update placeholder based on role
            window.updateChatPlaceholder();
            
            // 🟢 Load chat history for continuing races
            if (feed.children.length === 0) {
                try {
                    const history = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
                    history.forEach(msg => window.renderChatMessage(msg));
                } catch(e) { console.error("Error loading chat history:", e); }
            }
        } else if (window.role === 'host') {
            // Edge case: no saved name yet, pre-fill the input for host
            const chatInput = document.getElementById('chatUserName');
            const teamName = window.searchConfig?.teamName || window.searchConfig?.driverName || '';
            if (chatInput && teamName) chatInput.value = teamName;
        } else {
            // Pre-fill chat name from viewer approval name if available
            const viewerName = localStorage.getItem('strateger_viewer_name');
            if (viewerName) {
                const chatInput = document.getElementById('chatUserName');
                if (chatInput) chatInput.value = viewerName;
            }
        }
    }
};

window.joinChat = function() {
    let name = document.getElementById('chatUserName').value.trim();
    
    // For host: use team name as chat name, fallback to input
    if (window.role === 'host') {
        if (!name) {
            name = window.searchConfig?.teamName || window.searchConfig?.driverName || 'Admin';
        }
        localStorage.setItem('strateger_chat_name', name);
        document.getElementById('chatLoginView').classList.add('hidden');
        document.getElementById('chatMessagesView').classList.remove('hidden');
        document.getElementById('chatMessagesView').classList.add('flex');
        
        // Show viewer selector for host
        document.getElementById('chatViewerSelector').classList.remove('hidden');
        window.updateChatPlaceholder();
        
        // Ensure chat panel is visible & load history
        const panel = document.getElementById('chatPanel');
        if (panel.classList.contains('hidden')) {
            panel.classList.remove('hidden');
            const feed = document.getElementById('chatFeed');
            if (feed.children.length === 0) {
                try {
                    const history = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
                    history.forEach(msg => window.renderChatMessage(msg));
                } catch(e) { console.error("Error loading chat history:", e); }
            }
        }
        return;
    }

    // === Viewer flow ===
    if (!name) {
        // Try to use the approved viewer name
        name = localStorage.getItem('strateger_viewer_name') || localStorage.getItem('strateger_chat_name');
    }
    if (!name) return window.showToast('Name required', 'warning');
    
    // If viewer is already approved, skip approval request — go straight to chat
    if (window.viewerApprovalStatus === 'approved') {
        localStorage.setItem('strateger_chat_name', name);
        if (window.conn && window.conn.open) {
            try { window.conn.send({ type: 'SET_NAME', name: name }); } catch(e) {}
        }
        document.getElementById('chatLoginView').classList.add('hidden');
        document.getElementById('chatMessagesView').classList.remove('hidden');
        document.getElementById('chatMessagesView').classList.add('flex');
        window.updateChatPlaceholder();
        const feed = document.getElementById('chatFeed');
        if (feed && feed.children.length === 0) {
            try {
                const history = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
                history.forEach(msg => window.renderChatMessage(msg));
            } catch(e) {}
        }
        return;
    }
    
    // Clear previous join errors
    const joinErr = document.getElementById('chatJoinError');
    if (joinErr) { joinErr.classList.add('hidden'); joinErr.innerText = ''; }

    // Store temporarily so we can retry if connection opens later
    window.pendingChatName = name;
    // Request approval from host
    window.requestViewerApproval(name);
    
    // Show waiting message
    if (joinErr) { 
        joinErr.classList.remove('hidden'); 
        joinErr.innerText = 'Requesting approval from host...'; 
    }
};

// Called when the host accepts the viewer's name
window.onNameAccepted = function(name) {
    try { localStorage.setItem('strateger_chat_name', name); } catch (e) { console.error('failed storing name', e); }
    window.pendingChatName = null;
    const joinErr = document.getElementById('chatJoinError');
    if (joinErr) { joinErr.classList.add('hidden'); joinErr.innerText = ''; }

    document.getElementById('chatLoginView').classList.add('hidden');
    document.getElementById('chatMessagesView').classList.remove('hidden');
    document.getElementById('chatMessagesView').classList.add('flex');

    // Update host's dropdown to include this viewer
    if (typeof window.updateViewerDropdown === 'function') {
        window.updateViewerDropdown();
    }

    // Show chat panel and load history
    const panel = document.getElementById('chatPanel');
    if (panel.classList.contains('hidden')) panel.classList.remove('hidden');
    const feed = document.getElementById('chatFeed');
    if (feed.children.length === 0) {
        try {
            const history = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
            history.forEach(msg => window.renderChatMessage(msg));
        } catch(e) { console.error('Error loading chat history:', e); }
    }
};

// Called when the host rejects the viewer's name
window.onNameRejected = function(message) {
    const joinErr = document.getElementById('chatJoinError');
    if (joinErr) { joinErr.classList.remove('hidden'); joinErr.innerText = message || 'Name rejected by host'; }
    // Keep the login view visible so the user can choose a new name
    document.getElementById('chatLoginView').classList.remove('hidden');
    if (window.role === 'client') {
        // Allow user to try again
        window.pendingChatName = null;
    }
};

// Called when the host rejects the viewer's approval request
window.onApprovalRejected = function(message) {
    const joinErr = document.getElementById('chatJoinError');
    if (joinErr) { 
        joinErr.classList.remove('hidden'); 
        joinErr.innerText = message || window.t('approvalRejected'); 
    }
    // Keep the login view visible so the user can choose a new name
    document.getElementById('chatLoginView').classList.remove('hidden');
    if (window.role === 'client') {
        // Allow user to try again
        window.pendingChatName = null;
    }
};

// Auto-join chat with Google name if available
window.autoJoinChatWithGoogle = function() {
    // Check if Google user is logged in and has a name
    const googleUser = window.googleUser || JSON.parse(localStorage.getItem('strateger_google_user') || 'null');
    if (googleUser && googleUser.name) {
        const chatInput = document.getElementById('chatUserName');
        if (chatInput) {
            chatInput.value = googleUser.name;
        }
        // Auto-join if viewer is already connected
        if (window.role === 'client' && window.conn && window.conn.open) {
            console.log(`Auto-joining chat as ${googleUser.name}`);
            window.joinChat();
        }
    }
};

// Skip chat and just watch race
window.skipChat = function() {
    // Hide the chat login view
    document.getElementById('chatLoginView').classList.add('hidden');
    document.getElementById('chatMessagesView').classList.remove('hidden');
    document.getElementById('chatMessagesView').classList.add('flex');
    
    // Hide the chat input/message areas for watchers-only
    const chatInput = document.querySelector('.p-2.bg-navy-800.border-t.border-gray-700');
    const chatReplyContext = document.getElementById('chatReplyContext');
    const chatViewerSelector = document.getElementById('chatViewerSelector');
    
    if (chatInput) chatInput.classList.add('hidden');
    if (chatReplyContext) chatReplyContext.classList.add('hidden');
    if (chatViewerSelector) chatViewerSelector.classList.add('hidden');
    
    // Show a watcher indicator
    const feed = document.getElementById('chatFeed');
    const indicator = document.createElement('div');
    indicator.className = 'text-center text-gray-500 text-[10px] py-4';
    indicator.innerHTML = '👁️ You are watching (Chat disabled)';
    feed.appendChild(indicator);
};

window.replyToMessageId = null;

window.setReplyContext = function(msgTimestamp, sender, text) {
    window.replyToMessageId = msgTimestamp;
    const ctxEl = document.getElementById('chatReplyContext');
    if (ctxEl) {
        document.getElementById('replyContextSender').innerText = sender;
        document.getElementById('replyContextText').innerText = text.substring(0, 80) + (text.length > 80 ? '...' : '');
        ctxEl.classList.remove('hidden');
    }

    // Auto-select viewer in dropdown when admin replies to a viewer's message
    if (window.role === 'host') {
        const select = document.getElementById('chatRecipientSelect');
        if (select) {
            // Find the viewer by name in connected viewers
            let found = false;
            window.connectedViewers.forEach((conn, peerId) => {
                if (conn.viewerName === sender) {
                    select.value = peerId;
                    found = true;
                }
            });
            // If replying to own message or unknown, keep current selection
        }
    }

    // Focus the input
    const input = document.getElementById('chatInput');
    if (input) input.focus();
};

window.clearReplyContext = function() {
    window.replyToMessageId = null;
    const ctxEl = document.getElementById('chatReplyContext');
    if (ctxEl) ctxEl.classList.add('hidden');
};

window.sendChatMessage = function() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    const name = localStorage.getItem('strateger_chat_name') || 'Viewer';
    
    if (!text) return;

    if (window.role === 'host') {
        // === ADMIN: can send to all or specific viewer ===
        const select = document.getElementById('chatRecipientSelect');
        let recipient = select ? select.value : 'broadcast';
        if (recipient === 'broadcast') recipient = null; // null = broadcast to all

        const msgData = {
            type: 'CHAT',
            sender: name,
            text: text,
            role: 'host',
            recipient: recipient,
            replyTo: window.replyToMessageId || null,
            timestamp: Date.now()
        };

        // Send via broadcast (handles routing to all or specific viewer)
        window.broadcast(msgData);
        // Render locally for admin
        window.renderChatMessage(msgData);
    } else {
        // === VIEWER: always sends to admin only ===
        const msgData = {
            type: 'CHAT',
            sender: name,
            text: text,
            role: 'viewer',
            recipient: null, // Will be routed to admin on host side
            replyTo: window.replyToMessageId || null,
            timestamp: Date.now()
        };

        if (window.conn && window.conn.open) {
            window.conn.send(msgData);
        }
        // Render locally for the viewer
        window.renderChatMessage(msgData);
    }

    input.value = '';
    window.clearReplyContext();
};

window.renderChatMessage = function(msg) {
    const feed = document.getElementById('chatFeed');
    if (!feed) return;
    
    // 🟢 MESSAGE FILTERING:
    // - Host (ADMIN) sees ALL messages
    // - Viewers see: broadcasts from admin, private messages TO them, and their own messages
    if (msg.recipient && msg.recipient !== 'broadcast') {
        if (window.role !== 'host') {
            const myName = localStorage.getItem('strateger_chat_name');
            const myPeerId = window.myId || localStorage.getItem('strateger_client_id');
            // Viewer only sees private messages addressed to them (by peerId or by name)
            const isForMe = msg.recipient === myPeerId || msg.recipient === myName;
            const isFromMe = msg.sender === myName;
            if (!isForMe && !isFromMe) {
                return;
            }
        }
    }
    
    // Prevent duplicate rendering
    const lastMsg = feed.lastElementChild;
    if (lastMsg && lastMsg.dataset.ts == msg.timestamp && lastMsg.innerText.includes(msg.text)) {
        return;
    }

    const div = document.createElement('div');
    div.dataset.ts = msg.timestamp; 
    
    const myName = localStorage.getItem('strateger_chat_name') || 'Viewer';
    const isMe = msg.sender === myName;
    const isAdmin = msg.role === 'host';
    const isPrivate = msg.recipient && msg.recipient !== 'broadcast';
    
    let bgClass = 'bg-navy-800';
    let alignClass = 'items-start';
    
    if (isAdmin) {
        bgClass = isPrivate ? 'bg-yellow-900/40 border border-yellow-500/30' : 'bg-red-900/40 border border-red-500/30';
    } else if (isMe) {
        bgClass = 'bg-blue-900/40 border border-blue-500/30';
        alignClass = 'items-end';
    }

    // Role badge
    const roleBadge = isAdmin 
        ? '<span class="bg-red-600 text-white text-[8px] px-1.5 py-0.5 rounded font-bold ml-1">ADMIN</span>' 
        : '';
    // Private indicator
    const privateIndicator = isPrivate ? '<span class="text-yellow-400 font-bold text-[10px]">🔒 DM</span>' : '';

    // Build reply context
    let replyHTML = '';
    if (msg.replyTo) {
        const history = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
        const original = history.find(m => m.timestamp === msg.replyTo);
        if (original) {
            replyHTML = `<div class="bg-navy-900/60 border-l-2 border-blue-400 pl-2 mb-2 text-[9px] text-gray-300">
                <div class="font-bold text-blue-400">${original.sender}${original.role === 'host' ? ' 👑' : ''}</div>
                <div>${original.text.substring(0, 60)}${original.text.length > 60 ? '...' : ''}</div>
            </div>`;
        }
    }

    // Sanitize text for safe embedding in onclick
    const safeSender = msg.sender.replace(/'/g, '\\\'').replace(/"/g, '&quot;');
    const safeText = msg.text.replace(/'/g, '\\\'').replace(/"/g, '&quot;').replace(/\n/g, ' ');

    div.className = `flex flex-col ${alignClass} mb-2`;
    div.innerHTML = `
        <div class="${bgClass} p-2 rounded-lg max-w-[90%]">
            ${replyHTML}
            <div class="flex justify-between items-baseline gap-2 mb-1">
                <span class="font-bold ${isAdmin ? (isPrivate ? 'text-yellow-400' : 'text-red-400') : 'text-ice'} text-[10px]">
                    ${isAdmin ? '👑 ' : ''}${msg.sender}${roleBadge}
                </span>
                ${privateIndicator}
                <span class="text-[9px] text-gray-500">${new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
            <div class="text-white break-words">${msg.text}</div>
            <button onclick="window.setReplyContext(${msg.timestamp}, '${safeSender}', '${safeText}')" class="text-[9px] text-blue-400 hover:text-blue-300 mt-1 text-left">↳ Reply</button>
        </div>
    `;
    
    feed.appendChild(div);
    feed.scrollTop = feed.scrollHeight;

    // --- Save to LocalStorage ---
    try {
        let history = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
        const exists = history.some(m => m.timestamp === msg.timestamp && m.text === msg.text);
        if (!exists) {
            history.push(msg);
            if (history.length > 100) history.shift(); 
            localStorage.setItem('strateger_chat_history', JSON.stringify(history));
        }
    } catch(e) { console.error("Chat save error", e); }

    // Unread badge logic
    const panel = document.getElementById('chatPanel');
    if (panel.classList.contains('hidden')) {
        window.chatUnread++;
        const badge = document.getElementById('chatUnreadBadge');
        badge.innerText = window.chatUnread;
        badge.classList.remove('hidden');
    }
};

// ==========================================
// 📍 VENUE LOCATION + WEATHER
// ==========================================

const _VENUE_ALIASES = {
    'buckmore park': 'Buckmore Park, Sittingbourne, UK',
    'buckmore': 'Buckmore Park, Sittingbourne, UK',
    'silverstone': 'Silverstone Circuit, UK',
    'brands hatch': 'Brands Hatch, Sevenoaks, UK',
    'donington': 'Donington Park, Leicestershire, UK',
    'knockhill': 'Knockhill Racing Circuit, Scotland, UK',
    'snetterton': 'Snetterton Circuit, Norfolk, UK',
    'oulton park': 'Oulton Park, Cheshire, UK',
    'spa': 'Spa-Francorchamps, Belgium',
    'spa francorchamps': 'Spa-Francorchamps, Belgium',
    'le mans': 'Le Mans, France',
    'circuit de la sarthe': 'Le Mans, France',
    'paul ricard': 'Circuit Paul Ricard, Le Castellet, France',
    'nurburgring': 'Nürburg, Germany',
    'nordschleife': 'Nürburg, Germany',
    'hockenheim': 'Hockenheimring, Germany',
    'lausitzring': 'Lausitzring, Germany',
    'monza': 'Monza, Italy',
    'mugello': 'Scarperia, Italy',
    'imola': 'Imola, Italy',
    'misano': 'Misano Adriatico, Italy',
    'vallelunga': 'Campagnano di Roma, Italy',
    'lignano circuit': 'Lignano Sabbiadoro, Italy',
    'lignano': 'Lignano Sabbiadoro, Italy',
    'barcelona': 'Circuit de Barcelona-Catalunya, Montmeló, Spain',
    'montmelo': 'Montmeló, Spain',
    'valencia': 'Valencia, Spain',
    'jerez': 'Jerez de la Frontera, Spain',
    'portimao': 'Portimão, Portugal',
    'estoril': 'Estoril, Portugal',
    'dubai autodrome': 'Dubai Autodrome, Dubai, UAE',
    'dubai': 'Dubai, UAE',
    'yas marina': 'Yas Marina Circuit, Abu Dhabi, UAE',
    'abu dhabi': 'Abu Dhabi, UAE',
    'bahrain': 'Bahrain International Circuit, Sakhir, Bahrain',
    'daytona': 'Daytona International Speedway, Florida, USA',
    'sebring': 'Sebring International Raceway, Florida, USA',
    'laguna seca': 'Weathertech Raceway Laguna Seca, California, USA',
    'road atlanta': 'Road Atlanta, Braselton, Georgia, USA',
    'watkins glen': 'Watkins Glen International, New York, USA',
    'cota': 'Circuit of the Americas, Austin, Texas, USA',
    'interlagos': 'Autódromo José Carlos Pace, São Paulo, Brazil',
    'suzuka': 'Suzuka Circuit, Japan',
    'fuji': 'Fuji Speedway, Japan',
    'sepang': 'Sepang International Circuit, Malaysia',
    'bathurst': 'Mount Panorama Circuit, Bathurst, Australia',
    'tivoli': 'Tivoli Racing Park, Israel',
    'tivoli racing': 'Tivoli Racing Park, Israel',
};

function findBestVenueAlias(input) {
    const normalized = input.toLowerCase();
    if (_VENUE_ALIASES[normalized]) return _VENUE_ALIASES[normalized];
    const inputTokens = normalized.split(/\s+/).filter(t => t.length > 2);
    let bestMatch = null;
    let bestScore = 0;
    for (const [key, fullName] of Object.entries(_VENUE_ALIASES)) {
        const keyTokens = key.split(/\s+/);
        const matchedTokens = inputTokens.filter(t => keyTokens.some(k => k.startsWith(t) || t.startsWith(k)));
        const score = matchedTokens.length / Math.max(keyTokens.length, inputTokens.length);
        if (score > bestScore) { bestScore = score; bestMatch = { alias: fullName, score }; }
    }
    return bestScore > 0.5 ? bestMatch.alias : null;
}

window._venueWeather = { key: '', status: 'idle', fetchedAt: 0, data: null, resolvedName: '' };
window._venueWeatherInFlight = false;
window._locationSearchTimer = null;
window._locationAutocompleteResults = [];
window._selectedVenueLocation = null;
window._showWeatherInStints = window._showWeatherInStints !== false;
window._weatherCodeMap = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
    45: 'Fog', 48: 'Rime fog', 51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Heavy freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
    80: 'Rain showers', 81: 'Showers', 82: 'Violent showers',
    95: 'Thunderstorm', 96: 'Storm + hail', 99: 'Severe storm + hail'
};

window.formatVenueShortName = function(place) {
    if (!place) return '';
    const rawName = String(place.name || '').trim();
    const name = rawName.split(',')[0].trim();
    if (name) return name;
    const fallbackParts = String(place.displayName || '').split(',').map(p => p.trim()).filter(Boolean);
    return fallbackParts[0] || '';
};

window.getVenueForecastAt = function(targetMs) {
    const weather = window._venueWeather;
    const hourly = weather?.data?.hourly;
    if (weather?.status !== 'ready' || !hourly || !Array.isArray(hourly.time) || !hourly.time.length) return null;
    const target = Number(targetMs);
    if (!Number.isFinite(target)) return null;
    let bestIdx = -1, bestDelta = Infinity;
    for (let i = 0; i < hourly.time.length; i++) {
        const slotMs = Date.parse(hourly.time[i]);
        if (!Number.isFinite(slotMs)) continue;
        const delta = Math.abs(slotMs - target);
        if (delta < bestDelta) { bestDelta = delta; bestIdx = i; }
    }
    if (bestIdx < 0) return null;
    return {
        time: hourly.time[bestIdx],
        temp: hourly.temperature_2m?.[bestIdx],
        wind: hourly.wind_speed_10m?.[bestIdx],
        precipitation: hourly.precipitation?.[bestIdx],
        weatherCode: hourly.weather_code?.[bestIdx],
        weatherText: window._weatherCodeMap[hourly.weather_code?.[bestIdx]] || 'Weather'
    };
};

window.formatVenueForecastShort = function(forecast) {
    if (!forecast) return '';
    const temp = Number.isFinite(Number(forecast.temp)) ? `${Math.round(forecast.temp)}°C` : '-';
    const code = forecast.weatherCode;
    let condition = '';
    if (code !== undefined && code !== null) {
        if (code <= 1) condition = 'Sunny';
        else if (code === 2) condition = 'Partly cloudy';
        else if (code <= 48) condition = 'Cloudy';
        else if (code <= 55) condition = 'Light rain';
        else if (code <= 63) condition = 'Light rain';
        else if (code <= 67) condition = 'Heavy rain';
        else if (code <= 77) condition = 'Snow';
        else if (code <= 82) condition = 'Rain showers';
        else condition = 'Storm';
    } else { condition = forecast.weatherText || ''; }
    return condition ? `${temp} · ${condition}` : temp;
};

window.resolveVenueLocation = function(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (window._selectedVenueLocation && String(window._selectedVenueLocation.displayName || '').toLowerCase() === normalized) {
        return window._selectedVenueLocation;
    }
    return window._locationAutocompleteResults.find(p => String(p.displayName || '').toLowerCase() === normalized) || null;
};

window.renderSelectedVenuePreview = function(place) {
    const card = document.getElementById('selectedLocationPreview');
    const nameEl = document.getElementById('selectedLocationName');
    if (!card || !nameEl) return;
    if (!place) { card.classList.add('hidden'); return; }
    nameEl.innerText = window.formatVenueShortName(place);
    card.classList.remove('hidden');
};

window.initVenueLocationPicker = function() {
    const input = document.getElementById('raceLocation');
    if (!input) return;
    const prefilled = String(input.value || '').trim();
    if (!prefilled) return;
    const resolved = window.resolveVenueLocation(prefilled);
    window.renderSelectedVenuePreview(resolved || { displayName: prefilled, name: prefilled, admin1: '', country: '' });
};

window.onLocationInput = function(value) {
    const dropdown = document.getElementById('locationSuggestions');
    const spinner = document.getElementById('locationSearchSpinner');
    if (!dropdown) return;
    const query = value.trim();
    if (query.length < 2) {
        dropdown.classList.add('hidden');
        if (spinner) spinner.classList.add('hidden');
        clearTimeout(window._locationSearchTimer);
        return;
    }
    clearTimeout(window._locationSearchTimer);
    if (spinner) spinner.classList.remove('hidden');
    window._locationSearchTimer = setTimeout(async () => {
        try {
            const qLower = query.toLowerCase();
            const aliasMatches = Object.entries(_VENUE_ALIASES)
                .filter(([key]) => key.includes(qLower) || qLower.includes(key))
                .map(([key, fullName]) => ({ _isTrack: true, name: fullName.split(',')[0].trim(), trackLabel: fullName, displayName: fullName, admin1: '', country: fullName.split(',').slice(1).join(',').trim() }))
                .slice(0, 4);
            const geoQuery = findBestVenueAlias(query) || query;
            const [meteoResults, nominatimResults] = await Promise.all([
                (async () => {
                    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(geoQuery)}&count=8&language=en&format=json`);
                    const json = await res.json();
                    return Array.isArray(json.results) ? json.results : [];
                })().catch(() => []),
                (async () => {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(geoQuery)}&limit=8&addressdetails=1`, { headers: { 'Accept': 'application/json', 'User-Agent': 'Strateger/1.0' } });
                    if (!res.ok) return [];
                    const json = await res.json();
                    return Array.isArray(json) ? json : [];
                })().catch(() => [])
            ]);
            const fromMeteo = meteoResults.map(r => ({ name: r.name, admin1: r.admin1 || '', country: r.country || '', lat: r.latitude, lon: r.longitude, displayName: [r.name, r.country].filter(Boolean).join(', ') }));
            const fromNominatim = nominatimResults.map(r => ({ name: (r.display_name || '').split(',')[0] || r.name || query, admin1: r.address?.state || r.address?.county || '', country: r.address?.country || '', lat: Number(r.lat), lon: Number(r.lon), displayName: [(r.display_name || '').split(',')[0] || r.name || query, r.address?.country || ''].filter(Boolean).join(', ') }));
            const seen = new Set();
            aliasMatches.forEach(a => seen.add(a.trackLabel.toLowerCase()));
            const geoResults = [...fromMeteo, ...fromNominatim].filter(r => {
                const key = `${String(r.displayName || '').toLowerCase()}|${Number(r.lat).toFixed(4)}|${Number(r.lon).toFixed(4)}`;
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            }).slice(0, 10);
            const results = [...aliasMatches, ...geoResults].slice(0, 12);
            if (spinner) spinner.classList.add('hidden');
            if (!results.length) {
                dropdown.innerHTML = `<div class="px-3 py-2.5 text-[11px] text-gray-500">No locations found</div>`;
                dropdown.classList.remove('hidden');
                return;
            }
            window._locationAutocompleteResults = results;
            dropdown.innerHTML = results.map((place, i) => {
                const icon = place._isTrack ? '🏁' : '📍';
                const sub = place._isTrack ? `<span class="text-blue-400 text-[10px] ml-1">Racing circuit</span>` : (place.country ? `<span class="text-gray-400 text-xs ml-1">${place.country}</span>` : '');
                return `<div class="px-3 py-2.5 cursor-pointer hover:bg-navy-800 border-b border-gray-700/40 last:border-0 flex items-center gap-2" onmousedown="window.selectLocationSuggestion(${i})"><span class="text-sm shrink-0">${icon}</span><span class="min-w-0"><span class="font-bold text-white text-sm break-words whitespace-normal">${place.name}</span>${sub}</span></div>`;
            }).join('');
            dropdown.classList.remove('hidden');
        } catch (err) {
            if (spinner) spinner.classList.add('hidden');
            console.warn('[location-autocomplete] fetch failed:', err);
        }
    }, 350);
};

window.selectLocationSuggestion = function(idx) {
    const place = window._locationAutocompleteResults[idx];
    if (!place) return;
    const fullName = place._isTrack ? place.trackLabel : window.formatVenueShortName(place);
    const input = document.getElementById('raceLocation');
    if (input) input.value = fullName;
    const dropdown = document.getElementById('locationSuggestions');
    if (dropdown) dropdown.classList.add('hidden');
    window._selectedVenueLocation = place;
    window.renderSelectedVenuePreview(place);
    if (typeof window.syncRaceLocation === 'function') window.syncRaceLocation(fullName);
    if (typeof window.runSim === 'function') window.runSim();
};

window.refreshVenueWeather = async function(rawLocation, selectedPlace) {
    const input = String(rawLocation || '').trim();
    if (!input) return;
    const normalized = input.toLowerCase();
    const fuzzyMatch = findBestVenueAlias(input);
    const query = fuzzyMatch || _VENUE_ALIASES[normalized] || input;
    const cacheFreshMs = 10 * 60 * 1000;
    const hasHourlyCache = Array.isArray(window._venueWeather?.data?.hourly?.time) && window._venueWeather.data.hourly.time.length > 0;
    if (window._venueWeather.key === query && (Date.now() - window._venueWeather.fetchedAt) < cacheFreshMs && hasHourlyCache) return;
    if (window._venueWeatherInFlight) return;
    window._venueWeatherInFlight = true;
    window._venueWeather = { key: query, status: 'loading', fetchedAt: Date.now(), data: null, resolvedName: '' };
    try {
        let best = selectedPlace || window.resolveVenueLocation(input);
        if (!best || !Number.isFinite(Number(best.lat)) || !Number.isFinite(Number(best.lon))) {
            const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`, { cache: 'no-store' });
            const geo = await geoRes.json();
            const geoBest = Array.isArray(geo.results) ? geo.results[0] : null;
            if (!geoBest) throw new Error('Location not found');
            best = { name: geoBest.name, admin1: geoBest.admin1 || '', country: geoBest.country || '', lat: geoBest.latitude, lon: geoBest.longitude, displayName: [geoBest.name, geoBest.country].filter(Boolean).join(', ') };
        }
        const lat = Number(best.lat);
        const lon = Number(best.lon);
        const resolvedName = window.formatVenueShortName(best);
        window._selectedVenueLocation = best;
        window.renderSelectedVenuePreview(best);
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&hourly=temperature_2m,wind_speed_10m,precipitation,weather_code&forecast_days=7&timezone=auto`, { cache: 'no-store' });
        const weather = await weatherRes.json();
        const current = weather.current || {};
        window._venueWeather = {
            key: query, status: 'ready', fetchedAt: Date.now(), resolvedName,
            data: { temp: current.temperature_2m, wind: current.wind_speed_10m, precipitation: current.precipitation, weatherText: window._weatherCodeMap[current.weather_code] || 'Weather unavailable', hourly: weather.hourly || null }
        };
    } catch (err) {
        console.warn('[venue-weather] failed:', err?.message || err);
        window._venueWeather = { key: query, status: 'error', fetchedAt: Date.now(), data: null, resolvedName: '' };
    } finally {
        window._venueWeatherInFlight = false;
        if (!document.getElementById('previewScreen')?.classList.contains('hidden')) {
            if (typeof window.renderPreview === 'function') window.renderPreview();
        }
    }
};

// ==========================================
// ↕ DASHBOARD PANEL RESIZER (drag divider)
// ==========================================

window.initDashPanelResizer = function() {
    const resizer = document.getElementById('dashPanelResizer');
    const wrapper = document.getElementById('racePanelsWrapper');
    const infoPanel = document.getElementById('raceInfoPanel');
    if (!resizer || !wrapper || !infoPanel) return;

    const STORAGE_KEY = 'strateger_dash_split';
    const isLandscape = () => window.matchMedia('(min-width:768px) and (orientation:landscape)').matches;

    // Restore saved split
    const saved = parseFloat(localStorage.getItem(STORAGE_KEY));
    const initialPct = (saved >= 15 && saved <= 85) ? saved : 60;
    document.documentElement.style.setProperty('--dash-info-pct', initialPct + '%');

    let dragging = false;
    let startPos = 0;
    let startPct = initialPct;

    function getPct(e) {
        const rect = wrapper.getBoundingClientRect();
        if (isLandscape()) {
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            return Math.min(85, Math.max(15, ((clientX - rect.left) / rect.width) * 100));
        } else {
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            return Math.min(85, Math.max(15, ((clientY - rect.top) / rect.height) * 100));
        }
    }

    function applyPct(pct) {
        document.documentElement.style.setProperty('--dash-info-pct', pct + '%');
        try { localStorage.setItem(STORAGE_KEY, pct); } catch(e) {}
    }

    function onMove(e) {
        if (!dragging) return;
        applyPct(getPct(e));
        e.preventDefault();
    }
    function onEnd() {
        if (!dragging) return;
        dragging = false;
        resizer.classList.remove('active');
        // Detach global move listeners when drag ends so they don't block scroll elsewhere
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchend', onEnd);
    }
    function onStart(e) {
        dragging = true;
        resizer.classList.add('active');
        startPct = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dash-info-pct')) || 60;
        e.preventDefault();
        // Attach global move/end only for the duration of this drag
        window.addEventListener('mousemove', onMove);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchend', onEnd);
    }

    resizer.addEventListener('mousedown', onStart);
    resizer.addEventListener('touchstart', onStart, { passive: false });

    // Double-tap / double-click to reset to 50/50
    let lastTap = 0;
    resizer.addEventListener('dblclick', () => applyPct(50));
    resizer.addEventListener('touchend', () => {
        const now = Date.now();
        if (now - lastTap < 350) applyPct(50);
        lastTap = now;
    });
};

// ==========================================
// 🖐️ DASHBOARD PANEL DRAG-TO-REORDER + HORIZONTAL PANELS
// ==========================================

window.initDashboardDrag = function() {
    // Support both dashboardScrollArea (Streger) and raceInfoPanel (Strateger)
    const area = document.getElementById('dashboardScrollArea') || document.getElementById('raceInfoPanel');
    if (!area) return;
    // Keep the active drag container so handlers always target the correct window/layout.
    window._dashDragArea = area;

    // Mark direct child panels as draggable
    const markDraggable = () => {
        Array.from(area.children).forEach(child => {
            if (child.id === 'strategyToastContainer') return; // skip toasts
            if (child.tagName === 'DIV' && !child.classList.contains('drag-handle-added')) {
                child.setAttribute('draggable', 'true');
                child.classList.add('drag-handle-added');
                child.style.cursor = 'grab';
                child.addEventListener('dragstart', _onDashPanelDragStart);
                child.addEventListener('dragover', _onDashPanelDragOver);
                child.addEventListener('drop', _onDashPanelDrop);
                child.addEventListener('dragend', _onDashPanelDragEnd);

                // Touch support via long-press
                let touchTimer;
                child.addEventListener('touchstart', (e) => {
                    touchTimer = setTimeout(() => {
                        window._dashDragging = child;
                        child.style.opacity = '0.5';
                    }, 400);
                }, { passive: true });
                child.addEventListener('touchmove', (e) => {
                    if (!window._dashDragging) return;
                    const t = e.touches[0];
                    const activeArea = window._dashDragArea || area;
                    const target = document
                        .elementFromPoint(t.clientX, t.clientY)
                        ?.closest(`#${activeArea.id} > div`);
                    if (target && target !== window._dashDragging) {
                        const rect = target.getBoundingClientRect();
                        const after = t.clientY > rect.top + rect.height / 2;
                        activeArea.insertBefore(window._dashDragging, after ? target.nextSibling : target);
                    }
                }, { passive: true });
                child.addEventListener('touchend', () => {
                    clearTimeout(touchTimer);
                    if (window._dashDragging) {
                        window._dashDragging.style.opacity = '';
                        window._dashDragging = null;
                        window._saveDashboardOrder();
                    }
                });
            }
        });
    };

    markDraggable();
    // Re-mark when panels appear (live timing etc)
    new MutationObserver(markDraggable).observe(area, { childList: true });

    // Restore saved order
    window._restoreDashboardOrder();
};

window._dashDragSrc = null;

function _onDashPanelDragStart(e) {
    window._dashDragSrc = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.id || '');
    setTimeout(() => { if (this) this.style.opacity = '0.4'; }, 0);
}

function _onDashPanelDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const area = window._dashDragArea || document.getElementById('dashboardScrollArea') || document.getElementById('raceInfoPanel');
    if (!area || !window._dashDragSrc || this === window._dashDragSrc) return;
    const rect = this.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    area.insertBefore(window._dashDragSrc, after ? this.nextSibling : this);
}

function _onDashPanelDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    window._saveDashboardOrder();
}

function _onDashPanelDragEnd() {
    if (this) this.style.opacity = '';
    window._dashDragSrc = null;
}

window._saveDashboardOrder = function() {
    const area = document.getElementById('dashboardScrollArea') || document.getElementById('raceInfoPanel');
    if (!area) return;
    const order = Array.from(area.children).map(c => c.id || c.className.slice(0, 30));
    try { localStorage.setItem('strateger_dashboard_order', JSON.stringify(order)); } catch(e) {}
};

window._restoreDashboardOrder = function() {
    const area = document.getElementById('dashboardScrollArea') || document.getElementById('raceInfoPanel');
    if (!area) return;
    try {
        const order = JSON.parse(localStorage.getItem('strateger_dashboard_order') || 'null');
        if (!Array.isArray(order) || order.length === 0) return;
        order.forEach(id => {
            const el = id ? document.getElementById(id) : null;
            if (el && el.parentElement === area) area.appendChild(el);
        });
    } catch(e) {}
};

// ==========================================
// ↔️ HORIZONTAL PANEL PINNING
// Allows moving dashboard panel cards between left (raceInfoPanel)
// and right (raceControlDock) columns when horizontal layout is active.
// ==========================================

const _DASH_PANEL_PLACEMENT_KEY = 'strateger_dash_panel_placement';

function _isHorizontalLayout() {
    const wrapper = document.getElementById('racePanelsWrapper');
    if (!wrapper) return false;
    return getComputedStyle(wrapper).flexDirection === 'row';
}

window.initHorizontalPanels = function() {
    if (!_isHorizontalLayout()) return;

    const infoPanel = document.getElementById('raceInfoPanel');
    const controlDock = document.getElementById('raceControlDock');
    if (!infoPanel || !controlDock) return;

    const removeAllMoveButtons = () => {
        document.querySelectorAll('.dash-panel-move-btn').forEach(btn => btn.remove());
        [infoPanel, controlDock].forEach(p => {
            Array.from(p.children).forEach(child => {
                if (child?.dataset) delete child.dataset.moveBtnAdded;
            });
        });
    };

    // Assign IDs to unnamed direct children of raceInfoPanel for persistence
    let autoIdx = 0;
    Array.from(infoPanel.children).forEach(child => {
        if (!child.id) {
            child.id = 'dashPanel_auto_' + (autoIdx++);
        }
    });

    // Restore saved placement (will be ignored if one-panel mode is active below)
    const saved = JSON.parse(localStorage.getItem(_DASH_PANEL_PLACEMENT_KEY) || '{}');
    Object.entries(saved).forEach(([id, target]) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (target === 'right' && el.closest('#raceInfoPanel')) {
            controlDock.insertBefore(el, controlDock.firstChild);
        } else if (target === 'left' && el.closest('#raceControlDock')) {
            infoPanel.appendChild(el);
        }
    });

    // If everything fits in the main panel, keep a single panel layout.
    const totalChildrenHeight = Array.from(infoPanel.children).reduce((sum, el) => sum + (el.offsetHeight || 0), 0);
    const shouldUseSinglePanel = totalChildrenHeight > 0 && totalChildrenHeight <= infoPanel.clientHeight;
    if (shouldUseSinglePanel) {
        Array.from(controlDock.children).forEach(child => infoPanel.appendChild(child));
        controlDock.classList.add('hidden');
        removeAllMoveButtons();
        return;
    }
    controlDock.classList.remove('hidden');

    // Add move-to-other-panel button to each moveable child
    const SKIP_IDS = new Set(['strategyToastContainer']);
    const addMoveBtn = (panel, targetPanel, targetKey) => {
        Array.from(panel.children).forEach(child => {
            if (!child.dataset) return;
            if (child.id && SKIP_IDS.has(child.id)) return;
            // Accept any div child that looks like a panel block (has an id or rounded corners)
            if (child.tagName !== 'DIV') return;
            const hasRounded = child.classList.contains('rounded') || child.classList.contains('rounded-lg') || child.classList.contains('rounded-xl');
            if (!child.id && !hasRounded) return;

            const existingBtn = child.querySelector(':scope > .dash-panel-move-btn');
            if (existingBtn) existingBtn.remove();

            const btn = document.createElement('button');
            btn.className = 'dash-panel-move-btn';
            btn.title = targetKey === 'right' ? 'Move to right panel' : 'Move to left panel';
            btn.innerHTML = targetKey === 'right' ? '⇥' : '⇤';
            btn.onclick = (e) => {
                e.stopPropagation();
                const savedPlacement = JSON.parse(localStorage.getItem(_DASH_PANEL_PLACEMENT_KEY) || '{}');
                savedPlacement[child.id] = targetKey;
                localStorage.setItem(_DASH_PANEL_PLACEMENT_KEY, JSON.stringify(savedPlacement));
                targetPanel.insertBefore(child, targetPanel.firstChild);
                window.initHorizontalPanels(); // re-scan after move
            };

            // Make child position:relative if needed to anchor the button
            if (!child.style.position || child.style.position === 'static') {
                child.style.position = 'relative';
            }
            child.appendChild(btn);
            child.dataset.moveBtnAdded = '1';
        });
    };

    addMoveBtn(infoPanel, controlDock, 'right');
    addMoveBtn(controlDock, infoPanel, 'left');
};

// Re-init horizontal panels on orientation/resize so buttons appear/disappear correctly
window.addEventListener('resize', () => {
    if (document.getElementById('raceDashboard')?.classList.contains('hidden')) return;
    if (typeof window.initHorizontalPanels === 'function') window.initHorizontalPanels();
});

// ==========================================
// 🎬 PREVIEW SCREEN HELPERS (v2)
// ==========================================

window._closePreview = function() {
    document.getElementById('previewScreen').classList.add('hidden');
    document.getElementById('setupScreen').classList.remove('hidden');
};

// Render a mini stint chart in a container element
window.renderMiniStintChart = function(containerId, stints, maxMs) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!stints || stints.length === 0) { el.innerHTML = ''; return; }
    const cap = maxMs || Math.max(...stints.map(s => s.duration || 0)) || 1;
    const PALETTE = ['#22d3ee','#a3e635','#f97316','#ef4444','#8b5cf6','#ec4899','#facc15','#34d399'];
    el.innerHTML = stints.map((s, i) => {
        const h = Math.max(4, Math.round((s.duration / cap) * 24));
        const color = s.color || PALETTE[i % PALETTE.length];
        return `<div class="mini-stint-bar" style="height:${h}px;background:${color}" title="${s.driverName || ''}: ${Math.round(s.duration/60000)}m"></div>`;
    }).join('');
};

// Update mini chart in preview header after render
const _origRenderPreview = window.renderPreview;
window.renderPreview = function() {
    if (_origRenderPreview) _origRenderPreview.call(this);
    // Update mini chart
    if (window.previewData?.timeline) {
        const stints = window.previewData.timeline.filter(t => t.type === 'stint');
        const maxMs = stints.length > 0 ? Math.max(...stints.map(s => s.duration)) : 0;
        window.renderMiniStintChart('miniStintChart', stints, maxMs);
        // Update driver count label
        const summary = {};
        stints.forEach(s => { summary[s.driverName] = true; });
        const countEl = document.getElementById('previewDriverCount');
        if (countEl) {
            const n = Object.keys(summary).length;
            countEl.textContent = n > 0 ? `${n} driver${n !== 1 ? 's' : ''} · ${stints.length} stints` : '';
        }
    }
};

// ==========================================
// 🎭 DEMO MODAL
// ==========================================

window._selectedDemoScenario = 'sprint';

const _DEMO_SCENARIOS = {
    sprint: {
        label: 'Sprint Race', hours: 1, stops: 4, drivers: ['Alice', 'Bob', 'Charlie'],
        colors: ['#22d3ee', '#a3e635', '#f97316'],
        chartColors: ['#22d3ee', '#a3e635', '#f97316', '#22d3ee', '#a3e635']
    },
    endurance: {
        label: 'Endurance Classic', hours: 6, stops: 12, drivers: ['Driver 1', 'Driver 2', 'Driver 3', 'Driver 4'],
        colors: ['#22d3ee', '#a3e635', '#f97316', '#8b5cf6'],
        chartColors: ['#22d3ee','#a3e635','#f97316','#8b5cf6','#22d3ee','#a3e635','#f97316','#8b5cf6','#22d3ee','#a3e635','#f97316','#8b5cf6','#22d3ee']
    },
    night24: {
        label: '24h Night Race', hours: 24, stops: 48, drivers: ['Alpha A', 'Alpha B', 'Alpha C', 'Beta A', 'Beta B', 'Beta C'],
        colors: ['#3b82f6','#06b6d4','#8b5cf6','#f97316','#ef4444','#ec4899'],
        chartColors: [] // filled below
    }
};
// Fill night24 chart colors
for (let i = 0; i < 49; i++) {
    _DEMO_SCENARIOS.night24.chartColors.push(['#3b82f6','#06b6d4','#8b5cf6','#f97316','#ef4444','#ec4899'][i % 6]);
}

window._renderDemoCharts = function() {
    Object.entries(_DEMO_SCENARIOS).forEach(([key, sc]) => {
        const el = document.getElementById('demoChart_' + key);
        if (!el) return;
        const stints = sc.chartColors.map((color, i) => ({
            color,
            duration: (sc.hours * 3600000) / sc.chartColors.length + (Math.random() - 0.5) * 120000
        }));
        const maxMs = Math.max(...stints.map(s => s.duration));
        el.innerHTML = stints.map(s => {
            const h = Math.max(4, Math.round((s.duration / maxMs) * 14));
            return `<div class="mini-stint-bar" style="height:${h}px;background:${s.color}"></div>`;
        }).join('');
    });
};

window.openDemoModal = function() {
    const modal = document.getElementById('demoModal');
    if (!modal) { window.showDemoConfig && window.showDemoConfig(); return; }
    modal.classList.remove('hidden');
    window._renderDemoCharts();
};

window.closeDemoModal = function() {
    const modal = document.getElementById('demoModal');
    if (modal) modal.classList.add('hidden');
};

window.selectDemoScenario = function(cardEl, scenario) {
    document.querySelectorAll('#demoScenarioCards .demo-strategy-card').forEach(c => c.classList.remove('selected'));
    if (cardEl) cardEl.classList.add('selected');
    window._selectedDemoScenario = scenario;
};

window.launchSelectedDemo = function() {
    window.closeDemoModal();
    const sc = _DEMO_SCENARIOS[window._selectedDemoScenario] || _DEMO_SCENARIOS.sprint;
    // Apply the scenario config to the form
    const durationEl = document.getElementById('raceDuration');
    const stopsEl = document.getElementById('reqPitStops');
    if (durationEl) durationEl.value = sc.hours;
    if (stopsEl) stopsEl.value = sc.stops;
    // Clear existing drivers and apply demo drivers
    const list = document.getElementById('driversList');
    if (list) list.innerHTML = '';
    window._driverGroupParticipants.clear();
    sc.drivers.forEach(name => {
        window.addDriverToPool(name);
        window._driverGroupParticipants.add(name);
    });
    window.saveDriverPool(sc.drivers.map((name, i) => ({ name, color: sc.colors[i] })));
    window.renderDriverGroupUI();
    window.applyDriverGroupToRace(false);
    // Re-run sim and open preview
    if (typeof window.runSim === 'function') window.runSim();
    setTimeout(() => window.generatePreview && window.generatePreview(false, true), 100);
};

// ==========================================
// 🔧 LIVE-ADJUST MODAL
// ==========================================

window._adjustScenario = 'race';
window._pendingAdjustment = null;

const _ADJUST_SCENARIOS = {
    race: {
        label: 'Mid-Race',
        controls: [
            { id: 'adj_elapsedRace', label: 'Elapsed race time (%)', type: 'range', min: 0, max: 95, step: 5, default: 50 },
            { id: 'adj_extraStops', label: 'Extra pit stops', type: 'range', min: 0, max: 5, step: 1, default: 0 },
            { id: 'adj_driverOut', label: 'Driver unavailable (index)', type: 'range', min: -1, max: 5, step: 1, default: -1 },
        ]
    },
    qualify: {
        label: 'Qualifying',
        controls: [
            { id: 'adj_qElapsed', label: 'Session elapsed (%)', type: 'range', min: 0, max: 95, step: 5, default: 30 },
            { id: 'adj_qExtraRun', label: 'Extra qualifying run', type: 'range', min: 0, max: 3, step: 1, default: 0 },
        ]
    },
    safety: {
        label: 'Safety Car',
        controls: [
            { id: 'adj_scDuration', label: 'Safety car duration (min)', type: 'range', min: 0, max: 30, step: 2, default: 10 },
            { id: 'adj_scElapsed', label: 'Occurs at race % elapsed', type: 'range', min: 5, max: 90, step: 5, default: 40 },
        ]
    },
    weather: {
        label: 'Weather Change',
        controls: [
            { id: 'adj_rainAt', label: 'Rain starts at race % elapsed', type: 'range', min: 5, max: 90, step: 5, default: 50 },
            { id: 'adj_rainDuration', label: 'Rain duration (min)', type: 'range', min: 0, max: 60, step: 5, default: 20 },
            { id: 'adj_wetPitExtra', label: 'Extra wet pit time (s)', type: 'range', min: 0, max: 120, step: 10, default: 30 },
        ]
    }
};

window.openLiveAdjustModal = function() {
    const modal = document.getElementById('liveAdjustModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    window.setAdjustScenario(window._adjustScenario || 'race');
};

window.closeLiveAdjustModal = function() {
    const modal = document.getElementById('liveAdjustModal');
    if (modal) modal.classList.add('hidden');
};

window.setAdjustScenario = function(scenario) {
    window._adjustScenario = scenario;
    // Update tab styles
    const tabIds = ['race', 'qualify', 'safety', 'weather'];
    const activeClasses = { race: 'active-race', qualify: 'active-qualify', safety: 'active-safety', weather: 'active-weather' };
    tabIds.forEach(s => {
        const tab = document.getElementById('adjTab_' + s);
        if (!tab) return;
        tab.className = 'scenario-tab';
        if (s === scenario) tab.classList.add(activeClasses[s]);
    });
    // Render controls
    const container = document.getElementById('adjustScenarioControls');
    if (!container) return;
    const def = _ADJUST_SCENARIOS[scenario];
    if (!def) return;
    container.innerHTML = def.controls.map(ctrl => `
        <div class="space-y-1">
            <div class="flex justify-between items-center">
                <label class="text-[10px] text-gray-400 font-bold uppercase tracking-wide">${ctrl.label}</label>
                <span id="${ctrl.id}_val" class="text-xs font-mono text-ice font-bold">${ctrl.default}${ctrl.id.includes('elapsed') || ctrl.id.includes('At') ? '%' : ctrl.id.includes('Duration') || ctrl.id.includes('duration') ? 'm' : ''}</span>
            </div>
            <input type="range" id="${ctrl.id}" min="${ctrl.min}" max="${ctrl.max}" step="${ctrl.step}" value="${ctrl.default}"
                oninput="window._onAdjustSlider('${ctrl.id}', this.value)"
                class="w-full accent-cyan-400 h-1.5 rounded appearance-none cursor-pointer bg-navy-800">
        </div>
    `).join('');
    window._computeAdjustOutcome();
};

window._onAdjustSlider = function(id, val) {
    const display = document.getElementById(id + '_val');
    if (display) {
        const unit = id.includes('elapsed') || id.includes('At') ? '%' : id.includes('Duration') || id.includes('duration') ? 'm' : '';
        display.textContent = val + unit;
    }
    window._computeAdjustOutcome();
};

window._computeAdjustOutcome = function() {
    if (!window.previewData?.timeline || !window.config) {
        window._setAdjustOutcome({ pits: '—', stint: '—', drive: '—', risk: '—', pct: { pits: 60, stint: 60, drive: 90, risk: 10 }, classes: { pits: 'safe', stint: 'safe', drive: 'safe', risk: 'safe' }, deltas: { pits: '—', stint: '—', drive: '—', risk: '—' }, deltaClasses: { pits: 'delta-neutral', stint: 'delta-neutral', drive: 'delta-neutral', risk: 'delta-neutral' } });
        return;
    }
    const sc = window._adjustScenario;
    const stints = window.previewData.timeline.filter(t => t.type === 'stint');
    const pits = window.previewData.timeline.filter(t => t.type === 'pit');
    const basePits = pits.length;
    const basePitMs = window.config.pitTime * 1000 || 120000;
    const baseAvgStint = stints.length > 0 ? stints.reduce((a, s) => a + s.duration, 0) / stints.length : 0;
    const baseDrive = stints.reduce((a, s) => a + s.duration, 0);
    const raceMs = window.config.raceMs || 0;

    let adjPits = basePits, adjStint = baseAvgStint, adjDrive = baseDrive, riskPct = 10;

    if (sc === 'race') {
        const extra = parseInt(document.getElementById('adj_extraStops')?.value || 0);
        const driverOut = parseInt(document.getElementById('adj_driverOut')?.value || -1);
        adjPits = basePits + extra;
        adjDrive = baseDrive - extra * basePitMs;
        adjStint = adjPits > 0 ? adjDrive / (adjPits + 1) : adjDrive;
        riskPct = driverOut >= 0 ? 55 : extra > 2 ? 40 : 15;
    } else if (sc === 'safety') {
        const scMin = parseInt(document.getElementById('adj_scDuration')?.value || 0);
        const scMs = scMin * 60000;
        adjDrive = Math.max(0, baseDrive - scMs);
        adjStint = stints.length > 0 ? adjDrive / stints.length : 0;
        riskPct = scMin > 15 ? 50 : scMin > 5 ? 30 : 10;
        adjPits = scMin > 5 ? Math.max(0, basePits - 1) : basePits;
    } else if (sc === 'weather') {
        const extraSec = parseInt(document.getElementById('adj_wetPitExtra')?.value || 0);
        const extraMs = extraSec * 1000;
        adjPits = Math.max(0, basePits - 2); // typically go longer stints in rain
        adjDrive = baseDrive + extraMs * adjPits;
        adjStint = adjPits > 0 ? adjDrive / (adjPits + 1) : adjDrive;
        riskPct = extraSec > 60 ? 65 : extraSec > 20 ? 35 : 15;
    } else if (sc === 'qualify') {
        adjPits = basePits;
        adjStint = baseAvgStint;
        adjDrive = baseDrive;
        riskPct = 5;
    }

    const fmtMin = ms => `${Math.round(ms / 60000)}m`;
    const deltaPits = adjPits - basePits;
    const deltaStint = adjStint - baseAvgStint;
    const deltaDrive = adjDrive - baseDrive;

    const pitsBarPct = Math.min(100, Math.round((adjPits / Math.max(1, basePits + 5)) * 100));
    const stintBarPct = Math.min(100, Math.round((adjStint / (raceMs / 2)) * 100));
    const driveBarPct = raceMs > 0 ? Math.min(100, Math.round((adjDrive / raceMs) * 100)) : 80;

    window._pendingAdjustment = { sc, adjPits, adjStint, adjDrive, riskPct, raceMs };

    window._setAdjustOutcome({
        pits: String(adjPits),
        stint: fmtMin(adjStint),
        drive: fmtMin(adjDrive),
        risk: riskPct > 50 ? '⚠️ High' : riskPct > 25 ? '🟡 Med' : '✅ Low',
        pct: { pits: pitsBarPct, stint: stintBarPct, drive: driveBarPct, risk: riskPct },
        classes: {
            pits: deltaPits > 2 ? 'risk' : deltaPits > 0 ? 'warn' : 'safe',
            stint: deltaStint < -600000 ? 'risk' : deltaStint < 0 ? 'warn' : 'safe',
            drive: deltaDrive < -1800000 ? 'risk' : deltaDrive < 0 ? 'warn' : 'safe',
            risk: riskPct > 50 ? 'risk' : riskPct > 25 ? 'warn' : 'safe'
        },
        deltas: {
            pits: deltaPits !== 0 ? (deltaPits > 0 ? '+' : '') + deltaPits : '—',
            stint: deltaStint !== 0 ? (deltaStint > 0 ? '+' : '') + Math.round(deltaStint / 60000) + 'm' : '—',
            drive: deltaDrive !== 0 ? (deltaDrive > 0 ? '+' : '') + Math.round(deltaDrive / 60000) + 'm' : '—',
            risk: ''
        },
        deltaClasses: {
            pits: deltaPits > 0 ? 'delta-negative' : deltaPits < 0 ? 'delta-positive' : 'delta-neutral',
            stint: deltaStint < -300000 ? 'delta-negative' : deltaStint > 300000 ? 'delta-positive' : 'delta-neutral',
            drive: deltaDrive < -600000 ? 'delta-negative' : deltaDrive > 600000 ? 'delta-positive' : 'delta-neutral',
            risk: riskPct > 50 ? 'delta-negative' : 'delta-neutral'
        }
    });

    // Show recommendation
    const recBox = document.getElementById('adjustRecommendation');
    const recText = document.getElementById('adjustRecommendationText');
    if (recBox && recText) {
        let rec = '';
        if (sc === 'safety' && parseInt(document.getElementById('adj_scDuration')?.value || 0) > 5) {
            rec = 'Use the safety car window to pit early — saves time vs. a free-air stop later.';
        } else if (sc === 'weather' && parseInt(document.getElementById('adj_wetPitExtra')?.value || 0) > 30) {
            rec = 'Consider delaying your next stop until conditions improve to minimise wet-tyre time in the pits.';
        } else if (sc === 'race' && parseInt(document.getElementById('adj_extraStops')?.value || 0) > 1) {
            rec = 'Extra stops cost track position. Only worthwhile if the pace delta exceeds the time loss per stop.';
        } else {
            recBox.classList.add('hidden');
            return;
        }
        recText.textContent = rec;
        recBox.classList.remove('hidden');
    }
};

window._setAdjustOutcome = function(data) {
    const ids = ['Pits', 'Stint', 'Drive', 'Risk'];
    ids.forEach(key => {
        const lk = key.toLowerCase();
        const outEl = document.getElementById('ladjOut' + key);
        const barEl = document.getElementById('ladjBar' + key);
        const deltaEl = document.getElementById('ladjDelta' + key);
        if (outEl) outEl.textContent = data[lk] || '—';
        if (barEl) {
            barEl.style.width = (data.pct[lk] || 0) + '%';
            barEl.className = 'outcome-bar-fill ' + (data.classes[lk] || 'safe');
        }
        if (deltaEl) {
            deltaEl.textContent = data.deltas?.[lk] || '—';
            deltaEl.className = 'delta-badge ' + (data.deltaClasses?.[lk] || 'delta-neutral');
        }
    });
};

window.applyLiveAdjustment = function() {
    if (!window._pendingAdjustment || !window.previewData?.timeline) {
        window.closeLiveAdjustModal();
        return;
    }
    const { sc, adjPits, adjStint, adjDrive, raceMs } = window._pendingAdjustment;
    const stints = window.previewData.timeline.filter(t => t.type === 'stint');
    const pits = window.previewData.timeline.filter(t => t.type === 'pit');

    if (sc === 'safety' || sc === 'weather' || sc === 'race') {
        // Redistribute drive time evenly across existing stints
        if (stints.length > 0 && adjDrive > 0) {
            const perStint = Math.round(adjDrive / stints.length / 1000) * 1000;
            stints.forEach((s, i) => {
                s.duration = i < stints.length - 1 ? perStint : adjDrive - perStint * (stints.length - 1);
            });
        }
        // Recalculate timeline times
        if (typeof window.recalculateTimelineTimes === 'function') window.recalculateTimelineTimes();
    }

    window._pendingAdjustment = null;
    window.closeLiveAdjustModal();

    // Show outcome in preview panel
    const panel = document.getElementById('previewAdjustPanel');
    const label = document.getElementById('adjustScenarioLabel');
    if (panel) panel.classList.remove('hidden', 'collapsed');
    if (label) {
        const names = { race: '🏎️ Race', qualify: '⏱️ Qualify', safety: '🟡 Safety Car', weather: '🌧️ Weather' };
        label.textContent = names[sc] || sc;
        label.className = 'delta-badge ' + (sc === 'race' ? 'delta-negative' : sc === 'qualify' ? 'delta-neutral' : sc === 'safety' ? 'delta-neutral' : 'delta-positive');
    }
    // Sync outcome bars in preview panel
    if (stints.length > 0) {
        const adjDriveVal = stints.reduce((a, s) => a + s.duration, 0);
        const adjStintVal = adjDriveVal / stints.length;
        const pitCount = pits.length;
        const fmtMin = ms => `${Math.round(ms / 60000)}m`;
        const fields = [
            { key: 'Pits', val: String(pitCount), pct: Math.min(100, Math.round(pitCount / 20 * 100)), cls: 'safe', delta: '—', deltaCls: 'delta-neutral' },
            { key: 'Stint', val: fmtMin(adjStintVal), pct: Math.min(100, Math.round(adjStintVal / (raceMs / 2) * 100)), cls: 'safe', delta: '—', deltaCls: 'delta-neutral' },
            { key: 'Drive', val: fmtMin(adjDriveVal), pct: raceMs > 0 ? Math.min(100, Math.round(adjDriveVal / raceMs * 100)) : 80, cls: 'safe', delta: '—', deltaCls: 'delta-neutral' }
        ];
        fields.forEach(f => {
            const out = document.getElementById('adjOut' + f.key);
            const bar = document.getElementById('adjBar' + f.key);
            const dlt = document.getElementById('adjDelta' + f.key);
            if (out) out.textContent = f.val;
            if (bar) { bar.style.width = f.pct + '%'; bar.className = 'outcome-bar-fill ' + f.cls; }
            if (dlt) { dlt.textContent = f.delta; dlt.className = 'delta-badge ' + f.deltaCls; }
        });
    }

    window.renderPreview();
    if (typeof window.showToast === 'function') window.showToast('✅ Scenario applied to strategy', 'success', 2500);
};

window._togglePreviewAdjustPanel = function() {
    const panel = document.getElementById('previewAdjustPanel');
    const icon = document.getElementById('adjustPanelIcon');
    if (!panel) return;
    panel.classList.toggle('collapsed');
    if (icon) icon.style.transform = panel.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0deg)';
};

// ==========================================
// ⚡ QUICK MODE PRESETS (hero pill strip)
// ==========================================

window._heroCollapsed = localStorage.getItem('strateger_hero_collapsed') === 'true';

window.toggleHero = function() {
    window._heroCollapsed = !window._heroCollapsed;
    localStorage.setItem('strateger_hero_collapsed', window._heroCollapsed ? 'true' : 'false');
    window._applyHeroState();
};

window._applyHeroState = function() {
    const body = document.getElementById('heroBody');
    const sub = document.getElementById('heroSubText');
    const icon = document.getElementById('heroToggleIcon');
    const label = document.getElementById('heroToggleLabel');
    const t = window.t || (k => k);
    if (window._heroCollapsed) {
        body && body.classList.add('hidden');
        sub && sub.classList.add('hidden');
        icon && icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
        if (label) label.setAttribute('data-i18n', 'heroExpand'), label.textContent = t('heroExpand') || 'Setup';
    } else {
        body && body.classList.remove('hidden');
        sub && sub.classList.remove('hidden');
        icon && icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
        if (label) label.setAttribute('data-i18n', 'heroCollapse'), label.textContent = t('heroCollapse') || 'Hide';
    }
};

window.setQuickMode = function(mode) {
    const presets = {
        sprint: { duration: 1, stops: 4, minStint: 10, maxStint: 20, pitTime: 90 },
        endurance: { duration: 6, stops: 12, minStint: 25, maxStint: 40, pitTime: 120 }
    };
    const p = presets[mode];
    if (!p) return;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) { el.value = v; } };
    setVal('raceDuration', p.duration);
    setVal('reqPitStops', p.stops);
    setVal('minStint', p.minStint);
    setVal('maxStint', p.maxStint);
    setVal('minPitTime', p.pitTime);
    if (typeof window.runSim === 'function') window.runSim();
    // Highlight active pill
    document.querySelectorAll('.quick-pill').forEach(pill => {
        const isMatch = pill.textContent.toLowerCase().includes(mode === 'sprint' ? 'sprint' : 'endurance');
        pill.classList.toggle('active', isMatch);
    });
    if (typeof window.showToast === 'function') window.showToast(`⚡ ${mode.charAt(0).toUpperCase() + mode.slice(1)} preset loaded`, 'success', 1800);
};

// Update hero mini chart whenever previewData changes
window._updateHeroChart = function() {
    const el = document.getElementById('heroMiniChart');
    if (!el) return;
    if (!window.previewData?.timeline) { el.innerHTML = ''; return; }
    const stints = window.previewData.timeline.filter(t => t.type === 'stint');
    if (stints.length === 0) { el.innerHTML = ''; return; }
    const maxMs = Math.max(...stints.map(s => s.duration));
    el.innerHTML = stints.slice(0, 16).map(s => {
        const h = Math.max(4, Math.round((s.duration / maxMs) * 20));
        return `<div class="mini-stint-bar" style="height:${h}px;background:${s.color || '#22d3ee'}"></div>`;
    }).join('');
};

// Hook into runSim to also update hero chart
const _origRunSimForHero = window.runSim;
if (_origRunSimForHero) {
    window.runSim = function(...args) {
        const result = _origRunSimForHero.apply(this, args);
        setTimeout(window._updateHeroChart, 50);
        return result;
    };
}

// ==========================================
// 🏁 RIGHT-ZONE WIDGET SYSTEM
// ==========================================

;(function() {
    'use strict';

    const WIDGET_ORDER_KEY = 'strateger_widget_order';
    const WIDGET_COLLAPSED_KEY = 'strateger_widget_collapsed';
    const LAYOUT_TPL_KEY = 'strateger_layout_tpl';
    const SNAP_GRID = 20;

    // ---- Layout templates ----
    // Each template describes: lt-zone-w percentage, which widgets are visible/collapsed,
    // and order of widgets in the right zone.
    const TEMPLATES = {
        classic: {
            ltZoneW: '58%',
            widgets: ['widgetLayoutTemplates','widgetDriverInfo','widgetStintData','widgetStrategy'],
            collapsed: [],
        },
        pit: {
            ltZoneW: '42%',
            widgets: ['widgetLayoutTemplates','widgetDriverInfo','widgetStintData','widgetStrategy'],
            collapsed: ['widgetStrategy'],
        },
        strategy: {
            ltZoneW: '50%',
            widgets: ['widgetLayoutTemplates','widgetStrategy','widgetStintData','widgetDriverInfo'],
            collapsed: [],
        },
        compact: {
            ltZoneW: '65%',
            widgets: ['widgetLayoutTemplates','widgetDriverInfo','widgetStintData','widgetStrategy'],
            collapsed: ['widgetStintData','widgetStrategy'],
        },
    };

    // Show/hide right-widgets-area on wide screens
    function updateWidgetAreaVisibility() {
        const area = document.getElementById('rightWidgetsArea');
        if (!area) return;
        const wide = window.matchMedia('(min-width: 1024px)').matches;
        if (wide) {
            area.classList.remove('hidden');
            area.style.display = 'flex';
        } else {
            area.classList.add('hidden');
            area.style.display = '';
        }
    }

    // Apply a layout template
    window.applyLayoutTemplate = function(tplName) {
        const tpl = TEMPLATES[tplName];
        if (!tpl) return;
        // Save
        try { localStorage.setItem(LAYOUT_TPL_KEY, tplName); } catch(e) {}
        // Update CSS var
        document.documentElement.style.setProperty('--lt-zone-w', tpl.ltZoneW);
        // Reorder widgets
        const area = document.getElementById('rightWidgetsArea');
        if (area) {
            tpl.widgets.forEach(id => {
                const el = document.getElementById(id);
                if (el) area.appendChild(el);
            });
        }
        // Apply collapsed states
        tpl.widgets.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (tpl.collapsed.includes(id)) {
                el.classList.add('collapsed');
                const btn = el.querySelector('.widget-collapse-btn');
                if (btn) btn.textContent = '▸';
            } else {
                el.classList.remove('collapsed');
                const btn = el.querySelector('.widget-collapse-btn');
                if (btn) btn.textContent = '▾';
            }
        });
        // Update active template button
        document.querySelectorAll('.layout-tpl-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tpl === tplName);
        });
    };

    // Collapse/expand a widget
    window.toggleWidget = function(widgetId) {
        const el = document.getElementById(widgetId);
        if (!el) return;
        const collapsed = el.classList.toggle('collapsed');
        const btn = el.querySelector('.widget-collapse-btn');
        if (btn) btn.textContent = collapsed ? '▸' : '▾';
        // Persist
        try {
            const saved = JSON.parse(localStorage.getItem(WIDGET_COLLAPSED_KEY) || '{}');
            saved[widgetId] = collapsed;
            localStorage.setItem(WIDGET_COLLAPSED_KEY, JSON.stringify(saved));
        } catch(e) {}
    };

    // ---- Widget drag reorder (within right zone) ----
    let _wDragSrc = null;
    let _wDropZone = null;

    function initWidgetDragReorder() {
        const area = document.getElementById('rightWidgetsArea');
        if (!area) return;

        area.addEventListener('mousedown', onWidgetDragStart, true);
        area.addEventListener('touchstart', onWidgetTouchStart, { passive: false });
    }

    function onWidgetDragStart(e) {
        const handle = e.target.closest('.widget-drag-handle');
        if (!handle) return;
        const widget = handle.closest('.right-zone-widget');
        if (!widget) return;
        e.preventDefault();

        _wDragSrc = widget;
        const originalRect = widget.getBoundingClientRect();
        const offsetX = e.clientX - originalRect.left;
        const offsetY = e.clientY - originalRect.top;

        // Ghost element
        const ghost = widget.cloneNode(true);
        ghost.style.cssText = `position:fixed;left:${originalRect.left}px;top:${originalRect.top}px;width:${originalRect.width}px;opacity:0.85;pointer-events:none;z-index:9999;border:1px solid rgba(34,211,238,0.6);border-radius:10px;`;
        document.body.appendChild(ghost);

        // Drop zone placeholder
        const ph = document.createElement('div');
        ph.className = 'widget-drop-zone active';
        ph.style.height = originalRect.height + 'px';
        widget.parentNode.insertBefore(ph, widget);
        widget.style.display = 'none';
        _wDropZone = ph;

        function onMove(me) {
            const cx = me.clientX ?? me.touches?.[0]?.clientX;
            const cy = me.clientY ?? me.touches?.[0]?.clientY;
            if (cx == null) return;
            ghost.style.left = (cx - offsetX) + 'px';
            ghost.style.top  = (cy - offsetY) + 'px';
            // Find drop target
            const area2 = document.getElementById('rightWidgetsArea');
            if (!area2) return;
            const siblings = [...area2.querySelectorAll('.right-zone-widget:not([style*="display: none"])')];
            let inserted = false;
            for (const sib of siblings) {
                const sr = sib.getBoundingClientRect();
                if (cy < sr.top + sr.height / 2) {
                    area2.insertBefore(_wDropZone, sib);
                    inserted = true;
                    break;
                }
            }
            if (!inserted) area2.appendChild(_wDropZone);
        }

        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            // Place widget where placeholder is
            if (_wDropZone && _wDropZone.parentNode) {
                _wDropZone.parentNode.insertBefore(_wDragSrc, _wDropZone);
                _wDropZone.remove();
            }
            _wDragSrc.style.display = '';
            ghost.remove();
            _wDragSrc = null;
            _wDropZone = null;
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onUp);
    }

    function onWidgetTouchStart(e) {
        const handle = e.target.closest('.widget-drag-handle');
        if (!handle) return;
        e.preventDefault();
        onWidgetDragStart({ target: e.target, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, preventDefault: () => {} });
    }

    // ---- Snap-to-grid for the live timing floating widget ----
    // Overrides the raw pixel position with the nearest grid multiple.
    window._snapToGrid = function(x, y) {
        return {
            x: Math.round(x / SNAP_GRID) * SNAP_GRID,
            y: Math.round(y / SNAP_GRID) * SNAP_GRID,
        };
    };

    function observeLtWrapper() {
        // Snap logic is handled directly in live-timing.js onDragEnd.
        // This function is kept as a no-op so init() still calls it without error.
    }

    // ---- Mirror key values from left-panel to right-zone widgets ----
    window._syncRightZoneWidgets = function() {
        // Driver info
        const driverNameEl = document.getElementById('currentDriverName');
        const stintTimerEl = document.getElementById('stintTimerDisplay');
        const dotEl        = document.getElementById('currentDriverDot');
        if (driverNameEl) {
            const wn = document.getElementById('wDriverName');
            if (wn) wn.textContent = driverNameEl.textContent;
        }
        if (dotEl) {
            const wd = document.getElementById('wDriverDot');
            if (wd) wd.style.background = dotEl.style.background;
        }
        if (stintTimerEl) {
            const wt = document.getElementById('wStintTimer');
            if (wt) wt.textContent = stintTimerEl.textContent;
        }
        // Stint data
        const targetEl = document.getElementById('strategyTargetStint');
        if (targetEl) {
            const wts = document.getElementById('wTargetStint');
            if (wts) wts.textContent = targetEl.textContent;
        }
        const pitCountEl = document.getElementById('pitCountDisplay');
        if (pitCountEl) {
            const wpc = document.getElementById('wPitCount');
            if (wpc) wpc.innerHTML = pitCountEl.innerHTML;
        }
        const statusEl = document.getElementById('pitStatusIndicator');
        if (statusEl) {
            const ws = document.getElementById('wStatus');
            if (ws) ws.textContent = statusEl.textContent;
        }
        // Strategy outlook pills — mirror from remStintsText
        const outlookEl = document.getElementById('remStintsText');
        const wOutlook  = document.getElementById('wStrategyOutlook');
        if (outlookEl && wOutlook) {
            wOutlook.innerHTML = outlookEl.innerHTML;
        }
    };

    // ---- Persist / restore collapsed state ----
    function restoreCollapsedState() {
        try {
            const saved = JSON.parse(localStorage.getItem(WIDGET_COLLAPSED_KEY) || '{}');
            Object.entries(saved).forEach(([id, collapsed]) => {
                const el = document.getElementById(id);
                if (!el) return;
                if (collapsed) {
                    el.classList.add('collapsed');
                    const btn = el.querySelector('.widget-collapse-btn');
                    if (btn) btn.textContent = '▸';
                }
            });
        } catch(e) {}
    }

    // ---- Init ----
    function init() {
        updateWidgetAreaVisibility();
        window.addEventListener('resize', updateWidgetAreaVisibility);
        initWidgetDragReorder();
        restoreCollapsedState();
        observeLtWrapper();
        // Apply saved layout template
        try {
            const saved = localStorage.getItem(LAYOUT_TPL_KEY);
            if (saved && TEMPLATES[saved]) window.applyLayoutTemplate(saved);
        } catch(e) {}
        // Sync right zone every second during race
        setInterval(() => {
            if (document.getElementById('raceDashboard')?.classList.contains('hidden') === false) {
                window._syncRightZoneWidgets();
            }
        }, 1000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
