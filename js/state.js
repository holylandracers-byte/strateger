// ==========================================
// 🌍 GLOBAL STATE & CONFIGURATION
// ==========================================

window.peer = null;
window.conn = null;
window.connections = [];
window.myId = null;
window.role = null;

// ==========================================
// ⭐ PRO LICENSE SYSTEM
// ==========================================
window._proUnlocked = false;
window._proLicenseKey = null;

// Generate/restore a unique device ID for license tracking
window.getDeviceId = function() {
    let id = localStorage.getItem('strateger_device_id');
    if (!id) {
        id = 'DEV-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('strateger_device_id', id);
    }
    return id;
};

// Free-tier limits
window.FREE_LIMITS = {
    maxDrivers: 3,
    maxViewers: 1,
    maxCloudSaves: 3,
    maxThemes: 5,        // first 5 themes only
    liveTiming: false,
    aiStrategy: false,
    squads: false,
    kartTracking: false,
    pdfExport: false,
    fuelTracking: false,
    googleCalendar: false,
    googleEmail: false
};

// Restore Pro license from localStorage on load
(function() {
    const savedKey = localStorage.getItem('strateger_pro_license');
    const savedValid = localStorage.getItem('strateger_pro_valid');
    if (savedKey && savedValid === 'true') {
        window._proUnlocked = true;
        window._proLicenseKey = savedKey;
        
        // Silent re-validation against server (don't block load)
        setTimeout(() => {
            const deviceId = window.getDeviceId();
            fetch(window.APP_CONFIG.API_BASE + '/.netlify/functions/verify-license', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: savedKey, deviceId })
            })
            .then(r => r.json())
            .then(data => {
                if (!data.valid) {
                    console.warn('⚠️ Cached Pro license is no longer valid — deactivating');
                    window.deactivateProLicense();
                }
            })
            .catch(() => { /* offline — keep cached state */ });
        }, 3000);
    }
})();

/**
 * Check if a Pro feature is available. Returns true if Pro or if the feature is free.
 */
window.checkProFeature = function(featureName) {
    if (window._proUnlocked) return true;
    // Free features are things NOT in the limits or explicitly allowed
    if (featureName === 'liveTiming') return window.FREE_LIMITS.liveTiming;
    if (featureName === 'aiStrategy') return window.FREE_LIMITS.aiStrategy;
    if (featureName === 'squads') return window.FREE_LIMITS.squads;
    if (featureName === 'kartTracking') return window.FREE_LIMITS.kartTracking;
    if (featureName === 'pdfExport') return window.FREE_LIMITS.pdfExport;
    if (featureName === 'fuelTracking') return window.FREE_LIMITS.fuelTracking;
    if (featureName === 'googleCalendar') return window.FREE_LIMITS.googleCalendar;
    if (featureName === 'googleEmail') return window.FREE_LIMITS.googleEmail;
    return true; // default: free
};

/**
 * Show Pro upgrade prompt when user tries to access a locked feature.
 */
window.showProGate = function(featureName) {
    // If already Pro, never show the upgrade modal
    if (window._proUnlocked) return;
    const t = window.t || ((k) => k);
    const modal = document.getElementById('proUpgradeModal');
    if (modal) {
        const featureLabel = document.getElementById('proGateFeature');
        if (featureLabel) featureLabel.innerText = featureName || t('proFeature');
        modal.classList.remove('hidden');
    }
};

/**
 * Activate a Pro license key — validates against the server, then persists locally.
 * If user is logged in with Google, binds the license to their email for cross-device restore.
 */
window.activateProLicense = async function(key) {
    if (!key || key.length < 16 || !key.startsWith('STRAT-')) {
        return { success: false, message: 'Invalid license key format' };
    }
    
    // Get Google email if logged in, and device ID
    const savedUser = localStorage.getItem('strateger_google_user');
    let googleEmail = '';
    if (savedUser) {
        try { googleEmail = JSON.parse(savedUser).email || ''; } catch(e) {}
    }
    const deviceId = window.getDeviceId();

    try {
        const apiBase = (window.APP_CONFIG?.API_BASE || '').replace(/\/$/, '');
        const verifyUrl = apiBase ? `${apiBase}/verify-license` : '/verify-license';
        const res = await fetch(verifyUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                key, 
                email: googleEmail, 
                bindEmail: !!googleEmail,
                deviceId 
            })
        });
        const data = await res.json();
        
        if (!data.valid) {
            return { success: false, message: data.message || 'Invalid license key' };
        }
    } catch (err) {
        console.error('License verification failed:', err);
        return { success: false, message: 'Could not reach license server. Try again.' };
    }
    
    window._proUnlocked = true;
    window._proLicenseKey = key;
    localStorage.setItem('strateger_pro_license', key);
    localStorage.setItem('strateger_pro_valid', 'true');
    
    // Cache email binding for offline restore on other devices
    if (googleEmail) {
        localStorage.setItem('strateger_pro_email', googleEmail.toLowerCase());
    }
    
    // Update UI
    if (typeof window.updateProUI === 'function') window.updateProUI();
    
    return { success: true, message: '⭐ Pro unlocked!' };
};

window.deactivateProLicense = function() {
    window._proUnlocked = false;
    window._proLicenseKey = null;
    localStorage.removeItem('strateger_pro_license');
    localStorage.removeItem('strateger_pro_valid');
    localStorage.removeItem('strateger_pro_email');
    if (typeof window.updateProUI === 'function') window.updateProUI();
};

// ==========================================
// 🔊 SOUND SYSTEM
// ==========================================
window._soundMuted = localStorage.getItem('strateger_muted') === 'true';

/**
 * Play a sound only if not muted.
 */
window.playSound = function(soundFn) {
    if (window._soundMuted) return;
    try { soundFn(); } catch(e) { /* ignore audio errors */ }
};

window.toggleMute = function() {
    window._soundMuted = !window._soundMuted;
    localStorage.setItem('strateger_muted', window._soundMuted);
    const btn = document.getElementById('muteToggleBtn');
    if (btn) {
        btn.innerHTML = window._soundMuted 
            ? '<i class="fas fa-volume-mute"></i>' 
            : '<i class="fas fa-volume-up"></i>';
        btn.title = window._soundMuted ? 'Unmute' : 'Mute';
    }
};

window.config = {}; 
window.drivers = []; 
window.savedHostConfig = null;

window.raceInterval = null;
window.pitInterval = null;
window.liveTimingInterval = null;

window.RACE_STATE_KEY = 'strateger_race_state';
window.DRAFT_CONFIG_KEY = 'strateger_draft_config';

window.liveTimingManager = null;
window.syncedTimes = null;

window.state = { 
    isRunning: false, 
    mode: 'normal', 
    trackCondition: 'dry',
    isRain: false,
    isNightMode: false,
    currentDriverIdx: 0, 
    pitCount: 0, 
    startTime: 0, 
    stintStart: 0, 
    pitStart: 0, 
    isInPit: false, 
    stintOffset: 0, 
    activeSquad: 0, 
    nextDriverIdx: 0, 
    targetStintMs: 0, 
    numSquads: 0,
    pendingPitEntry: false,
    globalStintNumber: 1,
    raceSaved: false,
    stintTargets: [],
    stintSchedule: [],
    consecutiveStints: 1
};

window.liveTimingConfig = { url: '', enabled: false, demoMode: false };
window.searchConfig = { teamName: '', driverName: '', kartNumber: '' };
window.liveData = { position: null, previousPosition: null, lastLap: null, bestLap: null, laps: null, gapToLeader: null, competitors: [], raceTimeLeftMs: null, ourTeamInPit: null, ourTeamPitCount: null, stintLapHistory: [], stintBestLap: null, lastRecordedLap: null };
window.demoState = { competitors: [], updateInterval: null };

// Alert state tracking — prevents re-firing same alerts every frame
window.alertState = {
    lastZone: 'green',        // green | yellow | red | over
    lastMode: 'normal',       // normal | push | bad
    boxAlertFired: false,     // "BOX THIS LAP" already shown
    overTargetFired: false,   // over-target beep already played
    driverModeActive: false,  // driver HUD mode
    estimatedLapMs: null,     // estimated lap time from live data
    lastDriverNotification: null // last notification sent to driver
};

window.cachedStrategy = null;
window.previewData = null;

// ==========================================
// 🌐 INTERNATIONALIZATION (I18N)
// ==========================================
window.currentLang = 'en';

