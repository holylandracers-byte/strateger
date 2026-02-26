// ==========================================
// 🚀 MAIN ENTRY POINT & RACE LOOP
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Strateger Initializing...");
    window._autoStartFired = false;

    // 🟢 Load viewer's own language preference if available
    let savedLang = window.role === 'viewer' 
        ? localStorage.getItem('strateger_viewer_lang') || localStorage.getItem('strateger_lang')
        : localStorage.getItem('strateger_lang');
    
    if (!savedLang) {
        const browserLang = navigator.language.split('-')[0];
        savedLang = (['he', 'fr', 'pt'].includes(browserLang)) ? browserLang : 'en';
    }
    if (typeof window.setLanguage === 'function') window.setLanguage(savedLang);

    // Restore saved page background
    const savedBg = localStorage.getItem('strateger_bg');
    if (savedBg !== null) {
        if (typeof window.setPageBackground === 'function') window.setPageBackground(savedBg);
        else document.body.style.background = savedBg || '';
    }

    if (typeof window.addDriverField === 'function') {
        window.addDriverField();
        window.addDriverField();
    }

    // Calculate initial strategy from default params
    if (typeof window.runSim === 'function') {
        window.runSim();
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const joinCode = urlParams.get('join');
    const driverCode = urlParams.get('driver');

    if (driverCode) {
        // Driver link — show ID entry screen for verification
        window.role = 'client';
        window._autoDriverMode = true;
        window._driverModeOpened = false;
        window._pendingDriverCode = driverCode;
        document.getElementById('setupScreen').classList.add('hidden');
        document.getElementById('driverEntryScreen').classList.remove('hidden');
        // Pre-fill the ID field
        const idInput = document.getElementById('driverIdInput');
        if (idInput) idInput.value = driverCode;
    } else if (joinCode) {
        window.role = 'client';
        window._pendingJoinCode = joinCode;
        document.getElementById('setupScreen').classList.add('hidden');
        // Check if we already have an approved name stored (reconnecting)
        const savedViewerName = localStorage.getItem('strateger_viewer_name');
        if (savedViewerName) {
            // Reconnect automatically with saved name
            window.pendingChatName = savedViewerName;
            document.getElementById('clientWaitScreen').classList.remove('hidden');
            if (typeof window.connectToHost === 'function') window.connectToHost(joinCode);
        } else {
            // Show viewer name entry screen
            document.getElementById('viewerNameScreen').classList.remove('hidden');
            // Pre-fill with Google name if available
            const googleUser = window.googleUser || JSON.parse(localStorage.getItem('strateger_google_user') || 'null');
            if (googleUser && googleUser.name) {
                const nameInput = document.getElementById('viewerNameInput');
                if (nameInput) nameInput.value = googleUser.name;
            }
        }
    } else {
        window.role = 'host';
        if (typeof window.checkForSavedRace === 'function') window.checkForSavedRace();
    }
    
    if(typeof updateModeUI === 'function') updateModeUI();
    if(typeof updateWeatherUI === 'function') updateWeatherUI();
    if(typeof attachConfigListeners === 'function') attachConfigListeners();
    
    // Initialize night mode button visibility
    const numSquadsInit = parseInt(document.getElementById('numSquads')?.value) || 0;
    if (numSquadsInit === 0) {
        const btnNightMode = document.getElementById('btnNightMode');
        if (btnNightMode) btnNightMode.classList.add('hidden');
    }

    // Start race countdown monitor
    window.startRaceCountdown();

    // Initialize Pro UI (show/hide lock icons, banner)
    if (typeof window.updateProUI === 'function') window.updateProUI();
    
    // Initialize mute button icon
    const muteBtn = document.getElementById('muteToggleBtn');
    if (muteBtn && window._soundMuted) {
        muteBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        muteBtn.title = 'Unmute';
    }

    // Start onboarding for first-time visitors (host only, no join code)
    if (window.role === 'host' && typeof window.startOnboarding === 'function') {
        setTimeout(() => window.startOnboarding(), 800);
    }
});

// ==========================================
// 👀 VIEWER NAME ENTRY
// ==========================================

window.submitViewerName = function() {
    const t = window.t || (k => k);
    const nameInput = document.getElementById('viewerNameInput');
    const errorEl = document.getElementById('viewerNameError');
    const waitingMsg = document.getElementById('viewerWaitingMsg');
    const name = (nameInput?.value || '').trim();
    
    if (!name || name.length < 2) {
        if (errorEl) {
            errorEl.classList.remove('hidden');
            errorEl.innerText = t('viewerNameTooShort');
        }
        return;
    }
    
    // Store name for approval flow
    window.pendingChatName = name;
    localStorage.setItem('strateger_viewer_name', name);
    
    // Hide input area, show waiting message
    if (nameInput) nameInput.disabled = true;
    const submitBtn = nameInput?.parentElement?.nextElementSibling;
    if (submitBtn?.tagName === 'BUTTON') submitBtn.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');
    if (waitingMsg) waitingMsg.classList.remove('hidden');
    
    // Now connect to host
    const joinCode = window._pendingJoinCode;
    if (joinCode && typeof window.connectToHost === 'function') {
        window.connectToHost(joinCode);
    }
};

// ==========================================
// ⏰ RACE COUNTDOWN & AUTO-START
// ==========================================

window._countdownInterval = null;
window._notifiedMinutes = new Set(); // track which alerts we've sent

