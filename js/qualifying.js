// ==========================================
// 🔵 QUALIFYING MODE
// ==========================================

window.QUALIFY_STATE_KEY = 'strateger_qualify_state';

window._qualifyState = null;
window._qualifyInterval = null;

window._qualifyConfig = {
    format: 'segments',
    segments: 3,
    participation: 'all',
    multiCount: 2,
    selectedDrivers: null, // null = all; Set of driver names for 'multi' mode
    pitRule: 'none',
    pitMinSec: 30
};

// ─── Persistence ─────────────────────────────────────────────────────────────

window.saveQualifyState = function() {
    if (!window._qualifyState) return;
    try {
        const snap = {
            qualifyState: window._qualifyState,
            qualifyTeamStatus: window._qualifyTeamStatus || {},
            qualifyConfig: window._qualifyConfig,
            qlSegDurations: window._qlSegDurations || {},
            savedAt: Date.now()
        };
        localStorage.setItem(window.QUALIFY_STATE_KEY, JSON.stringify(snap));
    } catch(e) {}
};

window.clearQualifyState = function() {
    localStorage.removeItem(window.QUALIFY_STATE_KEY);
};

window.restoreQualifyState = function() {
    try {
        const raw = localStorage.getItem(window.QUALIFY_STATE_KEY);
        if (!raw) return false;
        const snap = JSON.parse(raw);
        if (!snap || !snap.qualifyState || (Date.now() - snap.savedAt) > 4 * 3600000) {
            window.clearQualifyState();
            return false;
        }
        const qs = snap.qualifyState;
        const gap = Date.now() - snap.savedAt;
        qs.sessionStartMs = (qs.sessionStartMs || snap.savedAt) - gap;
        qs.runStartMs = Date.now();
        window._qualifyState = qs;
        window._qualifyTeamStatus = snap.qualifyTeamStatus || {};
        window._qualifyConfig = snap.qualifyConfig || window._qualifyConfig;
        window._qlSegDurations = snap.qlSegDurations || {};
        return true;
    } catch(e) {
        window.clearQualifyState();
        return false;
    }
};

// Emergency-save on page hide/unload
if (!window.__qualifyPersistenceHookAttached) {
    window.__qualifyPersistenceHookAttached = true;
    const _qSave = () => { try { window.saveQualifyState(); } catch(e) {} };
    window.addEventListener('pagehide', _qSave);
    window.addEventListener('beforeunload', _qSave);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') _qSave();
    });
}

// ─── Settings toggles ─────────────────────────────────────────────────────────

window.setQualifyFormat = function(fmt) {
    window._qualifyConfig.format = fmt;
    const simBtn = document.getElementById('qfmtSimpleBtn');
    const segBtn = document.getElementById('qfmtSegmentsBtn');
    const segRow = document.getElementById('qSegmentCountRow');
    if (simBtn) { simBtn.classList.toggle('bg-blue-600', fmt === 'simple'); simBtn.classList.toggle('text-white', fmt === 'simple'); simBtn.classList.toggle('bg-transparent', fmt !== 'simple'); simBtn.classList.toggle('text-gray-400', fmt !== 'simple'); }
    if (segBtn) { segBtn.classList.toggle('bg-blue-600', fmt === 'segments'); segBtn.classList.toggle('text-white', fmt === 'segments'); segBtn.classList.toggle('bg-transparent', fmt !== 'segments'); segBtn.classList.toggle('text-gray-400', fmt !== 'segments'); }
    if (segRow) segRow.classList.toggle('hidden', fmt !== 'segments');
    window.updateQualifyPreview && window.updateQualifyPreview();
    window.saveHostState && window.saveHostState();
};