window.translations = {
    en: {
        ltSearchType: "Filter By:", ltTeam: "Team", ltDriver: "Driver", ltKart: "Kart #", ltPlaceholder: "Enter search value...",
        previewTitle: "Strategy Preview", addToCalendar: "Add to Google Calendar", timeline: "Timeline", driverSchedule: "Driver Schedule", totalTime: "Total Time", close: "Close",
        googleLogin: "Login with Google", eventCreated: "Event created successfully!", eventError: "Failed to create event", raceEventTitle: "Endurance Race (Streger)",
        errImpossible: "Impossible Strategy!", errAvgHigh: "Avg stint > Max Stint. Increase Stops or Max Stint.", errAvgLow: "Avg stint < Min Stint. Decrease Stops or Min Stint.",
        appTitle: "Streger", appSubtitle: "Endurance Race Strategy Manager", generalInfo: "General Info", advancedConstraints: "Advanced Constraints", driverConfig: "Drivers", aiTitle: "AI Strategy",
        lblDuration: "Duration (Hours)", lblStops: "Req. Stops", lblMinStint: "Min Stint (min)", lblMaxStint: "Max Stint (min)", lblPitTime: "Pit Time (sec)", lblPitClosedStart: "🚫 Closed Start (min)", lblPitClosedEnd: "🚫 Closed End (min)",
        lblMinDrive: "Min Driver Total (min)", lblMaxDrive: "Max Driver Total (min)", lblBuffer: "Pit Alert / Buffer (s)", lblDoubles: "Allow Doubles", lblSquads: "Use Squads", lblFuel: "Fuel", lblFuelTank: "Fuel Tank (min)",
        addDriver: "+ Add", generateStrategy: "Generate Strategy (AI)", previewStrategy: "Preview Strategy", startRace: "Start Race", loadSaved: "Load Saved Race",
        raceTime: "RACE TIME", stops: "STOPS", live: "LIVE", stop: "Stop", pos: "POS", last: "LAST", best: "BEST", targetStint: "TARGET STINT", buildTime: "BUILD TIME",
        current: "CURRENT", stintTime: "STINT TIME", nextDriver: "Next Driver", penalty: "Penalty", enterPit: "ENTER PIT", push: "PUSH", problem: "PROBLEM",
        resetMode: "Reset Mode", nightMode: "NIGHT MODE", dry: "Dry", wet: "Rain", drying: "Drying", boxNow: "BOX NOW!", stayOnTrackUntilFurther: "Stay on track until further notice", pushMode: "PUSH MODE ACTIVE",
        squadSleeping: "SQUAD SLEEPING", squadWakeUp: "WAKE SQUAD", finalLap: "Final Lap", calculating: "Calculating...", manualInput: "Manual Input",
        saveStratTitle: "Save Strategy", libTitle: "Strategy Library", aiPlaceholder: "e.g. 'Driver 1 is fast but tires wear out...'",
        thStart: "Start", thEnd: "End", thType: "Type", thDriver: "Driver", thDuration: "Duration",
        liveTiming: "Live Timing", liveTimingUrl: "Live Timing URL...", connectLive: "Connect", disconnectLive: "Disconnect", searchTeam: "Search team...", searchDriver: "Search driver...", searchKart: "Search kart #...", demoMode: "Demo Mode",
        sendEmail: "Send", cancel: "Cancel", create: "Create", save: "Save", load: "Load", delete: "Delete",
        activeRaceFound: "Active Race Found", continueRace: "Continue Race", discardRace: "Discard",
        areYouSure: "Are you sure?", deleteWarning: "This will delete the active race data permanently.", yesDelete: "Yes, Delete", noKeep: "No, Keep",
        invite: "Invite", synced: "Synced",
        chatTitle: "Race Chat / Q&A", enterName: "Enter your name to chat", startChat: "Start Chatting", typeMessage: "Type a suggestion...", send: "Send", viewer: "Viewer", host: "HOST", suggestion: "Suggestion",
        strategyOutlook: "STRATEGY OUTLOOK",
        timeLeft: "TIME LEFT",
        penalty: "PENALTY",
        enterPit: "ENTER PIT",
        nextDriverLabel: "NEXT DRIVER",
        totalHeader: "TOTAL",
        stopsHeader: "STINTS",
        driverHeader: "DRIVER",
        
        // === New Strategy Terms ===
        stintsLeft: "STINTS LEFT", // כותרת חדשה
        future: "FUTURE", // כותרת חדשה
        max: "MAX",
        min: "MIN",
        rest: "REST",
        buffer: "Buffer",
        impossible: "IMPOSSIBLE",
        addStop: "ADD STOP",
        avg: "AVG",
        finalLap: "FINAL LAP",
        inPit: "IN PIT",
        nextLabel: "Next",
        shortStintMsg: "⚠️ SHORT STINT! Penalty Risk",
        cancelEntry: "Cancel Entry",
        notifyDriver: "📢 Notify Driver",
        driverNotified: "✓ Driver Notified",
        includesAdj: "Includes adjustment:",
        missingSeconds: "Missing",
        proceedToPit: "Proceed to Pit?",
        wait: "WAIT...",
        getReady: "GET READY",
        go: "GO! GO! GO!",
        goOutIn: "GO OUT IN",
        exitPits: "Exit Pits",
        driverExitedEarly: "Driver exited early",
        driverExitedEarlyNotice: "Driver exited the pit before required time — confirm to accept.",
        driverExitedEarlyNotice: "Driver exited the pit before required time — confirm to accept.",
        orangeZone: "⚠️ Orange zone - NOTIFY only",
        targetLabel: "TARGET",
        driverLink: "Driver Link",
        tapToPit: "TAP TO ENTER PIT",
        tapToExit: "TAP TO EXIT PIT",
        pitsConfirm: "PITS?",
        tapAgainConfirm: "TAP AGAIN TO CONFIRM",
        stintBest: "S.BEST",
        googleLoginBtn: "Login",
        testBtn: "Test",
        demoBtn: "Demo",
        demoRace: "Demo",
        countdownPrefix: "Race starts in",
        countdownGo: "RACE TIME! Start now!",
        countdownAlert: "⏰ Race starts in {min} minutes!",
        autoStarting: "Auto-starting race...",
        lblAutoStart: "Auto-start at race time",
        lblDoublesHint: "Same driver back-to-back",
        lblSquadsHint: "Rotate driver groups for night shifts & long races", lblSquadsHintActive: "Drivers split into {n} rotating groups",
        lblFuelHint: "Smart fuel stint constraints & tank management",
        statusHeader: "Status",
        onTrack: "On Track",
        inPits: "In Pits",
        squadSwitch: "Switch Squad",
        viewerApprovalRequest: "Requesting to join",
        approveViewer: "Approve",
        rejectViewer: "Reject",
        removeViewer: "Remove",
        approvalPending: "Approval Pending",
        approvalRejected: "Your request was rejected by the host",
        bugReport: "Report Bug",
        featureSuggestion: "Suggest Feature",
        bugReportTitle: "Bug Report",
        featureSuggestionTitle: "Feature Suggestion",
        describeIssue: "Describe the issue or suggestion...",
        send: "Send",
        feedbackTitle: "Feedback",
        contactUs: "Contact Us",
        goodPace: "Good Pace",
        lblStartTime: "🕐 Race Start Time", lblStartDate: "📅 Race Date",
        lblSquadSchedule: "🔄 Squad Window", lblSquadScheduleHint: "Outside this window all drivers share equally. Inside, squads rotate evenly.",
        lblSquadWindowStart: "Window Start", lblSquadWindowEnd: "Window End",
        squadOff: "Off", squad2: "2 Squads", squad3: "3 Squads", squad4: "4 Squads",
        lblAppearance: "🎨 Appearance", lblPageBg: "Page Background", lblColorThemes: "Color Themes",
        laps: "LAPS", gap: "GAP", totalCompetitors: "CARS", waitingData: "Waiting for data...", leaderLabel: "LEADER",
        boxThisLap: "🏁 BOX THIS LAP", boxNextLap: "📢 BOX NEXT LAP", stayOut: "STAY OUT", onTrack: "ON TRACK", inPit: "IN PIT",
        driverEntryHint: "Enter the race ID to connect", driverEntryLabel: "Race ID", driverConnect: "Connect as Driver", driverIdTooShort: "ID is too short", joinAsDriver: "Join as Driver", backToSetup: "← Back to Setup",
        nextStintIn: "Your next stint in", stayAwake: "Stay awake", sleepOk: "You can sleep", yourStints: "Your Stints", noStintsFound: "No stints found for you", wakeUpAlert: "⏰ Wake up! Your stint is coming",
        viewerNameHint: "Enter your name to join the race", viewerNameLabel: "Your Name", requestToJoin: "Request to Join", waitingForApproval: "Waiting for host approval...", waitingForApprovalHint: "The race admin will approve your request", viewerNameTooShort: "Name must be at least 2 characters",
        // Pro & New Features
        proFeature: "Pro Feature", proUpgradeTitle: "⭐ Upgrade to Pro", proUpgradeMsg: "Unlock Live Timing, AI Strategy, Squads, unlimited drivers & themes, and more!", proActivate: "Activate License", proDeactivate: "Deactivate", proEnterKey: "Enter license key...", proInvalidKey: "Invalid license key", proActivated: "⭐ Pro Activated!", proBadge: "PRO", proRequired: "requires Pro", proHaveCoupon: "🎟️ Have a coupon code?", proApplyCoupon: "Apply",
        undoPit: "Undo Pit", undoPitToast: "Pit entry undone", undoCountdown: "Undo",
        exportPdf: "Export PDF", exportImage: "Share as Image", exportingPdf: "Generating PDF...",
        onboardTitle1: "Welcome to Streger!", onboardDesc1: "Your pit strategy assistant for endurance karting. Set up your first race in 3 easy steps.",
        onboardTitle2: "Set Up Your Race", onboardDesc2: "Enter race duration, required pit stops & min/max stint times at the top. Then add your drivers below — pick a starter and assign squads if you have night shifts.",
        onboardTitle3: "Preview & Fine-Tune", onboardDesc3: "Tap 'Preview Strategy' to see your full stint timeline. Drag stints to reorder, adjust durations, or save your plan to the cloud for later.",
        onboardTitle4: "Go Race!", onboardDesc4: "Hit 'Start Race' and the live dashboard takes over — track stint timers, get pit-window alerts, share a live link with your team, and manage driver swaps in real time.",
        onboardSkip: "Skip", onboardNext: "Next", onboardDone: "Let's Go!",
        soundMute: "Mute", soundUnmute: "Unmute",
        aiOptimize: "AI Optimize Strategy",
        raceFinished: "RACE FINISHED", totalPitTime: "Pit Time", raceStart: "Start", pitLog: "Pit Stop Log", drove: "Drove", pitNoun: "Pit", driveNoun: "Drive", stints: "Stints", avgStint: "Avg",
        demoSelectFeatures: "Select Pro features to test", demoLiveTimingDesc: "Simulated 20-team leaderboard", demoRainLabel: "Rain Simulation", demoRainDesc: "Random rain events with pace changes", demoPenaltyDesc: "Random penalties & time additions", demoTiresLabel: "Tire Degradation", demoTiresDesc: "Lap times increase over stint", demoSquadsLabel: "Squads", demoSquadsDesc: "Driver groups with rotation", demoFuelLabel: "Fuel Management", demoFuelDesc: "Track fuel level & pit for refueling",
        unitMin: "m", unitHour: "h",
    },
    he: {
        ltSearchType: "סנן לפי:", ltTeam: "קבוצה", ltDriver: "נהג", ltKart: "מספר קארט", ltPlaceholder: "הכנס ערך לחיפוש...",
        previewTitle: "תצוגה מקדימה", addToCalendar: "הוסף ליומן גוגל", timeline: "ציר זמן", driverSchedule: "לוח זמנים לנהגים", totalTime: "זמן כולל", close: "סגור",
        googleLogin: "התחבר עם Google", eventCreated: "האירוע נוצר בהצלחה!", eventError: "שגיאה ביצירת האירוע", raceEventTitle: "מירוץ סיבולת (Streger)",
        errImpossible: "אסטרטגיה לא אפשרית!", errAvgHigh: "ממוצע סטינט גבוה מהמקסימום. הוסף עצירות או הגדל מקסימום.", errAvgLow: "ממוצע סטינט נמוך מהמינימום. הפחת עצירות או הקטן מינימום.",
        appTitle: "Streger", appSubtitle: "ניהול אסטרטגיה למירוצי סיבולת", generalInfo: "הגדרות כלליות", advancedConstraints: "אילוצים מתקדמים", driverConfig: "נהגים", aiTitle: "אסטרטגיה חכמה (AI)",
        lblDuration: "משך (שעות)", lblStops: "עצירות חובה", lblMinStint: "מינימום סטינט (דק')", lblMaxStint: "מקסימום סטינט (דק')", lblPitTime: "זמן פיטס (שניות)", lblPitClosedStart: "🚫 סגור בהתחלה (דק')", lblPitClosedEnd: "🚫 סגור בסוף (דק')",
        lblMinDrive: "מינימום לנהג (דק')", lblMaxDrive: "מקסימום לנהג (דק')", lblBuffer: "התראה מראש (שניות)", lblDoubles: "אפשר דאבל סטינט", lblSquads: "שימוש בחוליות", lblFuel: "דלק", lblFuelTank: "מיכל דלק (דק')",
        addDriver: "+ הוסף", generateStrategy: "צור אסטרטגיה (AI)", previewStrategy: "תצוגה מקדימה", startRace: "התחל מירוץ", loadSaved: "טען מירוץ",
        raceTime: "זמן מירוץ", stops: "עצירות", live: "חי", stop: "עצור", pos: "מיקום", last: "אחרון", best: "הטוב", targetStint: "יעד סטינט", buildTime: "צבור זמן",
        current: "נוכחי", stintTime: "זמן סטינט", nextDriver: "נהג הבא", penalty: "עונש", enterPit: "כניסה לפיטס", push: "קצב", problem: "תקלה",
        resetMode: "איפוס מצב", nightMode: "מצב לילה", dry: "יבש", wet: "גשם", drying: "מתייבש", boxNow: "היכנס עכשיו!", stayOnTrackUntilFurther: "הישאר במסלול עד הוראה חדשה", pushMode: "מצב PUSH פעיל",
        squadSleeping: "חוליה ישנה", squadWakeUp: "העיר חוליה", finalLap: "הקפה אחרונה", calculating: "מחשב...", manualInput: "הזנה ידנית",
        saveStratTitle: "שמור אסטרטגיה", libTitle: "ספרייה", aiPlaceholder: "לדוגמה: 'נהג 1 מהיר אבל...'",
        thStart: "התחלה", thEnd: "סיום", thType: "סוג", thDriver: "נהג", thDuration: "משך",
        liveTiming: "תזמון חי", liveTimingUrl: "כתובת Live Timing...", connectLive: "התחבר", disconnectLive: "התנתק", searchTeam: "חפש קבוצה...", searchDriver: "חפש נהג...", searchKart: "חפש קארט #...", demoMode: "מצב דמו",
        sendEmail: "שלח", cancel: "ביטול", create: "צור", save: "שמור", load: "טען", delete: "מחק",
        activeRaceFound: "נמצא מירוץ פעיל", continueRace: "המשך מירוץ", discardRace: "מחק",
        areYouSure: "האם אתה בטוח?", deleteWarning: "פעולה זו תמחק את נתוני המירוץ לצמיתות.", yesDelete: "כן, מחק", noKeep: "לא, שמור",
        invite: "הזמן", synced: "מסונכרן",
        chatTitle: "צ'אט מירוץ / הצעות", enterName: "הכנס שם כדי להשתתף", startChat: "התחל", typeMessage: "כתוב הצעה לאסטרטגיה...", send: "שלח", viewer: "צופה", host: "מנהל", suggestion: "הצעה",
        strategyOutlook: "תחזית אסטרטגיה",
        timeLeft: "זמן נותר",
        penalty: "עונש",
        enterPit: "כניסה לפיטס",
        nextDriverLabel: "נהג הבא",
        totalHeader: "סה\"כ",
        stopsHeader: "סטינטים",
        driverHeader: "נהג",
        
        stintsLeft: "סטינטים נותרים",
        future: "עתיד",
        max: "מקס",
        min: "מין",
        rest: "יתר",
        buffer: "מרווח",
        impossible: "בלתי אפשרי",
        addStop: "הוסף עצירה",
        avg: "ממוצע",
        finalLap: "הקפה אחרונה",
        inPit: "בפיטס",
        nextLabel: "הנהג הבא",
        shortStintMsg: "⚠️ סטינט קצר! סכנת עונש",
        cancelEntry: "בטל כניסה",
        notifyDriver: "📢 הודע לנהג",
        driverNotified: "✓ נהג עודכן",
        includesAdj: "כולל התאמה של:",
        missingSeconds: "חסר",
        proceedToPit: "להמשיך לפיטס?",
        wait: "המתן...",
        getReady: "היכון...",
        go: "סע! סע! סע!",
        goOutIn: "צא בעוד",
        exitPits: "Exit Pits",
        driverExitedEarly: "הנהג יצא מוקדם",
        driverExitedEarlyNotice: "הנהג יצא מהפיט לפני הזמן הנדרש – אשר כדי להתקבל.",
        orangeZone: "⚠️ אזור כתום - הודע לנהג בלבד",
        targetLabel: "יעד",
        driverLink: "קישור נהג",
        tapToPit: "לחץ לכניסה לפיטס",
        tapToExit: "לחץ ליציאה מהפיטס",
        pitsConfirm: "פיטס?",
        tapAgainConfirm: "לחץ שוב לאישור",
        stintBest: "מיטב סטינט",
        googleLoginBtn: "כניסה",
        testBtn: "בדיקה",
        demoBtn: "דמו",
        demoRace: "דמו",
        countdownPrefix: "המירוץ מתחיל בעוד",
        countdownGo: "הגיע הזמן! התחל עכשיו!",
        countdownAlert: "⏰ המירוץ מתחיל בעוד {min} דקות!",
        autoStarting: "מתחיל מירוץ אוטומטית...",
        lblAutoStart: "התחלה אוטומטית בזמן המירוץ",
        lblDoublesHint: "אותו נהג שוב",
        lblSquadsHint: "סיבוב חוליות נהגים למשמרות לילה ומירוצים ארוכים", lblSquadsHintActive: "הנהגים מחולקים ל-{n} חוליות מתחלפות",
        lblFuelHint: "אילוצי דלק חכמים וניהול מיכל",
        statusHeader: "מצב",
        onTrack: "במסלול",
        inPits: "בפיטס",
        squadSwitch: "צהלי חולייה",
        viewerApprovalRequest: "מבקש להתחבר",
        approveViewer: "אשר",
        rejectViewer: "דחוי",
        removeViewer: "הסר",
        approvalPending: "המתנת לאשר",
        approvalRejected: "הבקשה שלך נדחתה על ידי המנהל",
        bugReport: "דווח על באג",
        featureSuggestion: "הצע תכונה",
        bugReportTitle: "דוח באג",
        featureSuggestionTitle: "הצעת תכונה",
        describeIssue: "תאר את הבעיה או ההצעה...",
        send: "שלח",
        feedbackTitle: "משוב",
        contactUs: "צור קשר",
        goodPace: "קצב טוב",
        lblStartTime: "🕐 שעת התחלה", lblStartDate: "📅 תאריך מירוץ",
        lblSquadSchedule: "🔄 חלון חוליות", lblSquadScheduleHint: "מחוץ לחלון כל הנהגים מתחלקים שווה. בתוך החלון, חוליות מתחלפות בחלוקה שווה.",
        lblSquadWindowStart: "תחילת חלון", lblSquadWindowEnd: "סוף חלון",
        squadOff: "כבוי", squad2: "2 חוליות", squad3: "3 חוליות", squad4: "4 חוליות",
        lblAppearance: "🎨 מראה", lblPageBg: "רקע עמוד", lblColorThemes: "ערכות נושא צבע",
        laps: "הקפות", gap: "פער", totalCompetitors: "מכוניות", waitingData: "ממתין לנתונים...", leaderLabel: "מוביל",
        boxThisLap: "🏁 היכנס להקפה הזו", boxNextLap: "📢 היכנס בהקפה הבאה", stayOut: "הישאר בחוץ", onTrack: "על המסלול", inPit: "בפיטס",
        driverEntryHint: "הזן את קוד המירוץ להתחברות", driverEntryLabel: "קוד מירוץ", driverConnect: "התחבר כנהג", driverIdTooShort: "הקוד קצר מדי", joinAsDriver: "הצטרף כנהג", backToSetup: "← חזרה להגדרות",
        nextStintIn: "הסטינט הבא שלך בעוד", stayAwake: "הישאר ער", sleepOk: "אפשר לישון", yourStints: "הסטינטים שלך", noStintsFound: "לא נמצאו סטינטים עבורך", wakeUpAlert: "⏰ התעורר! הסטינט שלך מתקרב",
        viewerNameHint: "הכנס את שמך כדי להצטרף למירוץ", viewerNameLabel: "השם שלך", requestToJoin: "בקש להצטרף", waitingForApproval: "ממתין לאישור מנהל...", waitingForApprovalHint: "מנהל המירוץ יאשר את בקשתך", viewerNameTooShort: "השם חייב להכיל לפחות 2 תווים",
        proFeature: "תכונת Pro", proUpgradeTitle: "⭐ שדרג ל-Pro", proUpgradeMsg: "שחרר תזמון חי, אסטרטגיית AI, חוליות, נהגים וערכות נושא ללא הגבלה, ועוד!", proActivate: "הפעל רישיון", proDeactivate: "בטל", proEnterKey: "הכנס מפתח רישיון...", proInvalidKey: "מפתח רישיון לא תקין", proActivated: "⭐ Pro הופעל!", proBadge: "PRO", proRequired: "דרוש Pro", proHaveCoupon: "🎟️ יש לך קוד קופון?", proApplyCoupon: "החל",
        onboardTitle1: "ברוכים הבאים ל-Streger!", onboardDesc1: "העוזר האישי שלך לאסטרטגיית פיטים במירוצי סיבולת. הגדר את המירוץ הראשון שלך ב-3 צעדים פשוטים.",
        onboardTitle2: "הגדר את המירוץ", onboardDesc2: "הזן משך מירוץ, עצירות פיט נדרשות וזמני סטינט מינימום/מקסימום למעלה. אחר כך הוסף נהגים — בחר מתניע והקצה חוליות אם יש לך משמרות לילה.",
        onboardTitle3: "תצוגה מקדימה וכיוונון", onboardDesc3: "לחץ על 'תצוגה מקדימה' כדי לראות את ציר הזמן המלא. גרור סטינטים לסידור מחדש, שנה משכי זמן, או שמור את התוכנית לענן.",
        onboardTitle4: "צא למירוץ!", onboardDesc4: "לחץ 'התחל מירוץ' והדשבורד החי נכנס לפעולה — עקוב אחרי טיימרים, קבל התראות פיט, שתף קישור חי עם הצוות, ונהל החלפות נהגים בזמן אמת.",
        onboardSkip: "דלג", onboardNext: "הבא", onboardDone: "יאללה!",
        aiOptimize: "ייעול אסטרטגיה (AI)",
        raceFinished: "המירוץ נגמר", totalPitTime: "זמן פיטס", raceStart: "התחלה", pitLog: "יומן עצירות", drove: "נהג", pitNoun: "פיט", driveNoun: "נסיעה", stints: "סטינטים", avgStint: "ממוצע",
        demoSelectFeatures: "בחר תכונות Pro לבדיקה", demoLiveTimingDesc: "טבלת 20 קבוצות מדומה", demoRainLabel: "סימולציית גשם", demoRainDesc: "אירועי גשם אקראיים עם שינוי קצב", demoPenaltyDesc: "עונשים אקראיים ותוספות זמן", demoTiresLabel: "בלאי צמיגים", demoTiresDesc: "זמני הקפה עולים במהלך הסטינט", demoSquadsLabel: "חוליות", demoSquadsDesc: "קבוצות נהגים עם רוטציה", demoFuelLabel: "ניהול דלק", demoFuelDesc: "מעקב אחר דלק ועצירה לתדלוק",
        unitMin: "דק", unitHour: "ש",
        soundMute: "השתק", soundUnmute: "בטל השתקה",
        undoPit: "בטל כניסה", undoPitToast: "כניסה לפיטס בוטלה", undoCountdown: "בטל",
        exportPdf: "ייצוא PDF", exportImage: "שתף כתמונה", exportingPdf: "מייצא PDF...",
    },
    fr: {
        ltSearchType: "Filtrer par:", ltTeam: "Équipe", ltDriver: "Pilote", ltKart: "Kart n°", ltPlaceholder: "Rechercher...",
        previewTitle: "Aperçu de la Stratégie", addToCalendar: "Ajouter au Calendrier", timeline: "Chronologie", driverSchedule: "Planning Pilotes", totalTime: "Temps Total", close: "Fermer",
        googleLogin: "Connexion Google", eventCreated: "Événement créé !", eventError: "Erreur création", raceEventTitle: "Course d'Endurance",
        errImpossible: "Stratégie Impossible!", errAvgHigh: "Moyenne > Max. Ajoutez des arrêts.", errAvgLow: "Moyenne < Min. Réduisez les arrêts.",
        appSubtitle: "Gestionnaire de Stratégie", generalInfo: "Info Générale", advancedConstraints: "Contraintes Avancées", driverConfig: "Pilotes", aiTitle: "Stratégie IA",
        lblDuration: "Durée (H)", lblStops: "Arrêts Req.", lblMinStint: "Min Relais", lblMaxStint: "Max Relais", lblPitTime: "Temps Stand", lblPitClosedStart: "🚫 Fermé Début", lblPitClosedEnd: "🚫 Fermé Fin",
        lblMinDrive: "Min Total (min)", lblMaxDrive: "Max Total (min)", lblBuffer: "Alerte (s)", lblDoubles: "Doubles OK", lblSquads: "Équipes", lblFuel: "Carburant", lblFuelTank: "Réservoir (min)",
        addDriver: "+ Ajouter", generateStrategy: "Générer (IA)", previewStrategy: "Aperçu", startRace: "Démarrer", loadSaved: "Charger",
        raceTime: "TEMPS COURSE", stops: "ARRÊTS", live: "LIVE", stop: "Stop", pos: "POS", last: "DERN", best: "MEILL", targetStint: "CIBLE RELAIS", buildTime: "GÉRER TEMPS",
        current: "ACTUEL", stintTime: "TEMPS RELAIS", nextDriver: "Prochain", penalty: "Pénalité", enterPit: "ENTRER STAND", push: "ATTAQUE", problem: "PROBLÈME",
        resetMode: "Réinit.", nightMode: "MODE NUIT", dry: "Sec", wet: "Pluie", drying: "Séchant", boxNow: "BOX MAINTENANT!", stayOnTrackUntilFurther: "Restez sur la piste jusqu'à nouvel ordre", pushMode: "MODE ATTAQUE",
        squadSleeping: "ÉQUIPE DORT", squadWakeUp: "RÉVEIL ÉQUIPE", finalLap: "Dernier Tour", calculating: "Calcul...", manualInput: "Manuel",
        saveStratTitle: "Sauvegarder", libTitle: "Bibliothèque", aiPlaceholder: "ex: 'Pilote 1 préfère...'",
        thStart: "Début", thEnd: "Fin", thType: "Type", thDriver: "Pilote", thDuration: "Durée",
        liveTiming: "Chronométrage Live", liveTimingUrl: "URL Chronométrage...", connectLive: "Connecter", disconnectLive: "Déconnecter", searchTeam: "Rechercher équipe...", searchDriver: "Rechercher pilote...", searchKart: "Rechercher kart #...", demoMode: "Mode Démo",
        sendEmail: "Envoyer", cancel: "Annuler", create: "Créer", save: "Sauver", load: "Charger", delete: "Supprimer",
        activeRaceFound: "Course Active Trouvée", continueRace: "Continuer", discardRace: "Abandonner",
        areYouSure: "Êtes-vous sûr?", deleteWarning: "Ceci supprimera les données définitivement.", yesDelete: "Oui, Supprimer", noKeep: "Non, Garder",
        invite: "Inviter", synced: "Synchronisé",
        chatTitle: "Chat Course / Q&R", enterName: "Entrez votre nom", startChat: "Commencer", typeMessage: "Écrire une suggestion...", send: "Envoyer", viewer: "Spectateur", host: "HÔTE", suggestion: "Suggestion",
        strategyOutlook: "PERSPECTIVE STRATÉGIQUE",
        timeLeft: "TEMPS RESTANT",
        penalty: "PÉNALITÉ",
        enterPit: "ENTRER STAND",
        nextDriverLabel: "PROCHAIN PILOTE",
        totalHeader: "TOTAL",
        stopsHeader: "RELAIS",
        driverHeader: "PILOTE",
        
        stintsLeft: "RELAIS RESTANTS",
        future: "FUTUR",
        max: "MAX",
        min: "MIN",
        rest: "RESTE",
        buffer: "Marge",
        impossible: "IMPOSSIBLE",
        addStop: "AJOUTER ARRÊT",
        avg: "MOY",
        finalLap: "DERNIER TOUR",
        inPit: "AU STAND",
        nextLabel: "Suivant",
        shortStintMsg: "⚠️ RELAIS COURT! Risque Pénalité",
        cancelEntry: "Annuler",
        notifyDriver: "📢 Notifier Pilote",
        driverNotified: "✓ Pilote Notifié",
        includesAdj: "Inclut ajustement:",
        missingSeconds: "Manquant",
        proceedToPit: "Continuer au Stand?",
        wait: "ATTENDEZ...",
        getReady: "PRÊT...",
        go: "GO! GO! GO!",
        goOutIn: "SORTEZ DANS",
        exitPits: "Exit Pits",
        driverExitedEarly: "Le pilote est sorti tôt",
        driverExitedEarlyNotice: "Le pilote est sorti des stands avant le temps requis — confirmez pour accepter.",
        orangeZone: "⚠️ Zone orange - NOTIFIER seulement",
        targetLabel: "CIBLE",
        driverLink: "Lien pilote",
        tapToPit: "APPUYER POUR ENTRER AUX STANDS",
        tapToExit: "APPUYER POUR SORTIR DES STANDS",
        pitsConfirm: "STANDS ?",
        tapAgainConfirm: "APPUYER DE NOUVEAU POUR CONFIRMER",
        stintBest: "M.STINT",
        googleLoginBtn: "Connexion",
        testBtn: "Test",
        demoBtn: "Démo",
        demoRace: "Démo",
        countdownPrefix: "Course dans",
        countdownGo: "C'EST L'HEURE ! Démarrez !",
        countdownAlert: "⏰ Course dans {min} minutes !",
        autoStarting: "Démarrage auto...",
        lblAutoStart: "Démarrage auto à l'heure",
        lblDoublesHint: "Même pilote consécutivement",
        lblSquadsHint: "Rotation des équipes pour les relais de nuit & longues courses", lblSquadsHintActive: "Pilotes répartis en {n} groupes rotatifs",
        lblFuelHint: "Contraintes carburant & gestion du réservoir",
        statusHeader: "Statut",
        onTrack: "Sur la Piste",
        inPits: "Aux Stands",
        squadSwitch: "Basculer l'équipe",
        viewerApprovalRequest: "Demande de participation",
        approveViewer: "Approuver",
        rejectViewer: "Refuser",
        removeViewer: "Supprimer",
        approvalPending: "En attente d'approbation",
        approvalRejected: "Votre demande a été refusée par l'hôte",
        bugReport: "Signaler un Bug",
        featureSuggestion: "Suggérer une Fonctionnalité",
        bugReportTitle: "Rapport de Bug",
        featureSuggestionTitle: "Suggestion de Fonctionnalité",
        describeIssue: "Décrivez le problème ou la suggestion...",
        send: "Envoyer",
        feedbackTitle: "Retours",
        contactUs: "Nous Contacter",
        goodPace: "Bon Rythme",
        lblStartTime: "🕐 Heure de Départ", lblStartDate: "📅 Date de Course",
        lblSquadSchedule: "🔄 Fenêtre Équipes", lblSquadScheduleHint: "Hors fenêtre, tous les pilotes partagent. Dedans, les équipes tournent à parts égales.",
        lblSquadWindowStart: "Début fenêtre", lblSquadWindowEnd: "Fin fenêtre",
        squadOff: "Désactivé", squad2: "2 Équipes", squad3: "3 Équipes", squad4: "4 Équipes",
        lblAppearance: "🎨 Apparence", lblPageBg: "Fond de page", lblColorThemes: "Thèmes de couleur",
        laps: "TOURS", gap: "ÉCART", totalCompetitors: "VOITURES", waitingData: "En attente de données...",
        boxThisLap: "🏁 BOX CE TOUR", boxNextLap: "📢 BOX PROCHAIN TOUR", stayOut: "RESTEZ EN PISTE", onTrack: "EN PISTE", inPit: "AUX STANDS",
        driverEntryHint: "Entrez l'ID de course pour vous connecter", driverEntryLabel: "ID de course", driverConnect: "Se connecter comme pilote", driverIdTooShort: "L'ID est trop court", joinAsDriver: "Rejoindre en tant que pilote", backToSetup: "← Retour aux réglages",
        nextStintIn: "Votre prochain stint dans", stayAwake: "Restez éveillé", sleepOk: "Vous pouvez dormir", yourStints: "Vos Stints", noStintsFound: "Aucun stint trouvé pour vous", wakeUpAlert: "⏰ Réveillez-vous! Votre stint approche",
        viewerNameHint: "Entrez votre nom pour rejoindre la course", viewerNameLabel: "Votre Nom", requestToJoin: "Demander à rejoindre", waitingForApproval: "En attente d'approbation...", waitingForApprovalHint: "L'administrateur de la course approuvera votre demande", viewerNameTooShort: "Le nom doit contenir au moins 2 caractères",
        proFeature: "Fonction Pro", proUpgradeTitle: "⭐ Passer à Pro", proUpgradeMsg: "Débloquez le Chronométrage Live, la Stratégie IA, les Équipes, pilotes & thèmes illimités, et plus !", proActivate: "Activer la licence", proDeactivate: "Désactiver", proEnterKey: "Entrez la clé de licence...", proInvalidKey: "Clé de licence invalide", proActivated: "⭐ Pro Activé !", proBadge: "PRO", proRequired: "nécessite Pro", proHaveCoupon: "🎟️ Vous avez un code promo ?", proApplyCoupon: "Appliquer",
        onboardTitle1: "Bienvenue sur Streger !", onboardDesc1: "Votre assistant stratégie pour les courses d'endurance en karting. Configurez votre première course en 3 étapes.",
        onboardTitle2: "Configurez votre course", onboardDesc2: "Entrez la durée, les arrêts obligatoires et les temps de stint min/max en haut. Ajoutez vos pilotes en dessous — choisissez un départ et assignez des équipes pour les relais de nuit.",
        onboardTitle3: "Aperçu et ajustements", onboardDesc3: "Appuyez sur 'Aperçu' pour voir le plan complet des stints. Glissez-déposez pour réorganiser, ajustez les durées ou sauvegardez dans le cloud.",
        onboardTitle4: "En piste !", onboardDesc4: "Lancez la course et le tableau de bord prend le relais — suivez les chronos, recevez les alertes pit, partagez un lien live avec votre équipe et gérez les relais en temps réel.",
        onboardSkip: "Passer", onboardNext: "Suivant", onboardDone: "C'est parti !",
        appTitle: "Streger",
        aiOptimize: "Optimiser la stratégie IA",
        raceFinished: "COURSE TERMINÉE", totalPitTime: "Temps au stand", raceStart: "Départ", pitLog: "Journal des arrêts", drove: "Conduit", pitNoun: "Stand", driveNoun: "Conduite", stints: "Relais", avgStint: "Moy.",
        demoSelectFeatures: "Sélectionnez les fonctions Pro à tester", demoLiveTimingDesc: "Classement simulé de 20 équipes", demoRainLabel: "Simulation de pluie", demoRainDesc: "Événements de pluie avec changement de rythme", demoPenaltyDesc: "Pénalités aléatoires et ajouts de temps", demoTiresLabel: "Dégradation des pneus", demoTiresDesc: "Les temps au tour augmentent au fil du relais", demoSquadsLabel: "Équipes", demoSquadsDesc: "Groupes de pilotes avec rotation", demoFuelLabel: "Gestion du carburant", demoFuelDesc: "Suivre le carburant et ravitaillement",
        unitMin: "min", unitHour: "h",
        soundMute: "Muet", soundUnmute: "Activer le son",
        undoPit: "Annuler Pit", undoPitToast: "Entrée pit annulée", undoCountdown: "Annuler",
        exportPdf: "Exporter PDF", exportImage: "Partager en image", exportingPdf: "Génération PDF...",
    },
    pt: {
        ltSearchType: "Filtrar por:", ltTeam: "Equipe", ltDriver: "Piloto", ltKart: "Kart nº", ltPlaceholder: "Pesquisar...",
        previewTitle: "Visualização da Estratégia", addToCalendar: "Adicionar ao Calendário", timeline: "Linha do Tempo", driverSchedule: "Escala de Pilotos", totalTime: "Tempo Total", close: "Fechar",
        googleLogin: "Login Google", eventCreated: "Evento criado!", eventError: "Erro ao criar", raceEventTitle: "Corrida de Resistência",
        errImpossible: "Estratégia Impossível!", errAvgHigh: "Média > Máx. Aumente paradas.", errAvgLow: "Média < Mín. Reduza paradas.",
        appSubtitle: "Gestor de Estratégia", generalInfo: "Info Geral", advancedConstraints: "Restrições Avançadas", driverConfig: "Pilotos", aiTitle: "Estratégia IA",
        lblDuration: "Duração (H)", lblStops: "Paradas Req.", lblMinStint: "Mín Stint", lblMaxStint: "Máx Stint", lblPitTime: "Tempo Box", lblPitClosedStart: "🚫 Fechado Início", lblPitClosedEnd: "🚫 Fechado Fim",
        lblMinDrive: "Mín Total (min)", lblMaxDrive: "Máx Total (min)", lblBuffer: "Alerta (s)", lblDoubles: "Duplos OK", lblSquads: "Esquadrões", lblFuel: "Combustível", lblFuelTank: "Tanque (min)",
        addDriver: "+ Adicionar", generateStrategy: "Gerar (IA)", previewStrategy: "Visualizar", startRace: "Iniciar", loadSaved: "Carregar",
        raceTime: "TEMPO PROVA", stops: "PARADAS", live: "AO VIVO", stop: "Parar", pos: "POS", last: "ÚLT", best: "MELH", targetStint: "ALVO STINT", buildTime: "CRIAR TEMPO",
        current: "ATUAL", stintTime: "TEMPO STINT", nextDriver: "Próximo", penalty: "Penalidade", enterPit: "ENTRAR BOX", push: "PUSH", problem: "PROBLEMA",
        resetMode: "Resetar", nightMode: "MODO NOITE", dry: "Seco", wet: "Chuva", drying: "Secando", boxNow: "BOX AGORA!", stayOnTrackUntilFurther: "Permaneça na pista até nova ordem", pushMode: "MODO PUSH",
        squadSleeping: "EQUIPE DORMINDO", squadWakeUp: "ACORDAR EQUIPE", finalLap: "Volta Final", calculating: "Calculando...", manualInput: "Manual",
        saveStratTitle: "Salvar", libTitle: "Biblioteca", aiPlaceholder: "ex: 'Piloto 1 prefere...'",
        thStart: "Início", thEnd: "Fim", thType: "Tipo", thDriver: "Piloto", thDuration: "Duração",
        liveTiming: "Cronometragem Ao Vivo", liveTimingUrl: "URL Cronometragem...", connectLive: "Conectar", disconnectLive: "Desconectar", searchTeam: "Buscar equipe...", searchDriver: "Buscar piloto...", searchKart: "Buscar kart #...", demoMode: "Modo Demo",
        sendEmail: "Enviar", cancel: "Cancelar", create: "Criar", save: "Salvar", load: "Carregar", delete: "Excluir",
        activeRaceFound: "Corrida Ativa Encontrada", continueRace: "Continuar", discardRace: "Descartar",
        areYouSure: "Tem certeza?", deleteWarning: "Isso excluirá os dados permanentemente.", yesDelete: "Sim, Excluir", noKeep: "Não, Manter",
        invite: "Convidar", synced: "Sincronizado",
        chatTitle: "Chat Corrida / Q&A", enterName: "Digite seu nome", startChat: "Iniciar Chat", typeMessage: "Escreva uma sugestão...", send: "Enviar", viewer: "Espectador", host: "HOST", suggestion: "Sugestão",
        strategyOutlook: "PERSPECTIVA",
        timeLeft: "TEMPO RESTANTE",
        penalty: "PENALIDADE",
        enterPit: "ENTRAR BOX",
        nextDriverLabel: "PRÓXIMO PILOTO",
        totalHeader: "TOTAL",
        stopsHeader: "STINTS",
        driverHeader: "PILOTO",
        max: "MÁX",
        min: "MÍN",
        rest: "RESTO",
        buffer: "Margem",
        impossible: "IMPOSSÍVEL",
        avg: "MÉD",
        inPit: "NO BOX",
        nextLabel: "Próximo",
        shortStintMsg: "⚠️ STINT CURTO! Risco Penalidade",
        cancelEntry: "Cancelar",
        notifyDriver: "📢 Notificar Piloto",
        driverNotified: "✓ Piloto Notificado",
        includesAdj: "Inclui ajuste:",
        missingSeconds: "Faltando",
        proceedToPit: "Continuar ao Box?",
        wait: "AGUARDE...",
        getReady: "PREPARAR...",
        go: "VAI! VAI! VAI!",
        goOutIn: "SAIA EM",
        exitPits: "Exit Pits",
        driverExitedEarly: "O piloto saiu cedo",
        driverExitedEarlyNotice: "O piloto saiu do pit antes do tempo exigido – confirme para aceitar.",
        orangeZone: "⚠️ Zona laranja - NOTIFICAR apenas",
        targetLabel: "ALVO",
        driverLink: "Link do piloto",
        tapToPit: "TOQUE PARA ENTRAR NO BOX",
        tapToExit: "TOQUE PARA SAIR DO BOX",
        pitsConfirm: "BOX?",
        tapAgainConfirm: "TOQUE NOVAMENTE PARA CONFIRMAR",
        stintBest: "M.STINT",
        googleLoginBtn: "Conexão",
        testBtn: "Teste",
        demoBtn: "Demo",
        demoRace: "Demo",
        countdownPrefix: "Corrida começa em",
        countdownGo: "HORA DA CORRIDA! Inicie agora!",
        countdownAlert: "⏰ Corrida começa em {min} minutos!",
        autoStarting: "Iniciando automaticamente...",
        lblAutoStart: "Início automático no horário",
        lblDoublesHint: "Mesmo piloto consecutivamente",
        lblSquadsHint: "Rotação de equipes para turnos noturnos & corridas longas", lblSquadsHintActive: "Pilotos divididos em {n} grupos rotativos",
        lblFuelHint: "Restrições inteligentes de combustível & gestão do tanque",
        statusHeader: "Status",
        onTrack: "Na Pista",
        inPits: "Nos Boxes",
        squadSwitch: "Trocar Equipe",
        viewerApprovalRequest: "Solicitando participar",
        approveViewer: "Aprovar",
        rejectViewer: "Rejeitar",
        removeViewer: "Remover",
        approvalPending: "Aprovação Pendente",
        approvalRejected: "Seu pedido foi rejeitado pelo host",
        bugReport: "Relatar Bug",
        featureSuggestion: "Sugerir Recurso",
        bugReportTitle: "Relatório de Bug",
        featureSuggestionTitle: "Sugestão de Recurso",
        describeIssue: "Descreva o problema ou sugestão...",
        send: "Enviar",
        feedbackTitle: "Feedback",
        contactUs: "Contacte-nos",
        goodPace: "Bom Ritmo",
        lblStartTime: "🕐 Hora de Início", lblStartDate: "📅 Data da Corrida",
        lblSquadSchedule: "🔄 Janela de Esquadrões", lblSquadScheduleHint: "Fora da janela, todos pilotos compartilham. Dentro, esquadrões revezam igualmente.",
        lblSquadWindowStart: "Início janela", lblSquadWindowEnd: "Fim janela",
        squadOff: "Desligado", squad2: "2 Esquadrões", squad3: "3 Esquadrões", squad4: "4 Esquadrões",
        lblAppearance: "🎨 Aparência", lblPageBg: "Fundo da página", lblColorThemes: "Temas de cor",
        laps: "VOLTAS", gap: "DIFERENÇA", totalCompetitors: "CARROS", waitingData: "Aguardando dados...",
        boxThisLap: "🏁 BOX NESTA VOLTA", boxNextLap: "📢 BOX PRÓXIMA VOLTA", stayOut: "FIQUE FORA", onTrack: "NA PISTA", inPit: "NOS BOXES",
        driverEntryHint: "Digite o ID da corrida para conectar", driverEntryLabel: "ID da corrida", driverConnect: "Conectar como piloto", driverIdTooShort: "ID muito curto", joinAsDriver: "Entrar como piloto", backToSetup: "← Voltar às configurações",
        nextStintIn: "Seu próximo stint em", stayAwake: "Fique acordado", sleepOk: "Pode dormir", yourStints: "Seus Stints", noStintsFound: "Nenhum stint encontrado para você", wakeUpAlert: "⏰ Acorde! Seu stint está chegando",
        viewerNameHint: "Digite seu nome para participar da corrida", viewerNameLabel: "Seu Nome", requestToJoin: "Solicitar Entrada", waitingForApproval: "Aguardando aprovação...", waitingForApprovalHint: "O administrador da corrida aprovará sua solicitação", viewerNameTooShort: "O nome deve ter pelo menos 2 caracteres",
        proFeature: "Recurso Pro", proUpgradeTitle: "⭐ Atualizar para Pro", proUpgradeMsg: "Desbloqueie Cronometragem Ao Vivo, Estratégia IA, Esquadrões, pilotos e temas ilimitados, e mais!", proActivate: "Ativar licença", proDeactivate: "Desativar", proEnterKey: "Digite a chave de licença...", proInvalidKey: "Chave de licença inválida", proActivated: "⭐ Pro Ativado!", proBadge: "PRO", proRequired: "requer Pro", proHaveCoupon: "🎟️ Tem um código de cupom?", proApplyCoupon: "Aplicar",
        onboardTitle1: "Bem-vindo ao Streger!", onboardDesc1: "Seu assistente de estratégia de pit para corridas de endurance de kart. Configure sua primeira corrida em 3 passos simples.",
        onboardTitle2: "Configure sua corrida", onboardDesc2: "Insira duração da corrida, paradas obrigatórias e tempos de stint mín/máx no topo. Adicione seus pilotos abaixo — escolha quem larga e atribua equipes para turnos noturnos.",
        onboardTitle3: "Visualize e ajuste", onboardDesc3: "Toque em 'Visualizar Estratégia' para ver o cronograma completo. Arraste stints para reordenar, ajuste durações ou salve seu plano na nuvem.",
        onboardTitle4: "Hora da corrida!", onboardDesc4: "Aperte 'Iniciar Corrida' e o painel ao vivo assume — acompanhe cronômetros, receba alertas de pit, compartilhe um link ao vivo com a equipe e gerencie trocas de pilotos em tempo real.",
        onboardSkip: "Pular", onboardNext: "Próximo", onboardDone: "Vamos lá!",
        appTitle: "Streger",
        aiOptimize: "Otimizar Estratégia IA",
        raceFinished: "CORRIDA ENCERRADA", totalPitTime: "Tempo no Box", raceStart: "Início", pitLog: "Registo de Paragens", drove: "Dirigiu", pitNoun: "Box", driveNoun: "Condução", stints: "Stints", avgStint: "Média",
        demoSelectFeatures: "Selecione recursos Pro para testar", demoLiveTimingDesc: "Classificação simulada de 20 equipes", demoRainLabel: "Simulação de chuva", demoRainDesc: "Eventos de chuva aleatórios com mudança de ritmo", demoPenaltyDesc: "Penalidades aleatórias e adições de tempo", demoTiresLabel: "Degradação de pneus", demoTiresDesc: "Tempos de volta aumentam ao longo do stint", demoSquadsLabel: "Esquadrões", demoSquadsDesc: "Grupos de pilotos com rotação", demoFuelLabel: "Gestão de combustível", demoFuelDesc: "Acompanhar combustível e reabastecer",
        unitMin: "min", unitHour: "h",
        soundMute: "Silenciar", soundUnmute: "Ativar Som",
        undoPit: "Cancelar Box", undoPitToast: "Entrada cancelada", undoCountdown: "Cancelar",
        exportPdf: "Exportar PDF", exportImage: "Compartilhar Imagem", exportingPdf: "Gerando PDF...",
        stintsLeft: "STINTS RESTANTES", future: "FUTURO", addStop: "ADICIONAR PARADA", finalLap: "VOLTA FINAL",
    },
    ru: {
        ltSearchType: "Фильтр по:", ltTeam: "Команда", ltDriver: "Пилот", ltKart: "Карт №", ltPlaceholder: "Поиск...",
        previewTitle: "Предпросмотр стратегии", addToCalendar: "Добавить в календарь", timeline: "Хронология", driverSchedule: "Расписание", totalTime: "Общее время", close: "Закрыть",
        googleLogin: "Вход через Google", eventCreated: "Событие создано!", eventError: "Ошибка создания", raceEventTitle: "Гонка на выносливость",
        errImpossible: "Невозможная стратегия!", errAvgHigh: "Средн. > Макс. Добавьте остановок.", errAvgLow: "Средн. < Мин. Уменьшите остановок.",
        appSubtitle: "Менеджер стратегии", generalInfo: "Основная информация", advancedConstraints: "Продвинутые ограничения", driverConfig: "Пилоты", aiTitle: "ИИ стратегия",
        lblDuration: "Длительность (ч)", lblStops: "Требуемые остановки", lblMinStint: "Мин заезд", lblMaxStint: "Макс заезд", lblPitTime: "Время боксов", lblPitClosedStart: "🚫 Закрыто в начале", lblPitClosedEnd: "🚫 Закрыто в конце",
        lblMinDrive: "Мин всего (мин)", lblMaxDrive: "Макс всего (мин)", lblBuffer: "Оповещение (сек)", lblDoubles: "Разрешить дубли", lblSquads: "Использовать группы", lblFuel: "Топливо", lblFuelTank: "Бак (мин)",
        addDriver: "+ Добавить", generateStrategy: "Создать (ИИ)", previewStrategy: "Просмотр", startRace: "Начать", loadSaved: "Загрузить",
        raceTime: "ВРЕМЯ ГОНКИ", stops: "ОСТАНОВКИ", live: "LIVE", stop: "Стоп", pos: "ПОЗ", last: "ПОС", best: "ЛУЧ", targetStint: "ЦЕЛЕВОЙ ЗАЕЗД", buildTime: "СТРОИТЬ ВРЕМЯ",
        current: "ТЕКУЩ", stintTime: "ВРЕМЯ ЗАЕЗДА", nextDriver: "Следующий", penalty: "Штраф", enterPit: "ВХОД В БОХ", push: "ТОЛКАТЬ", problem: "ПРОБЛЕМА",
        resetMode: "Сброс", nightMode: "НОЧНОЙ РЕЖИМ", dry: "Сухо", wet: "Дождь", drying: "Высыхает", boxNow: "БОХ СЕЙЧАС!", stayOnTrackUntilFurther: "Оставайтесь на трассе до дальнейших указаний", pushMode: "РЕЖИМ PUSH",
        squadSleeping: "ГРУППА СПИТ", squadWakeUp: "РАЗБУДИТЬ ГРУППУ", finalLap: "Финальный круг", calculating: "Вычисление...", manualInput: "Вручную",
        saveStratTitle: "Сохранить", libTitle: "Библиотека", aiPlaceholder: "напр.: 'Пилот 1 предпочитает...'",
        thStart: "Начало", thEnd: "Конец", thType: "Тип", thDriver: "Пилот", thDuration: "Длительность",
        liveTiming: "Live Timing", liveTimingUrl: "URL Live Timing...", connectLive: "Подключить", disconnectLive: "Отключить", searchTeam: "Поиск команды...", searchDriver: "Поиск пилота...", searchKart: "Поиск карта...", demoMode: "Демо режим",
        sendEmail: "Отправить", cancel: "Отмена", create: "Создать", save: "Сохранить", load: "Загрузить", delete: "Удалить",
        activeRaceFound: "Найдена активная гонка", continueRace: "Продолжить", discardRace: "Отклонить",
        areYouSure: "Вы уверены?", deleteWarning: "Это удалит данные навсегда.", yesDelete: "Да, удалить", noKeep: "Нет, сохранить",
        invite: "Пригласить", synced: "Синхронизировано",
        chatTitle: "Чат гонки / Q&A", enterName: "Введите ваше имя", startChat: "Начать чат", typeMessage: "Напишите предложение...", send: "Отправить", viewer: "Зритель", host: "ХОСТ", suggestion: "Предложение",
        strategyOutlook: "ПЕРСПЕКТИВА СТРАТЕГИИ",
        timeLeft: "ОСТАЛОСЬ ВРЕМЕНИ",
        penalty: "ШТРАФ",
        enterPit: "ВХОД В БОХ",
        nextDriverLabel: "СЛЕДУЮЩИЙ ПИЛОТ",
        totalHeader: "ВСЕГО",
        stopsHeader: "ЗАЕЗДЫ",
        driverHeader: "ПИЛОТ",
        stintsLeft: "ЗАЕЗДОВ ОСТАЛОСЬ",
        future: "БУДУЩЕЕ",
        max: "МАКС",
        min: "МИН",
        rest: "ОТДЫХ",
        buffer: "Буфер",
        impossible: "НЕВОЗМОЖНО",
        addStop: "ДОБАВИТЬ ОСТАНОВКУ",
        avg: "СР",
        finalLap: "ФИНАЛЬНЫЙ КРУГ",
        inPit: "В БОКЕ",
        nextLabel: "Следующий",
        shortStintMsg: "⚠️ КОРОТКИЙ ЗАЕЗД! Риск штрафа",
        cancelEntry: "Отмена",
        notifyDriver: "📢 Уведомить пилота",
        driverNotified: "✓ Пилот уведомлен",
        includesAdj: "Включает корректировку:",
        missingSeconds: "Недостает",
        proceedToPit: "Продолжить в бокс?",
        wait: "ЖДИТЕ...",
        getReady: "ГОТОВЬТЕСЬ...",
        go: "ВПЕРЕД! ВПЕРЕД!",
        goOutIn: "ВЫЕЗЖАЙ ЧЕРЕЗ",
        exitPits: "Exit Pits",
        driverExitedEarly: "Пилот выехал раньше",
        driverExitedEarlyNotice: "Пилот покинул пит до требуемого времени – подтвердите для продолжения.",
        orangeZone: "⚠️ Оранжевая зона - только УВЕДОМИТЬ",
        targetLabel: "ЦЕЛЬ",
        driverLink: "Ссылка для пилота",
        tapToPit: "НАЖМИТЕ ДЛЯ ЗАЕЗДА В БОКС",
        tapToExit: "НАЖМИТЕ ДЛЯ ВЫЕЗДА ИЗ БОКСА",
        pitsConfirm: "БОКСЫ?",
        tapAgainConfirm: "НАЖМИТЕ СНОВА ДЛЯ ПОДТВЕРЖДЕНИЯ",
        stintBest: "Л.СТИНТ",
        googleLoginBtn: "Вход",
        testBtn: "Тест",
        demoBtn: "Демо",
        demoRace: "Демо",
        countdownPrefix: "Гонка через",
        countdownGo: "ВРЕМЯ ГОНКИ! Стартуйте!",
        countdownAlert: "⏰ Гонка через {min} минут!",
        autoStarting: "Автостарт...",
        lblAutoStart: "Автостарт во время гонки",
        lblDoublesHint: "Одинаковый пилот подряд",
        lblSquadsHint: "Ротация групп для ночных смен и длинных гонок", lblSquadsHintActive: "Пилоты разделены на {n} сменных группы",
        lblFuelHint: "Умные ограничения по топливу и управление баком",
        statusHeader: "Статус",
        onTrack: "На Трассе",
        inPits: "На Боксах",
        squadSwitch: "Переключить отряд",
        viewerApprovalRequest: "Просьба о присоединении",
        approveViewer: "Одобрить",
        rejectViewer: "Отклонить",
        removeViewer: "Удалить",
        approvalPending: "Ожидание одобрения",
        approvalRejected: "Ваш запрос был администратором отклонен",
        bugReport: "Сообщить об Ошибке",
        featureSuggestion: "Предложить Функцию",
        bugReportTitle: "Отчет об Ошибке",
        featureSuggestionTitle: "Предложение Функции",
        describeIssue: "Опишите проблему или предложение...",
        send: "Отправить",
        feedbackTitle: "Обратная Связь",
        contactUs: "Связаться с Нами",
        goodPace: "Хороший Темп",
        lblStartTime: "🕐 Время старта", lblStartDate: "📅 Дата гонки",
        lblSquadSchedule: "🔄 Окно групп", lblSquadScheduleHint: "Вне окна все водители делят поровну. В окне группы чередуются равномерно.",
        lblSquadWindowStart: "Начало окна", lblSquadWindowEnd: "Конец окна",
        squadOff: "Выкл", squad2: "2 Группы", squad3: "3 Группы", squad4: "4 Группы",
        lblAppearance: "🎨 Внешний вид", lblPageBg: "Фон страницы", lblColorThemes: "Цветовые темы",
        laps: "КРУГИ", gap: "РАЗРЫВ", totalCompetitors: "МАШИНЫ", waitingData: "Ожидание данных...",
        boxThisLap: "🏁 ЗАЕЗД В БОКСЫ ЭТОТ КРУГ", boxNextLap: "📢 БОКСЫ СЛЕДУЮЩИЙ КРУГ", stayOut: "ОСТАВАЙТЕСЬ НА ТРАССЕ", onTrack: "НА ТРАССЕ", inPit: "В БОКСАХ",
        driverEntryHint: "Введите ID гонки для подключения", driverEntryLabel: "ID гонки", driverConnect: "Подключиться как пилот", driverIdTooShort: "ID слишком короткий", joinAsDriver: "Войти как пилот", backToSetup: "← Назад к настройкам",
        nextStintIn: "Ваш следующий стинт через", stayAwake: "Не спите", sleepOk: "Можно спать", yourStints: "Ваши стинты", noStintsFound: "Стинты для вас не найдены", wakeUpAlert: "⏰ Проснитесь! Ваш стинт скоро",
        viewerNameHint: "Введите имя, чтобы присоединиться к гонке", viewerNameLabel: "Ваше имя", requestToJoin: "Запросить доступ", waitingForApproval: "Ожидание одобрения...", waitingForApprovalHint: "Администратор гонки одобрит ваш запрос", viewerNameTooShort: "Имя должно содержать минимум 2 символа",
        proFeature: "Функция Pro", proUpgradeTitle: "⭐ Обновить до Pro", proUpgradeMsg: "Разблокируйте Live Timing, ИИ-стратегию, группы, безлимитных пилотов и темы, и многое другое!", proActivate: "Активировать лицензию", proDeactivate: "Деактивировать", proEnterKey: "Введите лицензионный ключ...", proInvalidKey: "Неверный лицензионный ключ", proActivated: "⭐ Pro Активирован!", proBadge: "PRO", proRequired: "требуется Pro", proHaveCoupon: "🎟️ Есть купон?", proApplyCoupon: "Применить",
        onboardTitle1: "Добро пожаловать в Streger!", onboardDesc1: "Ваш помощник по стратегии пит-стопов для картинговых гонок на выносливость. Настройте первую гонку за 3 простых шага.",
        onboardTitle2: "Настройте гонку", onboardDesc2: "Введите длительность, обязательные пит-стопы и мин/макс время стинта вверху. Добавьте пилотов ниже — выберите стартового и назначьте группы для ночных смен.",
        onboardTitle3: "Предпросмотр и корректировка", onboardDesc3: "Нажмите 'Предпросмотр' чтобы увидеть полный план стинтов. Перетаскивайте для изменения порядка, корректируйте длительность или сохраните план в облаке.",
        onboardTitle4: "На старт!", onboardDesc4: "Нажмите 'Старт' и панель управления заработает — следите за таймерами, получайте оповещения о пит-стопах, делитесь ссылкой с командой и управляйте сменами пилотов в реальном времени.",
        onboardSkip: "Пропустить", onboardNext: "Далее", onboardDone: "Поехали!",
        appTitle: "Streger",
        aiOptimize: "Оптимизировать стратегию (ИИ)",
        raceFinished: "ГОНКА ЗАВЕРШЕНА", totalPitTime: "Время в боксах", raceStart: "Старт", pitLog: "Журнал пит-стопов", drove: "Ехал", pitNoun: "Пит", driveNoun: "Езда", stints: "Стинты", avgStint: "Сред.",
        demoSelectFeatures: "Выберите Pro-функции для тестирования", demoLiveTimingDesc: "Таблица 20 команд", demoRainLabel: "Симуляция дождя", demoRainDesc: "Случайные осадки с изменением темпа", demoPenaltyDesc: "Случайные штрафы и добавление времени", demoTiresLabel: "Износ шин", demoTiresDesc: "Время круга увеличивается в течение стинта", demoSquadsLabel: "Группы", demoSquadsDesc: "Группы гонщиков с ротацией", demoFuelLabel: "Управление топливом", demoFuelDesc: "Отслеживание топлива и дозаправка",
        unitMin: "мин", unitHour: "ч",
        soundMute: "Без звука", soundUnmute: "Включить звук",
        undoPit: "Отменить пит", undoPitToast: "Вход в пит отменён", undoCountdown: "Отмена",
        exportPdf: "Экспорт PDF", exportImage: "Поделиться картинкой", exportingPdf: "Создание PDF...",
    },
    ar: {
        ltSearchType: "تصفية حسب:", ltTeam: "الفريق", ltDriver: "السائق", ltKart: "رقم الكارت", ltPlaceholder: "البحث...",
        previewTitle: "معاينة الإستراتيجية", addToCalendar: "إضافة للتقويم", timeline: "الجدول الزمني", driverSchedule: "جدول السائقين", totalTime: "الوقت الإجمالي", close: "إغلاق",
        googleLogin: "تسجيل الدخول عبر Google", eventCreated: "تم إنشاء الحدث!", eventError: "خطأ في الإنشاء", raceEventTitle: "سباق التحمل",
        errImpossible: "إستراتيجية غير ممكنة!", errAvgHigh: "المتوسط > الحد الأقصى. أضف محطات.", errAvgLow: "المتوسط < الحد الأدنى. اقلل المحطات.",
        appSubtitle: "مدير الإستراتيجية", generalInfo: "معلومات عامة", advancedConstraints: "القيود المتقدمة", driverConfig: "السائقون", aiTitle: "إستراتيجية AI",
        lblDuration: "المدة (ساعات)", lblStops: "المحطات المطلوبة", lblMinStint: "الحد الأدنى للمقطع", lblMaxStint: "الحد الأقصى للمقطع", lblPitTime: "وقت الحفرة", lblPitClosedStart: "🚫 مغلق في البداية", lblPitClosedEnd: "🚫 مغلق في النهاية",
        lblMinDrive: "الحد الأدنى الكلي (دقيقة)", lblMaxDrive: "الحد الأقصى الكلي (دقيقة)", lblBuffer: "التنبيه (ثانية)", lblDoubles: "السماح بالمضاعفات", lblSquads: "استخدام الفرق", lblFuel: "الوقود", lblFuelTank: "خزان الوقود (دقيقة)",
        addDriver: "+ إضافة", generateStrategy: "إنشاء (AI)", previewStrategy: "معاينة", startRace: "ابدأ", loadSaved: "تحميل",
        raceTime: "وقت السباق", stops: "المحطات", live: "مباشر", stop: "توقف", pos: "موضع", last: "الأخير", best: "الأفضل", targetStint: "مقطع الهدف", buildTime: "وقت البناء",
        current: "الحالي", stintTime: "وقت المقطع", nextDriver: "السائق التالي", penalty: "العقوبة", enterPit: "الدخول للحفرة", push: "ادفع", problem: "مشكلة",
        resetMode: "إعادة تعيين", nightMode: "وضع الليل", dry: "جاف", wet: "ممطر", drying: "يجف", boxNow: "الدخول الآن!", stayOnTrackUntilFurther: "ابقَ على المسار حتى إشعار آخر", pushMode: "وضع الدفع",
        squadSleeping: "الفريق نائم", squadWakeUp: "إيقاظ الفريق", finalLap: "الدورة الأخيرة", calculating: "جاري الحساب...", manualInput: "إدخال يدوي",
        saveStratTitle: "حفظ", libTitle: "المكتبة", aiPlaceholder: "مثل: 'السائق 1 يفضل...'",
        thStart: "البداية", thEnd: "النهاية", thType: "النوع", thDriver: "السائق", thDuration: "المدة",
        liveTiming: "التوقيت المباشر", liveTimingUrl: "رابط التوقيت...", connectLive: "توصيل", disconnectLive: "قطع الاتصال", searchTeam: "البحث عن فريق...", searchDriver: "البحث عن سائق...", searchKart: "البحث عن كارت...", demoMode: "وضع العرض",
        sendEmail: "إرسال", cancel: "إلغاء", create: "إنشاء", save: "حفظ", load: "تحميل", delete: "حذف",
        activeRaceFound: "تم العثور على سباق نشط", continueRace: "متابعة", discardRace: "رفض",
        areYouSure: "هل أنت متأكد؟", deleteWarning: "سيحذف البيانات نهائياً.", yesDelete: "نعم، احذف", noKeep: "لا، احفظ",
        invite: "دعوة", synced: "مزامن",
        chatTitle: "دردشة السباق / الأسئلة", enterName: "أدخل اسمك", startChat: "ابدأ الدردشة", typeMessage: "اكتب اقتراحاً...", send: "إرسال", viewer: "مشاهد", host: "المضيف", suggestion: "الاقتراح",
        strategyOutlook: "نظرة الإستراتيجية",
        timeLeft: "الوقت المتبقي",
        penalty: "العقوبة",
        enterPit: "الدخول للحفرة",
        nextDriverLabel: "السائق التالي",
        totalHeader: "المجموع",
        stopsHeader: "المقاطع",
        driverHeader: "السائق",
        stintsLeft: "المقاطع المتبقية",
        future: "المستقبل",
        max: "الحد الأقصى",
        min: "الحد الأدنى",
        rest: "الراحة",
        buffer: "المخزن المؤقت",
        impossible: "مستحيل",
        addStop: "إضافة محطة",
        avg: "متوسط",
        finalLap: "الدورة الأخيرة",
        inPit: "في الحفرة",
        nextLabel: "التالي",
        shortStintMsg: "⚠️ مقطع قصير! خطر العقوبة",
        cancelEntry: "إلغاء",
        notifyDriver: "📢 إخطار السائق",
        driverNotified: "✓ تم إخطار السائق",
        includesAdj: "يتضمن التعديل:",
        missingSeconds: "ناقص",
        proceedToPit: "المتابعة للحفرة؟",
        wait: "انتظر...",
        getReady: "تحضر...",
        go: "يلا! يلا!",
        goOutIn: "اخرج خلال",
        exitPits: "Exit Pits",
        driverExitedEarly: "السائق خرج مبكراً",
        driverExitedEarlyNotice: "غادر السائق الحفرة قبل الوقت المطلوب – قم بالتأكيد للقبول.",
        orangeZone: "⚠️ المنطقة البرتقالية - أبلغ فقط",
        targetLabel: "الهدف",
        driverLink: "رابط السائق",
        tapToPit: "اضغط للدخول للحفرة",
        tapToExit: "اضغط للخروج من الحفرة",
        pitsConfirm: "حفرة؟",
        tapAgainConfirm: "اضغط مرة أخرى للتأكيد",
        stintBest: "أفضل فترة",
        googleLoginBtn: "تسجيل الدخول",
        testBtn: "اختبار",
        demoBtn: "عرض توضيحي",
        demoRace: "عرض",
        countdownPrefix: "السباق يبدأ خلال",
        countdownGo: "وقت السباق! ابدأ الآن!",
        countdownAlert: "⏰ السباق يبدأ خلال {min} دقائق!",
        autoStarting: "بدء تلقائي...",
        lblAutoStart: "بدء تلقائي في موعد السباق",
        lblDoublesHint: "نفس السائق متتالي",
        lblSquadsHint: "تبديل مجموعات السائقين للمناوبات الليلية والسباقات الطويلة", lblSquadsHintActive: "السائقون مقسمون إلى {n} مجموعات متناوبة",
        lblFuelHint: "إدارة ذكية لقيود الوقود والخزان",
        statusHeader: "الحالة",
        onTrack: "على المسار",
        inPits: "في الحفر",
        squadSwitch: "تبديل الفريق",
        viewerApprovalRequest: "طلب الانضمام",
        approveViewer: "موافقة",
        rejectViewer: "رفض",
        removeViewer: "حذف",
        approvalPending: "معلق الموافقة",
        approvalRejected: "تم رفض طلبك من قبل مسؤول السباق",
        bugReport: "الإبلاغ عن خطأ",
        featureSuggestion: "اقتراح ميزة",
        bugReportTitle: "تقرير الأخطاء",
        featureSuggestionTitle: "اقتراح الميزة",
        describeIssue: "صف المشكلة أو الاقتراح...",
        send: "إرسال",
        feedbackTitle: "التعليقات",
        contactUs: "اتصل بنا",
        goodPace: "وتيرة جيدة",
        lblStartTime: "🕐 وقت البدء", lblStartDate: "📅 تاريخ السباق",
        lblSquadSchedule: "🔄 نافذة الفرق", lblSquadScheduleHint: "خارج النافذة يتشارك جميع السائقين بالتساوي. داخلها، تتناوب الفرق بالتساوي.",
        lblSquadWindowStart: "بداية النافذة", lblSquadWindowEnd: "نهاية النافذة",
        squadOff: "إيقاف", squad2: "فريقان", squad3: "3 فرق", squad4: "4 فرق",
        lblAppearance: "🎨 المظهر", lblPageBg: "خلفية الصفحة", lblColorThemes: "سمات الألوان",
        laps: "لفات", gap: "فارق", totalCompetitors: "سيارات", waitingData: "في انتظار البيانات...",
        boxThisLap: "🏁 ادخل هذه اللفة", boxNextLap: "📢 ادخل اللفة القادمة", stayOut: "ابقَ على المسار", onTrack: "على المسار", inPit: "في الحفرة",
        driverEntryHint: "أدخل رقم السباق للاتصال", driverEntryLabel: "رقم السباق", driverConnect: "اتصل كسائق", driverIdTooShort: "الرقم قصير جداً", joinAsDriver: "انضم كسائق", backToSetup: "← العودة للإعدادات",
        nextStintIn: "فترتك القادمة خلال", stayAwake: "ابقَ مستيقظاً", sleepOk: "يمكنك النوم", yourStints: "فتراتك", noStintsFound: "لم يتم العثور على فترات لك", wakeUpAlert: "⏰ استيقظ! فترتك قادمة",
        viewerNameHint: "أدخل اسمك للانضمام إلى السباق", viewerNameLabel: "اسمك", requestToJoin: "طلب الانضمام", waitingForApproval: "في انتظار الموافقة...", waitingForApprovalHint: "سيوافق مدير السباق على طلبك", viewerNameTooShort: "يجب أن يحتوي الاسم على حرفين على الأقل",
        proFeature: "ميزة Pro", proUpgradeTitle: "⭐ ترقية إلى Pro", proUpgradeMsg: "افتح التوقيت المباشر، استراتيجية الذكاء الاصطناعي، الفرق، سائقين وأنماط غير محدودة، والمزيد!", proActivate: "تفعيل الترخيص", proDeactivate: "إلغاء التفعيل", proEnterKey: "أدخل مفتاح الترخيص...", proInvalidKey: "مفتاح ترخيص غير صالح", proActivated: "⭐ تم تفعيل Pro!", proBadge: "PRO", proRequired: "يتطلب Pro", proHaveCoupon: "🎟️ هل لديك رمز قسيمة؟", proApplyCoupon: "تطبيق",
        onboardTitle1: "مرحباً بك في Streger!", onboardDesc1: "مساعدك في استراتيجية البيت لسباقات التحمل بالكارت. أعد سباقك الأول في 3 خطوات سهلة.",
        onboardTitle2: "إعداد السباق", onboardDesc2: "أدخل مدة السباق، التوقفات المطلوبة وأوقات الفترات الدنيا/القصوى في الأعلى. أضف السائقين أدناه — اختر من يبدأ وعيّن الفرق للمناوبات الليلية.",
        onboardTitle3: "معاينة وضبط", onboardDesc3: "اضغط 'معاينة الاستراتيجية' لرؤية الجدول الزمني الكامل. اسحب الفترات لإعادة الترتيب، عدّل المدد أو احفظ خطتك في السحابة.",
        onboardTitle4: "انطلق!", onboardDesc4: "اضغط 'ابدأ السباق' ولوحة القيادة الحية تتولى الأمر — تتبع المؤقتات، واستلم تنبيهات البيت، وشارك رابطاً مباشراً مع فريقك وأدر تبديلات السائقين في الوقت الفعلي.",
        onboardSkip: "تخطي", onboardNext: "التالي", onboardDone: "هيا بنا!",
        appTitle: "Streger",
        aiOptimize: "تحسين الاستراتيجية بالذكاء الاصطناعي",
        raceFinished: "انتهى السباق", totalPitTime: "وقت التوقف", raceStart: "البداية", pitLog: "سجل التوقفات", drove: "قاد", pitNoun: "توقف", driveNoun: "قيادة", stints: "فترات", avgStint: "متوسط",
        demoSelectFeatures: "اختر ميزات Pro للاختبار", demoLiveTimingDesc: "لوحة تصنيف 20 فريقاً", demoRainLabel: "محاكاة المطر", demoRainDesc: "أحداث مطر عشوائية مع تغيير الإيقاع", demoPenaltyDesc: "عقوبات عشوائية وإضافات زمنية", demoTiresLabel: "تآكل الإطارات", demoTiresDesc: "أوقات اللفة تزداد خلال الفترة", demoSquadsLabel: "الفرق", demoSquadsDesc: "مجموعات السائقين مع التناوب", demoFuelLabel: "إدارة الوقود", demoFuelDesc: "تتبع الوقود والتوقف للتزويد",
        unitMin: "د", unitHour: "س",
        soundMute: "كتم الصوت", soundUnmute: "إلغاء كتم الصوت",
        undoPit: "إلغاء الحفرة", undoPitToast: "تم إلغاء دخول الحفرة", undoCountdown: "إلغاء",
        exportPdf: "تصدير PDF", exportImage: "مشاركة كصورة", exportingPdf: "إنشاء PDF...",
    },
    es: {
        ltSearchType: "Filtrar por:", ltTeam: "Equipo", ltDriver: "Piloto", ltKart: "Kart nº", ltPlaceholder: "Buscar...",
        previewTitle: "Vista previa de la estrategia", addToCalendar: "Añadir al calendario", timeline: "Cronología", driverSchedule: "Horario de pilotos", totalTime: "Tiempo total", close: "Cerrar",
        googleLogin: "Iniciar sesión con Google", eventCreated: "¡Evento creado!", eventError: "Error al crear", raceEventTitle: "Carrera de resistencia",
        errImpossible: "¡Estrategia imposible!", errAvgHigh: "Promedio > Máx. Añada paradas.", errAvgLow: "Promedio < Mín. Reduzca paradas.",
        appSubtitle: "Gestor de estrategia", generalInfo: "Información general", advancedConstraints: "Restricciones avanzadas", driverConfig: "Pilotos", aiTitle: "Estrategia IA",
        lblDuration: "Duración (H)", lblStops: "Paradas req.", lblMinStint: "Mín tramo", lblMaxStint: "Máx tramo", lblPitTime: "Tiempo box", lblPitClosedStart: "🚫 Cerrado inicio", lblPitClosedEnd: "🚫 Cerrado final",
        lblMinDrive: "Mín total (min)", lblMaxDrive: "Máx total (min)", lblBuffer: "Alerta (s)", lblDoubles: "Permitir dobles", lblSquads: "Usar escuadrones", lblFuel: "Combustible", lblFuelTank: "Depósito (min)",
        addDriver: "+ Añadir", generateStrategy: "Generar (IA)", previewStrategy: "Vista previa", startRace: "Iniciar", loadSaved: "Cargar",
        raceTime: "TIEMPO CARRERA", stops: "PARADAS", live: "EN DIRECTO", stop: "Parar", pos: "POS", last: "ÚLT", best: "MEJOR", targetStint: "TRAMO OBJETIVO", buildTime: "CONSTRUIR TIEMPO",
        current: "ACTUAL", stintTime: "TIEMPO TRAMO", nextDriver: "Siguiente", penalty: "Penalización", enterPit: "ENTRAR BOX", push: "ATACAR", problem: "PROBLEMA",
        resetMode: "Reiniciar", nightMode: "MODO NOCHE", dry: "Seco", wet: "Lluvia", drying: "Secando", boxNow: "¡BOX AHORA!", stayOnTrackUntilFurther: "Manténgase en pista hasta nuevo aviso", pushMode: "MODO ATAQUE",
        squadSleeping: "ESCUADRÓN DURMIENDO", squadWakeUp: "DESPERTAR ESCUADRÓN", finalLap: "Última vuelta", calculating: "Calculando...", manualInput: "Manual",
        saveStratTitle: "Guardar", libTitle: "Biblioteca", aiPlaceholder: "ej: 'El piloto 1 prefiere...'",
        thStart: "Inicio", thEnd: "Fin", thType: "Tipo", thDriver: "Piloto", thDuration: "Duración",
        liveTiming: "Cronometraje en vivo", liveTimingUrl: "URL cronometraje...", connectLive: "Conectar", disconnectLive: "Desconectar", searchTeam: "Buscar equipo...", searchDriver: "Buscar piloto...", searchKart: "Buscar kart...", demoMode: "Modo demostración",
        sendEmail: "Enviar", cancel: "Cancelar", create: "Crear", save: "Guardar", load: "Cargar", delete: "Eliminar",
        activeRaceFound: "Carrera activa encontrada", continueRace: "Continuar", discardRace: "Descartar",
        areYouSure: "¿Estás seguro?", deleteWarning: "Esto eliminará los datos permanentemente.", yesDelete: "Sí, eliminar", noKeep: "No, mantener",
        invite: "Invitar", synced: "Sincronizado",
        chatTitle: "Chat de carrera / P&R", enterName: "Ingresa tu nombre", startChat: "Iniciar chat", typeMessage: "Escribe una sugerencia...", send: "Enviar", viewer: "Espectador", host: "ANFITRIÓN", suggestion: "Sugerencia",
        strategyOutlook: "PERSPECTIVA ESTRATÉGICA",
        timeLeft: "TIEMPO RESTANTE",
        penalty: "PENALIZACIÓN",
        enterPit: "ENTRAR BOX",
        nextDriverLabel: "SIGUIENTE PILOTO",
        totalHeader: "TOTAL",
        stopsHeader: "TRAMOS",
        driverHeader: "PILOTO",
        stintsLeft: "TRAMOS RESTANTES",
        future: "FUTURO",
        max: "MÁX",
        min: "MÍN",
        rest: "DESCANSO",
        buffer: "Margen",
        impossible: "IMPOSIBLE",
        addStop: "AÑADIR PARADA",
        avg: "PROM",
        finalLap: "ÚLTIMA VUELTA",
        inPit: "EN BOX",
        nextLabel: "Siguiente",
        shortStintMsg: "⚠️ TRAMO CORTO! Riesgo penalización",
        cancelEntry: "Cancelar",
        notifyDriver: "📢 Notificar piloto",
        driverNotified: "✓ Piloto notificado",
        includesAdj: "Incluye ajuste:",
        missingSeconds: "Faltante",
        proceedToPit: "¿Continuar al box?",
        wait: "ESPERA...",
        getReady: "PREPÁRATE...",
        go: "¡A POR ÉL!",
        goOutIn: "SALE EN",
        exitPits: "Exit Pits",
        driverExitedEarly: "El piloto salió temprano",
        driverExitedEarlyNotice: "El piloto salió del pit antes del tiempo requerido – confirma para aceptar.",
        orangeZone: "⚠️ Zona naranja - solo NOTIFICAR",
        targetLabel: "OBJETIVO",
        driverLink: "Enlace del piloto",
        tapToPit: "TOCA PARA ENTRAR A BOXES",
        tapToExit: "TOCA PARA SALIR DE BOXES",
        pitsConfirm: "BOXES?",
        tapAgainConfirm: "TOCA DE NUEVO PARA CONFIRMAR",
        stintBest: "M.STINT",
        googleLoginBtn: "Iniciar sesión",
        testBtn: "Prueba",
        demoBtn: "Demostración",
        demoRace: "Demo",
        countdownPrefix: "Carrera en",
        countdownGo: "¡HORA DE LA CARRERA! ¡Empieza ahora!",
        countdownAlert: "⏰ ¡Carrera en {min} minutos!",
        autoStarting: "Iniciando automáticamente...",
        lblAutoStart: "Inicio automático a la hora",
        lblDoublesHint: "Mismo piloto consecutivamente",
        lblSquadsHint: "Rotación de escuadrones para turnos nocturnos y carreras largas", lblSquadsHintActive: "Pilotos divididos en {n} grupos rotativos",
        lblFuelHint: "Restricciones inteligentes de combustible y gestión del depósito",
        statusHeader: "Estado",
        onTrack: "En la Pista",
        inPits: "En los Boxes",
        squadSwitch: "Cambiar Equipo",
        viewerApprovalRequest: "Solicitando participar",
        approveViewer: "Aprobar",
        rejectViewer: "Rechazar",
        removeViewer: "Eliminar",
        approvalPending: "Aprobación Pendiente",
        approvalRejected: "Tu solicitud fue rechazada por el anfitrión",
        bugReport: "Reportar Bug",
        featureSuggestion: "Sugerir Función",
        bugReportTitle: "Reporte de Bug",
        featureSuggestionTitle: "Sugerencia de Función",
        describeIssue: "Describe el problema o sugerencia...",
        send: "Enviar",
        feedbackTitle: "Retroalimentación",
        contactUs: "Contáctenos",
        goodPace: "Buen Ritmo",
        lblStartTime: "🕐 Hora de Inicio", lblStartDate: "📅 Fecha de Carrera",
        lblSquadSchedule: "🔄 Ventana de Escuadrones", lblSquadScheduleHint: "Fuera de la ventana, todos comparten por igual. Dentro, los escuadrones rotan equitativamente.",
        lblSquadWindowStart: "Inicio ventana", lblSquadWindowEnd: "Fin ventana",
        squadOff: "Desactivado", squad2: "2 Escuadrones", squad3: "3 Escuadrones", squad4: "4 Escuadrones",
        lblAppearance: "🎨 Apariencia", lblPageBg: "Fondo de página", lblColorThemes: "Temas de color",
        laps: "VUELTAS", gap: "BRECHA", totalCompetitors: "COCHES", waitingData: "Esperando datos...",
        boxThisLap: "🏁 BOX ESTA VUELTA", boxNextLap: "📢 BOX SIGUIENTE VUELTA", stayOut: "SIGUE EN PISTA", onTrack: "EN PISTA", inPit: "EN BOXES",
        driverEntryHint: "Ingresa el ID de carrera para conectarte", driverEntryLabel: "ID de carrera", driverConnect: "Conectar como piloto", driverIdTooShort: "El ID es muy corto", joinAsDriver: "Unirse como piloto", backToSetup: "← Volver a configuración",
        nextStintIn: "Tu próximo stint en", stayAwake: "Mantente despierto", sleepOk: "Puedes dormir", yourStints: "Tus Stints", noStintsFound: "No se encontraron stints para ti", wakeUpAlert: "⏰ ¡Despierta! Tu stint se acerca",
        viewerNameHint: "Ingresa tu nombre para unirte a la carrera", viewerNameLabel: "Tu Nombre", requestToJoin: "Solicitar Unirse", waitingForApproval: "Esperando aprobación...", waitingForApprovalHint: "El administrador de la carrera aprobará tu solicitud", viewerNameTooShort: "El nombre debe tener al menos 2 caracteres",
        proFeature: "Función Pro", proUpgradeTitle: "⭐ Actualizar a Pro", proUpgradeMsg: "¡Desbloquea Cronometraje en Vivo, Estrategia IA, Escuadrones, pilotos y temas ilimitados, y más!", proActivate: "Activar licencia", proDeactivate: "Desactivar", proEnterKey: "Ingresa la clave de licencia...", proInvalidKey: "Clave de licencia inválida", proActivated: "⭐ ¡Pro Activado!", proBadge: "PRO", proRequired: "requiere Pro", proHaveCoupon: "🎟️ ¿Tienes un código de cupón?", proApplyCoupon: "Aplicar",
        onboardTitle1: "¡Bienvenido a Streger!", onboardDesc1: "Tu asistente de estrategia de boxes para carreras de resistencia en karting. Configura tu primera carrera en 3 pasos sencillos.",
        onboardTitle2: "Configura tu carrera", onboardDesc2: "Ingresa la duración, paradas obligatorias y tiempos de stint mín/máx arriba. Añade tus pilotos abajo — elige quién sale y asigna escuadras para los turnos nocturnos.",
        onboardTitle3: "Vista previa y ajustes", onboardDesc3: "Pulsa 'Vista previa' para ver el plan completo de stints. Arrastra para reordenar, ajusta duraciones o guarda tu plan en la nube.",
        onboardTitle4: "¡A correr!", onboardDesc4: "Pulsa 'Iniciar Carrera' y el panel en vivo toma el control — sigue los cronómetros, recibe alertas de boxes, comparte un enlace en vivo con tu equipo y gestiona los cambios de piloto en tiempo real.",
        onboardSkip: "Saltar", onboardNext: "Siguiente", onboardDone: "¡Vamos!",
        appTitle: "Streger",
        aiOptimize: "Optimizar estrategia IA",
        raceFinished: "CARRERA TERMINADA", totalPitTime: "Tiempo en boxes", raceStart: "Inicio", pitLog: "Registro de paradas", drove: "Condujo", pitNoun: "Box", driveNoun: "Conducción", stints: "Tramos", avgStint: "Prom.",
        demoSelectFeatures: "Selecciona funciones Pro para probar", demoLiveTimingDesc: "Clasificación simulada de 20 equipos", demoRainLabel: "Simulación de lluvia", demoRainDesc: "Eventos de lluvia aleatorios con cambio de ritmo", demoPenaltyDesc: "Penalizaciones aleatorias y adiciones de tiempo", demoTiresLabel: "Degradación de neumáticos", demoTiresDesc: "Los tiempos de vuelta aumentan durante el tramo", demoSquadsLabel: "Escuadrones", demoSquadsDesc: "Grupos de pilotos con rotación", demoFuelLabel: "Gestión de combustible", demoFuelDesc: "Seguimiento del combustible y repostaje",
        unitMin: "min", unitHour: "h",
        soundMute: "Silenciar", soundUnmute: "Activar sonido",
        undoPit: "Deshacer Pit", undoPitToast: "Entrada al pit deshecha", undoCountdown: "Deshacer",
        exportPdf: "Exportar PDF", exportImage: "Compartir Imagen", exportingPdf: "Generando PDF...",
    },
    it: {
        ltSearchType: "Filtra per:", ltTeam: "Squadra", ltDriver: "Pilota", ltKart: "Kart n°", ltPlaceholder: "Ricerca...", previewTitle: "Anteprima strategia", addToCalendar: "Aggiungi al calendario", timeline: "Cronologia", driverSchedule: "Orario piloti", totalTime: "Tempo totale", close: "Chiudi",
        googleLogin: "Accedi con Google", eventCreated: "Evento creato!", eventError: "Errore creazione", raceEventTitle: "Gara di resistenza", errImpossible: "Strategia impossibile!", errAvgHigh: "Media > Max. Aggiungi soste.", errAvgLow: "Media < Min. Riduci soste.",
        appSubtitle: "Gestore strategia", generalInfo: "Info generale", advancedConstraints: "Vincoli avanzati", driverConfig: "Piloti", aiTitle: "Strategia IA", lblDuration: "Durata (H)", lblStops: "Soste richieste", lblMinStint: "Min stint", lblMaxStint: "Max stint", lblPitTime: "Tempo pit", lblPitClosedStart: "🚫 Chiuso inizio", lblPitClosedEnd: "🚫 Chiuso fine",
        lblMinDrive: "Min totale (min)", lblMaxDrive: "Max totale (min)", lblBuffer: "Avviso (s)", lblDoubles: "Consenti doppi", lblSquads: "Usa squadre", lblFuel: "Carburante", lblFuelTank: "Serbatoio (min)", addDriver: "+ Aggiungi", generateStrategy: "Genera (IA)", previewStrategy: "Anteprima", startRace: "Inizia", loadSaved: "Carica",
        raceTime: "TEMPO GARA", stops: "SOSTE", live: "DIRETTA", stop: "Ferma", pos: "POS", last: "ULT", best: "MIGLIORE", targetStint: "STINT OBIETTIVO", buildTime: "TEMPO COSTRUITO", current: "ATTUALE", stintTime: "TEMPO STINT", nextDriver: "Prossimo", penalty: "Penalità", enterPit: "ENTRA IN PIT", push: "SPINGI", problem: "PROBLEMA",
        resetMode: "Ripristina", nightMode: "MODALITÀ NOTTE", dry: "Secco", wet: "Pioggia", drying: "Asciugando", boxNow: "BOX ADESSO!", stayOnTrackUntilFurther: "Rimani in pista fino a nuovo avviso", pushMode: "MODALITÀ PUSH", squadSleeping: "SQUADRA DORME", squadWakeUp: "SVEGLIA SQUADRA", finalLap: "Ultimo giro", calculating: "Calcolando...", manualInput: "Manuale",
        saveStratTitle: "Salva", libTitle: "Libreria", aiPlaceholder: "es: 'Il pilota 1 preferisce...'", thStart: "Inizio", thEnd: "Fine", thType: "Tipo", thDriver: "Pilota", thDuration: "Durata", liveTiming: "Cronometraggio live", liveTimingUrl: "URL cronometraggio...", connectLive: "Connetti", disconnectLive: "Disconnetti", searchTeam: "Cerca squadra...", searchDriver: "Cerca pilota...", searchKart: "Cerca kart...", demoMode: "Modalità demo",
        sendEmail: "Invia", cancel: "Annulla", create: "Crea", save: "Salva", load: "Carica", delete: "Elimina", activeRaceFound: "Gara attiva trovata", continueRace: "Continua", discardRace: "Scarta", areYouSure: "Sei sicuro?", deleteWarning: "Questo eliminerà i dati in modo permanente.", yesDelete: "Sì, elimina", noKeep: "No, conserva", invite: "Invita", synced: "Sincronizzato",
        chatTitle: "Chat gara / D&R", enterName: "Inserisci il tuo nome", startChat: "Inizia chat", typeMessage: "Scrivi un suggerimento...", send: "Invia", viewer: "Spettatore", host: "OSPITE", suggestion: "Suggerimento", strategyOutlook: "PROSPETTIVA STRATEGICA", timeLeft: "TEMPO RIMANENTE", penalty: "PENALITÀ", enterPit: "ENTRA IN PIT", nextDriverLabel: "PROSSIMO PILOTA", totalHeader: "TOTALE", stopsHeader: "STINT", driverHeader: "PILOTA",
        stintsLeft: "STINT RIMANENTI", future: "FUTURO", max: "MAX", min: "MIN", rest: "RIPOSO", buffer: "Buffer", impossible: "IMPOSSIBILE", addStop: "AGGIUNGI SOSTA", avg: "MEDIA", finalLap: "ULTIMO GIRO", inPit: "IN PIT", nextLabel: "Prossimo", shortStintMsg: "⚠️ STINT CORTO! Rischio penalità", cancelEntry: "Annulla", notifyDriver: "📢 Notifica pilota", driverNotified: "✓ Pilota notificato", includesAdj: "Include aggiustamento:", missingSeconds: "Mancante", proceedToPit: "Procedere al pit?", wait: "ATTENDI...", getReady: "PREPARATI...", go: "VAI! VAI!", goOutIn: "ESCI TRA", exitPits: "Exit Pits", driverExitedEarly: "Il pilota è uscito presto", driverExitedEarlyNotice: "Il pilota è uscito dai box prima del tempo richiesto - conferma per accettare.", orangeZone: "⚠️ Zona arancione - solo NOTIFICA", targetLabel: "OBIETTIVO", driverLink: "Link pilota", tapToPit: "TOCCA PER ENTRARE AI BOX", tapToExit: "TOCCA PER USCIRE DAI BOX", pitsConfirm: "BOX?", tapAgainConfirm: "TOCCA DI NUOVO PER CONFERMARE", stintBest: "M.STINT",
        googleLoginBtn: "Accedi",
        testBtn: "Prova",
        demoBtn: "Demo",
        demoRace: "Demo",
        countdownPrefix: "Gara tra",
        countdownGo: "ORA DELLA GARA! Parti ora!",
        countdownAlert: "⏰ Gara tra {min} minuti!",
        autoStarting: "Avvio automatico...",
        lblAutoStart: "Avvio automatico all'orario",
        lblDoublesHint: "Stesso pilota consecutivamente",
        lblSquadsHint: "Rotazione squadre per turni notturni & gare lunghe", lblSquadsHintActive: "Piloti divisi in {n} gruppi a rotazione",
        lblFuelHint: "Vincoli carburante intelligenti & gestione serbatoio",
        statusHeader: "Stato",
        onTrack: "In Pista",
        inPits: "Nei Box",
        squadSwitch: "Cambia Squadra",
        viewerApprovalRequest: "Richiesta di partecipazione",
        approveViewer: "Approva",
        rejectViewer: "Rifiuta",
        removeViewer: "Rimuovi",
        approvalPending: "Approvazione In Sospeso",
        approvalRejected: "La tua richiesta è stata rifiutata dall'host",
        bugReport: "Segnala un Bug",
        featureSuggestion: "Suggerisci una Funzione",
        bugReportTitle: "Rapporto di Bug",
        featureSuggestionTitle: "Suggerimento di Funzione",
        describeIssue: "Descrivi il problema o il suggerimento...",
        send: "Invia",
        feedbackTitle: "Feedback",
        contactUs: "Contattaci",
        goodPace: "Buon Ritmo",
        lblStartTime: "🕐 Ora di Partenza", lblStartDate: "📅 Data della Gara",
        lblSquadSchedule: "🔄 Finestra Squadre", lblSquadScheduleHint: "Fuori dalla finestra tutti i piloti condividono. Dentro, le squadre ruotano equamente.",
        lblSquadWindowStart: "Inizio finestra", lblSquadWindowEnd: "Fine finestra",
        squadOff: "Disattivato", squad2: "2 Squadre", squad3: "3 Squadre", squad4: "4 Squadre",
        lblAppearance: "🎨 Aspetto", lblPageBg: "Sfondo pagina", lblColorThemes: "Temi colore",
        laps: "GIRI", gap: "DISTACCO", totalCompetitors: "AUTO", waitingData: "In attesa di dati...", leaderLabel: "LEADER",
        boxThisLap: "🏁 BOX QUESTO GIRO", boxNextLap: "📢 BOX PROSSIMO GIRO", stayOut: "RIMANI IN PISTA", onTrack: "IN PISTA", inPit: "AI BOX",
        driverEntryHint: "Inserisci l'ID gara per connetterti", driverEntryLabel: "ID gara", driverConnect: "Connetti come pilota", driverIdTooShort: "L'ID è troppo corto", joinAsDriver: "Unisciti come pilota", backToSetup: "← Torna alle impostazioni",
        nextStintIn: "Il tuo prossimo stint tra", stayAwake: "Resta sveglio", sleepOk: "Puoi dormire", yourStints: "I Tuoi Stint", noStintsFound: "Nessuno stint trovato per te", wakeUpAlert: "⏰ Svegliati! Il tuo stint si avvicina",
        viewerNameHint: "Inserisci il tuo nome per unirti alla gara", viewerNameLabel: "Il Tuo Nome", requestToJoin: "Richiedi di unirti", waitingForApproval: "In attesa di approvazione...", waitingForApprovalHint: "L'amministratore della gara approverà la tua richiesta", viewerNameTooShort: "Il nome deve avere almeno 2 caratteri",
        proFeature: "Funzione Pro", proUpgradeTitle: "⭐ Passa a Pro", proUpgradeMsg: "Sblocca Cronometraggio Live, Strategia IA, Squadre, piloti e temi illimitati, e altro!", proActivate: "Attiva licenza", proDeactivate: "Disattiva", proEnterKey: "Inserisci la chiave di licenza...", proInvalidKey: "Chiave di licenza non valida", proActivated: "⭐ Pro Attivato!", proBadge: "PRO", proRequired: "richiede Pro", proHaveCoupon: "🎟️ Hai un codice coupon?", proApplyCoupon: "Applica",
        onboardTitle1: "Benvenuto su Streger!", onboardDesc1: "Il tuo assistente strategico per le gare di endurance in kart. Configura la tua prima gara in 3 semplici passi.",
        onboardTitle2: "Configura la gara", onboardDesc2: "Inserisci durata, soste obbligatorie e tempi stint min/max in alto. Aggiungi i tuoi piloti sotto — scegli chi parte e assegna le squadre per i turni notturni.",
        onboardTitle3: "Anteprima e regolazioni", onboardDesc3: "Tocca 'Anteprima Strategia' per vedere il piano completo. Trascina gli stint per riordinare, modifica le durate o salva il piano nel cloud.",
        onboardTitle4: "Si corre!", onboardDesc4: "Premi 'Inizia Gara' e la dashboard live prende il comando — monitora i timer, ricevi avvisi pit, condividi un link live con il team e gestisci i cambi pilota in tempo reale.",
        onboardSkip: "Salta", onboardNext: "Avanti", onboardDone: "Andiamo!",
        appTitle: "Streger",
        aiOptimize: "Ottimizza strategia IA",
        raceFinished: "GARA TERMINATA", totalPitTime: "Tempo ai box", raceStart: "Partenza", pitLog: "Registro soste", drove: "Guidato", pitNoun: "Box", driveNoun: "Guida", stints: "Stint", avgStint: "Media",
        demoSelectFeatures: "Seleziona le funzioni Pro da testare", demoLiveTimingDesc: "Classifica simulata di 20 squadre", demoRainLabel: "Simulazione pioggia", demoRainDesc: "Eventi pioggia casuali con cambio di ritmo", demoPenaltyDesc: "Penalità casuali e aggiunte di tempo", demoTiresLabel: "Degrado gomme", demoTiresDesc: "I tempi sul giro aumentano durante lo stint", demoSquadsLabel: "Squadre", demoSquadsDesc: "Gruppi di piloti con rotazione", demoFuelLabel: "Gestione carburante", demoFuelDesc: "Monitorare il carburante e rifornimento",
        unitMin: "min", unitHour: "h",
        soundMute: "Muto", soundUnmute: "Riattiva",
        undoPit: "Annulla Pit", undoPitToast: "Ingresso pit annullato", undoCountdown: "Annulla",
        exportPdf: "Esporta PDF", exportImage: "Condividi Immagine", exportingPdf: "Generazione PDF...",
    },
    ka: {
        ltSearchType: "ფილტრი:", ltTeam: "გუნდი", ltDriver: "მძღოლი", ltKart: "კარტი #", ltPlaceholder: "ძებნა...",
        previewTitle: "სტრატეგიის წინასწარი ნახვა", addToCalendar: "დაამატე კალენდარში", timeline: "ქრონოლოგია", driverSchedule: "მძღოლების განრიგი", totalTime: "მোცემი დრო", close: "დახურვა",
        googleLogin: "შეიყვანე Google-ით", eventCreated: "ღვაბი შეიქმნა!", eventError: "შეცდომა", raceEventTitle: "გამძლეობის რბოლა",
        errImpossible: "შეუძლებელი სტრატეგია!", errAvgHigh: "საშუალო > მაქსიმუმი. დაამატე გაჩერება.", errAvgLow: "საშუალო < მინიმუმი. კლებითი გაჩერება.",
        appSubtitle: "სტრატეგიის მენეჯერი", generalInfo: "ზოგადი ინფორმაცია", advancedConstraints: "დამატებითი შეზღუდვები", driverConfig: "მძღოლები", aiTitle: "AI სტრატეგია",
        lblDuration: "ხანგრძლივობა (საათი)", lblStops: "საჭირო გაჩერება", lblMinStint: "მინიმ ტაძე", lblMaxStint: "მაქსიმ ტაძე", lblPitTime: "ბოქსის დრო", lblPitClosedStart: "🚫 დახურული დაწყება", lblPitClosedEnd: "🚫 დახურული დასრულება",
        lblMinDrive: "მინიმ სულ (წთ)", lblMaxDrive: "მაქსიმ სულ (წთ)", lblBuffer: "გაფრთხოვება (წამი)", lblDoubles: "დაშვებული გაორმაგება", lblSquads: "გამოიყენე ჯგუფები", lblFuel: "საწვავი", lblFuelTank: "ავზი (წთ)",
        addDriver: "+ დამატება", generateStrategy: "შექმნა (AI)", previewStrategy: "წინასწარი ნახვა", startRace: "დაწყება", loadSaved: "ატვირთვა",
        raceTime: "რბოლის დრო", stops: "გაჩერება", live: "ცოცხალი", stop: "გაჩერება", pos: "პოზ", last: "ბოლო", best: "საუკეთესო", targetStint: "სამიზნე ტაძე", buildTime: "დროის აგება",
        current: "ამჟამინი", stintTime: "ტაძის დრო", nextDriver: "შემდეგი მძღოლი", penalty: "პენალტი", enterPit: "ბოქსში შესვლა", push: "ატაკა", problem: "პრობლემა",
        resetMode: "გადატვირთვა", nightMode: "ღამის რეჟიმი", dry: "მშრალი", wet: "წვიმა", drying: "მშრალდება", boxNow: "ახლა ᲑᲝᲥᲡᲘ!", stayOnTrackUntilFurther: "დაჯექ ტრეკზე მანამ სანამ კიდევ რაიმე ცვლილება", pushMode: "PUSH რეჟიმი",
        squadSleeping: "გუნდი სძინავს", squadWakeUp: "გუნდის გამოღვიძება", finalLap: "ბოლო წრე", calculating: "გამოთვლა...", manualInput: "ხელით შეყვანა",
        saveStratTitle: "შენახვა", libTitle: "ბიბლიოთეკა", aiPlaceholder: "მაგ: 'მძღოლი 1 მოწოდებული...'",
        thStart: "დაწყება", thEnd: "დასრულება", thType: "ტიპი", thDriver: "მძღოლი", thDuration: "ხანგრძლივობა",
        liveTiming: "ცოცხალი დროის საზომი", liveTimingUrl: "დროის საზომის URL...", connectLive: "დაკავშირება", disconnectLive: "გამოკავშირება", searchTeam: "გუნდის ძებნა...", searchDriver: "მძღოლის ძებნა...", searchKart: "კარტის ძებნა...", demoMode: "დემო რეჟიმი",
        sendEmail: "გაგზავნა", cancel: "გაუქმება", create: "შექმნა", save: "შენახვა", load: "ატვირთვა", delete: "წაშლა",
        activeRaceFound: "აქტიური რბოლა ნაპოვნია", continueRace: "გაგრძელება", discardRace: "უარი",
        areYouSure: "ხარ დარწმუნებული?", deleteWarning: "ეს წაშლის მონაცემებს სამუდამოდ.", yesDelete: "დიახ, წაშლა", noKeep: "არა, შენახვა",
        invite: "დაპატიჟება", synced: "სინქრონიზირებული",
        chatTitle: "რბოლის ჩატი / კითხვა-პასუხი", enterName: "შეიყვანე შენი სახელი", startChat: "ჩატის დაწყება", typeMessage: "დაწერე შემოთავაზება...", send: "გაგზავნა", viewer: "მაყურებელი", host: "ხელმძღვანელი", suggestion: "დამი",
        strategyOutlook: "სტრატეგიის პერსპექტივა",
        timeLeft: "დარჩენილი დრო",
        penalty: "პენალტი",
        enterPit: "ბოქსში შესვლა",
        nextDriverLabel: "შემდეგი მძღოლი",
        totalHeader: "სულ",
        stopsHeader: "ტაძე",
        driverHeader: "მძღოლი",
        stintsLeft: "დარჩენილი ტაძე",
        future: "მომავალი",
        max: "მაქს",
        min: "მინ",
        rest: "დასვენება",
        buffer: "ბუფერი",
        impossible: "შეუძლებელი",
        addStop: "გაჩერების დამატება",
        avg: "საშუალო",
        finalLap: "ბოლო წრე",
        inPit: "ბოქსში",
        nextLabel: "შემდეგი",
        shortStintMsg: "⚠️ მოკლე ტაძე! პენალტის რისკი",
        cancelEntry: "გაუქმება",
        notifyDriver: "📢 მძღოლის შეტყობინება",
        driverNotified: "✓ მძღოლი შეტყობინდა",
        includesAdj: "მოიცავს კორექტირებას:",
        missingSeconds: "აკლია",
        proceedToPit: "ბოქსზე გაგრძელება?",
        wait: "დაელოდე...",
        getReady: "მზადყოფილება...",
        go: "წინ! წინ!",
        goOutIn: "გამოდი",
        exitPits: "Exit Pits",
        orangeZone: "⚠️ ფორთოქლის ზონა - მხოლოდ შეატყობინეთ",
        targetLabel: "მიზანი",
        driverLink: "მძღოლის ბმული",
        tapToPit: "შეეხეთ პიტში შესასვლელად",
        tapToExit: "შეეხეთ პიტიდან გამოსასვლელად",
        pitsConfirm: "პიტი?",
        tapAgainConfirm: "შეეხეთ ხელმეორედ დასადასტურებლად",
        stintBest: "ს.საუკეთესო",
        googleLoginBtn: "ლოგინი",
        testBtn: "ტესტი",
        demoBtn: "დემო",
        demoRace: "დემო",
        countdownPrefix: "რბოლა იწყება",
        countdownGo: "რბოლის დრო! დაიწყეთ!",
        countdownAlert: "⏰ რბოლა {min} წუთში!",
        autoStarting: "ავტომატური დაწყება...",
        lblAutoStart: "ავტომატური დაწყება",
        lblDoublesHint: "ერთი და იგივე მძღოლი ზედიზედ",
        lblSquadsHint: "ჯგუფების როტაცია ღამის ცვლებისთვის და გრძელი რბოლებისთვის", lblSquadsHintActive: "მძღოლები დაყოფილია {n} მონაცვლე ჯგუფად",
        lblFuelHint: "ჭკვიანი საწვავის შეზღუდვები და ავზის მართვა",
        statusHeader: "სტატუსი",
        onTrack: "თრეკზე",
        inPits: "ბოქსში",
        squadSwitch: "გუნდიის დადითბელი",
        viewerApprovalRequest: "მგებით დამკიდითელი",
        approveViewer: "დამკიდ",
        rejectViewer: "დაედით",
        removeViewer: "დამთება",
        approvalPending: "დამტკიცების მოლოდინი",
        approvalRejected: "თქვენი მოთხოვნა უარყო ჰოსტმა",
        bugReport: "ბაგის მოხსენება",
        featureSuggestion: "ფუნქციის შემოთავაზება",
        bugReportTitle: "ბაგის ანგარიში",
        featureSuggestionTitle: "ფუნქციის შემოთავაზება",
        describeIssue: "აღწერეთ პრობლემა ან გამოთქმა...",
        send: "გაგზავნა",
        feedbackTitle: "მოტეხილობა",
        contactUs: "დაგვიკავშირდით",
        goodPace: "კარგი ტემპი",
        lblStartTime: "🕐 დაწყების დრო", lblStartDate: "📅 რბოლის თარიღი",
        lblSquadSchedule: "🔄 ჯგუფების ფანჯარა", lblSquadScheduleHint: "ფანჯრის გარეთ ყველა მძღოლი თანაბრად ინაწილებს. შიგნით ჯგუფები თანაბრად მონაცვლეობენ.",
        lblSquadWindowStart: "ფანჯრის დასაწყისი", lblSquadWindowEnd: "ფანჯრის დასასრული",
        squadOff: "გამორთული", squad2: "2 ჯგუფი", squad3: "3 ჯგუფი", squad4: "4 ჯგუფი",
        lblAppearance: "🎨 გარეგნობა", lblPageBg: "გვერდის ფონი", lblColorThemes: "ფერის თემები",
        laps: "წრეები", gap: "სხვაობა", totalCompetitors: "მანქანები", waitingData: "მონაცემების მოლოდინი...",
        boxThisLap: "🏁 შედი ამ წრეზე", boxNextLap: "📢 შედი მომდევნო წრეზე", stayOut: "დარჩი ტრასაზე", onTrack: "ტრასაზე", inPit: "ბოქსში",
        driverEntryHint: "შეიყვანეთ რბოლის ID დასაკავშირებლად", driverEntryLabel: "რბოლის ID", driverConnect: "დაკავშირება მძღოლად", driverIdTooShort: "ID ძალიან მოკლეა", joinAsDriver: "შეუერთდი მძღოლად", backToSetup: "← უკან პარამეტრებზე",
        nextStintIn: "შენი შემდეგი სტინტი", stayAwake: "დარჩი ფხიზლად", sleepOk: "შეგიძლია დაიძინო", yourStints: "შენი სტინტები", noStintsFound: "სტინტები ვერ მოიძებნა", wakeUpAlert: "⏰ გაიღვიძე! შენი სტინტი ახლოვდება",
        viewerNameHint: "შეიყვანე სახელი რბოლაში შესაერთებლად", viewerNameLabel: "შენი სახელი", requestToJoin: "მოითხოვე შეერთება", waitingForApproval: "მოლოდინში ადმინის თანხმობაზე...", waitingForApprovalHint: "რბოლის ადმინისტრატორი დაამტკიცებს თქვენს მოთხოვნას", viewerNameTooShort: "სახელი უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს",
        proFeature: "Pro ფუნქცია", proUpgradeTitle: "⭐ გადასვლა Pro-ზე", proUpgradeMsg: "გახსენით ლაივ ქრონომეტრაჟი, AI სტრატეგია, ჯგუფები, შეუზღუდავი მძღოლები და თემები, და სხვა!", proActivate: "ლიცენზიის გააქტიურება", proDeactivate: "გაუქმება", proEnterKey: "შეიყვანეთ ლიცენზიის გასაღები...", proInvalidKey: "არასწორი ლიცენზიის გასაღები", proActivated: "⭐ Pro გააქტიურებულია!", proBadge: "PRO", proRequired: "საჭიროებს Pro-ს", proHaveCoupon: "🎟️ გაქვთ კუპონის კოდი?", proApplyCoupon: "გამოყენება",
        onboardTitle1: "კეთილი იყოს თქვენი მობრძანება Streger-ში!", onboardDesc1: "თქვენი პიტ-სტრატეგიის ასისტენტი გამძლეობის კარტინგის რბოლებისთვის. დააყენეთ პირველი რბოლა 3 მარტივ ნაბიჯში.",
        onboardTitle2: "დააყენეთ რბოლა", onboardDesc2: "შეიყვანეთ რბოლის ხანგრძლივობა, სავალდებულო გაჩერებები და სტინტის მინ/მაქს დროები ზემოთ. დაამატეთ მძღოლები ქვემოთ — აირჩიეთ სტარტერი და მიანიჭეთ ჯგუფები ღამის ცვლებისთვის.",
        onboardTitle3: "წინასწარი ხედვა და კორექტირება", onboardDesc3: "დააჭირეთ 'სტრატეგიის ნახვა' სრული გეგმის სანახავად. გადაათრიეთ სტინტები თანმიმდევრობის შესაცვლელად, შეცვალეთ ხანგრძლივობა ან შეინახეთ ღრუბელში.",
        onboardTitle4: "რბოლაზე!", onboardDesc4: "დააჭირეთ 'რბოლის დაწყება' და ლაივ დაფა ჩაირთვება — თვალი ადევნეთ ტაიმერებს, მიიღეთ პიტ-შეტყობინებები, გააზიარეთ ლინკი გუნდთან და მართეთ მძღოლთა ცვლა რეალურ დროში.",
        onboardSkip: "გამოტოვება", onboardNext: "შემდეგი", onboardDone: "წავედით!",
        appTitle: "Streger",
        aiOptimize: "AI სტრატეგიის ოპტიმიზაცია",
        raceFinished: "რბოლა დასრულდა", totalPitTime: "პიტის დრო", raceStart: "სტარტი", pitLog: "პიტ-სტოპების ჟურნალი", drove: "მართა", pitNoun: "პიტი", driveNoun: "რბოლა", stints: "სტინტები", avgStint: "საშ.",
        demoSelectFeatures: "აირჩიეთ Pro ფუნქციები ტესტირებისთვის", demoLiveTimingDesc: "20 გუნდის სიმულაცია", demoRainLabel: "წვიმის სიმულაცია", demoRainDesc: "შემთხვევითი წვიმის მოვლენები ტემპის ცვლილებით", demoPenaltyDesc: "შემთხვევითი ჯარიმები და დროის დამატება", demoTiresLabel: "საბურავების ცვეთა", demoTiresDesc: "წრის დრო იზრდება სტინტის განმავლობაში", demoSquadsLabel: "ჯგუფები", demoSquadsDesc: "მძღოლების ჯგუფები როტაციით", demoFuelLabel: "საწვავის მართვა", demoFuelDesc: "საწვავის დონის თვალყურის დევნება",
        unitMin: "წთ", unitHour: "სთ",
        soundMute: "დადუმება", soundUnmute: "ხმის ჩართვა",
        undoPit: "გაუქმება", undoPitToast: "პიტი გაუქმებულია", undoCountdown: "გაუქმება",
        exportPdf: "PDF ექსპორტი", exportImage: "გაზიარება სურათად", exportingPdf: "PDF-ის გენერაცია...",
    },
    de: {
        ltSearchType: "Filter nach:", ltTeam: "Team", ltDriver: "Fahrer", ltKart: "Kart Nr.", ltPlaceholder: "Suchen...", previewTitle: "Strategievorschau", addToCalendar: "Zum Kalender hinzufügen", timeline: "Zeitleiste", driverSchedule: "Fahrerplan", totalTime: "Gesamtzeit", close: "Schließen",
        googleLogin: "Mit Google anmelden", eventCreated: "Ereignis erstellt!", eventError: "Erstellungsfehler", raceEventTitle: "Ausdauerrennen", errImpossible: "Unmögliche Strategie!", errAvgHigh: "Durchschn. > Max. Stopps hinzufügen.", errAvgLow: "Durchschn. < Min. Stopps reduzieren.",
        appSubtitle: "Strategie-Manager", generalInfo: "Allgemeine Informationen", advancedConstraints: "Erweiterte Einschränkungen", driverConfig: "Fahrer", aiTitle: "KI-Strategie", lblDuration: "Dauer (Std.)", lblStops: "Erforderliche Stops", lblMinStint: "Min. Stint", lblMaxStint: "Max. Stint", lblPitTime: "Boxenzeit", lblPitClosedStart: "🚫 Start geschlossen", lblPitClosedEnd: "🚫 Ende geschlossen",
        lblMinDrive: "Min. Gesamt (min)", lblMaxDrive: "Max. Gesamt (min)", lblBuffer: "Warnung (s)", lblDoubles: "Doppel erlauben", lblSquads: "Staffeln verwenden", lblFuel: "Kraftstoff", lblFuelTank: "Tank (min)", addDriver: "+ Hinzufügen", generateStrategy: "Generieren (KI)", previewStrategy: "Vorschau", startRace: "Starten", loadSaved: "Laden",
        raceTime: "RENNZEIT", stops: "STOPS", live: "LIVE", stop: "Stop", pos: "POS", last: "LETZTE", best: "BESTE", targetStint: "ZIEL-STINT", buildTime: "AUFBAUZEIT", current: "AKTUELL", stintTime: "STINT-ZEIT", nextDriver: "Nächster", penalty: "Strafe", enterPit: "BOXEN FAHREN", push: "PUSH", problem: "PROBLEM",
        resetMode: "Zurücksetzen", nightMode: "NACHTMODUS", dry: "Trocken", wet: "Regen", drying: "Trocknet", boxNow: "JETZT BOXEN!", stayOnTrackUntilFurther: "Bleiben Sie auf der Strecke bis auf Weiteres", pushMode: "PUSH-MODUS", squadSleeping: "STAFFEL SCHLÄFT", squadWakeUp: "STAFFEL WECKEN", finalLap: "Letzte Runde", calculating: "Berechnung...", manualInput: "Manuell",
        saveStratTitle: "Speichern", libTitle: "Bibliothek", aiPlaceholder: "z.B.: 'Fahrer 1 bevorzugt...'", thStart: "Start", thEnd: "Ende", thType: "Typ", thDriver: "Fahrer", thDuration: "Dauer", liveTiming: "Live-Zeitmessung", liveTimingUrl: "Zeitmessung URL...", connectLive: "Verbinden", disconnectLive: "Trennen", searchTeam: "Team suchen...", searchDriver: "Fahrer suchen...", searchKart: "Kart suchen...", demoMode: "Demo-Modus",
        sendEmail: "Senden", cancel: "Abbrechen", create: "Erstellen", save: "Speichern", load: "Laden", delete: "Löschen", activeRaceFound: "Aktives Rennen gefunden", continueRace: "Fortfahren", discardRace: "Verwerfen", areYouSure: "Bist du sicher?", deleteWarning: "Dies löscht Daten dauerhaft.", yesDelete: "Ja, löschen", noKeep: "Nein, behalten", invite: "Einladen", synced: "Synchronisiert",
        chatTitle: "Renn-Chat / Q&A", enterName: "Geben Sie Ihren Namen ein", startChat: "Chat starten", typeMessage: "Schreibe einen Vorschlag...", send: "Senden", viewer: "Zuschauer", host: "HOST", suggestion: "Vorschlag", strategyOutlook: "STRATEGIEAUSBLICK", timeLeft: "VERBLEIBENDE ZEIT", penalty: "STRAFE", enterPit: "BOXEN FAHREN", nextDriverLabel: "NÄCHSTER FAHRER", totalHeader: "GESAMT", stopsHeader: "STINTS", driverHeader: "FAHRER",
        stintsLeft: "STINTS VERBLEIBEND", future: "ZUKUNFT", max: "MAX", min: "MIN", rest: "RUHE", buffer: "Puffer", impossible: "UNMÖGLICH", addStop: "STOP HINZUFÜGEN", avg: "DURCHSCHN.", finalLap: "LETZTE RUNDE", inPit: "IN DEN BOXEN", nextLabel: "Nächster", shortStintMsg: "⚠️ KURZER STINT! Strafrisiko", cancelEntry: "Abbrechen", notifyDriver: "📢 Fahrer benachrichtigen", driverNotified: "✓ Fahrer benachrichtigt", includesAdj: "Enthält Anpassung:", missingSeconds: "Fehlend", proceedToPit: "Zu den Boxen fahren?", wait: "WARTEN...", getReady: "VORBEREITEN...", go: "LOS! LOS! LOS!", goOutIn: "RAUS IN", orangeZone: "⚠️ Orangezone - nur BENACHRICHTIGEN", targetLabel: "ZIEL", driverLink: "Fahrer-Link", tapToPit: "TIPPEN ZUM BOXEN", tapToExit: "TIPPEN ZUM AUSFAHREN", pitsConfirm: "BOXEN?", tapAgainConfirm: "ERNEUT TIPPEN ZUM BESTÄTIGEN", stintBest: "S.BEST",
        googleLoginBtn: "Anmelden",
        testBtn: "Test",
        demoBtn: "Demo",
        demoRace: "Demo",
        countdownPrefix: "Rennen in",
        countdownGo: "RENNZEIT! Jetzt starten!",
        countdownAlert: "⏰ Rennen in {min} Minuten!",
        autoStarting: "Automatischer Start...",
        lblAutoStart: "Autostart zur Rennzeit",
        lblDoublesHint: "Derselbe Fahrer hintereinander",
        lblSquadsHint: "Staffelrotation für Nachtschichten & Langstreckenrennen", lblSquadsHintActive: "Fahrer in {n} rotierende Gruppen aufgeteilt",
        lblFuelHint: "Intelligente Kraftstoffbeschränkungen & Tankmanagement",
        statusHeader: "Status",
        onTrack: "Auf der Strecke",
        inPits: "In der Box",
        squadSwitch: "Team wechseln",
        viewerApprovalRequest: "Bitte um Zutritt",
        approveViewer: "Zustimmen",
        rejectViewer: "Ablehnen",
        removeViewer: "Entfernen",
        approvalPending: "Genehmigung Ausstehend",
        approvalRejected: "Ihre Anfrage wurde vom Host abgelehnt",
        bugReport: "Fehler Melden",
        featureSuggestion: "Funktion Vorschlagen",
        bugReportTitle: "Fehlerbericht",
        featureSuggestionTitle: "Funktionsvorschlag",
        describeIssue: "Beschreiben Sie das Problem oder den Vorschlag...",
        send: "Senden",
        feedbackTitle: "Rückmeldung",
        contactUs: "Kontakt",
        goodPace: "Gutes Tempo",
        lblStartTime: "🕐 Startzeit", lblStartDate: "📅 Renndatum",
        lblSquadSchedule: "🔄 Staffelfenster", lblSquadScheduleHint: "Außerhalb des Fensters teilen alle Fahrer gleich. Innerhalb rotieren Staffeln gleichmäßig.",
        lblSquadWindowStart: "Fenster Beginn", lblSquadWindowEnd: "Fenster Ende",
        squadOff: "Aus", squad2: "2 Staffeln", squad3: "3 Staffeln", squad4: "4 Staffeln",
        lblAppearance: "🎨 Darstellung", lblPageBg: "Seitenhintergrund", lblColorThemes: "Farbthemen",
        laps: "RUNDEN", gap: "ABSTAND", totalCompetitors: "AUTOS", waitingData: "Warte auf Daten...",
        boxThisLap: "🏁 BOX DIESE RUNDE", boxNextLap: "📢 BOX NÄCHSTE RUNDE", stayOut: "DRAUSSEN BLEIBEN", onTrack: "AUF DER STRECKE", inPit: "IN DER BOX",
        driverEntryHint: "Rennen-ID eingeben zum Verbinden", driverEntryLabel: "Rennen-ID", driverConnect: "Als Fahrer verbinden", driverIdTooShort: "ID ist zu kurz", joinAsDriver: "Als Fahrer beitreten", backToSetup: "← Zurück zur Einrichtung",
        nextStintIn: "Dein nächster Stint in", stayAwake: "Bleib wach", sleepOk: "Du kannst schlafen", yourStints: "Deine Stints", noStintsFound: "Keine Stints für dich gefunden", wakeUpAlert: "⏰ Aufwachen! Dein Stint kommt",
        viewerNameHint: "Gib deinen Namen ein, um dem Rennen beizutreten", viewerNameLabel: "Dein Name", requestToJoin: "Beitritt anfragen", waitingForApproval: "Warte auf Genehmigung...", waitingForApprovalHint: "Der Rennadministrator wird deine Anfrage genehmigen", viewerNameTooShort: "Name muss mindestens 2 Zeichen haben",
        proFeature: "Pro-Funktion", proUpgradeTitle: "⭐ Auf Pro upgraden", proUpgradeMsg: "Schalte Live-Zeitmessung, KI-Strategie, Staffeln, unbegrenzte Fahrer & Themes und mehr frei!", proActivate: "Lizenz aktivieren", proDeactivate: "Deaktivieren", proEnterKey: "Lizenzschlüssel eingeben...", proInvalidKey: "Ungültiger Lizenzschlüssel", proActivated: "⭐ Pro Aktiviert!", proBadge: "PRO", proRequired: "erfordert Pro", proHaveCoupon: "🎟️ Haben Sie einen Gutscheincode?", proApplyCoupon: "Anwenden",
        onboardTitle1: "Willkommen bei Streger!", onboardDesc1: "Dein Boxenstrategie-Assistent für Langstrecken-Kartrennen. Richte dein erstes Rennen in 3 einfachen Schritten ein.",
        onboardTitle2: "Rennen einrichten", onboardDesc2: "Gib Renndauer, Pflichtstopps und Stint-Zeiten (min/max) oben ein. Füge deine Fahrer unten hinzu — wähle den Startfahrer und weise Staffeln für Nachtschichten zu.",
        onboardTitle3: "Vorschau & Feintuning", onboardDesc3: "Tippe auf 'Strategie-Vorschau' für den kompletten Stint-Plan. Ziehe Stints zum Umordnen, passe Dauern an oder speichere deinen Plan in der Cloud.",
        onboardTitle4: "Los geht's!", onboardDesc4: "Drücke 'Rennen starten' und das Live-Dashboard übernimmt — verfolge Timer, erhalte Box-Warnungen, teile einen Live-Link mit deinem Team und manage Fahrerwechsel in Echtzeit.",
        onboardSkip: "Überspringen", onboardNext: "Weiter", onboardDone: "Auf geht's!",
        appTitle: "Streger",
        aiOptimize: "KI-Strategie optimieren",
        raceFinished: "RENNEN BEENDET", totalPitTime: "Boxenzeit", raceStart: "Start", pitLog: "Boxenstopp-Protokoll", drove: "Gefahren", pitNoun: "Box", driveNoun: "Fahrt", stints: "Stints", avgStint: "Ø",
        demoSelectFeatures: "Pro-Funktionen zum Testen auswählen", demoLiveTimingDesc: "Simulierte 20-Team-Rangliste", demoRainLabel: "Regensimulation", demoRainDesc: "Zufällige Regenereignisse mit Tempowechsel", demoPenaltyDesc: "Zufällige Strafen und Zeitzuschläge", demoTiresLabel: "Reifenverschleiß", demoTiresDesc: "Rundenzeiten steigen im Laufe des Stints", demoSquadsLabel: "Staffeln", demoSquadsDesc: "Fahrergruppen mit Rotation", demoFuelLabel: "Kraftstoffmanagement", demoFuelDesc: "Kraftstoffstand verfolgen und tanken",
        unitMin: "Min", unitHour: "Std",
        soundMute: "Stummschalten", soundUnmute: "Ton einschalten",
        undoPit: "Pit rückgängig", undoPitToast: "Pit-Einfahrt rückgängig", undoCountdown: "Rückgängig",
        exportPdf: "PDF exportieren", exportImage: "Als Bild teilen", exportingPdf: "PDF wird erstellt...",
    },
    ja: {
        ltSearchType: "フィルタリング:", ltTeam: "チーム", ltDriver: "ドライバー", ltKart: "カート番号", ltPlaceholder: "検索...", previewTitle: "戦略プレビュー", addToCalendar: "カレンダーに追加", timeline: "タイムライン", driverSchedule: "ドライバースケジュール", totalTime: "総時間", close: "閉じる",
        googleLogin: "Googleでログイン", eventCreated: "イベントが作成されました!", eventError: "作成エラー", raceEventTitle: "耐久レース", errImpossible: "不可能な戦略!", errAvgHigh: "平均 > 最大。ピットストップを追加してください。", errAvgLow: "平均 < 最小。ピットストップを減らしてください。",
        appSubtitle: "戦略マネージャー", generalInfo: "一般情報", advancedConstraints: "高度な制約", driverConfig: "ドライバー", aiTitle: "AI戦略", lblDuration: "期間 (時間)", lblStops: "必要なピットストップ", lblMinStint: "最小スティント", lblMaxStint: "最大スティント", lblPitTime: "ピットタイム", lblPitClosedStart: "🚫 開始時に閉鎖", lblPitClosedEnd: "🚫 終了時に閉鎖",
        lblMinDrive: "最小合計 (分)", lblMaxDrive: "最大合計 (分)", lblBuffer: "警告 (秒)", lblDoubles: "ダブルを許可", lblSquads: "スクワッドを使用", lblFuel: "燃料", lblFuelTank: "燃料タンク (分)", addDriver: "+ 追加", generateStrategy: "生成 (AI)", previewStrategy: "プレビュー", startRace: "スタート", loadSaved: "読み込み",
        raceTime: "レース時間", stops: "ピット", live: "ライブ", stop: "停止", pos: "POS", last: "ラスト", best: "ベスト", targetStint: "ターゲットスティント", buildTime: "タイム構築", current: "現在", stintTime: "スティントタイム", nextDriver: "次のドライバー", penalty: "ペナルティ", enterPit: "ピット進入", push: "プッシュ", problem: "問題",
        resetMode: "リセット", nightMode: "ナイトモード", dry: "ドライ", wet: "ウェット", drying: "乾燥中", boxNow: "今ピット!", stayOnTrackUntilFurther: "さらに指示があるまでトラックに留まってください", pushMode: "プッシュモード", squadSleeping: "スクワッド休止中", squadWakeUp: "スクワッド起動", finalLap: "ファイナルラップ", calculating: "計算中...", manualInput: "手動入力",
        saveStratTitle: "保存", libTitle: "ライブラリ", aiPlaceholder: "例: 'ドライバー1は...を好む'", thStart: "開始", thEnd: "終了", thType: "タイプ", thDriver: "ドライバー", thDuration: "期間", liveTiming: "ライブタイミング", liveTimingUrl: "ライブタイミングURL...", connectLive: "接続", disconnectLive: "切断", searchTeam: "チームを検索...", searchDriver: "ドライバーを検索...", searchKart: "カートを検索...", demoMode: "デモモード",
        sendEmail: "送信", cancel: "キャンセル", create: "作成", save: "保存", load: "読み込み", delete: "削除", activeRaceFound: "アクティブなレースが見つかりました", continueRace: "続行", discardRace: "破棄", areYouSure: "本当にしますか?", deleteWarning: "これはデータを永久に削除します。", yesDelete: "はい、削除", noKeep: "いいえ、保持", invite: "招待", synced: "同期済み",
        chatTitle: "レースチャット / Q&A", enterName: "名前を入力", startChat: "チャットを開始", typeMessage: "提案を入力...", send: "送信", viewer: "視聴者", host: "ホスト", suggestion: "提案", strategyOutlook: "戦略見通し", timeLeft: "残り時間", penalty: "ペナルティ", enterPit: "ピット進入", nextDriverLabel: "次のドライバー", totalHeader: "合計", stopsHeader: "スティント", driverHeader: "ドライバー",
        stintsLeft: "残りスティント", future: "将来", max: "最大", min: "最小", rest: "休息", buffer: "バッファ", impossible: "不可能", addStop: "ピットストップ追加", avg: "平均", finalLap: "ファイナルラップ", inPit: "ピット内", nextLabel: "次", shortStintMsg: "⚠️ 短いスティント!ペナルティリスク", cancelEntry: "キャンセル", notifyDriver: "📢 ドライバーに通知", driverNotified: "✓ ドライバーに通知済み", includesAdj: "調整を含む:", missingSeconds: "不足", proceedToPit: "ピットに進む?", wait: "待機中...", getReady: "準備中...", go: "行け! 行け!", goOutIn: "あと", orangeZone: "⚠️ オレンジゾーン - 通知のみ", targetLabel: "ターゲット", driverLink: "ドライバーリンク", tapToPit: "タップしてピットイン", tapToExit: "タップしてピットアウト", pitsConfirm: "ピット?", tapAgainConfirm: "もう一度タップして確認", stintBest: "S.ベスト",
        googleLoginBtn: "ログイン",
        testBtn: "テスト",
        demoBtn: "デモ",
        demoRace: "デモ",
        countdownPrefix: "レースまで",
        countdownGo: "レース時間！今すぐスタート！",
        countdownAlert: "⏰ レースまで{min}分！",
        autoStarting: "自動スタート中...",
        lblAutoStart: "レース時間に自動スタート",
        lblDoublesHint: "同じドライバーが連続",
        lblSquadsHint: "夜間シフトとロングレース用のグループローテーション", lblSquadsHintActive: "ドライバーが{n}つのローテーショングループに分割",
        lblFuelHint: "スマート燃料制約とタンク管理",
        statusHeader: "ステータス",
        onTrack: "トラック上",
        inPits: "ピット内",
        squadSwitch: "チーム変更",
        viewerApprovalRequest: "参加をリクエスト中",
        approveViewer: "承認",
        rejectViewer: "拒否",
        removeViewer: "削除",
        approvalPending: "承認待機",
        approvalRejected: "あなたのリクエストはホストに拒否されました",
        bugReport: "バグを報告",
        featureSuggestion: "機能を提案",
        bugReportTitle: "バグレポート",
        featureSuggestionTitle: "機能提案",
        describeIssue: "問題または提案を説明してください...",
        send: "送信",
        feedbackTitle: "フィードバック",
        contactUs: "お問い合わせ",
        goodPace: "良いペース",
        lblStartTime: "🕐 レース開始時刻", lblStartDate: "📅 レース日",
        lblSquadSchedule: "🔄 スクワッドウィンドウ", lblSquadScheduleHint: "ウィンドウ外は全ドライバーが均等に分担。ウィンドウ内はスクワッドが均等にローテーション。",
        lblSquadWindowStart: "開始時刻", lblSquadWindowEnd: "終了時刻",
        squadOff: "オフ", squad2: "2スクワッド", squad3: "3スクワッド", squad4: "4スクワッド",
        lblAppearance: "🎨 外観", lblPageBg: "ページ背景", lblColorThemes: "カラーテーマ",
        laps: "周回", gap: "差", totalCompetitors: "台数", waitingData: "データ待機中...",
        boxThisLap: "🏁 今周ピットイン", boxNextLap: "📢 次周ピットイン", stayOut: "ステイアウト", onTrack: "走行中", inPit: "ピット内",
        driverEntryHint: "レースIDを入力して接続", driverEntryLabel: "レースID", driverConnect: "ドライバーとして接続", driverIdTooShort: "IDが短すぎます", joinAsDriver: "ドライバーとして参加", backToSetup: "← セットアップに戻る",
        nextStintIn: "次のスティントまで", stayAwake: "起きていて", sleepOk: "寝ても大丈夫", yourStints: "あなたのスティント", noStintsFound: "スティントが見つかりません", wakeUpAlert: "⏰ 起きて！スティントが近づいています",
        viewerNameHint: "レースに参加するために名前を入力してください", viewerNameLabel: "あなたの名前", requestToJoin: "参加をリクエスト", waitingForApproval: "承認を待っています...", waitingForApprovalHint: "レース管理者があなたのリクエストを承認します", viewerNameTooShort: "名前は2文字以上必要です",
        onboardTitle1: "Stregerへようこそ！", onboardDesc1: "耐久カートレース用のピット戦略アシスタントです。3つの簡単なステップで最初のレースをセットアップしましょう。",
        onboardTitle2: "レースを設定", onboardDesc2: "上部でレース時間、必須ピットストップ数、スティントの最小/最大時間を入力。下にドライバーを追加 — スターターを選び、夜間シフト用にスクワッドを割り当てます。",
        proFeature: "Pro機能", proUpgradeTitle: "⭐ Proにアップグレード", proUpgradeMsg: "ライブタイミング、AI戦略、スクワッド、無制限のドライバーとテーマなどをアンロック！", proActivate: "ライセンスを有効化", proDeactivate: "無効化", proEnterKey: "ライセンスキーを入力...", proInvalidKey: "無効なライセンスキー", proActivated: "⭐ Pro有効化！", proBadge: "PRO", proRequired: "Proが必要", proHaveCoupon: "🎟️ クーポンコードをお持ちですか？", proApplyCoupon: "適用",
        onboardTitle3: "プレビューと調整", onboardDesc3: "「戦略プレビュー」をタップして完全なスティント計画を確認。ドラッグで並べ替え、時間を調整、またはクラウドに保存できます。",
        onboardTitle4: "レーススタート！", onboardDesc4: "「レース開始」を押すとライブダッシュボードが起動 — タイマーを追跡、ピットアラートを受信、チームとライブリンクを共有、ドライバー交代をリアルタイムで管理。",
        onboardSkip: "スキップ", onboardNext: "次へ", onboardDone: "始めよう！",
        appTitle: "Streger",
        aiOptimize: "AI戦略最適化",
        raceFinished: "レース終了", totalPitTime: "ピット時間", raceStart: "スタート", pitLog: "ピットストップ記録", drove: "走行", pitNoun: "ピット", driveNoun: "走行", stints: "スティント", avgStint: "平均",
        demoSelectFeatures: "テストするPro機能を選択", demoLiveTimingDesc: "20チームのシミュレーション", demoRainLabel: "雨のシミュレーション", demoRainDesc: "ランダムな降雨イベントとペース変化", demoPenaltyDesc: "ランダムなペナルティと加算時間", demoTiresLabel: "タイヤ劣化", demoTiresDesc: "スティント中にラップタイムが増加", demoSquadsLabel: "スクワッド", demoSquadsDesc: "ドライバーグループのローテーション", demoFuelLabel: "燃料管理", demoFuelDesc: "燃料レベルの追跡と給油",
        unitMin: "分", unitHour: "時",
        soundMute: "ミュート", soundUnmute: "ミュート解除",
        undoPit: "ピット取消", undoPitToast: "ピット入場取消", undoCountdown: "取消",
        exportPdf: "PDFエクスポート", exportImage: "画像で共有", exportingPdf: "PDF生成中...",
    },
    el: {
        ltSearchType: "Φιλτράρισμα:", ltTeam: "Ομάδα", ltDriver: "Οδηγός", ltKart: "Καρτ αρ.", ltPlaceholder: "Αναζήτηση...",
        previewTitle: "Προεπισκόπηση Στρατηγικής", addToCalendar: "Προσθήκη στο ημερολόγιο", timeline: "Χρονοδιάγραμμα", driverSchedule: "Πρόγραμμα Οδηγών", totalTime: "Συνολικός Χρόνος", close: "Κλείσιμο",
        googleLogin: "Σύνδεση με Google", eventCreated: "Το γεγονός δημιουργήθηκε!", eventError: "Σφάλμα δημιουργίας", raceEventTitle: "Αγώνας αντοχής",
        errImpossible: "Αδύνατη στρατηγική!", errAvgHigh: "Μέσος > Μέγιστος. Προσθέστε στάσεις.", errAvgLow: "Μέσος < Ελάχιστος. Μειώστε στάσεις.",
        appSubtitle: "Διαχειριστής Στρατηγικής", generalInfo: "Γενικές Πληροφορίες", advancedConstraints: "Προχωρημένοι Περιορισμοί", driverConfig: "Οδηγοί", aiTitle: "Στρατηγική AI",
        lblDuration: "Διάρκεια (Ω)", lblStops: "Απαιτ. στάσεις", lblMinStint: "Ελάχ. stint", lblMaxStint: "Μέγ. stint", lblPitTime: "Χρόνος pit", lblPitClosedStart: "🚫 Κλειστό στην αρχή", lblPitClosedEnd: "🚫 Κλειστό στο τέλος",
        lblMinDrive: "Ελάχ. σύνολο (λεπ)", lblMaxDrive: "Μέγ. σύνολο (λεπ)", lblBuffer: "Ειδοποίηση (δευτ)", lblDoubles: "Επιτρεπτά διπλά", lblSquads: "Χρήση ομάδων", lblFuel: "Καύσιμο", lblFuelTank: "Ντεπόζιτο (λεπ)",
        addDriver: "+ Προσθήκη", generateStrategy: "Δημιουργία (AI)", previewStrategy: "Προεπισκόπηση", startRace: "Εκκίνηση", loadSaved: "Φόρτωση",
        raceTime: "ΧΡΟΝΟΣ ΑΓΩΝΑ", stops: "ΣΤΑΣΕΙΣ", live: "LIVE", stop: "Στοπ", pos: "ΘΕΣ", last: "ΤΕΛ", best: "ΚΑΛ", targetStint: "ΣΤΟΧΟΣ STINT", buildTime: "ΧΡΟΝΟΣ ΚΑΤΑΣΚ",
        current: "ΤΡΕΧΩΝ", stintTime: "ΧΡΟΝΟΣ STINT", nextDriver: "Επόμενος", penalty: "Ποινή", enterPit: "ΕΙΣΟΔΟΣ PIT", push: "ΠΙΕΣΗ", problem: "ΠΡΟΒΛΗΜΑ",
        resetMode: "Επαναφορά", nightMode: "ΝΥΧΤΕΡΙΝΗ ΛΕΙΤ.", dry: "Στεγνό", wet: "Βρεγμένο", drying: "Στεγνώνει", boxNow: "PIT ΤΩΡΑ!", stayOnTrackUntilFurther: "Μείνετε στην πίστα μέχρι νεοτέρας", pushMode: "ΛΕΙΤ. ΠΙΕΣΗΣ",
        squadSleeping: "ΟΜΑΔΑ ΚΟΙΜΑΤΑΙ", squadWakeUp: "ΞΥΠΝΗΜΑ ΟΜΑΔΑΣ", finalLap: "Τελευταίος γύρος", calculating: "Υπολογισμός...", manualInput: "Χειροκίνητα",
        saveStratTitle: "Αποθήκευση", libTitle: "Βιβλιοθήκη", aiPlaceholder: "πχ: 'Ο οδηγός 1 προτιμά...'",
        thStart: "Αρχή", thEnd: "Τέλος", thType: "Τύπος", thDriver: "Οδηγός", thDuration: "Διάρκεια",
        liveTiming: "Live χρονομέτρηση", liveTimingUrl: "URL χρονομέτρησης...", connectLive: "Σύνδεση", disconnectLive: "Αποσύνδεση", searchTeam: "Αναζήτηση ομάδας...", searchDriver: "Αναζήτηση οδηγού...", searchKart: "Αναζήτηση καρτ...", demoMode: "Λειτουργία demo",
        sendEmail: "Αποστολή", cancel: "Ακύρωση", create: "Δημιουργία", save: "Αποθήκευση", load: "Φόρτωση", delete: "Διαγραφή",
        activeRaceFound: "Βρέθηκε ενεργός αγώνας", continueRace: "Συνέχεια", discardRace: "Απόρριψη",
        areYouSure: "Είστε σίγουροι;", deleteWarning: "Αυτό θα διαγράψει τα δεδομένα μόνιμα.", yesDelete: "Ναι, διαγραφή", noKeep: "Όχι, κράτα",
        invite: "Πρόσκληση", synced: "Συγχρονισμένο",
        chatTitle: "Chat αγώνα / Ε&Α", enterName: "Εισάγετε το όνομά σας", startChat: "Έναρξη chat", typeMessage: "Γράψτε μια πρόταση...", send: "Αποστολή", viewer: "Θεατής", host: "ΟΙΚΟΔΕΣΠΟΤΗΣ", suggestion: "Πρόταση",
        strategyOutlook: "ΠΡΟΟΠΤΙΚΗ ΣΤΡΑΤΗΓΙΚΗΣ",
        timeLeft: "ΥΠΟΛ. ΧΡΟΝΟΣ",
        penalty: "ΠΟΙΝΗ",
        enterPit: "ΕΙΣΟΔΟΣ PIT",
        nextDriverLabel: "ΕΠΟΜΕΝΟΣ ΟΔΗΓΟΣ",
        totalHeader: "ΣΥΝΟΛΟ",
        stopsHeader: "STINTS",
        driverHeader: "ΟΔΗΓΟΣ",
        stintsLeft: "ΥΠΟΛ. STINTS",
        future: "ΜΕΛΛΟΝ",
        max: "ΜΕΓ",
        min: "ΕΛΑΧ",
        rest: "ΥΠΟΛΟΙΠΟ",
        buffer: "Απόθεμα",
        impossible: "ΑΔΥΝΑΤΟ",
        addStop: "ΠΡΟΣΘΗΚΗ ΣΤΑΣΗΣ",
        avg: "ΜΕΣ",
        finalLap: "ΤΕΛΕΥΤΑΙΟΣ ΓΥΡΟΣ",
        inPit: "ΣΤΟ PIT",
        nextLabel: "Επόμενος",
        shortStintMsg: "⚠️ ΜΙΚΡΟ STINT! Κίνδυνος ποινής",
        cancelEntry: "Ακύρωση",
        notifyDriver: "📢 Ειδοποίηση οδηγού",
        driverNotified: "✓ Ο οδηγός ειδοποιήθηκε",
        includesAdj: "Περιλαμβάνει προσαρμογή:",
        missingSeconds: "Λείπει",
        proceedToPit: "Συνέχεια στο pit;",
        wait: "ΠΕΡΙΜΕΝΕ...",
        getReady: "ΕΤΟΙΜΑΣΟΥ...",
        go: "ΠΑΜΕ!",
        goOutIn: "ΒΓΕΣ ΣΕ",
        exitPits: "Exit Pits",
        driverExitedEarly: "Ο οδηγός βγήκε νωρίς",
        driverExitedEarlyNotice: "Ο οδηγός βγήκε από τα pits πριν από τον απαιτούμενο χρόνο – επιβεβαιώστε για αποδοχή.",
        orangeZone: "⚠️ Πορτοκαλί ζώνη - μόνο ΕΙΔΟΠΟΙΗΣΗ",
        targetLabel: "ΣΤΟΧΟΣ",
        driverLink: "Σύνδεσμος οδηγού",
        tapToPit: "ΠΑΤΗΣΤΕ ΓΙΑ ΕΙΣΟΔΟ ΣΤΟ PIT",
        tapToExit: "ΠΑΤΗΣΤΕ ΓΙΑ ΕΞΟΔΟ ΑΠΟ ΤΟ PIT",
        pitsConfirm: "PIT;",
        tapAgainConfirm: "ΠΑΤΗΣΤΕ ΞΑΝΑ ΓΙΑ ΕΠΙΒΕΒΑΙΩΣΗ",
        stintBest: "Κ.STINT",
        googleLoginBtn: "Σύνδεση",
        testBtn: "Δοκιμή",
        demoBtn: "Demo",
        demoRace: "Demo",
        countdownPrefix: "Αγώνας σε",
        countdownGo: "ΩΡΑ ΑΓΩΝΑ! Ξεκινήστε τώρα!",
        countdownAlert: "⏰ Αγώνας σε {min} λεπτά!",
        autoStarting: "Αυτόματη εκκίνηση...",
        lblAutoStart: "Αυτόματη εκκίνηση στην ώρα",
        lblDoublesHint: "Ίδιος οδηγός διαδοχικά",
        lblSquadsHint: "Εναλλαγή ομάδων για νυχτερινές βάρδιες & μακρούς αγώνες", lblSquadsHintActive: "Οι οδηγοί χωρίστηκαν σε {n} εναλλασσόμενες ομάδες",
        lblFuelHint: "Έξυπνοι περιορισμοί καυσίμου & διαχείριση ντεπόζιτου",
        statusHeader: "Κατάσταση",
        onTrack: "Στην Πίστα",
        inPits: "Στα Pit",
        squadSwitch: "Αλλαγή Ομάδας",
        viewerApprovalRequest: "Αίτημα συμμετοχής",
        approveViewer: "Έγκριση",
        rejectViewer: "Απόρριψη",
        removeViewer: "Αφαίρεση",
        approvalPending: "Εκκρεμεί Έγκριση",
        approvalRejected: "Το αίτημά σας απορρίφθηκε από τον οικοδεσπότη",
        bugReport: "Αναφορά Σφάλματος",
        featureSuggestion: "Πρόταση Λειτουργίας",
        bugReportTitle: "Αναφορά Σφάλματος",
        featureSuggestionTitle: "Πρόταση Λειτουργίας",
        describeIssue: "Περιγράψτε το πρόβλημα ή την πρόταση...",
        feedbackTitle: "Σχόλια",
        contactUs: "Επικοινωνία",
        goodPace: "Καλός Ρυθμός",
        lblStartTime: "🕐 Ώρα Εκκίνησης", lblStartDate: "📅 Ημερομηνία Αγώνα",
        lblSquadSchedule: "🔄 Παράθυρο Ομάδων", lblSquadScheduleHint: "Εκτός παραθύρου, όλοι οι οδηγοί μοιράζονται ισομερώς. Εντός, οι ομάδες εναλλάσσονται.",
        lblSquadWindowStart: "Αρχή παραθύρου", lblSquadWindowEnd: "Τέλος παραθύρου",
        squadOff: "Ανενεργό", squad2: "2 Ομάδες", squad3: "3 Ομάδες", squad4: "4 Ομάδες",
        lblAppearance: "🎨 Εμφάνιση", lblPageBg: "Φόντο σελίδας", lblColorThemes: "Θέματα χρωμάτων",
        laps: "ΓΥΡΟΙ", gap: "ΔΙΑΦΟΡΑ", totalCompetitors: "ΑΥΤΟΚΙΝΗΤΑ", waitingData: "Αναμονή δεδομένων...",
        boxThisLap: "🏁 PIT ΑΥΤΟ ΤΟΝ ΓΥΡΟ", boxNextLap: "📢 PIT ΕΠΟΜΕΝΟ ΓΥΡΟ", stayOut: "ΜΕΙΝΕ ΕΞΩ", onTrack: "ΣΤΗΝ ΠΙΣΤΑ", inPit: "ΣΤΟ PIT",
        driverEntryHint: "Εισάγετε το ID αγώνα για σύνδεση", driverEntryLabel: "ID Αγώνα", driverConnect: "Σύνδεση ως οδηγός", driverIdTooShort: "Το ID είναι πολύ μικρό", joinAsDriver: "Είσοδος ως οδηγός", backToSetup: "← Πίσω στις ρυθμίσεις",
        nextStintIn: "Το επόμενο stint σας σε", stayAwake: "Μείνε ξύπνιος", sleepOk: "Μπορείς να κοιμηθείς", yourStints: "Τα Stint σας", noStintsFound: "Δεν βρέθηκαν stint για εσάς", wakeUpAlert: "⏰ Ξύπνα! Το stint σου πλησιάζει",
        viewerNameHint: "Εισάγετε το όνομά σας για να συμμετάσχετε στον αγώνα", viewerNameLabel: "Το Όνομά σας", requestToJoin: "Αίτημα Συμμετοχής", waitingForApproval: "Αναμονή έγκρισης...", waitingForApprovalHint: "Ο διαχειριστής του αγώνα θα εγκρίνει το αίτημά σας", viewerNameTooShort: "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες",
        proFeature: "Λειτουργία Pro", proUpgradeTitle: "⭐ Αναβάθμιση σε Pro", proUpgradeMsg: "Ξεκλειδώστε Live Χρονομέτρηση, AI Στρατηγική, Ομάδες, απεριόριστους οδηγούς & θέματα, και πολλά άλλα!", proActivate: "Ενεργοποίηση άδειας", proDeactivate: "Απενεργοποίηση", proEnterKey: "Εισάγετε κλειδί άδειας...", proInvalidKey: "Μη έγκυρο κλειδί άδειας", proActivated: "⭐ Pro Ενεργοποιήθηκε!", proBadge: "PRO", proRequired: "απαιτεί Pro", proHaveCoupon: "🎟️ Έχετε κωδικό κουπονιού;", proApplyCoupon: "Εφαρμογή",
        onboardTitle1: "Καλωσήρθατε στο Streger!", onboardDesc1: "Ο βοηθός στρατηγικής pit για αγώνες αντοχής καρτ. Ρυθμίστε τον πρώτο σας αγώνα σε 3 εύκολα βήματα.",
        onboardTitle2: "Ρυθμίστε τον αγώνα", onboardDesc2: "Εισάγετε διάρκεια, υποχρεωτικές στάσεις και ελάχ./μέγ. χρόνους stint στο πάνω μέρος. Προσθέστε τους οδηγούς σας κάτω — επιλέξτε ποιος ξεκινά και αναθέστε ομάδες για τις νυχτερινές βάρδιες.",
        onboardTitle3: "Προεπισκόπηση & ρυθμίσεις", onboardDesc3: "Πατήστε 'Προεπισκόπηση' για να δείτε το πλήρες πλάνο stint. Σύρετε για αναδιάταξη, ρυθμίστε τις διάρκειες ή αποθηκεύστε το πλάνο στο cloud.",
        onboardTitle4: "Ξεκινάμε!", onboardDesc4: "Πατήστε 'Εκκίνηση' και το live dashboard αναλαμβάνει — παρακολουθήστε χρονόμετρα, λάβετε ειδοποιήσεις pit, μοιραστείτε σύνδεσμο με την ομάδα σας και διαχειριστείτε αλλαγές οδηγών σε πραγματικό χρόνο.",
        onboardSkip: "Παράλειψη", onboardNext: "Επόμενο", onboardDone: "Πάμε!",
        appTitle: "Streger",
        aiOptimize: "Βελτιστοποίηση AI Στρατηγικής",
        raceFinished: "ΑΓΩΝΑΣ ΟΛΟΚΛΗΡΩΘΗΚΕ", totalPitTime: "Χρόνος Pit", raceStart: "Εκκίνηση", pitLog: "Αρχείο Pit Stop", drove: "Οδήγησε", pitNoun: "Pit", driveNoun: "Οδήγηση", stints: "Stints", avgStint: "Μέσος",
        demoSelectFeatures: "Επιλέξτε λειτουργίες Pro για δοκιμή", demoLiveTimingDesc: "Προσομοίωση 20 ομάδων", demoRainLabel: "Προσομοίωση βροχής", demoRainDesc: "Τυχαία γεγονότα βροχής με αλλαγή ρυθμού", demoPenaltyDesc: "Τυχαίες ποινές και προσθήκες χρόνου", demoTiresLabel: "Φθορά ελαστικών", demoTiresDesc: "Οι χρόνοι γύρου αυξάνονται κατά τη διάρκεια του stint", demoSquadsLabel: "Ομάδες", demoSquadsDesc: "Ομάδες οδηγών με εναλλαγή", demoFuelLabel: "Διαχείριση καυσίμου", demoFuelDesc: "Παρακολούθηση καυσίμου και ανεφοδιασμός",
        unitMin: "λ", unitHour: "ω",
        soundMute: "Σίγαση", soundUnmute: "Ενεργοποίηση ήχου",
        undoPit: "Αναίρεση Pit", undoPitToast: "Είσοδος pit αναιρέθηκε", undoCountdown: "Αναίρεση",
        exportPdf: "Εξαγωγή PDF", exportImage: "Κοινοποίηση Εικόνας", exportingPdf: "Δημιουργία PDF...",
    }
};

