// ==========================================
// 🧠 STRATEGY ENGINE (Pit Window Pre-Planning)
// ==========================================

window.updateDriversFromUI = function() {
    const inputs = document.querySelectorAll('.driver-input');
    const squads = document.querySelectorAll('.squad-toggle');
    const radios = document.querySelectorAll('.starter-radio');
    if (!inputs.length) return;

    let starterIdx = 0;
    radios.forEach((r, i) => { if (r.checked) starterIdx = i; });

    window.drivers = Array.from(inputs).map((input, i) => {
        const existingColor = (window.drivers && window.drivers[i]) ? window.drivers[i].color : `hsl(${(i * 360 / inputs.length)}, 70%, 50%)`;
        return {
            name: input.value || `Driver ${i+1}`,
            isStarter: i === starterIdx,
            squad: squads[i]?.checked ? 'B' : 'A',
            color: existingColor,
            totalTime: 0,
            stints: 0,
            logs: []
        };
    });
};

window.isNightPhase = function(dateTime) {
    const hour = dateTime.getHours();
    return hour >= 23 || hour < 8;
};

window.getDriverRestTime = function(driverIdx, currentTime, driverStats) {
    const lastEnd = driverStats[driverIdx].lastStintEnd;
    if (!lastEnd) return Infinity;
    return currentTime.getTime() - lastEnd.getTime();
};

window.getSquadContinuousDriveTime = function(squadLetter, timeline) {
    let totalMs = 0;
    for (let i = timeline.length - 1; i >= 0; i--) {
        const item = timeline[i];
        if (item.type !== 'stint') continue;
        const driver = window.drivers[item.driverIdx];
        if (driver && driver.squad === squadLetter) {
            totalMs += item.duration;
        } else {
            break;
        }
    }
    return totalMs;
};

window.squadHasRestedDriver = function(squadLetter, currentTime, driverStats, minRestMs) {
    return window.drivers.some((d, i) => 
        d.squad === squadLetter && window.getDriverRestTime(i, currentTime, driverStats) >= minRestMs
    );
};

window.selectMostRestedDriver = function(currentTime, driverStats, currentDriverIdx, config) {
    const candidates = window.drivers
        .map((d, i) => ({
            ...d, idx: i,
            restTime: window.getDriverRestTime(i, currentTime, driverStats),
            driven: driverStats[i].driven
        }))
        .filter(d => {
            if (!config.allowDouble && d.idx === currentDriverIdx && window.drivers.length > 1) return false;
            if (config.maxDriverTotalMs > 0 && d.driven >= config.maxDriverTotalMs) return false;
            return true;
        })
        .sort((a, b) => b.restTime - a.restTime);
    
    return candidates.length > 0 ? candidates[0].idx : null;
};

window.selectDriverFromSquad = function(squadLetter, currentTime, driverStats, currentDriverIdx, config) {
    const candidates = window.drivers
        .map((d, i) => ({
            ...d, idx: i,
            restTime: window.getDriverRestTime(i, currentTime, driverStats),
            driven: driverStats[i].driven
        }))
        .filter(d => {
            if (d.squad !== squadLetter) return false;
            if (!config.allowDouble && d.idx === currentDriverIdx && window.drivers.length > 1) return false;
            if (config.maxDriverTotalMs > 0 && d.driven >= config.maxDriverTotalMs) return false;
            return true;
        })
        .sort((a, b) => b.restTime - a.restTime);
    
    return candidates.length > 0 ? candidates[0].idx : null;
};