window.setQSegments = function(n) {
    window._qualifyConfig.segments = n;
    [1, 2, 3].forEach(i => {
        const btn = document.getElementById(`qSeg${i}Btn`);
        if (!btn) return;
        btn.classList.toggle('bg-blue-600', i === n); btn.classList.toggle('text-white', i === n); btn.classList.toggle('border-blue-500', i === n);
        btn.classList.toggle('bg-transparent', i !== n); btn.classList.toggle('text-gray-400', i !== n); btn.classList.toggle('border-gray-600', i !== n);
    });
    window.updateQualifyPreview && window.updateQualifyPreview();
    window.saveHostState && window.saveHostState();
};

window._rebuildQDriverPicker = function() {
    const list = document.getElementById('qDriverPickerList');
    if (!list) return;
    if (typeof window.updateDriversFromUI === 'function') window.updateDriversFromUI();
    const drivers = window.drivers || [];
    if (!window._qualifyConfig.selectedDrivers) {
        window._qualifyConfig.selectedDrivers = new Set(drivers.map(d => d.name));
    }
    // Keep only valid driver names
    const validNames = new Set(drivers.map(d => d.name));
    window._qualifyConfig.selectedDrivers.forEach(n => { if (!validNames.has(n)) window._qualifyConfig.selectedDrivers.delete(n); });

    list.innerHTML = '';
    drivers.forEach(d => {
        const selected = window._qualifyConfig.selectedDrivers.has(d.name);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = `text-[10px] font-bold px-2 py-1 rounded-full border transition-all ${
            selected ? 'border-blue-500 bg-blue-600/30 text-blue-300' : 'border-gray-600 bg-transparent text-gray-500'
        }`;
        chip.style.borderLeftColor = d.color || '';
        chip.style.borderLeftWidth = '3px';
        chip.textContent = d.name;
        chip.onclick = () => {
            if (window._qualifyConfig.selectedDrivers.has(d.name)) {
                if (window._qualifyConfig.selectedDrivers.size > 1) {
                    window._qualifyConfig.selectedDrivers.delete(d.name);
                }
            } else {
                window._qualifyConfig.selectedDrivers.add(d.name);
            }
            window._rebuildQDriverPicker();
            window.updateQualifyPreview && window.updateQualifyPreview();
        };
        list.appendChild(chip);
    });
};

