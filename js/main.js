// ==========================================
// 🚀 MAIN ENTRY POINT & RACE LOOP
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Strateger Initializing...");

    // 1. טעינת שפה
    const savedLang = localStorage.getItem('strateger_lang') || 'en';
    if (typeof window.setLanguage === 'function') {
        window.setLanguage(savedLang);
    }

    // 2. אתחול נהגים ראשוני (ברירת מחדל)
    if (typeof window.addDriverField === 'function') {
        window.addDriverField();
        window.addDriverField();
    }
    
    // 3. בדיקת קישור הזמנה (Client Mode)
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');

    if (joinCode) {
        console.log("🔗 Joining race:", joinCode);
        window.role = 'client'; // קובעים תפקיד
        
        // הסתרת מסכי ניהול
        const setup = document.getElementById('setupScreen');
        if(setup) setup.classList.add('hidden');
        
        // הצגת מסך המתנה
        const wait = document.getElementById('clientWaitScreen');
        if(wait) wait.classList.remove('hidden');
        
        // התחברות אוטומטית
        if (typeof window.connectToHost === 'function') {
            window.connectToHost(joinCode);
        }
    } else {
        // אין קוד - זה המארח (Host)
        window.role = 'host';
        
        // הצגת כפתורי ניהול
        const hostSec = document.getElementById('setupScreen');
        if(hostSec) hostSec.classList.remove('hidden');
        
        // אתחול PeerJS להוסט
        if (typeof window.initHostPeer === 'function') {
            window.initHostPeer();
        }

        // שחזור הגדרות אחרונות
        if (typeof window.restoreHostState === 'function') {
            window.restoreHostState();
        }
        
        // הפעלת חישוב ראשוני
        setTimeout(() => {
            if (typeof window.runSim === 'function') window.runSim();
        }, 500);

        // בדיקת שחזור מירוץ שנקטע
        setTimeout(checkForSavedRace, 500);
    }

    // 4. אתחול מאזינים לשינויים
    attachConfigListeners();
});

// ==========================================
// ⏱️ RACE LOOP
// ==========================================

window.tick = function() {
    if (!window.state || !window.state.isRunning) return;

    // רינדור הדשבורד
    window.renderFrame();

    // עדכון סטטיסטיקות בזמן אמת (אם לא בפיטס)
    if (!window.state.isInPit) {
        const stintTime = Date.now() - window.state.stintStart + window.state.stintOffset;
        if (typeof window.updateStats === 'function') {
            window.updateStats(stintTime);
        }
    }

    // מצב דמו (אם פעיל)
    if (window.liveTimingConfig && window.liveTimingConfig.demoMode && typeof window.updateDemoData === 'function') {
        window.updateDemoData();
    }
};

// ==========================================
// 🎮 DASHBOARD CONTROLS (Weather & Mode)
// ==========================================

window.toggleRain = function() {
    if (window.role !== 'host') return;
    
    const conditions = ['dry', 'wet', 'drying'];
    const current = window.state.trackCondition || 'dry';
    const next = conditions[(conditions.indexOf(current) + 1) % conditions.length];
    
    window.state.trackCondition = next;
    window.state.isRain = (next !== 'dry');
    
    if (typeof window.broadcast === 'function') window.broadcast();
    window.renderFrame();
};

window.setMode = function(mode) {
    if (window.role !== 'host') return;

    // לוגיקת Toggle
    if (mode === 'push') {
        window.state.mode = (window.state.mode === 'push') ? 'normal' : 'push';
    } else if (mode === 'bad') {
        window.state.mode = (window.state.mode === 'bad') ? 'normal' : 'bad';
    } else {
        window.state.mode = 'normal'; // Reset
    }

    // חישוב יעד חדש מיד בעת שינוי מצב
    if (typeof window.recalculateTargetStint === 'function') {
        window.recalculateTargetStint();
    }
    
    if (typeof window.broadcast === 'function') window.broadcast();
    window.renderFrame();
};

window.adjustStint = function(ms) {
    if (window.role !== 'host') return;
    window.state.stintOffset += ms;
    window.renderFrame();
    if (typeof window.broadcast === 'function') window.broadcast();
};