window.t = function(key) {
    // 🟢 Use viewer's own language preference if set
    const lang = window.role === 'viewer' 
        ? localStorage.getItem('strateger_viewer_lang') || localStorage.getItem('strateger_lang') || 'en'
        : localStorage.getItem('strateger_lang') || 'en';
    const dict = window.translations[lang] || window.translations['en'];
    return dict[key] || key;
};

// ==========================================
// 🌍 LANGUAGE SUPPORT
// ==========================================
window.SUPPORTED_LANGUAGES = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'he', name: 'עברית (Hebrew)', flag: '🇮🇱' },
    { code: 'fr', name: 'Français (French)', flag: '🇫🇷' },
    { code: 'pt', name: 'Português (Portuguese)', flag: '🇵🇹' },
    { code: 'ru', name: 'Русский (Russian)', flag: '🇷🇺' },
    { code: 'ar', name: 'العربية (Arabic)', flag: '🇸🇦' },
    { code: 'es', name: 'Español (Spanish)', flag: '🇪🇸' },
    { code: 'it', name: 'Italiano (Italian)', flag: '🇮🇹' },
    { code: 'ka', name: 'ქართული (Georgian)', flag: '🇬🇪' },
    { code: 'de', name: 'Deutsch (German)', flag: '🇩🇪' },
    { code: 'ja', name: '日本語 (Japanese)', flag: '🇯🇵' },
    { code: 'el', name: 'Ελληνικά (Greek)', flag: '🇬🇷' }
];