window.setQParticipation = function(mode) {
    window._qualifyConfig.participation = mode;
    const ids = { one: 'qpartOneBtn', multi: 'qpartMultiBtn', all: 'qpartAllBtn' };
    Object.entries(ids).forEach(([m, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('bg-blue-600', m === mode); btn.classList.toggle('text-white', m === mode);
        btn.classList.toggle('bg-transparent', m !== mode); btn.classList.toggle('text-gray-400', m !== mode);
    });
    const multiRow = document.getElementById('qMultiCountRow');
    if (multiRow) multiRow.classList.toggle('hidden', mode !== 'multi');
    if (mode === 'multi') {
        // Reset selection to all drivers when opening picker
        if (typeof window.updateDriversFromUI === 'function') window.updateDriversFromUI();
        window._qualifyConfig.selectedDrivers = new Set((window.drivers || []).map(d => d.name));
        window._rebuildQDriverPicker();
    }
    window.updateQualifyPreview && window.updateQualifyPreview();
    window.saveHostState && window.saveHostState();
};

window.setQPitRule = function(rule) {
    window._qualifyConfig.pitRule = rule;
    const ids = { none: 'qpitNoneBtn', any: 'qpitAnyBtn', min: 'qpitMinBtn' };
    Object.entries(ids).forEach(([r, id]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('bg-blue-600', r === rule); btn.classList.toggle('text-white', r === rule);
        btn.classList.toggle('bg-transparent', r !== rule); btn.classList.toggle('text-gray-400', r !== rule);
    });
    const minRow = document.getElementById('qPitMinTimeRow');
    if (minRow) minRow.classList.toggle('hidden', rule !== 'min');
    window.updateQualifyPreview && window.updateQualifyPreview();
    window.saveHostState && window.saveHostState();
};

// ─── Session mode toggle (Race / Qualifying) ──────────────────────────────────

window.setSessionMode = function(mode) {
    window._sessionMode = mode;
    const raceBtn = document.getElementById('modeRaceBtn');
    const qualBtn = document.getElementById('modeQualifyBtn');
    const qualifyPanel = document.getElementById('qualifyingPanel');
    const simResult = document.getElementById('simResult');
    const startRaceBtn = document.getElementById('startRaceBtn');
    const startQualifyBtn = document.getElementById('startQualifyBtn');

    [raceBtn, qualBtn].forEach(btn => {
        if (!btn) return;
        btn.classList.remove('bg-ice', 'text-navy-950', 'bg-blue-600', 'text-white');
        btn.classList.add('text-gray-400');
    });

    if (mode === 'qualify') {
        qualBtn && qualBtn.classList.add('bg-blue-600', 'text-white');
        qualBtn && qualBtn.classList.remove('text-gray-400');
        qualifyPanel && qualifyPanel.classList.remove('hidden');
        simResult && simResult.classList.add('hidden');
        startRaceBtn && startRaceBtn.classList.add('hidden');
        startQualifyBtn && startQualifyBtn.classList.remove('hidden');
        window.updateQualifyPreview();
    } else {
        raceBtn && raceBtn.classList.add('bg-ice', 'text-navy-950');
        raceBtn && raceBtn.classList.remove('text-gray-400');
        qualifyPanel && qualifyPanel.classList.add('hidden');
        simResult && simResult.classList.remove('hidden');
        startRaceBtn && startRaceBtn.classList.remove('hidden');
        startQualifyBtn && startQualifyBtn.classList.add('hidden');
    }
};

// ─── Preview ──────────────────────────────────────────────────────────────────

window.updateQualifyPreview = function() {
    if (typeof window.updateDriversFromUI === 'function') window.updateDriversFromUI();
    const drivers = window.drivers || [];
    const cfg = window._qualifyConfig;
    const totalMin = parseInt(document.getElementById('qualifyDuration')?.value) || 15;
    const runs = parseInt(document.getElementById('qualifyRuns')?.value) || 1;
    const preview = document.getElementById('qualifyStrategyPreview');
    if (!preview) return;

    // Keep driver picker in sync when in multi mode
    if (cfg.participation === 'multi') {
        window._rebuildQDriverPicker();
    }

    if (!drivers.length) { preview.innerHTML = '<span class="text-gray-500">Add drivers to see qualifying strategy</span>'; return; }

    let activeDrivers;
    if (cfg.participation === 'one') {
        activeDrivers = [drivers[0]];
    } else if (cfg.participation === 'multi') {
        const sel = cfg.selectedDrivers;
        activeDrivers = sel ? drivers.filter(d => sel.has(d.name)) : drivers;
        if (!activeDrivers.length) activeDrivers = drivers.slice(0, 2);
    } else {
        activeDrivers = drivers;
    }

    const totalRuns = activeDrivers.length * runs;
    const timePerRun = Math.floor((totalMin * 60) / Math.max(totalRuns, 1));
    const mins = Math.floor(timePerRun / 60);
    const secs = timePerRun % 60;
    const segCount = cfg.format === 'segments' ? cfg.segments : 1;
    const segLabels = segCount > 1 ? Array.from({length: segCount}, (_, i) => `Q${i+1}`).join(' → ') : '';
    const pitInfo = cfg.pitRule === 'none' ? 'No pit required'
        : cfg.pitRule === 'any' ? 'Pit stop required'
        : `Pit ≥ ${parseInt(document.getElementById('qPitMinTime')?.value) || 30}s`;

    let html = `<div class="font-bold text-blue-400 mb-1">${activeDrivers.length} driver(s) × ${runs} run(s) = ${totalRuns} total · ${mins}:${String(secs).padStart(2,'0')}/run</div>`;
    if (segCount > 1) html += `<div class="text-blue-300 mb-1">${segLabels}</div>`;
    html += `<div class="text-gray-500 mb-1">${pitInfo}</div>`;
    activeDrivers.forEach(d => {
        for (let r = 1; r <= runs; r++) {
            html += `<div class="flex justify-between"><span>${d.name}</span><span class="text-gray-500">Run ${r}</span></div>`;
        }
    });
    preview.innerHTML = html;
};

// ─── Launch ───────────────────────────────────────────────────────────────────

window.startQualifyingDirect = function() {
    if (typeof window.updateDriversFromUI === 'function') window.updateDriversFromUI();
    const drivers = window.drivers || [];
    if (!drivers.length) { window.showToast && window.showToast('Add drivers first!', 'warning'); return; }

    const cfg = window._qualifyConfig;
    const durationMin = parseInt(document.getElementById('qualifyDuration')?.value) || 15;
    const runs = parseInt(document.getElementById('qualifyRuns')?.value) || 1;

    let activeDrivers;
    if (cfg.participation === 'one') {
        activeDrivers = [drivers[0]];
    } else if (cfg.participation === 'multi') {
        const sel = cfg.selectedDrivers;
        activeDrivers = sel ? drivers.filter(d => sel.has(d.name)) : drivers;
        if (!activeDrivers.length) activeDrivers = drivers.slice(0, 2);
    } else {
        activeDrivers = drivers;
    }

    const segCount = cfg.format === 'segments' ? (cfg.segments || 3) : 1;
    window._qlSegDurations = {};
    if (cfg.format === 'segments' && segCount > 1) {
        const weights = [1.4, 1.0, 0.8].slice(0, segCount);
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        weights.forEach((w, i) => {
            window._qlSegDurations[i + 1] = Math.max(5, Math.round((durationMin * w) / totalWeight));
        });
    } else {
        window._qlSegDurations[1] = durationMin;
    }

    window.initQualifyingWithSegDurations(activeDrivers, runs, segCount);
};

window.initQualifyingWithSegDurations = function(activeDrivers, runs, segCount) {
    const q1DurMs = (window._qlSegDurations?.[1] || 15) * 60000;
    const totalRuns = activeDrivers.length * runs;
    const timePerRunMs = Math.floor(q1DurMs / Math.max(totalRuns, 1));

    const schedule = [];
    for (let r = 0; r < runs; r++) {
        activeDrivers.forEach((d, i) => {
            schedule.push({ driverIdx: i, run: r + 1, driverName: d.name, color: d.color, segment: 1 });
        });
    }

    window._qualifyTeamStatus = {};
    window._qualifyState = {
        schedule,
        currentIdx: 0,
        timePerRunMs,
        sessionDurationMs: q1DurMs,
        sessionStartMs: Date.now(),
        runStartMs: Date.now(),
        log: [],
        cfg: { ...window._qualifyConfig, segCount },
        currentSegment: 1
    };

    document.getElementById('qualifyNextSegmentPanel')?.classList.add('hidden');
    const qDash = document.getElementById('qualifyingDashboard');
    if (qDash) { qDash.classList.remove('hidden'); qDash.style.display = 'flex'; }
    window.saveQualifyState();
    window._qualifyRenderStageResults();
    window._qualifyRenderTick();
    if (window._qualifyInterval) clearInterval(window._qualifyInterval);
    window._qualifyInterval = setInterval(window._qualifyRenderTick, 500);
};

// ─── Render ───────────────────────────────────────────────────────────────────

window._qualifyTeamStatus = {};

window._qualifyRenderStageResults = function() {
    const qs = window._qualifyState;
    const el = document.getElementById('qualifyStageResults');
    if (!el || !qs) return;
    const fmt = ms => { const s = Math.floor(ms/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
    const status = window._qualifyTeamStatus;
    const drivers = Object.keys(status);
    if (!drivers.length) { el.innerHTML = '<div class="p-3 text-xs text-gray-600">No logged runs yet</div>'; return; }
    const sorted = drivers.slice().sort((a, b) => {
        const bestA = status[a].times.length ? Math.min(...status[a].times) : Infinity;
        const bestB = status[b].times.length ? Math.min(...status[b].times) : Infinity;
        return bestA - bestB;
    });
    const advancedCount = sorted.filter(n => status[n].advanced).length;
    const countEl = document.getElementById('qualifyAdvancedCount');
    if (countEl) { countEl.textContent = `${advancedCount} advanced`; countEl.classList.toggle('hidden', advancedCount === 0); }

    el.innerHTML = sorted.map((name, i) => {
        const d = status[name];
        const best = d.times.length ? Math.min(...d.times) : null;
        const adv = d.advanced;
        return `<div class="flex items-center gap-2 px-3 py-2 ${adv ? 'bg-green-950/30' : ''}">
            <span class="text-[10px] text-gray-600 font-mono w-4 shrink-0">${i + 1}</span>
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${d.color||'#60a5fa'}"></span>
            <span class="flex-1 text-xs font-bold ${adv ? 'text-green-300' : 'text-white'} truncate">${name}</span>
            <span class="text-xs font-mono ${best ? 'text-neon' : 'text-gray-600'}">${best ? fmt(best) : '--:--'}</span>
            <button onclick="window.toggleQualifyAdvance('${name.replace(/'/g,"\\'")}')
" class="ml-1 text-[10px] px-1.5 py-0.5 rounded font-bold transition ${adv ? 'bg-green-600/30 text-green-400 border border-green-600/50' : 'bg-navy-700 text-gray-500 border border-gray-600'}">${adv ? '✓' : '+'}</button>
        </div>`;
    }).join('');
};

window.toggleQualifyAdvance = function(name) {
    if (!window._qualifyTeamStatus[name]) return;
    window._qualifyTeamStatus[name].advanced = !window._qualifyTeamStatus[name].advanced;
    window._qualifyRenderStageResults();
};

window._qualifyRenderTick = function() {
    const qs = window._qualifyState;
    if (!qs) return;

    const now = Date.now();
    if (!window._qualifyLastSave || now - window._qualifyLastSave > 5000) {
        window._qualifyLastSave = now;
        window.saveQualifyState();
    }

    const sessionElapsed = now - qs.sessionStartMs;
    const sessionLeft = Math.max(0, qs.sessionDurationMs - sessionElapsed);
    const runElapsed = now - qs.runStartMs;
    const runLeft = Math.max(0, qs.timePerRunMs - runElapsed);

    const fmt = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

    const timerEl = document.getElementById('qualifyTimerDisplay');
    if (timerEl) timerEl.textContent = fmt(runLeft);
    const sessionEl = document.getElementById('qualifySessionTimer');
    if (sessionEl) sessionEl.textContent = fmt(sessionLeft);

    if (qs.currentIdx < qs.schedule.length) {
        const cur = qs.schedule[qs.currentIdx];
        const driverEl = document.getElementById('qualifyCurrentDriver');
        const dotEl = document.getElementById('qualifyCurrentDriverDot');
        const runDisplayEl = document.getElementById('qualifyRunDisplay');
        if (driverEl) driverEl.textContent = cur.driverName;
        if (dotEl) dotEl.style.background = cur.color || '#60a5fa';
        if (runDisplayEl) runDisplayEl.textContent = `${qs.currentIdx + 1}/${qs.schedule.length}`;

        const segLabelEl = document.getElementById('qualifySegmentLabel');
        if (segLabelEl) {
            if (qs.cfg && qs.cfg.segCount > 1) {
                segLabelEl.textContent = `Q${qs.currentSegment || 1}`;
                segLabelEl.classList.remove('hidden');
            } else {
                segLabelEl.classList.add('hidden');
            }
        }

        const nextList = document.getElementById('qualifyNextList');
        if (nextList) {
            const upcoming = qs.schedule.slice(qs.currentIdx + 1, qs.currentIdx + 4);
            nextList.innerHTML = upcoming.length
                ? upcoming.map(x => `<div class="flex items-center gap-2 text-gray-400"><span class="w-2 h-2 rounded-full shrink-0" style="background:${x.color||'#4ade80'}"></span>${x.driverName} <span class="text-[10px] text-gray-600 ml-auto">Run ${x.run}</span></div>`).join('')
                : `<span class="text-gray-600 text-xs">Last run</span>`;
        }
    }

    if (typeof window._qualifyRenderRaceLikeWidgets === 'function') {
        window._qualifyRenderRaceLikeWidgets(runLeft);
    }

    if (sessionLeft <= 0) {
        const segPanel = document.getElementById('qualifyNextSegmentPanel');
        if (segPanel && qs && qs.cfg.segCount > 1 && (qs.currentSegment || 1) < qs.cfg.segCount) {
            segPanel.classList.remove('hidden');
            const nextSegDurEl = document.getElementById('qualifyNextSegmentDuration');
            if (nextSegDurEl && !nextSegDurEl.value) nextSegDurEl.value = Math.round(qs.sessionDurationMs / 60000);
            clearInterval(window._qualifyInterval);
            window._qualifyInterval = null;
        } else {
            window.stopQualifying(true);
        }
    }
};

window._qualifyRenderRaceLikeWidgets = function(runLeftMs) {
    const qs = window._qualifyState;
    if (!qs) return;

    const fmt = ms => {
        const s = Math.max(0, Math.floor(ms / 1000));
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };

    const targetEl = document.getElementById('qualifyTargetStint');
    if (targetEl) targetEl.textContent = fmt(runLeftMs || 0);

    const nextDriverEl = document.getElementById('qualifyNextDriverQuick');
    if (nextDriverEl) {
        const next = qs.schedule[qs.currentIdx + 1];
        nextDriverEl.textContent = next ? next.driverName : ((window.t && window.t('qualifyLastRun')) || 'Last run');
    }

    const posEl = document.getElementById('qualifyLivePos');
    if (posEl) posEl.textContent = window.liveData?.position || '-';

    const bestEl = document.getElementById('qualifyLiveBest');
    if (bestEl) {
        bestEl.textContent = (window.liveData?.bestLap && window.formatLapTime)
            ? window.formatLapTime(window.liveData.bestLap)
            : '--';
    }

    const statsEl = document.getElementById('qualifyStatsTable');
    if (statsEl) {
        const status = window._qualifyTeamStatus || {};
        const rows = Object.keys(status).map(name => {
            const d = status[name] || {};
            const runs = Array.isArray(d.times) ? d.times.length : 0;
            const best = runs ? Math.min(...d.times) : null;
            return { name, runs, best, color: d.color || '#60a5fa' };
        }).sort((a, b) => {
            if (a.best == null && b.best == null) return a.name.localeCompare(b.name);
            if (a.best == null) return 1;
            if (b.best == null) return -1;
            return a.best - b.best;
        });

        if (rows.length === 0) {
            statsEl.innerHTML = `<tr><td colspan="3" class="p-2 text-center text-gray-600 text-[10px]">No runs yet</td></tr>`;
        } else {
            statsEl.innerHTML = rows.map(r => `
                <tr>
                    <td class="p-1.5">
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="w-2 h-2 rounded-full shrink-0" style="background:${r.color}"></span>
                            <span class="truncate text-white">${r.name}</span>
                        </div>
                    </td>
                    <td class="p-1.5 text-center font-mono text-gray-300">${r.runs}</td>
                    <td class="p-1.5 text-right font-mono text-neon">${r.best != null && window.formatLapTime ? window.formatLapTime(r.best) : '--'}</td>
                </tr>
            `).join('');
        }
    }
};

// ─── Run / segment advancement ────────────────────────────────────────────────

window._qualifyPitInterval = null;
window._qualifyPitStartMs = null;

window._qualifyShowPitDock = function(minSec) {
    const dock = document.getElementById('qualifyPitDock');
    const timer = document.getElementById('qualifyPitTimer');
    const exitBtn = document.getElementById('qualifyPitExitBtn');
    if (!dock) return;
    dock.classList.remove('hidden');
    if (exitBtn) exitBtn.disabled = true;
    window._qualifyPitStartMs = Date.now();
    clearInterval(window._qualifyPitInterval);
    window._qualifyPitInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - window._qualifyPitStartMs) / 1000);
        const remaining = Math.max(0, minSec - elapsed);
        if (timer) {
            timer.textContent = remaining > 0
                ? `-${String(Math.floor(remaining / 60)).padStart(2,'0')}:${String(remaining % 60).padStart(2,'0')}`
                : `+${String(Math.floor(elapsed / 60)).padStart(2,'0')}:${String(elapsed % 60).padStart(2,'0')}`;
            timer.classList.toggle('text-green-400', remaining === 0);
            timer.classList.toggle('text-yellow-400', remaining > 0);
        }
        if (exitBtn) exitBtn.disabled = remaining > 0;
    }, 500);
};

