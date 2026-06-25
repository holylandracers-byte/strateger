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
    googleEmail: false,
    teamLogo: false,
    rulesPdf: false
};

// ==========================================
// 🎁 3-DAY FREE TRIAL (once per device)
// ==========================================

window._TRIAL_KEY   = 'strateger_trial_start';
window._TRIAL_DAYS  = 3;

window._trialActive = (function() {
    const start = localStorage.getItem(window._TRIAL_KEY);
    if (!start) return false;
    const elapsed = Date.now() - parseInt(start, 10);
    return elapsed < window._TRIAL_DAYS * 24 * 60 * 60 * 1000;
})();

window._trialUsed = !!localStorage.getItem(window._TRIAL_KEY);

/** Start trial — only once per device. Returns true if trial was started, false if already used. */
window.startFreeTrial = function() {
    if (window._trialUsed) return false;
    localStorage.setItem(window._TRIAL_KEY, String(Date.now()));
    window._trialActive = true;
    window._trialUsed = true;
    if (typeof window.updateProUI === 'function') window.updateProUI();
    return true;
};

window._startTrialFromModal = function() {
    if (!window.startFreeTrial()) return;
    document.getElementById('proUpgradeModal')?.classList.add('hidden');
    if (typeof window.showToast === 'function') {
        window.showToast('🎁 3-day Pro trial started! Enjoy all features.', 'success');
    }
    if (typeof window.updateProUI === 'function') window.updateProUI();
};

// Populate the payment reference ID whenever the modal opens
(function() {
    const _origShowProGate = window.showProGate;
    // Patch after DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        const refEl = document.getElementById('proPayRefId');
        if (refEl) {
            const deviceId = (window.getDeviceId ? window.getDeviceId() : '').slice(-6).toUpperCase() || Math.random().toString(36).slice(-6).toUpperCase();
            refEl.textContent = deviceId;
        }
    });
})();

/** Hours remaining in active trial (0 if not active). */
window.trialHoursLeft = function() {
    const start = localStorage.getItem(window._TRIAL_KEY);
    if (!start) return 0;
    const remaining = window._TRIAL_DAYS * 24 * 60 * 60 * 1000 - (Date.now() - parseInt(start, 10));
    return Math.max(0, Math.ceil(remaining / 3600000));
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
    if (window._trialActive) return true;
    // Free features are things NOT in the limits or explicitly allowed
    if (featureName === 'liveTiming') return window.FREE_LIMITS.liveTiming;
    if (featureName === 'aiStrategy') return window.FREE_LIMITS.aiStrategy;
    if (featureName === 'squads') return window.FREE_LIMITS.squads;
    if (featureName === 'kartTracking') return window.FREE_LIMITS.kartTracking;
    if (featureName === 'pdfExport') return window.FREE_LIMITS.pdfExport;
    if (featureName === 'fuelTracking') return window.FREE_LIMITS.fuelTracking;
    if (featureName === 'googleCalendar') return window.FREE_LIMITS.googleCalendar;
    if (featureName === 'googleEmail') return window.FREE_LIMITS.googleEmail;
    if (featureName === 'teamLogo') return window.FREE_LIMITS.teamLogo;
    if (featureName === 'rulesPdf') return window.FREE_LIMITS.rulesPdf;
    return true; // default: free
};

/**
 * Show Pro upgrade prompt when user tries to access a locked feature.
 */