window.calculateStintDurations = function(config) {
    const raceMs = config.raceMs;
    const pitTimeMs = config.pitTime * 1000;
    const totalStints = config.stops + 1;
    const totalPitTime = config.stops * pitTimeMs;
    const totalNetDriveTime = raceMs - totalPitTime;

    const closedStartMs = (config.closedStart || 0) * 60000;
    const closedEndMs = (config.closedEnd || 0) * 60000;
    const minStintMs = Math.max(60000, config.minStint * 60000);
    const maxStintMs = config.maxStint > 0 ? config.maxStint * 60000 : raceMs;
    const fuelLimitMs = config.fuel > 0 ? config.fuel * 60000 : Infinity;
    
    const effectiveMaxStint = Math.min(maxStintMs, fuelLimitMs);
    const targetStintDuration = effectiveMaxStint - 60000; 

    let durationFirst = Math.max(minStintMs, targetStintDuration); 
    if (closedStartMs > 0) {
        durationFirst = Math.max(durationFirst, closedStartMs + 120000);
    }
    durationFirst = Math.min(durationFirst, effectiveMaxStint);
    if (durationFirst < closedStartMs) durationFirst = closedStartMs + 60000; 

    let minLastStint = minStintMs;
    if (closedEndMs > 0) {
        minLastStint = Math.max(minStintMs, closedEndMs + 120000); 
    }

    let remainingTime = totalNetDriveTime - durationFirst - minLastStint;
    const middleStintsCount = totalStints - 2;

    if (remainingTime < middleStintsCount * minStintMs) {
        console.warn("Time budget too tight, adjusting first/last to fit minimums.");
        const avg = totalNetDriveTime / totalStints;
        const fallbackDurations = new Array(totalStints).fill(avg);
        return { durations: fallbackDurations };
    }

    const stintDurations = new Array(totalStints).fill(0);
    stintDurations[0] = durationFirst; 
    
    if (middleStintsCount > 0) {
        let currentPool = remainingTime;
        for (let i = 1; i <= middleStintsCount; i++) {
            const slotsLeftAfterThis = middleStintsCount - i;
            const reservedForOthers = slotsLeftAfterThis * minStintMs;
            let canTake = currentPool - reservedForOthers;
            let take = Math.min(canTake, targetStintDuration);
            take = Math.max(take, minStintMs);
            
            stintDurations[i] = take;
            currentPool -= take;
        }
    }

    const usedSoFar = stintDurations.slice(0, totalStints - 1).reduce((a, b) => a + b, 0);
    let finalStintDuration = totalNetDriveTime - usedSoFar;

    if (finalStintDuration > effectiveMaxStint) {
        const excess = finalStintDuration - targetStintDuration;
        finalStintDuration = targetStintDuration; 
        
        if (middleStintsCount > 0) {
            const spread = excess / middleStintsCount;
            for (let i = 1; i <= middleStintsCount; i++) {
                stintDurations[i] += spread;
            }
        } else {
            stintDurations[0] += excess;
        }
    }
    
    stintDurations[totalStints - 1] = finalStintDuration;

    return { durations: stintDurations };
};