window.setLanguage = function(lang) {
    // 🟢 Viewers save their language choice independently, doesn't affect host
    if (window.role === 'viewer') {
        localStorage.setItem('strateger_viewer_lang', lang);
    } else {
        localStorage.setItem('strateger_lang', lang);
    }
    
    window.currentLang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = (['he', 'ar'].includes(lang)) ? 'rtl' : 'ltr';

    const langSelect = document.getElementById('langSelect');
    if (langSelect && langSelect.value !== lang) {
        langSelect.value = lang;
    }

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
             el.placeholder = window.t(key);
        } else {
             el.innerText = window.t(key);
        }
    });

    // Translate <option> elements with data-i18n-opt attribute
    document.querySelectorAll('option[data-i18n-opt]').forEach(opt => {
        const key = opt.getAttribute('data-i18n-opt');
        opt.textContent = window.t(key);
    });

    if (typeof window.updateModeUI === 'function') window.updateModeUI();
    if (typeof window.updateWeatherUI === 'function') window.updateWeatherUI();
    if (typeof window.renderFrame === 'function') window.renderFrame();
    if (typeof window.renderPreview === 'function' && window.previewData) window.renderPreview();
    // Re-run sim so simResult text is translated to the new language
    if (typeof window.runSim === 'function' && window.drivers && window.drivers.length > 0) window.runSim();
};

