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
    window.createDriverInput(`Driver ${count}`, count === 1, 'A');
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
    driverInput.oninput = () => window.runSim();

    const squadLabel = document.createElement('label');
    squadLabel.className = 'squad-toggle-container flex items-center cursor-pointer ml-auto bg-navy-800 rounded px-2 py-1 border border-gray-600 hidden select-none shrink-0';
    squadLabel.addEventListener('click', (e) => e.stopPropagation());

    const squadCheck = document.createElement('input');
    squadCheck.type = 'checkbox';
    squadCheck.className = 'squad-toggle hidden';
    squadCheck.checked = (squad === 'B');
    squadCheck.onchange = function(e) {
        const display = this.nextElementSibling;
        display.innerText = this.checked ? 'B' : 'A';
        display.className = `w-6 h-4 rounded text-[10px] flex items-center justify-center font-bold text-white ${this.checked ? 'bg-squadB' : 'bg-squadA'}`;
        window.runSim();
    };

    const squadDisplay = document.createElement('div');
    squadDisplay.innerText = squad;
    squadDisplay.className = `w-6 h-4 rounded text-[10px] flex items-center justify-center font-bold text-white ${squad === 'B' ? 'bg-squadB' : 'bg-squadA'}`;

    squadLabel.appendChild(document.createTextNode('Sq '));
    squadLabel.appendChild(squadCheck);
    squadLabel.appendChild(squadDisplay);

    div.appendChild(label);
    div.appendChild(driverInput);
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
    const useSquads = document.getElementById('useSquads')?.checked;
    document.querySelectorAll('.squad-toggle-container').forEach(el => 
        el.classList.toggle('hidden', !useSquads)
    );
};

