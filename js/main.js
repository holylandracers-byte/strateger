// ==========================================
// 🚀 MAIN ENTRY POINT & RACE LOOP
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Strateger Initializing...");

    let savedLang = localStorage.getItem('strateger_lang');
    if (!savedLang) {
        const browserLang = navigator.language.split('-')[0];
        savedLang = (['he', 'fr', 'pt'].includes(browserLang)) ? browserLang : 'en';
    }
    if (typeof window.setLanguage === 'function') window.setLanguage(savedLang);

    if (typeof window.addDriverField === 'function') {
        window.addDriverField();
        window.addDriverField();
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');

    if (joinCode) {
        window.role = 'client';
        document.getElementById('setupScreen').classList.add('hidden');
        document.getElementById('clientWaitScreen').classList.remove('hidden');
        if (typeof window.connectToHost === 'function') window.connectToHost(joinCode);
    } else {
        window.role = 'host';
        if (typeof window.checkForSavedRace === 'function') window.checkForSavedRace();
    }
    
    if(typeof updateModeUI === 'function') updateModeUI();
    if(typeof updateWeatherUI === 'function') updateWeatherUI();
    if(typeof attachConfigListeners === 'function') attachConfigListeners();

    document.getElementById('chatToggleBtn').classList.remove('hidden');
});

// ==========================================
// 🎮 MODE CONTROL
// ==========================================

window.setMode = function(mode) {
    if (window.role !== 'host') return;

    if (mode === 'push') {
        window.state.mode = (window.state.mode === 'push') ? 'normal' : 'push';
    } else if (mode === 'bad') {
        window.state.mode = (window.state.mode === 'bad') ? 'normal' : 'bad';
    } else {
        window.state.mode = 'normal';
    }

    updateModeUI();
    if (typeof window.recalculateTargetStint === 'function') window.recalculateTargetStint();
    if (typeof window.broadcast === 'function') window.broadcast();
    window.renderFrame();
};

function updateModeUI() {
    const btnPush = document.getElementById('btnPush');
    const btnBad = document.getElementById('btnBad');
    const btnReset = document.getElementById('btnResetMode');
    const adviceText = document.getElementById('strategyAdvice');
    const t = window.t || ((k) => k); 

    const baseClass = "btn-press bg-navy-800 border rounded-lg text-sm text-gray-300 font-bold shadow-md transition flex flex-col items-center justify-center";
    
    if (btnPush) {
        btnPush.className = baseClass + " border-green-500/30 hover:bg-navy-700";
        if (window.state.mode === 'push') {
            btnPush.className = "btn-press bg-green-600 border-green-400 rounded-lg text-sm text-white font-bold shadow-[0_0_15px_rgba(34,197,94,0.4)] flex flex-col items-center justify-center scale-105";
        }
    }

    if (btnBad) {
        btnBad.className = baseClass + " border-red-500/30 hover:bg-navy-700";
        if (window.state.mode === 'bad') {
            btnBad.className = "btn-press bg-red-600 border-red-400 rounded-lg text-sm text-white font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)] flex flex-col items-center justify-center scale-105";
        }
    }

    if (btnReset) {
        btnReset.classList.toggle('hidden', window.state.mode === 'normal');
    }

    if (adviceText) {
        if (window.state.mode === 'bad') {
            adviceText.innerText = "⚠️ " + t('boxNow');
            adviceText.className = "text-xs font-bold text-red-500 animate-pulse uppercase tracking-widest";
        } else if (window.state.mode === 'push') {
            adviceText.innerText = "🔥 " + t('pushMode');
            adviceText.className = "text-[10px] font-bold text-green-400 uppercase tracking-widest";
        } else {
            adviceText.innerText = t('buildTime');
            adviceText.className = "text-[10px] text-gray-500 font-bold uppercase tracking-widest";
        }
    }
}

window.recalculateTargetStint = function() {
    if (!window.config || !window.state) return;
    
    if (window.state.mode === 'push') {
        window.state.targetStintMs = (window.config.maxStintMs || 65 * 60000) - 60000;
    } else if (window.state.mode === 'bad') {
        window.state.targetStintMs = window.config.minStintMs || 30 * 60000;
    } else {
        const currentStintIdx = window.state.globalStintNumber - 1;
        if (window.state.stintTargets && window.state.stintTargets[currentStintIdx]) {
            window.state.targetStintMs = window.state.stintTargets[currentStintIdx];
        }
    }
};

// ==========================================
// 🌦️ WEATHER CONTROL
// ==========================================