window.calculateStrategyLogic = function(config) {
    const raceMs = config.raceMs || (config.duration * 3600000);
    const pitTimeMs = config.pitTime * 1000;
    const totalStints = config.stops + 1;
    const maxDriverTotalMs = (config.maxDriverTotal || 0) * 60000;
    
    const SQUAD_SHIFT_DURATION_MS = 4 * 3600000;
    const MIN_REST_FOR_SWITCH_MS = 4 * 3600000;
    const extendedConfig = { ...config, maxDriverTotalMs };
    
    const durationResult = window.calculateStintDurations(config);
    
    if (durationResult.error) {
        return { error: durationResult.error };
    }
    
    const stintDurations = durationResult.durations;
    
    console.log(`📋 Planned stint durations: ${stintDurations.map(d => (d/60000).toFixed(1) + 'm').join(', ')}`);
    
    let currentTime = new Date();
    if (window.raceStartTime) {
        const d = new Date(window.raceStartTime);
        if (!isNaN(d.getTime())) currentTime = d;
    }
    
    let currentDriverIdx = window.drivers.findIndex(d => d.isStarter);
    if (currentDriverIdx === -1) currentDriverIdx = 0;
    currentDriverIdx = (currentDriverIdx - 1 + window.drivers.length) % window.drivers.length;
    
    let driverStats = window.drivers.map(d => ({
        ...d,
        driven: 0,
        lastStintEnd: null,
        stintCount: 0
    }));
    
    let timeline = [];
    let squadModeActive = false;
    let activeSquad = 'A';
    let accumulatedRaceTime = 0;
    
    for (let i = 0; i < totalStints; i++) {
        const duration = stintDurations[i];
        const isLast = (i === totalStints - 1);
        const stintStartTime = new Date(currentTime);
        const isNight = window.isNightPhase(stintStartTime);
        
        let selectedIdx = -1;
        
        if (config.useSquads && config.duration >= 12) {
            if (isNight) {
                if (!squadModeActive) {
                    squadModeActive = true;
                    activeSquad = 'A';
                }
                
                const squadDriveTime = window.getSquadContinuousDriveTime(activeSquad, timeline);
                const otherSquad = activeSquad === 'A' ? 'B' : 'A';
                
                if (squadDriveTime >= SQUAD_SHIFT_DURATION_MS) {
                    if (window.squadHasRestedDriver(otherSquad, stintStartTime, driverStats, MIN_REST_FOR_SWITCH_MS)) {
                        activeSquad = otherSquad;
                    }
                }
                
                selectedIdx = window.selectDriverFromSquad(activeSquad, stintStartTime, driverStats, currentDriverIdx, extendedConfig);
                if (selectedIdx === null) {
                    selectedIdx = window.selectDriverFromSquad(otherSquad, stintStartTime, driverStats, currentDriverIdx, extendedConfig);
                }
            } else {
                squadModeActive = false;
                selectedIdx = window.selectMostRestedDriver(stintStartTime, driverStats, currentDriverIdx, extendedConfig);
            }
        } else {
            selectedIdx = window.selectMostRestedDriver(stintStartTime, driverStats, currentDriverIdx, extendedConfig);
        }
        
        if (selectedIdx === null || selectedIdx === -1) {
            selectedIdx = (currentDriverIdx + 1) % window.drivers.length;
        }
        
        currentDriverIdx = selectedIdx;
        driverStats[selectedIdx].driven += duration;
        driverStats[selectedIdx].stintCount++;
        
        const start = new Date(currentTime);
        const end = new Date(start.getTime() + duration);
        driverStats[selectedIdx].lastStintEnd = new Date(end);
        
        timeline.push({
            type: 'stint',
            stintNumber: i + 1,
            driverName: window.drivers[selectedIdx].name,
            driverIdx: selectedIdx,
            color: window.drivers[selectedIdx].color,
            squad: window.drivers[selectedIdx].squad,
            isNightPhase: isNight,
            squadModeActive,
            activeSquad: squadModeActive ? activeSquad : null,
            start, end, startTime: start, endTime: end, duration
        });
        
        currentTime = end;
        accumulatedRaceTime += duration;
        
        if (!isLast) {
            const pitEnd = new Date(currentTime.getTime() + pitTimeMs);
            timeline.push({
                type: 'pit',
                pitNumber: i + 1,
                start: currentTime,
                end: pitEnd,
                startTime: currentTime,
                duration: pitTimeMs,
                raceTimeAtEntry: accumulatedRaceTime
            });
            currentTime = pitEnd;
            accumulatedRaceTime += pitTimeMs;
        }
    }
    
    return { timeline, driverStats, config, drivers: [...window.drivers] };
};

