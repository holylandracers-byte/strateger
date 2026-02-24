// ==========================================
// 🎨 UI MANAGER (Updated Visuals)
// ==========================================

window.toggleConfigPanel = function(event) {
    if (event && event.target.closest('.starter-indicator, .starter-radio, .driver-input')) return;
    const panel = document.getElementById('configPanel');
    const arrow = document.getElementById('configArrow');
    if (panel) {
        panel.classList.toggle('hidden');
        if (arrow) arrow.innerText = panel.classList.contains('hidden') ? '▼' : '▲';
    }
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
    div.className = "driver-row flex items-center gap-2 bg-navy-950 rounded border border-gray-700 mb-2 cursor-default";
    div.onclick = (e) => e.stopPropagation();

    const radioId = 'starter_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    
    const label = document.createElement('label');
    label.className = "flex items-center cursor-pointer p-1 rounded hover:bg-white/5 shrink-0";
    label.addEventListener('click', (e) => {
        e.preventDefault(); 
        e.stopPropagation();
        const allRadios = document.querySelectorAll('.starter-radio');
        allRadios.forEach(r => r.checked = false);
        document.getElementById(radioId).checked = true;
        window.updateStarterVisuals();
        window.runSim();
    });

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'starter';
    radio.id = radioId;
    radio.className = 'starter-radio sr-only';
    radio.checked = checked;

    const indicator = document.createElement('div');
    indicator.className = 'starter-indicator w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition ' + 
        (checked ? 'border-ice bg-ice/30 text-white shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'border-gray-600 text-gray-500 hover:border-gray-400');
    indicator.textContent = '🏁';

    label.appendChild(radio);
    label.appendChild(indicator);

    const driverInput = document.createElement('input');
    driverInput.type = 'text';
    driverInput.value = val;
    driverInput.className = 'driver-input bg-transparent text-white w-full outline-none font-bold text-sm px-2 focus:bg-navy-900 rounded';
    driverInput.addEventListener('click', (e) => e.stopPropagation());
    driverInput.onchange = () => window.runSim();

    // Color picker
    const DRIVER_PALETTE = ['#22d3ee','#a3e635','#f97316','#ef4444','#8b5cf6','#ec4899','#facc15','#34d399'];
    const colorIdx = document.getElementById('driversList')?.children.length || 0;
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'driver-color-picker';
    colorPicker.value = DRIVER_PALETTE[colorIdx % DRIVER_PALETTE.length];
    colorPicker.title = 'Driver color';
    colorPicker.addEventListener('click', (e) => e.stopPropagation());
    colorPicker.onchange = () => window.runSim();

    const SQUAD_COLORS = ['#3b82f6','#06b6d4','#a855f7','#f97316'];
    const SQUAD_LABELS = ['A','B','C','D'];
    const squadIdx = typeof squad === 'number' ? squad : (squad === 'B' ? 1 : squad === 'C' ? 2 : squad === 'D' ? 3 : 0);

    const squadLabel = document.createElement('div');
    squadLabel.className = 'squad-toggle-container flex items-center cursor-pointer ml-auto bg-navy-800 rounded px-2 py-1 border border-gray-600 hidden select-none shrink-0';
    squadLabel.addEventListener('click', (e) => e.stopPropagation());

    const squadHidden = document.createElement('input');
    squadHidden.type = 'hidden';
    squadHidden.className = 'squad-value';
    squadHidden.value = String(squadIdx);

    const squadDisplay = document.createElement('div');
    squadDisplay.innerText = SQUAD_LABELS[squadIdx];
    squadDisplay.style.background = SQUAD_COLORS[squadIdx];
    squadDisplay.className = 'w-6 h-5 rounded text-[10px] flex items-center justify-center font-bold text-white cursor-pointer select-none';
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

    div.appendChild(label);
    div.appendChild(driverInput);
    div.appendChild(colorPicker);
    div.appendChild(squadLabel);
    
    document.getElementById('driversList').appendChild(div);
};

window.updateStarterVisuals = function() {
    const scrollY = window.scrollY;
    document.querySelectorAll('.starter-indicator').forEach(ind => {
        const radio = ind.previousElementSibling;
        if (radio && radio.checked) {
            ind.className = 'starter-indicator w-8 h-8 rounded-full border-2 border-ice bg-ice/30 shadow-[0_0_8px_rgba(34,211,238,0.5)] flex items-center justify-center text-sm';
        } else {
            ind.className = 'starter-indicator w-8 h-8 rounded-full border-2 border-gray-500 flex items-center justify-center text-sm hover:border-ice transition';
        }
    });
    window.scrollTo(0, scrollY);
};

window.toggleSquadsInput = function() {
    const numSquads = parseInt(document.getElementById('numSquads')?.value) || 0;
    const useSquads = numSquads > 0;
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
    if (trackFuel && fuelDiv) {
        trackFuel.checked ? fuelDiv.classList.remove('hidden') : fuelDiv.classList.add('hidden');
    }
};

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
    'amber-heat': 'background: linear-gradient(180deg, #1a1000 0%, #2d1a05 50%, #1a1000 100%);',
    'steel': 'background: linear-gradient(180deg, #15181e 0%, #1e2530 50%, #15181e 100%);'
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
    'amber-heat': { main: '#1a1000', panel: '#221805', border: '#403015' },
    'steel': { main: '#15181e', panel: '#1c2028', border: '#2a3040' }
};

