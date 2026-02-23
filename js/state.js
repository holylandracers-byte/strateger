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
        ltSearchType: "Filter By:", ltTeam: "Team", ltDriver: "Driver", ltKart: "Kart #", ltPlaceholder: "Enter search value...",
        previewTitle: "Strategy Preview", addToCalendar: "Add to Google Calendar", timeline: "Timeline", driverSchedule: "Driver Schedule", totalTime: "Total Time", close: "Close",
        googleLogin: "Login with Google", eventCreated: "Event created successfully!", eventError: "Failed to create event", raceEventTitle: "Endurance Race (Strateger)",
        errImpossible: "Impossible Strategy!", errAvgHigh: "Avg stint > Max Stint. Increase Stops or Max Stint.", errAvgLow: "Avg stint < Min Stint. Decrease Stops or Min Stint.",
        appTitle: "STRATEGER", appSubtitle: "Endurance Race Strategy Manager", generalInfo: "General Info", advancedConstraints: "Advanced Constraints", driverConfig: "Drivers", aiTitle: "AI Strategy",
        lblDuration: "Duration (Hours)", lblStops: "Req. Stops", lblMinStint: "Min Stint (min)", lblMaxStint: "Max Stint (min)", lblPitTime: "Pit Time (sec)", lblPitClosedStart: "🚫 Closed Start (min)", lblPitClosedEnd: "🚫 Closed End (min)",
        lblMinDrive: "Min Driver Total", lblMaxDrive: "Max Driver Total", lblBuffer: "Pit Alert / Buffer (s)", lblDoubles: "Allow Doubles", lblSquads: "Use Squads", lblFuel: "Fuel", lblFuelTank: "Fuel Tank (min)",
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
        nextLabel: "Next:",
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
        googleLoginBtn: "Login",
        testBtn: "Test",
        demoBtn: "Demo",
        lblDoublesHint: "Same driver back-to-back",
        lblSquadsHint: "Separate drivers into two teams",
        lblFuelHint: "Track fuel tank capacity",
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
    },
    he: {
        ltSearchType: "סנן לפי:", ltTeam: "קבוצה", ltDriver: "נהג", ltKart: "מספר קארט", ltPlaceholder: "הכנס ערך לחיפוש...",
        previewTitle: "תצוגה מקדימה", addToCalendar: "הוסף ליומן גוגל", timeline: "ציר זמן", driverSchedule: "לוח זמנים לנהגים", totalTime: "זמן כולל", close: "סגור",
        googleLogin: "התחבר עם Google", eventCreated: "האירוע נוצר בהצלחה!", eventError: "שגיאה ביצירת האירוע", raceEventTitle: "מירוץ סיבולת (Strateger)",
        errImpossible: "אסטרטגיה לא אפשרית!", errAvgHigh: "ממוצע סטינט גבוה מהמקסימום. הוסף עצירות או הגדל מקסימום.", errAvgLow: "ממוצע סטינט נמוך מהמינימום. הפחת עצירות או הקטן מינימום.",
        appTitle: "STRATEGER", appSubtitle: "ניהול אסטרטגיה למירוצי סיבולת", generalInfo: "הגדרות כלליות", advancedConstraints: "אילוצים מתקדמים", driverConfig: "נהגים", aiTitle: "אסטרטגיה חכמה (AI)",
        lblDuration: "משך (שעות)", lblStops: "עצירות חובה", lblMinStint: "מינימום סטינט (דק')", lblMaxStint: "מקסימום סטינט (דק')", lblPitTime: "זמן פיטס (שניות)", lblPitClosedStart: "🚫 סגור בהתחלה (דק')", lblPitClosedEnd: "🚫 סגור בסוף (דק')",
        lblMinDrive: "מינימום לנהג", lblMaxDrive: "מקסימום לנהג", lblBuffer: "התראה מראש (שניות)", lblDoubles: "אפשר דאבל סטינט", lblSquads: "שימוש בחוליות", lblFuel: "דלק", lblFuelTank: "מיכל דלק (דק')",
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
        nextLabel: "הנהג הבא:",
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
        googleLoginBtn: "כניסה",
        testBtn: "בדיקה",
        demoBtn: "דמו",
        lblDoublesHint: "אותו נהג שוב",
        lblSquadsHint: "חלוקת נהגים לשתי חוליות",
        lblFuelHint: "עקוב אחר קיבולת מיכל הדלק",
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
    },
    fr: {
        ltSearchType: "Filtrer par:", ltTeam: "Équipe", ltDriver: "Pilote", ltKart: "Kart n°", ltPlaceholder: "Rechercher...",
        previewTitle: "Aperçu de la Stratégie", addToCalendar: "Ajouter au Calendrier", timeline: "Chronologie", driverSchedule: "Planning Pilotes", totalTime: "Temps Total", close: "Fermer",
        googleLogin: "Connexion Google", eventCreated: "Événement créé !", eventError: "Erreur création", raceEventTitle: "Course d'Endurance",
        errImpossible: "Stratégie Impossible!", errAvgHigh: "Moyenne > Max. Ajoutez des arrêts.", errAvgLow: "Moyenne < Min. Réduisez les arrêts.",
        appSubtitle: "Gestionnaire de Stratégie", generalInfo: "Info Générale", advancedConstraints: "Contraintes Avancées", driverConfig: "Pilotes", aiTitle: "Stratégie IA",
        lblDuration: "Durée (H)", lblStops: "Arrêts Req.", lblMinStint: "Min Relais", lblMaxStint: "Max Relais", lblPitTime: "Temps Stand", lblPitClosedStart: "🚫 Fermé Début", lblPitClosedEnd: "🚫 Fermé Fin",
        lblMinDrive: "Min Total", lblMaxDrive: "Max Total", lblBuffer: "Alerte (s)", lblDoubles: "Doubles OK", lblSquads: "Équipes", lblFuel: "Carburant", lblFuelTank: "Réservoir (min)",
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
        nextLabel: "Suivant:",
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
        googleLoginBtn: "Connexion",
        testBtn: "Test",
        demoBtn: "Démo",
        lblDoublesHint: "Même pilote consécutif",
        lblSquadsHint: "Séparer les pilotes en deux équipes",
        lblFuelHint: "Tracker la capacité du réservoir",
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
    },
    pt: {
        ltSearchType: "Filtrar por:", ltTeam: "Equipe", ltDriver: "Piloto", ltKart: "Kart nº", ltPlaceholder: "Pesquisar...",
        previewTitle: "Visualização da Estratégia", addToCalendar: "Adicionar ao Calendário", timeline: "Linha do Tempo", driverSchedule: "Escala de Pilotos", totalTime: "Tempo Total", close: "Fechar",
        googleLogin: "Login Google", eventCreated: "Evento criado!", eventError: "Erro ao criar", raceEventTitle: "Corrida de Resistência",
        errImpossible: "Estratégia Impossível!", errAvgHigh: "Média > Máx. Aumente paradas.", errAvgLow: "Média < Mín. Reduza paradas.",
        appSubtitle: "Gestor de Estratégia", generalInfo: "Info Geral", advancedConstraints: "Restrições Avançadas", driverConfig: "Pilotos", aiTitle: "Estratégia IA",
        lblDuration: "Duração (H)", lblStops: "Paradas Req.", lblMinStint: "Mín Stint", lblMaxStint: "Máx Stint", lblPitTime: "Tempo Box", lblPitClosedStart: "🚫 Fechado Início", lblPitClosedEnd: "🚫 Fechado Fim",
        lblMinDrive: "Mín Total", lblMaxDrive: "Máx Total", lblBuffer: "Alerta (s)", lblDoubles: "Duplos OK", lblSquads: "Esquadrões", lblFuel: "Combustível", lblFuelTank: "Tanque (min)",
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
        nextLabel: "Próximo:",
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
        googleLoginBtn: "Conexão",
        testBtn: "Teste",
        demoBtn: "Demo",
        lblDoublesHint: "Mesmo piloto consecutivo",
        lblSquadsHint: "Separar pilotos em dois times",
        lblFuelHint: "Rastrear capacidade do tanque",
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
    },
    ru: {
        ltSearchType: "Фильтр по:", ltTeam: "Команда", ltDriver: "Пилот", ltKart: "Карт №", ltPlaceholder: "Поиск...",
        previewTitle: "Предпросмотр стратегии", addToCalendar: "Добавить в календарь", timeline: "Хронология", driverSchedule: "Расписание", totalTime: "Общее время", close: "Закрыть",
        googleLogin: "Вход через Google", eventCreated: "Событие создано!", eventError: "Ошибка создания", raceEventTitle: "Гонка на выносливость",
        errImpossible: "Невозможная стратегия!", errAvgHigh: "Средн. > Макс. Добавьте остановок.", errAvgLow: "Средн. < Мин. Уменьшите остановок.",
        appSubtitle: "Менеджер стратегии", generalInfo: "Основная информация", advancedConstraints: "Продвинутые ограничения", driverConfig: "Пилоты", aiTitle: "ИИ стратегия",
        lblDuration: "Длительность (ч)", lblStops: "Требуемые остановки", lblMinStint: "Мин заезд", lblMaxStint: "Макс заезд", lblPitTime: "Время боксов", lblPitClosedStart: "🚫 Закрыто в начале", lblPitClosedEnd: "🚫 Закрыто в конце",
        lblMinDrive: "Мин всего", lblMaxDrive: "Макс всего", lblBuffer: "Оповещение (сек)", lblDoubles: "Разрешить дубли", lblSquads: "Использовать группы", lblFuel: "Топливо", lblFuelTank: "Бак (мин)",
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
        nextLabel: "Следующий:",
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
        googleLoginBtn: "Вход",
        testBtn: "Тест",
        demoBtn: "Демо",
        lblDoublesHint: "Одинаковый пилот подряд",
        lblSquadsHint: "Разделить пилотов на две команды",
        lblFuelHint: "Отслеживать емкость топливного бака",
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
    },
    ar: {
        ltSearchType: "تصفية حسب:", ltTeam: "الفريق", ltDriver: "السائق", ltKart: "رقم الكارت", ltPlaceholder: "البحث...",
        previewTitle: "معاينة الإستراتيجية", addToCalendar: "إضافة للتقويم", timeline: "الجدول الزمني", driverSchedule: "جدول السائقين", totalTime: "الوقت الإجمالي", close: "إغلاق",
        googleLogin: "تسجيل الدخول عبر Google", eventCreated: "تم إنشاء الحدث!", eventError: "خطأ في الإنشاء", raceEventTitle: "سباق التحمل",
        errImpossible: "إستراتيجية غير ممكنة!", errAvgHigh: "المتوسط > الحد الأقصى. أضف محطات.", errAvgLow: "المتوسط < الحد الأدنى. اقلل المحطات.",
        appSubtitle: "مدير الإستراتيجية", generalInfo: "معلومات عامة", advancedConstraints: "القيود المتقدمة", driverConfig: "السائقون", aiTitle: "إستراتيجية AI",
        lblDuration: "المدة (ساعات)", lblStops: "المحطات المطلوبة", lblMinStint: "الحد الأدنى للمقطع", lblMaxStint: "الحد الأقصى للمقطع", lblPitTime: "وقت الحفرة", lblPitClosedStart: "🚫 مغلق في البداية", lblPitClosedEnd: "🚫 مغلق في النهاية",
        lblMinDrive: "الحد الأدنى الكلي", lblMaxDrive: "الحد الأقصى الكلي", lblBuffer: "التنبيه (ثانية)", lblDoubles: "السماح بالمضاعفات", lblSquads: "استخدام الفرق", lblFuel: "الوقود", lblFuelTank: "خزان الوقود (دقيقة)",
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
        nextLabel: "التالي:",
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
        googleLoginBtn: "تسجيل الدخول",
        testBtn: "اختبار",
        demoBtn: "عرض توضيحي",
        lblDoublesHint: "نفس السائق متتالي",
        lblSquadsHint: "فصل السائقين إلى فريقين",
        lblFuelHint: "تتبع سعة خزان الوقود",
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
    },
    es: {
        ltSearchType: "Filtrar por:", ltTeam: "Equipo", ltDriver: "Piloto", ltKart: "Kart nº", ltPlaceholder: "Buscar...",
        previewTitle: "Vista previa de la estrategia", addToCalendar: "Añadir al calendario", timeline: "Cronología", driverSchedule: "Horario de pilotos", totalTime: "Tiempo total", close: "Cerrar",
        googleLogin: "Iniciar sesión con Google", eventCreated: "¡Evento creado!", eventError: "Error al crear", raceEventTitle: "Carrera de resistencia",
        errImpossible: "¡Estrategia imposible!", errAvgHigh: "Promedio > Máx. Añada paradas.", errAvgLow: "Promedio < Mín. Reduzca paradas.",
        appSubtitle: "Gestor de estrategia", generalInfo: "Información general", advancedConstraints: "Restricciones avanzadas", driverConfig: "Pilotos", aiTitle: "Estrategia IA",
        lblDuration: "Duración (H)", lblStops: "Paradas req.", lblMinStint: "Mín tramo", lblMaxStint: "Máx tramo", lblPitTime: "Tiempo box", lblPitClosedStart: "🚫 Cerrado inicio", lblPitClosedEnd: "🚫 Cerrado final",
        lblMinDrive: "Mín total", lblMaxDrive: "Máx total", lblBuffer: "Alerta (s)", lblDoubles: "Permitir dobles", lblSquads: "Usar escuadrones", lblFuel: "Combustible", lblFuelTank: "Depósito (min)",
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
        nextLabel: "Siguiente:",
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
        googleLoginBtn: "Iniciar sesión",
        testBtn: "Prueba",
        demoBtn: "Demostración",
        lblDoublesHint: "Mismo piloto consecutivo",
        lblSquadsHint: "Separar pilotos en dos equipos",
        lblFuelHint: "Rastrear capacidad del depósito",
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
    },
    it: {
        ltSearchType: "Filtra per:", ltTeam: "Squadra", ltDriver: "Pilota", ltKart: "Kart n°", ltPlaceholder: "Ricerca...", previewTitle: "Anteprima strategia", addToCalendar: "Aggiungi al calendario", timeline: "Cronologia", driverSchedule: "Orario piloti", totalTime: "Tempo totale", close: "Chiudi",
        googleLogin: "Accedi con Google", eventCreated: "Evento creato!", eventError: "Errore creazione", raceEventTitle: "Gara di resistenza", errImpossible: "Strategia impossibile!", errAvgHigh: "Media > Max. Aggiungi soste.", errAvgLow: "Media < Min. Riduci soste.",
        appSubtitle: "Gestore strategia", generalInfo: "Info generale", advancedConstraints: "Vincoli avanzati", driverConfig: "Piloti", aiTitle: "Strategia IA", lblDuration: "Durata (H)", lblStops: "Soste richieste", lblMinStint: "Min stint", lblMaxStint: "Max stint", lblPitTime: "Tempo pit", lblPitClosedStart: "🚫 Chiuso inizio", lblPitClosedEnd: "🚫 Chiuso fine",
        lblMinDrive: "Min totale", lblMaxDrive: "Max totale", lblBuffer: "Avviso (s)", lblDoubles: "Consenti doppi", lblSquads: "Usa squadre", lblFuel: "Carburante", lblFuelTank: "Serbatoio (min)", addDriver: "+ Aggiungi", generateStrategy: "Genera (IA)", previewStrategy: "Anteprima", startRace: "Inizia", loadSaved: "Carica",
        raceTime: "TEMPO GARA", stops: "SOSTE", live: "DIRETTA", stop: "Ferma", pos: "POS", last: "ULT", best: "MIGLIORE", targetStint: "STINT OBIETTIVO", buildTime: "TEMPO COSTRUITO", current: "ATTUALE", stintTime: "TEMPO STINT", nextDriver: "Prossimo", penalty: "Penalità", enterPit: "ENTRA IN PIT", push: "SPINGI", problem: "PROBLEMA",
        resetMode: "Ripristina", nightMode: "MODALITÀ NOTTE", dry: "Secco", wet: "Pioggia", drying: "Asciugando", boxNow: "BOX ADESSO!", stayOnTrackUntilFurther: "Rimani in pista fino a nuovo avviso", pushMode: "MODALITÀ PUSH", squadSleeping: "SQUADRA DORME", squadWakeUp: "SVEGLIA SQUADRA", finalLap: "Ultimo giro", calculating: "Calcolando...", manualInput: "Manuale",
        saveStratTitle: "Salva", libTitle: "Libreria", aiPlaceholder: "es: 'Il pilota 1 preferisce...'", thStart: "Inizio", thEnd: "Fine", thType: "Tipo", thDriver: "Pilota", thDuration: "Durata", liveTiming: "Cronometraggio live", liveTimingUrl: "URL cronometraggio...", connectLive: "Connetti", disconnectLive: "Disconnetti", searchTeam: "Cerca squadra...", searchDriver: "Cerca pilota...", searchKart: "Cerca kart...", demoMode: "Modalità demo",
        sendEmail: "Invia", cancel: "Annulla", create: "Crea", save: "Salva", load: "Carica", delete: "Elimina", activeRaceFound: "Gara attiva trovata", continueRace: "Continua", discardRace: "Scarta", areYouSure: "Sei sicuro?", deleteWarning: "Questo eliminerà i dati in modo permanente.", yesDelete: "Sì, elimina", noKeep: "No, conserva", invite: "Invita", synced: "Sincronizzato",
        chatTitle: "Chat gara / D&R", enterName: "Inserisci il tuo nome", startChat: "Inizia chat", typeMessage: "Scrivi un suggerimento...", send: "Invia", viewer: "Spettatore", host: "OSPITE", suggestion: "Suggerimento", strategyOutlook: "PROSPETTIVA STRATEGICA", timeLeft: "TEMPO RIMANENTE", penalty: "PENALITÀ", enterPit: "ENTRA IN PIT", nextDriverLabel: "PROSSIMO PILOTA", totalHeader: "TOTALE", stopsHeader: "STINT", driverHeader: "PILOTA",
        stintsLeft: "STINT RIMANENTI", future: "FUTURO", max: "MAX", min: "MIN", rest: "RIPOSO", buffer: "Buffer", impossible: "IMPOSSIBILE", addStop: "AGGIUNGI SOSTA", avg: "MEDIA", finalLap: "ULTIMO GIRO", inPit: "IN PIT", nextLabel: "Prossimo:", shortStintMsg: "⚠️ STINT CORTO! Rischio penalità", cancelEntry: "Annulla", notifyDriver: "📢 Notifica pilota", driverNotified: "✓ Pilota notificato", includesAdj: "Include aggiustamento:", missingSeconds: "Mancante", proceedToPit: "Procedere al pit?", wait: "ATTENDI...", getReady: "PREPARATI...", go: "VAI! VAI!",
        googleLoginBtn: "Accedi",
        testBtn: "Prova",
        demoBtn: "Demo",
        lblDoublesHint: "Stesso pilota consecutivo",
        lblSquadsHint: "Separare i piloti in due squadre",
        lblFuelHint: "Traccia la capacità del serbatoio",
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
    },
    ka: {
        ltSearchType: "ფილტრი:", ltTeam: "გუნდი", ltDriver: "მძღოლი", ltKart: "კარტი #", ltPlaceholder: "ძებნა...",
        previewTitle: "სტრატეგიის წინასწარი ნახვა", addToCalendar: "დაამატე კალენდარში", timeline: "ქრონოლოგია", driverSchedule: "მძღოლების განრიგი", totalTime: "მোცემი დრო", close: "დახურვა",
        googleLogin: "შეიყვანე Google-ით", eventCreated: "ღვაბი შეიქმნა!", eventError: "შეცდომა", raceEventTitle: "გამძლეობის რბოლა",
        errImpossible: "შეუძლებელი სტრატეგია!", errAvgHigh: "საშუალო > მაქსიმუმი. დაამატე გაჩერება.", errAvgLow: "საშუალო < მინიმუმი. კლებითი გაჩერება.",
        appSubtitle: "სტრატეგიის მენეჯერი", generalInfo: "ზოგადი ინფორმაცია", advancedConstraints: "დამატებითი შეზღუდვები", driverConfig: "მძღოლები", aiTitle: "AI სტრატეგია",
        lblDuration: "ხანგრძლივობა (საათი)", lblStops: "საჭირო გაჩერება", lblMinStint: "მინიმ ტაძე", lblMaxStint: "მაქსიმ ტაძე", lblPitTime: "ბოქსის დრო", lblPitClosedStart: "🚫 დახურული დაწყება", lblPitClosedEnd: "🚫 დახურული დასრულება",
        lblMinDrive: "მინიმ სულ", lblMaxDrive: "მაქსიმ სულ", lblBuffer: "გაფრთხოვება (წამი)", lblDoubles: "დაშვებული გაორმაგება", lblSquads: "გამოიყენე ჯგუფები", lblFuel: "საწვავი", lblFuelTank: "ავზი (წთ)",
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
        nextLabel: "შემდეგი:",
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
        googleLoginBtn: "ლოგინი",
        testBtn: "ტესტი",
        demoBtn: "დემო",
        lblDoublesHint: "ერთი და იგივე მძღოლი ზედიზედ",
        lblSquadsHint: "მძღოლების ორ ჯგუფად დაყოფა",
        lblFuelHint: "საწვავის ავზის ტევადობის ტ_აკვი",
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
    },
    de: {
        ltSearchType: "Filter nach:", ltTeam: "Team", ltDriver: "Fahrer", ltKart: "Kart Nr.", ltPlaceholder: "Suchen...", previewTitle: "Strategievorschau", addToCalendar: "Zum Kalender hinzufügen", timeline: "Zeitleiste", driverSchedule: "Fahrerplan", totalTime: "Gesamtzeit", close: "Schließen",
        googleLogin: "Mit Google anmelden", eventCreated: "Ereignis erstellt!", eventError: "Erstellungsfehler", raceEventTitle: "Ausdauerrennen", errImpossible: "Unmögliche Strategie!", errAvgHigh: "Durchschn. > Max. Stopps hinzufügen.", errAvgLow: "Durchschn. < Min. Stopps reduzieren.",
        appSubtitle: "Strategie-Manager", generalInfo: "Allgemeine Informationen", advancedConstraints: "Erweiterte Einschränkungen", driverConfig: "Fahrer", aiTitle: "KI-Strategie", lblDuration: "Dauer (Std.)", lblStops: "Erforderliche Stops", lblMinStint: "Min. Stint", lblMaxStint: "Max. Stint", lblPitTime: "Boxenzeit", lblPitClosedStart: "🚫 Start geschlossen", lblPitClosedEnd: "🚫 Ende geschlossen",
        lblMinDrive: "Min. Gesamt", lblMaxDrive: "Max. Gesamt", lblBuffer: "Warnung (s)", lblDoubles: "Doppel erlauben", lblSquads: "Staffeln verwenden", lblFuel: "Kraftstoff", lblFuelTank: "Tank (min)", addDriver: "+ Hinzufügen", generateStrategy: "Generieren (KI)", previewStrategy: "Vorschau", startRace: "Starten", loadSaved: "Laden",
        raceTime: "RENNZEIT", stops: "STOPS", live: "LIVE", stop: "Stop", pos: "POS", last: "LETZTE", best: "BESTE", targetStint: "ZIEL-STINT", buildTime: "AUFBAUZEIT", current: "AKTUELL", stintTime: "STINT-ZEIT", nextDriver: "Nächster", penalty: "Strafe", enterPit: "BOXEN FAHREN", push: "PUSH", problem: "PROBLEM",
        resetMode: "Zurücksetzen", nightMode: "NACHTMODUS", dry: "Trocken", wet: "Regen", drying: "Trocknet", boxNow: "JETZT BOXEN!", stayOnTrackUntilFurther: "Bleiben Sie auf der Strecke bis auf Weiteres", pushMode: "PUSH-MODUS", squadSleeping: "STAFFEL SCHLÄFT", squadWakeUp: "STAFFEL WECKEN", finalLap: "Letzte Runde", calculating: "Berechnung...", manualInput: "Manuell",
        saveStratTitle: "Speichern", libTitle: "Bibliothek", aiPlaceholder: "z.B.: 'Fahrer 1 bevorzugt...'", thStart: "Start", thEnd: "Ende", thType: "Typ", thDriver: "Fahrer", thDuration: "Dauer", liveTiming: "Live-Zeitmessung", liveTimingUrl: "Zeitmessung URL...", connectLive: "Verbinden", disconnectLive: "Trennen", searchTeam: "Team suchen...", searchDriver: "Fahrer suchen...", searchKart: "Kart suchen...", demoMode: "Demo-Modus",
        sendEmail: "Senden", cancel: "Abbrechen", create: "Erstellen", save: "Speichern", load: "Laden", delete: "Löschen", activeRaceFound: "Aktives Rennen gefunden", continueRace: "Fortfahren", discardRace: "Verwerfen", areYouSure: "Bist du sicher?", deleteWarning: "Dies löscht Daten dauerhaft.", yesDelete: "Ja, löschen", noKeep: "Nein, behalten", invite: "Einladen", synced: "Synchronisiert",
        chatTitle: "Renn-Chat / Q&A", enterName: "Geben Sie Ihren Namen ein", startChat: "Chat starten", typeMessage: "Schreibe einen Vorschlag...", send: "Senden", viewer: "Zuschauer", host: "HOST", suggestion: "Vorschlag", strategyOutlook: "STRATEGIEAUSBLICK", timeLeft: "VERBLEIBENDE ZEIT", penalty: "STRAFE", enterPit: "BOXEN FAHREN", nextDriverLabel: "NÄCHSTER FAHRER", totalHeader: "GESAMT", stopsHeader: "STINTS", driverHeader: "FAHRER",
        stintsLeft: "STINTS VERBLEIBEND", future: "ZUKUNFT", max: "MAX", min: "MIN", rest: "RUHE", buffer: "Puffer", impossible: "UNMÖGLICH", addStop: "STOP HINZUFÜGEN", avg: "DURCHSCHN.", finalLap: "LETZTE RUNDE", inPit: "IN DEN BOXEN", nextLabel: "Nächster:", shortStintMsg: "⚠️ KURZER STINT! Strafrisiko", cancelEntry: "Abbrechen", notifyDriver: "📢 Fahrer benachrichtigen", driverNotified: "✓ Fahrer benachrichtigt", includesAdj: "Enthält Anpassung:", missingSeconds: "Fehlend", proceedToPit: "Zu den Boxen fahren?", wait: "WARTEN...", getReady: "VORBEREITEN...", go: "VIEL ERFOLG!",
        googleLoginBtn: "Anmelden",
        testBtn: "Test",
        demoBtn: "Demo",
        lblDoublesHint: "Derselbe Fahrer hintereinander",
        lblSquadsHint: "Fahrer in zwei Teams aufteilen",
        lblFuelHint: "Tankkapazität verfolgen",
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
    },
    ja: {
        ltSearchType: "フィルタリング:", ltTeam: "チーム", ltDriver: "ドライバー", ltKart: "カート番号", ltPlaceholder: "検索...", previewTitle: "戦略プレビュー", addToCalendar: "カレンダーに追加", timeline: "タイムライン", driverSchedule: "ドライバースケジュール", totalTime: "総時間", close: "閉じる",
        googleLogin: "Googleでログイン", eventCreated: "イベントが作成されました!", eventError: "作成エラー", raceEventTitle: "耐久レース", errImpossible: "不可能な戦略!", errAvgHigh: "平均 > 最大。ピットストップを追加してください。", errAvgLow: "平均 < 最小。ピットストップを減らしてください。",
        appSubtitle: "戦略マネージャー", generalInfo: "一般情報", advancedConstraints: "高度な制約", driverConfig: "ドライバー", aiTitle: "AI戦略", lblDuration: "期間 (時間)", lblStops: "必要なピットストップ", lblMinStint: "最小スティント", lblMaxStint: "最大スティント", lblPitTime: "ピットタイム", lblPitClosedStart: "🚫 開始時に閉鎖", lblPitClosedEnd: "🚫 終了時に閉鎖",
        lblMinDrive: "最小合計", lblMaxDrive: "最大合計", lblBuffer: "警告 (秒)", lblDoubles: "ダブルを許可", lblSquads: "スクワッドを使用", lblFuel: "燃料", lblFuelTank: "燃料タンク (分)", addDriver: "+ 追加", generateStrategy: "生成 (AI)", previewStrategy: "プレビュー", startRace: "スタート", loadSaved: "読み込み",
        raceTime: "レース時間", stops: "ピット", live: "ライブ", stop: "停止", pos: "POS", last: "ラスト", best: "ベスト", targetStint: "ターゲットスティント", buildTime: "タイム構築", current: "現在", stintTime: "スティントタイム", nextDriver: "次のドライバー", penalty: "ペナルティ", enterPit: "ピット進入", push: "プッシュ", problem: "問題",
        resetMode: "リセット", nightMode: "ナイトモード", dry: "ドライ", wet: "ウェット", drying: "乾燥中", boxNow: "今ピット!", stayOnTrackUntilFurther: "さらに指示があるまでトラックに留まってください", pushMode: "プッシュモード", squadSleeping: "スクワッド休止中", squadWakeUp: "スクワッド起動", finalLap: "ファイナルラップ", calculating: "計算中...", manualInput: "手動入力",
        saveStratTitle: "保存", libTitle: "ライブラリ", aiPlaceholder: "例: 'ドライバー1は...を好む'", thStart: "開始", thEnd: "終了", thType: "タイプ", thDriver: "ドライバー", thDuration: "期間", liveTiming: "ライブタイミング", liveTimingUrl: "ライブタイミングURL...", connectLive: "接続", disconnectLive: "切断", searchTeam: "チームを検索...", searchDriver: "ドライバーを検索...", searchKart: "カートを検索...", demoMode: "デモモード",
        sendEmail: "送信", cancel: "キャンセル", create: "作成", save: "保存", load: "読み込み", delete: "削除", activeRaceFound: "アクティブなレースが見つかりました", continueRace: "続行", discardRace: "破棄", areYouSure: "本当にしますか?", deleteWarning: "これはデータを永久に削除します。", yesDelete: "はい、削除", noKeep: "いいえ、保持", invite: "招待", synced: "同期済み",
        chatTitle: "レースチャット / Q&A", enterName: "名前を入力", startChat: "チャットを開始", typeMessage: "提案を入力...", send: "送信", viewer: "視聴者", host: "ホスト", suggestion: "提案", strategyOutlook: "戦略見通し", timeLeft: "残り時間", penalty: "ペナルティ", enterPit: "ピット進入", nextDriverLabel: "次のドライバー", totalHeader: "合計", stopsHeader: "スティント", driverHeader: "ドライバー",
        stintsLeft: "残りスティント", future: "将来", max: "最大", min: "最小", rest: "休息", buffer: "バッファ", impossible: "不可能", addStop: "ピットストップ追加", avg: "平均", finalLap: "ファイナルラップ", inPit: "ピット内", nextLabel: "次:", shortStintMsg: "⚠️ 短いスティント!ペナルティリスク", cancelEntry: "キャンセル", notifyDriver: "📢 ドライバーに通知", driverNotified: "✓ ドライバーに通知済み", includesAdj: "調整を含む:", missingSeconds: "不足", proceedToPit: "ピットに進む?", wait: "待機中...", getReady: "準備中...", go: "頑張れ!",
        googleLoginBtn: "ログイン",
        testBtn: "テスト",
        demoBtn: "デモ",
        lblDoublesHint: "同じドライバーが連続",
        lblSquadsHint: "ドライバーを2つのチームに分ける",
        lblFuelHint: "燃料タンク容量を追跡",
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
    { code: 'ja', name: '日本語 (Japanese)', flag: '🇯🇵' }
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
    document.documentElement.dir = (['he', 'ar', 'ka'].includes(lang)) ? 'rtl' : 'ltr';

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

    if (typeof window.updateModeUI === 'function') window.updateModeUI();
    if (typeof window.updateWeatherUI === 'function') window.updateWeatherUI();
    if (typeof window.renderFrame === 'function') window.renderFrame();
    if (typeof window.renderPreview === 'function' && window.previewData) window.renderPreview();
};

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
    if (window.role !== 'host' || !window.state.isRunning) return;
    const snapshot = {
        config: window.config,
        state: window.state,
        drivers: window.drivers,
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

        setInterval(window.saveRaceState, 10000);

        // Restore live timing after refresh/continue
        try {
            if (window.liveTimingConfig && window.liveTimingConfig.enabled) {
                if (typeof window.updateLiveTimingUI === 'function') window.updateLiveTimingUI();
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