// ==========================================
// 🚀 MAIN ENTRY POINT & RACE LOOP
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Strateger Initializing...");

    // === תיקון באג שפה ===
    // 1. נסה לשלוף מהזיכרון, אם אין - בדוק את שפת הדפדפן, ברירת מחדל אנגלית
    let savedLang = localStorage.getItem('strateger_lang');
    if (!savedLang) {
        const browserLang = navigator.language.split('-')[0];
        savedLang = (['he', 'fr', 'pt'].includes(browserLang)) ? browserLang : 'en';
    }
    
    // 2. הפעלת תרגום מיידית
    if (typeof window.setLanguage === 'function') {
        window.setLanguage(savedLang);
    }

    // ... (שאר האתחולים: נהגים, חיבור, וכו') ...
    if (typeof window.addDriverField === 'function') {
        window.addDriverField();
        window.addDriverField();
    }
    
    // 3. בדיקת קישור הזמנה (Client Mode)
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');

    if (joinCode) {
        console.log("🔗 Joining race:", joinCode);
        window.role = 'client';
        
        const setup = document.getElementById('setupScreen');
        if(setup) setup.classList.add('hidden');
        
        const wait = document.getElementById('clientWaitScreen');
        if(wait) wait.classList.remove('hidden');
        
        if (typeof window.connectToHost === 'function') {
            window.connectToHost(joinCode);
        }
    } else {
        window.role = 'host';
        // בדיקה אם יש מירוץ שמור
        if (typeof window.checkForSavedRace === 'function') {
            window.checkForSavedRace();
        }
    }
    
    // 4. אתחול UI
    updateModeUI();
    updateWeatherUI();
    
    // 5. האזנה לשינויים בהגדרות
    attachConfigListeners();
});

// ==========================================
// 🎮 MODE CONTROL (Push / Problem)
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
    
    if (typeof window.recalculateTargetStint === 'function') {
        window.recalculateTargetStint();
    }
    
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
        if (window.state.mode !== 'normal') {
            btnReset.classList.remove('hidden');
        } else {
            btnReset.classList.add('hidden');
        }
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

// פונקציית עזר לחישוב יעד סטינט בזמן אמת
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

// ==========================================
// 🌦️ WEATHER CONTROL (Tri-State: Dry -> Wet -> Drying -> Dry)
// ==========================================