window.toggleRain = function() {
    if (!window.state.trackCondition) window.state.trackCondition = 'dry';

    if (window.state.trackCondition === 'dry') {
        window.state.trackCondition = 'wet';
        window.state.isRain = true;
    } else if (window.state.trackCondition === 'wet') {
        window.state.trackCondition = 'drying';
        window.state.isRain = false;
    } else {
        window.state.trackCondition = 'dry';
        window.state.isRain = false;
    }

    updateWeatherUI();
    if (typeof window.broadcast === 'function') window.broadcast();
};

function updateWeatherUI() {
    const btn = document.getElementById('btnRain');
    const icon = document.getElementById('rainIcon');
    const text = document.getElementById('rainText');
    const t = window.t || ((k) => k);
    const condition = window.state.trackCondition || 'dry';

    if (condition === 'wet') {
        if(icon) icon.innerText = "🌧️";
        if(text) { text.innerText = t('wet'); text.className = "text-xs font-bold text-blue-300"; }
        if(btn) btn.className = "bg-blue-900/50 border border-blue-400 rounded px-3 py-1 hover:bg-blue-800 transition";
    } else if (condition === 'drying') {
        if(icon) icon.innerText = "⛅";
        if(text) { text.innerText = t('drying'); text.className = "text-xs font-bold text-orange-400"; }
        if(btn) btn.className = "bg-navy-800 border border-orange-500/50 rounded px-3 py-1 hover:bg-navy-700 transition";
    } else {
        if(icon) icon.innerText = "☀️";
        if(text) { text.innerText = t('dry'); text.className = "text-xs font-bold text-yellow-400"; }
        if(btn) btn.className = "bg-navy-800 border border-yellow-500/50 rounded px-3 py-1 hover:bg-navy-700 transition";
    }
}

// ==========================================
// 🌙 NIGHT MODE
// ==========================================

window.toggleNightMode = function() {
    if (!window.config.useSquads) return;
    window.state.isNightMode = !window.state.isNightMode;
    
    const currentDriver = window.drivers[window.state.currentDriverIdx];
    if (window.state.isNightMode && currentDriver) {
        window.state.activeSquad = currentDriver.squad;
    }
    
    updateNightModeUI();
    if (window.state.isNightMode) window.cycleNextDriver(true);
    if (typeof window.broadcast === 'function') window.broadcast();
};

function updateNightModeUI() {
    const container = document.getElementById('nightModeContainer');
    const btn = document.getElementById('btnNightMode');
    const text = document.getElementById('nightModeText');
    const t = window.t || ((k) => k);

    if (window.config.useSquads) container.classList.remove('hidden');
    else { container.classList.add('hidden'); return; }

    if (window.state.isNightMode) {
        const activeSquad = window.state.activeSquad || 'A';
        const sleepingSquad = activeSquad === 'A' ? 'B' : 'A';
        btn.className = "w-full bg-indigo-600 hover:bg-indigo-500 border border-indigo-300 text-white text-xs font-bold py-3 rounded transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-pulse";
        text.innerHTML = `${t('squadSleeping')} <span class="text-yellow-300 text-lg font-black px-1">${sleepingSquad}</span>`;
    } else {
        btn.className = "w-full bg-navy-800 hover:bg-navy-700 border border-indigo-500/30 text-indigo-300 text-xs font-bold py-3 rounded transition flex items-center justify-center gap-2";
        text.innerText = t('nightMode');
    }
}

// ==========================================
// ⏱️ CORE LOOP
// ==========================================

window.tick = function() {
    if (!window.state.isRunning) return;
    const now = Date.now();
    const raceMs = window.config.raceMs || (parseFloat(window.config.duration) * 3600000);
    if (now - window.state.startTime >= raceMs) {
        window.state.isRunning = false;
        alert("🏁 RACE FINISHED! 🏁");
    }
    window.renderFrame();
};