window.cycleNextDriver = function() {
    if (window.role !== 'host' || !window.drivers.length) return;

    let nextIdx = window.state.nextDriverIdx;
    let attempts = 0;
    
    do {
        nextIdx = (nextIdx + 1) % window.drivers.length;
        attempts++;
        if (attempts > window.drivers.length) break;
        
        // אם חוליות פעילות, דלג על מי שלא בחוליה
        if (window.config.useSquads && window.state.squadsActive) {
            if (window.drivers[nextIdx].squad !== window.state.activeSquad) continue;
        }
        
        // דלג על הנהג הנוכחי
        if (nextIdx === window.state.currentDriverIdx) continue;
        
        break;
    } while (true);

    window.state.nextDriverIdx = nextIdx;
    
    if (typeof window.broadcast === 'function') window.broadcast();
    window.renderFrame();
};

// ==========================================
// 🛑 PIT STOP LOGIC (With Penalties & Min Stint)
// ==========================================

// משתנה עזר גלובלי
window.currentPitAdjustment = 0;

// שינוי עונש/זמן (עובד גם לפני הכניסה לפיטס וגם תוך כדי)
window.adjustPitTime = function(seconds) {
    window.currentPitAdjustment += seconds;
    
    // 1. עדכון התצוגה בדשבורד (למטה)
    const dashDisplay = document.getElementById('dashboardPitAdjDisplay');
    const btnBadge = document.getElementById('btnPitAdjBadge');
    
    if (dashDisplay) {
        const sign = window.currentPitAdjustment >= 0 ? '+' : '';
        dashDisplay.innerText = `${sign}${window.currentPitAdjustment}s`;
        dashDisplay.className = `bg-navy-950 px-2 py-1 rounded font-mono font-bold text-sm min-w-[40px] text-center border border-gray-600 ${
            window.currentPitAdjustment > 0 ? 'text-red-400' : (window.currentPitAdjustment < 0 ? 'text-green-400' : 'text-ice')
        }`;
    }

    // אינדיקטור על הכפתור הגדול
    if (btnBadge) {
        if (window.currentPitAdjustment !== 0) {
            const sign = window.currentPitAdjustment > 0 ? '+' : '';
            btnBadge.innerText = `${sign}${window.currentPitAdjustment}s`;
            btnBadge.classList.remove('hidden');
        } else {
            btnBadge.classList.add('hidden');
        }
    }
    
    // 2. אם המודאל כבר פתוח, נעדכן גם את הלוגיקה שלו בזמן אמת
    if (window.state.isInPit) {
        window.updatePitModalLogic();
        // עדכון תצוגת אינפו במודאל
        const modalVal = document.getElementById('modalPitAdjValue');
        if (modalVal) modalVal.innerText = `${window.currentPitAdjustment > 0 ? '+' : ''}${window.currentPitAdjustment}s`;
    }
};