window.toggleRain = function() {
    // אתחול ראשוני אם לא קיים
    if (!window.state.trackCondition) window.state.trackCondition = 'dry';

    // מעגל המצבים
    if (window.state.trackCondition === 'dry') {
        window.state.trackCondition = 'wet';
        window.state.isRain = true; // תאימות לאחור
    } else if (window.state.trackCondition === 'wet') {
        window.state.trackCondition = 'drying'; // המצב החדש
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

    // ודא שיש ערך התחלתי
    const condition = window.state.trackCondition || (window.state.isRain ? 'wet' : 'dry');

    if (condition === 'wet') {
        // מצב גשם (כחול)
        if(icon) icon.innerText = "🌧️";
        if(text) {
            text.innerText = t('wet'); 
            text.className = "text-xs font-bold text-blue-300";
        }
        if(btn) btn.className = "bg-blue-900/50 border border-blue-400 rounded px-3 py-1 hover:bg-blue-800 transition";
    } 
    else if (condition === 'drying') {
        // מצב מתייבש (כתום/סגול - משהו שמסמל מעבר)
        if(icon) icon.innerText = "⛅"; // שמש עם ענן
        if(text) {
            text.innerText = t('drying');
            text.className = "text-xs font-bold text-orange-400";
        }
        if(btn) btn.className = "bg-navy-800 border border-orange-500/50 rounded px-3 py-1 hover:bg-navy-700 transition";
    } 
    else {
        // מצב יבש (צהוב)
        if(icon) icon.innerText = "☀️";
        if(text) {
            text.innerText = t('dry');
            text.className = "text-xs font-bold text-yellow-400";
        }
        if(btn) btn.className = "bg-navy-800 border border-yellow-500/50 rounded px-3 py-1 hover:bg-navy-700 transition";
    }
}

// ==========================================
// 🌙 NIGHT MODE & SQUAD LOGIC
// ==========================================

window.toggleNightMode = function() {
    if (!window.config.useSquads) return;
    
    window.state.isNightMode = !window.state.isNightMode;
    
    // זיהוי חוליה פעילה לפי הנהג הנוכחי
    const currentDriver = window.drivers[window.state.currentDriverIdx];
    if (window.state.isNightMode && currentDriver) {
        window.state.activeSquad = currentDriver.squad; // מקבע את החוליה הפעילה ללילה
    }
    
    updateNightModeUI();
    
    // אם הנהג הבא המתוכנן שייך לחוליה שישנה, נחליף אותו מיד
    if (window.state.isNightMode) {
        window.cycleNextDriver(true); // true = force validation check
    }
    
    if (typeof window.broadcast === 'function') window.broadcast();
};

function updateNightModeUI() {
    const container = document.getElementById('nightModeContainer');
    const btn = document.getElementById('btnNightMode');
    const text = document.getElementById('nightModeText');
    const t = window.t || ((k) => k);

    // הצגה רק אם יש חוליות
    if (window.config.useSquads) {
        container.classList.remove('hidden');
    } else {
        container.classList.add('hidden');
        return;
    }

    if (window.state.isNightMode) {
        // מצב לילה פעיל
        const activeSquad = window.state.activeSquad || 'A';
        const sleepingSquad = activeSquad === 'A' ? 'B' : 'A';
        
        btn.className = "w-full bg-indigo-600 hover:bg-indigo-500 border border-indigo-300 text-white text-xs font-bold py-3 rounded transition flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-pulse";
        text.innerHTML = `${t('squadSleeping')} <span class="text-yellow-300 text-lg font-black px-1">${sleepingSquad}</span>`;
    } else {
        // מצב רגיל
        btn.className = "w-full bg-navy-800 hover:bg-navy-700 border border-indigo-500/30 text-indigo-300 text-xs font-bold py-3 rounded transition flex items-center justify-center gap-2";
        text.innerText = t('nightMode');
    }
}

// ==========================================
// ⏱️ CORE LOOP & RENDERING
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
        
        // 1. שעון מירוץ
        const timerEl = document.getElementById('raceTimerDisplay');
        if (raceRemaining <= 0) {
            timerEl.innerText = "FINISH";
            timerEl.classList.add("text-neon", "animate-pulse");
            return;
        }
        timerEl.innerText = window.formatTimeHMS(raceRemaining);

        // 2. פיטס
        const totalPlannedStops = window.config.reqStops || 0;
        document.getElementById('pitCountDisplay').innerHTML = 
            `<span class="text-neon text-xl">${window.state.pitCount}</span><span class="text-gray-500 text-xs">/${totalPlannedStops}</span>`;

        // 3. נהגים
        const curr = window.drivers[window.state.currentDriverIdx];
        const next = window.drivers[window.state.nextDriverIdx];
        if (curr) document.getElementById('currentDriverName').innerText = curr.name;
        if (next) {
            const nextEls = [document.getElementById('nextDriverName'), document.getElementById('modalNextDriverName')];
            nextEls.forEach(el => { if(el) el.innerText = next.name; });
        }

        // 4. Stint Bar Logic
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

        // 5. Target Delta
        const targetEl = document.getElementById('strategyTargetStint');
        const deltaEl = document.getElementById('strategyDelta');
        let currentTargetMs = window.state.targetStintMs || (window.config.maxStint * 60000);
        
        if (targetEl) targetEl.innerText = window.formatTimeHMS(currentTargetMs);
        if (deltaEl && !window.state.isInPit) {
            let currentStintTime = (now - window.state.stintStart) + (window.state.stintOffset || 0);
            const diff = currentTargetMs - currentStintTime;
            const sign = diff >= 0 ? '-' : '+';
            deltaEl.innerText = `${sign}${window.formatTimeHMS(Math.abs(diff))}`;
            deltaEl.className = diff >= 0 ? "text-sm font-bold text-gray-400" : "text-sm font-bold text-red-500 animate-pulse";
        }

        // 6. אסטרטגיה דינמית
        updateRemainingStrategyLogic(raceRemaining);

        // 7. טבלה
        if (typeof window.updateStats === 'function' && !window.state.isInPit) {
            let t = (now - window.state.stintStart) + (window.state.stintOffset || 0);
            window.updateStats(t);
        }

        // 8. עדכוני UI
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
// 🛑 PIT STOP LOGIC (With Penalties)
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
        const confirmShort = confirm(`⚠️ Short Stint Warning!\nMissing ${missingSec} seconds.\nProceed to Pit?`);
        if (!confirmShort) return;
        isShortStint = true;
    }

    window.state.isInPit = true;
    window.state.pitStart = now;
    window.state.pitCount++;

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
    if (timerDisplay) {
        const displayTime = Math.max(0, timeRemaining);
        timerDisplay.innerText = displayTime.toFixed(1);
    }

    const releaseBtn = document.getElementById('confirmExitBtn');
    if (!releaseBtn) return;

    if (timeRemaining > buffer) {
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-red-500";
        releaseBtn.innerText = "WAIT";
        releaseBtn.disabled = true;
        releaseBtn.className = "w-full max-w-xs bg-gray-800 text-gray-500 font-bold py-4 rounded-lg text-2xl border border-gray-700 cursor-not-allowed";
    } 
    else if (timeRemaining <= buffer && timeRemaining > 0) {
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-yellow-400 animate-pulse";
        releaseBtn.innerText = "GET READY";
        releaseBtn.disabled = false;
        releaseBtn.className = "w-full max-w-xs bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 rounded-lg text-2xl border border-yellow-400 animate-pulse cursor-pointer";
    } 
    else {
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-green-500";
        releaseBtn.innerText = "GO! GO! GO!";
        releaseBtn.disabled = false;
        releaseBtn.className = "w-full max-w-xs bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg text-3xl border border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)] cursor-pointer";
    }
};