window.runSim = function() {
    const durationHours = parseFloat(document.getElementById('raceDuration').value) || 12;
    const reqStops = parseInt(document.getElementById('reqPitStops').value) || 15;
    const minStintMin = parseFloat(document.getElementById('minStint').value) || 10;
    const maxStintMin = parseFloat(document.getElementById('maxStint').value) || 45;
    const pitTimeSec = parseInt(document.getElementById('minPitTime').value) || 120;
    const fuelMin = parseFloat(document.getElementById('fuelTime').value) || 0;
    const closedStartMin = parseFloat(document.getElementById('pitClosedStart').value) || 0;
    const closedEndMin = parseFloat(document.getElementById('pitClosedEnd').value) || 0;
    const useSquads = document.getElementById('useSquads')?.checked || false;
    const allowDouble = document.getElementById('allowDouble')?.checked || false;
    const minDriverMin = parseFloat(document.getElementById('minDriverTime').value) || 0;
    const maxDriverMin = parseFloat(document.getElementById('maxDriverTime').value) || 0;

    window.updateDriversFromUI();
    if (!window.drivers || window.drivers.length === 0) return;

    const startTimeInput = document.getElementById('raceStartTime');
    if (startTimeInput && !startTimeInput.value) {
        const now = new Date();
        startTimeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    if (startTimeInput && startTimeInput.value) {
        const [h, m] = startTimeInput.value.split(':');
        const startDate = new Date();
        startDate.setHours(parseInt(h), parseInt(m), 0, 0);
        window.raceStartTime = startDate.toISOString();
    }

    const raceMs = durationHours * 3600000;
    const pitTimeMs = pitTimeSec * 1000;
    const totalPitTimeMs = reqStops * pitTimeMs;
    const totalNetDriveTime = raceMs - totalPitTimeMs; 

    const config = {
        duration: durationHours,
        raceMs: raceMs,
        stops: reqStops,
        reqStops: reqStops,
        minStint: minStintMin,
        maxStint: maxStintMin,
        pitTime: pitTimeSec,
        fuel: fuelMin,
        closedStart: closedStartMin,
        closedEnd: closedEndMin,
        useSquads: useSquads,
        allowDouble: allowDouble,
        minDriverTotal: minDriverMin,
        maxDriverTotal: maxDriverMin,
        totalNetDriveTime: totalNetDriveTime,
        totalPitTime: totalPitTimeMs
    };

    window.config = config;

    const durationResult = window.calculateStintDurations(config);

    if (durationResult.error) {
        const resEl = document.getElementById('simResult');
        if (resEl) {
            resEl.innerText = "⚠️ " + durationResult.error;
            resEl.classList.remove('hidden');
            resEl.style.borderColor = 'red';
            resEl.style.color = '#ef4444';
        }
        window.cachedStrategy = null;
        return;
    }

    const stintDurations = durationResult.durations;
    const totalStintTime = stintDurations.reduce((a, b) => a + b, 0);
    const timeDiff = Math.abs(totalStintTime - totalNetDriveTime);
    
    if (timeDiff > 60000) { 
        console.warn(`⚠️ Time mismatch: Stints=${(totalStintTime/60000).toFixed(1)}min, Expected=${(totalNetDriveTime/60000).toFixed(1)}min`);
    }

    const result = window.calculateStrategyLogic(config);

    if (result.error) {
        const resEl = document.getElementById('simResult');
        if (resEl) {
            resEl.innerText = "⚠️ " + result.error;
            resEl.classList.remove('hidden');
            resEl.style.borderColor = 'red';
            resEl.style.color = '#ef4444';
        }
        window.cachedStrategy = null;
        return;
    }

    window.cachedStrategy = result;
    window.previewData = {
        timeline: result.timeline,
        driverSchedule: result.driverStats.map((d, i) => ({
            name: window.drivers[i].name,
            color: window.drivers[i].color,
            totalTime: d.driven,
            stints: []
        })),
        startTime: result.timeline[0]?.startTime || new Date()
    };

    window.recalculateDriverStatsFromTimeline();

    const stints = result.timeline.filter(t => t.type === 'stint');
    const pits = result.timeline.filter(t => t.type === 'pit');
    const actualDriveTime = stints.reduce((a, s) => a + s.duration, 0);
    const actualPitTime = pits.reduce((a, p) => a + p.duration, 0);
    const totalRaceTime = actualDriveTime + actualPitTime;
    const avgStint = stints.length > 0 ? (actualDriveTime / stints.length / 60000).toFixed(1) : 0;

    let pitClosedInfo = '';
    if (closedEndMin > 0 && pits.length > 0) {
        const lastPit = pits[pits.length - 1];
        const deadlineMs = raceMs - (closedEndMin * 60000);
        const lastPitTime = lastPit.raceTimeAtEntry || 0;
        const marginMin = ((deadlineMs - lastPitTime) / 60000).toFixed(0);
        
        if (lastPitTime <= deadlineMs) {
            pitClosedInfo = ` | ✅ Last pit ${marginMin}m before close`;
        } else {
            pitClosedInfo = ` | ❌ Last pit ${Math.abs(marginMin)}m AFTER close!`;
        }
    }

    let squadInfo = '';
    if (useSquads) {
        const nightStints = stints.filter(s => s.isNightPhase);
        if (nightStints.length > 0) {
            const squadANight = nightStints.filter(s => s.squad === 'A').length;
            const squadBNight = nightStints.filter(s => s.squad === 'B').length;
            squadInfo = ` | 🌙 A=${squadANight} B=${squadBNight}`;
        }
    }

    const resEl = document.getElementById('simResult');
    if (resEl) {
        resEl.classList.remove('hidden');
        resEl.style.borderColor = '#22d3ee';
        resEl.style.color = '#22d3ee';
        resEl.innerHTML = `
            ✅ <b>${stints.length} Stints</b> | Avg: ${avgStint}m<br>
            🏁 Drive: ${(actualDriveTime/60000).toFixed(0)}m + Pit: ${(actualPitTime/60000).toFixed(0)}m = <b>${(totalRaceTime/60000).toFixed(0)}m</b> (${(totalRaceTime/3600000).toFixed(2)}h)
            ${pitClosedInfo}${squadInfo}
        `;
    }
};

window.generatePreview = function(silent, render) {
    if (!window.cachedStrategy) {
        window.runSim();
        if (!window.cachedStrategy) return alert("Please configure race settings first.");
    }

    if (render && typeof window.renderPreview === 'function') {
        window.recalculateDriverStatsFromTimeline();
        window.renderPreview();
        document.getElementById('previewScreen').classList.remove('hidden');
        document.getElementById('setupScreen').classList.add('hidden');
    }
};

window.initRace = function() {
    if (!window.cachedStrategy) {
        window.runSim();
        if (!window.cachedStrategy) return alert("Please generate a strategy first!");
    }

    const allowDouble = document.getElementById('allowDouble')?.checked;
    if (!allowDouble && window.previewData && window.previewData.timeline) {
        const stints = window.previewData.timeline.filter(t => t.type === 'stint');
        for (let i = 1; i < stints.length; i++) {
            if (stints[i].driverName === stints[i-1].driverName) {
                alert(`⚠️ Safety Check:\nDouble Stint detected for "${stints[i].driverName}" but option is disabled.\nPlease enable 'Double Stint' or fix strategy.`);
                return; 
            }
        }
    }

    console.log("🏁 Starting Race...");

    const now = Date.now();

    window.state.isRunning = true;
    window.state.startTime = now;      
    window.state.stintStart = now;     
    window.state.pitCount = 0;
    window.state.isInPit = false;
    window.state.stintOffset = 0;
    window.state.mode = 'normal';
    window.state.currentDriverIdx = window.cachedStrategy.timeline[0].driverIdx;
    
    window.state.nextDriverIdx = (window.state.currentDriverIdx + 1) % window.drivers.length;
    
    if (window.config.useSquads) {
        let attempts = 0;
        let candidate = window.state.nextDriverIdx;
        while (window.drivers[candidate].squad !== window.drivers[window.state.currentDriverIdx].squad && attempts < window.drivers.length) {
            candidate = (candidate + 1) % window.drivers.length;
            attempts++;
        }
        window.state.nextDriverIdx = candidate;
    }

    window.state.globalStintNumber = 1;

    if (window.cachedStrategy && window.cachedStrategy.timeline) {
        window.state.stintTargets = window.cachedStrategy.timeline
            .filter(t => t.type === 'stint')
            .map(t => t.duration);
    } else {
        window.state.stintTargets = [];
    }
    
    window.state.targetStintMs = window.state.stintTargets[0] || (window.config.maxStint * 60000);

    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('previewScreen').classList.add('hidden'); 
    document.getElementById('raceDashboard').classList.remove('hidden');
    
    if (typeof window.initHostPeer === 'function') window.initHostPeer();
    
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(err => console.log("Wake Lock error:", err));
    }

    if (window.raceInterval) clearInterval(window.raceInterval);
    
    window.raceInterval = setInterval(() => {
        if (typeof window.tick === 'function') window.tick();
        if (typeof window.broadcast === 'function') window.broadcast();
        if (typeof window.renderFrame === 'function') window.renderFrame();
    }, 1000);

    if (typeof window.saveRaceState === 'function') {
        // === FIX: Save IMMEDIATELY so we can restore even if refreshed quickly ===
        window.saveRaceState(); 
        setInterval(window.saveRaceState, 10000);
    }
    
    if (typeof window.renderFrame === 'function') window.renderFrame(); 
    if (typeof window.broadcast === 'function') window.broadcast();
};