window.renderFrame = function() {
    if (!window.state || !window.state.isRunning) return;
    
    // בודק שפה כל פריים לוודא סינכרון
    const currentLang = localStorage.getItem('strateger_lang') || 'en';
    if (document.documentElement.lang !== currentLang && typeof window.setLanguage === 'function') {
        window.setLanguage(currentLang);
    }

    const raceMs = window.config.raceMs || (parseFloat(window.config.duration) * 3600000);
    if (!raceMs) return;

    try {
        const now = Date.now();
        const raceElapsed = now - window.state.startTime;
        const raceRemaining = raceMs - raceElapsed;
        
        const timerEl = document.getElementById('raceTimerDisplay');
        if (raceRemaining <= 0) {
            timerEl.innerText = "FINISH";
            timerEl.classList.add("text-neon", "animate-pulse");
            return;
        }
        timerEl.innerText = window.formatTimeHMS(raceRemaining);

        const totalPlannedStops = window.config.reqStops || 0;
        document.getElementById('pitCountDisplay').innerHTML = 
            `<span class="text-neon text-xl">${window.state.pitCount}</span><span class="text-gray-500 text-xs">/${totalPlannedStops}</span>`;

        const curr = window.drivers[window.state.currentDriverIdx];
        const next = window.drivers[window.state.nextDriverIdx];
        if (curr) document.getElementById('currentDriverName').innerText = curr.name;
        if (next) {
            const nextEls = [document.getElementById('nextDriverName'), document.getElementById('modalNextDriverName')];
            nextEls.forEach(el => { if(el) el.innerText = next.name; });
        }

        if (!window.state.isInPit) {
            let currentStintTime = (now - window.state.stintStart) + (window.state.stintOffset || 0);
            document.getElementById('stintTimerDisplay').innerText = window.formatTimeHMS(Math.max(0, currentStintTime));
            
            const maxStintMs = (window.config.maxStintMs) || (window.config.maxStint * 60000) || (60 * 60000);
            const minStintMs = (window.config.minStint * 60000) || 0;
            const targetMs = window.state.targetStintMs || maxStintMs;

            const currentPct = Math.min(100, (currentStintTime / maxStintMs) * 100);
            const minPct = Math.min(100, (minStintMs / maxStintMs) * 100);
            const targetPct = Math.min(100, (targetMs / maxStintMs) * 100);

            const bar = document.getElementById('stintProgressBar');
            if (bar) {
                bar.style.width = `${currentPct}%`;
                if (currentStintTime < minStintMs) bar.className = "absolute top-0 left-0 h-full bg-gradient-to-r from-orange-600 to-yellow-500 opacity-90";
                else if (currentStintTime < targetMs) bar.className = "absolute top-0 left-0 h-full bg-gradient-to-r from-green-600 to-neon opacity-90";
                else bar.className = "absolute top-0 left-0 h-full bg-red-600 animate-pulse opacity-90";
            }

            const zone = document.getElementById('zoneForbidden');
            const minLine = document.getElementById('minStintLine');
            if (zone) zone.style.width = `${minPct}%`;
            if (minLine) {
                minLine.classList.remove('hidden');
                minLine.style.left = `${minPct}%`;
            }

            const targetLine = document.getElementById('targetStintLine');
            if (targetLine) {
                targetLine.classList.remove('hidden');
                targetLine.style.left = `${targetPct}%`;
            }
        }

        updateRemainingStrategyLogic(raceRemaining);

        if (typeof window.updateStats === 'function' && !window.state.isInPit) {
            let t = (now - window.state.stintStart) + (window.state.stintOffset || 0);
            window.updateStats(t);
        }

        updateWeatherUI();
        updateModeUI();

    } catch (e) {
        console.error("Render Frame Error:", e);
    }
};

function updateRemainingStrategyLogic(raceRemainingMs) {
    const panel = document.getElementById('remainingStintsPanel');
    const textField = document.getElementById('remStintsText');
    const timeField = document.getElementById('remTimeText');
    const t = window.t || ((k) => k);
    
    if (!panel || window.role !== 'host') return;
    panel.classList.remove('hidden');

    const maxStintMs = (window.config.maxStintMs) || 60 * 60000;
    const minStintMs = (window.config.minStintMs) || 15 * 60000;
    const pitTimeMs = (window.config.minPitSec || 60) * 1000;
    
    const stopsDone = window.state.pitCount;
    const totalStops = window.config.reqStops || 0;
    const stopsLeft = Math.max(0, totalStops - stopsDone);
    
    const futurePitTimeLoss = stopsLeft * pitTimeMs;
    const netDriveTimeLeft = raceRemainingMs - futurePitTimeLoss;
    
    if (netDriveTimeLeft <= 0) {
        textField.innerText = t('finalLap');
        return;
    }

    const maxStintsCount = netDriveTimeLeft / maxStintMs;
    const fullMaxStints = Math.floor(maxStintsCount);
    const remainderMs = netDriveTimeLeft - (fullMaxStints * maxStintMs);
    
    let text = "";
    if (fullMaxStints > 0) {
        text += `${fullMaxStints}x <span class="text-neon">MAX</span> `;
    }
    if (remainderMs > 0) {
        const remMin = Math.ceil(remainderMs / 60000);
        const color = remainderMs < minStintMs ? "text-red-400" : "text-yellow-400";
        text += `+ <span class="${color}">${remMin}m</span>`;
    }
    
    textField.innerHTML = text || t('calculating');
    timeField.innerText = window.formatTimeHMS(raceRemainingMs);
}