window.cycleNextDriver = function(forceValidation = false) {
    if (!window.drivers || window.drivers.length === 0) return;

    let candidate = window.state.nextDriverIdx;
    
    // אם זו לחיצה ידנית (לא forceValidation), אנחנו רוצים לקדם ב-1
    // אלא אם כן אנחנו במצב מיוחד של דאבל סטינט שטרם נוצל
    if (!forceValidation) {
        candidate = (candidate + 1) % window.drivers.length;
    }

    // --- לוגיקת סינון חכמה ---
    let attempts = 0;
    while (attempts < window.drivers.length) {
        const driver = window.drivers[candidate];
        let isValid = true;

        // 1. בדיקת חוליות ומצב לילה
        if (window.config.useSquads) {
            // אם מצב לילה פעיל: מתירים רק נהגים מהחוליה הפעילה
            if (window.state.isNightMode && driver.squad !== window.state.activeSquad) {
                isValid = false;
            }
            // אם מצב לילה כבוי: מנסים לשמור על רוטציה (אופציונלי, כאן אנחנו גמישים)
        }

        // 2. בדיקת דאבל סטינט (Double Stint)
        // אם המועמד הוא הנהג הנוכחי
        if (candidate === window.state.currentDriverIdx) {
            const allowDouble = window.config.allowDouble || document.getElementById('allowDouble')?.checked;
            // מותר רק אם: מופעל בהגדרות AND טרם עשה 2 סטינטים רצופים
            if (!allowDouble || window.state.consecutiveStints >= 2) {
                isValid = false;
            }
        }

        if (isValid) {
            window.state.nextDriverIdx = candidate;
            break; // מצאנו נהג תקין
        }

        // נסה את הבא בתור
        candidate = (candidate + 1) % window.drivers.length;
        attempts++;
    }

    // עדכון תצוגה
    const nextDriver = window.drivers[window.state.nextDriverIdx];
    const nextEls = [document.getElementById('nextDriverName'), document.getElementById('modalNextDriverName')];
    nextEls.forEach(el => { if(el && nextDriver) el.innerText = nextDriver.name; });

    if (typeof window.broadcast === 'function') window.broadcast();
};