window.getRaceStartDate = function() {
    const timeEl = document.getElementById('raceStartTime');
    const dateEl = document.getElementById('raceStartDate');
    if (!timeEl || !timeEl.value || !dateEl || !dateEl.value) return null;
    const [y, mo, d] = dateEl.value.split('-').map(Number);
    const [h, m] = timeEl.value.split(':').map(Number);
    const dt = new Date(y, mo - 1, d, h, m, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
};

window.isAdminLoggedIn = function() {
    // Host role + Google signed in
    if (window.role !== 'host') return false;
    const saved = localStorage.getItem('strateger_google_user');
    return !!(saved || (typeof googleUser !== 'undefined' && googleUser));
};

window.startRaceCountdown = function() {
    if (window._countdownInterval) clearInterval(window._countdownInterval);
    window._notifiedMinutes.clear();
    window._countdownInterval = setInterval(window.updateRaceCountdown, 1000);
};

window.updateRaceCountdown = function() {
    const banner = document.getElementById('raceCountdownBanner');
    const textEl = document.getElementById('raceCountdownText');
    if (!banner || !textEl) return;

    // Don't show during active race
    if (window.state && window.state.isRunning) {
        banner.classList.add('hidden');
        return;
    }

    const raceStart = window.getRaceStartDate();
    if (!raceStart) {
        banner.classList.add('hidden');
        return;
    }

    const now = new Date();
    const diffMs = raceStart.getTime() - now.getTime();
    const t = window.t || (k => k);

    // Race already passed
    if (diffMs < -60000) {
        banner.classList.add('hidden');
        return;
    }

    // Show banner
    banner.classList.remove('hidden');

    if (diffMs <= 0) {
        // Time to start!
        textEl.innerHTML = `<span class="animate-pulse">🏁 ${t('countdownGo')}</span>`;
        banner.className = banner.className.replace(/from-[\w-]+\/\d+ to-[\w-]+\/\d+/g, '').replace(/border-[\w-]+\/\d+/g, '');
        banner.classList.add('border-green-500/80');
        banner.style.background = 'linear-gradient(90deg, rgba(34,197,94,0.3), rgba(16,185,129,0.2))';

        // Auto-start if enabled
        const autoStartEl = document.getElementById('autoStartRace');
        if (autoStartEl && autoStartEl.checked && !window._autoStartFired) {
            window._autoStartFired = true;
            window.sendBrowserNotification('🏁 ' + t('autoStarting'));
            setTimeout(() => {
                if (!window.state.isRunning) window.initRace();
            }, 2000);
        }
        return;
    }

    // Countdown display
    const totalSec = Math.ceil(diffMs / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    let timeStr;
    if (hrs > 0) {
        timeStr = `${hrs}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    } else {
        timeStr = `${mins}:${String(secs).padStart(2,'0')}`;
    }

    textEl.innerHTML = `⏱️ ${t('countdownPrefix')} <span class="font-mono text-white">${timeStr}</span>`;

    // Color intensity based on proximity
    if (totalSec <= 60) {
        banner.style.background = 'linear-gradient(90deg, rgba(239,68,68,0.4), rgba(220,38,38,0.3))';
    } else if (totalSec <= 300) {
        banner.style.background = 'linear-gradient(90deg, rgba(245,158,11,0.3), rgba(217,119,6,0.2))';
    } else if (totalSec <= 1800) {
        banner.style.background = 'linear-gradient(90deg, rgba(34,211,238,0.2), rgba(6,182,212,0.1))';
    } else {
        banner.style.background = 'linear-gradient(90deg, rgba(100,116,139,0.2), rgba(71,85,105,0.1))';
    }

    // Browser notifications at key moments (only for logged-in admin)
    if (window.isAdminLoggedIn()) {
        const minutesLeft = Math.ceil(diffMs / 60000);
        const alerts = [30, 10, 5, 1];
        for (const a of alerts) {
            if (minutesLeft === a && !window._notifiedMinutes.has(a)) {
                window._notifiedMinutes.add(a);
                const msg = t('countdownAlert').replace('{min}', a);
                window.sendBrowserNotification(msg);
            }
        }
    }
};

window.sendBrowserNotification = function(message) {
    // Audio beep
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}

    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🏎️ Strateger', { body: message, icon: 'https://cdn-icons-png.flaticon.com/512/2418/2418779.png' });
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => {
            if (p === 'granted') {
                new Notification('🏎️ Strateger', { body: message });
            }
        });
    }
};

window.requestNotificationPermission = function() {
    if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
};

// ==========================================
// 🎮 DEMO RACE
// ==========================================

window.startDemoRace = function() {
    const t = window.t || (k => k);

    // === 1. RACE PARAMETERS — 30 min kart endurance demo ===
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

    setVal('raceDuration', '0.5');       // 30 minutes
    setVal('reqPitStops', '2');          // 2 mandatory pit stops
    setVal('minStint', '5');             // min stint 5 min
    setVal('maxStint', '15');            // max stint 15 min
    setVal('minPitTime', '60');          // 1 minute pit time
    setVal('pitClosedStart', '2');       // pit closed first 2 min
    setVal('pitClosedEnd', '2');         // pit closed last 2 min
    setVal('minDriverTime', '0');        // no min driver total
    setVal('maxDriverTime', '15');       // max 15 min per driver
    setVal('releaseBuffer', '5');        // 5 sec buffer alert
    setChecked('allowDouble', false);    // no double stints
    setChecked('trackFuel', false);      // fuel off for demo

    // Squad off for demo
    const squadsEl = document.getElementById('numSquads');
    if (squadsEl) { squadsEl.value = '0'; if (typeof window.toggleSquadsInput === 'function') window.toggleSquadsInput(); }

    // === 2. START TIME — now ===
    const now = new Date();
    setVal('raceStartTime', `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`);
    setVal('raceStartDate', now.toISOString().split('T')[0]);

    // === 3. DRIVERS — 3 demo drivers with colors ===
    const demoDrivers = [
        { name: 'Alex', color: '#22d3ee' },   // ice blue
        { name: 'Jordan', color: '#f59e0b' },  // amber
        { name: 'Sam', color: '#10b981' }       // green
    ];

    // Ensure we have the right number of driver rows
    const rows = document.querySelectorAll('.driver-row');
    if (rows.length < demoDrivers.length) {
        while (document.querySelectorAll('.driver-row').length < demoDrivers.length) {
            if (typeof window.addDriverField === 'function') window.addDriverField();
        }
    }
    // Remove excess rows
    while (document.querySelectorAll('.driver-row').length > demoDrivers.length) {
        if (typeof window.removeDriverField === 'function') window.removeDriverField();
    }

    // Fill driver names and colors
    document.querySelectorAll('.driver-row').forEach((row, i) => {
        const driver = demoDrivers[i];
        if (!driver) return;
        const nameInput = row.querySelector('input[type="text"]');
        if (nameInput) nameInput.value = driver.name;
        const colorInput = row.querySelector('input[type="color"]');
        if (colorInput) colorInput.value = driver.color;
    });

    // === 4. GENERATE & RUN ===
    // Generate strategy with all the configured parameters
    if (typeof window.runSim === 'function') window.runSim();

    // Activate demo live timing
    if (typeof window.startDemoMode === 'function') window.startDemoMode();

    // Start the race
    if (typeof window.initRace === 'function') window.initRace();

    // Show demo badge
    const badge = document.getElementById('demoBadge');
    if (badge) badge.classList.remove('hidden');
};

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
    const pitEntryBtn = document.getElementById('pitEntryBtn');
    const pitEntryBtnLabel = document.getElementById('pitEntryBtnLabel');
    const t = window.t || ((k) => k);

    const baseClass = "btn-press bg-navy-800 border rounded-lg text-sm text-gray-300 font-bold shadow-md transition flex flex-col items-center justify-center";

    // For viewers: show mode state visually but keep buttons disabled
    const isViewer = window.role === 'client';
    const viewerExtra = isViewer ? ' opacity-60 cursor-not-allowed' : '';

    if (btnPush) {
        btnPush.className = baseClass + " border-green-500/30 hover:bg-navy-700" + viewerExtra;
        if (window.state.mode === 'push') {
            btnPush.className = "btn-press bg-green-600 border-green-400 rounded-lg text-sm text-white font-bold shadow-[0_0_15px_rgba(34,197,94,0.4)] flex flex-col items-center justify-center scale-105" + viewerExtra;
        }
        if (isViewer) { btnPush.style.pointerEvents = 'none'; btnPush.removeAttribute('onclick'); }
    }

    if (btnBad) {
        btnBad.className = baseClass + " border-red-500/30 hover:bg-navy-700" + viewerExtra;
        if (window.state.mode === 'bad') {
            btnBad.className = "btn-press bg-red-600 border-red-400 rounded-lg text-sm text-white font-bold shadow-[0_0_15px_rgba(239,68,68,0.4)] flex flex-col items-center justify-center scale-105" + viewerExtra;
        }
        if (isViewer) { btnBad.style.pointerEvents = 'none'; btnBad.removeAttribute('onclick'); }
    }

    if (btnReset) {
        if (isViewer) {
            btnReset.classList.add('hidden'); // Viewers never see reset button
        } else {
            btnReset.classList.toggle('hidden', window.state.mode === 'normal');
        }
    }

    // In problem mode: if min stint not reached, show "stay on track" instead of "box now"
    const minStintMs = (window.config?.minStintMs) || ((window.config?.minStint || 0) * 60000);
    const now = window.getSyncedNow();
    const currentStintMs = (now - (window.state.stintStart || now)) + (window.state.stintOffset || 0);
    const belowMinStint = !window.state.isInPit && minStintMs > 0 && currentStintMs < minStintMs;

    if (adviceText) {
        if (window.state.mode === 'bad') {
            const boxMsg = belowMinStint ? t('stayOnTrackUntilFurther') : window.getBoxMessage();
            adviceText.innerText = "⚠️ " + boxMsg;
            adviceText.className = "text-xs font-bold text-red-500 animate-pulse uppercase tracking-widest";
            // Play alert sound only on mode transition
            if (window.alertState.lastMode !== 'bad') {
                window.alertState.lastMode = 'bad';
                window.playAlertBeep('warning');
            }
        } else if (window.state.mode === 'push') {
            adviceText.innerText = "🔥 " + t('pushMode');
            adviceText.className = "text-[10px] font-bold text-green-400 uppercase tracking-widest";
            if (window.alertState.lastMode !== 'push') {
                window.alertState.lastMode = 'push';
                window.playAlertBeep('info');
            }
        } else {
            adviceText.innerText = t('buildTime');
            adviceText.className = "text-[10px] text-gray-500 font-bold uppercase tracking-widest";
            window.alertState.lastMode = 'normal';
        }
    }

    if (pitEntryBtn && pitEntryBtnLabel) {
        if (window.state.mode === 'bad' && belowMinStint) {
            pitEntryBtnLabel.innerText = t('stayOnTrackUntilFurther');
            pitEntryBtn.disabled = true;
            pitEntryBtn.classList.add('opacity-60', 'cursor-not-allowed');
        } else {
            pitEntryBtnLabel.innerText = t('enterPit');
            pitEntryBtn.disabled = false;
            pitEntryBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        }
    }
}

window.recalculateTargetStint = function() {
    if (!window.config || !window.state) return;
    
    if (window.state.mode === 'push') {
        const maxStintMs = (window.config.maxStintMs) || (window.config.maxStint * 60000) || (60 * 60000);
        window.state.targetStintMs = maxStintMs - 60000;
    } else if (window.state.mode === 'bad') {
        const minStintMs = (window.config.minStintMs) || (window.config.minStint * 60000) || (30 * 60000);
        window.state.targetStintMs = minStintMs;
    } else {
        const totalStops = parseInt(window.config.reqStops) || 0;
        const stopsDone = window.state.pitCount || 0;
        const isLastStint = stopsDone >= totalStops;

        if (isLastStint) {
            // Last stint: target = remaining race time from stint start
            const raceMs = window.config.raceMs || (parseFloat(window.config.duration) * 3600000);
            const now = window.getSyncedNow();
            let raceRemaining = raceMs - (now - window.state.startTime);
            // Use live timing race clock when available
            if (window.liveData && window.liveData.raceTimeLeftMs != null) {
                raceRemaining = window.liveData.raceTimeLeftMs;
            }
            const stintElapsed = (now - window.state.stintStart) + (window.state.stintOffset || 0);
            window.state.targetStintMs = stintElapsed + Math.max(0, raceRemaining);
        } else {
            const currentStintIdx = window.state.globalStintNumber - 1;
            if (window.state.stintTargets && window.state.stintTargets[currentStintIdx]) {
                window.state.targetStintMs = window.state.stintTargets[currentStintIdx];
            }
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

window.getActiveStintInfo = function() {
    const currentDriver = window.drivers[window.state.currentDriverIdx];
    if (!currentDriver) return null;
    
    if (window.state.isNightMode) {
        const activeSquad = window.state.activeSquad;
        const allLabels = window.getSquadLabelsInUse ? window.getSquadLabelsInUse() : ['A','B'];
        const sleepingSquads = allLabels.filter(l => l !== activeSquad);
        return {
            driverName: currentDriver.name,
            activeSquad: activeSquad,
            sleepingSquads: sleepingSquads,
            stintNumber: window.state.globalStintNumber || 1
        };
    }
    
    return {
        driverName: currentDriver.name,
        stintNumber: window.state.globalStintNumber || 1
    };
};

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
    
    const stintInfo = window.getActiveStintInfo();
    if (stintInfo) {
        console.log(`🌙 Night Mode: Squad ${window.state.activeSquad} active, Sleeping: ${(stintInfo.sleepingSquads||[]).join(', ')}. Stint ${window.state.globalStintNumber}: ${stintInfo.driverName}`);
    }
};

window.switchNightSquad = function() {
    if (!window.state.isNightMode || !window.config.useSquads) return;
    
    // Cycle to next squad
    const allLabels = window.getSquadLabelsInUse ? window.getSquadLabelsInUse() : ['A','B'];
    const curIdx = allLabels.indexOf(window.state.activeSquad);
    window.state.activeSquad = allLabels[(curIdx + 1) % allLabels.length];
    
    if (typeof window.cycleNextDriver === 'function') {
        window.cycleNextDriver(true);
    }
    
    updateNightModeUI();
    if (typeof window.broadcast === 'function') window.broadcast();
    if (typeof window.renderFrame === 'function') window.renderFrame();
    
    console.log(`🔄 Squad switched to ${window.state.activeSquad}`);
};

function updateNightModeUI() {
    const btn = document.getElementById('btnNightMode');
    const text = document.getElementById('nightModeText');
    const switchSquadBtn = document.getElementById('btnSwitchSquad');
    const t = window.t || ((k) => k);

    // Show night button and switch squad button only if squads are enabled
    if (btn) {
        if (window.config.useSquads) {
            btn.classList.remove('hidden');
        } else {
            btn.classList.add('hidden');
            return;
        }
    }
    
    // Show/hide squad switch button based on night mode
    if (switchSquadBtn) {
        if (window.state.isNightMode && window.config.useSquads) {
            switchSquadBtn.classList.remove('hidden');
        } else {
            switchSquadBtn.classList.add('hidden');
        }
    }

    if (window.state.isNightMode) {
        const activeSquad = window.state.activeSquad || 'A';
        const allLabels = window.getSquadLabelsInUse ? window.getSquadLabelsInUse() : ['A','B'];
        const sleeping = allLabels.filter(l => l !== activeSquad).join(', ');
        if (btn) btn.className = "bg-indigo-600 hover:bg-indigo-500 border border-indigo-300 text-white text-xs font-bold py-3 px-2 rounded transition flex flex-row items-center justify-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-pulse";
        if (text) text.innerHTML = `${t('squadSleeping')} <span class="text-yellow-300 text-lg font-black px-1">${sleeping}</span>`;
    } else {
        if (btn) btn.className = "bg-navy-800 hover:bg-indigo-800 border border-indigo-500/50 text-indigo-200 text-xs font-bold py-3 px-2 rounded transition flex flex-row items-center justify-center gap-2 shadow-lg";
        if (text) text.innerText = t('nightMode');
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

// Returns Date.now() adjusted by host clock offset (for viewers/drivers)
window.getSyncedNow = function() {
    return Date.now() + (window._hostTimeOffset || 0);
};

window.renderFrame = function() {
    if (!window.state || !window.state.isRunning) return;

    // Recalculate target every frame (needed for last stint = remaining time)
    if (typeof window.recalculateTargetStint === 'function') window.recalculateTargetStint();
    
    // בודק שפה כל פריים לוודא סינכרון
    const currentLang = localStorage.getItem('strateger_lang') || 'en';
    if (document.documentElement.lang !== currentLang && typeof window.setLanguage === 'function') {
        window.setLanguage(currentLang);
    }

    const raceMs = window.config.raceMs || (parseFloat(window.config.duration) * 3600000);
    if (!raceMs) return;

    try {
        const now = window.getSyncedNow();
        const raceElapsed = now - window.state.startTime;
        let raceRemaining = raceMs - raceElapsed;
        
        // Use live timing race clock when available (more accurate than local timer)
        if (window.liveData && window.liveData.raceTimeLeftMs != null) {
            raceRemaining = window.liveData.raceTimeLeftMs;
        }
        
        const timerEl = document.getElementById('raceTimerDisplay');
        if (raceRemaining <= -1000) {
            timerEl.innerText = "FINISH";
            timerEl.classList.add("text-neon", "animate-pulse");
            return;
        }
        if (raceRemaining <= 0) {
            timerEl.innerText = "0:00:00";
            timerEl.classList.add("text-neon");
        } else {
            // Floor so the last visible second is 0:00:00 (not stuck on 0:00:01)
            timerEl.innerText = window.formatTimeHMS(Math.floor(raceRemaining / 1000) * 1000);
        }

        const totalPlannedStops = window.config.reqStops || 0;
        document.getElementById('pitCountDisplay').innerHTML = 
            `<span class="text-neon text-xl">${window.state.pitCount}</span><span class="text-gray-500 text-xs">/${totalPlannedStops}</span>`;

        // === Update pit status indicator ===
        const statusDisplay = document.getElementById('pitStatusIndicator');
        if (statusDisplay) {
            if (window.state.isInPit) {
                statusDisplay.innerHTML = '🛑 ' + window.t('inPits');
                statusDisplay.className = 'text-sm font-bold text-red-400';
            } else {
                statusDisplay.innerHTML = '🏁 ' + window.t('onTrack');
                statusDisplay.className = 'text-sm font-bold text-green-400';
            }
        }

        // === Update pit adjustment display for viewers ===
        const dashDisplay = document.getElementById('dashboardPitAdjDisplay');
        if (dashDisplay) {
            const sign = window.currentPitAdjustment >= 0 ? '+' : '';
            dashDisplay.innerText = `${sign}${window.currentPitAdjustment || 0}s`;
            dashDisplay.className = `bg-black/30 px-2 py-1 rounded font-mono font-bold text-xs min-w-[30px] text-center ${
                window.currentPitAdjustment > 0 ? 'text-red-400' : (window.currentPitAdjustment < 0 ? 'text-green-400' : 'text-ice')
            }`;
        }

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

            // === ⬇️ התיקון מתחיל כאן: עדכון תצוגת יעד ודלתא ⬇️ ===
            const targetEl = document.getElementById('strategyTargetStint');
            if (targetEl) {
                let tStr = window.formatTimeHMS(targetMs);
                // מסיר את השעות (00:) אם הן 0, לתצוגה נקייה יותר
                if (tStr.startsWith("00:")) tStr = tStr.substring(3);
                targetEl.innerText = tStr;
            }

            const deltaEl = document.getElementById('strategyDelta');
            if (deltaEl) {
                const diff = currentStintTime - targetMs;
                const sign = diff >= 0 ? '+' : '-';
                const absDiff = Math.abs(diff);
                const dm = Math.floor(absDiff / 60000);
                const ds = Math.floor((absDiff % 60000) / 1000);
                
                deltaEl.innerText = `${sign}${dm}:${ds.toString().padStart(2, '0')}`;
                
                // Colors: red if over target, green if under — only pulse on first transition
                if (diff > 0) {
                    deltaEl.className = "text-sm font-bold text-red-500 animate-pulse";
                    if (!window.alertState.overTargetFired) {
                        window.alertState.overTargetFired = true;
                        window.playAlertBeep('warning');
                    }
                } else {
                    deltaEl.className = "text-sm font-bold text-green-500";
                    window.alertState.overTargetFired = false;
                }
            }
            // === ⬆️ סוף התיקון ⬆️ ===

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

        // Strategy-based notifications (upcoming driver changes, squad alerts)
        if (typeof window.updateStrategyNotifications === 'function') {
            window.updateStrategyNotifications();
        }

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

    // קריאת הגדרות - המרה למספרים למניעת שגיאות
    const maxStintVal = parseFloat(window.config.maxStint) || 60;
    const minStintVal = parseFloat(window.config.minStint) || 15; // הערך שהגדרת (למשל 30)
    
    const maxStintMs = maxStintVal * 60000;
    const minStintMs = minStintVal * 60000;
    const pitTimeMs = (parseFloat(window.config.minPitSec) || 60) * 1000;
    
    // חישוב סטינטים עתידיים
    const stopsDone = window.state.pitCount;
    const totalStopsRequired = parseInt(window.config.reqStops) || 0;
    const futureStints = Math.max(0, totalStopsRequired - stopsDone);
    
    // חישוב זמן נטו שנשאר לנהיגה בעתיד
    const now = window.getSyncedNow();
    const currentStintElapsed = (now - window.state.stintStart) + (window.state.stintOffset || 0);
    const targetStintMs = window.state.targetStintMs || maxStintMs;
    // הזמן שנשאר לנהוג בסטינט הנוכחי עד ליעד שלו
    const timeToFinishCurrent = Math.max(0, targetStintMs - currentStintElapsed);
    
    const futurePitTimeLoss = futureStints * pitTimeMs;
    // ה"בריכה" של הזמן שנשאר לחלק בין הסטינטים העתידיים
    const futurePoolMs = raceRemainingMs - timeToFinishCurrent - futurePitTimeLoss;

    if (raceRemainingMs <= 0) {
        textField.innerText = t('finalLap');
        return;
    }

    // אם אין יותר עצירות (אנחנו בסטינט האחרון)
    if (futureStints === 0) {
        textField.innerHTML = `<span class="text-ice font-bold">${t('finalLap')} / ${t('rest')}</span>`;
        timeField.innerText = window.formatTimeHMS(raceRemainingMs);
        return;
    }

    // --- חישוב החלוקה ---
    const minTotalTime = futureStints * minStintMs;
    const maxTotalTime = futureStints * maxStintMs;
    const bufferMs = futurePoolMs - minTotalTime;
    const bufferMin = Math.floor(bufferMs / 60000);

    let html = "";

    // כותרת קטנה: כמה סטינטים נשארו
    html += `<div class="text-[10px] text-gray-400 mb-1 border-b border-gray-700 pb-1">
                ${t('future')}: <span class="text-white font-bold">${futureStints} ${t('stopsHeader')}</span>
             </div>`;

    if (bufferMs < 0) {
        // המצב שתיארת: גם אם ניסע מינימום בכל הסטינטים, חסר זמן!
        const missingMin = Math.abs(Math.ceil(bufferMs / 60000));
        html += `<span class="text-red-500 font-bold animate-pulse">${t('impossible')} (-${missingMin}m)</span>`;
    } 
    else if (futurePoolMs > maxTotalTime) {
        // נשאר יותר מדי זמן -> חייבים להוסיף עצירה
        const extraMin = Math.ceil((futurePoolMs - maxTotalTime) / 60000);
        html += `<span class="text-red-500 font-bold">${t('addStop')} (+${extraMin}m)</span>`;
    } 
    else {
        // חישוב אופטימלי (Greedy): כמה שיותר MAX, והשארית בסוף
        const fullMaxStints = Math.floor(futurePoolMs / maxStintMs);
        const greedyCount = Math.min(futureStints - 1, fullMaxStints);
        
        const timeUsedByMax = greedyCount * maxStintMs;
        const remainingTime = futurePoolMs - timeUsedByMax;
        
        const restStintsCount = futureStints - greedyCount;
        const avgRestMin = Math.floor((remainingTime / restStintsCount) / 60000);

        // הצגת סטינטים של MAX
        if (greedyCount > 0) {
            html += `${greedyCount}x <span class="text-neon font-bold">${t('max')}</span> `;
        }
        
        // הצגת השארית (REST)
        if (restStintsCount > 0) {
            let color = "text-white";
            let note = `(${t('rest')})`;
            
            // בדיקה קריטית: האם השארית קטנה מהמינימום המותר?
            if (avgRestMin < minStintVal) {
                color = "text-red-500 animate-pulse font-bold";
                // מציג בבירור שזה קצר מדי ומה המינימום הנדרש
                note = `(< ${minStintVal}m!)`; 
            }
            else if (avgRestMin > (maxStintVal - 5)) {
                color = "text-neon"; 
            }
            else {
                color = "text-yellow-400"; 
            }

            html += `+ ${restStintsCount}x <span class="${color} font-bold">${avgRestMin}m ${note}</span>`;
        }

        // שורת ה-Buffer (כמה "ספייר" יש מעל המינימום)
        html += `<div class="text-[9px] text-gray-500 mt-1">
                    ${t('buffer')}: ${bufferMin}m
                 </div>`;
    }
    
    textField.innerHTML = html;
    timeField.innerText = window.formatTimeHMS(raceRemainingMs);
}

window.updatePitModalLogic = function() {
    const now = Date.now();
    const elapsedSec = (now - window.state.pitStart) / 1000;
    const basePitTime = parseInt(window.config.minPitTime || window.config.pitTime) || 0;
    const totalRequiredTime = Math.max(0, basePitTime + window.currentPitAdjustment); 
    const buffer = parseInt(document.getElementById('releaseBuffer')?.value) || 5;
    const timeRemaining = totalRequiredTime - elapsedSec;
    const t = window.t || ((k) => k); // פונקציית התרגום

    const timerDisplay = document.getElementById('pitTimerDisplay');
    if (timerDisplay) timerDisplay.innerText = Math.max(0, timeRemaining).toFixed(1);

    const releaseBtn = document.getElementById('confirmExitBtn');
    if (!releaseBtn) return;

    // Determine current zone
    let pitZone = 'wait';
    if (timeRemaining <= 0) pitZone = 'go';
    else if (timeRemaining <= buffer) pitZone = 'ready';

    if (pitZone === 'wait') {
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-red-500";
        releaseBtn.innerText = t('wait');
        releaseBtn.disabled = true;
        releaseBtn.className = "w-full max-w-xs bg-gray-800 text-gray-500 font-bold py-4 rounded-lg text-2xl border border-gray-700 cursor-not-allowed";
        const pitWarningBox = document.getElementById('pitWarningBox');
        if (pitWarningBox) pitWarningBox.classList.add('hidden');
        window._lastOrangeBeep = null;
    } else if (pitZone === 'ready') {
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-yellow-400 animate-pulse";
        releaseBtn.innerText = t('getReady');
        releaseBtn.disabled = true;
        releaseBtn.className = "w-full max-w-xs bg-yellow-800 text-yellow-400 font-bold py-4 rounded-lg text-2xl border border-yellow-600 animate-pulse cursor-not-allowed";
        const pitWarningBox = document.getElementById('pitWarningBox');
        if (pitWarningBox) pitWarningBox.classList.remove('hidden');
        // Repeating beep in orange zone (every 1 second)
        const now = Date.now();
        if (!window._lastOrangeBeep || (now - window._lastOrangeBeep >= 1000)) {
            window.playAlertBeep('info');
            window._lastOrangeBeep = now;
        }
    } else {
        if (timerDisplay) timerDisplay.className = "text-6xl font-bold font-mono text-green-500";
        releaseBtn.innerText = t('go');
        releaseBtn.disabled = false;
        releaseBtn.className = "w-full max-w-xs bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-lg text-3xl border border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)] cursor-pointer";
        const pitWarningBox = document.getElementById('pitWarningBox');
        if (pitWarningBox) pitWarningBox.classList.add('hidden');
        window._lastOrangeBeep = null;
        // Sound only on transition to go zone
        if (window.alertState.lastZone !== 'go') {
            window.playReleaseSound();
        }
    }
    window.alertState.lastZone = pitZone;
};

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

window.confirmPitEntry = function(autoDetected) {
    // Guard: prevent re-entry if already in pit
    if (window.state.isInPit) return;
    
    // Guard: cooldown to prevent rapid pit cycling (min 10s between manual pit entries)
    // Skip cooldown if auto-detected from live timing — live timing is authoritative
    const now = Date.now();
    if (!autoDetected && window._lastPitEntryTime && (now - window._lastPitEntryTime) < 10000) {
        console.warn('⚠️ confirmPitEntry blocked — too soon after last pit entry');
        return;
    }
    
    const currentStintMs = (now - window.state.stintStart) + (window.state.stintOffset || 0);
    const minStintMs = (window.config.minStint || 0) * 60000;
    let isShortStint = false;

    if (minStintMs > 0 && currentStintMs < minStintMs) {
        if (!autoDetected) {
            const missingSec = Math.ceil((minStintMs - currentStintMs) / 1000);
            const t = window.t || ((k) => k);
            if (!confirm(`⚠️ ${t('shortStintMsg')}\n${t('missingSeconds') || 'Missing'}: ${missingSec}s\n${t('proceedToPit') || 'Proceed to Pit?'}`)) return;
        }
        isShortStint = true;
    }

    window.state.isInPit = true;
    window.state.pitStart = now;
    window.state.pitCount++; // === UP COUNT ===
    window._lastPitEntryTime = now; // Record for cooldown guard

    // Save snapshot for undo functionality
    if (typeof window._saveUndoPitSnapshot === 'function') {
        window._saveUndoPitSnapshot();
    }

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
            const t = window.t || ((k) => k);
            releaseBtn.disabled = true;
            releaseBtn.innerText = t('wait');
            releaseBtn.className = "w-full max-w-xs bg-gray-800 text-gray-500 font-bold py-4 rounded-lg text-2xl border border-gray-700 cursor-not-allowed";
        }
    }

    if (window.pitInterval) clearInterval(window.pitInterval);
    window.pitInterval = setInterval(window.updatePitModalLogic, 100);
    
    if (typeof window.broadcast === 'function') window.broadcast();
    window.renderFrame();
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

window.cycleNextDriver = function(forceValidation = false, manualOverride = false) {
    if (!window.drivers || window.drivers.length === 0) return;

    // === Strategy-following logic: look at the planned schedule ===
    // Skip strategy if host manually clicked to cycle (override)
    if (!manualOverride) {
        const schedule = window.state.stintSchedule;
        const nextStintIdx = (window.state.globalStintNumber || 1); // 0-based index for next stint
        
        if (schedule && schedule.length > nextStintIdx) {
            const planned = schedule[nextStintIdx];
            const plannedDriverIdx = planned.driverIdx;
            
            // Validate the planned driver is still valid
            if (plannedDriverIdx >= 0 && plannedDriverIdx < window.drivers.length) {
                let isValid = true;
                
                // Night mode squad check
                if (window.config.useSquads && window.state.isNightMode) {
                    if (window.drivers[plannedDriverIdx].squad !== window.state.activeSquad) {
                        isValid = false;
                    }
                }
                
                // Double stint check (only if same as current)
                if (plannedDriverIdx === window.state.currentDriverIdx) {
                    const allowDouble = window.config.allowDouble || document.getElementById('allowDouble')?.checked;
                    if (!allowDouble || window.state.consecutiveStints >= 2) {
                        isValid = false;
                    }
                }
                
                if (isValid) {
                    window.state.nextDriverIdx = plannedDriverIdx;
                    
                    // Also update the squad info from the strategy if applicable
                    if (planned.squadModeActive && planned.activeSquad && !window.state.isNightMode) {
                        // Strategy had a squad plan — inform the system
                        window.state._plannedSquad = planned.activeSquad;
                    }
                    
                    const nextDriver = window.drivers[window.state.nextDriverIdx];
                    const nextEls = [document.getElementById('nextDriverName'), document.getElementById('modalNextDriverName')];
                    nextEls.forEach(el => { if(el && nextDriver) el.innerText = nextDriver.name; });
                    if (typeof window.broadcast === 'function') window.broadcast();
                    return;
                }
            }
        }
    }

    // === Fallback: original cycling logic (when strategy doesn't cover this stint) ===
    let candidate = window.state.nextDriverIdx;
    if (!forceValidation) {
        candidate = (candidate + 1) % window.drivers.length;
    }

    let attempts = 0;
    while (attempts < window.drivers.length) {
        const driver = window.drivers[candidate];
        let isValid = true;

        if (window.config.useSquads && window.state.isNightMode) {
            if (driver.squad !== window.state.activeSquad) {
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

window.playReleaseSound = function() {
    // Respect global mute setting
    if (window._soundMuted) return;
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // First beep: 900Hz
        const osc1 = audioContext.createOscillator();
        const gain1 = audioContext.createGain();
        osc1.connect(gain1);
        gain1.connect(audioContext.destination);
        
        osc1.frequency.value = 900;
        osc1.type = 'sine';
        gain1.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        osc1.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + 0.1);
        
        // Second beep: 1200Hz
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();
        osc2.connect(gain2);
        gain2.connect(audioContext.destination);
        
        osc2.frequency.value = 1200;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, audioContext.currentTime + 0.15);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
        
        osc2.start(audioContext.currentTime + 0.15);
        osc2.stop(audioContext.currentTime + 0.25);
    } catch (e) {
        console.warn("Release sound not available:", e);
    }
};

// ==========================================
// 🔊 ALERT BEEP SYSTEM (state-change only)
// ==========================================

window.playAlertBeep = function(type) {
    // Respect global mute setting
    if (window._soundMuted) return;
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'warning') {
            osc.frequency.value = 660;
            osc.type = 'square';
        } else if (type === 'info') {
            osc.frequency.value = 880;
            osc.type = 'sine';
        } else if (type === 'boxNow') {
            // Urgent double-beep for BOX THIS LAP
            osc.frequency.value = 1000;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.12);
            // Second beep
            const osc2 = ctx.createOscillator();
            const g2 = ctx.createGain();
            osc2.connect(g2); g2.connect(ctx.destination);
            osc2.frequency.value = 1200; osc2.type = 'square';
            g2.gain.setValueAtTime(0.25, ctx.currentTime + 0.18);
            g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc2.start(ctx.currentTime + 0.18);
            osc2.stop(ctx.currentTime + 0.3);
            return;
        } else {
            osc.frequency.value = 440;
            osc.type = 'sine';
        }

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    } catch (e) {}
};

// ==========================================
// 🏁 LAP-AWARE BOX MESSAGE
// ==========================================

window.getEstimatedLapMs = function() {
    // Priority: live timing data > demo data > default
    if (window.liveData && window.liveData.lastLap && window.liveData.lastLap > 0) {
        return window.liveData.lastLap;
    }
    if (window.liveData && window.liveData.bestLap && window.liveData.bestLap > 0) {
        return window.liveData.bestLap;
    }
    // Estimate from demo competitors
    if (window.demoState && window.demoState.competitors) {
        const ourTeam = window.demoState.competitors.find(c => c.isOurTeam);
        if (ourTeam && ourTeam.lastLap) return ourTeam.lastLap;
    }
    return null;
};

window.getBoxMessage = function() {
    const t = window.t || (k => k);
    const now = window.getSyncedNow();
    const currentStintMs = (now - window.state.stintStart) + (window.state.stintOffset || 0);
    const targetMs = window.state.targetStintMs || 0;
    const timeToTarget = targetMs - currentStintMs;
    const lapMs = window.getEstimatedLapMs();

    // If we have lap time data, give lap-aware instructions
    if (lapMs && lapMs > 0) {
        if (timeToTarget <= 0) {
            // Already over target
            return t('boxThisLap') || '🏁 BOX THIS LAP';
        } else if (timeToTarget <= lapMs) {
            // Less than one lap to target — box THIS lap
            return t('boxThisLap') || '🏁 BOX THIS LAP';
        } else if (timeToTarget <= lapMs * 2) {
            // 1-2 laps to target — box NEXT lap
            return t('boxNextLap') || '📢 BOX NEXT LAP';
        } else {
            // More than 2 laps — stay out with countdown
            const lapsLeft = Math.ceil(timeToTarget / lapMs);
            return `${t('stayOut') || 'STAY OUT'} (${lapsLeft} ${t('laps') || 'laps'})`;
        }
    }
    
    // Fallback: no lap data, use time-based message
    if (timeToTarget <= 0) {
        return t('boxNow');
    } else if (timeToTarget <= 60000) {
        return t('boxThisLap') || '🏁 BOX THIS LAP';
    }
    return t('boxNow');
};

window.confirmPitExit = function() {
    // Guard: only exit if actually in pit
    if (!window.state.isInPit) return;
    
    // Hide undo toast — can't undo after exit
    if (typeof window._hideUndoPitToast === 'function') window._hideUndoPitToast();
    
    // Play release sound
    if (typeof window.playReleaseSound === 'function') window.playReleaseSound();
    
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

    // Reset stint lap tracking for new driver/stint
    if (window.liveData) {
        window.liveData.stintLapHistory = [];
        window.liveData.stintBestLap = null;
        window.liveData.lastRecordedLap = null;
    }
    
    if (typeof window.adjustPitTime === 'function') {
        window.adjustPitTime(-window.currentPitAdjustment); 
    }

    const newDriverIdx = window.state.currentDriverIdx;
    if (newDriverIdx === prevDriverIdx) {
        window.state.consecutiveStints = (window.state.consecutiveStints || 1) + 1;
    } else {
        window.state.consecutiveStints = 1; 
        if (window.config.useSquads && window.drivers[newDriverIdx]) {
            if (!window.state.isNightMode) {
                // Use strategy-planned squad if available, else driver's squad
                const currentStintIdx = (window.state.globalStintNumber || 1) - 1;
                const schedule = window.state.stintSchedule;
                if (schedule && schedule[currentStintIdx] && schedule[currentStintIdx].activeSquad) {
                    window.state.activeSquad = schedule[currentStintIdx].activeSquad;
                } else {
                    window.state.activeSquad = window.drivers[newDriverIdx].squad;
                }
            }
        }
    }

    // Reset strategy notification state for the new stint
    if (window._strategyNotifState) {
        window._strategyNotifState.pitAlert5Fired = false;
        window._strategyNotifState.pitAlert2Fired = false;
        window._strategyNotifState.squadChangeNotified = false;
        window._strategyNotifState.driverChangeNotified = false;
    }

    if (typeof window.saveRaceState === 'function') window.saveRaceState();
    if (typeof window.broadcast === 'function') window.broadcast();
    if (typeof window.renderFrame === 'function') window.renderFrame();
};

// ==========================================
// � CONTACT US MODAL
// ==========================================

window.openContactUsModal = function() {
    const modal = document.getElementById('contactUsModal');
    if (modal) modal.classList.remove('hidden');
};

window.closeContactUsModal = function() {
    const modal = document.getElementById('contactUsModal');
    if (modal) modal.classList.add('hidden');
};

// ==========================================
// �💬 FEEDBACK SYSTEM (BUG REPORTS & SUGGESTIONS)
// ==========================================

window.feedbackType = 'bug'; // 'bug' or 'feature'

window.showFeedbackTab = (type) => {
    window.feedbackType = type;
    
    // Update button styles
    const bugBtn = document.getElementById('bugReportTabBtn');
    const featureBtn = document.getElementById('featureTabBtn');
    const titleEl = document.getElementById('feedbackTitle');
    
    if (type === 'bug') {
        bugBtn.classList.add('bg-red-800', 'border-red-500');
        bugBtn.classList.remove('bg-red-900/50', 'border-red-500/50');
        featureBtn.classList.remove('bg-blue-800', 'border-blue-500');
        featureBtn.classList.add('bg-blue-900/50', 'border-blue-500/50');
        titleEl.setAttribute('data-i18n', 'bugReportTitle');
    } else {
        featureBtn.classList.add('bg-blue-800', 'border-blue-500');
        featureBtn.classList.remove('bg-blue-900/50', 'border-blue-500/50');
        bugBtn.classList.remove('bg-red-800', 'border-red-500');
        bugBtn.classList.add('bg-red-900/50', 'border-red-500/50');
        titleEl.setAttribute('data-i18n', 'featureSuggestionTitle');
    }
    
    // Re-translate
    if (typeof window.translateUI === 'function') {
        window.translateUI(titleEl);
    }
    
    // Clear textarea and focus
    document.getElementById('feedbackText').value = '';
    document.getElementById('feedbackText').focus();
};

window.submitFeedback = async () => {
    const text = document.getElementById('feedbackText').value.trim();
    
    if (!text) {
        alert('Please describe the issue or suggestion.');
        return;
    }
    
    if (text.length > 1000) {
        alert('Feedback must be 1000 characters or less.');
        return;
    }
    
    // Create feedback object
    const feedback = {
        type: window.feedbackType,
        text: text,
        timestamp: new Date().toISOString(),
        role: window.role || 'unknown',
        raceTime: window.state?.raceTime || 0
    };
    
    // Store feedback locally
    const feedbackList = JSON.parse(localStorage.getItem('strateger_feedback') || '[]');
    feedbackList.push(feedback);
    localStorage.setItem('strateger_feedback', JSON.stringify(feedbackList));

    // Check if running locally - Netlify functions won't work
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
        alert('✅ Feedback saved locally!\n\n⚠️ Email sending only works when deployed to Netlify.\n\nTo test locally, run: netlify dev');
        document.getElementById('feedbackText').value = '';
        return;
    }

    // Clear form
    document.getElementById('feedbackText').value = '';
    
    // Show sending status
    const feedbackForm = document.getElementById('feedbackForm');
    const originalHTML = feedbackForm.innerHTML;
    const sendBtn = feedbackForm.querySelector('button');
    
    sendBtn.disabled = true;
    sendBtn.textContent = '⏳ Sending...';
    
    try {
        // Send to Netlify function with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        const response = await fetch('/.netlify/functions/send-feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(feedback),
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        const result = await response.json();
        
        if (response.ok) {
            // Show success message
            feedbackForm.innerHTML = '<div class="text-center text-neon font-bold p-4">✓ Feedback sent successfully!</div>';
            
            setTimeout(() => {
                feedbackForm.innerHTML = originalHTML;
                sendBtn.disabled = false;
                sendBtn.textContent = window.t('send');
            }, 2000);
        } else {
            throw new Error(result.error || 'Failed to send feedback');
        }
    } catch (error) {
        console.error('Error sending feedback:', error);
        
        // Show error message but keep the form
        sendBtn.disabled = false;
        sendBtn.textContent = window.t('send');
        
        if (error.name === 'AbortError') {
            alert('Request timed out. Your feedback was saved locally. Please check your Gmail password is set correctly.');
        } else {
            alert(`Error sending feedback: ${error.message}. Feedback was saved locally.`);
        }
    }
};

// ==========================================
// 🏎️ DRIVER MODE (In-Car HUD)
// ==========================================

// Show driver entry screen (manual ID entry without a link)
window.showDriverEntryScreen = function() {
    window.role = 'client';
    window._autoDriverMode = true;
    window._driverModeOpened = false;
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('driverEntryScreen').classList.remove('hidden');
    const input = document.getElementById('driverIdInput');
    if (input) { input.value = ''; input.focus(); }
};

// Show a quick identity picker — "Who are you?" with driver name buttons
window._showDriverPicker = function() {
    // Create an overlay with driver name buttons
    let overlay = document.getElementById('driverPickerOverlay');
    if (overlay) overlay.remove();
    
    overlay = document.createElement('div');
    overlay.id = 'driverPickerOverlay';
    overlay.className = 'fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center p-6 gap-4';
    
    const title = document.createElement('div');
    title.className = 'text-3xl mb-2';
    title.innerText = '🏎️';
    overlay.appendChild(title);
    
    const label = document.createElement('div');
    label.className = 'text-white text-xl font-bold mb-4 tracking-wider text-center';
    label.innerText = window.t ? window.t('joinAsDriver') || 'Who are you?' : 'Who are you?';
    overlay.appendChild(label);
    
    // Create a button for each driver
    window.drivers.forEach((driver, idx) => {
        const btn = document.createElement('button');
        btn.className = 'w-full max-w-xs py-4 px-6 rounded-xl text-xl font-bold text-white border-2 transition-all active:scale-95';
        btn.style.borderColor = driver.color || '#888';
        btn.style.background = `linear-gradient(135deg, ${driver.color || '#333'}33, #111)`;
        
        let nameText = driver.name;
        if (driver.squad) nameText += ` (${driver.squad})`;
        btn.innerText = nameText;
        
        btn.onclick = function() {
            window._myDriverIdx = idx;
            localStorage.setItem('strateger_chat_name', driver.name);
            overlay.remove();
            setTimeout(() => {
                if (typeof window.toggleDriverMode === 'function') {
                    window.toggleDriverMode();
                }
            }, 200);
        };
        overlay.appendChild(btn);
    });
    
    document.body.appendChild(overlay);
    
    // Request notification permission early
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
};

// Submit driver ID from the manual entry screen
window.submitDriverId = function() {
    const input = document.getElementById('driverIdInput');
    const errEl = document.getElementById('driverEntryError');
    if (!input) return;
    
    const code = input.value.trim();
    if (!code || code.length < 5) {
        if (errEl) {
            errEl.innerText = window.t('driverIdTooShort') || 'ID is too short';
            errEl.classList.remove('hidden');
        }
        return;
    }
    
    // Hide entry screen, show connecting screen
    document.getElementById('driverEntryScreen').classList.add('hidden');
    document.getElementById('clientWaitScreen').classList.remove('hidden');
    document.getElementById('clientWaitScreen').innerHTML = '<div class="flex flex-col items-center justify-center gap-2"><div class="text-3xl animate-pulse font-bold text-ice">🏎️ Connecting...</div><div class="text-sm text-gray-500 mt-2">Joining race as driver</div></div>';
    
    if (typeof window.connectToHost === 'function') window.connectToHost(code);
};

// Driver pit tap — tap the status zone to enter/exit pits (when radio is unavailable)
// Double-tap to confirm pit entry: first tap shows confirmation, second tap commits
window._driverPitPending = false;
window._driverPitPendingTimer = null;

window.driverPitTap = function() {
    if (!window.state || !window.state.isRunning) return;
    
    if (window.state.isInPit) {
        // Only allow exit if in green zone
        if (window.alertState.lastZone === 'go') {
            // For client driver mode: send pit exit request to host
            if (window.role === 'client' && window.conn && window.conn.open) {
                window.conn.send({ type: 'DRIVER_PIT_EXIT', driverIdx: window._myDriverIdx, timestamp: Date.now() });
            }
            window.confirmPitExit();
        }
    } else {
        // === Double-tap confirmation for pit entry ===
        const t = window.t || ((k) => k);
        if (!window._driverPitPending) {
            // ─── FIRST TAP: show big "PITS?" in chosen language ───
            window._driverPitPending = true;
            
            const statusMsg = document.getElementById('driverStatusMsg');
            const statusSub = document.getElementById('driverStatusSub');
            const statusEmoji = document.getElementById('driverStatusEmoji');
            const tapHint = document.getElementById('driverTapHint');
            const zone = document.getElementById('driverStatusZone');
            
            if (statusEmoji) statusEmoji.textContent = '🅿️';
            if (statusMsg) {
                statusMsg.textContent = t('pitsConfirm') || 'PITS?';
                statusMsg.style.color = '#f59e0b';
                statusMsg.style.fontSize = '';
            }
            if (statusSub) {
                statusSub.textContent = t('tapAgainConfirm') || 'TAP AGAIN TO CONFIRM';
                statusSub.style.color = '#fbbf24';
            }
            if (tapHint) {
                tapHint.textContent = '⚠️ ' + (t('tapAgainConfirm') || 'TAP AGAIN TO CONFIRM');
                tapHint.style.color = '#f59e0b';
            }
            // Flash the zone background amber
            if (zone) zone.style.background = 'linear-gradient(180deg, rgba(245,158,11,0.25) 0%, rgba(0,0,0,1) 100%)';
            
            // Auto-cancel after 4 seconds
            if (window._driverPitPendingTimer) clearTimeout(window._driverPitPendingTimer);
            window._driverPitPendingTimer = setTimeout(() => {
                window._driverPitPending = false;
                // Restore normal display — renderFrame will handle it
                if (tapHint) { tapHint.textContent = ''; tapHint.style.color = ''; }
                if (zone) zone.style.background = '';
            }, 4000);
        } else {
            // ─── SECOND TAP: confirm pit entry ───
            window._driverPitPending = false;
            if (window._driverPitPendingTimer) { clearTimeout(window._driverPitPendingTimer); window._driverPitPendingTimer = null; }
            
            const tapHint = document.getElementById('driverTapHint');
            const zone = document.getElementById('driverStatusZone');
            if (tapHint) { tapHint.textContent = ''; tapHint.style.color = ''; }
            if (zone) zone.style.background = '';
            
            // For client driver mode: send pit entry request to host so admin sees team in pits
            if (window.role === 'client' && window.conn && window.conn.open) {
                window.conn.send({ type: 'DRIVER_PIT_ENTRY', driverIdx: window._myDriverIdx, timestamp: Date.now() });
            }
            
            window.confirmPitEntry();
        }
    }
};

window.toggleDriverMode = function() {
    const panel = document.getElementById('driverModePanel');
    if (!panel) return;
    
    const isActive = !panel.classList.contains('hidden');
    if (isActive) {
        panel.classList.add('hidden');
        window.alertState.driverModeActive = false;
        if (window._driverModeInterval) {
            clearInterval(window._driverModeInterval);
            window._driverModeInterval = null;
        }
        // Unlock screen orientation
        try { screen.orientation?.unlock(); } catch(e) {}
        // Exit fullscreen
        try { if (document.fullscreenElement) document.exitFullscreen(); } catch(e) {}
        // Restore chat button (only if NOT auto-driver-mode link)
        if (!window._autoDriverMode) {
            const chatBtn = document.getElementById('chatToggleBtn');
            if (chatBtn) chatBtn.style.display = 'block';
        }
    } else {
        panel.classList.remove('hidden');
        window.alertState.driverModeActive = true;
        // Force landscape orientation for wheel-mounted phone
        try {
            // Request fullscreen first (required by some browsers before orientation lock)
            const el = document.documentElement;
            if (el.requestFullscreen) el.requestFullscreen().catch(()=>{});
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        } catch(e) {}
        try {
            screen.orientation.lock('landscape').catch(() => {
                // Fallback: try landscape-primary 
                screen.orientation.lock('landscape-primary').catch(()=>{});
            });
        } catch(e) {}
        // Hide chat button & panel in driver mode
        const chatBtn = document.getElementById('chatToggleBtn');
        const chatPanel = document.getElementById('chatPanel');
        if (chatBtn) chatBtn.style.display = 'none';
        if (chatPanel) chatPanel.classList.add('hidden');
        // Show demo badge if in demo mode
        const badge = document.getElementById('driverDemoBadge');
        if (badge) badge.classList.toggle('hidden', !window.liveTimingConfig.demoMode);
        // Request wake lock for driver
        if ('wakeLock' in navigator) {
            navigator.wakeLock.request('screen').catch(e => {});
        }
        // Update at higher frequency for responsiveness
        window._driverModeInterval = setInterval(window.updateDriverMode, 500);
        window.updateDriverMode();
    }
};

// ==========================================
// 🔔 DRIVER STINT NOTIFICATIONS
// ==========================================

// Find the driver index that matches this connected driver
window.getMyDriverIdx = function() {
    // If assigned via host, use the currentDriverIdx from last stint we drove
    // Otherwise, try to match by driver name from the connection context
    if (window._myDriverIdx !== undefined) return window._myDriverIdx;
    
    // Auto-detect: when in driver mode as a client, our name might match a driver
    // The host sends the full driver list — try matching by name stored in localStorage
    const storedName = localStorage.getItem('strateger_chat_name');
    if (storedName && window.drivers) {
        const idx = window.drivers.findIndex(d => 
            d.name.toLowerCase().trim() === storedName.toLowerCase().trim()
        );
        if (idx !== -1) {
            window._myDriverIdx = idx;
            return idx;
        }
    }
    return null;
};

// Get upcoming stints for a specific driver from the timeline
window.getDriverStints = function(driverIdx) {
    const timeline = window._receivedTimeline || 
        (window.cachedStrategy && window.cachedStrategy.timeline && 
         window.cachedStrategy.timeline.filter(t => t.type === 'stint')) || [];
    
    return timeline.filter(s => s.driverIdx === driverIdx);
};

// Get the next upcoming stint for a driver (not yet started)
window.getNextDriverStint = function(driverIdx) {
    const stints = window.getDriverStints(driverIdx);
    if (!stints || stints.length === 0) return null;
    
    const now = Date.now();
    // Current stint number from state
    const currentGlobalStint = window.state.globalStintNumber || 1;
    
    // Find the next stint that hasn't started yet (stintNumber > current)
    for (const s of stints) {
        if (s.stintNumber > currentGlobalStint) return s;
    }
    return null;
};

// Check if the driver's squad is currently active (should stay awake)
window.isDriverSquadActive = function(driverIdx) {
    if (!window.config || !window.config.useSquads) return null; // No squad system
    if (!window.drivers || !window.drivers[driverIdx]) return null;
    
    const mySquad = window.drivers[driverIdx].squad;
    const activeSquad = window.state.activeSquad;
    
    if (!mySquad) return null;
    return mySquad === activeSquad;
};

// Driver notification state
window._driverNotifState = {
    lastAlertStint: 0,      // last stint we alerted for
    alert15Fired: false,
    alert5Fired: false,
    wakeUpFired: false
};

// Update the next stint banner in driver mode
window.updateDriverStintNotifications = function() {
    const t = window.t || (k => k);
    const banner = document.getElementById('driverNextStintBanner');
    const textEl = document.getElementById('driverNextStintText');
    const sleepEl = document.getElementById('driverSleepStatus');
    if (!banner || !textEl) return;
    
    const myIdx = window.getMyDriverIdx();
    
    // If we're the current driver, hide the next stint info (we're driving!)
    if (myIdx === window.state.currentDriverIdx && !window.state.isInPit) {
        banner.classList.add('hidden');
        return;
    }
    
    if (myIdx === null) {
        banner.classList.add('hidden');
        return;
    }
    
    const nextStint = window.getNextDriverStint(myIdx);
    if (!nextStint) {
        banner.classList.add('hidden');
        return;
    }
    
    // Calculate time until next stint
    const now = window.getSyncedNow();
    const stintStart = new Date(nextStint.start).getTime();
    const msUntil = stintStart - now;
    
    if (msUntil <= 0) {
        // Stint should have started — might be running now
        banner.classList.add('hidden');
        return;
    }
    
    // Show the banner
    banner.classList.remove('hidden');
    
    const minUntil = Math.ceil(msUntil / 60000);
    const hrUntil = Math.floor(minUntil / 60);
    const minRem = minUntil % 60;
    
    let timeStr;
    if (hrUntil > 0) {
        timeStr = `${hrUntil}h ${minRem}m`;
    } else {
        timeStr = `${minUntil}m`;
    }
    
    textEl.innerText = `🏎️ ${t('nextStintIn') || 'Your next stint in'} ${timeStr}`;
    
    // Squad sleep/wake status
    if (sleepEl && window.config && window.config.useSquads) {
        const isActive = window.isDriverSquadActive(myIdx);
        if (isActive === true) {
            sleepEl.innerText = `🟢 ${t('stayAwake') || 'Stay awake'}`;
            sleepEl.style.color = '#4ade80';
        } else if (isActive === false) {
            sleepEl.innerText = `😴 ${t('sleepOk') || 'You can sleep'}`;
            sleepEl.style.color = '#9ca3af';
        } else {
            sleepEl.innerText = '';
        }
    } else if (sleepEl) {
        sleepEl.innerText = '';
    }
    
    // Fire wake-up alerts
    if (nextStint.stintNumber !== window._driverNotifState.lastAlertStint) {
        window._driverNotifState.lastAlertStint = nextStint.stintNumber;
        window._driverNotifState.alert15Fired = false;
        window._driverNotifState.alert5Fired = false;
        window._driverNotifState.wakeUpFired = false;
    }
    
    // 15-minute warning
    if (minUntil <= 15 && !window._driverNotifState.alert15Fired) {
        window._driverNotifState.alert15Fired = true;
        window._fireDriverAlert(t('wakeUpAlert') || '⏰ Wake up! Your stint is coming', 15);
    }
    
    // 5-minute warning
    if (minUntil <= 5 && !window._driverNotifState.alert5Fired) {
        window._driverNotifState.alert5Fired = true;
        window._fireDriverAlert(t('wakeUpAlert') || '⏰ Wake up! Your stint is coming', 5);
    }
};

// Fire a driver alert (sound + browser notification)
window._fireDriverAlert = function(message, minutesBefore) {
    // Play alert beep
    if (typeof window.playAlertBeep === 'function') {
        window.playAlertBeep('warning');
    }
    
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('🏎️ Strateger', { body: `${message} (${minutesBefore}min)`, icon: '/favicon.ico', tag: 'stint-alert' });
        } catch(e) {}
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
};

// ==========================================
// 📋 STRATEGY-FOLLOWING NOTIFICATIONS (HOST)
// ==========================================

// Notification state for strategy alerts
window._strategyNotifState = {
    lastNotifiedStint: 0,
    pitAlert5Fired: false,
    pitAlert2Fired: false,
    squadChangeNotified: false,
    driverChangeNotified: false
};

window.updateStrategyNotifications = function() {
    if (!window.state || !window.state.isRunning || window.state.isInPit) return;
    if (window.role === 'client') return; // Only for host
    
    const schedule = window.state.stintSchedule;
    if (!schedule || schedule.length === 0) return;
    
    const t = window.t || (k => k);
    const now = window.getSyncedNow();
    const currentStintMs = (now - window.state.stintStart) + (window.state.stintOffset || 0);
    const targetMs = window.state.targetStintMs || 0;
    const timeToTarget = targetMs - currentStintMs;
    const currentStintIdx = (window.state.globalStintNumber || 1) - 1; // 0-based
    const nextStintIdx = currentStintIdx + 1;
    
    // Reset alerts when stint changes
    if (currentStintIdx !== window._strategyNotifState.lastNotifiedStint) {
        window._strategyNotifState.lastNotifiedStint = currentStintIdx;
        window._strategyNotifState.pitAlert5Fired = false;
        window._strategyNotifState.pitAlert2Fired = false;
        window._strategyNotifState.squadChangeNotified = false;
        window._strategyNotifState.driverChangeNotified = false;
    }
    
    // No next stint in schedule? Nothing to notify about
    if (nextStintIdx >= schedule.length) return;
    
    const nextPlanned = schedule[nextStintIdx];
    const nextDriverName = nextPlanned.driverName;
    const nextSquad = nextPlanned.activeSquad;
    const currentSquad = window.state.activeSquad;
    
    // Update the strategy info banner
    const banner = document.getElementById('strategyScheduleBanner');
    if (banner) {
        const nextDriverDisplay = window.drivers[nextPlanned.driverIdx]?.name || nextDriverName;
        const stintsLeft = schedule.length - nextStintIdx;
        
        let bannerHtml = `<span class="text-gray-400 text-[10px]">${t('nextLabel') || 'Next:'}</span> `;
        bannerHtml += `<span class="text-ice font-bold text-xs">${nextDriverDisplay}</span>`;
        
        if (nextPlanned.squadModeActive && nextSquad) {
            bannerHtml += ` <span class="text-[9px] px-1 rounded bg-purple-600/30 text-purple-300">Squad ${nextSquad}</span>`;
        }
        
        // Show time to pit
        if (timeToTarget > 0) {
            const minLeft = Math.ceil(timeToTarget / 60000);
            bannerHtml += ` <span class="text-gray-500 text-[10px]">(${minLeft}m)</span>`;
        }
        
        banner.innerHTML = bannerHtml;
        banner.classList.remove('hidden');
    }
    
    // === 5 minutes before pit: notify upcoming driver ===
    if (timeToTarget > 0 && timeToTarget <= 300000 && !window._strategyNotifState.pitAlert5Fired) {
        window._strategyNotifState.pitAlert5Fired = true;
        
        const msg = `📢 ${nextDriverName} — ${t('getReady') || 'GET READY'} (5m)`;
        window._fireStrategyNotification(msg, 'info');
        
        // Squad change warning
        if (window.config.useSquads && nextSquad && nextSquad !== currentSquad) {
            const sleepMsg = `😴 Squad ${currentSquad} → ${t('sleepOk') || 'can sleep'} | 🟢 Squad ${nextSquad} → ${t('stayAwake') || 'wake up'}`;
            window._fireStrategyNotification(sleepMsg, 'warning');
            window._strategyNotifState.squadChangeNotified = true;
        }
    }
    
    // === 2 minutes before pit: urgent driver notification ===
    if (timeToTarget > 0 && timeToTarget <= 120000 && !window._strategyNotifState.pitAlert2Fired) {
        window._strategyNotifState.pitAlert2Fired = true;
        
        const msg = `🏎️ ${nextDriverName} — ${t('getReady') || 'GET READY'} (2m)`;
        window._fireStrategyNotification(msg, 'warning');
    }
    
    // === Squad sleep/wake info display (continuous) ===
    const squadInfoEl = document.getElementById('squadStatusInfo');
    if (squadInfoEl && window.config.useSquads) {
        const allLabels = window.getSquadLabelsInUse ? window.getSquadLabelsInUse() : ['A', 'B'];
        const active = window.state.activeSquad;
        const sleeping = allLabels.filter(l => l !== active);
        
        let html = `<span class="text-green-400">🟢 Squad ${active}</span>`;
        if (sleeping.length > 0) {
            html += ` <span class="text-gray-500">|</span> <span class="text-gray-400">😴 ${sleeping.join(', ')}</span>`;
        }
        
        // Show upcoming squad change if different
        if (nextSquad && nextSquad !== active && nextPlanned.squadModeActive) {
            const minLeft = Math.max(0, Math.ceil(timeToTarget / 60000));
            html += ` <span class="text-purple-400 text-[10px] ml-1">→ Squad ${nextSquad} in ${minLeft}m</span>`;
        }
        
        squadInfoEl.innerHTML = html;
        squadInfoEl.classList.remove('hidden');
    } else if (squadInfoEl) {
        squadInfoEl.classList.add('hidden');
    }
};

// Fire a strategy notification (sound + browser notification + optional toast)
window._fireStrategyNotification = function(message, type) {
    // Play beep
    if (typeof window.playAlertBeep === 'function') {
        window.playAlertBeep(type || 'info');
    }
    
    // Browser notification
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('🏁 Strateger', { 
                body: message, 
                icon: '/favicon.ico', 
                tag: 'strategy-' + Date.now(),
                requireInteraction: false
            });
        } catch(e) {}
    }
    
    // Toast notification on dashboard
    window._showStrategyToast(message);
};