// ==========================================
// 🛑 PIT STOP LOGIC
// ==========================================

window.currentPitAdjustment = 0;

window.adjustPitTime = function(seconds) {
    window.currentPitAdjustment += seconds;
    const dashDisplay = document.getElementById('dashboardPitAdjDisplay');
    const btnBadge = document.getElementById('btnPitAdjBadge');
    
    if (dashDisplay) {
        const sign = window.currentPitAdjustment >= 0 ? '+' : '';
        dashDisplay.innerText = `${sign}${window.currentPitAdjustment}s`;
        dashDisplay.className = `bg-black/30 px-2 py-1 rounded font-mono font-bold text-xs min-w-[30px] text-center ${
            window.currentPitAdjustment > 0 ? 'text-red-400' : (window.currentPitAdjustment < 0 ? 'text-green-400' : 'text-ice')
        }`;
    }

    if (btnBadge) {
        if (window.currentPitAdjustment !== 0) {
            const sign = window.currentPitAdjustment > 0 ? '+' : '';
            btnBadge.innerText = `${sign}${window.currentPitAdjustment}s`;
            btnBadge.classList.remove('hidden');
        } else {
            btnBadge.classList.add('hidden');
        }
    }
    
    if (window.state.isInPit) {
        window.updatePitModalLogic();
        const modalVal = document.getElementById('modalPitAdjValue');
        if (modalVal) modalVal.innerText = `${window.currentPitAdjustment > 0 ? '+' : ''}${window.currentPitAdjustment}s`;
    }
};

window.confirmPitEntry = function() {
    const now = Date.now();
    const currentStintMs = (now - window.state.stintStart) + (window.state.stintOffset || 0);
    const minStintMs = (window.config.minStint || 0) * 60000;
    let isShortStint = false;

    if (minStintMs > 0 && currentStintMs < minStintMs) {
        const missingSec = Math.ceil((minStintMs - currentStintMs) / 1000);
        if (!confirm(`⚠️ Short Stint Warning!\nMissing ${missingSec} seconds.\nProceed to Pit?`)) return;
        isShortStint = true;
    }

    window.state.isInPit = true;
    window.state.pitStart = now;
    window.state.pitCount++; // === UP COUNT ===

    const modal = document.getElementById('pitModal');
    const warningEl = document.getElementById('pitStintWarning');
    const modalAdjInfo = document.getElementById('modalPitAdjInfo');
    const modalAdjVal = document.getElementById('modalPitAdjValue');

    if (modal) {
        modal.classList.remove('hidden');
        if (warningEl) warningEl.classList.toggle('hidden', !isShortStint);

        if (modalAdjInfo && modalAdjVal) {
            if (window.currentPitAdjustment !== 0) {
                modalAdjInfo.classList.remove('hidden');
                modalAdjVal.innerText = `${window.currentPitAdjustment > 0 ? '+' : ''}${window.currentPitAdjustment}s`;
            } else {
                modalAdjInfo.classList.add('hidden');
            }
        }
        
        const releaseBtn = document.getElementById('confirmExitBtn');
        if (releaseBtn) {
            releaseBtn.disabled = true;
            releaseBtn.innerText = "WAIT...";
            releaseBtn.className = "w-full max-w-xs bg-gray-800 text-gray-500 font-bold py-4 rounded-lg text-2xl border border-gray-700 cursor-not-allowed";
        }
    }

    if (window.pitInterval) clearInterval(window.pitInterval);
    window.pitInterval = setInterval(window.updatePitModalLogic, 100);
    
    if (typeof window.broadcast === 'function') window.broadcast();
    window.renderFrame();
};

window.updatePitModalLogic = function() {
    const now = Date.now();
    const elapsedSec = (now - window.state.pitStart) / 1000;
    const basePitTime = parseInt(window.config.minPitTime || window.config.pitTime) || 0;
    const totalRequiredTime = Math.max(0, basePitTime + window.currentPitAdjustment); 
    const buffer = parseInt(document.getElementById('releaseBuffer')?.value) || 5;
    const timeRemaining = totalRequiredTime - elapsedSec;

    const timerDisplay = document.getElementById('pitTimerDisplay');
    if (timerDisplay) timerDisplay.innerText = Math.max(0, timeRemaining).toFixed(1);

    const releaseBtn = document.getElementById('confirmExitBtn');
    if (!releaseBtn) return;

    if (timeRemaining > buffer) {
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-red-500";
        releaseBtn.innerText = "WAIT";
        releaseBtn.disabled = true;
        releaseBtn.className = "w-full max-w-xs bg-gray-800 text-gray-500 font-bold py-4 rounded-lg text-2xl border border-gray-700 cursor-not-allowed";
    } else if (timeRemaining <= buffer && timeRemaining > 0) {
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-yellow-400 animate-pulse";
        releaseBtn.innerText = "GET READY";
        releaseBtn.disabled = false;
        releaseBtn.className = "w-full max-w-xs bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 rounded-lg text-2xl border border-yellow-400 animate-pulse cursor-pointer";
    } else {
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-green-500";
        releaseBtn.innerText = "GO! GO! GO!";
        releaseBtn.disabled = false;
        releaseBtn.className = "w-full max-w-xs bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg text-3xl border border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)] cursor-pointer";
    }
};

