// ==========================================
// 🧠 STRATEGY ENGINE (Pit Window Pre-Planning)
// ==========================================

window.updateDriversFromUI = function() {
    // Exclude placeholder rows injected by the minimum-driver framework
    const realRows = Array.from(document.querySelectorAll('#driversList .driver-row')).filter(row => !row.classList.contains('opacity-50'));
    const inputs = realRows.map(row => row.querySelector('.driver-input')).filter(Boolean);
    const radios = realRows.map(row => row.querySelector('.starter-radio')).filter(Boolean);
    if (!inputs.length) return;

    let starterIdx = 0;
    radios.forEach((r, i) => { if (r.checked) starterIdx = i; });

    const SQUAD_LABELS = ['A','B','C','D'];
    const squadValues = realRows.map(row => row.querySelector('.squad-value')).filter(Boolean);
    const colorPickers = realRows.map(row => row.querySelector('.driver-color-picker')).filter(Boolean);
    const staminaInputs = realRows.map(row => row.querySelector('.driver-stamina-input'));
    window.drivers = inputs.map((input, i) => {
        const existingColor = colorPickers[i]?.value ||
            ((window.drivers && window.drivers[i]) ? window.drivers[i].color : `hsl(${(i * 360 / inputs.length)}, 70%, 50%)`);
        const sqIdx = parseInt(squadValues[i]?.value) || 0;
        // staminaMin: per-driver max stint in minutes. 0 = no personal limit.
        const staminaMin = parseFloat(staminaInputs[i]?.value || '0') || 0;
        return {
            name: input.value || `${window.t('ltDriver')} ${i+1}`,
            isStarter: i === starterIdx,
            squad: SQUAD_LABELS[sqIdx] || 'A',
            squadIdx: sqIdx,
            color: existingColor,
            staminaMin,
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

window.selectMostRestedDriver = function(currentTime, driverStats, currentDriverIdx, config, consecutiveCount) {
    const maxConsec = config.maxConsecutive || 1; // 0 = unlimited
    const candidates = window.drivers
        .map((d, i) => ({
            ...d, idx: i,
            restTime: window.getDriverRestTime(i, currentTime, driverStats),
            driven: driverStats[i].driven
        }))
        .filter(d => {
            if (window.drivers.length > 1 && d.idx === currentDriverIdx) {
                if (!config.allowDouble) return false;
                if (maxConsec > 0 && (consecutiveCount || 0) >= maxConsec) return false;
            }
            if (config.maxDriverTotalMs > 0 && d.driven >= config.maxDriverTotalMs) return false;
            return true;
        })
        .sort((a, b) => b.restTime - a.restTime);

    return candidates.length > 0 ? candidates[0].idx : null;
};

window.selectDriverFromSquad = function(squadLetter, currentTime, driverStats, currentDriverIdx, config, consecutiveCount) {
    const maxConsec = config.maxConsecutive || 1;
    const candidates = window.drivers
        .map((d, i) => ({
            ...d, idx: i,
            restTime: window.getDriverRestTime(i, currentTime, driverStats),
            driven: driverStats[i].driven
        }))
        .filter(d => {
            if (d.squad !== squadLetter) return false;
            if (window.drivers.length > 1 && d.idx === currentDriverIdx) {
                if (!config.allowDouble) return false;
                if (maxConsec > 0 && (consecutiveCount || 0) >= maxConsec) return false;
            }
            if (config.maxDriverTotalMs > 0 && d.driven >= config.maxDriverTotalMs) return false;
            return true;
        })
        .sort((a, b) => b.restTime - a.restTime);

    return candidates.length > 0 ? candidates[0].idx : null;
};

window.calculateStintDurations = function(config) {
    const raceMs = config.raceMs;
    const pitTimeMs = (config.pitTime || 0) * 1000;

    // Kart-change interval: organizer mandates a pit every N minutes.
    // Compute number of mandatory stops from interval, then use that as the stop count.
    let derivedStops = config.stops || 0;
    if (config.kartChangeIntervalMin > 0) {
        const intervalMs = config.kartChangeIntervalMin * 60000;
        // Number of mandatory kart-change pits = floor(raceMs / intervalMs)
        // minus 1 because the last segment doesn't need another change after it
        const mandatoryChanges = Math.max(0, Math.floor(raceMs / intervalMs) - 1);
        // Take the larger of user-entered stops or organizer-derived stops
        derivedStops = Math.max(derivedStops, mandatoryChanges);
    }

    // NLE with no required stops: treat as single stint covering the full race
    const totalStints = Math.max(1, derivedStops + 1);
    const totalPitTime = derivedStops * pitTimeMs;
    const totalNetDriveTime = Math.max(raceMs - totalPitTime, raceMs * 0.5);

    const closedStartMs = (config.closedStart || 0) * 60000;
    const closedEndMs = (config.closedEnd || 0) * 60000;
    // minStint 0 = no minimum (driver can do one lap and exit)
    const minStintMs = config.minStint > 0 ? config.minStint * 60000 : 0;
    const safeMinStintMs = minStintMs > 0 ? minStintMs + 30000 : 60000;
    // maxStint 0 = unlimited — use fuel limit, per-driver stamina, or full race time
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

    const normalizeDurations = (durations) => {
        const rounded = durations.map(d => Math.round(d / 1000) * 1000);
        const sumRounded = rounded.reduce((a, b) => a + b, 0);
        let diff = totalNetDriveTime - sumRounded;

        const canAdd = (idx) => rounded[idx] + 1000 <= effectiveMaxStint;
        const canSub = (idx) => rounded[idx] - 1000 >= safeMinStintMs;

        const steps = Math.round(Math.abs(diff) / 1000);
        if (steps > 0) {
            for (let step = 0; step < steps; step++) {
                if (diff > 0) {
                    let applied = false;
                    for (let i = totalStints - 1; i >= 0; i--) {
                        if (canAdd(i)) {
                            rounded[i] += 1000;
                            diff -= 1000;
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
                            diff += 1000;
                            applied = true;
                            break;
                        }
                    }
                    if (!applied) break;
                }
            }
        }

        const finalSum = rounded.reduce((a, b) => a + b, 0);
        if (finalSum !== totalNetDriveTime) {
            const tail = rounded.length - 1;
            rounded[tail] = Math.max(safeMinStintMs, Math.min(effectiveMaxStint, rounded[tail] + (totalNetDriveTime - finalSum)));
        }
        return rounded;
    };

    let rounded = normalizeDurations(stintDurations);

    // Weather-aware stint sizing:
    // heavy rain → shorter stints, light rain → slightly shorter, dry → slightly longer.
    // Also exposes weather per-stint for driver swap frequency hints.
    const weatherPerStint = new Array(totalStints).fill('dry');
    const trackCond = window.state?.trackCondition;
    const liveRain = (trackCond === 'wet');
    const liveLight = (trackCond === 'drying');

    if (typeof window.getVenueForecastAt === 'function' && rounded.length > 0) {
        const raceStartMs = Number.isFinite(Date.parse(window.raceStartTime)) ? Date.parse(window.raceStartTime) : Date.now();
        let cursor = raceStartMs;
        const adapted = rounded.map((dur, idx) => {
            const midMs = cursor + Math.floor(dur / 2);
            const fc = window.getVenueForecastAt(midMs);
            const code = Number(fc?.weatherCode);
            const precip = Number(fc?.precipitation || 0);
            const heavyRain = ([65, 67, 82, 95, 96, 99].includes(code)) || precip >= 2.5;
            const lightRain = ([51, 53, 55, 61, 63, 80, 81].includes(code)) || (precip >= 0.5 && precip < 2.5);
            const dry = ((code >= 0 && code <= 2) || code === 3) && precip < 0.2;

            weatherPerStint[idx] = heavyRain ? 'heavy' : lightRain ? 'light' : 'dry';

            let next = dur;
            if (heavyRain) next = Math.round(dur * 0.82);        // shorten significantly
            else if (lightRain) next = Math.round(dur * 0.92);   // shorten moderately
            else if (dry) next = Math.round(dur * 1.06);
            next = Math.max(safeMinStintMs, Math.min(effectiveMaxStint, next));

            cursor += dur;
            if (idx < totalStints - 1) cursor += pitTimeMs;
            return next;
        });
        rounded = normalizeDurations(adapted);
    } else if (liveRain || liveLight) {
        // No forecast provider but live track condition is rain — shorten all stints
        const factor = liveRain ? 0.82 : 0.92;
        const adapted = rounded.map(dur => {
            const next = Math.max(safeMinStintMs, Math.min(effectiveMaxStint, Math.round(dur * factor)));
            return next;
        });
        rounded = normalizeDurations(adapted);
        weatherPerStint.fill(liveRain ? 'heavy' : 'light');
    }

    return { durations: rounded, weatherPerStint, derivedStops };
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
    const pitTimeMs = (config.pitTime || 0) * 1000;
    const maxDriverTotalMs = (config.maxDriverTotal || 0) * 60000;
    const extendedConfig = { ...config, maxDriverTotalMs };

    const durationResult = window.calculateStintDurations(config);

    if (durationResult.error) {
        return { error: durationResult.error };
    }

    const stintDurations = durationResult.durations;
    const weatherPerStint = durationResult.weatherPerStint || new Array(stintDurations.length).fill('dry');
    // Use derivedStops from duration calc (may be higher than config.stops when kartChangeInterval is set)
    const totalStints = stintDurations.length;

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
    
    const starterIdx = (() => {
        const idx = window.drivers.findIndex(d => d.isStarter);
        return idx === -1 ? 0 : idx;
    })();
    // Pre-set to the driver *before* the starter so the first selectMostRestedDriver
    // call returns the starter.  BUT: when all rest-times are equal (race start) the
    // sort is unstable, so we track the intended starter separately and override stint 0.
    let currentDriverIdx = (starterIdx - 1 + window.drivers.length) % window.drivers.length;

    let consecutiveCount = 0; // How many stints in a row the current driver has done

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
                selectedIdx = window.selectDriverFromSquad(activeSquad, stintStartTime, driverStats, currentDriverIdx, extendedConfig, consecutiveCount);
                if (selectedIdx === null) {
                    // Fallback: try other squads in order
                    for (let s = 1; s < allSquadLabels.length; s++) {
                        const fallback = allSquadLabels[(allSquadLabels.indexOf(activeSquad) + s) % allSquadLabels.length];
                        selectedIdx = window.selectDriverFromSquad(fallback, stintStartTime, driverStats, currentDriverIdx, extendedConfig, consecutiveCount);
                        if (selectedIdx !== null) break;
                    }
                }
            } else {
                // Outside squad window — all drivers share equally
                selectedIdx = window.selectMostRestedDriver(stintStartTime, driverStats, currentDriverIdx, extendedConfig, consecutiveCount);
            }
        } else {
            selectedIdx = window.selectMostRestedDriver(stintStartTime, driverStats, currentDriverIdx, extendedConfig, consecutiveCount);
        }

        if (selectedIdx === null || selectedIdx === -1) {
            selectedIdx = (currentDriverIdx + 1) % window.drivers.length;
        }

        // Stint 0: always honour the selected starter regardless of sort order
        if (i === 0) selectedIdx = starterIdx;

        // Update consecutive count
        consecutiveCount = (selectedIdx === currentDriverIdx) ? consecutiveCount + 1 : 1;
        currentDriverIdx = selectedIdx;

        // NLE: apply per-driver stamina cap if global maxStint is 0
        let actualDuration = duration;
        if (!config.maxStint || config.maxStint === 0) {
            const staminaMs = (window.drivers[selectedIdx]?.staminaMin || 0) * 60000;
            if (staminaMs > 0) actualDuration = Math.min(actualDuration, staminaMs);
        }

        driverStats[selectedIdx].driven += actualDuration;
        driverStats[selectedIdx].stintCount++;
        
        const start = new Date(currentTime);
        const end = new Date(start.getTime() + actualDuration);
        driverStats[selectedIdx].lastStintEnd = new Date(end);

        const stintWeather = weatherPerStint[i] || 'dry';
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
            weather: stintWeather,
            start, end, startTime: start, endTime: end, duration: actualDuration
        });

        currentTime = end;
        accumulatedRaceTime += actualDuration;
        
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

// Enable or disable (and grey out) the Start Race button
window._setStartBtnState = function(valid) {
    const btn = document.getElementById('startRaceBtn');
    if (!btn) return;
    btn.disabled = !valid;
    btn.classList.toggle('opacity-40', !valid);
    btn.classList.toggle('cursor-not-allowed', !valid);
    btn.classList.toggle('pointer-events-none', !valid);
    btn.title = valid ? '' : '⚠️ Fix strategy params before starting';
};

// Debounce guard: prevents parallel/rapid re-runs
let _runSimTimer = null;
window.scheduleRunSim = function(delayMs) {
    clearTimeout(_runSimTimer);
    _runSimTimer = setTimeout(() => { window.runSim(); }, delayMs || 0);
};

window.runSim = function() {
    const durationHours = parseFloat(document.getElementById('raceDuration').value) || 12;

    // Read raw string values so we can distinguish "empty/zero" from "filled"
    const _reqStopsRaw  = document.getElementById('reqPitStops')?.value?.trim();
    const _maxStintRaw  = document.getElementById('maxStint')?.value?.trim();
    const _pitTimeRaw   = document.getElementById('minPitTime')?.value?.trim();

    const reqStops    = parseInt(_reqStopsRaw) || 0;
    const minStintMin = parseFloat(document.getElementById('minStint').value) || 0;
    const maxStintMin = parseFloat(_maxStintRaw) || 0;
    // 0 = no minimum pit time (driver swaps as fast as possible — non-pro format)
    const pitTimeSec  = parseInt(_pitTimeRaw) || 0;

    // No Limit Endurance: any of the 3 key params is zero/missing
    // sprint ≤ 2 h with all params filled → 'sprint'
    // all params filled, duration > 2 h  → 'endurance'
    // any param missing                  → 'noLimitEndurance'
    const _hasStops   = reqStops > 0;
    const _hasMaxSt   = maxStintMin > 0;
    const _hasPitT    = pitTimeSec > 0;
    const _isNLE      = !_hasStops || !_hasMaxSt || !_hasPitT;
    const raceType    = _isNLE ? 'noLimitEndurance' : (durationHours <= 2 ? 'sprint' : 'endurance');

    // Sync per-driver stamina visibility (show when maxStint = 0)
    if (typeof window._syncStaminaVisibility === 'function') window._syncStaminaVisibility();
    // Sync NLE section visibility (auto-show when any key param is 0)
    if (typeof window._syncNLESection === 'function') window._syncNLESection();

    const fuelMin = parseFloat(document.getElementById('fuelTime').value) || 0;
    const closedStartMin = parseFloat(document.getElementById('pitClosedStart').value) || 0;
    const closedEndMin = parseFloat(document.getElementById('pitClosedEnd').value) || 0;
    const numSquads = parseInt(document.getElementById('numSquads')?.value) || 0;
    const useSquads = numSquads > 0;
    const allowDouble = document.getElementById('allowDouble')?.checked || false;
    const maxConsecutiveRaw = parseInt(document.getElementById('maxConsecutive')?.value);
    const maxConsecutive = allowDouble ? (isNaN(maxConsecutiveRaw) ? 2 : maxConsecutiveRaw) : 1;
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

    // NLE extra pits: organizer-mandated kart-change pits, only relevant in noLimitEndurance
    const reqExtraPits   = parseInt(document.getElementById('reqExtraPits')?.value  || '0') || 0;
    const minPitLapSec   = parseInt(document.getElementById('minPitLapSec')?.value  || '0') || 0;
    // Kart-change interval: organizer tells teams the frequency (minutes). 0 = not set.
    const kartChangeIntervalMin = parseFloat(document.getElementById('kartChangeInterval')?.value || '0') || 0;

    const config = {
        duration: durationHours,
        raceMs,
        stops: reqStops,
        reqStops,
        minStint: minStintMin,
        maxStint: maxStintMin,   // 0 = unlimited — engine stretches by fuel/stamina
        pitTime: pitTimeSec,     // 0 = as-fast-as-possible swap (non-pro format)
        fuel: fuelMin,
        closedStart: closedStartMin,
        closedEnd: closedEndMin,
        useSquads,
        numSquads,
        squadWindowStart,
        squadWindowEnd,
        allowDouble,
        maxConsecutive,
        minDriverTotal: minDriverMin,
        maxDriverTotal: maxDriverMin,
        totalNetDriveTime,
        totalPitTime: totalPitTimeMs,
        raceType,                // 'sprint' | 'endurance' | 'noLimitEndurance'
        // NLE-specific
        reqExtraPits,
        minPitLapSec,
        kartChangeIntervalMin,   // organizer kart-change frequency (min). 0 = disabled.
    };

    window.config = config;

    const durationResult = window.calculateStintDurations(config);

    if (durationResult.error) {
        const resEl = document.getElementById('simResult');
        if (resEl && window._sessionMode !== 'qualify') {
            resEl.innerText = "⚠️ " + durationResult.error;
            resEl.classList.remove('hidden');
            resEl.style.borderColor = 'red';
            resEl.style.color = '#ef4444';
        }
        window.cachedStrategy = null;
        window._setStartBtnState(false);
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
        if (resEl && window._sessionMode !== 'qualify') {
            resEl.innerText = "⚠️ " + result.error;
            resEl.classList.remove('hidden');
            resEl.style.borderColor = 'red';
            resEl.style.color = '#ef4444';
        }
        window.cachedStrategy = null;
        window._setStartBtnState(false);
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
    // maxStint: 0 means unlimited (no-limit endurance) — skip the upper bound check.
    const isAverageStintValid = (minStintMin <= 0 || avgStint >= minStintMin) &&
                                (maxStintMin <= 0 || avgStint <= maxStintMin);
    const invalidStrategyWarning = document.getElementById('invalidStrategyWarning');
    
    if (!isAverageStintValid) {
        if (invalidStrategyWarning) {
            invalidStrategyWarning.classList.remove('hidden');
            document.getElementById('averageStintValue').innerText = avgStint;
            document.getElementById('minStintBound').innerText = minStintMin;
            document.getElementById('maxStintBound').innerText = maxStintMin;
        }
        window.cachedStrategy = null;
        window._setStartBtnState(false);
        return;
    } else {
        if (invalidStrategyWarning) invalidStrategyWarning.classList.add('hidden');
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
        const t = window.t || ((k) => k);
        const isRTL = document.documentElement.dir === 'rtl';
        const um = t('unitMin') || 'm';
        const uh = t('unitHour') || 'h';
        if (window._sessionMode !== 'qualify') resEl.classList.remove('hidden');
        resEl.style.borderColor = '#22d3ee';
        resEl.style.color = '#22d3ee';
        resEl.style.direction = isRTL ? 'rtl' : 'ltr';

        const driveMin = (actualDriveTime/60000).toFixed(0);
        const pitMin = (actualPitTime/60000).toFixed(0);
        const totalMin = (totalRaceTime/60000).toFixed(0);
        const totalH = (totalRaceTime/3600000).toFixed(2);
        const modeTag = { sprint: '⚡', endurance: '🏁', noLimitEndurance: '∞' }[config.raceType] || '';

        if (isRTL) {
            resEl.innerHTML = `
                <span dir="rtl">${modeTag} ✅ <b><bdi>${stints.length} ${t('stints')}</bdi></b> | ${t('avgStint')}: <bdi>${avgStint}${um}</bdi></span><br>
                <span dir="rtl">🏁 ${t('driveNoun')}: <bdi>${driveMin}${um}</bdi> + ${t('pitNoun')}: <bdi>${pitMin}${um}</bdi> = <b><bdi>${totalMin}${um}</bdi></b> (<bdi>${totalH}${uh}</bdi>)</span>
                ${pitClosedInfo ? `<br><span dir="ltr">${pitClosedInfo.trim()}</span>` : ''}${squadInfo ? `<br><span dir="ltr">${squadInfo.trim()}</span>` : ''}
            `;
        } else {
            resEl.innerHTML = `
                ${modeTag} ✅ <b>${stints.length} ${t('stints')}</b> | ${t('avgStint')}: ${avgStint}${um}<br>
                🏁 ${t('driveNoun')}: ${driveMin}${um} + ${t('pitNoun')}: ${pitMin}${um} = <b>${totalMin}${um}</b> (${totalH}${uh})
                ${pitClosedInfo}${squadInfo}
            `;
        }
    }
    window._setStartBtnState(true);
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
    window.state.isFinished = false; // Reset finish flag from any previous race
    window.state.startTime = startTime;
    window.state.stintStart = startTime;
    // Snap raceStartTime to the ACTUAL millisecond start so the strategy timeline
    // (which is built from raceStartTime in calculateStrategyLogic) stays aligned
    // with the race clock. Without this the strategy would be off by up to 59s
    // because runSim truncates start-time seconds to :00.
    window.raceStartTime = new Date(startTime).toISOString();
    window.state.pitCount = 0;
    window.state.extraPitCount = 0;   // reset extra pit counter
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

    // Init draggable panels (resizer removed — single-panel layout)
    if (typeof window.initDashboardDrag === 'function') window.initDashboardDrag();
    // Init horizontal panel pinning (only active in landscape/wide layout)
    if (typeof window.initHorizontalPanels === 'function') {
        // Small delay to let layout settle after transition
        setTimeout(window.initHorizontalPanels, 150);
    }

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