window.showProGate = function(featureName) {
    if (window._proUnlocked) return;
    if (window._trialActive) return; // still in trial
    const t = window.t || ((k) => k);
    const modal = document.getElementById('proUpgradeModal');
    if (modal) {
        const featureLabel = document.getElementById('proGateFeature');
        if (featureLabel) featureLabel.innerText = featureName || t('proFeature');
        // Show or hide the trial CTA based on whether trial is available
        const trialSection = document.getElementById('proTrialSection');
        if (trialSection) trialSection.classList.toggle('hidden', window._trialUsed);
        const trialUsedNote = document.getElementById('proTrialUsedNote');
        if (trialUsedNote) trialUsedNote.classList.toggle('hidden', !window._trialUsed);
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
        const res = await fetch(window.APP_CONFIG.API_BASE + 'verify-license', {
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
        previewTitle: "Strategy Preview", addToCalendar: "Add to Google Calendar", timeline: "Timeline", driverSchedule: "Stint Summary", totalTime: "Total Time", close: "Close",
        googleLogin: "Login with Google", eventCreated: "Event created successfully!", eventError: "Failed to create event", raceEventTitle: "Endurance Race (Strateger)",
        errImpossible: "Impossible Strategy!", errAvgHigh: "Avg stint > Max Stint. Increase Stops or Max Stint.", errAvgLow: "Avg stint < Min Stint. Decrease Stops or Min Stint.",
        appTitle: "STRATEGER", appSubtitle: "Endurance Race Strategy Manager", generalInfo: "General Info", advancedConstraints: "Advanced Constraints", driverConfig: "Drivers", aiTitle: "AI Strategy",
        lblDuration: "Duration (Hours)", lblStops: "Req. Stops", lblMinStint: "Min Stint (min)", lblMaxStint: "Max Stint (min)", lblPitTime: "Pit Time (sec)", lblPitClosedStart: "🚫 Closed Start (min)", lblPitClosedEnd: "🚫 Closed End (min)",
        lblMinDrive: "Min Driver Total (min)", lblMaxDrive: "Max Driver Total (min)", lblBuffer: "Pit Alert / Buffer (s)", lblDoubles: "Allow Doubles", lblSquads: "Use Squads", lblFuel: "Fuel", lblFuelTank: "Fuel Tank (min)",
        lblExtraPits: "Extra Pit Stops", lblReqExtraPits: "Required Extra Pits", lblMinPitLapSec: "Min Pit Lap (sec)", lblExtraPitsHint: "Mandatory extra pits in left lane. Pit lane closed first & last 10 min.",
        markExtraPit: "Mark as Extra Pit", extraPitDone: "Extra Pit", driverMaxTimeWarning: "⚠️ Near max drive time!", driverOverMaxTime: "🚨 OVER max drive time!",
        qpKart24h: "🏎 24H Kart", qpNoLimit: "∞ No Limit", extraPitMissing: "Extra pits missing", extraPitOnPace: "Extra pits on pace",
        lblNoLimitEndurance: "No Limit Endurance", lblNumTeams: "Competing Teams (kart rotation)", lblExtraPitsShort: "Kart Chg",
        lblKartChangeInterval: "Kart-Change Interval (min)", lblKartChangeIntervalHint: "Organizer sets how often your team must change karts.",
        addDriver: "+ Add", generateStrategy: "Generate Strategy (AI)", previewStrategy: "Preview Strategy", startRace: "Start Race", loadSaved: "Load Saved Race",
        stepRaceSettings: "Race Settings", stepDrivers: "Drivers", stepGo: "Let's Go", optional: "optional", joinAsDriverHint: "Enter a race running on another device",
        raceTime: "RACE TIME", stops: "STOPS", live: "LIVE", stop: "Stop", pos: "POS", last: "LAST", best: "BEST", targetStint: "TARGET STINT", buildTime: "BUILD TIME",
        current: "CURRENT", stintTime: "STINT TIME", nextDriver: "Next Driver", penalty: "Penalty", enterPit: "ENTER PIT", push: "PUSH", problem: "PROBLEM",
        resetMode: "Reset Mode", nightMode: "NIGHT MODE", dry: "Dry", wet: "Rain", drying: "Drying", boxNow: "BOX NOW!", stayOnTrackUntilFurther: "Stay on track until further notice", pushMode: "PUSH MODE ACTIVE",
        squadSleeping: "SQUAD SLEEPING", squadWakeUp: "WAKE SQUAD", finalLap: "Final Lap", calculating: "Calculating...", manualInput: "Manual Input",
        saveStratTitle: "Save Strategy", libTitle: "Strategy Library", aiPlaceholder: "e.g. 'Driver 1 is fast but tires wear out...'",
        thStart: "Start", thEnd: "End", thType: "Type", thDriver: "Driver", thDuration: "Duration",
        liveTiming: "Live Timing", liveTimingUrl: "Live Timing URL...", connectLive: "Connect", disconnectLive: "Disconnect", searchTeam: "Search team...", searchDriver: "Search driver...", searchKart: "Search kart #...", demoMode: "Demo Mode",
        advancedConnection: "Advanced connection", wsPortOverrideLabel: "Apex WS port override (leave blank = auto):", wsPortOverridePlaceholder: "e.g. 8523 or 8913", wsPortOverrideHint: "If live timing connects but shows no data, the feed's WebSocket port may differ from the auto-detected one. Try the venue's configPort+3 (HTTPS) or +2 (HTTP).",
        sendEmail: "Send", cancel: "Cancel", create: "Create", save: "Save", load: "Load", delete: "Delete",
        activeRaceFound: "Active Race Found", continueRace: "Continue Race", discardRace: "Discard",
        areYouSure: "Are you sure?", deleteWarning: "This will delete the active race data permanently.", yesDelete: "Yes, Delete", noKeep: "No, Keep",
        invite: "Invite", synced: "Synced",
        chatTitle: "Race Chat / Q&A", enterName: "Enter your name to chat", startChat: "Start Chatting", typeMessage: "Type a suggestion...", send: "Send", viewer: "Viewer", host: "HOST", suggestion: "Suggestion",
        strategyOutlook: "STRATEGY OUTLOOK",
        timeLeft: "TIME LEFT",
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
        startDemoTooltip: "Start Demo",
        startDemoMidRaceWarning: "This will end your current race and replace it with a demo. This cannot be undone.",
        startDemoConfirm: "Start Demo",
        modeRace: "Race Only", modeQualify: "Qualifying + Race",
        qualifyTitle: "Qualifying", qualifyFormat: "Format", qualifyFmtSimple: "Simple", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "Segments", qualifyDuration: "Qualifying Duration (min)", qualifyParticipation: "Driver Participation",
        qualifyPartOne: "One", qualifyPartMulti: "Multiple", qualifyPartAll: "All", qualifyPartOneDriver: "Driver",
        qualifyPartMultiCount: "Number of drivers", qualifyRuns: "Runs per driver",
        qualifyPitRule: "Pit Stop Rule", qualifyPitNone: "None", qualifyPitAny: "Any stop", qualifyPitMin: "Min time",
        qualifyPitMinSec: "Minimum seconds in pit", qualifyStop: "Stop Qualifying", qualifySession: "Session",
        qualifyRun: "Run", qualifyStageResults: "Results", qualifyUpNext: "Up Next",
        qualifyAdvance: "Advance to Next Stage", qualifySegmentTime: "Duration (min)",
        qualifyNextRun: "Next Run", qualifyLastRun: "Last run", qualifyDoneStartRace: "Qualifying done! Set up race settings below and tap Start Race.",
        startQualify: "Start Qualifying",
        qualifyScreenTitle: "Qualifying",
        countdownPrefix: "Race starts in",
        countdownGo: "RACE TIME! Start now!",
        countdownAlert: "⏰ Race starts in {min} minutes!",
        autoStarting: "Auto-starting race...",
        lblAutoStart: "Auto-start at race time",
        lblDoublesHint: "Same driver back-to-back",
        lblMaxConsecutive: "Max consecutive stints per driver",
        consec2: "2", consec3: "3", consecUnlimited: "Unlimited",
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
        feedbackTitle: "Feedback",
        contactUs: "Contact Us",
        runDemo: "Demo",
        goodPace: "Good Pace",
        lblStartTime: "🕐 Race Start Time", lblStartDate: "📅 Race Date",
        lblSquadSchedule: "🔄 Squad Window", lblSquadScheduleHint: "Outside this window all drivers share equally. Inside, squads rotate evenly.",
        lblSquadWindowStart: "Window Start", lblSquadWindowEnd: "Window End",
        squadOff: "Off", squad2: "2 Squads", squad3: "3 Squads", squad4: "4 Squads",
        lblAppearance: "🎨 Appearance", lblPageBg: "Page Background", lblColorThemes: "Color Themes",
        laps: "LAPS", gap: "GAP", totalCompetitors: "CARS", waitingData: "Waiting for data...",
        boxThisLap: "🏁 BOX THIS LAP", boxNextLap: "📢 BOX NEXT LAP", stayOut: "STAY OUT", ltOnTrack: "ON TRACK", ltInPit: "IN PIT",
        driverEntryHint: "Enter the race ID to connect", driverEntryLabel: "Race ID", driverConnect: "Connect as Driver", driverIdTooShort: "ID is too short", joinAsDriver: "Join as Driver", backToSetup: "← Back to Setup",
        nextStintIn: "Your next stint in", stayAwake: "Stay awake", sleepOk: "You can sleep", yourStints: "Your Stints", noStintsFound: "No stints found for you", wakeUpAlert: "⏰ Wake up! Your stint is coming",
        viewerNameHint: "Enter your name to join the race", viewerNameLabel: "Your Name", requestToJoin: "Request to Join", waitingForApproval: "Waiting for host approval...", waitingForApprovalHint: "The race admin will approve your request", viewerNameTooShort: "Name must be at least 2 characters",
        // Pro & New Features
        proFeature: "Pro Feature", proUpgradeTitle: "Upgrade to Pro", proUpgradeMsg: "Unlock Live Timing, AI Strategy, Squads, unlimited drivers & themes, and more!", proActivate: "Activate License", proDeactivate: "Deactivate", proEnterKey: "Enter license key...", proInvalidKey: "Invalid license key", proActivated: "⭐ Pro Activated!", proBadge: "PRO", proRequired: "requires Pro", proHaveCoupon: "🎟️ Have a coupon code?", proApplyCoupon: "Apply",
        undoPit: "Undo Pit", undoPitToast: "Pit entry undone", undoCountdown: "Undo",
        exportPdf: "Export PDF", exportImage: "Share as Image", exportingPdf: "Generating PDF...",
        onboardTitle1: "Welcome to Strateger!", onboardDesc1: "Your pit strategy assistant for endurance karting. Set up your first race in 3 easy steps.",
        onboardTitle2: "Set Up Your Race", onboardDesc2: "Enter race duration, required pit stops & min/max stint times at the top. Then add your drivers below — pick a starter and assign squads if you have night shifts.",
        onboardTitle3: "Preview & Fine-Tune", onboardDesc3: "Tap 'Preview Strategy' to see your full stint timeline. Drag stints to reorder, adjust durations, or save your plan to the cloud for later.",
        onboardTitle4: "Go Race!", onboardDesc4: "Hit 'Start Race' and the live dashboard takes over — track stint timers, get pit-window alerts, share a live link with your team, and manage driver swaps in real time.",
        onboardSkip: "I'll explore on my own", onboardNext: "Next", onboardDone: "Let's Go!",
        onboardDemoHint: "The best way to get started is to run a quick demo race — it takes 30 seconds and shows you exactly how everything works.",
        onboardRunDemo: "Run Demo Race",
        onboardWelcome: "Welcome to Strateger!",
        soundMute: "Mute", soundUnmute: "Unmute",
        aiOptimize: "AI Optimize Strategy",
        raceFinished: "RACE FINISHED", totalPitTime: "Pit Time", raceStart: "Start", pitLog: "Pit Stop Log", drove: "Drove", pitNoun: "Pit", driveNoun: "Drive", stints: "Stints", avgStint: "Avg",
        demoSelectFeatures: "Select Pro features to test", demoLiveTimingDesc: "Simulated 20-team leaderboard", demoRainLabel: "Rain Simulation", demoRainDesc: "Random rain events with pace changes", demoPenaltyDesc: "Random penalties & time additions", demoTiresLabel: "Tire Degradation", demoTiresDesc: "Lap times increase over stint", demoSquadsLabel: "Squads", demoSquadsDesc: "Driver groups with rotation", demoFuelLabel: "Fuel Management", demoFuelDesc: "Track fuel level & pit for refueling",
        unitMin: "m", unitHour: "h",
        raceHistory: "Race History", noRaceHistory: "No race history yet. Complete a race to see it here.",
        proBadge: "PRO",
        addDriverToGroup: "Add driver to group…", driverGroupHint: "Tap a driver to include/exclude from this race", clickToAddToRace: "Add to race", clickToRemoveFromRace: "Remove from race", removeFromGroup: "Remove from group", minTwoDrivers: "Minimum 2 drivers required",
        lblTeamName: "Team Name",
        heroTitle: "Race Strategy", heroSub: "Plan stints · Manage drivers · Win races",
        qpSprint: "⚡ Sprint", qpEndurance: "🏁 Endurance", qpNoLimit: "∞ No Limit", qpQualify: "⏱️ + Qualifying", qpDemo: "🎬 Demo", qpLibrary: "📚 Library",
        heroCollapse: "Hide", heroExpand: "Setup",
        rulesPdfBtn: "Upload Race Rules (PDF)", rulesPdfLoaded: "Rules Loaded",
        rulesPdfModalTitle: "Race Rules PDF", rulesPdfModalSub: "AI will read the rules and suggest the best strategy in your language",
        rulesPdfDrop: "Click to select PDF", rulesPdfDropHint: "Max ~50 pages recommended",
        rulesPdfReading: "Reading PDF…", rulesPdfError: "Could not read PDF.", rulesPdfAiError: "AI returned no result.",
        rulesPdfClear: "Remove", rulesPdfAnalyze: "Analyze & Suggest Strategy", pages: "pages",
        saveSettings: "Save", backToRace: "← Back to Race",
        livePreviewBtn: "▶ PLAN",
        appearance: "Appearance",
        // Live-timing widget strings
        leaderLabel: "LEADER", pitLabel: "PIT",
        lapSingular: "lap", lapPlural: "laps",
        topKartsTitle: "TOP KARTS", numDecSep: ".",
        raceClockLabel: "RACE TIME",
        teamLogoUpload: "Upload Logo", teamLogoChange: "Change Logo", teamLogoRemove: "Remove",
        teamLogoUploading: "Uploading…", teamLogoTooLarge: "File too large (max 2 MB)",
        teamLogoInvalidType: "Only JPG, PNG or SVG allowed",
        stintAvg: "Stint Avg",
        norm: "NORM",
        pitLatestExitIn: "Latest exit in", pitLeaveNow: "⚠️ Leave now!", pitLatestExitPassed: "🚨 EXIT OVERDUE",
        autoPit: "Auto", autoPitOn: "Auto", autoPitOff: "Manual",
    },
    he: {
        ltSearchType: "סנן לפי:", ltTeam: "קבוצה", ltDriver: "נהג", ltKart: "מספר קארט", ltPlaceholder: "הכנס ערך לחיפוש...",
        previewTitle: "תצוגה מקדימה", addToCalendar: "הוסף ליומן גוגל", timeline: "ציר זמן", driverSchedule: "סיכום סטינטים", totalTime: "זמן כולל", close: "סגור",
        googleLogin: "התחבר עם Google", eventCreated: "האירוע נוצר בהצלחה!", eventError: "שגיאה ביצירת האירוע", raceEventTitle: "מירוץ סיבולת (Strateger)",
        errImpossible: "אסטרטגיה לא אפשרית!", errAvgHigh: "ממוצע סטינט גבוה מהמקסימום. הוסף עצירות או הגדל מקסימום.", errAvgLow: "ממוצע סטינט נמוך מהמינימום. הפחת עצירות או הקטן מינימום.",
        appTitle: "STRATEGER", appSubtitle: "ניהול אסטרטגיה למירוצי סיבולת", generalInfo: "הגדרות כלליות", advancedConstraints: "אילוצים מתקדמים", driverConfig: "נהגים", aiTitle: "אסטרטגיה חכמה (AI)",
        lblDuration: "משך (שעות)", lblStops: "עצירות חובה", lblMinStint: "מינימום סטינט (דק')", lblMaxStint: "מקסימום סטינט (דק')", lblPitTime: "זמן פיטס (שניות)", lblPitClosedStart: "🚫 סגור בהתחלה (דק')", lblPitClosedEnd: "🚫 סגור בסוף (דק')",
        lblMinDrive: "מינימום לנהג (דק')", lblMaxDrive: "מקסימום לנהג (דק')", lblBuffer: "התראה מראש (שניות)", lblDoubles: "אפשר דאבל סטינט", lblSquads: "שימוש בחוליות", lblFuel: "דלק", lblFuelTank: "מיכל דלק (דק')",
        addDriver: "+ הוסף", generateStrategy: "צור אסטרטגיה (AI)", previewStrategy: "תצוגה מקדימה", startRace: "התחל מירוץ", loadSaved: "טען מירוץ",
        stepRaceSettings: "הגדרות מירוץ", stepDrivers: "נהגים", stepGo: "יאללה נתחיל", optional: "אופציונלי", joinAsDriverHint: "התחבר למירוץ שרץ במכשיר אחר",
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
        startDemoTooltip: "התחל דמו",
        startDemoMidRaceWarning: "זה יסיים את המירוץ הנוכחי ויחליף אותו בדמו. לא ניתן לבטל פעולה זו.",
        startDemoConfirm: "התחל דמו",
        modeRace: "מירוץ בלבד", modeQualify: "מקצה דירוג + מירוץ",
        qualifyTitle: "מקצה דירוג", qualifyFormat: "פורמט", qualifyFmtSimple: "פשוט", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "שלבים", qualifyDuration: "משך מקצה (דק')", qualifyParticipation: "השתתפות נהגים",
        qualifyPartOne: "נהג אחד", qualifyPartMulti: "כמה נהגים", qualifyPartAll: "כולם", qualifyPartOneDriver: "נהג",
        qualifyPartMultiCount: "מספר נהגים", qualifyRuns: "ריצות לנהג",
        qualifyPitRule: "כלל פיטסטופ", qualifyPitNone: "ללא", qualifyPitAny: "כל עצירה", qualifyPitMin: "זמן מינימום",
        qualifyPitMinSec: "שניות מינימום בפיטס", qualifyStop: "עצור מקצה", qualifySession: "סשן",
        qualifyRun: "ריצה", qualifyStageResults: "תוצאות", qualifyUpNext: "הבא",
        qualifyAdvance: "מעבר לשלב הבא", qualifySegmentTime: "משך (דק')",
        qualifyNextRun: "ריצה הבאה", qualifyLastRun: "ריצה אחרונה", qualifyDoneStartRace: "מקצה הסתיים! הגדר הגדרות מירוץ למטה והתחל.",
        startQualify: "התחל מקצה דירוג",
        qualifyScreenTitle: "מקצה דירוג",
        countdownPrefix: "המירוץ מתחיל בעוד",
        countdownGo: "הגיע הזמן! התחל עכשיו!",
        countdownAlert: "⏰ המירוץ מתחיל בעוד {min} דקות!",
        autoStarting: "מתחיל מירוץ אוטומטית...",
        lblAutoStart: "התחלה אוטומטית בזמן המירוץ",
        lblDoublesHint: "אותו נהג שוב",
        lblMaxConsecutive: "מקסימום סטינטים רצופים לנהג",
        consec2: "2", consec3: "3", consecUnlimited: "ללא הגבלה",
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
        runDemo: "דמו",
        goodPace: "קצב טוב",
        lblStartTime: "🕐 שעת התחלה", lblStartDate: "📅 תאריך מירוץ",
        lblSquadSchedule: "🔄 חלון חוליות", lblSquadScheduleHint: "מחוץ לחלון כל הנהגים מתחלקים שווה. בתוך החלון, חוליות מתחלפות בחלוקה שווה.",
        lblSquadWindowStart: "תחילת חלון", lblSquadWindowEnd: "סוף חלון",
        squadOff: "כבוי", squad2: "2 חוליות", squad3: "3 חוליות", squad4: "4 חוליות",
        lblAppearance: "🎨 מראה", lblPageBg: "רקע עמוד", lblColorThemes: "ערכות נושא צבע",
        laps: "הקפות", gap: "פער", totalCompetitors: "מכוניות", waitingData: "ממתין לנתונים...",
        boxThisLap: "🏁 היכנס להקפה הזו", boxNextLap: "📢 היכנס בהקפה הבאה", stayOut: "הישאר בחוץ", ltOnTrack: "על המסלול", ltInPit: "בפיטס",
        driverEntryHint: "הזן את קוד המירוץ להתחברות", driverEntryLabel: "קוד מירוץ", driverConnect: "התחבר כנהג", driverIdTooShort: "הקוד קצר מדי", joinAsDriver: "הצטרף כנהג", backToSetup: "← חזרה להגדרות",
        nextStintIn: "הסטינט הבא שלך בעוד", stayAwake: "הישאר ער", sleepOk: "אפשר לישון", yourStints: "הסטינטים שלך", noStintsFound: "לא נמצאו סטינטים עבורך", wakeUpAlert: "⏰ התעורר! הסטינט שלך מתקרב",
        viewerNameHint: "הכנס את שמך כדי להצטרף למירוץ", viewerNameLabel: "השם שלך", requestToJoin: "בקש להצטרף", waitingForApproval: "ממתין לאישור מנהל...", waitingForApprovalHint: "מנהל המירוץ יאשר את בקשתך", viewerNameTooShort: "השם חייב להכיל לפחות 2 תווים",
        proFeature: "תכונת Pro", proUpgradeTitle: "⭐ שדרג ל-Pro", proUpgradeMsg: "שחרר תזמון חי, אסטרטגיית AI, חוליות, נהגים וערכות נושא ללא הגבלה, ועוד!", proActivate: "הפעל רישיון", proDeactivate: "בטל", proEnterKey: "הכנס מפתח רישיון...", proInvalidKey: "מפתח רישיון לא תקין", proActivated: "⭐ Pro הופעל!", proBadge: "PRO", proRequired: "דרוש Pro", proHaveCoupon: "🎟️ יש לך קוד קופון?", proApplyCoupon: "החל",
        onboardWelcome: "ברוכים הבאים ל-Strateger!", onboardDemoHint: "הדרך הכי טובה להתחיל היא להריץ מירוץ דמו קצר — לוקח 30 שניות ומראה בדיוק איך הכל עובד.", onboardRunDemo: "הרץ דמו",
        onboardSkip: "אחקור לבד", onboardNext: "הבא", onboardDone: "יאללה!",
        aiOptimize: "ייעול אסטרטגיה (AI)",
        raceFinished: "המירוץ נגמר", totalPitTime: "זמן פיטס", raceStart: "התחלה", pitLog: "יומן עצירות", drove: "נהג", pitNoun: "פיט", driveNoun: "נסיעה", stints: "סטינטים", avgStint: "ממוצע",
        demoSelectFeatures: "בחר תכונות Pro לבדיקה", demoLiveTimingDesc: "טבלת 20 קבוצות מדומה", demoRainLabel: "סימולציית גשם", demoRainDesc: "אירועי גשם אקראיים עם שינוי קצב", demoPenaltyDesc: "עונשים אקראיים ותוספות זמן", demoTiresLabel: "בלאי צמיגים", demoTiresDesc: "זמני הקפה עולים במהלך הסטינט", demoSquadsLabel: "חוליות", demoSquadsDesc: "קבוצות נהגים עם רוטציה", demoFuelLabel: "ניהול דלק", demoFuelDesc: "מעקב אחר דלק ועצירה לתדלוק",
        unitMin: "דק", unitHour: "ש",
        soundMute: "השתק", soundUnmute: "בטל השתקה",
        undoPit: "בטל כניסה", undoPitToast: "כניסה לפיטס בוטלה", undoCountdown: "בטל",
        exportPdf: "ייצוא PDF", exportImage: "שתף כתמונה", exportingPdf: "מייצא PDF...",
        raceHistory: "היסטוריית מירוצים", noRaceHistory: "אין היסטוריית מירוצים. סיים מירוץ כדי לראות אותו כאן.",
        proBadge: "PRO",
        addDriverToGroup: "הוסף נהג לקבוצה…", driverGroupHint: "לחץ על נהג כדי להוסיף/להסיר מהמירוץ", clickToAddToRace: "הוסף למירוץ", clickToRemoveFromRace: "הסר מהמירוץ", removeFromGroup: "הסר מהקבוצה", minTwoDrivers: "נדרשים לפחות 2 נהגים",
        lblTeamName: "שם הקבוצה",
        heroTitle: "אסטרטגיית מירוץ", heroSub: "תכנן סטינטים · נהל נהגים · נצח",
        qpSprint: "⚡ ספרינט", qpEndurance: "🏁 סיבולת", qpNoLimit: "∞ ללא הגבלה", qpQualify: "⏱️ + מקצה דירוג", qpDemo: "🎬 דמו", qpLibrary: "📚 ספרייה",
        heroCollapse: "הסתר", heroExpand: "הגדרות",
        rulesPdfBtn: "העלה תקנון מירוץ (PDF)", rulesPdfLoaded: "תקנון נטען",
        rulesPdfModalTitle: "תקנון מירוץ PDF", rulesPdfModalSub: "הבינה המלאכותית תקרא את התקנון ותציע אסטרטגיה מיטבית בשפתך",
        rulesPdfDrop: "לחץ לבחירת PDF", rulesPdfDropHint: "מומלץ עד ~50 עמודים",
        rulesPdfReading: "קורא PDF…", rulesPdfError: "לא ניתן לקרוא את ה-PDF.", rulesPdfAiError: "הבינה המלאכותית לא החזירה תוצאה.",
        rulesPdfClear: "הסר", rulesPdfAnalyze: "נתח והצע אסטרטגיה", pages: "עמודים",
        saveSettings: "שמור", backToRace: "← חזרה למירוץ",
        livePreviewBtn: "▶ תוכנית",
        appearance: "מראה",
        leaderLabel: "מוביל", pitLabel: "פיטס",
        lapSingular: "הקפה", lapPlural: "הקפות",
        topKartsTitle: "קארטים מובילים", numDecSep: ".",
        raceClockLabel: "זמן מירוץ",
        teamLogoUpload: "העלה לוגו", teamLogoChange: "החלף לוגו", teamLogoRemove: "הסר",
        teamLogoUploading: "מעלה…", teamLogoTooLarge: "קובץ גדול מדי (מקסימום 2 MB)",
        teamLogoInvalidType: "רק JPG, PNG או SVG",
        stintAvg: "ממוצע סטינט",
        norm: "רגיל",
        pitLatestExitIn: "יציאה אחרונה בעוד", pitLeaveNow: "⚠️ צא עכשיו!", pitLatestExitPassed: "🚨 יציאה באיחור",
        autoPit: "אוטו", autoPitOn: "אוטו", autoPitOff: "ידני",
    },
    fr: {
        ltSearchType: "Filtrer par:", ltTeam: "Équipe", ltDriver: "Pilote", ltKart: "Kart n°", ltPlaceholder: "Rechercher...",
        previewTitle: "Aperçu de la Stratégie", addToCalendar: "Ajouter au Calendrier", timeline: "Chronologie", driverSchedule: "Résumé des Relais", totalTime: "Temps Total", close: "Fermer",
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
        modeRace: "Course seule", modeQualify: "Qualifications + Course",
        qualifyTitle: "Qualifications", qualifyFormat: "Format", qualifyFmtSimple: "Simple", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "Segments", qualifyDuration: "Durée qualif. (min)", qualifyParticipation: "Participation",
        qualifyPartOne: "Un pilote", qualifyPartMulti: "Plusieurs", qualifyPartAll: "Tous", qualifyPartOneDriver: "Pilote",
        qualifyPartMultiCount: "Nombre de pilotes", qualifyRuns: "Tours par pilote",
        qualifyPitRule: "Règle stand", qualifyPitNone: "Aucun", qualifyPitAny: "Tout arrêt", qualifyPitMin: "Temps min",
        qualifyPitMinSec: "Secondes min au stand", qualifyStop: "Arrêter qualif.", qualifySession: "Session",
        qualifyRun: "Tour", qualifyStageResults: "Résultats", qualifyUpNext: "Suivant",
        qualifyAdvance: "Passer à la prochaine manche", qualifySegmentTime: "Durée (min)",
        qualifyNextRun: "Tour suivant", qualifyLastRun: "Dernier tour", qualifyDoneStartRace: "Qualif. terminées! Configurez la course et démarrez.",
        startQualify: "Lancer les qualifications", qualifyScreenTitle: "Qualifications",
        countdownPrefix: "Course dans",
        countdownGo: "C'EST L'HEURE ! Démarrez !",
        countdownAlert: "⏰ Course dans {min} minutes !",
        autoStarting: "Démarrage auto...",
        lblAutoStart: "Démarrage auto à l'heure",
        lblDoublesHint: "Même pilote consécutivement",
        lblMaxConsecutive: "Relais consécutifs max par pilote",
        consec2: "2", consec3: "3", consecUnlimited: "Illimité",
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
        runDemo: "Démo",
        goodPace: "Bon Rythme",
        lblStartTime: "🕐 Heure de Départ", lblStartDate: "📅 Date de Course",
        lblSquadSchedule: "🔄 Fenêtre Équipes", lblSquadScheduleHint: "Hors fenêtre, tous les pilotes partagent. Dedans, les équipes tournent à parts égales.",
        lblSquadWindowStart: "Début fenêtre", lblSquadWindowEnd: "Fin fenêtre",
        squadOff: "Désactivé", squad2: "2 Équipes", squad3: "3 Équipes", squad4: "4 Équipes",
        lblAppearance: "🎨 Apparence", lblPageBg: "Fond de page", lblColorThemes: "Thèmes de couleur",
        laps: "TOURS", gap: "ÉCART", totalCompetitors: "VOITURES", waitingData: "En attente de données...",
        boxThisLap: "🏁 BOX CE TOUR", boxNextLap: "📢 BOX PROCHAIN TOUR", stayOut: "RESTEZ EN PISTE", ltOnTrack: "EN PISTE", ltInPit: "AUX STANDS",
        driverEntryHint: "Entrez l'ID de course pour vous connecter", driverEntryLabel: "ID de course", driverConnect: "Se connecter comme pilote", driverIdTooShort: "L'ID est trop court", joinAsDriver: "Rejoindre en tant que pilote", backToSetup: "← Retour aux réglages",
        nextStintIn: "Votre prochain stint dans", stayAwake: "Restez éveillé", sleepOk: "Vous pouvez dormir", yourStints: "Vos Stints", noStintsFound: "Aucun stint trouvé pour vous", wakeUpAlert: "⏰ Réveillez-vous! Votre stint approche",
        viewerNameHint: "Entrez votre nom pour rejoindre la course", viewerNameLabel: "Votre Nom", requestToJoin: "Demander à rejoindre", waitingForApproval: "En attente d'approbation...", waitingForApprovalHint: "L'administrateur de la course approuvera votre demande", viewerNameTooShort: "Le nom doit contenir au moins 2 caractères",
        proFeature: "Fonction Pro", proUpgradeTitle: "⭐ Passer à Pro", proUpgradeMsg: "Débloquez le Chronométrage Live, la Stratégie IA, les Équipes, pilotes & thèmes illimités, et plus !", proActivate: "Activer la licence", proDeactivate: "Désactiver", proEnterKey: "Entrez la clé de licence...", proInvalidKey: "Clé de licence invalide", proActivated: "⭐ Pro Activé !", proBadge: "PRO", proRequired: "nécessite Pro", proHaveCoupon: "🎟️ Vous avez un code promo ?", proApplyCoupon: "Appliquer",
        onboardTitle1: "Bienvenue sur Strateger !", onboardDesc1: "Votre assistant stratégie pour les courses d'endurance en karting. Configurez votre première course en 3 étapes.",
        onboardTitle2: "Configurez votre course", onboardDesc2: "Entrez la durée, les arrêts obligatoires et les temps de stint min/max en haut. Ajoutez vos pilotes en dessous — choisissez un départ et assignez des équipes pour les relais de nuit.",
        onboardTitle3: "Aperçu et ajustements", onboardDesc3: "Appuyez sur 'Aperçu' pour voir le plan complet des stints. Glissez-déposez pour réorganiser, ajustez les durées ou sauvegardez dans le cloud.",
        onboardTitle4: "En piste !", onboardDesc4: "Lancez la course et le tableau de bord prend le relais — suivez les chronos, recevez les alertes pit, partagez un lien live avec votre équipe et gérez les relais en temps réel.",
        onboardSkip: "Passer", onboardNext: "Suivant", onboardDone: "C'est parti !",
        appTitle: "STRATEGER",
        aiOptimize: "Optimiser la stratégie IA",
        raceFinished: "COURSE TERMINÉE", totalPitTime: "Temps au stand", raceStart: "Départ", pitLog: "Journal des arrêts", drove: "Conduit", pitNoun: "Stand", driveNoun: "Conduite", stints: "Relais", avgStint: "Moy.",
        demoSelectFeatures: "Sélectionnez les fonctions Pro à tester", demoLiveTimingDesc: "Classement simulé de 20 équipes", demoRainLabel: "Simulation de pluie", demoRainDesc: "Événements de pluie avec changement de rythme", demoPenaltyDesc: "Pénalités aléatoires et ajouts de temps", demoTiresLabel: "Dégradation des pneus", demoTiresDesc: "Les temps au tour augmentent au fil du relais", demoSquadsLabel: "Équipes", demoSquadsDesc: "Groupes de pilotes avec rotation", demoFuelLabel: "Gestion du carburant", demoFuelDesc: "Suivre le carburant et ravitaillement",
        unitMin: "min", unitHour: "h",
        soundMute: "Muet", soundUnmute: "Activer le son",
        undoPit: "Annuler Pit", undoPitToast: "Entrée pit annulée", undoCountdown: "Annuler",
        exportPdf: "Exporter PDF", exportImage: "Partager en image", exportingPdf: "Génération PDF...",
        heroTitle: "Stratégie de Course", heroSub: "Planifier · Gérer · Gagner",
        qpSprint: "⚡ Sprint", qpEndurance: "🏁 Endurance", qpNoLimit: "∞ Sans Limite", qpQualify: "⏱️ + Qualif.", qpDemo: "🎬 Démo", qpLibrary: "📚 Bibliothèque",
        heroCollapse: "Réduire", heroExpand: "Config",
        rulesPdfBtn: "Importer le règlement (PDF)", rulesPdfLoaded: "Règlement chargé",
        rulesPdfModalTitle: "Règlement de Course PDF", rulesPdfModalSub: "L'IA lira le règlement et suggérera la meilleure stratégie dans votre langue",
        rulesPdfDrop: "Cliquez pour sélectionner un PDF", rulesPdfDropHint: "Max ~50 pages recommandées",
        rulesPdfReading: "Lecture du PDF…", rulesPdfError: "Impossible de lire le PDF.", rulesPdfAiError: "L'IA n'a retourné aucun résultat.",
        rulesPdfClear: "Supprimer", rulesPdfAnalyze: "Analyser et suggérer une stratégie", pages: "pages",
        leaderLabel: "LEADER", pitLabel: "BOX",
        lapSingular: "tour", lapPlural: "tours",
        topKartsTitle: "TOP KARTS", numDecSep: ",",
        raceClockLabel: "TEMPS DE COURSE",
        teamLogoUpload: "Importer logo", teamLogoChange: "Changer logo", teamLogoRemove: "Supprimer",
        teamLogoUploading: "Envoi…", teamLogoTooLarge: "Fichier trop grand (max 2 Mo)",
        teamLogoInvalidType: "Seulement JPG, PNG ou SVG",
        stintAvg: "Moy. Relais",
        norm: "NORM",
        pitLatestExitIn: "Sortie max dans", pitLeaveNow: "⚠️ Sortez maintenant!", pitLatestExitPassed: "🚨 SORTIE EN RETARD",
    },
    pt: {
        ltSearchType: "Filtrar por:", ltTeam: "Equipe", ltDriver: "Piloto", ltKart: "Kart nº", ltPlaceholder: "Pesquisar...",
        previewTitle: "Visualização da Estratégia", addToCalendar: "Adicionar ao Calendário", timeline: "Linha do Tempo", driverSchedule: "Resumo dos Stints", totalTime: "Tempo Total", close: "Fechar",
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
        modeRace: "Apenas Corrida", modeQualify: "Classificação + Corrida",
        qualifyTitle: "Classificação", qualifyFormat: "Formato", qualifyFmtSimple: "Simples", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "Segmentos", qualifyDuration: "Duração classif. (min)", qualifyParticipation: "Participação",
        qualifyPartOne: "Um piloto", qualifyPartMulti: "Vários", qualifyPartAll: "Todos", qualifyPartOneDriver: "Piloto",
        qualifyPitRule: "Regra de box", qualifyPitNone: "Sem regra", qualifyPitMustChange: "Deve trocar",
        qualifyRun: "Volta", qualifyStageResults: "Resultados", qualifyUpNext: "A seguir",
        qualifyAdvance: "Avançar para a próxima fase", qualifySegmentTime: "Duração (min)",
        qualifyNextRun: "Próxima volta", qualifyLastRun: "Última volta", qualifyDoneStartRace: "Classif. concluída! Configure a corrida e inicie.",
        startQualify: "Iniciar classificação", qualifyScreenTitle: "Classificação",
        countdownPrefix: "Corrida começa em",
        countdownGo: "HORA DA CORRIDA! Inicie agora!",
        countdownAlert: "⏰ Corrida começa em {min} minutos!",
        autoStarting: "Iniciando automaticamente...",
        lblAutoStart: "Início automático no horário",
        lblDoublesHint: "Mesmo piloto consecutivamente",
        lblMaxConsecutive: "Máx. stints consecutivos por piloto",
        consec2: "2", consec3: "3", consecUnlimited: "Ilimitado",
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
        runDemo: "Demo",
        goodPace: "Bom Ritmo",
        lblStartTime: "🕐 Hora de Início", lblStartDate: "📅 Data da Corrida",
        lblSquadSchedule: "🔄 Janela de Esquadrões", lblSquadScheduleHint: "Fora da janela, todos pilotos compartilham. Dentro, esquadrões revezam igualmente.",
        lblSquadWindowStart: "Início janela", lblSquadWindowEnd: "Fim janela",
        squadOff: "Desligado", squad2: "2 Esquadrões", squad3: "3 Esquadrões", squad4: "4 Esquadrões",
        lblAppearance: "🎨 Aparência", lblPageBg: "Fundo da página", lblColorThemes: "Temas de cor",
        laps: "VOLTAS", gap: "DIFERENÇA", totalCompetitors: "CARROS", waitingData: "Aguardando dados...",
        boxThisLap: "🏁 BOX NESTA VOLTA", boxNextLap: "📢 BOX PRÓXIMA VOLTA", stayOut: "FIQUE FORA", ltOnTrack: "NA PISTA", ltInPit: "NOS BOXES",
        driverEntryHint: "Digite o ID da corrida para conectar", driverEntryLabel: "ID da corrida", driverConnect: "Conectar como piloto", driverIdTooShort: "ID muito curto", joinAsDriver: "Entrar como piloto", backToSetup: "← Voltar às configurações",
        nextStintIn: "Seu próximo stint em", stayAwake: "Fique acordado", sleepOk: "Pode dormir", yourStints: "Seus Stints", noStintsFound: "Nenhum stint encontrado para você", wakeUpAlert: "⏰ Acorde! Seu stint está chegando",
        viewerNameHint: "Digite seu nome para participar da corrida", viewerNameLabel: "Seu Nome", requestToJoin: "Solicitar Entrada", waitingForApproval: "Aguardando aprovação...", waitingForApprovalHint: "O administrador da corrida aprovará sua solicitação", viewerNameTooShort: "O nome deve ter pelo menos 2 caracteres",
        proFeature: "Recurso Pro", proUpgradeTitle: "⭐ Atualizar para Pro", proUpgradeMsg: "Desbloqueie Cronometragem Ao Vivo, Estratégia IA, Esquadrões, pilotos e temas ilimitados, e mais!", proActivate: "Ativar licença", proDeactivate: "Desativar", proEnterKey: "Digite a chave de licença...", proInvalidKey: "Chave de licença inválida", proActivated: "⭐ Pro Ativado!", proBadge: "PRO", proRequired: "requer Pro", proHaveCoupon: "🎟️ Tem um código de cupom?", proApplyCoupon: "Aplicar",
        onboardTitle1: "Bem-vindo ao Strateger!", onboardDesc1: "Seu assistente de estratégia de pit para corridas de endurance de kart. Configure sua primeira corrida em 3 passos simples.",
        onboardTitle2: "Configure sua corrida", onboardDesc2: "Insira duração da corrida, paradas obrigatórias e tempos de stint mín/máx no topo. Adicione seus pilotos abaixo — escolha quem larga e atribua equipes para turnos noturnos.",
        onboardTitle3: "Visualize e ajuste", onboardDesc3: "Toque em 'Visualizar Estratégia' para ver o cronograma completo. Arraste stints para reordenar, ajuste durações ou salve seu plano na nuvem.",
        onboardTitle4: "Hora da corrida!", onboardDesc4: "Aperte 'Iniciar Corrida' e o painel ao vivo assume — acompanhe cronômetros, receba alertas de pit, compartilhe um link ao vivo com a equipe e gerencie trocas de pilotos em tempo real.",
        onboardSkip: "Pular", onboardNext: "Próximo", onboardDone: "Vamos lá!",
        appTitle: "STRATEGER",
        aiOptimize: "Otimizar Estratégia IA",
        raceFinished: "CORRIDA ENCERRADA", totalPitTime: "Tempo no Box", raceStart: "Início", pitLog: "Registo de Paragens", drove: "Dirigiu", pitNoun: "Box", driveNoun: "Condução", stints: "Stints", avgStint: "Média",
        demoSelectFeatures: "Selecione recursos Pro para testar", demoLiveTimingDesc: "Classificação simulada de 20 equipes", demoRainLabel: "Simulação de chuva", demoRainDesc: "Eventos de chuva aleatórios com mudança de ritmo", demoPenaltyDesc: "Penalidades aleatórias e adições de tempo", demoTiresLabel: "Degradação de pneus", demoTiresDesc: "Tempos de volta aumentam ao longo do stint", demoSquadsLabel: "Esquadrões", demoSquadsDesc: "Grupos de pilotos com rotação", demoFuelLabel: "Gestão de combustível", demoFuelDesc: "Acompanhar combustível e reabastecer",
        unitMin: "min", unitHour: "h",
        soundMute: "Silenciar", soundUnmute: "Ativar Som",
        undoPit: "Cancelar Box", undoPitToast: "Entrada cancelada", undoCountdown: "Cancelar",
        exportPdf: "Exportar PDF", exportImage: "Compartilhar Imagem", exportingPdf: "Gerando PDF...",
        stintsLeft: "STINTS RESTANTES", future: "FUTURO", addStop: "ADICIONAR PARADA", finalLap: "VOLTA FINAL",
        heroTitle: "Estratégia de Corrida", heroSub: "Planejar · Gerir · Vencer",
        qpSprint: "⚡ Sprint", qpEndurance: "🏁 Resistência", qpNoLimit: "∞ Sem Limite", qpQualify: "⏱️ + Qualif.", qpDemo: "🎬 Demo", qpLibrary: "📚 Biblioteca",
        heroCollapse: "Recolher", heroExpand: "Config",
        rulesPdfBtn: "Carregar Regulamento (PDF)", rulesPdfLoaded: "Regulamento Carregado",
        rulesPdfModalTitle: "Regulamento PDF", rulesPdfModalSub: "A IA lê as regras e sugere a melhor estratégia no seu idioma",
        rulesPdfDrop: "Clique para selecionar PDF", rulesPdfDropHint: "Máx ~50 páginas recomendadas",
        rulesPdfReading: "Lendo PDF…", rulesPdfError: "Não foi possível ler o PDF.", rulesPdfAiError: "IA não retornou resultado.",
        rulesPdfClear: "Remover", rulesPdfAnalyze: "Analisar e Sugerir Estratégia", pages: "páginas",
        saveSettings: "Salvar", backToRace: "← Voltar à Corrida",
        livePreviewBtn: "▶ PLANO",
        appearance: "Aparência",
        raceHistory: "Histórico de Corridas", noRaceHistory: "Sem histórico. Complete uma corrida para ver aqui.",
        qualifyPartMultiCount: "Número de pilotos", qualifyRuns: "Voltas por piloto",
        qualifyPitMin: "Tempo mínimo", qualifyPitMinSec: "Segundos mínimos no box",
        onboardWelcome: "Bem-vindo ao Strateger!", onboardDemoHint: "A melhor forma de começar é correr uma corrida demo — leva 30 segundos e mostra tudo como funciona.", onboardRunDemo: "Correr Demo",
        leaderLabel: "LÍDER", pitLabel: "BOX",
        lapSingular: "volta", lapPlural: "voltas",
        topKartsTitle: "TOP KARTS", numDecSep: ",",
        raceClockLabel: "TEMPO DE CORRIDA",
        teamLogoUpload: "Enviar logo", teamLogoChange: "Alterar logo", teamLogoRemove: "Remover",
        teamLogoUploading: "Enviando…", teamLogoTooLarge: "Ficheiro demasiado grande (máx. 2 MB)",
        teamLogoInvalidType: "Apenas JPG, PNG ou SVG",
        stintAvg: "Méd. Stint",
        norm: "NORM",
        pitLatestExitIn: "Saída máx. em", pitLeaveNow: "⚠️ Saia agora!", pitLatestExitPassed: "🚨 SAÍDA ATRASADA",
    },
    ru: {
        ltSearchType: "Фильтр по:", ltTeam: "Команда", ltDriver: "Пилот", ltKart: "Карт №", ltPlaceholder: "Поиск...",
        previewTitle: "Предпросмотр стратегии", addToCalendar: "Добавить в календарь", timeline: "Хронология", driverSchedule: "Сводка стинтов", totalTime: "Общее время", close: "Закрыть",
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
        modeRace: "Только гонка", modeQualify: "Квалификация + Гонка",
        qualifyTitle: "Квалификация", qualifyFormat: "Формат", qualifyFmtSimple: "Простой", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "Сегменты", qualifyDuration: "Длит. квал. (мин)", qualifyParticipation: "Участие гонщиков",
        qualifyPartOne: "Один", qualifyPartMulti: "Несколько", qualifyPartAll: "Все", qualifyPartOneDriver: "Гонщик",
        qualifyPitRule: "Правило пит-стопа", qualifyPitNone: "Без правила", qualifyPitMustChange: "Обязательная смена",
        qualifyRun: "Заезд", qualifyStageResults: "Результаты", qualifyUpNext: "Следующий",
        qualifyAdvance: "Перейти к следующему этапу", qualifySegmentTime: "Длит. (мин)",
        qualifyNextRun: "Следующий заезд", qualifyLastRun: "Последний заезд", qualifyDoneStartRace: "Квал. завершена! Настройте гонку и запускайте.",
        startQualify: "Начать квалификацию", qualifyScreenTitle: "Квалификация",
        countdownPrefix: "Гонка через",
        countdownGo: "ВРЕМЯ ГОНКИ! Стартуйте!",
        countdownAlert: "⏰ Гонка через {min} минут!",
        autoStarting: "Автостарт...",
        lblAutoStart: "Автостарт во время гонки",
        lblDoublesHint: "Одинаковый пилот подряд",
        lblMaxConsecutive: "Макс. подряд стинтов на пилота",
        consec2: "2", consec3: "3", consecUnlimited: "Без ограничений",
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
        runDemo: "Демо",
        goodPace: "Хороший Темп",
        lblStartTime: "🕐 Время старта", lblStartDate: "📅 Дата гонки",
        lblSquadSchedule: "🔄 Окно групп", lblSquadScheduleHint: "Вне окна все водители делят поровну. В окне группы чередуются равномерно.",
        lblSquadWindowStart: "Начало окна", lblSquadWindowEnd: "Конец окна",
        squadOff: "Выкл", squad2: "2 Группы", squad3: "3 Группы", squad4: "4 Группы",
        lblAppearance: "🎨 Внешний вид", lblPageBg: "Фон страницы", lblColorThemes: "Цветовые темы",
        laps: "КРУГИ", gap: "РАЗРЫВ", totalCompetitors: "МАШИНЫ", waitingData: "Ожидание данных...",
        boxThisLap: "🏁 ЗАЕЗД В БОКСЫ ЭТОТ КРУГ", boxNextLap: "📢 БОКСЫ СЛЕДУЮЩИЙ КРУГ", stayOut: "ОСТАВАЙТЕСЬ НА ТРАССЕ", ltOnTrack: "НА ТРАССЕ", ltInPit: "В БОКСАХ",
        driverEntryHint: "Введите ID гонки для подключения", driverEntryLabel: "ID гонки", driverConnect: "Подключиться как пилот", driverIdTooShort: "ID слишком короткий", joinAsDriver: "Войти как пилот", backToSetup: "← Назад к настройкам",
        nextStintIn: "Ваш следующий стинт через", stayAwake: "Не спите", sleepOk: "Можно спать", yourStints: "Ваши стинты", noStintsFound: "Стинты для вас не найдены", wakeUpAlert: "⏰ Проснитесь! Ваш стинт скоро",
        viewerNameHint: "Введите имя, чтобы присоединиться к гонке", viewerNameLabel: "Ваше имя", requestToJoin: "Запросить доступ", waitingForApproval: "Ожидание одобрения...", waitingForApprovalHint: "Администратор гонки одобрит ваш запрос", viewerNameTooShort: "Имя должно содержать минимум 2 символа",
        proFeature: "Функция Pro", proUpgradeTitle: "⭐ Обновить до Pro", proUpgradeMsg: "Разблокируйте Live Timing, ИИ-стратегию, группы, безлимитных пилотов и темы, и многое другое!", proActivate: "Активировать лицензию", proDeactivate: "Деактивировать", proEnterKey: "Введите лицензионный ключ...", proInvalidKey: "Неверный лицензионный ключ", proActivated: "⭐ Pro Активирован!", proBadge: "PRO", proRequired: "требуется Pro", proHaveCoupon: "🎟️ Есть купон?", proApplyCoupon: "Применить",
        onboardTitle1: "Добро пожаловать в Strateger!", onboardDesc1: "Ваш помощник по стратегии пит-стопов для картинговых гонок на выносливость. Настройте первую гонку за 3 простых шага.",
        onboardTitle2: "Настройте гонку", onboardDesc2: "Введите длительность, обязательные пит-стопы и мин/макс время стинта вверху. Добавьте пилотов ниже — выберите стартового и назначьте группы для ночных смен.",
        onboardTitle3: "Предпросмотр и корректировка", onboardDesc3: "Нажмите 'Предпросмотр' чтобы увидеть полный план стинтов. Перетаскивайте для изменения порядка, корректируйте длительность или сохраните план в облаке.",
        onboardTitle4: "На старт!", onboardDesc4: "Нажмите 'Старт' и панель управления заработает — следите за таймерами, получайте оповещения о пит-стопах, делитесь ссылкой с командой и управляйте сменами пилотов в реальном времени.",
        onboardSkip: "Пропустить", onboardNext: "Далее", onboardDone: "Поехали!",
        appTitle: "STRATEGER",
        aiOptimize: "Оптимизировать стратегию (ИИ)",
        raceFinished: "ГОНКА ЗАВЕРШЕНА", totalPitTime: "Время в боксах", raceStart: "Старт", pitLog: "Журнал пит-стопов", drove: "Ехал", pitNoun: "Пит", driveNoun: "Езда", stints: "Стинты", avgStint: "Сред.",
        demoSelectFeatures: "Выберите Pro-функции для тестирования", demoLiveTimingDesc: "Таблица 20 команд", demoRainLabel: "Симуляция дождя", demoRainDesc: "Случайные осадки с изменением темпа", demoPenaltyDesc: "Случайные штрафы и добавление времени", demoTiresLabel: "Износ шин", demoTiresDesc: "Время круга увеличивается в течение стинта", demoSquadsLabel: "Группы", demoSquadsDesc: "Группы гонщиков с ротацией", demoFuelLabel: "Управление топливом", demoFuelDesc: "Отслеживание топлива и дозаправка",
        unitMin: "мин", unitHour: "ч",
        soundMute: "Без звука", soundUnmute: "Включить звук",
        undoPit: "Отменить пит", undoPitToast: "Вход в пит отменён", undoCountdown: "Отмена",
        exportPdf: "Экспорт PDF", exportImage: "Поделиться картинкой", exportingPdf: "Создание PDF...",
        heroTitle: "Стратегия гонки", heroSub: "Планировать · Управлять · Побеждать",
        qpSprint: "⚡ Спринт", qpEndurance: "🏁 Выносливость", qpNoLimit: "∞ Без лимита", qpQualify: "⏱️ + Квали", qpDemo: "🎬 Демо", qpLibrary: "📚 Библиотека",
        heroCollapse: "Скрыть", heroExpand: "Настройки",
        rulesPdfBtn: "Загрузить регламент (PDF)", rulesPdfLoaded: "Регламент загружен",
        rulesPdfModalTitle: "Регламент гонки PDF", rulesPdfModalSub: "ИИ прочитает правила и предложит лучшую стратегию на вашем языке",
        rulesPdfDrop: "Нажмите для выбора PDF", rulesPdfDropHint: "Рекомендуется до ~50 страниц",
        rulesPdfReading: "Чтение PDF…", rulesPdfError: "Не удалось прочитать PDF.", rulesPdfAiError: "ИИ не вернул результат.",
        rulesPdfClear: "Удалить", rulesPdfAnalyze: "Анализировать и предложить стратегию", pages: "страниц",
        saveSettings: "Сохранить", backToRace: "← Назад к гонке",
        livePreviewBtn: "▶ ПЛАН",
        appearance: "Внешний вид",
        raceHistory: "История гонок", noRaceHistory: "Нет истории. Завершите гонку, чтобы увидеть её здесь.",
        onboardWelcome: "Добро пожаловать в Strateger!", onboardDemoHint: "Лучший способ начать — запустить демо-гонку. Занимает 30 секунд и показывает всё в действии.", onboardRunDemo: "Запустить демо",
        leaderLabel: "ЛИДЕР", pitLabel: "ПИТ",
        lapSingular: "круг", lapPlural: "кругов",
        topKartsTitle: "ТОП КАРТЫ", numDecSep: ",",
        raceClockLabel: "ВРЕМЯ ГОНКИ",
        teamLogoUpload: "Загрузить лого", teamLogoChange: "Изменить лого", teamLogoRemove: "Удалить",
        teamLogoUploading: "Загрузка…", teamLogoTooLarge: "Файл слишком большой (макс. 2 МБ)",
        teamLogoInvalidType: "Только JPG, PNG или SVG",
        stintAvg: "Ср. Стинт",
        norm: "НОРМ",
        pitLatestExitIn: "Выезд не позднее", pitLeaveNow: "⚠️ Выезжай!", pitLatestExitPassed: "🚨 ВЫЕЗД ПРОСРОЧЕН",
    },
    ar: {
        ltSearchType: "تصفية حسب:", ltTeam: "الفريق", ltDriver: "السائق", ltKart: "رقم الكارت", ltPlaceholder: "البحث...",
        previewTitle: "معاينة الإستراتيجية", addToCalendar: "إضافة للتقويم", timeline: "الجدول الزمني", driverSchedule: "ملخص الجولات", totalTime: "الوقت الإجمالي", close: "إغلاق",
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
        modeRace: "سباق فقط", modeQualify: "التأهل + السباق",
        qualifyTitle: "التأهل", qualifyFormat: "الصيغة", qualifyFmtSimple: "بسيط", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "المراحل", qualifyDuration: "مدة التأهل (دقائق)", qualifyParticipation: "مشاركة السائقين",
        qualifyPartOne: "واحد", qualifyPartMulti: "متعددون", qualifyPartAll: "الكل", qualifyPartOneDriver: "سائق",
        qualifyPitRule: "قاعدة الحفرة", qualifyPitNone: "بلا قاعدة", qualifyPitMustChange: "يجب التغيير",
        qualifyRun: "جولة", qualifyStageResults: "النتائج", qualifyUpNext: "التالي",
        qualifyAdvance: "الانتقال للمرحلة التالية", qualifySegmentTime: "المدة (دق)",
        qualifyNextRun: "الجولة التالية", qualifyLastRun: "الجولة الأخيرة", qualifyDoneStartRace: "انتهى التأهل! اضبط إعدادات السباق وابدأ.",
        startQualify: "بدء التأهل", qualifyScreenTitle: "التأهل",
        countdownPrefix: "السباق يبدأ خلال",
        countdownGo: "وقت السباق! ابدأ الآن!",
        countdownAlert: "⏰ السباق يبدأ خلال {min} دقائق!",
        autoStarting: "بدء تلقائي...",
        lblAutoStart: "بدء تلقائي في موعد السباق",
        lblDoublesHint: "نفس السائق متتالي",
        lblMaxConsecutive: "الحد الأقصى للجولات المتتالية لكل سائق",
        consec2: "2", consec3: "3", consecUnlimited: "غير محدود",
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
        runDemo: "تجريبي",
        goodPace: "وتيرة جيدة",
        lblStartTime: "🕐 وقت البدء", lblStartDate: "📅 تاريخ السباق",
        lblSquadSchedule: "🔄 نافذة الفرق", lblSquadScheduleHint: "خارج النافذة يتشارك جميع السائقين بالتساوي. داخلها، تتناوب الفرق بالتساوي.",
        lblSquadWindowStart: "بداية النافذة", lblSquadWindowEnd: "نهاية النافذة",
        squadOff: "إيقاف", squad2: "فريقان", squad3: "3 فرق", squad4: "4 فرق",
        lblAppearance: "🎨 المظهر", lblPageBg: "خلفية الصفحة", lblColorThemes: "سمات الألوان",
        laps: "لفات", gap: "فارق", totalCompetitors: "سيارات", waitingData: "في انتظار البيانات...",
        boxThisLap: "🏁 ادخل هذه اللفة", boxNextLap: "📢 ادخل اللفة القادمة", stayOut: "ابقَ على المسار", ltOnTrack: "على المسار", ltInPit: "في الحفرة",
        driverEntryHint: "أدخل رقم السباق للاتصال", driverEntryLabel: "رقم السباق", driverConnect: "اتصل كسائق", driverIdTooShort: "الرقم قصير جداً", joinAsDriver: "انضم كسائق", backToSetup: "← العودة للإعدادات",
        nextStintIn: "فترتك القادمة خلال", stayAwake: "ابقَ مستيقظاً", sleepOk: "يمكنك النوم", yourStints: "فتراتك", noStintsFound: "لم يتم العثور على فترات لك", wakeUpAlert: "⏰ استيقظ! فترتك قادمة",
        viewerNameHint: "أدخل اسمك للانضمام إلى السباق", viewerNameLabel: "اسمك", requestToJoin: "طلب الانضمام", waitingForApproval: "في انتظار الموافقة...", waitingForApprovalHint: "سيوافق مدير السباق على طلبك", viewerNameTooShort: "يجب أن يحتوي الاسم على حرفين على الأقل",
        proFeature: "ميزة Pro", proUpgradeTitle: "⭐ ترقية إلى Pro", proUpgradeMsg: "افتح التوقيت المباشر، استراتيجية الذكاء الاصطناعي، الفرق، سائقين وأنماط غير محدودة، والمزيد!", proActivate: "تفعيل الترخيص", proDeactivate: "إلغاء التفعيل", proEnterKey: "أدخل مفتاح الترخيص...", proInvalidKey: "مفتاح ترخيص غير صالح", proActivated: "⭐ تم تفعيل Pro!", proBadge: "PRO", proRequired: "يتطلب Pro", proHaveCoupon: "🎟️ هل لديك رمز قسيمة؟", proApplyCoupon: "تطبيق",
        onboardTitle1: "مرحباً بك في Strateger!", onboardDesc1: "مساعدك في استراتيجية البيت لسباقات التحمل بالكارت. أعد سباقك الأول في 3 خطوات سهلة.",
        onboardTitle2: "إعداد السباق", onboardDesc2: "أدخل مدة السباق، التوقفات المطلوبة وأوقات الفترات الدنيا/القصوى في الأعلى. أضف السائقين أدناه — اختر من يبدأ وعيّن الفرق للمناوبات الليلية.",
        onboardTitle3: "معاينة وضبط", onboardDesc3: "اضغط 'معاينة الاستراتيجية' لرؤية الجدول الزمني الكامل. اسحب الفترات لإعادة الترتيب، عدّل المدد أو احفظ خطتك في السحابة.",
        onboardTitle4: "انطلق!", onboardDesc4: "اضغط 'ابدأ السباق' ولوحة القيادة الحية تتولى الأمر — تتبع المؤقتات، واستلم تنبيهات البيت، وشارك رابطاً مباشراً مع فريقك وأدر تبديلات السائقين في الوقت الفعلي.",
        onboardSkip: "تخطي", onboardNext: "التالي", onboardDone: "هيا بنا!",
        appTitle: "STRATEGER",
        aiOptimize: "تحسين الاستراتيجية بالذكاء الاصطناعي",
        raceFinished: "انتهى السباق", totalPitTime: "وقت التوقف", raceStart: "البداية", pitLog: "سجل التوقفات", drove: "قاد", pitNoun: "توقف", driveNoun: "قيادة", stints: "فترات", avgStint: "متوسط",
        demoSelectFeatures: "اختر ميزات Pro للاختبار", demoLiveTimingDesc: "لوحة تصنيف 20 فريقاً", demoRainLabel: "محاكاة المطر", demoRainDesc: "أحداث مطر عشوائية مع تغيير الإيقاع", demoPenaltyDesc: "عقوبات عشوائية وإضافات زمنية", demoTiresLabel: "تآكل الإطارات", demoTiresDesc: "أوقات اللفة تزداد خلال الفترة", demoSquadsLabel: "الفرق", demoSquadsDesc: "مجموعات السائقين مع التناوب", demoFuelLabel: "إدارة الوقود", demoFuelDesc: "تتبع الوقود والتوقف للتزويد",
        unitMin: "د", unitHour: "س",
        soundMute: "كتم الصوت", soundUnmute: "إلغاء كتم الصوت",
        undoPit: "إلغاء الحفرة", undoPitToast: "تم إلغاء دخول الحفرة", undoCountdown: "إلغاء",
        exportPdf: "تصدير PDF", exportImage: "مشاركة كصورة", exportingPdf: "إنشاء PDF...",
        heroTitle: "استراتيجية السباق", heroSub: "خطط · أدر · انتصر",
        qpSprint: "⚡ سبرينت", qpEndurance: "🏁 تحمل", qpNoLimit: "∞ بلا حدود", qpQualify: "⏱️ + تأهيل", qpDemo: "🎬 عرض", qpLibrary: "📚 مكتبة",
        heroCollapse: "إخفاء", heroExpand: "إعدادات",
        rulesPdfBtn: "رفع قواعد السباق (PDF)", rulesPdfLoaded: "تم تحميل القواعد",
        rulesPdfModalTitle: "قواعد السباق PDF", rulesPdfModalSub: "سيقرأ الذكاء الاصطناعي القواعد ويقترح أفضل استراتيجية بلغتك",
        rulesPdfDrop: "انقر لتحديد PDF", rulesPdfDropHint: "يُنصح بحد أقصى ~50 صفحة",
        rulesPdfReading: "قراءة PDF…", rulesPdfError: "تعذّر قراءة PDF.", rulesPdfAiError: "لم يُرجع الذكاء الاصطناعي نتيجة.",
        rulesPdfClear: "إزالة", rulesPdfAnalyze: "تحليل واقتراح استراتيجية", pages: "صفحات",
        saveSettings: "حفظ", backToRace: "← العودة للسباق",
        livePreviewBtn: "▶ خطة",
        appearance: "المظهر",
        raceHistory: "سجل السباقات", noRaceHistory: "لا يوجد سجل. أكمل سباقاً لرؤيته هنا.",
        onboardWelcome: "مرحباً بك في Strateger!", onboardDemoHint: "أفضل طريقة للبدء هي تشغيل سباق تجريبي — يستغرق 30 ثانية ويُظهر كيف يعمل كل شيء.", onboardRunDemo: "تشغيل سباق تجريبي",
        qualifyPartMultiCount: "عدد السائقين", qualifyRuns: "جولات لكل سائق",
        qualifyPitMin: "الحد الأدنى للوقت", qualifyPitMinSec: "الحد الأدنى من الثواني في الحفرة",
        leaderLabel: "القائد", pitLabel: "حفرة",
        lapSingular: "دورة", lapPlural: "دورات",
        topKartsTitle: "أفضل الكارتات", numDecSep: ".",
        raceClockLabel: "وقت السباق",
        teamLogoUpload: "رفع الشعار", teamLogoChange: "تغيير الشعار", teamLogoRemove: "إزالة",
        teamLogoUploading: "جارٍ الرفع…", teamLogoTooLarge: "الملف كبير جدًا (الحد الأقصى 2 ميغابايت)",
        teamLogoInvalidType: "JPG أو PNG أو SVG فقط",
        stintAvg: "متوسط الشوط",
        norm: "عادي",
        pitLatestExitIn: "أقصى وقت للخروج", pitLeaveNow: "⚠️ اخرج الآن!", pitLatestExitPassed: "🚨 تأخر الخروج",
    },
    es: {
        ltSearchType: "Filtrar por:", ltTeam: "Equipo", ltDriver: "Piloto", ltKart: "Kart nº", ltPlaceholder: "Buscar...",
        previewTitle: "Vista previa de la estrategia", addToCalendar: "Añadir al calendario", timeline: "Cronología", driverSchedule: "Resumen de Stints", totalTime: "Tiempo total", close: "Cerrar",
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
        modeRace: "Solo carrera", modeQualify: "Clasificación + Carrera",
        qualifyTitle: "Clasificación", qualifyFormat: "Formato", qualifyFmtSimple: "Simple", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "Segmentos", qualifyDuration: "Duración clasif. (min)", qualifyParticipation: "Participación",
        qualifyPartOne: "Uno", qualifyPartMulti: "Varios", qualifyPartAll: "Todos", qualifyPartOneDriver: "Piloto",
        qualifyPitRule: "Regla de boxes", qualifyPitNone: "Sin regla", qualifyPitMustChange: "Cambio obligatorio",
        qualifyRun: "Vuelta", qualifyStageResults: "Resultados", qualifyUpNext: "Siguiente",
        qualifyAdvance: "Avanzar a la siguiente etapa", qualifySegmentTime: "Duración (min)",
        qualifyNextRun: "Siguiente vuelta", qualifyLastRun: "Última vuelta", qualifyDoneStartRace: "¡Clasif. terminada! Configura la carrera y empieza.",
        startQualify: "Iniciar clasificación", qualifyScreenTitle: "Clasificación",
        countdownPrefix: "Carrera en",
        countdownGo: "¡HORA DE LA CARRERA! ¡Empieza ahora!",
        countdownAlert: "⏰ ¡Carrera en {min} minutos!",
        autoStarting: "Iniciando automáticamente...",
        lblAutoStart: "Inicio automático a la hora",
        lblDoublesHint: "Mismo piloto consecutivamente",
        lblMaxConsecutive: "Máx. stints consecutivos por piloto",
        consec2: "2", consec3: "3", consecUnlimited: "Ilimitado",
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
        runDemo: "Demo",
        goodPace: "Buen Ritmo",
        lblStartTime: "🕐 Hora de Inicio", lblStartDate: "📅 Fecha de Carrera",
        lblSquadSchedule: "🔄 Ventana de Escuadrones", lblSquadScheduleHint: "Fuera de la ventana, todos comparten por igual. Dentro, los escuadrones rotan equitativamente.",
        lblSquadWindowStart: "Inicio ventana", lblSquadWindowEnd: "Fin ventana",
        squadOff: "Desactivado", squad2: "2 Escuadrones", squad3: "3 Escuadrones", squad4: "4 Escuadrones",
        lblAppearance: "🎨 Apariencia", lblPageBg: "Fondo de página", lblColorThemes: "Temas de color",
        laps: "VUELTAS", gap: "BRECHA", totalCompetitors: "COCHES", waitingData: "Esperando datos...",
        boxThisLap: "🏁 BOX ESTA VUELTA", boxNextLap: "📢 BOX SIGUIENTE VUELTA", stayOut: "SIGUE EN PISTA", ltOnTrack: "EN PISTA", ltInPit: "EN BOXES",
        driverEntryHint: "Ingresa el ID de carrera para conectarte", driverEntryLabel: "ID de carrera", driverConnect: "Conectar como piloto", driverIdTooShort: "El ID es muy corto", joinAsDriver: "Unirse como piloto", backToSetup: "← Volver a configuración",
        nextStintIn: "Tu próximo stint en", stayAwake: "Mantente despierto", sleepOk: "Puedes dormir", yourStints: "Tus Stints", noStintsFound: "No se encontraron stints para ti", wakeUpAlert: "⏰ ¡Despierta! Tu stint se acerca",
        viewerNameHint: "Ingresa tu nombre para unirte a la carrera", viewerNameLabel: "Tu Nombre", requestToJoin: "Solicitar Unirse", waitingForApproval: "Esperando aprobación...", waitingForApprovalHint: "El administrador de la carrera aprobará tu solicitud", viewerNameTooShort: "El nombre debe tener al menos 2 caracteres",
        proFeature: "Función Pro", proUpgradeTitle: "⭐ Actualizar a Pro", proUpgradeMsg: "¡Desbloquea Cronometraje en Vivo, Estrategia IA, Escuadrones, pilotos y temas ilimitados, y más!", proActivate: "Activar licencia", proDeactivate: "Desactivar", proEnterKey: "Ingresa la clave de licencia...", proInvalidKey: "Clave de licencia inválida", proActivated: "⭐ ¡Pro Activado!", proBadge: "PRO", proRequired: "requiere Pro", proHaveCoupon: "🎟️ ¿Tienes un código de cupón?", proApplyCoupon: "Aplicar",
        onboardTitle1: "¡Bienvenido a Strateger!", onboardDesc1: "Tu asistente de estrategia de boxes para carreras de resistencia en karting. Configura tu primera carrera en 3 pasos sencillos.",
        onboardTitle2: "Configura tu carrera", onboardDesc2: "Ingresa la duración, paradas obligatorias y tiempos de stint mín/máx arriba. Añade tus pilotos abajo — elige quién sale y asigna escuadras para los turnos nocturnos.",
        onboardTitle3: "Vista previa y ajustes", onboardDesc3: "Pulsa 'Vista previa' para ver el plan completo de stints. Arrastra para reordenar, ajusta duraciones o guarda tu plan en la nube.",
        onboardTitle4: "¡A correr!", onboardDesc4: "Pulsa 'Iniciar Carrera' y el panel en vivo toma el control — sigue los cronómetros, recibe alertas de boxes, comparte un enlace en vivo con tu equipo y gestiona los cambios de piloto en tiempo real.",
        onboardSkip: "Saltar", onboardNext: "Siguiente", onboardDone: "¡Vamos!",
        appTitle: "STRATEGER",
        aiOptimize: "Optimizar estrategia IA",
        raceFinished: "CARRERA TERMINADA", totalPitTime: "Tiempo en boxes", raceStart: "Inicio", pitLog: "Registro de paradas", drove: "Condujo", pitNoun: "Box", driveNoun: "Conducción", stints: "Tramos", avgStint: "Prom.",
        demoSelectFeatures: "Selecciona funciones Pro para probar", demoLiveTimingDesc: "Clasificación simulada de 20 equipos", demoRainLabel: "Simulación de lluvia", demoRainDesc: "Eventos de lluvia aleatorios con cambio de ritmo", demoPenaltyDesc: "Penalizaciones aleatorias y adiciones de tiempo", demoTiresLabel: "Degradación de neumáticos", demoTiresDesc: "Los tiempos de vuelta aumentan durante el tramo", demoSquadsLabel: "Escuadrones", demoSquadsDesc: "Grupos de pilotos con rotación", demoFuelLabel: "Gestión de combustible", demoFuelDesc: "Seguimiento del combustible y repostaje",
        unitMin: "min", unitHour: "h",
        soundMute: "Silenciar", soundUnmute: "Activar sonido",
        undoPit: "Deshacer Pit", undoPitToast: "Entrada al pit deshecha", undoCountdown: "Deshacer",
        exportPdf: "Exportar PDF", exportImage: "Compartir Imagen", exportingPdf: "Generando PDF...",
        heroTitle: "Estrategia de Carrera", heroSub: "Planificar · Gestionar · Ganar",
        qpSprint: "⚡ Sprint", qpEndurance: "🏁 Resistencia", qpNoLimit: "∞ Sin Límite", qpQualify: "⏱️ + Clasif.", qpDemo: "🎬 Demo", qpLibrary: "📚 Biblioteca",
        heroCollapse: "Ocultar", heroExpand: "Config",
        rulesPdfBtn: "Subir Reglamento (PDF)", rulesPdfLoaded: "Reglamento Cargado",
        rulesPdfModalTitle: "Reglamento PDF", rulesPdfModalSub: "La IA leerá las reglas y sugerirá la mejor estrategia en tu idioma",
        rulesPdfDrop: "Clic para seleccionar PDF", rulesPdfDropHint: "Máx ~50 páginas recomendadas",
        rulesPdfReading: "Leyendo PDF…", rulesPdfError: "No se pudo leer el PDF.", rulesPdfAiError: "La IA no devolvió ningún resultado.",
        rulesPdfClear: "Eliminar", rulesPdfAnalyze: "Analizar y sugerir estrategia", pages: "páginas",
        saveSettings: "Guardar", backToRace: "← Volver a la Carrera",
        livePreviewBtn: "▶ PLAN",
        appearance: "Apariencia",
        raceHistory: "Historial de Carreras", noRaceHistory: "Sin historial. Completa una carrera para verlo aquí.",
        onboardWelcome: "¡Bienvenido a Strateger!", onboardDemoHint: "La mejor forma de empezar es correr una demo rápida — tarda 30 segundos y muestra exactamente cómo funciona todo.", onboardRunDemo: "Correr Demo",
        qualifyPartMultiCount: "Número de pilotos", qualifyRuns: "Vueltas por piloto",
        qualifyPitMin: "Tiempo mínimo", qualifyPitMinSec: "Segundos mínimos en boxes",
        leaderLabel: "LÍDER", pitLabel: "BOX",
        lapSingular: "vuelta", lapPlural: "vueltas",
        topKartsTitle: "TOP KARTS", numDecSep: ",",
        raceClockLabel: "TIEMPO DE CARRERA",
        teamLogoUpload: "Subir logo", teamLogoChange: "Cambiar logo", teamLogoRemove: "Quitar",
        teamLogoUploading: "Subiendo…", teamLogoTooLarge: "Archivo demasiado grande (máx. 2 MB)",
        teamLogoInvalidType: "Solo JPG, PNG o SVG",
        stintAvg: "Prom. Stint",
        norm: "NORM",
        pitLatestExitIn: "Salida máx. en", pitLeaveNow: "⚠️ ¡Sal ahora!", pitLatestExitPassed: "🚨 SALIDA TARDÍA",
    },
    it: {
        ltSearchType: "Filtra per:", ltTeam: "Squadra", ltDriver: "Pilota", ltKart: "Kart n°", ltPlaceholder: "Ricerca...", previewTitle: "Anteprima strategia", addToCalendar: "Aggiungi al calendario", timeline: "Cronologia", driverSchedule: "Riepilogo Stint", totalTime: "Tempo totale", close: "Chiudi",
        googleLogin: "Accedi con Google", eventCreated: "Evento creato!", eventError: "Errore creazione", raceEventTitle: "Gara di resistenza", errImpossible: "Strategia impossibile!", errAvgHigh: "Media > Max. Aggiungi soste.", errAvgLow: "Media < Min. Riduci soste.",
        appSubtitle: "Gestore strategia", generalInfo: "Info generale", advancedConstraints: "Vincoli avanzati", driverConfig: "Piloti", aiTitle: "Strategia IA", lblDuration: "Durata (H)", lblStops: "Soste richieste", lblMinStint: "Min stint", lblMaxStint: "Max stint", lblPitTime: "Tempo pit", lblPitClosedStart: "🚫 Chiuso inizio", lblPitClosedEnd: "🚫 Chiuso fine",
        lblMinDrive: "Min totale (min)", lblMaxDrive: "Max totale (min)", lblBuffer: "Avviso (s)", lblDoubles: "Consenti doppi", lblSquads: "Usa squadre", lblFuel: "Carburante", lblFuelTank: "Serbatoio (min)", addDriver: "+ Aggiungi", generateStrategy: "Genera (IA)", previewStrategy: "Anteprima", startRace: "Inizia", loadSaved: "Carica",
        raceTime: "TEMPO GARA", stops: "SOSTE", live: "DIRETTA", stop: "Ferma", pos: "POS", last: "ULT", best: "MIGLIORE", targetStint: "STINT OBIETTIVO", buildTime: "TEMPO COSTRUITO", current: "ATTUALE", stintTime: "TEMPO STINT", nextDriver: "Prossimo", penalty: "Penalità", enterPit: "ENTRA IN PIT", push: "SPINGI", problem: "PROBLEMA",
        resetMode: "Ripristina", nightMode: "MODALITÀ NOTTE", dry: "Secco", wet: "Pioggia", drying: "Asciugando", boxNow: "BOX ADESSO!", stayOnTrackUntilFurther: "Rimani in pista fino a nuovo avviso", pushMode: "MODALITÀ PUSH", squadSleeping: "SQUADRA DORME", squadWakeUp: "SVEGLIA SQUADRA", finalLap: "Ultimo giro", calculating: "Calcolando...", manualInput: "Manuale",
        saveStratTitle: "Salva", libTitle: "Libreria", aiPlaceholder: "es: 'Il pilota 1 preferisce...'", thStart: "Inizio", thEnd: "Fine", thType: "Tipo", thDriver: "Pilota", thDuration: "Durata", liveTiming: "Cronometraggio live", liveTimingUrl: "URL cronometraggio...", connectLive: "Connetti", disconnectLive: "Disconnetti", searchTeam: "Cerca squadra...", searchDriver: "Cerca pilota...", searchKart: "Cerca kart...", demoMode: "Modalità demo",
        sendEmail: "Invia", cancel: "Annulla", create: "Crea", save: "Salva", load: "Carica", delete: "Elimina", activeRaceFound: "Gara attiva trovata", continueRace: "Continua", discardRace: "Scarta", areYouSure: "Sei sicuro?", deleteWarning: "Questo eliminerà i dati in modo permanente.", yesDelete: "Sì, elimina", noKeep: "No, conserva", invite: "Invita", synced: "Sincronizzato",
        chatTitle: "Chat gara / D&R", enterName: "Inserisci il tuo nome", startChat: "Inizia chat", typeMessage: "Scrivi un suggerimento...", send: "Invia", viewer: "Spettatore", host: "OSPITE", suggestion: "Suggerimento", strategyOutlook: "PROSPETTIVA STRATEGICA", timeLeft: "TEMPO RIMANENTE", nextDriverLabel: "PROSSIMO PILOTA", totalHeader: "TOTALE", stopsHeader: "STINT", driverHeader: "PILOTA",
        stintsLeft: "STINT RIMANENTI", future: "FUTURO", max: "MAX", min: "MIN", rest: "RIPOSO", buffer: "Buffer", impossible: "IMPOSSIBILE", addStop: "AGGIUNGI SOSTA", avg: "MEDIA", finalLap: "ULTIMO GIRO", inPit: "IN PIT", nextLabel: "Prossimo", shortStintMsg: "⚠️ STINT CORTO! Rischio penalità", cancelEntry: "Annulla", notifyDriver: "📢 Notifica pilota", driverNotified: "✓ Pilota notificato", includesAdj: "Include aggiustamento:", missingSeconds: "Mancante", proceedToPit: "Procedere al pit?", wait: "ATTENDI...", getReady: "PREPARATI...", go: "VAI! VAI!", goOutIn: "ESCI TRA", exitPits: "Exit Pits", driverExitedEarly: "Il pilota è uscito presto", driverExitedEarlyNotice: "Il pilota è uscito dai box prima del tempo richiesto - conferma per accettare.", orangeZone: "⚠️ Zona arancione - solo NOTIFICA", targetLabel: "OBIETTIVO", driverLink: "Link pilota", tapToPit: "TOCCA PER ENTRARE AI BOX", tapToExit: "TOCCA PER USCIRE DAI BOX", pitsConfirm: "BOX?", tapAgainConfirm: "TOCCA DI NUOVO PER CONFERMARE", stintBest: "M.STINT",
        googleLoginBtn: "Accedi",
        testBtn: "Prova",
        demoBtn: "Demo",
        demoRace: "Demo",
        modeRace: "Solo gara", modeQualify: "Qualifiche + Gara",
        qualifyTitle: "Qualifiche", qualifyFormat: "Formato", qualifyFmtSimple: "Semplice", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "Segmenti", qualifyDuration: "Durata qualifiche (min)", qualifyParticipation: "Partecipazione",
        qualifyPartOne: "Uno", qualifyPartMulti: "Più piloti", qualifyPartAll: "Tutti", qualifyPartOneDriver: "Pilota",
        qualifyPitRule: "Regola box", qualifyPitNone: "Nessuna regola", qualifyPitMustChange: "Cambio obbligatorio",
        qualifyRun: "Giro", qualifyStageResults: "Risultati", qualifyUpNext: "Prossimo",
        qualifyAdvance: "Avanza alla fase successiva", qualifySegmentTime: "Durata (min)",
        qualifyNextRun: "Prossimo giro", qualifyLastRun: "Ultimo giro", qualifyDoneStartRace: "Qualifiche terminate! Configura la gara e inizia.",
        startQualify: "Inizia qualifiche", qualifyScreenTitle: "Qualifiche",
        countdownPrefix: "Gara tra",
        countdownGo: "ORA DELLA GARA! Parti ora!",
        countdownAlert: "⏰ Gara tra {min} minuti!",
        autoStarting: "Avvio automatico...",
        lblAutoStart: "Avvio automatico all'orario",
        lblDoublesHint: "Stesso pilota consecutivamente",
        lblMaxConsecutive: "Max stint consecutivi per pilota",
        consec2: "2", consec3: "3", consecUnlimited: "Illimitato",
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
        runDemo: "Demo",
        goodPace: "Buon Ritmo",
        lblStartTime: "🕐 Ora di Partenza", lblStartDate: "📅 Data della Gara",
        lblSquadSchedule: "🔄 Finestra Squadre", lblSquadScheduleHint: "Fuori dalla finestra tutti i piloti condividono. Dentro, le squadre ruotano equamente.",
        lblSquadWindowStart: "Inizio finestra", lblSquadWindowEnd: "Fine finestra",
        squadOff: "Disattivato", squad2: "2 Squadre", squad3: "3 Squadre", squad4: "4 Squadre",
        lblAppearance: "🎨 Aspetto", lblPageBg: "Sfondo pagina", lblColorThemes: "Temi colore",
        laps: "GIRI", gap: "DISTACCO", totalCompetitors: "AUTO", waitingData: "In attesa di dati...",
        boxThisLap: "🏁 BOX QUESTO GIRO", boxNextLap: "📢 BOX PROSSIMO GIRO", stayOut: "RIMANI IN PISTA", ltOnTrack: "IN PISTA", ltInPit: "AI BOX",
        driverEntryHint: "Inserisci l'ID gara per connetterti", driverEntryLabel: "ID gara", driverConnect: "Connetti come pilota", driverIdTooShort: "L'ID è troppo corto", joinAsDriver: "Unisciti come pilota", backToSetup: "← Torna alle impostazioni",
        nextStintIn: "Il tuo prossimo stint tra", stayAwake: "Resta sveglio", sleepOk: "Puoi dormire", yourStints: "I Tuoi Stint", noStintsFound: "Nessuno stint trovato per te", wakeUpAlert: "⏰ Svegliati! Il tuo stint si avvicina",
        viewerNameHint: "Inserisci il tuo nome per unirti alla gara", viewerNameLabel: "Il Tuo Nome", requestToJoin: "Richiedi di unirti", waitingForApproval: "In attesa di approvazione...", waitingForApprovalHint: "L'amministratore della gara approverà la tua richiesta", viewerNameTooShort: "Il nome deve avere almeno 2 caratteri",
        proFeature: "Funzione Pro", proUpgradeTitle: "Passa a Pro", proUpgradeMsg: "Sblocca Cronometraggio Live, Strategia IA, Squadre, piloti e temi illimitati, e altro!", proActivate: "Attiva licenza", proDeactivate: "Disattiva", proEnterKey: "Inserisci la chiave di licenza...", proInvalidKey: "Chiave di licenza non valida", proActivated: "⭐ Pro Attivato!", proBadge: "PRO", proRequired: "richiede Pro", proHaveCoupon: "🎟️ Hai un codice coupon?", proApplyCoupon: "Applica",
        onboardTitle1: "Benvenuto su Strateger!", onboardDesc1: "Il tuo assistente strategico per le gare di endurance in kart. Configura la tua prima gara in 3 semplici passi.",
        onboardTitle2: "Configura la gara", onboardDesc2: "Inserisci durata, soste obbligatorie e tempi stint min/max in alto. Aggiungi i tuoi piloti sotto — scegli chi parte e assegna le squadre per i turni notturni.",
        onboardTitle3: "Anteprima e regolazioni", onboardDesc3: "Tocca 'Anteprima Strategia' per vedere il piano completo. Trascina gli stint per riordinare, modifica le durate o salva il piano nel cloud.",
        onboardTitle4: "Si corre!", onboardDesc4: "Premi 'Inizia Gara' e la dashboard live prende il comando — monitora i timer, ricevi avvisi pit, condividi un link live con il team e gestisci i cambi pilota in tempo reale.",
        onboardSkip: "Salta", onboardNext: "Avanti", onboardDone: "Andiamo!",
        appTitle: "STRATEGER",
        aiOptimize: "Ottimizza strategia IA",
        raceFinished: "GARA TERMINATA", totalPitTime: "Tempo ai box", raceStart: "Partenza", pitLog: "Registro soste", drove: "Guidato", pitNoun: "Box", driveNoun: "Guida", stints: "Stint", avgStint: "Media",
        demoSelectFeatures: "Seleziona le funzioni Pro da testare", demoLiveTimingDesc: "Classifica simulata di 20 squadre", demoRainLabel: "Simulazione pioggia", demoRainDesc: "Eventi pioggia casuali con cambio di ritmo", demoPenaltyDesc: "Penalità casuali e aggiunte di tempo", demoTiresLabel: "Degrado gomme", demoTiresDesc: "I tempi sul giro aumentano durante lo stint", demoSquadsLabel: "Squadre", demoSquadsDesc: "Gruppi di piloti con rotazione", demoFuelLabel: "Gestione carburante", demoFuelDesc: "Monitorare il carburante e rifornimento",
        unitMin: "min", unitHour: "h",
        soundMute: "Muto", soundUnmute: "Riattiva",
        undoPit: "Annulla Pit", undoPitToast: "Ingresso pit annullato", undoCountdown: "Annulla",
        exportPdf: "Esporta PDF", exportImage: "Condividi Immagine", exportingPdf: "Generazione PDF...",
        heroTitle: "Strategia di Gara", heroSub: "Pianifica · Gestisci · Vinci",
        qpSprint: "⚡ Sprint", qpEndurance: "🏁 Resistenza", qpNoLimit: "∞ Senza Limite", qpQualify: "⏱️ + Qualifiche", qpDemo: "🎬 Demo", qpLibrary: "📚 Libreria",
        heroCollapse: "Nascondi", heroExpand: "Config",
        rulesPdfBtn: "Carica Regolamento (PDF)", rulesPdfLoaded: "Regolamento Caricato",
        rulesPdfModalTitle: "Regolamento PDF", rulesPdfModalSub: "L'IA legge le regole e suggerisce la migliore strategia nella tua lingua",
        rulesPdfDrop: "Clicca per selezionare PDF", rulesPdfDropHint: "Max ~50 pagine consigliate",
        rulesPdfReading: "Lettura PDF…", rulesPdfError: "Impossibile leggere il PDF.", rulesPdfAiError: "L'IA non ha restituito risultati.",
        rulesPdfClear: "Rimuovi", rulesPdfAnalyze: "Analizza e suggerisci strategia", pages: "pagine",
        saveSettings: "Salva", backToRace: "← Torna alla Gara",
        livePreviewBtn: "▶ PIANO",
        appearance: "Aspetto",
        raceHistory: "Cronologia Gare", noRaceHistory: "Nessuna cronologia. Completa una gara per vederla qui.",
        onboardWelcome: "Benvenuto su Strateger!", onboardDemoHint: "Il modo migliore per iniziare è una demo rapida — ci vogliono 30 secondi e mostra esattamente come funziona tutto.", onboardRunDemo: "Avvia Demo",
        qualifyPartMultiCount: "Numero di piloti", qualifyRuns: "Giri per pilota",
        qualifyPitMin: "Tempo minimo", qualifyPitMinSec: "Secondi minimi ai box",
        leaderLabel: "LEADER", pitLabel: "BOX",
        lapSingular: "giro", lapPlural: "giri",
        topKartsTitle: "TOP KART", numDecSep: ",",
        raceClockLabel: "TEMPO GARA",
        teamLogoUpload: "Carica logo", teamLogoChange: "Cambia logo", teamLogoRemove: "Rimuovi",
        teamLogoUploading: "Caricamento…", teamLogoTooLarge: "File troppo grande (max 2 MB)",
        teamLogoInvalidType: "Solo JPG, PNG o SVG",
        stintAvg: "Media Stint",
        norm: "NORM",
        pitLatestExitIn: "Uscita max tra", pitLeaveNow: "⚠️ Esci ora!", pitLatestExitPassed: "🚨 USCITA IN RITARDO",
    },
    ka: {
        ltSearchType: "ფილტრი:", ltTeam: "გუნდი", ltDriver: "მძღოლი", ltKart: "კარტი #", ltPlaceholder: "ძებნა...",
        previewTitle: "სტრატეგიის წინასწარი ნახვა", addToCalendar: "დაამატე კალენდარში", timeline: "ქრონოლოგია", driverSchedule: "სტინტების შეჯამება", totalTime: "მোცემი დრო", close: "დახურვა",
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
        modeRace: "მხოლოდ რბოლა", modeQualify: "კვალიფიკაცია + რბოლა",
        qualifyTitle: "კვალიფიკაცია", qualifyFormat: "ფორმატი", qualifyFmtSimple: "მარტივი", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "სეგმენტები", qualifyDuration: "კვალ. ხანგრძლ. (წთ)", qualifyParticipation: "მონაწილეობა",
        qualifyPartOne: "ერთი", qualifyPartMulti: "რამდენიმე", qualifyPartAll: "ყველა", qualifyPartOneDriver: "მძღოლი",
        qualifyPitRule: "პიტ-სტოპის წესი", qualifyPitNone: "წესის გარეშე", qualifyPitMustChange: "სავალდებულო ცვლა",
        qualifyRun: "გარბენი", qualifyStageResults: "შედეგები", qualifyUpNext: "შემდეგი",
        qualifyAdvance: "გადასვლა შემდეგ ეტაპზე", qualifySegmentTime: "ხანგრძლ. (წთ)",
        qualifyNextRun: "შემდეგი გარბენი", qualifyLastRun: "ბოლო გარბენი", qualifyDoneStartRace: "კვალიფ. დასრულდა! დააყენე რბოლის პარამეტრები და დაიწყე.",
        startQualify: "კვალიფიკაციის დაწყება", qualifyScreenTitle: "კვალიფიკაცია",
        countdownPrefix: "რბოლა იწყება",
        countdownGo: "რბოლის დრო! დაიწყეთ!",
        countdownAlert: "⏰ რბოლა {min} წუთში!",
        autoStarting: "ავტომატური დაწყება...",
        lblAutoStart: "ავტომატური დაწყება",
        lblDoublesHint: "ერთი და იგივე მძღოლი ზედიზედ",
        lblMaxConsecutive: "მაქს. თანამიმდევრული სტინტები მძღოლზე",
        consec2: "2", consec3: "3", consecUnlimited: "შეუზღუდავი",
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
        runDemo: "დემო",
        goodPace: "კარგი ტემპი",
        lblStartTime: "🕐 დაწყების დრო", lblStartDate: "📅 რბოლის თარიღი",
        lblSquadSchedule: "🔄 ჯგუფების ფანჯარა", lblSquadScheduleHint: "ფანჯრის გარეთ ყველა მძღოლი თანაბრად ინაწილებს. შიგნით ჯგუფები თანაბრად მონაცვლეობენ.",
        lblSquadWindowStart: "ფანჯრის დასაწყისი", lblSquadWindowEnd: "ფანჯრის დასასრული",
        squadOff: "გამორთული", squad2: "2 ჯგუფი", squad3: "3 ჯგუფი", squad4: "4 ჯგუფი",
        lblAppearance: "🎨 გარეგნობა", lblPageBg: "გვერდის ფონი", lblColorThemes: "ფერის თემები",
        laps: "წრეები", gap: "სხვაობა", totalCompetitors: "მანქანები", waitingData: "მონაცემების მოლოდინი...",
        boxThisLap: "🏁 შედი ამ წრეზე", boxNextLap: "📢 შედი მომდევნო წრეზე", stayOut: "დარჩი ტრასაზე", ltOnTrack: "ტრასაზე", ltInPit: "ბოქსში",
        driverEntryHint: "შეიყვანეთ რბოლის ID დასაკავშირებლად", driverEntryLabel: "რბოლის ID", driverConnect: "დაკავშირება მძღოლად", driverIdTooShort: "ID ძალიან მოკლეა", joinAsDriver: "შეუერთდი მძღოლად", backToSetup: "← უკან პარამეტრებზე",
        nextStintIn: "შენი შემდეგი სტინტი", stayAwake: "დარჩი ფხიზლად", sleepOk: "შეგიძლია დაიძინო", yourStints: "შენი სტინტები", noStintsFound: "სტინტები ვერ მოიძებნა", wakeUpAlert: "⏰ გაიღვიძე! შენი სტინტი ახლოვდება",
        viewerNameHint: "შეიყვანე სახელი რბოლაში შესაერთებლად", viewerNameLabel: "შენი სახელი", requestToJoin: "მოითხოვე შეერთება", waitingForApproval: "მოლოდინში ადმინის თანხმობაზე...", waitingForApprovalHint: "რბოლის ადმინისტრატორი დაამტკიცებს თქვენს მოთხოვნას", viewerNameTooShort: "სახელი უნდა შეიცავდეს მინიმუმ 2 სიმბოლოს",
        proFeature: "Pro ფუნქცია", proUpgradeTitle: "⭐ გადასვლა Pro-ზე", proUpgradeMsg: "გახსენით ლაივ ქრონომეტრაჟი, AI სტრატეგია, ჯგუფები, შეუზღუდავი მძღოლები და თემები, და სხვა!", proActivate: "ლიცენზიის გააქტიურება", proDeactivate: "გაუქმება", proEnterKey: "შეიყვანეთ ლიცენზიის გასაღები...", proInvalidKey: "არასწორი ლიცენზიის გასაღები", proActivated: "⭐ Pro გააქტიურებულია!", proBadge: "PRO", proRequired: "საჭიროებს Pro-ს", proHaveCoupon: "🎟️ გაქვთ კუპონის კოდი?", proApplyCoupon: "გამოყენება",
        onboardTitle1: "კეთილი იყოს თქვენი მობრძანება Strateger-ში!", onboardDesc1: "თქვენი პიტ-სტრატეგიის ასისტენტი გამძლეობის კარტინგის რბოლებისთვის. დააყენეთ პირველი რბოლა 3 მარტივ ნაბიჯში.",
        onboardTitle2: "დააყენეთ რბოლა", onboardDesc2: "შეიყვანეთ რბოლის ხანგრძლივობა, სავალდებულო გაჩერებები და სტინტის მინ/მაქს დროები ზემოთ. დაამატეთ მძღოლები ქვემოთ — აირჩიეთ სტარტერი და მიანიჭეთ ჯგუფები ღამის ცვლებისთვის.",
        onboardTitle3: "წინასწარი ხედვა და კორექტირება", onboardDesc3: "დააჭირეთ 'სტრატეგიის ნახვა' სრული გეგმის სანახავად. გადაათრიეთ სტინტები თანმიმდევრობის შესაცვლელად, შეცვალეთ ხანგრძლივობა ან შეინახეთ ღრუბელში.",
        onboardTitle4: "რბოლაზე!", onboardDesc4: "დააჭირეთ 'რბოლის დაწყება' და ლაივ დაფა ჩაირთვება — თვალი ადევნეთ ტაიმერებს, მიიღეთ პიტ-შეტყობინებები, გააზიარეთ ლინკი გუნდთან და მართეთ მძღოლთა ცვლა რეალურ დროში.",
        onboardSkip: "გამოტოვება", onboardNext: "შემდეგი", onboardDone: "წავედით!",
        appTitle: "STRATEGER",
        aiOptimize: "AI სტრატეგიის ოპტიმიზაცია",
        raceFinished: "რბოლა დასრულდა", totalPitTime: "პიტის დრო", raceStart: "სტარტი", pitLog: "პიტ-სტოპების ჟურნალი", drove: "მართა", pitNoun: "პიტი", driveNoun: "რბოლა", stints: "სტინტები", avgStint: "საშ.",
        demoSelectFeatures: "აირჩიეთ Pro ფუნქციები ტესტირებისთვის", demoLiveTimingDesc: "20 გუნდის სიმულაცია", demoRainLabel: "წვიმის სიმულაცია", demoRainDesc: "შემთხვევითი წვიმის მოვლენები ტემპის ცვლილებით", demoPenaltyDesc: "შემთხვევითი ჯარიმები და დროის დამატება", demoTiresLabel: "საბურავების ცვეთა", demoTiresDesc: "წრის დრო იზრდება სტინტის განმავლობაში", demoSquadsLabel: "ჯგუფები", demoSquadsDesc: "მძღოლების ჯგუფები როტაციით", demoFuelLabel: "საწვავის მართვა", demoFuelDesc: "საწვავის დონის თვალყურის დევნება",
        unitMin: "წთ", unitHour: "სთ",
        soundMute: "დადუმება", soundUnmute: "ხმის ჩართვა",
        undoPit: "გაუქმება", undoPitToast: "პიტი გაუქმებულია", undoCountdown: "გაუქმება",
        exportPdf: "PDF ექსპორტი", exportImage: "გაზიარება სურათად", exportingPdf: "PDF-ის გენერაცია...",
        heroTitle: "სარბოლო სტრატეგია", heroSub: "დაგეგმე · მართე · გაიმარჯვე",
        qpSprint: "⚡ სპრინტი", qpEndurance: "🏁 გამძლეობა", qpNoLimit: "∞ ულიმიტო", qpQualify: "⏱️ + კვალიფ.", qpDemo: "🎬 დემო", qpLibrary: "📚 ბიბლიოთეკა",
        heroCollapse: "დამალვა", heroExpand: "პარამეტრები",
        driverExitedEarly: "მძღოლი ადრე გამოვიდა", driverExitedEarlyNotice: "მძღოლი პიტიდან გამოვიდა საჭირო დროამდე — დაადასტურეთ მისაღებად.",
        rulesPdfBtn: "PDF-ით ჩამოტვირთე წესები", rulesPdfLoaded: "წესები ჩაიტვირთა",
        rulesPdfModalTitle: "სარბოლო წესები PDF", rulesPdfModalSub: "AI წაიკითხავს წესებს და შემოგთავაზებს საუკეთესო სტრატეგიას",
        rulesPdfDrop: "დააჭირე PDF-ის ასარჩევად", rulesPdfDropHint: "მაქს. ~50 გვერდი",
        rulesPdfReading: "PDF-ის წაკითხვა…", rulesPdfError: "PDF-ის წაკითხვა ვერ მოხერხდა.", rulesPdfAiError: "AI-ს შედეგი არ დაბრუნებია.",
        rulesPdfClear: "წაშლა", rulesPdfAnalyze: "ანალიზი და სტრატეგიის შემოთავაზება", pages: "გვერდი",
        saveSettings: "შენახვა", backToRace: "← რბოლაზე დაბრუნება",
        livePreviewBtn: "▶ გეგმა",
        appearance: "გარეგნობა",
        raceHistory: "რბოლის ისტორია", noRaceHistory: "ისტორია არ არის. დაასრულე რბოლა სანახავად.",
        onboardWelcome: "კეთილი იყოს Strateger-ში!", onboardDemoHint: "საუკეთესო გზაა სწრაფი დემო — 30 წამი სჭირდება და ყველაფერს გიჩვენებს.", onboardRunDemo: "დემოს გაშვება",
        qualifyPartMultiCount: "მძღოლების რაოდენობა", qualifyRuns: "სირბილი მძღოლზე",
        qualifyPitMin: "მინიმალური დრო", qualifyPitMinSec: "მინიმალური წამები პიტში",
        leaderLabel: "ლიდერი", pitLabel: "პიტი",
        lapSingular: "წრე", lapPlural: "წრე",
        topKartsTitle: "საუკეთესო კარტები", numDecSep: ".",
        raceClockLabel: "რბოლის დრო",
        teamLogoUpload: "ლოგოს ატვირთვა", teamLogoChange: "ლოგოს შეცვლა", teamLogoRemove: "წაშლა",
        teamLogoUploading: "იტვირთება…", teamLogoTooLarge: "ფაილი ძალიან დიდია (მაქს. 2 MB)",
        teamLogoInvalidType: "მხოლოდ JPG, PNG ან SVG",
        stintAvg: "სტინტის საშ.",
        norm: "NORM",
        pitLatestExitIn: "გასვლა მაქს.", pitLeaveNow: "⚠️ გადი ახლავე!", pitLatestExitPassed: "🚨 გასვლა ვადაგასული",
    },
    de: {
        ltSearchType: "Filter nach:", ltTeam: "Team", ltDriver: "Fahrer", ltKart: "Kart Nr.", ltPlaceholder: "Suchen...", previewTitle: "Strategievorschau", addToCalendar: "Zum Kalender hinzufügen", timeline: "Zeitleiste", driverSchedule: "Stint-Übersicht", totalTime: "Gesamtzeit", close: "Schließen",
        googleLogin: "Mit Google anmelden", eventCreated: "Ereignis erstellt!", eventError: "Erstellungsfehler", raceEventTitle: "Ausdauerrennen", errImpossible: "Unmögliche Strategie!", errAvgHigh: "Durchschn. > Max. Stopps hinzufügen.", errAvgLow: "Durchschn. < Min. Stopps reduzieren.",
        appSubtitle: "Strategie-Manager", generalInfo: "Allgemeine Informationen", advancedConstraints: "Erweiterte Einschränkungen", driverConfig: "Fahrer", aiTitle: "KI-Strategie", lblDuration: "Dauer (Std.)", lblStops: "Erforderliche Stops", lblMinStint: "Min. Stint", lblMaxStint: "Max. Stint", lblPitTime: "Boxenzeit", lblPitClosedStart: "🚫 Start geschlossen", lblPitClosedEnd: "🚫 Ende geschlossen",
        lblMinDrive: "Min. Gesamt (min)", lblMaxDrive: "Max. Gesamt (min)", lblBuffer: "Warnung (s)", lblDoubles: "Doppel erlauben", lblSquads: "Staffeln verwenden", lblFuel: "Kraftstoff", lblFuelTank: "Tank (min)", addDriver: "+ Hinzufügen", generateStrategy: "Generieren (KI)", previewStrategy: "Vorschau", startRace: "Starten", loadSaved: "Laden",
        raceTime: "RENNZEIT", stops: "STOPS", live: "LIVE", stop: "Stop", pos: "POS", last: "LETZTE", best: "BESTE", targetStint: "ZIEL-STINT", buildTime: "AUFBAUZEIT", current: "AKTUELL", stintTime: "STINT-ZEIT", nextDriver: "Nächster", penalty: "Strafe", enterPit: "BOXEN FAHREN", push: "PUSH", problem: "PROBLEM",
        resetMode: "Zurücksetzen", nightMode: "NACHTMODUS", dry: "Trocken", wet: "Regen", drying: "Trocknet", boxNow: "JETZT BOXEN!", stayOnTrackUntilFurther: "Bleiben Sie auf der Strecke bis auf Weiteres", pushMode: "PUSH-MODUS", squadSleeping: "STAFFEL SCHLÄFT", squadWakeUp: "STAFFEL WECKEN", finalLap: "Letzte Runde", calculating: "Berechnung...", manualInput: "Manuell",
        saveStratTitle: "Speichern", libTitle: "Bibliothek", aiPlaceholder: "z.B.: 'Fahrer 1 bevorzugt...'", thStart: "Start", thEnd: "Ende", thType: "Typ", thDriver: "Fahrer", thDuration: "Dauer", liveTiming: "Live-Zeitmessung", liveTimingUrl: "Zeitmessung URL...", connectLive: "Verbinden", disconnectLive: "Trennen", searchTeam: "Team suchen...", searchDriver: "Fahrer suchen...", searchKart: "Kart suchen...", demoMode: "Demo-Modus",
        sendEmail: "Senden", cancel: "Abbrechen", create: "Erstellen", save: "Speichern", load: "Laden", delete: "Löschen", activeRaceFound: "Aktives Rennen gefunden", continueRace: "Fortfahren", discardRace: "Verwerfen", areYouSure: "Bist du sicher?", deleteWarning: "Dies löscht Daten dauerhaft.", yesDelete: "Ja, löschen", noKeep: "Nein, behalten", invite: "Einladen", synced: "Synchronisiert",
        chatTitle: "Renn-Chat / Q&A", enterName: "Geben Sie Ihren Namen ein", startChat: "Chat starten", typeMessage: "Schreibe einen Vorschlag...", send: "Senden", viewer: "Zuschauer", host: "HOST", suggestion: "Vorschlag", strategyOutlook: "STRATEGIEAUSBLICK", timeLeft: "VERBLEIBENDE ZEIT", nextDriverLabel: "NÄCHSTER FAHRER", totalHeader: "GESAMT", stopsHeader: "STINTS", driverHeader: "FAHRER",
        stintsLeft: "STINTS VERBLEIBEND", future: "ZUKUNFT", max: "MAX", min: "MIN", rest: "RUHE", buffer: "Puffer", impossible: "UNMÖGLICH", addStop: "STOP HINZUFÜGEN", avg: "DURCHSCHN.", finalLap: "LETZTE RUNDE", inPit: "IN DEN BOXEN", nextLabel: "Nächster", shortStintMsg: "⚠️ KURZER STINT! Strafrisiko", cancelEntry: "Abbrechen", notifyDriver: "📢 Fahrer benachrichtigen", driverNotified: "✓ Fahrer benachrichtigt", includesAdj: "Enthält Anpassung:", missingSeconds: "Fehlend", proceedToPit: "Zu den Boxen fahren?", wait: "WARTEN...", getReady: "VORBEREITEN...", go: "LOS! LOS! LOS!", goOutIn: "RAUS IN", orangeZone: "⚠️ Orangezone - nur BENACHRICHTIGEN", targetLabel: "ZIEL", driverLink: "Fahrer-Link", tapToPit: "TIPPEN ZUM BOXEN", tapToExit: "TIPPEN ZUM AUSFAHREN", pitsConfirm: "BOXEN?", tapAgainConfirm: "ERNEUT TIPPEN ZUM BESTÄTIGEN", stintBest: "S.BEST",
        googleLoginBtn: "Anmelden",
        testBtn: "Test",
        demoBtn: "Demo",
        demoRace: "Demo",
        modeRace: "Nur Rennen", modeQualify: "Qualifying + Rennen",
        qualifyTitle: "Qualifying", qualifyFormat: "Format", qualifyFmtSimple: "Einfach", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "Segmente", qualifyDuration: "Qualifying-Dauer (Min)", qualifyParticipation: "Fahrerbeteiligung",
        qualifyPartOne: "Einer", qualifyPartMulti: "Mehrere", qualifyPartAll: "Alle", qualifyPartOneDriver: "Fahrer",
        qualifyPitRule: "Box-Regel", qualifyPitNone: "Keine Regel", qualifyPitMustChange: "Pflicht-Wechsel",
        qualifyRun: "Runde", qualifyStageResults: "Ergebnisse", qualifyUpNext: "Nächster",
        qualifyAdvance: "Zur nächsten Stufe", qualifySegmentTime: "Dauer (Min)",
        qualifyNextRun: "Nächste Runde", qualifyLastRun: "Letzte Runde", qualifyDoneStartRace: "Qualifying fertig! Renneinstellungen konfigurieren und starten.",
        startQualify: "Qualifying starten", qualifyScreenTitle: "Qualifying",
        countdownPrefix: "Rennen in",
        countdownGo: "RENNZEIT! Jetzt starten!",
        countdownAlert: "⏰ Rennen in {min} Minuten!",
        autoStarting: "Automatischer Start...",
        lblAutoStart: "Autostart zur Rennzeit",
        lblDoublesHint: "Derselbe Fahrer hintereinander",
        lblMaxConsecutive: "Max. aufeinanderfolgende Stints pro Fahrer",
        consec2: "2", consec3: "3", consecUnlimited: "Unbegrenzt",
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
        runDemo: "Demo",
        goodPace: "Gutes Tempo",
        lblStartTime: "🕐 Startzeit", lblStartDate: "📅 Renndatum",
        lblSquadSchedule: "🔄 Staffelfenster", lblSquadScheduleHint: "Außerhalb des Fensters teilen alle Fahrer gleich. Innerhalb rotieren Staffeln gleichmäßig.",
        lblSquadWindowStart: "Fenster Beginn", lblSquadWindowEnd: "Fenster Ende",
        squadOff: "Aus", squad2: "2 Staffeln", squad3: "3 Staffeln", squad4: "4 Staffeln",
        lblAppearance: "🎨 Darstellung", lblPageBg: "Seitenhintergrund", lblColorThemes: "Farbthemen",
        laps: "RUNDEN", gap: "ABSTAND", totalCompetitors: "AUTOS", waitingData: "Warte auf Daten...",
        boxThisLap: "🏁 BOX DIESE RUNDE", boxNextLap: "📢 BOX NÄCHSTE RUNDE", stayOut: "DRAUSSEN BLEIBEN", ltOnTrack: "AUF DER STRECKE", ltInPit: "IN DER BOX",
        driverEntryHint: "Rennen-ID eingeben zum Verbinden", driverEntryLabel: "Rennen-ID", driverConnect: "Als Fahrer verbinden", driverIdTooShort: "ID ist zu kurz", joinAsDriver: "Als Fahrer beitreten", backToSetup: "← Zurück zur Einrichtung",
        nextStintIn: "Dein nächster Stint in", stayAwake: "Bleib wach", sleepOk: "Du kannst schlafen", yourStints: "Deine Stints", noStintsFound: "Keine Stints für dich gefunden", wakeUpAlert: "⏰ Aufwachen! Dein Stint kommt",
        viewerNameHint: "Gib deinen Namen ein, um dem Rennen beizutreten", viewerNameLabel: "Dein Name", requestToJoin: "Beitritt anfragen", waitingForApproval: "Warte auf Genehmigung...", waitingForApprovalHint: "Der Rennadministrator wird deine Anfrage genehmigen", viewerNameTooShort: "Name muss mindestens 2 Zeichen haben",
        proFeature: "Pro-Funktion", proUpgradeTitle: "⭐ Auf Pro upgraden", proUpgradeMsg: "Schalte Live-Zeitmessung, KI-Strategie, Staffeln, unbegrenzte Fahrer & Themes und mehr frei!", proActivate: "Lizenz aktivieren", proDeactivate: "Deaktivieren", proEnterKey: "Lizenzschlüssel eingeben...", proInvalidKey: "Ungültiger Lizenzschlüssel", proActivated: "⭐ Pro Aktiviert!", proBadge: "PRO", proRequired: "erfordert Pro", proHaveCoupon: "🎟️ Haben Sie einen Gutscheincode?", proApplyCoupon: "Anwenden",
        onboardTitle1: "Willkommen bei Strateger!", onboardDesc1: "Dein Boxenstrategie-Assistent für Langstrecken-Kartrennen. Richte dein erstes Rennen in 3 einfachen Schritten ein.",
        onboardTitle2: "Rennen einrichten", onboardDesc2: "Gib Renndauer, Pflichtstopps und Stint-Zeiten (min/max) oben ein. Füge deine Fahrer unten hinzu — wähle den Startfahrer und weise Staffeln für Nachtschichten zu.",
        onboardTitle3: "Vorschau & Feintuning", onboardDesc3: "Tippe auf 'Strategie-Vorschau' für den kompletten Stint-Plan. Ziehe Stints zum Umordnen, passe Dauern an oder speichere deinen Plan in der Cloud.",
        onboardTitle4: "Los geht's!", onboardDesc4: "Drücke 'Rennen starten' und das Live-Dashboard übernimmt — verfolge Timer, erhalte Box-Warnungen, teile einen Live-Link mit deinem Team und manage Fahrerwechsel in Echtzeit.",
        onboardSkip: "Überspringen", onboardNext: "Weiter", onboardDone: "Auf geht's!",
        appTitle: "STRATEGER",
        aiOptimize: "KI-Strategie optimieren",
        raceFinished: "RENNEN BEENDET", totalPitTime: "Boxenzeit", raceStart: "Start", pitLog: "Boxenstopp-Protokoll", drove: "Gefahren", pitNoun: "Box", driveNoun: "Fahrt", stints: "Stints", avgStint: "Ø",
        demoSelectFeatures: "Pro-Funktionen zum Testen auswählen", demoLiveTimingDesc: "Simulierte 20-Team-Rangliste", demoRainLabel: "Regensimulation", demoRainDesc: "Zufällige Regenereignisse mit Tempowechsel", demoPenaltyDesc: "Zufällige Strafen und Zeitzuschläge", demoTiresLabel: "Reifenverschleiß", demoTiresDesc: "Rundenzeiten steigen im Laufe des Stints", demoSquadsLabel: "Staffeln", demoSquadsDesc: "Fahrergruppen mit Rotation", demoFuelLabel: "Kraftstoffmanagement", demoFuelDesc: "Kraftstoffstand verfolgen und tanken",
        unitMin: "Min", unitHour: "Std",
        soundMute: "Stummschalten", soundUnmute: "Ton einschalten",
        undoPit: "Pit rückgängig", undoPitToast: "Pit-Einfahrt rückgängig", undoCountdown: "Rückgängig",
        exportPdf: "PDF exportieren", exportImage: "Als Bild teilen", exportingPdf: "PDF wird erstellt...",
        heroTitle: "Rennstrategie", heroSub: "Planen · Verwalten · Gewinnen",
        qpSprint: "⚡ Sprint", qpEndurance: "🏁 Ausdauer", qpNoLimit: "∞ Kein Limit", qpQualify: "⏱️ + Quali", qpDemo: "🎬 Demo", qpLibrary: "📚 Bibliothek",
        heroCollapse: "Ausblenden", heroExpand: "Setup",
        exitPits: "Exit Pits",
        rulesPdfBtn: "Reglement hochladen (PDF)", rulesPdfLoaded: "Reglement geladen",
        rulesPdfModalTitle: "Rennreglement PDF", rulesPdfModalSub: "Die KI liest die Regeln und schlägt die beste Strategie in deiner Sprache vor",
        rulesPdfDrop: "Klicke zum PDF auswählen", rulesPdfDropHint: "Max. ~50 Seiten empfohlen",
        rulesPdfReading: "PDF wird gelesen…", rulesPdfError: "PDF konnte nicht gelesen werden.", rulesPdfAiError: "KI hat kein Ergebnis zurückgegeben.",
        rulesPdfClear: "Entfernen", rulesPdfAnalyze: "Analysieren und Strategie vorschlagen", pages: "Seiten",
        saveSettings: "Speichern", backToRace: "← Zurück zum Rennen",
        livePreviewBtn: "▶ PLAN",
        appearance: "Darstellung",
        raceHistory: "Rennverlauf", noRaceHistory: "Kein Verlauf. Beende ein Rennen, um es hier zu sehen.",
        onboardWelcome: "Willkommen bei Strateger!", onboardDemoHint: "Am besten startest du mit einer kurzen Demo — dauert 30 Sekunden und zeigt alles in Aktion.", onboardRunDemo: "Demo starten",
        qualifyPartMultiCount: "Anzahl Fahrer", qualifyRuns: "Runden pro Fahrer",
        qualifyPitMin: "Mindestzeit", qualifyPitMinSec: "Mindestsekunden in der Box",
        leaderLabel: "FÜHREND", pitLabel: "BOX",
        lapSingular: "Runde", lapPlural: "Runden",
        topKartsTitle: "TOP KARTS", numDecSep: ",",
        raceClockLabel: "RENNZEIT",
        teamLogoUpload: "Logo hochladen", teamLogoChange: "Logo ändern", teamLogoRemove: "Entfernen",
        teamLogoUploading: "Wird hochgeladen…", teamLogoTooLarge: "Datei zu groß (max. 2 MB)",
        teamLogoInvalidType: "Nur JPG, PNG oder SVG",
        stintAvg: "Stint Ø",
        norm: "NORM",
        pitLatestExitIn: "Spätestausfahrt in", pitLeaveNow: "⚠️ Jetzt ausfahren!", pitLatestExitPassed: "🚨 AUSFAHRT ÜBERFÄLLIG",
    },
    ja: {
        ltSearchType: "フィルタリング:", ltTeam: "チーム", ltDriver: "ドライバー", ltKart: "カート番号", ltPlaceholder: "検索...", previewTitle: "戦略プレビュー", addToCalendar: "カレンダーに追加", timeline: "タイムライン", driverSchedule: "スティント概要", totalTime: "総時間", close: "閉じる",
        googleLogin: "Googleでログイン", eventCreated: "イベントが作成されました!", eventError: "作成エラー", raceEventTitle: "耐久レース", errImpossible: "不可能な戦略!", errAvgHigh: "平均 > 最大。ピットストップを追加してください。", errAvgLow: "平均 < 最小。ピットストップを減らしてください。",
        appSubtitle: "戦略マネージャー", generalInfo: "一般情報", advancedConstraints: "高度な制約", driverConfig: "ドライバー", aiTitle: "AI戦略", lblDuration: "期間 (時間)", lblStops: "必要なピットストップ", lblMinStint: "最小スティント", lblMaxStint: "最大スティント", lblPitTime: "ピットタイム", lblPitClosedStart: "🚫 開始時に閉鎖", lblPitClosedEnd: "🚫 終了時に閉鎖",
        lblMinDrive: "最小合計 (分)", lblMaxDrive: "最大合計 (分)", lblBuffer: "警告 (秒)", lblDoubles: "ダブルを許可", lblSquads: "スクワッドを使用", lblFuel: "燃料", lblFuelTank: "燃料タンク (分)", addDriver: "+ 追加", generateStrategy: "生成 (AI)", previewStrategy: "プレビュー", startRace: "スタート", loadSaved: "読み込み",
        raceTime: "レース時間", stops: "ピット", live: "ライブ", stop: "停止", pos: "POS", last: "ラスト", best: "ベスト", targetStint: "ターゲットスティント", buildTime: "タイム構築", current: "現在", stintTime: "スティントタイム", nextDriver: "次のドライバー", penalty: "ペナルティ", enterPit: "ピット進入", push: "プッシュ", problem: "問題",
        resetMode: "リセット", nightMode: "ナイトモード", dry: "ドライ", wet: "ウェット", drying: "乾燥中", boxNow: "今ピット!", stayOnTrackUntilFurther: "さらに指示があるまでトラックに留まってください", pushMode: "プッシュモード", squadSleeping: "スクワッド休止中", squadWakeUp: "スクワッド起動", finalLap: "ファイナルラップ", calculating: "計算中...", manualInput: "手動入力",
        saveStratTitle: "保存", libTitle: "ライブラリ", aiPlaceholder: "例: 'ドライバー1は...を好む'", thStart: "開始", thEnd: "終了", thType: "タイプ", thDriver: "ドライバー", thDuration: "期間", liveTiming: "ライブタイミング", liveTimingUrl: "ライブタイミングURL...", connectLive: "接続", disconnectLive: "切断", searchTeam: "チームを検索...", searchDriver: "ドライバーを検索...", searchKart: "カートを検索...", demoMode: "デモモード",
        sendEmail: "送信", cancel: "キャンセル", create: "作成", save: "保存", load: "読み込み", delete: "削除", activeRaceFound: "アクティブなレースが見つかりました", continueRace: "続行", discardRace: "破棄", areYouSure: "本当にしますか?", deleteWarning: "これはデータを永久に削除します。", yesDelete: "はい、削除", noKeep: "いいえ、保持", invite: "招待", synced: "同期済み",
        chatTitle: "レースチャット / Q&A", enterName: "名前を入力", startChat: "チャットを開始", typeMessage: "提案を入力...", send: "送信", viewer: "視聴者", host: "ホスト", suggestion: "提案", strategyOutlook: "戦略見通し", timeLeft: "残り時間", nextDriverLabel: "次のドライバー", totalHeader: "合計", stopsHeader: "スティント", driverHeader: "ドライバー",
        stintsLeft: "残りスティント", future: "将来", max: "最大", min: "最小", rest: "休息", buffer: "バッファ", impossible: "不可能", addStop: "ピットストップ追加", avg: "平均", finalLap: "ファイナルラップ", inPit: "ピット内", nextLabel: "次", shortStintMsg: "⚠️ 短いスティント!ペナルティリスク", cancelEntry: "キャンセル", notifyDriver: "📢 ドライバーに通知", driverNotified: "✓ ドライバーに通知済み", includesAdj: "調整を含む:", missingSeconds: "不足", proceedToPit: "ピットに進む?", wait: "待機中...", getReady: "準備中...", go: "行け! 行け!", goOutIn: "あと", orangeZone: "⚠️ オレンジゾーン - 通知のみ", targetLabel: "ターゲット", driverLink: "ドライバーリンク", tapToPit: "タップしてピットイン", tapToExit: "タップしてピットアウト", pitsConfirm: "ピット?", tapAgainConfirm: "もう一度タップして確認", stintBest: "S.ベスト",
        googleLoginBtn: "ログイン",
        testBtn: "テスト",
        demoBtn: "デモ",
        demoRace: "デモ",
        modeRace: "レースのみ", modeQualify: "予選 + レース",
        qualifyTitle: "予選", qualifyFormat: "フォーマット", qualifyFmtSimple: "シンプル", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "セグメント", qualifyDuration: "予選時間 (分)", qualifyParticipation: "ドライバー参加",
        qualifyPartOne: "一人", qualifyPartMulti: "複数", qualifyPartAll: "全員", qualifyPartOneDriver: "ドライバー",
        qualifyPitRule: "ピットルール", qualifyPitNone: "ルールなし", qualifyPitMustChange: "交代必須",
        qualifyRun: "ラン", qualifyStageResults: "結果", qualifyUpNext: "次",
        qualifyAdvance: "次のステージへ", qualifySegmentTime: "時間 (分)",
        qualifyNextRun: "次のラン", qualifyLastRun: "最終ラン", qualifyDoneStartRace: "予選終了！レース設定をして開始してください。",
        startQualify: "予選開始", qualifyScreenTitle: "予選",
        countdownPrefix: "レースまで",
        countdownGo: "レース時間！今すぐスタート！",
        countdownAlert: "⏰ レースまで{min}分！",
        autoStarting: "自動スタート中...",
        lblAutoStart: "レース時間に自動スタート",
        lblDoublesHint: "同じドライバーが連続",
        lblMaxConsecutive: "ドライバーごとの最大連続スティント",
        consec2: "2", consec3: "3", consecUnlimited: "無制限",
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
        runDemo: "デモ",
        goodPace: "良いペース",
        lblStartTime: "🕐 レース開始時刻", lblStartDate: "📅 レース日",
        lblSquadSchedule: "🔄 スクワッドウィンドウ", lblSquadScheduleHint: "ウィンドウ外は全ドライバーが均等に分担。ウィンドウ内はスクワッドが均等にローテーション。",
        lblSquadWindowStart: "開始時刻", lblSquadWindowEnd: "終了時刻",
        squadOff: "オフ", squad2: "2スクワッド", squad3: "3スクワッド", squad4: "4スクワッド",
        lblAppearance: "🎨 外観", lblPageBg: "ページ背景", lblColorThemes: "カラーテーマ",
        laps: "周回", gap: "差", totalCompetitors: "台数", waitingData: "データ待機中...",
        boxThisLap: "🏁 今周ピットイン", boxNextLap: "📢 次周ピットイン", stayOut: "ステイアウト", ltOnTrack: "走行中", ltInPit: "ピット内",
        driverEntryHint: "レースIDを入力して接続", driverEntryLabel: "レースID", driverConnect: "ドライバーとして接続", driverIdTooShort: "IDが短すぎます", joinAsDriver: "ドライバーとして参加", backToSetup: "← セットアップに戻る",
        nextStintIn: "次のスティントまで", stayAwake: "起きていて", sleepOk: "寝ても大丈夫", yourStints: "あなたのスティント", noStintsFound: "スティントが見つかりません", wakeUpAlert: "⏰ 起きて！スティントが近づいています",
        viewerNameHint: "レースに参加するために名前を入力してください", viewerNameLabel: "あなたの名前", requestToJoin: "参加をリクエスト", waitingForApproval: "承認を待っています...", waitingForApprovalHint: "レース管理者があなたのリクエストを承認します", viewerNameTooShort: "名前は2文字以上必要です",
        onboardTitle1: "Strategerへようこそ！", onboardDesc1: "耐久カートレース用のピット戦略アシスタントです。3つの簡単なステップで最初のレースをセットアップしましょう。",
        onboardTitle2: "レースを設定", onboardDesc2: "上部でレース時間、必須ピットストップ数、スティントの最小/最大時間を入力。下にドライバーを追加 — スターターを選び、夜間シフト用にスクワッドを割り当てます。",
        proFeature: "Pro機能", proUpgradeTitle: "⭐ Proにアップグレード", proUpgradeMsg: "ライブタイミング、AI戦略、スクワッド、無制限のドライバーとテーマなどをアンロック！", proActivate: "ライセンスを有効化", proDeactivate: "無効化", proEnterKey: "ライセンスキーを入力...", proInvalidKey: "無効なライセンスキー", proActivated: "⭐ Pro有効化！", proBadge: "PRO", proRequired: "Proが必要", proHaveCoupon: "🎟️ クーポンコードをお持ちですか？", proApplyCoupon: "適用",
        onboardTitle3: "プレビューと調整", onboardDesc3: "「戦略プレビュー」をタップして完全なスティント計画を確認。ドラッグで並べ替え、時間を調整、またはクラウドに保存できます。",
        onboardTitle4: "レーススタート！", onboardDesc4: "「レース開始」を押すとライブダッシュボードが起動 — タイマーを追跡、ピットアラートを受信、チームとライブリンクを共有、ドライバー交代をリアルタイムで管理。",
        onboardSkip: "スキップ", onboardNext: "次へ", onboardDone: "始めよう！",
        appTitle: "STRATEGER",
        aiOptimize: "AI戦略最適化",
        raceFinished: "レース終了", totalPitTime: "ピット時間", raceStart: "スタート", pitLog: "ピットストップ記録", drove: "走行", pitNoun: "ピット", driveNoun: "走行", stints: "スティント", avgStint: "平均",
        demoSelectFeatures: "テストするPro機能を選択", demoLiveTimingDesc: "20チームのシミュレーション", demoRainLabel: "雨のシミュレーション", demoRainDesc: "ランダムな降雨イベントとペース変化", demoPenaltyDesc: "ランダムなペナルティと加算時間", demoTiresLabel: "タイヤ劣化", demoTiresDesc: "スティント中にラップタイムが増加", demoSquadsLabel: "スクワッド", demoSquadsDesc: "ドライバーグループのローテーション", demoFuelLabel: "燃料管理", demoFuelDesc: "燃料レベルの追跡と給油",
        unitMin: "分", unitHour: "時",
        soundMute: "ミュート", soundUnmute: "ミュート解除",
        undoPit: "ピット取消", undoPitToast: "ピット入場取消", undoCountdown: "取消",
        exportPdf: "PDFエクスポート", exportImage: "画像で共有", exportingPdf: "PDF生成中...",
        heroTitle: "レース戦略", heroSub: "計画 · 管理 · 勝利",
        qpSprint: "⚡ スプリント", qpEndurance: "🏁 耐久", qpNoLimit: "∞ 無制限", qpQualify: "⏱️ + 予選", qpDemo: "🎬 デモ", qpLibrary: "📚 ライブラリ",
        heroCollapse: "隠す", heroExpand: "設定",
        exitPits: "Exit Pits",
        rulesPdfBtn: "ルールブックをアップロード (PDF)", rulesPdfLoaded: "ルールブックが読み込まれました",
        rulesPdfModalTitle: "レース規則 PDF", rulesPdfModalSub: "AIがルールを読み取り、あなたの言語で最適な戦略を提案します",
        rulesPdfDrop: "クリックしてPDFを選択", rulesPdfDropHint: "最大〜50ページ推奨",
        rulesPdfReading: "PDFを読み込み中…", rulesPdfError: "PDFを読み込めませんでした。", rulesPdfAiError: "AIが結果を返しませんでした。",
        rulesPdfClear: "削除", rulesPdfAnalyze: "分析して戦略を提案", pages: "ページ",
        saveSettings: "保存", backToRace: "← レースに戻る",
        livePreviewBtn: "▶ プラン",
        appearance: "外観",
        raceHistory: "レース履歴", noRaceHistory: "履歴なし。レースを完了するとここに表示されます。",
        onboardWelcome: "Strategerへようこそ！", onboardDemoHint: "まずデモを試してみましょう — 30秒でアクションを確認できます。", onboardRunDemo: "デモを開始",
        qualifyPartMultiCount: "ドライバー数", qualifyRuns: "ドライバーあたりの周回数",
        qualifyPitMin: "最小時間", qualifyPitMinSec: "ピット内の最小秒数",
        leaderLabel: "リーダー", pitLabel: "ピット",
        lapSingular: "周", lapPlural: "周",
        topKartsTitle: "トップカート", numDecSep: ".",
        raceClockLabel: "レース時間",
        teamLogoUpload: "ロゴをアップロード", teamLogoChange: "ロゴを変更", teamLogoRemove: "削除",
        teamLogoUploading: "アップロード中…", teamLogoTooLarge: "ファイルが大きすぎます（最大 2 MB）",
        teamLogoInvalidType: "JPG、PNG、または SVG のみ",
        stintAvg: "スティント平均",
        norm: "NORM",
        pitLatestExitIn: "最遅出発まで", pitLeaveNow: "⚠️ 今すぐ出発!", pitLatestExitPassed: "🚨 出発超過",
    },
    el: {
        ltSearchType: "Φιλτράρισμα:", ltTeam: "Ομάδα", ltDriver: "Οδηγός", ltKart: "Καρτ αρ.", ltPlaceholder: "Αναζήτηση...",
        previewTitle: "Προεπισκόπηση Στρατηγικής", addToCalendar: "Προσθήκη στο ημερολόγιο", timeline: "Χρονοδιάγραμμα", driverSchedule: "Σύνοψη Γύρων", totalTime: "Συνολικός Χρόνος", close: "Κλείσιμο",
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
        modeRace: "Μόνο αγώνας", modeQualify: "Κατατακτήρια + Αγώνας",
        qualifyTitle: "Κατατακτήρια", qualifyFormat: "Μορφή", qualifyFmtSimple: "Απλή", qualifyFmtSegments: "Q1/Q2/Q3",
        qualifySegments: "Τμήματα", qualifyDuration: "Διάρκεια κατατακτ. (λεπτ)", qualifyParticipation: "Συμμετοχή",
        qualifyPartOne: "Ένας", qualifyPartMulti: "Πολλοί", qualifyPartAll: "Όλοι", qualifyPartOneDriver: "Οδηγός",
        qualifyPitRule: "Κανόνας πιτ", qualifyPitNone: "Χωρίς κανόνα", qualifyPitMustChange: "Υποχρεωτική αλλαγή",
        qualifyRun: "Γύρος", qualifyStageResults: "Αποτελέσματα", qualifyUpNext: "Επόμενος",
        qualifyAdvance: "Προχώρα στο επόμενο στάδιο", qualifySegmentTime: "Διάρκεια (λεπτ)",
        qualifyNextRun: "Επόμενος γύρος", qualifyLastRun: "Τελευταίος γύρος", qualifyDoneStartRace: "Κατατακτήρια τέλος! Ρύθμισε τον αγώνα και ξεκίνα.",
        startQualify: "Έναρξη κατατακτήριων", qualifyScreenTitle: "Κατατακτήρια",
        countdownPrefix: "Αγώνας σε",
        countdownGo: "ΩΡΑ ΑΓΩΝΑ! Ξεκινήστε τώρα!",
        countdownAlert: "⏰ Αγώνας σε {min} λεπτά!",
        autoStarting: "Αυτόματη εκκίνηση...",
        lblAutoStart: "Αυτόματη εκκίνηση στην ώρα",
        lblDoublesHint: "Ίδιος οδηγός διαδοχικά",
        lblMaxConsecutive: "Μέγ. διαδοχικά stint ανά οδηγό",
        consec2: "2", consec3: "3", consecUnlimited: "Απεριόριστο",
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
        runDemo: "Ντέμο",
        goodPace: "Καλός Ρυθμός",
        lblStartTime: "🕐 Ώρα Εκκίνησης", lblStartDate: "📅 Ημερομηνία Αγώνα",
        lblSquadSchedule: "🔄 Παράθυρο Ομάδων", lblSquadScheduleHint: "Εκτός παραθύρου, όλοι οι οδηγοί μοιράζονται ισομερώς. Εντός, οι ομάδες εναλλάσσονται.",
        lblSquadWindowStart: "Αρχή παραθύρου", lblSquadWindowEnd: "Τέλος παραθύρου",
        squadOff: "Ανενεργό", squad2: "2 Ομάδες", squad3: "3 Ομάδες", squad4: "4 Ομάδες",
        lblAppearance: "🎨 Εμφάνιση", lblPageBg: "Φόντο σελίδας", lblColorThemes: "Θέματα χρωμάτων",
        laps: "ΓΥΡΟΙ", gap: "ΔΙΑΦΟΡΑ", totalCompetitors: "ΑΥΤΟΚΙΝΗΤΑ", waitingData: "Αναμονή δεδομένων...",
        boxThisLap: "🏁 PIT ΑΥΤΟ ΤΟΝ ΓΥΡΟ", boxNextLap: "📢 PIT ΕΠΟΜΕΝΟ ΓΥΡΟ", stayOut: "ΜΕΙΝΕ ΕΞΩ", ltOnTrack: "ΣΤΗΝ ΠΙΣΤΑ", ltInPit: "ΣΤΟ PIT",
        driverEntryHint: "Εισάγετε το ID αγώνα για σύνδεση", driverEntryLabel: "ID Αγώνα", driverConnect: "Σύνδεση ως οδηγός", driverIdTooShort: "Το ID είναι πολύ μικρό", joinAsDriver: "Είσοδος ως οδηγός", backToSetup: "← Πίσω στις ρυθμίσεις",
        nextStintIn: "Το επόμενο stint σας σε", stayAwake: "Μείνε ξύπνιος", sleepOk: "Μπορείς να κοιμηθείς", yourStints: "Τα Stint σας", noStintsFound: "Δεν βρέθηκαν stint για εσάς", wakeUpAlert: "⏰ Ξύπνα! Το stint σου πλησιάζει",
        viewerNameHint: "Εισάγετε το όνομά σας για να συμμετάσχετε στον αγώνα", viewerNameLabel: "Το Όνομά σας", requestToJoin: "Αίτημα Συμμετοχής", waitingForApproval: "Αναμονή έγκρισης...", waitingForApprovalHint: "Ο διαχειριστής του αγώνα θα εγκρίνει το αίτημά σας", viewerNameTooShort: "Το όνομα πρέπει να έχει τουλάχιστον 2 χαρακτήρες",
        proFeature: "Λειτουργία Pro", proUpgradeTitle: "⭐ Αναβάθμιση σε Pro", proUpgradeMsg: "Ξεκλειδώστε Live Χρονομέτρηση, AI Στρατηγική, Ομάδες, απεριόριστους οδηγούς & θέματα, και πολλά άλλα!", proActivate: "Ενεργοποίηση άδειας", proDeactivate: "Απενεργοποίηση", proEnterKey: "Εισάγετε κλειδί άδειας...", proInvalidKey: "Μη έγκυρο κλειδί άδειας", proActivated: "⭐ Pro Ενεργοποιήθηκε!", proBadge: "PRO", proRequired: "απαιτεί Pro", proHaveCoupon: "🎟️ Έχετε κωδικό κουπονιού;", proApplyCoupon: "Εφαρμογή",
        onboardTitle1: "Καλωσήρθατε στο Strateger!", onboardDesc1: "Ο βοηθός στρατηγικής pit για αγώνες αντοχής καρτ. Ρυθμίστε τον πρώτο σας αγώνα σε 3 εύκολα βήματα.",
        onboardTitle2: "Ρυθμίστε τον αγώνα", onboardDesc2: "Εισάγετε διάρκεια, υποχρεωτικές στάσεις και ελάχ./μέγ. χρόνους stint στο πάνω μέρος. Προσθέστε τους οδηγούς σας κάτω — επιλέξτε ποιος ξεκινά και αναθέστε ομάδες για τις νυχτερινές βάρδιες.",
        onboardTitle3: "Προεπισκόπηση & ρυθμίσεις", onboardDesc3: "Πατήστε 'Προεπισκόπηση' για να δείτε το πλήρες πλάνο stint. Σύρετε για αναδιάταξη, ρυθμίστε τις διάρκειες ή αποθηκεύστε το πλάνο στο cloud.",
        onboardTitle4: "Ξεκινάμε!", onboardDesc4: "Πατήστε 'Εκκίνηση' και το live dashboard αναλαμβάνει — παρακολουθήστε χρονόμετρα, λάβετε ειδοποιήσεις pit, μοιραστείτε σύνδεσμο με την ομάδα σας και διαχειριστείτε αλλαγές οδηγών σε πραγματικό χρόνο.",
        onboardSkip: "Παράλειψη", onboardNext: "Επόμενο", onboardDone: "Πάμε!",
        appTitle: "STRATEGER",
        aiOptimize: "Βελτιστοποίηση AI Στρατηγικής",
        raceFinished: "ΑΓΩΝΑΣ ΟΛΟΚΛΗΡΩΘΗΚΕ", totalPitTime: "Χρόνος Pit", raceStart: "Εκκίνηση", pitLog: "Αρχείο Pit Stop", drove: "Οδήγησε", pitNoun: "Pit", driveNoun: "Οδήγηση", stints: "Stints", avgStint: "Μέσος",
        demoSelectFeatures: "Επιλέξτε λειτουργίες Pro για δοκιμή", demoLiveTimingDesc: "Προσομοίωση 20 ομάδων", demoRainLabel: "Προσομοίωση βροχής", demoRainDesc: "Τυχαία γεγονότα βροχής με αλλαγή ρυθμού", demoPenaltyDesc: "Τυχαίες ποινές και προσθήκες χρόνου", demoTiresLabel: "Φθορά ελαστικών", demoTiresDesc: "Οι χρόνοι γύρου αυξάνονται κατά τη διάρκεια του stint", demoSquadsLabel: "Ομάδες", demoSquadsDesc: "Ομάδες οδηγών με εναλλαγή", demoFuelLabel: "Διαχείριση καυσίμου", demoFuelDesc: "Παρακολούθηση καυσίμου και ανεφοδιασμός",
        unitMin: "λ", unitHour: "ω",
        soundMute: "Σίγαση", soundUnmute: "Ενεργοποίηση ήχου",
        undoPit: "Αναίρεση Pit", undoPitToast: "Είσοδος pit αναιρέθηκε", undoCountdown: "Αναίρεση",
        exportPdf: "Εξαγωγή PDF", exportImage: "Κοινοποίηση Εικόνας", exportingPdf: "Δημιουργία PDF...",
        heroTitle: "Στρατηγική Αγώνα", heroSub: "Σχεδίασε · Διαχειρίσου · Νίκησε",
        qpSprint: "⚡ Σπριντ", qpEndurance: "🏁 Αντοχή", qpNoLimit: "∞ Χωρίς Όριο", qpQualify: "⏱️ + Κατάταξη", qpDemo: "🎬 Δείγμα", qpLibrary: "📚 Βιβλιοθήκη",
        heroCollapse: "Απόκρυψη", heroExpand: "Ρυθμίσεις",
        rulesPdfBtn: "Ανέβασμα κανονισμού (PDF)", rulesPdfLoaded: "Κανονισμός φορτώθηκε",
        rulesPdfModalTitle: "Κανονισμός Αγώνα PDF", rulesPdfModalSub: "Η AI διαβάζει τους κανόνες και προτείνει την καλύτερη στρατηγική στη γλώσσα σας",
        rulesPdfDrop: "Κάντε κλικ για επιλογή PDF", rulesPdfDropHint: "Συνιστάται μέγιστο ~50 σελίδες",
        rulesPdfReading: "Ανάγνωση PDF…", rulesPdfError: "Δεν ήταν δυνατή η ανάγνωση του PDF.", rulesPdfAiError: "Η AI δεν επέστρεψε αποτέλεσμα.",
        rulesPdfClear: "Αφαίρεση", rulesPdfAnalyze: "Ανάλυση και πρόταση στρατηγικής", pages: "Σελίδες",
        saveSettings: "Αποθήκευση", backToRace: "← Επιστροφή στον αγώνα",
        livePreviewBtn: "▶ ΠΛΑΝΟ",
        appearance: "Εμφάνιση",
        raceHistory: "Ιστορικό αγώνων", noRaceHistory: "Κανένα ιστορικό. Ολοκληρώστε έναν αγώνα για να το δείτε εδώ.",
        onboardWelcome: "Καλωσήρθατε στο Strateger!", onboardDemoHint: "Ξεκινήστε με ένα σύντομο demo — διαρκεί 30 δευτερόλεπτα και δείχνει τα πάντα σε δράση.", onboardRunDemo: "Εκκίνηση Demo",
        qualifyPartMultiCount: "Αριθμός οδηγών", qualifyRuns: "Γύροι ανά οδηγό",
        qualifyPitMin: "Ελάχιστος χρόνος", qualifyPitMinSec: "Ελάχιστα δευτερόλεπτα στο pit",
        leaderLabel: "ΑΡΧΗΓΟΣ", pitLabel: "ΠΙΤ",
        lapSingular: "γύρος", lapPlural: "γύροι",
        topKartsTitle: "TOP KART", numDecSep: ",",
        raceClockLabel: "ΧΡΟΝΟΣ ΑΓΩΝΑ",
        teamLogoUpload: "Ανέβασμα λογότυπου", teamLogoChange: "Αλλαγή λογότυπου", teamLogoRemove: "Αφαίρεση",
        teamLogoUploading: "Ανέβασμα…", teamLogoTooLarge: "Αρχείο πολύ μεγάλο (μέγ. 2 MB)",
        teamLogoInvalidType: "Μόνο JPG, PNG ή SVG",
        stintAvg: "Μέσος Stint",
        norm: "ΚΑΝΟΝ",
        pitLatestExitIn: "Ύστατη έξοδος σε", pitLeaveNow: "⚠️ Βγες τώρα!", pitLatestExitPassed: "🚨 ΕΞΟΔΟΣ ΕΚΠΡΌΘΕΣΜΗ",
    }
};

// Normalize keys that should stay consistent across all languages.
(function normalizeGlobalTranslations() {
    const teamNameByLang = {
        en: 'Team Name',
        he: 'שם הקבוצה',
        fr: "Nom de l'equipe",
        pt: 'Nome da equipe',
        ru: 'Название команды',
        ar: 'اسم الفريق',
        es: 'Nombre del equipo',
        it: 'Nome squadra',
        ka: 'გუნდის სახელი',
        de: 'Teamname',
        ja: 'チーム名',
        el: 'Ονομα ομάδας'
    };
    const settingsSavedByLang = {
        en: 'Settings saved',
        he: 'ההגדרות נשמרו',
        fr: 'Parametres enregistres',
        pt: 'Configuracoes salvas',
        ru: 'Настройки сохранены',
        ar: 'تم حفظ الإعدادات',
        es: 'Configuracion guardada',
        it: 'Impostazioni salvate',
        ka: 'პარამეტრები შენახულია',
        de: 'Einstellungen gespeichert',
        ja: '設定を保存しました',
        el: 'Οι ρυθμίσεις αποθηκεύτηκαν'
    };
    const lblDoublesByLang = {
        en: 'Allow consecutive stints',
        he: 'אפשר סטינטים רצופים',
        fr: 'Autoriser les relais consecutifs',
        pt: 'Permitir stints consecutivos',
        ru: 'Разрешить последовательные стинты',
        ar: 'السماح بمقاطع متتالية',
        es: 'Permitir stints consecutivos',
        it: 'Consenti stint consecutivi',
        ka: 'დაუშვი ზედიზედ stint-ები',
        de: 'Aufeinanderfolgende Stints erlauben',
        ja: '連続スティントを許可',
        el: 'Να επιτρέπονται διαδοχικά stint'
    };

    Object.keys(window.translations || {}).forEach(lang => {
        const dict = window.translations[lang];
        if (!dict) return;
        // qualifyTitle is already set per-language above — do not override
        dict.lblTeamName = teamNameByLang[lang] || teamNameByLang.en;
        dict.lblDoubles = lblDoublesByLang[lang] || lblDoublesByLang.en;
        dict.settingsSaved = settingsSavedByLang[lang] || settingsSavedByLang.en;
        if (lang === 'he') {
            dict.proUpgradeTitle = 'שדרג ל-Pro';
        }
    });
})();

window.t = function(key) {
    // 🟢 Use viewer's own language preference if set
    const lang = window.role === 'viewer' 
        ? localStorage.getItem('strateger_viewer_lang') || localStorage.getItem('strateger_lang') || 'en'
        : localStorage.getItem('strateger_lang') || 'en';
    const dict = window.translations[lang] || window.translations['en'];
    const en = window.translations['en'] || {};
    return dict[key] || en[key] || key;
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
    if (typeof window._applyHeroState === 'function') window._applyHeroState();
    // Re-run sim so simResult text is translated to the new language (skip during init burst)
    if (!window._initRunSimSuppressed && typeof window.runSim === 'function' && window.drivers && window.drivers.length > 0) window.runSim();
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
        
        const driverRows = document.querySelectorAll('#driversList .driver-row');
        driverRows.forEach(row => {
            if (row.classList.contains('opacity-50')) return; // skip placeholders
            const input = row.querySelector('.driver-input');
            const name = input ? input.value.trim() : '';
            if (!name) return; // skip blank
            const colorPicker = row.querySelector('.driver-color-picker');
            draft.drivers.push({ name, color: colorPicker ? colorPicker.value : undefined });
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
        
        if (draft.drivers && draft.drivers.length > 0) {
            const pool = draft.drivers.filter(d => d.name && d.name.trim());
            if (pool.length > 0 && typeof window.saveDriverPool === 'function') {
                window.saveDriverPool(pool.map(d => ({ name: d.name.trim(), color: d.color || window._nextDriverColor?.() || '#22d3ee' })));
                if (window._driverGroupParticipants) {
                    window._driverGroupParticipants.clear();
                    pool.forEach(d => window._driverGroupParticipants.add(d.name.trim()));
                }
            }
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
// 💾 SAVE SETTINGS (persists full config by deviceId)
// ==========================================

window.SAVED_SETTINGS_KEY = 'strateger_saved_settings';

window.saveSettingsToDevice = function() {
    const deviceId = window.getDeviceId ? window.getDeviceId() : 'default';
    const all = JSON.parse(localStorage.getItem(window.SAVED_SETTINGS_KEY) || '{}');

    const settings = {
        savedAt: Date.now(),
        duration: document.getElementById('raceDuration')?.value,
        stops: document.getElementById('reqPitStops')?.value,
        minStint: document.getElementById('minStint')?.value,
        maxStint: document.getElementById('maxStint')?.value,
        minPitTime: document.getElementById('minPitTime')?.value,
        raceStartTime: document.getElementById('raceStartTime')?.value,
        raceStartDate: document.getElementById('raceStartDate')?.value,
        raceLocation: document.getElementById('raceLocation')?.value,
        liveTimingUrl: document.getElementById('liveTimingUrl')?.value,
        searchValue: document.getElementById('searchValue')?.value,
        searchType: document.querySelector('input[name="searchType"]:checked')?.value,
        allowDouble: document.getElementById('allowDouble')?.checked,
        maxConsecutive: document.getElementById('maxConsecutive')?.value,
        numSquads: document.getElementById('numSquads')?.value,
        lang: window.currentLang || 'en',
    };

    all[deviceId] = settings;
    localStorage.setItem(window.SAVED_SETTINGS_KEY, JSON.stringify(all));

    // Brief visual feedback
    const btn = document.getElementById('saveSettingsBtn');
    if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check text-neon"></i>';
        btn.classList.add('border-neon/60', 'text-neon');
        setTimeout(() => { btn.innerHTML = orig; btn.classList.remove('border-neon/60', 'text-neon'); }, 1500);
    }
    if (typeof window.showToast === 'function') {
        window.showToast(window.t('settingsSaved'), 'success', 1500);
    }
};

window.loadSavedSettings = function() {
    const deviceId = window.getDeviceId ? window.getDeviceId() : 'default';
    const all = JSON.parse(localStorage.getItem(window.SAVED_SETTINGS_KEY) || '{}');
    const s = all[deviceId];
    if (!s) return;

    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined && val !== null && val !== '') el.value = val; };
    const setChecked = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = !!val; };

    set('raceDuration', s.duration);
    set('reqPitStops', s.stops);
    set('minStint', s.minStint);
    set('maxStint', s.maxStint);
    set('minPitTime', s.minPitTime);
    set('raceStartTime', s.raceStartTime);
    set('raceStartDate', s.raceStartDate);
    set('raceLocation', s.raceLocation);
    set('liveTimingUrl', s.liveTimingUrl);
    set('searchValue', s.searchValue);
    setChecked('allowDouble', s.allowDouble);
    set('maxConsecutive', s.maxConsecutive);
    set('numSquads', s.numSquads);

    if (s.searchType) {
        const radio = document.querySelector(`input[name="searchType"][value="${s.searchType}"]`);
        if (radio) radio.checked = true;
    }
    if (s.lang && typeof window.setLanguage === 'function') window.setLanguage(s.lang);

    if (!window._initRunSimSuppressed && typeof window.runSim === 'function') window.runSim();
};

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
    // Suppress intermediate runSim calls during the init burst; do one final run after
    window._initRunSimSuppressed = true;
    window.loadSavedSettings();
    window.loadDraftConfig();
    window._initRunSimSuppressed = false;

    // Single deferred run after all settings are loaded
    if (typeof window.scheduleRunSim === 'function') window.scheduleRunSim(0);
    else if (typeof window.runSim === 'function') window.runSim();

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
            const savedPitCount = data.liveData?.ourTeamPitCount ?? data.state?.pitCount ?? 0;
            const savedStintNo = data.state?.globalStintNumber ?? ((data.state?.pitCount || 0) + 1);
            const stopsEl = document.getElementById('savedRaceStops');
            const stintEl = document.getElementById('savedRaceStint');
            if (stopsEl) stopsEl.innerText = String(savedPitCount);
            if (stintEl) stintEl.innerText = String(savedStintNo);
            
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
                const wsPortInput = document.getElementById('wsPortOverride');
                if (wsPortInput && window.liveTimingConfig.wsPortOverride) {
                    wsPortInput.value = window.liveTimingConfig.wsPortOverride;
                    document.getElementById('wsPortOverrideRow')?.classList.remove('hidden');
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

// ==========================================
// 🌍 TRANSLATION PATCHES — Demo, Weather, Location
// ==========================================
(function() {
    const required = {
        demoRaceLength: 'Race Length',
        demoLenSprint: 'Sprint 30m',
        demoLenClub: 'Club 1h',
        demoLenEndurance: 'Endurance 3h',
        demoLenPro: 'Pro 6h',
        demoLenCustom: 'Custom...',
        demoCustomLabel: 'Custom Duration',
        demoGridSize: 'Grid Size',
        demoChaosLevel: 'Challenge',
        demoChaosLow: 'Low',
        demoChaosNormal: 'Normal',
        demoChaosHigh: 'High',
        demoSafetyCarLabel: 'Safety Car Events',
        demoSafetyCarDesc: 'Temporary neutralization with slower pace',
        demoIncidentsLabel: 'On-track Incidents',
        demoIncidentsDesc: 'Random incidents that affect specific teams',
        raceFinishedClose: 'Close',
        lblTrackLocation: '📍 Race Location',
        lblLocationPlaceholder: 'Search circuit or city...',
        lblLocationHint: 'Used for weather forecast',
        lblShowWeather: 'Show weather in stint preview',
        locationWeather: 'Location & Weather',
        weatherTooFarOut: 'Date too far — forecast unavailable',
        minUnit: 'min',
        confirmFinish: 'CONFIRM RACE FINISH',
        minTwoDrivers: 'Minimum 2 drivers required',
    };

    const localized = {
        he: {
            demoRaceLength: 'משך מירוץ', demoLenSprint: 'ספרינט 30דק', demoLenClub: 'מועדון 1ש', demoLenEndurance: 'אנדורנס 3ש', demoLenPro: 'פרו 6ש', demoLenCustom: 'מותאם אישית...',
            demoCustomLabel: 'משך מותאם אישית',
            demoGridSize: 'גודל גריד', demoChaosLevel: 'רמת אתגר', demoChaosLow: 'נמוכה', demoChaosNormal: 'רגילה', demoChaosHigh: 'גבוהה',
            demoSafetyCarLabel: 'אירועי Safety Car', demoSafetyCarDesc: 'ניטרול זמני עם קצב איטי יותר', demoIncidentsLabel: 'תקריות מסלול', demoIncidentsDesc: 'אירועים אקראיים שמשפיעים על קבוצות ספציפיות',
            raceFinishedClose: 'סגור',
            lblTrackLocation: '📍 מיקום המסלול', lblLocationPlaceholder: 'חפש מעגל או עיר...', lblLocationHint: 'משמש לתחזית מזג אוויר', lblShowWeather: 'הצג מזג אוויר בתצוגת סטינטים',
            locationWeather: 'מיקום ומזג אוויר', weatherTooFarOut: 'תאריך רחוק מדי — תחזית לא זמינה', minUnit: 'דק\'',
            confirmFinish: 'אישור סיום מירוץ',
            minTwoDrivers: 'נדרשים לפחות 2 נהגים',
        },
        fr: {
            demoRaceLength: 'Duree de course', demoLenSprint: 'Sprint 30 min', demoLenClub: 'Club 1 h', demoLenEndurance: 'Endurance 3 h', demoLenPro: 'Pro 6 h', demoLenCustom: 'Personnalise...',
            demoCustomLabel: 'Duree personnalisee',
            demoGridSize: 'Taille de grille', demoChaosLevel: 'Niveau de challenge', demoChaosLow: 'Faible', demoChaosNormal: 'Normal', demoChaosHigh: 'Eleve',
            demoSafetyCarLabel: 'Evenements Safety Car', demoSafetyCarDesc: 'Neutralisation temporaire avec rythme reduit', demoIncidentsLabel: 'Incidents piste', demoIncidentsDesc: 'Incidents aleatoires impactant certaines equipes',
            raceFinishedClose: 'Fermer',
            lblTrackLocation: '📍 Lieu de course', lblLocationPlaceholder: 'Rechercher circuit ou ville...', lblLocationHint: 'Utilise pour la meteo', lblShowWeather: 'Afficher la meteo par relais',
            locationWeather: 'Lieu & Meteo', weatherTooFarOut: 'Date trop eloignee — prevision indisponible', minUnit: 'min',
        },
        pt: {
            demoRaceLength: 'Duracao da corrida', demoLenSprint: 'Sprint 30m', demoLenClub: 'Clube 1h', demoLenEndurance: 'Endurance 3h', demoLenPro: 'Pro 6h', demoLenCustom: 'Personalizado...',
            demoCustomLabel: 'Duracao personalizada',
            demoGridSize: 'Tamanho do grid', demoChaosLevel: 'Nivel de desafio', demoChaosLow: 'Baixo', demoChaosNormal: 'Normal', demoChaosHigh: 'Alto',
            demoSafetyCarLabel: 'Eventos de Safety Car', demoSafetyCarDesc: 'Neutralizacao temporaria com ritmo mais lento', demoIncidentsLabel: 'Incidentes na pista', demoIncidentsDesc: 'Incidentes aleatorios que afetam equipes especificas',
            raceFinishedClose: 'Fechar',
            lblTrackLocation: '📍 Local da corrida', lblLocationPlaceholder: 'Buscar circuito ou cidade...', lblLocationHint: 'Usado para previsao do tempo', lblShowWeather: 'Mostrar clima por stint',
            locationWeather: 'Local & Clima', weatherTooFarOut: 'Data muito distante — previsao indisponivel', minUnit: 'min',
        },
        ru: {
            demoRaceLength: 'Длительность гонки', demoLenSprint: 'Спринт 30м', demoLenClub: 'Клуб 1ч', demoLenEndurance: 'Эндюранс 3ч', demoLenPro: 'Про 6ч', demoLenCustom: 'Своя длительность...',
            demoCustomLabel: 'Произвольная длительность',
            demoGridSize: 'Размер решетки', demoChaosLevel: 'Сложность', demoChaosLow: 'Низкая', demoChaosNormal: 'Нормальная', demoChaosHigh: 'Высокая',
            demoSafetyCarLabel: 'События Safety Car', demoSafetyCarDesc: 'Временная нейтрализация с более медленным темпом', demoIncidentsLabel: 'Инциденты на трассе', demoIncidentsDesc: 'Случайные инциденты, влияющие на отдельные команды',
            raceFinishedClose: 'Закрыть',
            lblTrackLocation: '📍 Место гонки', lblLocationPlaceholder: 'Найти трассу или город...', lblLocationHint: 'Для прогноза погоды', lblShowWeather: 'Показывать погоду по стинтам',
            locationWeather: 'Локация и погода', weatherTooFarOut: 'Дата слишком далеко — прогноз недоступен', minUnit: 'мин',
        },
        ar: {
            demoRaceLength: 'مدة السباق', demoLenSprint: 'سبرينت 30د', demoLenClub: 'نادي 1س', demoLenEndurance: 'تحمل 3س', demoLenPro: 'احترافي 6س', demoLenCustom: 'مخصص...',
            demoCustomLabel: 'مدة مخصصة',
            demoGridSize: 'حجم الشبكة', demoChaosLevel: 'مستوى التحدي', demoChaosLow: 'منخفض', demoChaosNormal: 'عادي', demoChaosHigh: 'مرتفع',
            demoSafetyCarLabel: 'احداث سيارة الامان', demoSafetyCarDesc: 'تحييد مؤقت بوتيرة ابطأ', demoIncidentsLabel: 'حوادث المضمار', demoIncidentsDesc: 'حوادث عشوائية تؤثر على فرق محددة',
            raceFinishedClose: 'اغلاق',
            lblTrackLocation: '📍 موقع السباق', lblLocationPlaceholder: 'ابحث عن حلبة او مدينة...', lblLocationHint: 'يستخدم لتوقعات الطقس', lblShowWeather: 'اظهار الطقس في كل stint',
            locationWeather: 'الموقع والطقس', weatherTooFarOut: 'التاريخ بعيد جدا — التوقعات غير متوفرة', minUnit: 'د',
        },
        es: {
            demoRaceLength: 'Duracion de carrera', demoLenSprint: 'Sprint 30m', demoLenClub: 'Club 1h', demoLenEndurance: 'Endurance 3h', demoLenPro: 'Pro 6h', demoLenCustom: 'Personalizado...',
            demoCustomLabel: 'Duracion personalizada',
            demoGridSize: 'Tamano de parrilla', demoChaosLevel: 'Nivel de desafio', demoChaosLow: 'Bajo', demoChaosNormal: 'Normal', demoChaosHigh: 'Alto',
            demoSafetyCarLabel: 'Eventos de Safety Car', demoSafetyCarDesc: 'Neutralizacion temporal con ritmo mas lento', demoIncidentsLabel: 'Incidentes en pista', demoIncidentsDesc: 'Incidentes aleatorios que afectan equipos especificos',
            raceFinishedClose: 'Cerrar',
            lblTrackLocation: '📍 Ubicacion de la carrera', lblLocationPlaceholder: 'Buscar circuito o ciudad...', lblLocationHint: 'Para el pronostico del tiempo', lblShowWeather: 'Mostrar clima por stint',
            locationWeather: 'Lugar y Clima', weatherTooFarOut: 'Fecha muy lejana — prevision no disponible', minUnit: 'min',
        },
        it: {
            demoRaceLength: 'Durata gara', demoLenSprint: 'Sprint 30m', demoLenClub: 'Club 1h', demoLenEndurance: 'Endurance 3h', demoLenPro: 'Pro 6h', demoLenCustom: 'Personalizzato...',
            demoCustomLabel: 'Durata personalizzata',
            demoGridSize: 'Dimensione griglia', demoChaosLevel: 'Livello sfida', demoChaosLow: 'Basso', demoChaosNormal: 'Normale', demoChaosHigh: 'Alto',
            demoSafetyCarLabel: 'Eventi Safety Car', demoSafetyCarDesc: 'Neutralizzazione temporanea con ritmo ridotto', demoIncidentsLabel: 'Incidenti in pista', demoIncidentsDesc: 'Incidenti casuali che influenzano team specifici',
            raceFinishedClose: 'Chiudi',
            lblTrackLocation: '📍 Luogo gara', lblLocationPlaceholder: 'Cerca circuito o citta...', lblLocationHint: 'Per le previsioni meteo', lblShowWeather: 'Mostra meteo per stint',
            locationWeather: 'Luogo e Meteo', weatherTooFarOut: 'Data troppo lontana — previsione non disponibile', minUnit: 'min',
        },
        ka: {
            demoRaceLength: 'რბოლის ხანგრძლივობა', demoLenSprint: 'სპრინტი 30წთ', demoLenClub: 'კლუბი 1სთ', demoLenEndurance: 'ენდურანსი 3სთ', demoLenPro: 'პრო 6სთ', demoLenCustom: 'მორგებული...',
            demoCustomLabel: 'მორგებული ხანგრძლივობა',
            demoGridSize: 'გრიდის ზომა', demoChaosLevel: 'სირთულის დონე', demoChaosLow: 'დაბალი', demoChaosNormal: 'ნორმალური', demoChaosHigh: 'მაღალი',
            demoSafetyCarLabel: 'Safety Car მოვლენები', demoSafetyCarDesc: 'დროებითი ნეიტრალიზაცია დაბალი ტემპით', demoIncidentsLabel: 'ტრეკის ინციდენტები', demoIncidentsDesc: 'შემთხვევითი ინციდენტები, რომლებიც კონკრეტულ გუნდებზე მოქმედებს',
            raceFinishedClose: 'დახურვა',
            lblTrackLocation: '📍 რბოლის მდებარეობა', lblLocationPlaceholder: 'მოძებნე ტრეკი ან ქალაქი...', lblLocationHint: 'ამინდის პროგნოზისთვის', lblShowWeather: 'ამინდის ჩვენება stint-ებში',
            locationWeather: 'მდებარეობა და ამინდი', weatherTooFarOut: 'თარიღი ძალიან შორია — პროგნოზი მიუწვდომელია', minUnit: 'წთ',
        },
        de: {
            demoRaceLength: 'Renndauer', demoLenSprint: 'Sprint 30m', demoLenClub: 'Club 1h', demoLenEndurance: 'Endurance 3h', demoLenPro: 'Pro 6h', demoLenCustom: 'Benutzerdefiniert...',
            demoCustomLabel: 'Benutzerdefinierte Dauer',
            demoGridSize: 'Grid-Grosse', demoChaosLevel: 'Schwierigkeitsgrad', demoChaosLow: 'Niedrig', demoChaosNormal: 'Normal', demoChaosHigh: 'Hoch',
            demoSafetyCarLabel: 'Safety-Car-Ereignisse', demoSafetyCarDesc: 'Zeitweise Neutralisierung mit langsamerem Tempo', demoIncidentsLabel: 'Streckenereignisse', demoIncidentsDesc: 'Zufallige Vorfalle mit Einfluss auf einzelne Teams',
            raceFinishedClose: 'Schliessen',
            lblTrackLocation: '📍 Rennort', lblLocationPlaceholder: 'Strecke oder Stadt suchen...', lblLocationHint: 'Fur Wettervorhersage', lblShowWeather: 'Wetter pro Stint anzeigen',
            locationWeather: 'Ort & Wetter', weatherTooFarOut: 'Datum zu weit entfernt — Vorhersage nicht verfugbar', minUnit: 'Min',
        },
        ja: {
            demoRaceLength: 'レース時間', demoLenSprint: 'スプリント 30分', demoLenClub: 'クラブ 1時間', demoLenEndurance: '耐久 3時間', demoLenPro: 'プロ 6時間', demoLenCustom: 'カスタム...',
            demoCustomLabel: 'カスタム時間',
            demoGridSize: 'グリッド数', demoChaosLevel: '難易度', demoChaosLow: '低', demoChaosNormal: '標準', demoChaosHigh: '高',
            demoSafetyCarLabel: 'セーフティカーイベント', demoSafetyCarDesc: '一時的にペースを落とす中立化', demoIncidentsLabel: 'コース上のインシデント', demoIncidentsDesc: '特定チームに影響するランダムインシデント',
            raceFinishedClose: '閉じる',
            lblTrackLocation: '📍 レース場所', lblLocationPlaceholder: 'サーキットや都市を検索...', lblLocationHint: '天気予報に使用', lblShowWeather: 'スティントごとの天気を表示',
            locationWeather: '場所と天気', weatherTooFarOut: '日付が遠すぎます — 予報は利用できません', minUnit: '分',
        },
        el: {
            demoRaceLength: 'Διαρκεια αγωνα', demoLenSprint: 'Sprint 30λ', demoLenClub: 'Club 1ω', demoLenEndurance: 'Endurance 3ω', demoLenPro: 'Pro 6ω', demoLenCustom: 'Προσαρμοσμενο...',
            demoCustomLabel: 'Προσαρμοσμενη διαρκεια',
            demoGridSize: 'Μεγεθος grid', demoChaosLevel: 'Επιπεδο προκλησης', demoChaosLow: 'Χαμηλο', demoChaosNormal: 'Κανονικο', demoChaosHigh: 'Υψηλο',
            demoSafetyCarLabel: 'Γεγονοτα Safety Car', demoSafetyCarDesc: 'Προσωρινη ουδετεροποιηση με χαμηλοτερο ρυθμο', demoIncidentsLabel: 'Περιστατικα πιστας', demoIncidentsDesc: 'Τυχαια περιστατικα που επηρεαζουν συγκεκριμενες ομαδες',
            raceFinishedClose: 'Κλεισιμο',
            lblTrackLocation: '📍 Τοποθεσια αγωνα', lblLocationPlaceholder: 'Αναζητηση πιστας ή πολης...', lblLocationHint: 'Για προγνωση καιρου', lblShowWeather: 'Εμφανιση καιρου ανα stint',
            locationWeather: 'Τοποθεσια και Καιρος', weatherTooFarOut: 'Ημερομηνια πολυ μακρια — προγνωση μη διαθεσιμη', minUnit: 'λ',
        },
    };

    Object.entries(required).forEach(([k, v]) => {
        if (!window.translations.en[k]) window.translations.en[k] = v;
    });

    Object.entries(localized).forEach(([lang, patch]) => {
        if (!window.translations[lang]) return;
        Object.entries(patch).forEach(([k, v]) => {
            if (!window.translations[lang][k]) window.translations[lang][k] = v;
        });
    });

    Object.keys(window.translations).forEach((lang) => {
        const dict = window.translations[lang];
        Object.keys(required).forEach((k) => {
            if (dict[k] == null) dict[k] = window.translations.en[k];
        });
    });
})();