window.toggleFuelInput = function() {
    const trackFuel = document.getElementById('trackFuel');
    const fuelDiv = document.getElementById('fuelInputDiv');
    if (trackFuel && fuelDiv) {
        trackFuel.checked ? fuelDiv.classList.remove('hidden') : fuelDiv.classList.add('hidden');
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
    
    if (timeInput && !timeInput.value && window.previewData.startTime) {
        const dt = new Date(window.previewData.startTime);
        const timeStr = dt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
        timeInput.value = timeStr;
        startRef = dt;
    } else if (timeInput && timeInput.value) {
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

    // === 6. רינדור רשימת הסטינטים ===
    const listHtml = stints.map((stint, index) => {
        const startTime = new Date(currentTimeMs);
        const endTime = new Date(currentTimeMs + stint.duration);
        const durationMin = Math.round(stint.duration / 60000);
        
        const startTimeStr = startTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const endTimeStr = endTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        
        // קידום הזמן
        currentTimeMs += stint.duration;
        
        // בדיקה אם יש פיט אחרי הסטינט הזה
        const pit = pits[index];
        const isLast = index === stints.length - 1;
        
        let pitIndicator = '';
        if (pit && !isLast) {
            const pitSec = Math.round(pit.duration / 1000);
            pitIndicator = `<span class="text-gold text-[10px] ml-1">🔧+${pitSec}s</span>`;
            currentTimeMs += pit.duration;
        }
        
        return `
            <div class="flex items-center gap-2 bg-navy-950 p-2 rounded border-l-4 mb-1 text-xs" style="border-left-color: ${stint.color}">
                <span class="text-gray-500 w-5 text-center font-mono">#${index + 1}</span>
                <div class="flex-1">
                    <div class="font-bold text-white">${stint.driverName}</div>
                    <div class="flex items-center gap-2 text-gray-400 text-[10px]">
                        <span>${startTimeStr}</span>
                        <span class="text-ice">${arrow}</span>
                        <span>${endTimeStr}</span>
                        ${pitIndicator}
                    </div>
                </div>
                <div class="text-gray-300 font-mono">${durationMin}m</div>
                ${isLast ? '🏁' : ''}
            </div>
        `;
    }).join('');
    
    const scheduleEl = document.getElementById('driverScheduleList');
    if (scheduleEl) scheduleEl.innerHTML = listHtml;

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
        
        mainRow.innerHTML = `
            <td class="text-center cursor-pointer p-2 hover:text-ice" onclick="window.toggleLog(${i})">${d.isExpanded ? '▲' : '▼'}</td>
            <td class="py-2 pr-2">${d.name} ${isCurrent ? '🏎️' : ''}</td>
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
    const ms = parseFloat(val) * 60000;
    if (ms > 0) {
        const stints = window.previewData.timeline.filter(t => t.type === 'stint');
        if (stints[idx]) {
            stints[idx].duration = ms;
            window.recalculateTimelineTimes(); 
            window.renderPreview();
        }
    }
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
            setCheck('useSquads', strategy.config.useSquads);
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
        '#nextDriverName', // לחיצה להחלפת נהג
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

    // וידוא שהצ'אט זמין
    document.getElementById('chatToggleBtn').classList.remove('hidden');
};

// ==========================================
// 💬 CHAT SYSTEM
// ==========================================
window.chatUnread = 0;

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
        
        // If user already entered name, go straight to messages
        const savedName = localStorage.getItem('strateger_chat_name');
        if (savedName) {
            document.getElementById('chatLoginView').classList.add('hidden');
            document.getElementById('chatMessagesView').classList.remove('hidden');
            document.getElementById('chatMessagesView').classList.add('flex');
        }
    }
};

window.joinChat = function() {
    const name = document.getElementById('chatUserName').value.trim();
    if (!name) return alert("Name required");
    
    localStorage.setItem('strateger_chat_name', name);
    document.getElementById('chatLoginView').classList.add('hidden');
    document.getElementById('chatMessagesView').classList.remove('hidden');
    document.getElementById('chatMessagesView').classList.add('flex');
};

window.sendChatMessage = function() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    const name = localStorage.getItem('strateger_chat_name') || 'Viewer';
    
    if (!text) return;

    const msgData = {
        type: 'CHAT',
        sender: name,
        text: text,
        role: window.role, // 'host' or 'client'
        timestamp: Date.now()
    };

    // 1. שליחה לרשת
    if (window.role === 'host') {
        window.broadcast(msgData); // Host מפיץ לכולם
    } else {
        if (window.conn && window.conn.open) {
            window.conn.send(msgData); // Client שולח ל-Host
        }
    }

    // 2. הצגה מקומית
    window.renderChatMessage(msgData);
    input.value = '';
};

window.renderChatMessage = function(msg) {
    const feed = document.getElementById('chatFeed');
    
    // Prevent duplicate rendering if reloading history
    const lastMsg = feed.lastElementChild;
    if (lastMsg && lastMsg.dataset.ts == msg.timestamp && lastMsg.innerText.includes(msg.text)) {
        return;
    }

    const div = document.createElement('div');
    div.dataset.ts = msg.timestamp; 
    
    const isMe = msg.sender === (localStorage.getItem('strateger_chat_name') || 'Viewer');
    const isHost = msg.role === 'host';
    
    let bgClass = 'bg-navy-800';
    let alignClass = 'items-start';
    
    if (isHost) {
        bgClass = 'bg-red-900/40 border border-red-500/30';
    } else if (isMe) {
        bgClass = 'bg-blue-900/40 border border-blue-500/30';
        alignClass = 'items-end';
    }

    div.className = `flex flex-col ${alignClass} mb-2`;
    div.innerHTML = `
        <div class="${bgClass} p-2 rounded-lg max-w-[90%]">
            <div class="flex justify-between items-baseline gap-2 mb-1">
                <span class="font-bold ${isHost ? 'text-red-400' : 'text-ice'} text-[10px]">
                    ${isHost ? '👑 ' : ''}${msg.sender}
                </span>
                <span class="text-[9px] text-gray-500">${new Date(msg.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
            </div>
            <div class="text-white break-words">${msg.text}</div>
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
            if (history.length > 50) history.shift(); 
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