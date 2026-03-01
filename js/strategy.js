// ==========================================
// 🧠 STRATEGY ENGINE (Pit Window Pre-Planning)
// ==========================================

window.updateDriversFromUI = function() {
    const inputs = document.querySelectorAll('.driver-input');
    const radios = document.querySelectorAll('.starter-radio');
    if (!inputs.length) return;

    let starterIdx = 0;
    radios.forEach((r, i) => { if (r.checked) starterIdx = i; });

    const SQUAD_LABELS = ['A','B','C','D'];
    const squadValues = document.querySelectorAll('.squad-value');
    const colorPickers = document.querySelectorAll('.driver-color-picker');
    window.drivers = Array.from(inputs).map((input, i) => {
        const existingColor = colorPickers[i]?.value ||
            ((window.drivers && window.drivers[i]) ? window.drivers[i].color : `hsl(${(i * 360 / inputs.length)}, 70%, 50%)`);
        const sqIdx = parseInt(squadValues[i]?.value) || 0;
        return {
            name: input.value || `${window.t('ltDriver')} ${i+1}`,
            isStarter: i === starterIdx,
            squad: SQUAD_LABELS[sqIdx] || 'A',
            squadIdx: sqIdx,
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

window.getSquadContinuousDriveTime = function(squadLabel, timeline) {
    let totalMs = 0;
    for (let i = timeline.length - 1; i >= 0; i--) {
        const item = timeline[i];
        if (item.type !== 'stint') continue;
        const driver = window.drivers[item.driverIdx];
        if (driver && driver.squad === squadLabel) {
            totalMs += item.duration;
        } else {
            break;
        }
    }
    return totalMs;
};

window.squadHasRestedDriver = function(squadLabel, currentTime, driverStats, minRestMs) {
    return window.drivers.some((d, i) => 
        d.squad === squadLabel && window.getDriverRestTime(i, currentTime, driverStats) >= minRestMs
    );
};

window.getSquadLabelsInUse = function() {
    const labels = new Set();
    (window.drivers || []).forEach(d => labels.add(d.squad || 'A'));
    return Array.from(labels);
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
    // Add 30s safety buffer above minimum so drivers can pit without penalty risk.
    const safeMinStintMs = minStintMs + 30000;
    const maxStintMs = config.maxStint > 0 ? config.maxStint * 60000 : raceMs;
    const fuelLimitMs = config.fuel > 0 ? config.fuel * 60000 : Infinity;
    
    const effectiveMaxStint = Math.min(maxStintMs, fuelLimitMs);
    // Target 1 minute below max to leave buffer for pit entry.
    const targetStintDuration = effectiveMaxStint - 60000;

    let durationFirst = Math.max(safeMinStintMs, targetStintDuration); 
    if (closedStartMs > 0) {
        durationFirst = Math.max(durationFirst, closedStartMs + 120000);
    }
    durationFirst = Math.min(durationFirst, effectiveMaxStint);
    if (durationFirst < closedStartMs) durationFirst = closedStartMs + 60000; 

    let minLastStint = safeMinStintMs;
    if (closedEndMs > 0) {
        minLastStint = Math.max(minStintMs, closedEndMs + 120000); 
    }

    let remainingTime = totalNetDriveTime - durationFirst - minLastStint;
    const middleStintsCount = totalStints - 2;

    if (remainingTime < middleStintsCount * safeMinStintMs) {
        console.warn("Time budget too tight, adjusting first/last to fit minimums.");
        const avg = totalNetDriveTime / totalStints;
        const fallbackDurations = new Array(totalStints).fill(avg);

        // Normalize fallback durations to whole seconds and ensure exact sum.
        const roundedFallback = fallbackDurations.map(d => Math.round(d / 1000) * 1000);
        const sumRounded = roundedFallback.reduce((a, b) => a + b, 0);
        roundedFallback[totalStints - 1] += (totalNetDriveTime - sumRounded);
        return { durations: roundedFallback };
    }

    const stintDurations = new Array(totalStints).fill(0);
    stintDurations[0] = durationFirst; 
    
    if (middleStintsCount > 0) {
        let currentPool = remainingTime;
        for (let i = 1; i <= middleStintsCount; i++) {
            const slotsLeftAfterThis = middleStintsCount - i;
            const reservedForOthers = slotsLeftAfterThis * safeMinStintMs;
            let canTake = currentPool - reservedForOthers;
            let take = Math.min(canTake, targetStintDuration);
            take = Math.max(take, safeMinStintMs);
            
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
            // Distribute excess using integer math to avoid floating-point drift.
            const baseAdd = Math.floor(excess / middleStintsCount);
            let leftover = excess - (baseAdd * middleStintsCount);
            for (let i = 1; i <= middleStintsCount; i++) {
                stintDurations[i] += baseAdd;
                if (leftover > 0) {
                    stintDurations[i] += 1;
                    leftover--;
                }
            }
        } else {
            stintDurations[0] += excess;
        }
    }
    
    stintDurations[totalStints - 1] = finalStintDuration;

    // Post-validation: if any stint violates min/max bounds, fall back to balanced distribution.
    const anyViolation = stintDurations.some(d => d < safeMinStintMs || d > effectiveMaxStint);
    if (anyViolation) {
        console.warn("Greedy allocation violated bounds, falling back to balanced distribution.");
        const avg = totalNetDriveTime / totalStints;
        // Start from equal split, then adjust first/last for pit window constraints
        for (let i = 0; i < totalStints; i++) {
            stintDurations[i] = avg;
        }
        // Respect closed pit window for first stint
        if (closedStartMs > 0 && stintDurations[0] < closedStartMs + 120000) {
            const needed = (closedStartMs + 120000) - stintDurations[0];
            stintDurations[0] = closedStartMs + 120000;
            // Take from middle/last stints equally
            const takeFrom = totalStints - 1;
            for (let i = 1; i < totalStints; i++) {
                stintDurations[i] -= needed / takeFrom;
            }
        }
        // Respect closed pit window for last stint
        if (closedEndMs > 0 && stintDurations[totalStints - 1] < closedEndMs + 120000) {
            const needed = (closedEndMs + 120000) - stintDurations[totalStints - 1];
            stintDurations[totalStints - 1] = closedEndMs + 120000;
            const takeFrom = totalStints - 1;
            for (let i = 0; i < totalStints - 1; i++) {
                stintDurations[i] -= needed / takeFrom;
            }
        }
        // Clamp all stints to min/max and redistribute overflow
        for (let pass = 0; pass < 3; pass++) {
            let overflow = 0;
            let adjustable = 0;
            for (let i = 0; i < totalStints; i++) {
                if (stintDurations[i] > effectiveMaxStint) {
                    overflow += stintDurations[i] - effectiveMaxStint;
                    stintDurations[i] = effectiveMaxStint;
                } else if (stintDurations[i] < safeMinStintMs) {
                    overflow -= safeMinStintMs - stintDurations[i];
                    stintDurations[i] = safeMinStintMs;
                } else {
                    adjustable++;
                }
            }
            if (Math.abs(overflow) < 1000 || adjustable === 0) break;
            const perStint = overflow / adjustable;
            for (let i = 0; i < totalStints; i++) {
                if (stintDurations[i] > safeMinStintMs && stintDurations[i] < effectiveMaxStint) {
                    stintDurations[i] += perStint;
                }
            }
        }
    }

    // Normalize durations to whole seconds to avoid sub-second drift.
    const rounded = stintDurations.map(d => Math.round(d / 1000) * 1000);
    const sumRounded = rounded.reduce((a, b) => a + b, 0);
    let diff = totalNetDriveTime - sumRounded;

    // Ensure we preserve constraints when applying the diff.
    const canAdd = (idx) => rounded[idx] + 1000 <= effectiveMaxStint;
    const canSub = (idx) => rounded[idx] - 1000 >= safeMinStintMs;

    // Apply diff in 1s steps.
    const steps = Math.round(Math.abs(diff) / 1000);
    if (steps > 0) {
        for (let step = 0; step < steps; step++) {
            if (diff > 0) {
                let applied = false;
                for (let i = totalStints - 1; i >= 0; i--) {
                    if (canAdd(i)) {
                        rounded[i] += 1000;
                        applied = true;
                        break;
                    }
                }
                if (!applied) break;
            } else {
                let applied = false;
                for (let i = totalStints - 1; i >= 0; i--) {
                    if (canSub(i)) {
                        rounded[i] -= 1000;
                        applied = true;
                        break;
                    }
                }
                if (!applied) break;
            }
        }
    }

    // Final safeguard: guarantee the sum equals totalNetDriveTime exactly.
    const finalSum = rounded.reduce((a, b) => a + b, 0);
    if (finalSum !== totalNetDriveTime) {
        rounded[totalStints - 1] += (totalNetDriveTime - finalSum);
    }

    return { durations: rounded };
};

// Determine if a given time falls inside the squad window.
// Returns null if outside (all drivers share), or the squad label if inside.
window.getScheduledSquad = function(dateTime, squadWindow, allSquadLabels) {
    if (!squadWindow || !squadWindow.startMs || !squadWindow.endMs) return null;
    const t = dateTime.getTime();
    // Outside the squad window => everyone drives (return null)
    if (t < squadWindow.startMs || t >= squadWindow.endMs) return null;
    // Inside the window: split evenly among squads
    const windowDuration = squadWindow.endMs - squadWindow.startMs;
    const elapsed = t - squadWindow.startMs;
    const sliceMs = windowDuration / allSquadLabels.length;
    const squadIdx = Math.min(Math.floor(elapsed / sliceMs), allSquadLabels.length - 1);
    return allSquadLabels[squadIdx];
};

window.calculateStrategyLogic = function(config) {
    const raceMs = config.raceMs || (config.duration * 3600000);
    const pitTimeMs = config.pitTime * 1000;
    const totalStints = config.stops + 1;
    const maxDriverTotalMs = (config.maxDriverTotal || 0) * 60000;
    const extendedConfig = { ...config, maxDriverTotalMs };
    
    const durationResult = window.calculateStintDurations(config);
    
    if (durationResult.error) {
        return { error: durationResult.error };
    }
    
    const stintDurations = durationResult.durations;
    
    console.log(`📋 Planned stint durations: ${stintDurations.map(d => (d/60000).toFixed(1) + 'm').join(', ')}`);
    
    // Build race start time from config
    let raceStart = new Date();
    if (window.raceStartTime) {
        const d = new Date(window.raceStartTime);
        if (!isNaN(d.getTime())) raceStart = d;
    }
    let currentTime = new Date(raceStart);
    
    // Build squad window: absolute start/end times for squad rotation
    const allSquadLabels = window.getSquadLabelsInUse();
    let squadWindow = null;
    if (config.useSquads && config.squadWindowStart && config.squadWindowEnd) {
        const raceDate = new Date(raceStart);
        // Parse squad window start time
        const [sh, sm] = config.squadWindowStart.split(':').map(Number);
        const winStart = new Date(raceDate);
        winStart.setHours(sh, sm, 0, 0);
        if (winStart.getTime() < raceStart.getTime()) winStart.setDate(winStart.getDate() + 1);
        // Parse squad window end time
        const [eh, em] = config.squadWindowEnd.split(':').map(Number);
        const winEnd = new Date(raceDate);
        winEnd.setHours(eh, em, 0, 0);
        if (winEnd.getTime() <= winStart.getTime()) winEnd.setDate(winEnd.getDate() + 1);
        squadWindow = { startMs: winStart.getTime(), endMs: winEnd.getTime() };
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
    let accumulatedRaceTime = 0;
    
    for (let i = 0; i < totalStints; i++) {
        const duration = stintDurations[i];
        const isLast = (i === totalStints - 1);
        const stintStartTime = new Date(currentTime);
        const isNight = window.isNightPhase(stintStartTime);
        
        let selectedIdx = -1;
        let activeSquad = null;
        
        if (config.useSquads && allSquadLabels.length > 1 && squadWindow) {
            // Determine which squad should be driving at this stint's start time
            activeSquad = window.getScheduledSquad(stintStartTime, squadWindow, allSquadLabels);
            
            if (activeSquad) {
                // Inside squad window — pick from the scheduled squad
                selectedIdx = window.selectDriverFromSquad(activeSquad, stintStartTime, driverStats, currentDriverIdx, extendedConfig);
                if (selectedIdx === null) {
                    // Fallback: try other squads in order
                    for (let s = 1; s < allSquadLabels.length; s++) {
                        const fallback = allSquadLabels[(allSquadLabels.indexOf(activeSquad) + s) % allSquadLabels.length];
                        selectedIdx = window.selectDriverFromSquad(fallback, stintStartTime, driverStats, currentDriverIdx, extendedConfig);
                        if (selectedIdx !== null) break;
                    }
                }
            } else {
                // Outside squad window — all drivers share equally
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
            squadModeActive: activeSquad !== null,
            activeSquad: activeSquad,
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
    const numSquads = parseInt(document.getElementById('numSquads')?.value) || 0;
    const useSquads = numSquads > 0;
    const allowDouble = document.getElementById('allowDouble')?.checked || false;
    const minDriverMin = parseFloat(document.getElementById('minDriverTime').value) || 0;
    const maxDriverMin = parseFloat(document.getElementById('maxDriverTime').value) || 0;

    window.updateDriversFromUI();
    if (!window.drivers || window.drivers.length === 0) return;

    // Build race start date/time from main settings inputs
    const startTimeInput = document.getElementById('raceStartTime');
    const startDateInput = document.getElementById('raceStartDate');
    if (startTimeInput && !startTimeInput.value) {
        const now = new Date();
        startTimeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
    if (startDateInput && !startDateInput.value) {
        const now = new Date();
        startDateInput.value = now.toISOString().split('T')[0];
    }
    if (startTimeInput && startTimeInput.value) {
        let startDate;
        if (startDateInput && startDateInput.value) {
            const [y, mo, d] = startDateInput.value.split('-').map(Number);
            startDate = new Date(y, mo - 1, d);
        } else {
            startDate = new Date();
        }
        const [h, m] = startTimeInput.value.split(':');
        startDate.setHours(parseInt(h), parseInt(m), 0, 0);
        window.raceStartTime = startDate.toISOString();
    }

    // Read squad window start/end times
    let squadWindowStart = '';
    let squadWindowEnd = '';
    if (useSquads) {
        const wsEl = document.getElementById('squadWindowStart');
        const weEl = document.getElementById('squadWindowEnd');
        squadWindowStart = wsEl ? wsEl.value : '';
        squadWindowEnd = weEl ? weEl.value : '';
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
        numSquads: numSquads,
        squadWindowStart: squadWindowStart,
        squadWindowEnd: squadWindowEnd,
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

    // === Check if average stint is within bounds ===
    const isAverageStintValid = avgStint >= minStintMin && avgStint <= maxStintMin;
    const invalidStrategyWarning = document.getElementById('invalidStrategyWarning');
    
    if (invalidStrategyWarning) {
        if (!isAverageStintValid) {
            invalidStrategyWarning.classList.remove('hidden');
            document.getElementById('averageStintValue').innerText = avgStint;
            document.getElementById('minStintBound').innerText = minStintMin;
            document.getElementById('maxStintBound').innerText = maxStintMin;
        } else {
            invalidStrategyWarning.classList.add('hidden');
        }
    }

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
        const squadLabels = window.getSquadLabelsInUse();
        const counts = squadLabels.map(lbl => `${lbl}=${stints.filter(s => s.squad === lbl).length}`);
        squadInfo = ` | 🔄 ${counts.join(' ')}`;
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
        if (!window.cachedStrategy) return window.showToast('Please configure race settings first.', 'warning');
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
        if (!window.cachedStrategy) return window.showToast('Please generate a strategy first!', 'warning');
    }

    const allowDouble = document.getElementById('allowDouble')?.checked;
    if (!allowDouble && window.previewData && window.previewData.timeline) {
        const stints = window.previewData.timeline.filter(t => t.type === 'stint');
        for (let i = 1; i < stints.length; i++) {
            if (stints[i].driverName === stints[i-1].driverName) {
                window.showToast(`⚠️ Double Stint detected for "${stints[i].driverName}" but option is disabled. Enable 'Allow Double Stints' or fix strategy.`, 'warning', 8000);
                return; 
            }
        }
    }

    console.log("🏁 Starting Race...");

    // use the host‑synced clock so viewers/drivers are all aligned
    const now = (window.getSyncedNow && typeof window.getSyncedNow === 'function') ? window.getSyncedNow() : Date.now();
    // if a race start date/time has been entered, treat the start as that moment
    let startTime = now;
    const raceStartDate = window.getRaceStartDate && window.getRaceStartDate();
    if (raceStartDate) {
        const sched = raceStartDate.getTime();
        // if we're within a few seconds of the scheduled start, snap to it
        if (now >= sched && now - sched < 10000) {
            startTime = sched;
        }
    }

    window.state.isRunning = true;
    window.state.startTime = startTime;
    window.state.stintStart = startTime;
    window.state.pitCount = 0;
    window.state.isInPit = false;
    window.state.stintOffset = 0;
    window.state.mode = 'normal';
    window.state.isNightMode = false; // Reset night mode on race start
    window.state.currentDriverIdx = window.cachedStrategy.timeline[0].driverIdx;
    window._raceSummaryFinalized = false; // Reset so post-race summary can compute final stint

    // immediately update UI/logic so timers show t=0 values before the interval fires
    if (typeof window.tick === 'function') window.tick();
    if (typeof window.renderFrame === 'function') window.renderFrame();
    
    window.state.nextDriverIdx = (window.state.currentDriverIdx + 1) % window.drivers.length;
    
    if (window.config.useSquads) {
        const startSquad = window.drivers[window.state.currentDriverIdx].squad;
        window.state.activeSquad = startSquad;
        let attempts = 0;
        let candidate = window.state.nextDriverIdx;
        while (window.drivers[candidate].squad !== startSquad && attempts < window.drivers.length) {
            candidate = (candidate + 1) % window.drivers.length;
            attempts++;
        }
        window.state.nextDriverIdx = candidate;
    }

    window.state.globalStintNumber = 1;

    if (window.cachedStrategy && window.cachedStrategy.timeline) {
        const stints = window.cachedStrategy.timeline.filter(t => t.type === 'stint');
        window.state.stintTargets = stints.map(t => t.duration);
        // Store full stint schedule: driver + squad + duration for each planned stint
        window.state.stintSchedule = stints.map(t => ({
            driverIdx: t.driverIdx,
            driverName: t.driverName,
            squad: t.squad,
            activeSquad: t.activeSquad,
            squadModeActive: t.squadModeActive,
            duration: t.duration,
            stintNumber: t.stintNumber
        }));
    } else {
        window.state.stintTargets = [];
        window.state.stintSchedule = [];
    }
    
    window.state.targetStintMs = window.state.stintTargets[0] || (window.config.maxStint * 60000);

    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('previewScreen').classList.add('hidden'); 
    document.getElementById('raceDashboard').classList.remove('hidden');
    
    // === Show chat button only in race dashboard ===
    const chatBtn = document.getElementById('chatToggleBtn');
    if (chatBtn) chatBtn.style.display = 'block';
    
    // === Show night mode button if squads are enabled ===
    const btnNightMode = document.getElementById('btnNightMode');
    if (btnNightMode && window.config.useSquads) {
        btnNightMode.classList.remove('hidden');
    }
    
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
        if (window._saveInterval) clearInterval(window._saveInterval);
        window._saveInterval = setInterval(window.saveRaceState, 10000);
    }

    // Start live timing updates (including demo mode) if enabled
    if (window.liveTimingConfig && window.liveTimingConfig.enabled) {
        if (typeof window.startLiveTimingUpdates === 'function') window.startLiveTimingUpdates();
        const ltPanel = document.getElementById('liveTimingPanel');
        if (ltPanel) ltPanel.classList.remove('hidden');
        const ltIndicator = document.getElementById('liveIndicator');
        if (ltIndicator) ltIndicator.classList.remove('hidden');
    }
    
    if (typeof window.renderFrame === 'function') window.renderFrame(); 
    if (typeof window.broadcast === 'function') window.broadcast();
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