// Show a temporary toast message on the race dashboard
window._showStrategyToast = function(message) {
    let container = document.getElementById('strategyToastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = 'bg-navy-800 border border-ice/50 text-white text-xs px-3 py-2 rounded-lg shadow-lg animate-flash mb-1';
    toast.innerText = message;
    container.appendChild(toast);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 8000);
};

window.updateDriverMode = function() {
    if (!window.state || !window.state.isRunning) return;
    
    const now = window.getSyncedNow();
    const t = window.t || (k => k);
    const raceMs = window.config.raceMs || (parseFloat(window.config.duration) * 3600000);
    let raceRemaining = raceMs - (now - window.state.startTime);
    // Use live timing race clock when available
    if (window.liveData && window.liveData.raceTimeLeftMs != null) {
        raceRemaining = window.liveData.raceTimeLeftMs;
    }
    const maxStintMs = (window.config.maxStint * 60000) || (60 * 60000);
    const minStintMs = (window.config.minStint * 60000) || 0;
    const targetMs = window.state.targetStintMs || maxStintMs;
    const currentStintMs = (now - window.state.stintStart) + (window.state.stintOffset || 0);

    // === Race timer (top-right, small) ===
    const timerEl = document.getElementById('driverRaceTimer');
    if (timerEl) {
        if (raceRemaining <= -1000) {
            timerEl.innerText = '🏁 FINISH';
            timerEl.style.color = '#39ff14';
        } else if (raceRemaining <= 0) {
            timerEl.innerText = '0:00:00';
            timerEl.style.color = '#39ff14';
        } else {
            timerEl.innerText = window.formatTimeHMS(Math.floor(raceRemaining / 1000) * 1000);
            timerEl.style.color = '';
        }
    }

    // === Stint timer (hero number) ===
    const stintTimerEl = document.getElementById('driverStintTimer');
    if (stintTimerEl) {
        if (window.state.isInPit) {
            // Show pit elapsed time
            const pitMs = now - (window.state.pitStart || now);
            let str = window.formatTimeHMS(Math.max(0, pitMs));
            if (str.startsWith('00:')) str = str.substring(3);
            stintTimerEl.innerText = str;
            stintTimerEl.style.color = '#f87171';
        } else {
            const stintMs = currentStintMs;
            let str = window.formatTimeHMS(Math.max(0, stintMs));
            if (str.startsWith('00:')) str = str.substring(3);
            stintTimerEl.innerText = str;
            // Color by zone
            if (stintMs > targetMs) stintTimerEl.style.color = '#ef4444';
            else if (stintMs > targetMs - (window.getEstimatedLapMs() || 60000) * 2) stintTimerEl.style.color = '#facc15';
            else stintTimerEl.style.color = '#ffffff';
        }
    }

    // === Target stint time (prominent display) ===
    const targetTimeEl = document.getElementById('driverTargetTime');
    if (targetTimeEl) {
        let tStr = window.formatTimeHMS(targetMs);
        if (tStr.startsWith('00:')) tStr = tStr.substring(3);
        targetTimeEl.innerText = tStr;
    }

    // === Delta ===
    const deltaLabel = document.getElementById('driverDelta');
    if (deltaLabel && !window.state.isInPit) {
        const diff = currentStintMs - targetMs;
        const sign = diff >= 0 ? '+' : '-';
        const abs = Math.abs(diff);
        const dm = Math.floor(abs / 60000);
        const ds = Math.floor((abs % 60000) / 1000);
        deltaLabel.innerText = `${sign}${dm}:${ds.toString().padStart(2, '0')}`;
        deltaLabel.style.color = diff > 0 ? '#ef4444' : '#4ade80';
    } else if (deltaLabel && window.state.isInPit) {
        deltaLabel.innerText = '';
    }

    // === Live timing data ===
    const lastEl = document.getElementById('driverLastLap');
    const bestEl = document.getElementById('driverBestLap');
    const posEl = document.getElementById('driverPosition');
    const posChangeEl = document.getElementById('driverPosChange');

    if (window.liveData) {
        if (lastEl && window.liveData.lastLap) {
            lastEl.innerText = window.formatLapTime ? window.formatLapTime(window.liveData.lastLap) : '--';
        }
        if (bestEl && window.liveData.stintBestLap) {
            bestEl.innerText = window.formatLapTime ? window.formatLapTime(window.liveData.stintBestLap) : '--';
        } else if (bestEl && window.liveData.bestLap) {
            bestEl.innerText = window.formatLapTime ? window.formatLapTime(window.liveData.bestLap) : '--';
        }
        if (posEl && window.liveData.position) {
            posEl.innerText = window.liveData.position;
        }
        if (posChangeEl && window.liveData.previousPosition && window.liveData.position) {
            const diff = window.liveData.previousPosition - window.liveData.position;
            if (diff > 0) { posChangeEl.innerText = `▲${diff}`; posChangeEl.className = 'driver-pos-change'; posChangeEl.style.color = '#4ade80'; }
            else if (diff < 0) { posChangeEl.innerText = `▼${Math.abs(diff)}`; posChangeEl.className = 'driver-pos-change'; posChangeEl.style.color = '#ef4444'; }
            else { posChangeEl.innerText = ''; }
        }
    }

    // === Pace Trend → background tint on the ENTIRE panel ===
    const panel = document.getElementById('driverModePanel');
    const trend = window.calculatePaceTrend();
    if (panel) {
        panel.classList.remove('driver-consistency-green', 'driver-consistency-yellow', 'driver-consistency-red');
        if (trend === 'improving') panel.classList.add('driver-consistency-green');
        else if (trend === 'stable') panel.classList.add('driver-consistency-yellow');
        else if (trend === 'declining') panel.classList.add('driver-consistency-red');
    }

    // === Progress bar ===
    const bar = document.getElementById('driverProgressBar');
    const targetLine = document.getElementById('driverTargetLine');

    if (bar) {
        const pct = Math.min(100, (currentStintMs / maxStintMs) * 100);
        bar.style.width = `${pct}%`;
        if (currentStintMs < minStintMs) bar.className = 'absolute top-0 left-0 h-full bg-gradient-to-r from-orange-600 to-yellow-500 transition-all duration-500';
        else if (currentStintMs < targetMs) bar.className = 'absolute top-0 left-0 h-full bg-gradient-to-r from-green-600 to-neon transition-all duration-500';
        else bar.className = 'absolute top-0 left-0 h-full bg-red-600 transition-all duration-500';
    }
    if (targetLine) {
        const tPct = Math.min(100, (targetMs / maxStintMs) * 100);
        targetLine.style.left = `${tPct}%`;
        targetLine.classList.remove('hidden');
    }

    // === STATUS ZONE (top half) ===
    const zone = document.getElementById('driverStatusZone');
    const emoji = document.getElementById('driverStatusEmoji');
    const msg = document.getElementById('driverStatusMsg');
    const sub = document.getElementById('driverStatusSub');
    if (!zone || !emoji || !msg || !sub) return;

    // Reset base classes
    emoji.className = 'driver-emoji';
    msg.className = 'driver-msg';
    sub.className = 'driver-sub';

    if (window.state.isInPit) {
        zone.style.background = 'linear-gradient(180deg, rgb(100,18,18) 0%, rgb(0,0,0) 100%)';
        zone.classList.remove('driver-zone-box');
        emoji.innerText = '🛑';
        msg.innerText = t('inPit');
        msg.style.color = '#f87171';
        sub.innerText = '';
    } else if (raceRemaining <= 0) {
        zone.style.background = 'linear-gradient(180deg, rgb(15,70,8) 0%, rgb(0,0,0) 100%)';
        zone.classList.remove('driver-zone-box');
        emoji.innerText = '🏁';
        emoji.className = 'driver-emoji animate-pulse';
        msg.innerText = 'FINISH';
        msg.style.color = '#39ff14';
        sub.innerText = '';
    } else if (window.state.mode === 'bad') {
        const belowMin = minStintMs > 0 && currentStintMs < minStintMs;
        if (belowMin) {
            zone.style.background = 'linear-gradient(180deg, rgb(80,60,0) 0%, rgb(0,0,0) 100%)';
            zone.classList.remove('driver-zone-box');
            emoji.innerText = '⚠️';
            msg.innerText = t('stayOnTrackUntilFurther');
            msg.style.color = '#facc15';
            sub.innerText = '';
        } else {
            zone.style.background = 'linear-gradient(180deg, rgb(130,22,22) 0%, rgb(0,0,0) 100%)';
            zone.classList.add('driver-zone-box');
            emoji.innerText = '🔴';
            emoji.className = 'driver-emoji animate-bounce';
            msg.innerText = window.getBoxMessage();
            msg.style.color = '#f87171';
            msg.className = 'driver-msg animate-pulse';
            sub.innerText = '';
        }
    } else if (window.state.mode === 'push') {
        zone.style.background = 'linear-gradient(180deg, rgb(14,65,34) 0%, rgb(0,0,0) 100%)';
        zone.classList.remove('driver-zone-box');
        emoji.innerText = '🔥';
        msg.innerText = 'PUSH!';
        msg.style.color = '#4ade80';
        sub.innerText = '';
    } else if (currentStintMs > targetMs) {
        // Over target — BOX
        zone.style.background = 'linear-gradient(180deg, rgb(110,20,20) 0%, rgb(0,0,0) 100%)';
        zone.classList.add('driver-zone-box');
        emoji.innerText = '🏁';
        emoji.className = 'driver-emoji animate-bounce';
        msg.innerText = window.getBoxMessage();
        msg.style.color = '#fde047';
        sub.innerText = '';
    } else if (currentStintMs > targetMs - (window.getEstimatedLapMs() || 60000) * 2) {
        // Approaching — 2 laps left
        zone.style.background = 'linear-gradient(180deg, rgb(55,42,0) 0%, rgb(0,0,0) 100%)';
        zone.classList.remove('driver-zone-box');
        emoji.innerText = '📢';
        msg.innerText = window.getBoxMessage();
        msg.style.color = '#fde047';
        sub.innerText = '';
    } else {
        // Normal — on track
        zone.style.background = 'linear-gradient(180deg, rgb(10,42,22) 0%, rgb(0,0,0) 100%)';
        zone.classList.remove('driver-zone-box');
        emoji.innerText = '🏎️';
        msg.innerText = t('onTrack');
        msg.style.color = '#4ade80';
        // Laps / time remaining to target
        const lapMs = window.getEstimatedLapMs();
        const timeToTarget = targetMs - currentStintMs;
        if (lapMs && lapMs > 0) {
            const lapsLeft = Math.max(0, Math.ceil(timeToTarget / lapMs));
            sub.innerText = `${lapsLeft} ${t('laps') || 'laps'} → 🏁`;
        } else {
            let tStr = window.formatTimeHMS(Math.max(0, timeToTarget));
            if (tStr.startsWith('00:')) tStr = tStr.substring(3);
            sub.innerText = `→ ${tStr}`;
        }
    }

    // === TAP HINT ===
    const tapHint = document.getElementById('driverTapHint');
    if (tapHint) {
        if (window.state.isInPit) {
            if (window.alertState.lastZone === 'go') {
                tapHint.innerText = t('tapToExit') || 'TAP TO EXIT PIT';
                tapHint.style.color = 'rgba(74,222,128,0.5)';
            } else if (window.alertState.lastZone === 'ready') {
                tapHint.innerText = t('getReady') || 'GET READY...';
                tapHint.style.color = 'rgba(250,204,21,0.4)';
            } else {
                tapHint.innerText = t('wait') || 'WAIT...';
                tapHint.style.color = 'rgba(255,255,255,0.15)';
            }
        } else {
            tapHint.innerText = t('tapToPit') || 'TAP TO ENTER PIT';
            tapHint.style.color = 'rgba(255,255,255,0.25)';
        }
    }

    // === DRIVER STINT NOTIFICATIONS ===
    if (typeof window.updateDriverStintNotifications === 'function') {
        window.updateDriverStintNotifications();
    }
};