window.confirmPitEntry = function() {
    // 1. בדיקת מינימום סטינט
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

    // 2. פתיחת פיטס
    window.state.isInPit = true;
    window.state.pitStart = now;
    window.state.pitCount++;
    // שים לב: אנחנו לא מאפסים את window.currentPitAdjustment כאן! 
    // אנחנו משתמשים במה שהוגדר בדשבורד.

    const modal = document.getElementById('pitModal');
    const warningEl = document.getElementById('pitStintWarning');
    const modalAdjInfo = document.getElementById('modalPitAdjInfo');
    const modalAdjVal = document.getElementById('modalPitAdjValue');

    if (modal) {
        modal.classList.remove('hidden');
        
        // אזהרת סטינט קצר
        if (warningEl) warningEl.classList.toggle('hidden', !isShortStint);

        // הצגת העונש שהוכן מראש
        if (modalAdjInfo && modalAdjVal) {
            if (window.currentPitAdjustment !== 0) {
                modalAdjInfo.classList.remove('hidden');
                modalAdjVal.innerText = `${window.currentPitAdjustment > 0 ? '+' : ''}${window.currentPitAdjustment}s`;
            } else {
                modalAdjInfo.classList.add('hidden');
            }
        }
        
        // איפוס כפתור יציאה
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

window.confirmPitExit = function() {
    const now = Date.now();
    
    // 1. חישוב זמנים מדויק ללוגים
    // זמן הפיט: מעכשיו (יציאה) פחות זמן הכניסה
    const pitDuration = now - window.state.pitStart;
    
    // זמן הנהיגה נטו: מרגע תחילת הסטינט ועד רגע הכניסה לפיט (לא כולל הפיט עצמו!)
    // אנחנו משתמשים ב-pitStart כנקודת הסיום של הנהיגה
    const driveDuration = window.state.pitStart - window.state.stintStart;

    if (window.pitInterval) clearInterval(window.pitInterval);
    document.getElementById('pitModal').classList.add('hidden');
    
    // 2. שמירת הנתונים לנהג היוצא
    const driverIdx = window.state.currentDriverIdx;
    if (window.drivers[driverIdx]) {
        const driver = window.drivers[driverIdx];
        
        // אתחול מערך לוגים אם חסר
        if (!driver.logs) driver.logs = [];
        
        // עדכון הטוטאל - מוסיפים רק את זמן הנהיגה נטו!
        driver.totalTime = (driver.totalTime || 0) + driveDuration;
        
        // הוספת רשומה ללוג: כמה נהג, וכמה זמן עשה פיט מיד אחרי
        driver.logs.push({
            drive: driveDuration,
            pit: pitDuration,
            timestamp: now
        });
        
        // עדכון מספר הסטינטים שלו
        driver.stints = (driver.stints || 0) + 1;
    }

    // 3. החלפת נהג
    window.state.currentDriverIdx = window.state.nextDriverIdx;
    if (typeof window.cycleNextDriver === 'function') window.cycleNextDriver();

    // 4. איפוסים לסטינט החדש
    window.state.isInPit = false;
    window.state.stintStart = now; // הסטינט החדש מתחיל עכשיו (ביציאה מהפיט)
    window.state.stintOffset = 0;
    window.state.globalStintNumber++;
    
    // איפוס עונשים שהוחלו
    window.adjustPitTime(-window.currentPitAdjustment);

    // 5. שמירה ועדכון
    if (typeof window.saveRaceState === 'function') window.saveRaceState();
    if (typeof window.broadcast === 'function') window.broadcast();
    window.renderFrame();
};

window.updatePitModalLogic = function() {
    const now = Date.now();
    const elapsedSec = (now - window.state.pitStart) / 1000;
    
    // חישוב זמן היעד: זמן פיט בסיסי + ההתאמות (עונשים/זיכויים)
    const basePitTime = parseInt(window.config.minPitTime || window.config.pitTime) || 0;
    const totalRequiredTime = Math.max(0, basePitTime + window.currentPitAdjustment); // לא יורד מ-0
    
    const buffer = parseInt(document.getElementById('releaseBuffer')?.value) || 5;
    
    // זמן נותר משוקלל
    const timeRemaining = totalRequiredTime - elapsedSec;

    // עדכון שעון
    const timerDisplay = document.getElementById('pitTimerDisplay');
    if (timerDisplay) {
        // מציגים מספרים חיוביים (ספירה לאחור) או 0.0 אם נגמר
        const displayTime = Math.max(0, timeRemaining);
        timerDisplay.innerText = displayTime.toFixed(1);
    }

    const releaseBtn = document.getElementById('confirmExitBtn');
    if (!releaseBtn) return;

    // --- לוגיקת צבעים וכפתור ---
    if (timeRemaining > buffer) {
        // שלב המתנה
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-red-500";
        releaseBtn.innerText = "WAIT";
        releaseBtn.disabled = true;
        releaseBtn.className = "w-full max-w-xs bg-gray-800 text-gray-500 font-bold py-4 rounded-lg text-2xl border border-gray-700 cursor-not-allowed";
    } 
    else if (timeRemaining <= buffer && timeRemaining > 0) {
        // שלב התראה (Buffer)
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-yellow-400 animate-pulse";
        releaseBtn.innerText = "GET READY";
        releaseBtn.disabled = false;
        releaseBtn.className = "w-full max-w-xs bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-4 rounded-lg text-2xl border border-yellow-400 animate-pulse cursor-pointer";
    } 
    else {
        // שחרור
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-green-500";
        releaseBtn.innerText = "GO! GO! GO!";
        releaseBtn.disabled = false;
        releaseBtn.className = "w-full max-w-xs bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg text-3xl border border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)] cursor-pointer";
    }
};

// 4. ביטול כניסה (למקרה של לחיצה בטעות)
window.cancelPitStop = function() {
    if (window.pitInterval) clearInterval(window.pitInterval);
    document.getElementById('pitModal').classList.add('hidden');
    
    window.state.isInPit = false;
    window.state.pitCount--; // ביטול הספירה
    
    if (typeof window.broadcast === 'function') window.broadcast();
    window.renderFrame();
};

// ==========================================
// ⏱️ RENDER FRAME (Fixing NaN & Undefined)
// ==========================================

window.renderFrame = function() {
    if (!window.state || !window.state.isRunning) return;
    
    // בדיקת תרגום דינמית - מוודא שהתרגומים בדשבורד מתעדכנים
    // אם השפה השתנתה מאז הרינדור האחרון, נפעיל תרגום מחדש
    const currentLang = localStorage.getItem('strateger_lang') || 'en';
    if (document.documentElement.lang !== currentLang) {
        if (typeof window.setLanguage === 'function') window.setLanguage(currentLang);
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
            return;
        }
        timerEl.innerText = window.formatTimeHMS(raceRemaining);

        // 2. נהגים
        const curr = window.drivers[window.state.currentDriverIdx];
        const next = window.drivers[window.state.nextDriverIdx];
        if (curr) document.getElementById('currentDriverName').innerText = curr.name;
        if (next) {
            const nextEls = [document.getElementById('nextDriverName'), document.getElementById('modalNextDriverName')];
            nextEls.forEach(el => { if(el) el.innerText = next.name; });
        }

        // 3. עדכון טבלת סטטיסטיקה (חשוב ללוגים)
        if (typeof window.updateStats === 'function') {
            // חישוב זמן סטינט נוכחי לתצוגה בטבלה
            let currentStintTime = 0;
            if (!window.state.isInPit) {
                currentStintTime = (now - window.state.stintStart) + (window.state.stintOffset || 0);
            }
            window.updateStats(currentStintTime);
        }

        // 4. Progress Bar ו-Stint Timer
        if (!window.state.isInPit) {
            let currentStintTime = (now - window.state.stintStart) + (window.state.stintOffset || 0);
            document.getElementById('stintTimerDisplay').innerText = window.formatTimeHMS(Math.max(0, currentStintTime));
            
            const maxStintMs = (window.config.maxStintMs) || (window.config.maxStint * 60000) || (60 * 60000);
            const currentPct = Math.min(100, (currentStintTime / maxStintMs) * 100);
            const bar = document.getElementById('stintProgressBar');
            if (bar) bar.style.width = `${currentPct}%`;
        }

        // 5. Target Stint & Delta
        const targetEl = document.getElementById('strategyTargetStint');
        const deltaEl = document.getElementById('strategyDelta');
        let targetMs = window.state.targetStintMs || (window.config.maxStint * 60000);
        
        if (targetEl) targetEl.innerText = window.formatTimeHMS(targetMs);
        if (deltaEl && !window.state.isInPit) {
            let currentStintTime = (now - window.state.stintStart) + (window.state.stintOffset || 0);
            const diff = targetMs - currentStintTime;
            const sign = diff >= 0 ? '-' : '+';
            deltaEl.innerText = `${sign}${window.formatTimeHMS(Math.abs(diff))}`;
            deltaEl.className = diff >= 0 ? "text-sm font-bold text-gray-400" : "text-sm font-bold text-red-500 animate-pulse";
        }

        updateWeatherUI();

    } catch (e) {
        console.error("Render Frame Error:", e);
    }
};

function updateWeatherUI() {
    const rIcon = document.getElementById('rainIcon');
    const rText = document.getElementById('rainText');
    const stratBox = document.getElementById('strategyBox');
    
    if (!rIcon || !rText) return;

    if (window.state.trackCondition === 'wet') {
        rIcon.innerText = "☁️";
        rText.innerText = "Wet";
        rText.className = "text-xs font-bold text-ice";
        if(stratBox) stratBox.className = "p-3 text-center border-b-2 shrink-0 bg-blue-900/90 border-ice rounded-lg";
    } else if (window.state.trackCondition === 'drying') {
        rIcon.innerText = "🌤️";
        rText.innerText = "Drying";
        rText.className = "text-xs font-bold text-yellow-400";
        if(stratBox) stratBox.className = "p-3 text-center border-b-2 shrink-0 bg-yellow-900/50 border-yellow-500 rounded-lg";
    } else {
        rIcon.innerText = "☀️";
        rText.innerText = "Dry";
        rText.className = "text-xs font-bold text-yellow-400";
        if(stratBox) stratBox.className = "p-3 text-center bg-navy-900 border-b-2 border-neon shrink-0 rounded-lg";
    }
}

window.formatTimeHMS = function(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
};

// ==========================================
// 💾 PERSISTENCE
// ==========================================

window.saveHostState = function() {
    if (window.role !== 'host') return;
    
    // שמירת כל האינפוטים הקריטיים
    const uiConfig = {
        raceDuration: document.getElementById('raceDuration')?.value,
        reqPitStops: document.getElementById('reqPitStops')?.value,
        minStint: document.getElementById('minStint')?.value,
        maxStint: document.getElementById('maxStint')?.value,
        minPitTime: document.getElementById('minPitTime')?.value,
        // (ניתן להוסיף עוד שדות לפי הצורך)
        timestamp: Date.now()
    };
    localStorage.setItem('strateger_host_config', JSON.stringify(uiConfig));
};

window.restoreHostState = function() {
    try {
        const saved = localStorage.getItem('strateger_host_config');
        if (!saved) return;
        const cfg = JSON.parse(saved);
        
        if (cfg.raceDuration) document.getElementById('raceDuration').value = cfg.raceDuration;
        if (cfg.reqPitStops) document.getElementById('reqPitStops').value = cfg.reqPitStops;
        if (cfg.minStint) document.getElementById('minStint').value = cfg.minStint;
        if (cfg.maxStint) document.getElementById('maxStint').value = cfg.maxStint;
        if (cfg.minPitTime) document.getElementById('minPitTime').value = cfg.minPitTime;
        
        // עדכון חישוב
        if (typeof window.runSim === 'function') window.runSim();
    } catch (e) {
        console.error(e);
    }
};

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

function checkForSavedRace() {
    const saved = localStorage.getItem(window.RACE_STATE_KEY);
    if (!saved) return;
    
    const data = JSON.parse(saved);
    if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(window.RACE_STATE_KEY);
        return;
    }
    
    // הצגת מודאל שחזור
    const modal = document.getElementById('savedRaceModal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // עדכון שם הנהג
        const driverName = data.drivers[data.state.currentDriverIdx] ? data.drivers[data.state.currentDriverIdx].name : 'Unknown';
        document.getElementById('savedRaceDriver').innerText = driverName;
        
        // עדכון זמן נותר (פורמט יפה)
        const now = Date.now();
        const elapsed = now - data.state.startTime;
        const total = data.config.raceMs || (data.config.duration * 3600000);
        const remaining = Math.max(0, total - elapsed);
        
        // שים לב ל-ID הזה ב-HTML שלך
        const timeEl = document.getElementById('savedRaceTime'); 
        if (timeEl) timeEl.innerText = window.formatTimeHMS(remaining);
        
        window.savedRaceSnapshot = data;
    }
}

