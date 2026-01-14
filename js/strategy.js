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
    // 1. חישוב סך זמן נהיגה נטו (העוגה השלמה)
    const raceMs = config.raceMs;
    const pitTimeMs = config.pitTime * 1000;
    const totalStints = config.stops + 1;
    const totalPitTime = config.stops * pitTimeMs;
    const totalNetDriveTime = raceMs - totalPitTime; // זה הזמן שחייבים לחלק בדיוק!

    // המרה למילישניות
    const closedStartMs = (config.closedStart || 0) * 60000;
    const closedEndMs = (config.closedEnd || 0) * 60000;
    const minStintMs = Math.max(60000, config.minStint * 60000);
    const maxStintMs = config.maxStint > 0 ? config.maxStint * 60000 : raceMs;
    const fuelLimitMs = config.fuel > 0 ? config.fuel * 60000 : Infinity;
    
    // מקסימום אפקטיבי (הנמוך מבין חוקים/דלק) - פחות דקה לביטחון
    const effectiveMaxStint = Math.min(maxStintMs, fuelLimitMs);
    const targetStintDuration = effectiveMaxStint - 60000; 

    // === שלב א': שריון זמנים לקצוות (חוקי פיטס) ===
    
    // סטינט ראשון: חייב להיות לפחות המינימום, או יותר אם הפיט סגור בהתחלה
    // באפר של 2 דקות מעל זמן הסגירה
    let durationFirst = Math.max(minStintMs, targetStintDuration); // שאיפה למקסימום
    if (closedStartMs > 0) {
        // אם המקסימום לא מספיק כדי לעבור את הסגירה, מאריכים בכוח
        durationFirst = Math.max(durationFirst, closedStartMs + 120000);
    }
    // הגבלה למקסימום האבסולוטי (אלא אם אין ברירה)
    durationFirst = Math.min(durationFirst, effectiveMaxStint);
    if (durationFirst < closedStartMs) durationFirst = closedStartMs + 60000; // אין ברירה, חורגים

    // סטינט אחרון: חייב להיות ארוך מספיק כדי שהעצירה שלפניו תהיה לפני הסגירה
    // כלומר: LastStintDuration >= ClosedEndMs
    let minLastStint = minStintMs;
    if (closedEndMs > 0) {
        minLastStint = Math.max(minStintMs, closedEndMs + 120000); // באפר 2 דקות
    }

    // === שלב ב': חישוב היתרה לאמצע ===
    // כמה זמן נשאר לחלק לסטינטים 2 עד N-1?
    // אנו מניחים כרגע שהאחרון הוא במינימום ההכרחי, ואת העודף נחלק באמצע.
    let remainingTime = totalNetDriveTime - durationFirst - minLastStint;
    const middleStintsCount = totalStints - 2;

    // הגנה מפני קריסה במקרה של זמן שלילי (אם הגדרות המירוץ לא הגיוניות)
    if (remainingTime < middleStintsCount * minStintMs) {
        console.warn("Time budget too tight, adjusting first/last to fit minimums.");
        // במקרה קיצון: נחזיר הכל למינימום ונחלק שווה בשווה (התעלמות זמנית מגרידי)
        const avg = totalNetDriveTime / totalStints;
        const fallbackDurations = new Array(totalStints).fill(avg);
        return { durations: fallbackDurations };
    }

    // === שלב ג': מילוי האמצע (Greedy -> Bank) ===
    const stintDurations = new Array(totalStints).fill(0);
    stintDurations[0] = durationFirst; // קיבענו את הראשון
    
    // מילוי סטינטים אמצעיים
    if (middleStintsCount > 0) {
        // כמה סטינטים שלמים (Max) נכנסים ביתרה?
        // אנחנו צריכים לוודא שאנחנו משאירים מספיק זמן ליתר הסטינטים להיות לפחות במינימום
        
        let currentPool = remainingTime;
        
        for (let i = 1; i <= middleStintsCount; i++) {
            const slotsLeftAfterThis = middleStintsCount - i;
            const reservedForOthers = slotsLeftAfterThis * minStintMs;
            
            // כמה מקסימום אני יכול לקחת עכשיו בלי לדפוק את הבאים?
            let canTake = currentPool - reservedForOthers;
            
            // קח את המקסימום האפשרי (Greedy) עד התקרה
            let take = Math.min(canTake, targetStintDuration);
            
            // שמור על מינימום
            take = Math.max(take, minStintMs);
            
            stintDurations[i] = take;
            currentPool -= take;
        }
        
        // את מה שנשאר (העודף מעל המינימום של האחרון) נוסיף לסטינט האחרון
        // אבל רגע, הגדרנו את האחרון כמינימום. בוא נראה מה נשאר מה-Total האמיתי.
        
    }

    // === שלב ד': חישוב הסטינט האחרון (השארית המוחלטת) ===
    // זה מבטיח שלעולם לא יהיה מספר שלילי!
    const usedSoFar = stintDurations.slice(0, totalStints - 1).reduce((a, b) => a + b, 0);
    let finalStintDuration = totalNetDriveTime - usedSoFar;

    // === שלב ה': אימות ותיקון הסטינט האחרון ===
    // אם האחרון יצא ארוך מדי (מעל המקסימום), צריך להעביר זמן אחורה ל"בנקים"
    if (finalStintDuration > effectiveMaxStint) {
        const excess = finalStintDuration - targetStintDuration;
        finalStintDuration = targetStintDuration; // מקצצים את האחרון
        
        // מחלקים את העודף שווה בשווה בין סטינטים של ה"בנק" (אלו שקצרים מהמקסימום)
        // או פשוט בין כל הסטינטים האמצעיים
        if (middleStintsCount > 0) {
            const spread = excess / middleStintsCount;
            for (let i = 1; i <= middleStintsCount; i++) {
                stintDurations[i] += spread;
            }
        } else {
            // אם אין אמצע, מוסיפים לראשון
            stintDurations[0] += excess;
        }
    }
    
    stintDurations[totalStints - 1] = finalStintDuration;

    return { durations: stintDurations };
};