window.setPageBackground = function(bg) {
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
    const previewTimeDisplay = document.getElementById('previewStartTimeDisplay');
    
    if (timeInput && timeInput.value) {
        if (previewTimeDisplay) previewTimeDisplay.innerText = timeInput.value;
        startRef = new Date();
        const [h, m] = timeInput.value.split(':');
        startRef.setHours(parseInt(h), parseInt(m), 0, 0);
    } else {
        startRef = new Date();
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
        
        const outOfBounds = durationMin < minStintMin || durationMin > maxStintMin;
        const borderWarning = outOfBounds ? 'ring-1 ring-red-500' : '';

        return `
            <div class="flex items-center gap-1 bg-navy-950 p-2 rounded border-l-4 mb-1 text-xs cursor-grab active:cursor-grabbing ${borderWarning}" 
                 style="border-left-color: ${stint.color}" 
                 draggable="true" data-index="${index}"
                 ondragstart="window.handleDragStart(event)" 
                 ondragover="window.handleDragOver(event)" 
                 ondragleave="window.handleDragLeave(event)" 
                 ondrop="window.handleDrop(event)">
                <div class="flex flex-col gap-0.5 shrink-0">
                    <button onclick="window.moveStint(${index}, -1)" class="text-gray-500 hover:text-white text-[10px] leading-none px-1 ${isFirst ? 'invisible' : ''}" title="Move Up">▲</button>
                    <span class="text-gray-500 text-center font-mono text-[10px]">#${index + 1}</span>
                    <button onclick="window.moveStint(${index}, 1)" class="text-gray-500 hover:text-white text-[10px] leading-none px-1 ${isLast ? 'invisible' : ''}" title="Move Down">▼</button>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-white truncate">${stint.driverName}</div>
                    <div class="flex items-center gap-1 text-gray-400 text-[10px]">
                        <span>${startTimeStr}</span>
                        <span class="text-ice">${arrow}</span>
                        <span>${endTimeStr}</span>
                        ${pitIndicator}
                    </div>
                </div>
                <input type="number" value="${durationMin}" min="${minStintMin}" max="${maxStintMin}" 
                       onchange="window.updateStintDuration(${index}, this.value)" 
                       class="w-14 bg-navy-800 border border-gray-600 text-white text-center text-xs rounded px-1 py-0.5 font-mono focus:border-ice focus:outline-none ${outOfBounds ? 'border-red-500 text-red-300' : ''}" 
                       title="Stint duration (min)">
                <span class="text-gray-500 text-[10px]">m</span>
                ${isLast ? '🏁' : ''}
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
            <span>Drive: <b class="text-white">${(totalDrive/60000).toFixed(0)}m</b> + Pit: <b class="text-gold">${(totalPit/60000).toFixed(0)}m</b></span>
            <span class="${diffClass} font-bold">= ${((totalDrive+totalPit)/60000).toFixed(0)}m ${diffMs !== 0 ? '(' + (diffMs > 0 ? '+' : '') + (diffMs/60000).toFixed(0) + 'm)' : '✅'}</span>
        </div>
    `;
    
    const scheduleEl = document.getElementById('driverScheduleList');
    if (scheduleEl) scheduleEl.innerHTML = listHtml + totalBar;

    // === 7. סיכום נהגים ===
    const summary = {};
    stints.forEach(s => {
        if (!summary[s.driverName]) summary[s.driverName] = { time: 0, stints: 0, color: s.color };
        summary[s.driverName].time += s.duration;
        summary[s.driverName].stints += 1;
    });

    const summaryHtml = Object.entries(summary).map(([name, data]) => {
        return `
            <div class="bg-navy-950 p-2 rounded border-t-2 flex flex-col items-center justify-center text-center shadow-md h-20" style="border-color: ${data.color}">
                <div class="text-[10px] font-bold text-gray-300 truncate w-full">${name}</div>
                <div class="text-sm text-white font-mono font-bold my-1">${window.formatTimeHMS(data.time)}</div>
                <div class="text-[9px] text-gray-500 bg-navy-900 px-2 rounded-full">${data.stints} stints</div>
            </div>
        `;
    }).join('');
    
    const summaryEl = document.getElementById('strategySummary');
    if (summaryEl) {
        summaryEl.className = "grid grid-cols-3 sm:grid-cols-4 gap-2 p-2 max-h-40 overflow-y-auto";
        summaryEl.innerHTML = summaryHtml;
    }
};

// פונקציית עדכון לוגים בזמן אמת
window.updateStats = function(currentStintMs) {
    const tb = document.getElementById('statsTable'); 
    if (!tb || !window.drivers) return;
    
    tb.innerHTML = '';
    
    window.drivers.forEach((d, i) => {
        // חישוב זמן כולל לתצוגה
        let displayTotalTime = d.totalTime || 0;
        
        // אם זה הנהג שנוהג כרגע (ולא בפיטס), נוסיף לו את הזמן שרץ עכשיו
        // זה רק לתצוגה, לא שומרים את זה ב-DB עדיין
        if (i === window.state.currentDriverIdx && !window.state.isInPit) {
            displayTotalTime += currentStintMs;
        }
        
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
        
        mainRow.innerHTML = `
            <td class="text-center cursor-pointer p-2 hover:text-ice" onclick="window.toggleLog(${i})">${d.isExpanded ? '▲' : '▼'}</td>
            <td class="py-2 pr-2">${d.name} ${isCurrent ? '🏎️' : ''}${squadBadge}</td>
            <td class="py-2 text-center">${d.stints || 0}</td> <td class="py-2 text-right font-mono">${window.formatTimeHMS(displayTotalTime)}</td>
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
    if (window.liveData.position) document.getElementById('manualPosition').value = window.liveData.position;
};
window.closeManualInput = function() { document.getElementById('manualInputModal').classList.add('hidden'); };
window.applyManualInput = function() {
    const pos = parseInt(document.getElementById('manualPosition').value);
    const laps = parseInt(document.getElementById('manualLaps').value);
    if (pos) window.liveData.position = pos;
    if (laps) window.liveData.laps = laps;
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
    
    if (!window.cachedStrategy) return alert("No strategy generated yet!");

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
        const response = await fetch('/.netlify/functions/save-strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Server error');
        }
        
        alert("Strategy Saved to Cloud Database! ☁️");
        window.closeSaveStrategyModal();

    } catch (e) {
        console.error("Save failed:", e);
        alert("Cloud Save Failed: " + e.message);
        
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
            alert("Strategy not found!");
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
        
        alert(`Strategy "${strategy.name}" loaded successfully!`);

    } catch (e) {
        console.error("Error applying strategy:", e);
        alert("Failed to load strategy: " + e.message);
    }
};

window.deleteStrategy = function(index) {
    if (!confirm("Delete this strategy permanently?")) return;
    
    try {
        const strategies = JSON.parse(localStorage.getItem('strateger_strategies') || '[]');
        strategies.splice(index, 1);
        localStorage.setItem('strateger_strategies', JSON.stringify(strategies));
        window.loadStrategyLibrary(); // רענון הרשימה
    } catch (e) {
        console.error(e);
    }
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

    // רשימת אלמנטים שאסור ל-Viewer לגעת בהם
    const hideSelectors = [
        '#btnPush', 
        '#btnBad', 
        '#btnResetMode', 
        '#pitEntryBtn', 
        '#btnRain', // מזג אוויר
        '.starter-radio', // בחירת נהג התחלתי
        '#addDriverBtn', // אם קיים
        '.penalty-btn', // כפתורי PENALTY
        '#penaltyBtnMinus5',
        '#penaltyBtnPlus5',
        '#penaltyBtnPlus10',
        'input', // חוסם את כל האינפוטים
        'select',
        'button.btn-press' // כפתורי שליטה
    ];

    hideSelectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
            // לא מסתירים את הצ'אט והלוגין
            if (el.closest('#chatPanel') || el.closest('#chatToggleBtn') || el.id === 'googleSignInBtn') return;
            
            // או שמסתירים לגמרי או שמנטרלים
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') {
                el.disabled = true;
                el.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                el.classList.add('hidden'); // עדיף להסתיר כדי שלא יבלבל
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
    if (!name) return alert("Name required");
    
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
            // Viewer only sees private messages addressed to them
            if (msg.recipient !== window.myId && msg.sender !== myName) {
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