// === PACE TREND CALCULATOR ===
window.calculatePaceTrend = function() {
    // Compare rolling average of recent laps vs earlier laps in the stint
    // Returns: 'improving' | 'stable' | 'declining' | null
    if (!window.liveData || !window.liveData.stintLapHistory) return null;
    const laps = window.liveData.stintLapHistory;
    if (laps.length < 4) return null; // Need at least 4 laps for any trend

    const windowSize = Math.min(3, Math.floor(laps.length / 2));
    const recentLaps = laps.slice(-windowSize);
    const earlierLaps = laps.slice(-(windowSize * 2), -windowSize);

    if (earlierLaps.length === 0 || recentLaps.length === 0) return null;

    const avgRecent = recentLaps.reduce((a, b) => a + b, 0) / recentLaps.length;
    const avgEarlier = earlierLaps.reduce((a, b) => a + b, 0) / earlierLaps.length;

    // Positive diff = getting slower (declining), negative = getting faster (improving)
    const diffMs = avgRecent - avgEarlier;
    const thresholdMs = 300; // 0.3s threshold for "stable"

    if (diffMs < -thresholdMs) return 'improving';
    if (diffMs > thresholdMs) return 'declining';
    return 'stable';
};

// ==========================================
// ⭐ PRO LICENSE UI
// ==========================================