window.cancelPitStop = function() {
    if (window.pitInterval) clearInterval(window.pitInterval);
    
    window.state.isInPit = false;
    window.state.pendingPitEntry = false;
    
    // === FIX: Decrement count on cancel ===
    if (window.state.pitCount > 0) {
        window.state.pitCount--;
    }
    
    if (typeof window.adjustPitTime === 'function' && window.currentPitAdjustment !== 0) {
        window.adjustPitTime(-window.currentPitAdjustment);
    }
    
    document.getElementById('pitModal').classList.add('hidden');
    if (typeof window.broadcast === 'function') window.broadcast();
    window.renderFrame();
};

window.cycleNextDriver = function(forceValidation = false) {
    if (!window.drivers || window.drivers.length === 0) return;

    let candidate = window.state.nextDriverIdx;
    if (!forceValidation) {
        candidate = (candidate + 1) % window.drivers.length;
    }

    let attempts = 0;
    while (attempts < window.drivers.length) {
        const driver = window.drivers[candidate];
        let isValid = true;

        if (window.config.useSquads) {
            if (window.state.isNightMode && driver.squad !== window.state.activeSquad) {
                isValid = false;
            }
        }

        if (candidate === window.state.currentDriverIdx) {
            const allowDouble = window.config.allowDouble || document.getElementById('allowDouble')?.checked;
            if (!allowDouble || window.state.consecutiveStints >= 2) {
                isValid = false;
            }
        }

        if (isValid) {
            window.state.nextDriverIdx = candidate;
            break;
        }
        candidate = (candidate + 1) % window.drivers.length;
        attempts++;
    }

    const nextDriver = window.drivers[window.state.nextDriverIdx];
    const nextEls = [document.getElementById('nextDriverName'), document.getElementById('modalNextDriverName')];
    nextEls.forEach(el => { if(el && nextDriver) el.innerText = nextDriver.name; });

    if (typeof window.broadcast === 'function') window.broadcast();
};

window.confirmPitExit = function() {
    const prevDriverIdx = window.state.currentDriverIdx;
    const now = Date.now();
    const pitDuration = now - window.state.pitStart;
    const driveDuration = window.state.pitStart - window.state.stintStart;

    if (window.pitInterval) clearInterval(window.pitInterval);
    document.getElementById('pitModal').classList.add('hidden');
    
    if (window.drivers[prevDriverIdx]) {
        const driver = window.drivers[prevDriverIdx];
        if (!driver.logs) driver.logs = [];
        driver.totalTime = (driver.totalTime || 0) + driveDuration;
        driver.logs.push({ drive: driveDuration, pit: pitDuration, timestamp: now });
        driver.stints = (driver.stints || 0) + 1;
    }

    window.state.currentDriverIdx = window.state.nextDriverIdx;
    if (typeof window.cycleNextDriver === 'function') window.cycleNextDriver();

    window.state.isInPit = false;
    window.state.stintStart = now;
    window.state.stintOffset = 0;
    window.state.globalStintNumber++;
    
    if (typeof window.adjustPitTime === 'function') {
        window.adjustPitTime(-window.currentPitAdjustment); 
    }

    const newDriverIdx = window.state.currentDriverIdx;
    if (newDriverIdx === prevDriverIdx) {
        window.state.consecutiveStints = (window.state.consecutiveStints || 1) + 1;
    } else {
        window.state.consecutiveStints = 1; 
        if (window.config.useSquads && window.drivers[newDriverIdx] && !window.state.isNightMode) {
            window.state.activeSquad = window.drivers[newDriverIdx].squad;
        }
    }

    if (typeof window.saveRaceState === 'function') window.saveRaceState();
    if (typeof window.broadcast === 'function') window.broadcast();
    if (typeof window.renderFrame === 'function') window.renderFrame();
};