window._qualifyHidePitDock = function() {
    clearInterval(window._qualifyPitInterval);
    window._qualifyPitInterval = null;
    const dock = document.getElementById('qualifyPitDock');
    if (dock) dock.classList.add('hidden');
};

window._qualifyExecuteNextRun = function() {
    const qs = window._qualifyState;
    if (!qs) return;

    if (qs.currentIdx < qs.schedule.length) {
        const cur = qs.schedule[qs.currentIdx];
        const timeMs = Date.now() - qs.runStartMs;
        qs.log.push({ ...cur, timeMs });
        if (!window._qualifyTeamStatus[cur.driverName]) {
            window._qualifyTeamStatus[cur.driverName] = { advanced: false, times: [], color: cur.color };
        }
        window._qualifyTeamStatus[cur.driverName].times.push(timeMs);
        window._qualifyRenderStageResults();
    }

    qs.currentIdx++;
    qs.runStartMs = Date.now();
    window.saveQualifyState();

    if (qs.currentIdx >= qs.schedule.length) {
        const segPanel = document.getElementById('qualifyNextSegmentPanel');
        if (segPanel && qs.cfg.segCount > 1 && (qs.currentSegment || 1) < qs.cfg.segCount) {
            segPanel.classList.remove('hidden');
            clearInterval(window._qualifyInterval);
            window._qualifyInterval = null;
        } else {
            window.stopQualifying(true);
        }
    }
};