// ==========================================
// 🛠️ HELPERS & PERSISTENCE
// ==========================================

window.formatTimeHMS = function(ms) {
    ms = Math.max(0, ms || 0);
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

// === שמירת טיוטה (Setup Draft) ===
window.saveHostState = function() {
    if (window.role === 'host') {
        const draft = {
            duration: document.getElementById('raceDuration')?.value,
            stops: document.getElementById('reqPitStops')?.value,
            minStint: document.getElementById('minStint')?.value,
            maxStint: document.getElementById('maxStint')?.value,
            drivers: [] 
        };
        
        const driverInputs = document.querySelectorAll('.driver-input');
        driverInputs.forEach(input => {
            draft.drivers.push({ name: input.value });
        });

        localStorage.setItem(window.DRAFT_CONFIG_KEY, JSON.stringify(draft));
    }
};

window.loadDraftConfig = function() {
    try {
        const draft = JSON.parse(localStorage.getItem(window.DRAFT_CONFIG_KEY));
        if (!draft) return;
        
        if(draft.duration) document.getElementById('raceDuration').value = draft.duration;
        if(draft.stops) document.getElementById('reqPitStops').value = draft.stops;
        if(draft.minStint) document.getElementById('minStint').value = draft.minStint;
        if(draft.maxStint) document.getElementById('maxStint').value = draft.maxStint;
        
        if (draft.drivers && draft.drivers.length > 0 && typeof window.createDriverInput === 'function') {
            const list = document.getElementById('driversList');
            if(list) list.innerHTML = ''; 
            draft.drivers.forEach((d, i) => {
                window.createDriverInput(d.name, i===0, 'A'); 
            });
        }
    } catch(e) { console.error("Error loading draft", e); }
};

function attachConfigListeners() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(el => {
        el.addEventListener('change', window.saveHostState);
        el.addEventListener('input', window.saveHostState); 
    });
}