// עדכון פונקציית היציאה מהפיטס (כדי לספור סטינטים רצופים)
const originalConfirmPitExit = window.confirmPitExit;

window.confirmPitExit = function() {
    // 1. שמירת הנהג הנוכחי (לפני ההחלפה) לבדיקת דאבל סטינט בהמשך
    const prevDriverIdx = window.state.currentDriverIdx;

    // === 2. הלוגיקה המקורית (שוחזרה מה-ELSE החסר) ===
    const now = Date.now();
    const pitDuration = now - window.state.pitStart;
    const driveDuration = window.state.pitStart - window.state.stintStart;

    // עצירת טיימר הפיטס וסגירת המודאל
    if (window.pitInterval) clearInterval(window.pitInterval);
    const pitModal = document.getElementById('pitModal');
    if (pitModal) pitModal.classList.add('hidden');
    
    // שמירת נתונים ביומן של הנהג המסיים (זה שיוצא מהרכב)
    if (window.drivers[prevDriverIdx]) {
        const driver = window.drivers[prevDriverIdx];
        if (!driver.logs) driver.logs = [];
        
        driver.totalTime = (driver.totalTime || 0) + driveDuration;
        
        driver.logs.push({
            drive: driveDuration,
            pit: pitDuration,
            timestamp: now
        });
        driver.stints = (driver.stints || 0) + 1;
    }

    // ביצוע החלפת הנהג בפועל (בזיכרון)
    window.state.currentDriverIdx = window.state.nextDriverIdx;
    
    // קידום הנהג *הבא* בתור (הכנה לסטינט הבא)
    if (typeof window.cycleNextDriver === 'function') window.cycleNextDriver();

    // איפוס מצב מירוץ ליציאה למסלול
    window.state.isInPit = false;
    window.state.stintStart = now;
    window.state.stintOffset = 0;
    window.state.globalStintNumber++;
    
    // איפוס התאמות זמן פיטס (אם היו)
    if (typeof window.adjustPitTime === 'function') {
        window.adjustPitTime(-window.currentPitAdjustment); 
    }

    // === 3. לוגיקה חדשה: בדיקת דאבל סטינט ועדכון חוליות ===
    const newDriverIdx = window.state.currentDriverIdx;

    if (newDriverIdx === prevDriverIdx) {
        // אם הנהג נשאר אותו דבר -> דאבל סטינט
        window.state.consecutiveStints = (window.state.consecutiveStints || 1) + 1;
        console.log(`🔄 Double Stint! Count: ${window.state.consecutiveStints}`);
    } else {
        // נהג התחלף -> איפוס מונה
        window.state.consecutiveStints = 1; 
        
        // עדכון חוליה פעילה (אם עובדים עם חוליות)
        if (window.config.useSquads && window.drivers[newDriverIdx]) {
            // אם אנחנו לא במצב לילה "נעול" ידנית, עדכן את החוליה לפי הנהג החדש
            if (!window.state.isNightMode) {
                window.state.activeSquad = window.drivers[newDriverIdx].squad;
            }
        }
    }

    // 4. שמירה ועדכון תצוגה
    if (typeof window.saveRaceState === 'function') window.saveRaceState();
    if (typeof window.broadcast === 'function') window.broadcast();
    if (typeof window.renderFrame === 'function') window.renderFrame();
};

// ודא שקוראים לעדכון ה-UI בטעינה
document.addEventListener('DOMContentLoaded', () => {
    updateNightModeUI();
});

// ==========================================
// 🛠️ HELPERS & PERSISTENCE
// ==========================================

