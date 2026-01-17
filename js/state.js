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
        resetMode: "Reset Mode", nightMode: "NIGHT MODE", dry: "Dry", wet: "Rain", drying: "Drying", boxNow: "BOX NOW!", pushMode: "PUSH MODE ACTIVE",
        squadSleeping: "SQUAD SLEEPING", squadWakeUp: "WAKE SQUAD", finalLap: "Final Lap", calculating: "Calculating...", manualInput: "Manual Input",
        saveStratTitle: "Save Strategy", libTitle: "Strategy Library", aiPlaceholder: "e.g. 'Driver 1 is fast but tires wear out...'",
        thStart: "Start", thEnd: "End", thType: "Type", thDriver: "Driver", thDuration: "Duration",
        liveTiming: "Live Timing", liveTimingUrl: "Live Timing URL...", connectLive: "Connect", disconnectLive: "Disconnect", searchTeam: "Search team...", searchDriver: "Search driver...", searchKart: "Search kart #...", demoMode: "Demo Mode",
        sendEmail: "Send", cancel: "Cancel", create: "Create", save: "Save", load: "Load", delete: "Delete",
        activeRaceFound: "Active Race Found", continueRace: "Continue Race", discardRace: "Discard",
        areYouSure: "Are you sure?", deleteWarning: "This will delete the active race data permanently.", yesDelete: "Yes, Delete", noKeep: "No, Keep",
        invite: "Invite", synced: "Synced",
        chatTitle: "Race Chat / Q&A", enterName: "Enter your name to chat", startChat: "Start Chatting", typeMessage: "Type a suggestion...", send: "Send", viewer: "Viewer", host: "HOST", suggestion: "Suggestion",
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
        resetMode: "איפוס מצב", nightMode: "מצב לילה", dry: "יבש", wet: "גשם", drying: "מתייבש", boxNow: "היכנס עכשיו!", pushMode: "מצב PUSH פעיל",
        squadSleeping: "חוליה ישנה", squadWakeUp: "העיר חוליה", finalLap: "הקפה אחרונה", calculating: "מחשב...", manualInput: "הזנה ידנית",
        saveStratTitle: "שמור אסטרטגיה", libTitle: "ספרייה", aiPlaceholder: "לדוגמה: 'נהג 1 מהיר אבל...'",
        thStart: "התחלה", thEnd: "סיום", thType: "סוג", thDriver: "נהג", thDuration: "משך",
        liveTiming: "תזמון חי", liveTimingUrl: "כתובת Live Timing...", connectLive: "התחבר", disconnectLive: "התנתק", searchTeam: "חפש קבוצה...", searchDriver: "חפש נהג...", searchKart: "חפש קארט #...", demoMode: "מצב דמו",
        sendEmail: "שלח", cancel: "ביטול", create: "צור", save: "שמור", load: "טען", delete: "מחק",
        activeRaceFound: "נמצא מירוץ פעיל", continueRace: "המשך מירוץ", discardRace: "מחק",
        areYouSure: "האם אתה בטוח?", deleteWarning: "פעולה זו תמחק את נתוני המירוץ לצמיתות.", yesDelete: "כן, מחק", noKeep: "לא, שמור",
        invite: "הזמן", synced: "מסונכרן",
        chatTitle: "צ'אט מירוץ / הצעות", enterName: "הכנס שם כדי להשתתף", startChat: "התחל", typeMessage: "כתוב הצעה לאסטרטגיה...", send: "שלח", viewer: "צופה", host: "מנהל", suggestion: "הצעה",
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
        resetMode: "Réinit.", nightMode: "MODE NUIT", dry: "Sec", wet: "Pluie", drying: "Séchant", boxNow: "BOX MAINTENANT!", pushMode: "MODE ATTAQUE",
        squadSleeping: "ÉQUIPE DORT", squadWakeUp: "RÉVEIL ÉQUIPE", finalLap: "Dernier Tour", calculating: "Calcul...", manualInput: "Manuel",
        saveStratTitle: "Sauvegarder", libTitle: "Bibliothèque", aiPlaceholder: "ex: 'Pilote 1 préfère...'",
        thStart: "Début", thEnd: "Fin", thType: "Type", thDriver: "Pilote", thDuration: "Durée",
        liveTiming: "Chronométrage Live", liveTimingUrl: "URL Chronométrage...", connectLive: "Connecter", disconnectLive: "Déconnecter", searchTeam: "Rechercher équipe...", searchDriver: "Rechercher pilote...", searchKart: "Rechercher kart #...", demoMode: "Mode Démo",
        sendEmail: "Envoyer", cancel: "Annuler", create: "Créer", save: "Sauver", load: "Charger", delete: "Supprimer",
        activeRaceFound: "Course Active Trouvée", continueRace: "Continuer", discardRace: "Abandonner",
        areYouSure: "Êtes-vous sûr?", deleteWarning: "Ceci supprimera les données définitivement.", yesDelete: "Oui, Supprimer", noKeep: "Non, Garder",
        invite: "Inviter", synced: "Synchronisé",
        chatTitle: "Chat Course / Q&R", enterName: "Entrez votre nom", startChat: "Commencer", typeMessage: "Écrire une suggestion...", send: "Envoyer", viewer: "Spectateur", host: "HÔTE", suggestion: "Suggestion",
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
        resetMode: "Resetar", nightMode: "MODO NOITE", dry: "Seco", wet: "Chuva", drying: "Secando", boxNow: "BOX AGORA!", pushMode: "MODO PUSH",
        squadSleeping: "EQUIPE DORMINDO", squadWakeUp: "ACORDAR EQUIPE", finalLap: "Volta Final", calculating: "Calculando...", manualInput: "Manual",
        saveStratTitle: "Salvar", libTitle: "Biblioteca", aiPlaceholder: "ex: 'Piloto 1 prefere...'",
        thStart: "Início", thEnd: "Fim", thType: "Tipo", thDriver: "Piloto", thDuration: "Duração",
        liveTiming: "Cronometragem Ao Vivo", liveTimingUrl: "URL Cronometragem...", connectLive: "Conectar", disconnectLive: "Desconectar", searchTeam: "Buscar equipe...", searchDriver: "Buscar piloto...", searchKart: "Buscar kart #...", demoMode: "Modo Demo",
        sendEmail: "Enviar", cancel: "Cancelar", create: "Criar", save: "Salvar", load: "Carregar", delete: "Excluir",
        activeRaceFound: "Corrida Ativa Encontrada", continueRace: "Continuar", discardRace: "Descartar",
        areYouSure: "Tem certeza?", deleteWarning: "Isso excluirá os dados permanentemente.", yesDelete: "Sim, Excluir", noKeep: "Não, Manter",
        invite: "Convidar", synced: "Sincronizado",
        chatTitle: "Chat Corrida / Q&A", enterName: "Digite seu nome", startChat: "Iniciar Chat", typeMessage: "Escreva uma sugestão...", send: "Enviar", viewer: "Espectador", host: "HOST", suggestion: "Sugestão",
    }
};

window.t = function(key) {
    const lang = localStorage.getItem('strateger_lang') || 'en';
    const dict = window.translations[lang] || window.translations['en'];
    return dict[key] || key;
};

window.setLanguage = function(lang) {
    localStorage.setItem('strateger_lang', lang);
    window.currentLang = lang;
    document.documentElement.lang = lang;
    document.documentElement.dir = (lang === 'he') ? 'rtl' : 'ltr';

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
        // Save Host ID explicitly within the race state
        hostId: window.myId, 
        timestamp: Date.now()
    };
    localStorage.setItem(window.RACE_STATE_KEY, JSON.stringify(snapshot));
};

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