window.callAIStrategy = async function(btn) {
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
        alert(window.t('localhostError'));
        return;
    }

    window.updateDriversFromUI();
    const cfg = {
        duration: document.getElementById('raceDuration').value,
        stops: document.getElementById('reqPitStops').value,
        minStint: document.getElementById('minStint').value,
        maxStint: document.getElementById('maxStint').value,
        drivers: window.drivers.map(d => d.name)
    };

    const buttonEl = btn || document.querySelector('button[onclick*="callAIStrategy"]');
    let originalText = "✨ Ask AI";
    if (buttonEl) { originalText = buttonEl.innerText; buttonEl.innerText = "..."; buttonEl.disabled = true; }

    try {
        const response = await fetch('/.netlify/functions/ai-strategy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: `Analyze: ${JSON.stringify(cfg)}` })
        });
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        if (data.success && data.content?.[0]) {
            if (data.content[0].stints) window.applyAIStrategyToTimeline(data.content[0].stints);
            alert("🤖 " + (data.content[0].text || "Done"));
        }
    } catch (e) { alert("Error: " + e.message); }
    finally { if (buttonEl) { buttonEl.innerText = originalText; buttonEl.disabled = false; } }
};

window.recalculateTimelineTimes = function() {
    if (!window.previewData?.timeline) return;
    let currentTime = new Date(window.previewData.startTime);
    window.previewData.timeline.forEach(item => {
        item.startTime = new Date(currentTime);
        item.endTime = new Date(currentTime.getTime() + item.duration);
        currentTime = item.endTime;
    });
    window.recalculateDriverStatsFromTimeline();
};

window.recalculateDriverStatsFromTimeline = function() {
    if (!window.previewData?.timeline) return;
    window.previewData.driverSchedule.forEach(d => { d.totalTime = 0; d.stints = []; });
    let idx = 0;
    window.previewData.timeline.forEach(t => {
        if (t.type === 'stint') {
            idx++;
            let driver = window.previewData.driverSchedule[t.driverIdx] || 
                         window.previewData.driverSchedule.find(d => d.name === t.driverName);
            if (driver) {
                driver.totalTime += t.duration;
                driver.stints.push({ globalNumber: idx, duration: t.duration });
            }
        }
    });
};