// ============================================================
// 🧮 MAIN STRATEGY CALCULATION
// ============================================================

window.calculateStrategyLogic = function(config) {
    const raceMs = config.raceMs || (config.duration * 3600000);
    const pitTimeMs = config.pitTime * 1000;
    const totalStints = config.stops + 1;
    const maxDriverTotalMs = (config.maxDriverTotal || 0) * 60000;
    
    const SQUAD_SHIFT_DURATION_MS = 4 * 3600000;
    const MIN_REST_FOR_SWITCH_MS = 4 * 3600000;
    const extendedConfig = { ...config, maxDriverTotalMs };
    
    // ============================================================
    // 📐 PRE-CALCULATE ALL STINT DURATIONS
    // ============================================================
    
    const durationResult = window.calculateStintDurations(config);
    
    if (durationResult.error) {
        return { error: durationResult.error };
    }
    
    const stintDurations = durationResult.durations;
    
    console.log(`📋 Planned stint durations: ${stintDurations.map(d => (d/60000).toFixed(1) + 'm').join(', ')}`);
    
    // ============================================================
    // 🏁 BUILD TIMELINE WITH DRIVER ASSIGNMENT
    // ============================================================
    
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
        
        // ============================================================
        // 👥 DRIVER SELECTION
        // ============================================================
        
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
        
        // Add pit stop
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

// ============================================================
// 🎮 RUN SIMULATION
// ============================================================

window.runSim = function() {
    window.updateDriversFromUI();
    if (!window.drivers || window.drivers.length === 0) return;

    const durationHours = parseFloat(document.getElementById('raceDuration').value) || 0;

    const startTimeInput = document.getElementById('raceStartTime');
    if (startTimeInput && window.previewData && window.previewData.startTime) {
        const dt = new Date(window.previewData.startTime);
        // פורמט HH:MM לאינפוט
        const timeStr = dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        // עדכון רק אם האינפוט ריק או שונה מהותית (למניעת לופ)
        if (!startTimeInput.value) { 
            startTimeInput.value = timeStr;
        }
    }

    if (startTimeInput && startTimeInput.value) {
        const [h, m] = startTimeInput.value.split(':');
        const startDate = new Date();
        startDate.setHours(parseInt(h), parseInt(m), 0, 0);
        window.raceStartTime = startDate.toISOString();
    }

    const config = {
        duration: durationHours,
        raceMs: durationHours * 3600000,
        reqStops: parseInt(document.getElementById('reqPitStops').value) || 0,
        stops: parseInt(document.getElementById('reqPitStops').value) || 0,
        minStint: parseFloat(document.getElementById('minStint').value) || 0,
        maxStint: parseFloat(document.getElementById('maxStint').value) || 0,
        pitTime: parseInt(document.getElementById('minPitTime').value) || 0,
        fuel: parseFloat(document.getElementById('fuelTime').value) || 0,
        closedStart: parseFloat(document.getElementById('pitClosedStart').value) || 0,
        closedEnd: parseFloat(document.getElementById('pitClosedEnd').value) || 0,
        minDriverTotal: parseFloat(document.getElementById('minDriverTime').value) || 0,
        maxDriverTotal: parseFloat(document.getElementById('maxDriverTime').value) || 0,
        allowDouble: document.getElementById('allowDouble').checked,
        useSquads: document.getElementById('useSquads').checked,
        maxStintMs: (parseFloat(document.getElementById('maxStint').value) || 0) * 60000,
        minStintMs: (parseFloat(document.getElementById('minStint').value) || 0) * 60000,
        minPitSec: parseInt(document.getElementById('minPitTime').value) || 0
    };

    window.config = config;
    const result = window.calculateStrategyLogic(config);
    const resEl = document.getElementById('simResult');

    if (result.error) {
        resEl.innerText = "⚠️ " + result.error;
        resEl.classList.remove('hidden');
        resEl.style.borderColor = 'red';
        resEl.style.color = '#ef4444';
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
        startTime: result.timeline[0].startTime
    };

    const stints = result.timeline.filter(t => t.type === 'stint');
    const pits = result.timeline.filter(t => t.type === 'pit');
    const avg = stints.length ? (result.driverStats.reduce((a, b) => a + b.driven, 0) / stints.length / 60000).toFixed(1) : 0;
    
    // Calculate last pit info
    let pitInfo = '';
    if (config.closedEnd > 0 && pits.length > 0) {
        const lastPit = pits[pits.length - 1];
        const deadline = (config.duration * 60) - config.closedEnd;
        const lastPitMin = (lastPit.raceTimeAtEntry / 60000).toFixed(0);
        const margin = deadline - lastPitMin;
        pitInfo = ` | ⏱️ Last pit: ${lastPitMin}m (${margin > 0 ? '+' : ''}${margin}m)`;
    }

    let squadInfo = '';
    if (config.useSquads) {
        const nightStints = stints.filter(s => s.isNightPhase);
        if (nightStints.length > 0) {
            const squadANight = nightStints.filter(s => s.squad === 'A').length;
            const squadBNight = nightStints.filter(s => s.squad === 'B').length;
            squadInfo = ` | 🌙 A=${squadANight} B=${squadBNight}`;
        }
    }

    resEl.innerText = `✅ ${stints.length} Stints | ~${avg}m${pitInfo}${squadInfo}`;
    resEl.style.borderColor = '#22d3ee';
    resEl.style.color = '#22d3ee';
    resEl.classList.remove('hidden');
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
    // 1. וידוא שיש אסטרטגיה
    if (!window.cachedStrategy) {
        // מנסים להריץ סימולציה אם לא הורצה
        window.runSim();
        if (!window.cachedStrategy) return alert("Please generate a strategy first!");
    }

    // 2. בדיקת דאבל סטינט (Safety Check)
    const allowDouble = document.getElementById('allowDouble')?.checked;
    // בודקים אם יש דאבל סטינט באסטרטגיה אבל האופציה כבויה
    if (!allowDouble && window.previewData && window.previewData.timeline) {
        const stints = window.previewData.timeline.filter(t => t.type === 'stint');
        for (let i = 1; i < stints.length; i++) {
            if (stints[i].driverName === stints[i-1].driverName) {
                alert(`⚠️ Safety Check:\nDouble Stint detected for "${stints[i].driverName}" but option is disabled.\nPlease enable 'Double Stint' or fix strategy.`);
                return; // עוצרים הכל
            }
        }
    }

    console.log("🏁 Starting Race...");

    // === תיקון סנכרון זמנים ===
    // לוקחים את הזמן פעם אחת בדיוק עבור כל המשתנים
    const now = Date.now();

    window.state.isRunning = true;
    window.state.startTime = now;      // זמן התחלת מירוץ
    window.state.stintStart = now;     // זמן התחלת סטינט (זהים לחלוטין!)
    window.state.pitCount = 0;
    window.state.isInPit = false;
    window.state.stintOffset = 0;
    window.state.mode = 'normal';
    window.state.currentDriverIdx = window.cachedStrategy.timeline[0].driverIdx;
    
    // חישוב נהג הבא
    window.state.nextDriverIdx = (window.state.currentDriverIdx + 1) % window.drivers.length;
    
    // אם יש חוליות (Squads), מוצאים את הבא שמתאים לחוליה אחרת או לפי הלוגיקה
    if (window.config.useSquads) {
        let attempts = 0;
        let candidate = window.state.nextDriverIdx;
        // לולאה למציאת נהג מחוליה מתאימה (אם צריך)
        // כרגע פשוט לוקחים את הבא, אלא אם תרצה לוגיקה מורכבת יותר של החלפת חוליות
        while (window.drivers[candidate].squad !== window.drivers[window.state.currentDriverIdx].squad && attempts < window.drivers.length) {
            candidate = (candidate + 1) % window.drivers.length;
            attempts++;
        }
        window.state.nextDriverIdx = candidate;
    }

    window.state.globalStintNumber = 1;

    // הגדרת יעדים (Targets) לכל סטינט
    if (window.cachedStrategy && window.cachedStrategy.timeline) {
        window.state.stintTargets = window.cachedStrategy.timeline
            .filter(t => t.type === 'stint')
            .map(t => t.duration);
    } else {
        window.state.stintTargets = [];
    }
    
    // יעד לסטינט הראשון
    window.state.targetStintMs = window.state.stintTargets[0] || (window.config.maxStint * 60000);

    // עדכון ממשק (מעבר מסך)
    const setupScreen = document.getElementById('setupScreen');
    const raceDashboard = document.getElementById('raceDashboard');
    
    if (setupScreen) setupScreen.classList.add('hidden');
    if (raceDashboard) raceDashboard.classList.remove('hidden');
    
    // אם אנחנו Host, נאתחל את ה-Peer (תקשורת)
    if (typeof window.initHostPeer === 'function') window.initHostPeer();
    
    // מניעת כיבוי מסך (Wake Lock)
    if ('wakeLock' in navigator) {
        navigator.wakeLock.request('screen').catch(err => console.log("Wake Lock error:", err));
    }

    // איפוס והתחלת אינטרוול ראשי
    if (window.raceInterval) clearInterval(window.raceInterval);
    
    window.raceInterval = setInterval(() => {
        // בדיקה אם הפונקציה tick קיימת (בדרך כלל ב-main.js)
        if (typeof window.tick === 'function') window.tick();
        
        // שידור ללקוחות
        if (typeof window.broadcast === 'function') window.broadcast();
        
        // רינדור (אם לא נעשה ב-tick)
        if (typeof window.renderFrame === 'function') window.renderFrame();
    }, 1000);

    // שמירה אוטומטית כל 10 שניות
    if (typeof window.saveRaceState === 'function') {
        setInterval(window.saveRaceState, 10000);
    }
    
    // === קריאה מיידית לרינדור (התיקון לדיליי) ===
    // זה גורם למספרים להופיע מיד, בלי לחכות שנייה
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