window.handleActivatePro = async function() {
    const input = document.getElementById('proLicenseInput');
    const errorEl = document.getElementById('proActivateError');
    const successEl = document.getElementById('proActivateSuccess');
    if (!input) return;
    
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');
    
    const key = input.value.trim();
    const result = await window.activateProLicense(key);
    
    if (result.success) {
        successEl.innerText = result.message;
        successEl.classList.remove('hidden');
        setTimeout(() => {
            document.getElementById('proUpgradeModal').classList.add('hidden');
        }, 1500);
    } else {
        errorEl.innerText = result.message;
        errorEl.classList.remove('hidden');
    }
};

window.showProStatus = function() {
    if (!window._proUnlocked) return window.showProGate();
    const t = window.t || ((k) => k);
    if (confirm('⭐ Pro License Active\n\nAll Pro features are unlocked.\n\nClick OK to deactivate your license.')) {
        window.deactivateProLicense();
    }
};

window.updateProUI = function() {
    const banner = document.getElementById('proUpgradeBanner');
    const proBtn = document.getElementById('proStatusBtn');
    const lockLT = document.getElementById('proLockLiveTiming');
    const modal = document.getElementById('proUpgradeModal');
    
    if (window._proUnlocked) {
        // Pro active — hide all upgrade prompts
        if (banner) banner.classList.add('hidden');
        if (proBtn) { proBtn.classList.remove('hidden'); proBtn.innerHTML = '⭐ <span>PRO</span>'; }
        if (lockLT) lockLT.classList.add('hidden');
        if (modal) modal.classList.add('hidden'); // close modal if it was open during activation
    } else {
        // Free tier
        if (banner) banner.classList.remove('hidden');
        if (proBtn) proBtn.classList.add('hidden');
        if (lockLT) lockLT.classList.remove('hidden');
    }
};