window.continueRace = function() {
    if (window.savedRaceSnapshot) {
        window.restoreRaceState(window.savedRaceSnapshot);
        const modal = document.getElementById('savedRaceModal');
        if(modal) modal.classList.add('hidden');
    }
};

window.// ==========================================
// 💾 SAVED RACE LOGIC (With Hide Setup)
// ==========================================

window.checkForSavedRace = function() {
    const savedData = localStorage.getItem(window.RACE_STATE_KEY);
    if (!savedData) return;

    try {
        const data = JSON.parse(savedData);
        // בדיקת תוקף (24 שעות)
        if (Date.now() - new Date(data.timestamp).getTime() > 24 * 60 * 60 * 1000) {
            localStorage.removeItem(window.RACE_STATE_KEY);
            return;
        }

        // === הסתרת מסך ההגדרות (הבקשה שלך) ===
        document.getElementById('setupScreen').classList.add('hidden');

        // הצגת המודאל
        const modal = document.getElementById('savedRaceModal');
        if (modal) {
            modal.classList.remove('hidden');
            
            // עדכון פרטים במודאל
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
        // במקרה של שגיאה, מחזירים את המסך
        document.getElementById('setupScreen').classList.remove('hidden');
    }
};

window.continueRace = function() {
    const savedData = localStorage.getItem(window.RACE_STATE_KEY);
    if (!savedData) return window.finalDiscardRace();

    try {
        const data = JSON.parse(savedData);
        
        // שחזור הנתונים
        window.state = data.state;
        window.config = data.config;
        window.drivers = data.drivers;
        window.cachedStrategy = data.strategy; // אם שמרת גם את זה

        // סגירת מודאל
        document.getElementById('savedRaceModal').classList.add('hidden');
        
        // (setupScreen כבר מוסתר מהשלב הקודם)
        document.getElementById('raceDashboard').classList.remove('hidden');

        // אתחול מחדש של המערכת
        window.state.isRunning = true;
        
        // הפעלת טיימרים
        if (window.raceInterval) clearInterval(window.raceInterval);
        window.raceInterval = setInterval(() => {
            if (typeof window.tick === 'function') window.tick();
            if (typeof window.broadcast === 'function') window.broadcast();
            if (typeof window.renderFrame === 'function') window.renderFrame();
        }, 1000);

        setInterval(window.saveRaceState, 10000);
        
        // רינדור ראשוני
        if (typeof window.renderFrame === 'function') window.renderFrame();
        if (typeof window.updateDriversList === 'function') window.updateDriversList(); // אם יש פונקציה כזו

        console.log("✅ Race Resumed!");

    } catch (e) {
        alert("Failed to resume race: " + e.message);
        window.finalDiscardRace();
    }
};

window.confirmDiscardRace = function() {
    // מעבר למודאל אישור מחיקה (setupScreen עדיין מוסתר)
    document.getElementById('savedRaceModal').classList.add('hidden');
    document.getElementById('confirmDiscardModal').classList.remove('hidden');
};

window.cancelDiscard = function() {
    // חזרה למודאל הראשי (setupScreen עדיין מוסתר)
    document.getElementById('confirmDiscardModal').classList.add('hidden');
    document.getElementById('savedRaceModal').classList.remove('hidden');
};

window.finalDiscardRace = function() {
    localStorage.removeItem(window.RACE_STATE_KEY);
    
    // סגירת כל המודאלים
    document.getElementById('confirmDiscardModal').classList.add('hidden');
    document.getElementById('savedRaceModal').classList.add('hidden');
    
    // === החזרת מסך ההגדרות (כי המשתמש בחר לא להמשיך) ===
    document.getElementById('setupScreen').classList.remove('hidden');
};

// ==========================================
// 🎬 HOST STARTUP
// ==========================================

window.startHostUI = function() {
    if (typeof window.initHostPeer === 'function') window.initHostPeer();
    
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(()=>{});

    if (window.raceInterval) clearInterval(window.raceInterval);
    
    window.raceInterval = setInterval(() => {
        window.tick();
        if (typeof window.broadcast === 'function') window.broadcast();
    }, 1000);

    setInterval(window.saveRaceState, 10000);
    window.tick();
};

function attachConfigListeners() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(el => {
        el.addEventListener('change', window.saveHostState);
    });
}

// פונקציית עזר לחישוב יעד סטינט בזמן אמת (עבור setMode)
window.recalculateTargetStint = function() {
    if (!window.config || !window.state) return;
    
    if (window.state.mode === 'push') {
        // ב-Push מכוונים למקסימום פחות דקה ביטחון
        window.state.targetStintMs = (window.config.maxStintMs || 65 * 60000) - 60000;
    } else if (window.state.mode === 'bad') {
        // ב-Bad מכוונים למינימום
        window.state.targetStintMs = window.config.minStintMs || 30 * 60000;
    } else {
        // במצב רגיל חוזרים ליעד המקורי מהאסטרטגיה
        const currentStintIdx = window.state.globalStintNumber - 1;
        if (window.state.stintTargets && window.state.stintTargets[currentStintIdx]) {
            window.state.targetStintMs = window.state.stintTargets[currentStintIdx];
        }
    }
};