window.formatTimeHMS = function(ms) {
    if (ms < 0) ms = 0;
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

window.saveHostState = function() {
    if (window.role === 'host') {
        window.savedHostConfig = {
            config: window.config,
            drivers: window.drivers,
            state: window.state
        };
    }
};

function attachConfigListeners() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(el => {
        el.addEventListener('change', window.saveHostState);
    });
}

// ==========================================
// 💾 SAVED RACE LOGIC
// ==========================================

window.saveRaceState = function() {
    if (window.role !== 'host' || !window.state.isRunning) return;
    const snapshot = {
        config: window.config,
        state: window.state,
        drivers: window.drivers,
        timestamp: Date.now()
    };
    localStorage.setItem(window.RACE_STATE_KEY, JSON.stringify(snapshot));
};

window.checkForSavedRace = function() {
    const savedData = localStorage.getItem(window.RACE_STATE_KEY);
    if (!savedData) return;

    try {
        const data = JSON.parse(savedData);
        if (Date.now() - new Date(data.timestamp).getTime() > 24 * 60 * 60 * 1000) {
            localStorage.removeItem(window.RACE_STATE_KEY);
            return;
        }

        document.getElementById('setupScreen').classList.add('hidden');
        const modal = document.getElementById('savedRaceModal');
        if (modal) {
            modal.classList.remove('hidden');
            const currentIdx = data.state.currentDriverIdx || 0;
            const driverName = data.drivers[currentIdx] ? data.drivers[currentIdx].name : 'Unknown';
            const driverEl = document.getElementById('savedRaceDriver');
            if(driverEl) driverEl.innerText = driverName;
            
            const raceMs = data.config.raceMs || (data.config.duration * 3600000);
            const elapsed = Date.now() - data.state.startTime;
            const remaining = Math.max(0, raceMs - elapsed);
            
            const timeEl = document.getElementById('savedRaceTime');
            if (timeEl) timeEl.innerText = window.formatTimeHMS(remaining);
        }
    } catch (e) {
        console.error("Error parsing saved race:", e);
        localStorage.removeItem(window.RACE_STATE_KEY);
        document.getElementById('setupScreen').classList.remove('hidden');
    }
};

window.continueRace = function() {
    const savedData = localStorage.getItem(window.RACE_STATE_KEY);
    if (!savedData) return window.finalDiscardRace();

    try {
        const data = JSON.parse(savedData);
        
        window.state = data.state;
        window.config = data.config;
        window.drivers = data.drivers;
        window.cachedStrategy = data.strategy;

        document.getElementById('savedRaceModal').classList.add('hidden');
        document.getElementById('raceDashboard').classList.remove('hidden');

        window.state.isRunning = true;
        
        if (window.raceInterval) clearInterval(window.raceInterval);
        window.raceInterval = setInterval(() => {
            if (typeof window.tick === 'function') window.tick();
            if (typeof window.broadcast === 'function') window.broadcast();
            if (typeof window.renderFrame === 'function') window.renderFrame();
        }, 1000);

        setInterval(window.saveRaceState, 10000);
        
        if (typeof window.renderFrame === 'function') window.renderFrame();
        if (typeof window.updateDriversList === 'function') window.updateDriversList();

        console.log("✅ Race Resumed!");

    } catch (e) {
        alert("Failed to resume race: " + e.message);
        window.finalDiscardRace();
    }
};

window.confirmDiscardRace = function() {
    document.getElementById('savedRaceModal').classList.add('hidden');
    document.getElementById('confirmDiscardModal').classList.remove('hidden');
};

window.cancelDiscard = function() {
    document.getElementById('confirmDiscardModal').classList.add('hidden');
    document.getElementById('savedRaceModal').classList.remove('hidden');
};

window.finalDiscardRace = function() {
    localStorage.removeItem(window.RACE_STATE_KEY);
    document.getElementById('confirmDiscardModal').classList.add('hidden');
    document.getElementById('savedRaceModal').classList.add('hidden');
    document.getElementById('setupScreen').classList.remove('hidden');
};