// ==========================================
// 🎓 ONBOARDING TUTORIAL
// ==========================================

window._onboardStep = 0;
const ONBOARD_STEPS = [
    { emoji: '🏁', title: 'onboardTitle1', text: 'onboardDesc1' },
    { emoji: '👥', title: 'onboardTitle2', text: 'onboardDesc2' },
    { emoji: '📊', title: 'onboardTitle3', text: 'onboardDesc3' },
    { emoji: '🚀', title: 'onboardTitle4', text: 'onboardDesc4' }
];

window.startOnboarding = function() {
    if (localStorage.getItem('strateger_onboarded') === 'true') return;
    window._onboardStep = 0;
    window._renderOnboardStep();
    document.getElementById('onboardingOverlay').classList.remove('hidden');
};

window._renderOnboardStep = function() {
    const step = ONBOARD_STEPS[window._onboardStep];
    const t = window.t || ((k) => k);
    
    document.getElementById('onboardEmoji').innerText = step.emoji;
    document.getElementById('onboardTitle').innerText = t(step.title);
    document.getElementById('onboardText').innerText = t(step.text);
    
    // Update dots
    const dots = document.getElementById('onboardDots');
    if (dots) {
        dots.innerHTML = ONBOARD_STEPS.map((_, i) => 
            `<span class="w-2 h-2 rounded-full ${i === window._onboardStep ? 'bg-ice' : 'bg-gray-600'}"></span>`
        ).join('');
    }
    
    // Update button text
    const nextBtn = document.getElementById('onboardNextBtn');
    if (nextBtn) {
        const isLast = window._onboardStep === ONBOARD_STEPS.length - 1;
        nextBtn.innerText = isLast ? t('onboardDone') : t('onboardNext');
    }
};