// ==========================================
// 💾 SAVED RACE LOGIC (Persistence)
// ==========================================

window.saveRaceState = function() {
    if (window.role !== 'host' || (!window.state.isRunning && !window.state.isFinished)) return;
    const snapshot = {
        config: window.config,
        state: window.state,
        drivers: window.drivers,
        strategy: window.cachedStrategy || null,
        previewData: window.previewData || null,
        liveTimingConfig: window.liveTimingConfig,
        searchConfig: window.searchConfig,
        liveData: window.liveData,
        currentPitAdjustment: window.currentPitAdjustment || 0,
        // Save Host ID explicitly within the race state
        hostId: window.myId, 
        timestamp: Date.now()
    };
    localStorage.setItem(window.RACE_STATE_KEY, JSON.stringify(snapshot));
};

// Save a final snapshot on refresh/back-navigation
if (!window.__racePersistenceHooksAttached) {
    window.__racePersistenceHooksAttached = true;
    window.addEventListener('pagehide', () => {
        try { if (typeof window.saveRaceState === 'function') window.saveRaceState(); } catch (e) {}
    });
    window.addEventListener('beforeunload', () => {
        try { if (typeof window.saveRaceState === 'function') window.saveRaceState(); } catch (e) {}
    });
}

window.checkForSavedRace = function() {
    // 1. טעינת טיוטה (Draft) למסך ההגדרות
    window.loadDraftConfig();

    // 1b. Always re-run simulation with current (restored) params
    if (typeof window.runSim === 'function') window.runSim();

    // 2. בדיקת מירוץ פעיל
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
            document.getElementById('savedRaceDriver').innerText = driverName;
            
            const raceMs = data.config.raceMs || (data.config.duration * 3600000);
            const elapsed = Date.now() - data.state.startTime;
            const remaining = Math.max(0, raceMs - elapsed);
            document.getElementById('savedRaceTime').innerText = window.formatTimeHMS(remaining);
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
        if (data.previewData) window.previewData = data.previewData;

        if (data.liveTimingConfig) window.liveTimingConfig = data.liveTimingConfig;
        if (data.searchConfig) window.searchConfig = data.searchConfig;
        if (data.liveData) window.liveData = data.liveData;
        if (data.currentPitAdjustment !== undefined) window.currentPitAdjustment = data.currentPitAdjustment;

        // Restore Host ID from the confirmed saved race
        if (data.hostId) {
            localStorage.setItem('strateger_host_id', data.hostId);
            window.myId = data.hostId; 
        }

        document.getElementById('savedRaceModal').classList.add('hidden');
        document.getElementById('raceDashboard').classList.remove('hidden');

        // If race was already finished when saved, show the summary instead of running
        if (window.state.isFinished) {
            window.state.isRunning = false;
            window.role = 'host';
            // Show dashboard with FINISH state, then pop up summary
            if (typeof window.renderFrame === 'function') window.renderFrame();
            setTimeout(() => {
                if (typeof window.showRaceSummary === 'function') window.showRaceSummary();
            }, 500);
            return;
        }

        // הבטחת מצב HOST
        window.state.isRunning = true;
        window.role = 'host';
        
        // === Show chat button for host when continuing race ===
        const chatBtn = document.getElementById('chatToggleBtn');
        if (chatBtn) chatBtn.style.display = 'block';
        
        // === Restore night mode UI based on saved state ===
        if (window.state.isNightMode && typeof window.updateNightModeUI === 'function') {
            window.updateNightModeUI();
        }
        
        // === Show night mode button if squads are enabled ===
        const btnNightMode = document.getElementById('btnNightMode');
        if (btnNightMode && window.config.useSquads) {
            btnNightMode.classList.remove('hidden');
        }
        
        // 1. שחזור רשת
        if (typeof window.initHostPeer === 'function') {
            window.initHostPeer(); 
        }
        
        // 2. כפיית עדכון UI (כפתור שיתוף)
        if (typeof window.updateShareUI === 'function') {
            window.updateShareUI();
        }

        // 3. הפעלת הלולאה מחדש
        if (window.raceInterval) clearInterval(window.raceInterval);
        window.raceInterval = setInterval(() => {
            if (typeof window.tick === 'function') window.tick();
            if (typeof window.broadcast === 'function') window.broadcast();
            if (typeof window.renderFrame === 'function') window.renderFrame();
        }, 1000);

        if (window._saveInterval) clearInterval(window._saveInterval);
        window._saveInterval = setInterval(window.saveRaceState, 10000);

        // Restore live timing after refresh/continue
        try {
            if (window.liveTimingConfig && window.liveTimingConfig.enabled) {
                // Populate setup screen inputs from saved config so scraper can find team
                const urlInput = document.getElementById('liveTimingUrl');
                if (urlInput && window.liveTimingConfig.url) urlInput.value = window.liveTimingConfig.url;
                const searchInput = document.getElementById('searchValue');
                if (searchInput && window.searchConfig) {
                    searchInput.value = window.searchConfig.teamName || window.searchConfig.driverName || window.searchConfig.kartNumber || '';
                }
                
                // Show restored live data immediately (before scraper reconnects)
                if (typeof window.updateLiveTimingUI === 'function') window.updateLiveTimingUI();
                
                // Restart the scraper / demo interval
                if (typeof window.startLiveTimingUpdates === 'function') window.startLiveTimingUpdates();
            }
        } catch (e) { console.error('Failed restoring live timing', e); }
        
        if (typeof window.renderFrame === 'function') window.renderFrame();
        if (typeof window.updateDriversList === 'function') window.updateDriversList(); 
        
        // שידור יזום
        setTimeout(() => {
            if (typeof window.broadcast === 'function') window.broadcast();
        }, 500);

        console.log("✅ Race Resumed Successfully!");

    } catch (e) {
        if (typeof window.showToast === 'function') {
            window.showToast('Failed to resume race: ' + e.message, 'error');
        } else {
            console.error('Failed to resume race:', e.message);
        }
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
    // Delete Host ID
    localStorage.removeItem('strateger_host_id');
    // Delete Chat History
    localStorage.removeItem('strateger_chat_history');
    
    document.getElementById('confirmDiscardModal').classList.add('hidden');
    document.getElementById('savedRaceModal').classList.add('hidden');
    document.getElementById('setupScreen').classList.remove('hidden');
    
    // רענון נקי
    window.location.reload();
};