window.qualifyNextRun = function() {
    const qs = window._qualifyState;
    if (!qs) return;
    const pitRule = qs.cfg?.pitRule || 'none';
    const pitMinSec = parseInt(qs.cfg?.pitMinSec) || 30;

    // If pit dock is already visible, ignore — user must exit via pit exit button
    const pitDock = document.getElementById('qualifyPitDock');
    if (pitRule !== 'none' && pitDock && !pitDock.classList.contains('hidden')) return;

    if (pitRule !== 'none') {
        window._qualifyHidePitDock();
        window._qualifyShowPitDock(pitMinSec);
        // Record the run time immediately but delay advancement to pit exit
        if (qs.currentIdx < qs.schedule.length) {
            const cur = qs.schedule[qs.currentIdx];
            const timeMs = Date.now() - qs.runStartMs;
            qs.log.push({ ...cur, timeMs });
            if (!window._qualifyTeamStatus[cur.driverName]) {
                window._qualifyTeamStatus[cur.driverName] = { advanced: false, times: [], color: cur.color };
            }
            window._qualifyTeamStatus[cur.driverName].times.push(timeMs);
            window._qualifyRenderStageResults();
            qs.currentIdx++;
            qs.runStartMs = Date.now();
            window.saveQualifyState();
        }
    } else {
        window._qualifyExecuteNextRun();
    }
};

