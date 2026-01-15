// ==========================================
// 🌍 GLOBAL STATE & CONFIGURATION
// ==========================================

window.peer = null;
window.conn = null;
window.connections = [];
window.myId = null;
window.role = null;

window.config = {}; 
window.drivers = []; 
window.savedHostConfig = null;

window.raceInterval = null;
window.pitInterval = null;
window.liveTimingInterval = null;

window.RACE_STATE_KEY = 'strateger_race_state';
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
    activeSquad: 'A', 
    nextDriverIdx: 0, 
    targetStintMs: 0, 
    squadsActive: false,
    pendingPitEntry: false,
    globalStintNumber: 1,
    raceSaved: false,
    stintTargets: [],
    consecutiveStints: 1
};

window.liveTimingConfig = { url: '', enabled: false, demoMode: false };
window.searchConfig = { teamName: '', driverName: '', kartNumber: '' };
window.liveData = { position: null, lastLap: null, bestLap: null, laps: null, gapToLeader: null, competitors: [] };
window.demoState = { competitors: [], updateInterval: null };

window.cachedStrategy = null;
window.previewData = null;

// ==========================================
// 🌐 INTERNATIONALIZATION (I18N)
// ==========================================
window.currentLang = 'en';

window.translations = {
    en: {
        // --- Live Timing Filters ---
        ltSearchType: "Filter By:",
        ltTeam: "Team",
        ltDriver: "Driver",
        ltKart: "Kart #",
        ltPlaceholder: "Enter search value...",

        // --- Preview Screen ---
        previewTitle: "Strategy Preview",
        addToCalendar: "Add to Google Calendar",
        timeline: "Timeline",
        driverSchedule: "Driver Schedule",
        totalTime: "Total Time",
        close: "Close",
        
        // --- Google Calendar ---
        googleLogin: "Login with Google",
        eventCreated: "Event created successfully!",
        eventError: "Failed to create event",
        raceEventTitle: "Endurance Race (Strateger)",
        
        // --- Validation Errors ---
        errImpossible: "Impossible Strategy!",
        errAvgHigh: "Avg stint > Max Stint. Increase Stops or Max Stint.",
        errAvgLow: "Avg stint < Min Stint. Decrease Stops or Min Stint.",

        // --- General (Existing) ---
        appTitle: "STRATEGER",
        appSubtitle: "Endurance Race Strategy Manager",
        generalInfo: "General Info",
        advancedConstraints: "Advanced Constraints",
        driverConfig: "Drivers",
        aiTitle: "AI Strategy",
        lblDuration: "Duration (Hours)",
        lblStops: "Req. Stops",
        lblMinStint: "Min Stint (min)",
        lblMaxStint: "Max Stint (min)",
        lblPitTime: "Pit Time (sec)",
        lblPitClosedStart: "🚫 Closed Start (min)",
        lblPitClosedEnd: "🚫 Closed End (min)",
        lblMinDrive: "Min Driver Total",
        lblMaxDrive: "Max Driver Total",
        lblBuffer: "Pit Alert / Buffer (s)",
        lblDoubles: "Allow Doubles",
        lblSquads: "Use Squads",
        lblFuel: "Fuel",
        lblFuelTank: "Fuel Tank (min)",
        addDriver: "+ Add",
        generateStrategy: "Generate Strategy (AI)",
        previewStrategy: "Preview Strategy",
        startRace: "Start Race",
        loadSaved: "Load Saved Race",
        raceTime: "RACE TIME",
        stops: "STOPS",
        live: "LIVE",
        stop: "Stop",
        pos: "POS",
        last: "LAST",
        best: "BEST",
        targetStint: "TARGET STINT",
        buildTime: "BUILD TIME",
        current: "CURRENT",
        stintTime: "STINT TIME",
        nextDriver: "Next Driver",
        penalty: "Penalty",
        enterPit: "ENTER PIT",
        push: "PUSH",
        problem: "PROBLEM",
        resetMode: "Reset Mode",
        nightMode: "NIGHT MODE",
        dry: "Dry",
        wet: "Rain",
        drying: "Drying",
        boxNow: "BOX NOW!",
        pushMode: "PUSH MODE ACTIVE",
        squadSleeping: "SQUAD SLEEPING",
        squadWakeUp: "WAKE SQUAD",
        finalLap: "Final Lap",
        calculating: "Calculating...",
        manualInput: "Manual Input",
        saveStratTitle: "Save Strategy",
        libTitle: "Strategy Library",
        aiPlaceholder: "e.g. 'Driver 1 is fast but tires wear out...'",
        
        // --- Table Headers (Dynamic) ---
        thStart: "Start",
        thEnd: "End",
        thType: "Type",
        thDriver: "Driver",
        thDuration: "Duration",

        liveTiming: "Live Timing",
        liveTimingUrl: "Live Timing URL...",
        connectLive: "Connect",
        disconnectLive: "Disconnect",
        searchTeam: "Search team...",
        searchDriver: "Search driver...",
        searchKart: "Search kart #...",
        demoMode: "Demo Mode",
        
        // Modals
        sendEmail: "Send",
        cancel: "Cancel",
        create: "Create",
        save: "Save",
        load: "Load",
        delete: "Delete",
        
        // Saved Race Modal
        activeRaceFound: "Active Race Found",
        continueRace: "Continue Race",
        discardRace: "Discard",
        
        // Confirm Modal
        areYouSure: "Are you sure?",
        deleteWarning: "This will delete the active race data permanently.",
        yesDelete: "Yes, Delete",
        noKeep: "No, Keep",
        
        // Buttons
        invite: "Invite",
        synced: "Synced",
    },
    he: {
        // --- Live Timing ---
        ltSearchType: "סנן לפי:",
        ltTeam: "קבוצה",
        ltDriver: "נהג",
        ltKart: "מספר קארט",
        ltPlaceholder: "הכנס ערך לחיפוש...",

        // --- Preview ---
        previewTitle: "תצוגה מקדימה",
        addToCalendar: "הוסף ליומן גוגל",
        timeline: "ציר זמן",
        driverSchedule: "לוח זמנים לנהגים",
        totalTime: "זמן כולל",
        close: "סגור",

        // --- Google ---
        googleLogin: "התחבר עם Google",
        eventCreated: "האירוע נוצר בהצלחה!",
        eventError: "שגיאה ביצירת האירוע",
        raceEventTitle: "מירוץ סיבולת (Strateger)",

        // --- Errors ---
        errImpossible: "אסטרטגיה לא אפשרית!",
        errAvgHigh: "ממוצע סטינט גבוה מהמקסימום. הוסף עצירות או הגדל מקסימום.",
        errAvgLow: "ממוצע סטינט נמוך מהמינימום. הפחת עצירות או הקטן מינימום.",

        // --- כללי ---
        appTitle: "STRATEGER",
        appSubtitle: "ניהול אסטרטגיה למירוצי סיבולת",
        generalInfo: "הגדרות כלליות",
        advancedConstraints: "אילוצים מתקדמים",
        driverConfig: "נהגים",
        aiTitle: "אסטרטגיה חכמה (AI)",
        lblDuration: "משך (שעות)",
        lblStops: "עצירות חובה",
        lblMinStint: "מינימום סטינט (דק')",
        lblMaxStint: "מקסימום סטינט (דק')",
        lblPitTime: "זמן פיטס (שניות)",
        lblPitClosedStart: "🚫 סגור בהתחלה (דק')",
        lblPitClosedEnd: "🚫 סגור בסוף (דק')",
        lblMinDrive: "מינימום לנהג",
        lblMaxDrive: "מקסימום לנהג",
        lblBuffer: "התראה מראש (שניות)",
        lblDoubles: "אפשר דאבל סטינט",
        lblSquads: "שימוש בחוליות",
        lblFuel: "דלק",
        lblFuelTank: "מיכל דלק (דק')",
        addDriver: "+ הוסף",
        generateStrategy: "צור אסטרטגיה (AI)",
        previewStrategy: "תצוגה מקדימה",
        startRace: "התחל מירוץ",
        loadSaved: "טען מירוץ",
        raceTime: "זמן מירוץ",
        stops: "עצירות",
        live: "חי",
        stop: "עצור",
        pos: "מיקום",
        last: "אחרון",
        best: "הטוב",
        targetStint: "יעד סטינט",
        buildTime: "צבור זמן",
        current: "נוכחי",
        stintTime: "זמן סטינט",
        nextDriver: "נהג הבא",
        penalty: "עונש",
        enterPit: "כניסה לפיטס",
        push: "קצב",
        problem: "תקלה",
        resetMode: "איפוס מצב",
        nightMode: "מצב לילה",
        dry: "יבש",
        wet: "גשם",
        drying: "מתייבש",
        boxNow: "היכנס עכשיו!",
        pushMode: "מצב PUSH פעיל",
        squadSleeping: "חוליה ישנה",
        squadWakeUp: "העיר חוליה",
        finalLap: "הקפה אחרונה",
        calculating: "מחשב...",
        manualInput: "הזנה ידנית",
        saveStratTitle: "שמור אסטרטגיה",
        libTitle: "ספרייה",
        aiPlaceholder: "לדוגמה: 'נהג 1 מהיר אבל...'",
        
        // טבלה דינמית
        thStart: "התחלה",
        thEnd: "סיום",
        thType: "סוג",
        thDriver: "נהג",
        thDuration: "משך",

        // === תרגומים חסרים ===
        liveTiming: "תזמון חי",
        liveTimingUrl: "כתובת Live Timing...",
        connectLive: "התחבר",
        disconnectLive: "התנתק",
        searchTeam: "חפש קבוצה...",
        searchDriver: "חפש נהג...",
        searchKart: "חפש קארט #...",
        demoMode: "מצב דמו",
        
        // מודלים
        sendEmail: "שלח",
        cancel: "ביטול",
        create: "צור",
        save: "שמור",
        load: "טען",
        delete: "מחק",
        
        // מירוץ שמור
        activeRaceFound: "נמצא מירוץ פעיל",
        continueRace: "המשך מירוץ",
        discardRace: "מחק",
        
        // אישור
        areYouSure: "האם אתה בטוח?",
        deleteWarning: "פעולה זו תמחק את נתוני המירוץ לצמיתות.",
        yesDelete: "כן, מחק",
        noKeep: "לא, שמור",
        
        // כפתורים
        invite: "הזמן",
        synced: "מסונכרן",
    },
    fr: {
        ltSearchType: "Filtrer par:",
        ltTeam: "Équipe",
        ltDriver: "Pilote",
        ltKart: "Kart n°",
        ltPlaceholder: "Rechercher...",
        previewTitle: "Aperçu de la Stratégie",
        addToCalendar: "Ajouter au Calendrier",
        timeline: "Chronologie",
        driverSchedule: "Planning Pilotes",
        totalTime: "Temps Total",
        close: "Fermer",
        googleLogin: "Connexion Google",
        eventCreated: "Événement créé !",
        eventError: "Erreur création",
        raceEventTitle: "Course d'Endurance",
        errImpossible: "Stratégie Impossible!",
        errAvgHigh: "Moyenne > Max. Ajoutez des arrêts.",
        errAvgLow: "Moyenne < Min. Réduisez les arrêts.",
        appSubtitle: "Gestionnaire de Stratégie",
        generalInfo: "Info Générale",
        advancedConstraints: "Contraintes Avancées",
        driverConfig: "Pilotes",
        aiTitle: "Stratégie IA",
        lblDuration: "Durée (H)",
        lblStops: "Arrêts Req.",
        lblMinStint: "Min Relais",
        lblMaxStint: "Max Relais",
        lblPitTime: "Temps Stand",
        lblPitClosedStart: "🚫 Fermé Début",
        lblPitClosedEnd: "🚫 Fermé Fin",
        lblMinDrive: "Min Total",
        lblMaxDrive: "Max Total",
        lblBuffer: "Alerte (s)",
        lblDoubles: "Doubles OK",
        lblSquads: "Équipes",
        lblFuel: "Carburant",
        lblFuelTank: "Réservoir (min)",
        addDriver: "+ Ajouter",
        generateStrategy: "Générer (IA)",
        previewStrategy: "Aperçu",
        startRace: "Démarrer",
        loadSaved: "Charger",
        raceTime: "TEMPS COURSE",
        stops: "ARRÊTS",
        live: "LIVE",
        stop: "Stop",
        pos: "POS",
        last: "DERN",
        best: "MEILL",
        targetStint: "CIBLE RELAIS",
        buildTime: "GÉRER TEMPS",
        current: "ACTUEL",
        stintTime: "TEMPS RELAIS",
        nextDriver: "Prochain",
        penalty: "Pénalité",
        enterPit: "ENTRER STAND",
        push: "ATTAQUE",
        problem: "PROBLÈME",
        resetMode: "Réinit.",
        nightMode: "MODE NUIT",
        dry: "Sec",
        wet: "Pluie",
        drying: "Séchant",
        boxNow: "BOX MAINTENANT!",
        pushMode: "MODE ATTAQUE",
        squadSleeping: "ÉQUIPE DORT",
        squadWakeUp: "RÉVEIL ÉQUIPE",
        finalLap: "Dernier Tour",
        calculating: "Calcul...",
        manualInput: "Manuel",
        saveStratTitle: "Sauvegarder",
        libTitle: "Bibliothèque",
        aiPlaceholder: "ex: 'Pilote 1 préfère...'",
        thStart: "Début",
        thEnd: "Fin",
        thType: "Type",
        thDriver: "Pilote",
        thDuration: "Durée",
        liveTiming: "Chronométrage Live",
        liveTimingUrl: "URL Chronométrage...",
        connectLive: "Connecter",
        disconnectLive: "Déconnecter",
        searchTeam: "Rechercher équipe...",
        searchDriver: "Rechercher pilote...",
        searchKart: "Rechercher kart #...",
        demoMode: "Mode Démo",
        sendEmail: "Envoyer",
        cancel: "Annuler",
        create: "Créer",
        save: "Sauver",
        load: "Charger",
        delete: "Supprimer",
        activeRaceFound: "Course Active Trouvée",
        continueRace: "Continuer",
        discardRace: "Abandonner",
        areYouSure: "Êtes-vous sûr?",
        deleteWarning: "Ceci supprimera les données définitivement.",
        yesDelete: "Oui, Supprimer",
        noKeep: "Non, Garder",
        invite: "Inviter",
        synced: "Synchronisé",
    },
    pt: {
        ltSearchType: "Filtrar por:",
        ltTeam: "Equipe",
        ltDriver: "Piloto",
        ltKart: "Kart nº",
        ltPlaceholder: "Pesquisar...",
        previewTitle: "Visualização da Estratégia",
        addToCalendar: "Adicionar ao Calendário",
        timeline: "Linha do Tempo",
        driverSchedule: "Escala de Pilotos",
        totalTime: "Tempo Total",
        close: "Fechar",
        googleLogin: "Login Google",
        eventCreated: "Evento criado!",
        eventError: "Erro ao criar",
        raceEventTitle: "Corrida de Resistência",
        errImpossible: "Estratégia Impossível!",
        errAvgHigh: "Média > Máx. Aumente paradas.",
        errAvgLow: "Média < Mín. Reduza paradas.",
        appSubtitle: "Gestor de Estratégia",
        generalInfo: "Info Geral",
        advancedConstraints: "Restrições Avançadas",
        driverConfig: "Pilotos",
        aiTitle: "Estratégia IA",
        lblDuration: "Duração (H)",
        lblStops: "Paradas Req.",
        lblMinStint: "Mín Stint",
        lblMaxStint: "Máx Stint",
        lblPitTime: "Tempo Box",
        lblPitClosedStart: "🚫 Fechado Início",
        lblPitClosedEnd: "🚫 Fechado Fim",
        lblMinDrive: "Mín Total",
        lblMaxDrive: "Máx Total",
        lblBuffer: "Alerta (s)",
        lblDoubles: "Duplos OK",
        lblSquads: "Esquadrões",
        lblFuel: "Combustível",
        lblFuelTank: "Tanque (min)",
        addDriver: "+ Adicionar",
        generateStrategy: "Gerar (IA)",
        previewStrategy: "Visualizar",
        startRace: "Iniciar",
        loadSaved: "Carregar",
        raceTime: "TEMPO PROVA",
        stops: "PARADAS",
        live: "AO VIVO",
        stop: "Parar",
        pos: "POS",
        last: "ÚLT",
        best: "MELH",
        targetStint: "ALVO STINT",
        buildTime: "CRIAR TEMPO",
        current: "ATUAL",
        stintTime: "TEMPO STINT",
        nextDriver: "Próximo",
        penalty: "Penalidade",
        enterPit: "ENTRAR BOX",
        push: "PUSH",
        problem: "PROBLEMA",
        resetMode: "Resetar",
        nightMode: "MODO NOITE",
        dry: "Seco",
        wet: "Chuva",
        drying: "Secando",
        boxNow: "BOX AGORA!",
        pushMode: "MODO PUSH",
        squadSleeping: "EQUIPE DORMINDO",
        squadWakeUp: "ACORDAR EQUIPE",
        finalLap: "Volta Final",
        calculating: "Calculando...",
        manualInput: "Manual",
        saveStratTitle: "Salvar",
        libTitle: "Biblioteca",
        aiPlaceholder: "ex: 'Piloto 1 prefere...'",
        thStart: "Início",
        thEnd: "Fim",
        thType: "Tipo",
        thDriver: "Piloto",
        thDuration: "Duração",
        liveTiming: "Cronometragem Ao Vivo",
        liveTimingUrl: "URL Cronometragem...",
        connectLive: "Conectar",
        disconnectLive: "Desconectar",
        searchTeam: "Buscar equipe...",
        searchDriver: "Buscar piloto...",
        searchKart: "Buscar kart #...",
        demoMode: "Modo Demo",
        sendEmail: "Enviar",
        cancel: "Cancelar",
        create: "Criar",
        save: "Salvar",
        load: "Carregar",
        delete: "Excluir",
        activeRaceFound: "Corrida Ativa Encontrada",
        continueRace: "Continuar",
        discardRace: "Descartar",
        areYouSure: "Tem certeza?",
        deleteWarning: "Isso excluirá os dados permanentemente.",
        yesDelete: "Sim, Excluir",
        noKeep: "Não, Manter",
        invite: "Convidar",
        synced: "Sincronizado",
    }
};

window.t = function(key) {
    const lang = localStorage.getItem('strateger_lang') || 'en';
    const dict = window.translations[lang] || window.translations['en'];
    return dict[key] || key;
};

window.setLanguage = function(lang) {
    localStorage.setItem('strateger_lang', lang);
    window.currentLang = lang; // עדכון המשתנה הגלובלי
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === 'he') ? 'rtl' : 'ltr';

    // === תיקון: סנכרון ה-dropdown ===
    const langSelect = document.getElementById('langSelect');
    if (langSelect && langSelect.value !== lang) {
        langSelect.value = lang;
    }

    // תרגום אלמנטים
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
             el.placeholder = window.t(key);
        } else {
             el.innerText = window.t(key);
        }
    });

    // עדכון UI
    if (typeof window.updateModeUI === 'function') window.updateModeUI();
    if (typeof window.updateWeatherUI === 'function') window.updateWeatherUI();
    if (typeof window.renderFrame === 'function') window.renderFrame();
    if (typeof window.renderPreview === 'function' && window.previewData) window.renderPreview();
};