window.nextOnboardStep = function() {
    window._onboardStep++;
    if (window._onboardStep >= ONBOARD_STEPS.length) {
        window.skipOnboarding();
        return;
    }
    window._renderOnboardStep();
};

window.skipOnboarding = function() {
    localStorage.setItem('strateger_onboarded', 'true');
    document.getElementById('onboardingOverlay').classList.add('hidden');
};

// ==========================================
// 📄 PDF / IMAGE EXPORT
// ==========================================

window.exportStrategyImage = async function() {
    if (!window.checkProFeature('pdfExport')) {
        window.showProGate('Image Export');
        return;
    }
    
    const target = document.querySelector('#previewScreen > div');
    if (!target || typeof html2canvas === 'undefined') {
        alert('Export not available. Please try again.');
        return;
    }
    
    try {
        const canvas = await html2canvas(target, {
            backgroundColor: '#020617',
            scale: 2,
            useCORS: true,
            logging: false
        });
        
        // Download as PNG
        const link = document.createElement('a');
        link.download = `strateger-strategy-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    } catch (e) {
        console.error('Image export failed:', e);
        alert('Export failed: ' + e.message);
    }
};

window.exportStrategyPdf = async function() {
    if (!window.checkProFeature('pdfExport')) {
        window.showProGate('PDF Export');
        return;
    }
    
    const target = document.querySelector('#previewScreen > div');
    if (!target || typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
        alert('PDF export not available. Please try again.');
        return;
    }
    
    const t = window.t || ((k) => k);
    const btn = event?.target?.closest?.('button');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + t('exportingPdf'); }
    
    try {
        const canvas = await html2canvas(target, {
            backgroundColor: '#020617',
            scale: 2,
            useCORS: true,
            logging: false
        });
        
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = jspdf;
        const pdf = new jsPDF({
            orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
            unit: 'px',
            format: [canvas.width, canvas.height]
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        pdf.save(`strateger-strategy-${Date.now()}.pdf`);
    } catch (e) {
        console.error('PDF export failed:', e);
        alert('PDF export failed: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-file-pdf"></i> <span class="hidden sm:inline">PDF</span>'; }
    }
};

// ==========================================
// ↩️ UNDO PIT ACTION
// ==========================================

window._undoPitSnapshot = null;
window._undoPitTimer = null;

/**
 * Save a snapshot of the current state before pit entry (called from confirmPitEntry).
 */
window._saveUndoPitSnapshot = function() {
    window._undoPitSnapshot = {
        isInPit: false,
        pitCount: window.state.pitCount - 1, // before increment
        pitStart: 0,
        stintStart: window.state.stintStart,
        stintOffset: window.state.stintOffset,
        currentDriverIdx: window.state.currentDriverIdx,
        globalStintNumber: window.state.globalStintNumber,
        consecutiveStints: window.state.consecutiveStints,
        timestamp: Date.now()
    };
    
    // Show undo toast with countdown
    window._showUndoPitToast();
};

window._showUndoPitToast = function() {
    const toast = document.getElementById('undoPitToast');
    if (!toast) return;
    
    toast.classList.remove('hidden');
    let remaining = 10;
    const countEl = document.getElementById('undoPitCountdown');
    
    if (window._undoPitTimer) clearInterval(window._undoPitTimer);
    
    window._undoPitTimer = setInterval(() => {
        remaining--;
        if (countEl) countEl.innerText = remaining + 's';
        if (remaining <= 0) {
            window._hideUndoPitToast();
        }
    }, 1000);
};

window._hideUndoPitToast = function() {
    if (window._undoPitTimer) clearInterval(window._undoPitTimer);
    window._undoPitTimer = null;
    window._undoPitSnapshot = null;
    const toast = document.getElementById('undoPitToast');
    if (toast) toast.classList.add('hidden');
};

window.executeUndoPit = function() {
    const snap = window._undoPitSnapshot;
    if (!snap) return;
    
    // Restore state
    if (window.pitInterval) clearInterval(window.pitInterval);
    
    window.state.isInPit = snap.isInPit;
    window.state.pitCount = snap.pitCount;
    window.state.pitStart = snap.pitStart;
    window.state.stintStart = snap.stintStart;
    window.state.stintOffset = snap.stintOffset;
    window.state.currentDriverIdx = snap.currentDriverIdx;
    window.state.globalStintNumber = snap.globalStintNumber;
    window.state.consecutiveStints = snap.consecutiveStints;
    window.state.pendingPitEntry = false;
    
    // Close pit modal
    const modal = document.getElementById('pitModal');
    if (modal) modal.classList.add('hidden');
    
    // Reset pit adjustment
    if (typeof window.adjustPitTime === 'function' && window.currentPitAdjustment !== 0) {
        window.adjustPitTime(-window.currentPitAdjustment);
    }
    
    window._hideUndoPitToast();
    
    if (typeof window.broadcast === 'function') window.broadcast();
    if (typeof window.renderFrame === 'function') window.renderFrame();
    if (typeof window.saveRaceState === 'function') window.saveRaceState();
    
    console.log('↩️ Pit entry undone');
};