window.qualifyEnterPit = function() {
    const qs = window._qualifyState;
    if (!qs) return;
    const pitDock = document.getElementById('qualifyPitDock');
    if (pitDock && !pitDock.classList.contains('hidden')) return;

    const minSec = parseInt(qs.cfg?.pitMinSec) || 30;
    window._qualifyShowPitDock(minSec);
    window.showToast && window.showToast(
        (window.t && window.t('inPit')) || 'In Pit',
        'info',
        1500
    );
};

window.qualifyPitExit = function() {
    window._qualifyHidePitDock();
    const qs = window._qualifyState;
    if (!qs) return;
    if (qs.currentIdx >= qs.schedule.length) {
        const segPanel = document.getElementById('qualifyNextSegmentPanel');
        if (segPanel && qs.cfg.segCount > 1 && (qs.currentSegment || 1) < qs.cfg.segCount) {
            segPanel.classList.remove('hidden');
            clearInterval(window._qualifyInterval);
            window._qualifyInterval = null;
        } else {
            window.stopQualifying(true);
        }
    }
};

window.startNextQSegment = function() {
    const qs = window._qualifyState;
    if (!qs) return;
    const nextSeg = (qs.currentSegment || 1) + 1;
    if (nextSeg > qs.cfg.segCount) return;

    const advancedNames = Object.keys(window._qualifyTeamStatus).filter(n => window._qualifyTeamStatus[n].advanced);
    const allDrivers = window.drivers || [];
    const advancedDrivers = advancedNames.length
        ? allDrivers.filter(d => advancedNames.includes(d.name))
        : allDrivers;

    if (!advancedDrivers.length) {
        window.showToast && window.showToast('Mark at least one driver as advanced first.', 'warning');
        return;
    }

    const segDurFromConfig = window._qlSegDurations?.[nextSeg];
    const newDurMin = segDurFromConfig || parseInt(document.getElementById('qualifyNextSegmentDuration')?.value) || Math.round(qs.sessionDurationMs / 60000);
    const nextDurEl = document.getElementById('qualifyNextSegmentDuration');
    if (nextDurEl && !nextDurEl._userEdited) nextDurEl.value = newDurMin;
    const runs = qs.schedule.filter(s => s.driverName === qs.schedule[0]?.driverName).length || 1;
    const totalRuns = advancedDrivers.length * runs;
    const timePerRunMs = Math.floor((newDurMin * 60000) / Math.max(totalRuns, 1));

    const schedule = [];
    for (let r = 0; r < runs; r++) {
        advancedDrivers.forEach((d, i) => schedule.push({ driverIdx: i, run: r + 1, driverName: d.name, color: d.color, segment: nextSeg }));
    }

    window._qualifyState = { ...qs, schedule, currentIdx: 0, timePerRunMs, sessionDurationMs: newDurMin * 60000, sessionStartMs: Date.now(), runStartMs: Date.now(), currentSegment: nextSeg };

    document.getElementById('qualifyNextSegmentPanel')?.classList.add('hidden');
    window.saveQualifyState();
    window._qualifyRenderTick();
    if (window._qualifyInterval) clearInterval(window._qualifyInterval);
    window._qualifyInterval = setInterval(window._qualifyRenderTick, 500);
    window.showToast && window.showToast(`Q${nextSeg} started — ${advancedDrivers.length} drivers`, 'info');
};

window.stopQualifying = function(offerRace) {
    if (window._qualifyInterval) { clearInterval(window._qualifyInterval); window._qualifyInterval = null; }
    window._qualifyHidePitDock();
    window.clearQualifyState();
    const qDash = document.getElementById('qualifyingDashboard');
    if (qDash) { qDash.classList.add('hidden'); qDash.style.display = ''; }
    document.getElementById('qualifyNextSegmentPanel')?.classList.add('hidden');
    document.getElementById('setupScreen')?.classList.remove('hidden');
    document.getElementById('raceDashboard')?.classList.add('hidden');
    window._qualifyState = null;
    window._qualifyTeamStatus = {};
    if (offerRace) {
        window._sessionMode = 'race';
        window.setSessionMode('race');
        window.showToast && window.showToast(
            (window.t && window.t('qualifyDoneStartRace')) || 'Qualifying done — configure race settings and Start Race!',
            'info', 6000
        );
    }
};
