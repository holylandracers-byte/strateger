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
    
    // קביעת זמן התחלה תקין
    let startRef = new Date();
    const timeInput = document.getElementById('raceStartTime');
    if (timeInput && timeInput.value) {
        const [h, m] = timeInput.value.split(':');
        startRef.setHours(h, m, 0, 0);
    } else if (window.previewData.startTime && !isNaN(new Date(window.previewData.startTime).getTime())) {
        startRef = new Date(window.previewData.startTime);
    }
    
    let currentTimeMs = startRef.getTime();
    
    // מיפוי הסטינטים
    const actualStints = timeline.filter(t => t.type === 'stint').map(stint => {
        const start = new Date(currentTimeMs);
        const end = new Date(currentTimeMs + stint.duration);
        currentTimeMs += stint.duration;
        
        const pit = timeline.find(p => p.type === 'pit' && p.pitNumber === stint.stintNumber);
        if (pit) currentTimeMs += pit.duration;
        
        return { ...stint, startTime: start, endTime: end, hasPit: !!pit };
    });

    const endTime = new Date(currentTimeMs);
    
    // עדכון טקסטים
    const startEl = document.getElementById('timelineStart');
    const endEl = document.getElementById('timelineEnd');
    if (startEl) startEl.innerText = startRef.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    if (endEl) endEl.innerText = endTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

    // בניית הרשימה
    const listHtml = actualStints.map((stint, index) => {
        const durationMin = Math.round(stint.duration / 60000);
        const isLast = index === actualStints.length - 1;
        
        let endIcon = '';
        if (stint.hasPit) endIcon = '<span class="text-xs text-gold ml-1">🔧</span>';
        else if (isLast) endIcon = '<span class="text-lg ml-1" title="Finish">🏁</span>';

        const isRtl = document.documentElement.dir === 'rtl';
        const arrow = isRtl ? '←' : '→';

        return `
            <div class="stint-row flex items-center gap-2 bg-navy-950 p-2 rounded border-l-4 hover:bg-navy-900 transition mb-1" 
                style="border-left-color: ${stint.color}"
                draggable="true" data-index="${index}"
                ondragstart="window.handleDragStart(event)" ondragover="window.handleDragOver(event)"
                ondragleave="window.handleDragLeave(event)" ondrop="window.handleDrop(event)">
                
                <div class="cursor-grab text-gray-600 px-1">⋮</div>
                <span class="text-xs text-gray-500 w-5">#${stint.stintNumber}</span>
                
                <div class="flex-1 min-w-0 pointer-events-none">
                    <span class="font-bold text-white block truncate text-sm">${stint.driverName}</span>
                    <div class="flex items-center gap-1 text-[10px] text-gray-400">
                        <span>${stint.startTime.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                        <span class="text-gray-600 font-bold mx-1">${arrow}</span>
                        <span>${stint.endTime.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                </div>

                <div class="flex items-center gap-1">
                    <input type="number" value="${durationMin}" 
                        class="w-12 bg-navy-800 border border-navy-600 rounded text-center text-xs text-white"
                        onchange="window.updateStintDuration(${index}, this.value)">
                    <span class="text-[10px] text-gray-500">m</span>
                </div>
                ${endIcon}
            </div>
        `;
    }).join('');

    const scheduleEl = document.getElementById('driverScheduleList');
    if (scheduleEl) scheduleEl.innerHTML = listHtml;

    // סיכום נהגים (עם הפורמט החדש)
    const summary = {};
    actualStints.forEach(s => {
        if (!summary[s.driverName]) summary[s.driverName] = { time: 0, stints: 0, color: s.color };
        summary[s.driverName].time += s.duration;
        summary[s.driverName].stints += 1;
    });

    const summaryHtml = Object.entries(summary).map(([name, data]) => {
        return `
            <div class="bg-navy-800 p-2 rounded border-l-2 text-center" style="border-color: ${data.color}">
                <div class="text-xs font-bold text-white truncate">${name}</div>
                <div class="text-lg text-neon font-mono">${formatHours(data.time)}</div>
                <div class="text-[10px] text-gray-400">${data.stints} stints</div>
            </div>
        `;
    }).join('');
    
    const summaryEl = document.getElementById('strategySummary');
    if (summaryEl) summaryEl.innerHTML = summaryHtml;

    // עדכון כפתורים עם תרגום
    const btnContainer = document.querySelector('#previewScreen .flex.gap-3');
    if (btnContainer) {
        btnContainer.innerHTML = `
            <button onclick="window.closePreview()" class="flex-1 bg-navy-700 hover:bg-navy-600 text-white font-bold py-3 rounded">
                ${window.t('editStrategy') || 'Edit'}
            </button>
            <button onclick="window.saveStrategy()" class="flex-1 bg-gold/20 hover:bg-gold/30 text-gold font-bold py-3 rounded border border-gold/50">
                ${window.t('saveStrategy') || 'Save'}
            </button>
            <button onclick="window.initRace()" class="flex-1 bg-gradient-to-r from-neon to-green-400 text-black font-bold py-3 rounded shadow-lg">
                ${window.t('startRace') || 'Start Race'}
            </button>
        `;
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

// ביצוע השמירה בפועל (ל-LocalStorage)
window.performStrategySave = function() {
    const name = document.getElementById('saveStrategyName').value || 'Untitled';
    const visibility = document.querySelector('input[name="strategyVisibility"]:checked')?.value || 'private';
    
    if (!window.cachedStrategy) return alert("No strategy generated yet!");

    const strategyData = {
        id: Date.now().toString(),
        name: name,
        type: visibility,
        config: window.config, // ההגדרות שיצרו את האסטרטגיה
        drivers: window.drivers, // הנהגים
        timeline: window.cachedStrategy.timeline, // התוצאה
        timestamp: new Date().toISOString()
    };

    // שליפה, הוספה ושמירה מחדש ל-LocalStorage
    try {
        const saved = JSON.parse(localStorage.getItem('strateger_strategies') || '[]');
        saved.push(strategyData);
        localStorage.setItem('strateger_strategies', JSON.stringify(saved));
        
        alert(window.t('strategySaved') || 'Strategy Saved Successfully!');
        window.closeSaveStrategyModal();
    } catch (e) {
        console.error("Save failed:", e);
        alert("Save failed: " + e.message);
    }
};