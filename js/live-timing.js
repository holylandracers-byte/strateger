// ==========================================
// ⏱️ LIVE TIMING CONTROLLER
// ==========================================

// עדכון הגדרות החיפוש (צוות/נהג/מספר)
window.updateSearchConfig = function() {
    const searchType = document.querySelector('input[name="searchType"]:checked')?.value || 'team';
    const searchValue = document.getElementById('searchValue')?.value || '';
    
    window.searchConfig.teamName = '';
    window.searchConfig.driverName = '';
    window.searchConfig.kartNumber = '';
    
    if (searchType === 'team') {
        window.searchConfig.teamName = searchValue;
    } else if (searchType === 'kart') {
        window.searchConfig.kartNumber = searchValue;
    } else if (searchType === 'driver') {
        window.searchConfig.driverName = searchValue;
    }
};

// פונקציית הבדיקה (Test Connection)
window.testLiveTiming = function() {
    const url = document.getElementById('liveTimingUrl').value;
    const searchValue = document.getElementById('searchValue')?.value || '';
    const searchType = document.querySelector('input[name="searchType"]:checked')?.value || 'team';
    
    const statusEl = document.getElementById('liveTimingStatus');
    
    if (!url) {
        statusEl.innerText = window.t('enterUrl');
        statusEl.className = "text-[10px] text-red-500 text-center";
        return;
    }
    
    if (!searchValue) {
        const typeNames = { team: window.t('team'), kart: window.t('kart'), driver: window.t('driver') };
        statusEl.innerText = `${window.t('enterValue')} ${typeNames[searchType]}`;
        statusEl.className = "text-[10px] text-red-500 text-center";
        return;
    }
    
    window.liveTimingConfig.url = url;
    window.liveTimingConfig.enabled = true;
    window.updateSearchConfig();
    
    statusEl.innerText = window.t('testing');
    statusEl.className = "text-[10px] text-yellow-500 text-center";
    
    window.fetchLiveTimingFromProxy().then(() => {
        if (window.liveData.position) {
            statusEl.innerText = `${window.t('found')} ${window.liveData.position}`;
            statusEl.className = "text-[10px] text-green-500 text-center font-bold";
        } else {
            statusEl.innerText = window.t('notFound');
            statusEl.className = "text-[10px] text-yellow-500 text-center";
        }
    }).catch(e => {
        statusEl.innerText = `${window.t('error')} ${e.message}`;
        statusEl.className = "text-[10px] text-red-500 text-center";
    });
};

// הפונקציה הראשית שמושכת נתונים
window.fetchLiveTimingFromProxy = async function() {
    if (!window.liveTimingConfig.url) return;
    
    window.updateSearchConfig();
    window.updateProxyStatus("🔄 " + window.t('connecting'));
    
    // יצירת מנהל אם לא קיים (LiveTimingManager נטען ב-HTML)
    if (!window.liveTimingManager && typeof LiveTimingManager !== 'undefined') {
        window.liveTimingManager = new LiveTimingManager();
    } else if (!window.liveTimingManager) {
        console.error("LiveTimingManager script not loaded!");
        return;
    }
    
    const url = window.liveTimingConfig.url;
    // איחוד פרמטרים לחיפוש חכם
    const searchTerm = window.searchConfig.driverName || window.searchConfig.teamName || window.searchConfig.kartNumber || '';

    // התחלת הסקרייפר דרך המנהל
    window.liveTimingManager.start(url, searchTerm, {
        updateInterval: 2000, 
        
        onUpdate: (data) => {
            if (data.ourTeam) {
                window.liveData.previousPosition = window.liveData.position;
                window.liveData.position = data.ourTeam.position;
                window.liveData.lastLap = data.ourTeam.lastLap;
                window.liveData.bestLap = data.ourTeam.bestLap;
                window.liveData.laps = data.ourTeam.totalLaps;
                window.liveData.gapToLeader = data.ourTeam.gap;
            }
            window.liveData.competitors = data.competitors;
            
            // עדכון הממשק
            window.updateLiveTimingUI();
            
            // שידור ללקוחות אם אנחנו Host
            if (window.state.isRunning) window.broadcast();

            const method = data.provider || 'http';
            window.updateProxyStatus(`✅ Connected (${method})`);
        },
        
        onError: (err, count) => {
            console.error("Scraper Error:", err);
            window.updateProxyStatus(`⚠️ Error ${count}: ${err.message}`);
        }
    });
};

window.parseTimeToMs = function(timeStr) {
    if (!timeStr) return null;
    if (typeof timeStr === 'number') return timeStr;
    
    const match = String(timeStr).match(/(?:(\d{1,2}):)?(\d{1,2}):?(\d{2})\.(\d{2,3})/);
    if (match) {
        const hours = match[1] ? parseInt(match[1]) : 0;
        const mins = parseInt(match[2]) || 0;
        const secs = parseInt(match[3]) || 0;
        let ms = parseInt(match[4]) || 0;
        if (match[4].length === 2) ms *= 10;
        return (hours * 3600 + mins * 60 + secs) * 1000 + ms;
    }
    
    const secMatch = String(timeStr).match(/(\d+)\.(\d{2,3})/);
    if (secMatch) {
        let ms = parseInt(secMatch[2]);
        if (secMatch[2].length === 2) ms *= 10;
        return parseInt(secMatch[1]) * 1000 + ms;
    }
    
    return null;
};

window.updateProxyStatus = function(msg) {
    const el = document.getElementById('liveTimingStatus');
    if (el) el.innerText = msg;
};

window.startProxyLiveTiming = function() {
    if (window.proxyFetchInterval) clearInterval(window.proxyFetchInterval);
    window.fetchLiveTimingFromProxy();
    // עדכון כל 5 שניות במקרה של HTTP Fallback, ה-Manager הפנימי מנהל את ה-Websocket מהר יותר
    window.proxyFetchInterval = setInterval(window.fetchLiveTimingFromProxy, 5000);
};

window.stopProxyLiveTiming = function() {
    if (window.proxyFetchInterval) {
        clearInterval(window.proxyFetchInterval);
        window.proxyFetchInterval = null;
    }
    if (window.liveTimingManager) {
        window.liveTimingManager.stop();
    }
};

// ==================== LIVE TIMING UI ====================

window.formatLapTime = function(ms) {
    if (!ms) return '--';
    const totalSec = ms / 1000;
    const min = Math.floor(totalSec / 60);
    const sec = (totalSec % 60).toFixed(3);
    return `${min}:${sec.padStart(6, '0')}`;
};

window.updateLiveTimingUI = function() {
    if (!window.liveTimingConfig.enabled) return;
    
    const panel = document.getElementById('liveTimingPanel');
    const indicator = document.getElementById('liveIndicator');
    if (panel) panel.classList.remove('hidden');
    if (indicator) indicator.classList.remove('hidden');
    
    const posEl = document.getElementById('livePosition');
    if (posEl) posEl.innerText = window.liveData.position || '-';
    
    const changeEl = document.getElementById('livePositionChange');
    if (changeEl && window.liveData.previousPosition && window.liveData.position) {
        const diff = window.liveData.previousPosition - window.liveData.position;
        if (diff > 0) {
            changeEl.innerText = `▲ ${diff}`;
            changeEl.className = 'text-[10px] position-up';
        } else if (diff < 0) {
            changeEl.innerText = `▼ ${Math.abs(diff)}`;
            changeEl.className = 'text-[10px] position-down';
        } else {
            changeEl.innerText = '—';
            changeEl.className = 'text-[10px] position-same';
        }
    }
    
    const lastLapEl = document.getElementById('liveLastLap');
    if (lastLapEl && window.liveData.lastLap) lastLapEl.innerText = window.formatLapTime(window.liveData.lastLap);
    
    const bestLapEl = document.getElementById('liveBestLap');
    if (bestLapEl && window.liveData.bestLap) bestLapEl.innerText = window.formatLapTime(window.liveData.bestLap);
    
    window.updateCompetitorsTable();
};

window.updateCompetitorsTable = function() {
    const tableEl = document.getElementById('competitorsTable');
    if (!tableEl) return;
    
    if (!window.liveData.competitors || window.liveData.competitors.length === 0) {
        tableEl.innerHTML = `<div class="text-gray-500 text-center py-2">${window.t('waitingData')}</div>`;
        return;
    }
    
    const ourTeam = window.liveData.competitors.find(c => c.isOurTeam);
    let html = '';
    
    // מציג את הטופ 10 או רשימה רלוונטית
    window.liveData.competitors.slice(0, 10).forEach((comp, idx) => {
        const isUs = comp.isOurTeam;
        const isDanger = !isUs && window.liveData.position && Math.abs(comp.position - window.liveData.position) <= 2;
        
        let posClass = 'text-gray-400';
        if (comp.position === 1) posClass = 'text-gold';
        else if (comp.position === 2) posClass = 'text-silver';
        else if (comp.position === 3) posClass = 'text-bronze';
        
        let rowClass = 'competitor-row py-1 px-2 rounded flex justify-between items-center mb-1';
        if (isUs) rowClass += ' our-team';
        else if (isDanger) rowClass += ' danger-zone';
        
        const pitIndicator = comp.inPit ? '<span class="text-fuel animate-pulse">🔧</span>' : '';
        
        // Gap Calculation
        let gapDisplay = '';
        if (comp.position === 1) {
            gapDisplay = '<span class="text-gold">Leader</span>';
        } else if (comp.gapToLeader) {
            if (ourTeam && !isUs) {
                const gapToUs = comp.totalRaceTime - ourTeam.totalRaceTime;
                // לוגיקה מקוצרת להצגת פערים (שניות או הקפות)
                const gapSec = (gapToUs / 1000).toFixed(1);
                gapDisplay = `<span class="${gapToUs > 0 ? 'text-green-400' : 'text-red-400'}">${gapToUs > 0 ? '+' : ''}${gapSec}s</span>`;
            } else if (!isUs) {
                const gapSec = (comp.gapToLeader / 1000).toFixed(1);
                gapDisplay = `<span class="text-gray-500">+${gapSec}s</span>`;
            }
        }
        
        const lastLapDisplay = comp.lastLap ? `<span class="text-gray-400">${window.formatLapTime(comp.lastLap)}</span>` : '';
        
        html += `
            <div class="${rowClass}">
                <div class="flex items-center gap-2">
                    <span class="${posClass} font-bold w-5">${comp.position}</span>
                    <span class="text-white text-[11px] truncate w-20">${comp.name}</span>
                    ${pitIndicator}
                </div>
                <div class="flex items-center gap-2 text-[10px]">
                    ${lastLapDisplay}
                    <span class="w-16 text-right">${gapDisplay}</span>
                </div>
            </div>
        `;
    });
    
    tableEl.innerHTML = html;
    
    // גלילה אוטומטית לשורה שלנו
    if (window.liveData.competitors.some(c => c.isOurTeam)) {
        setTimeout(window.scrollToOurTeam, 500);
    }
};

window.scrollToOurTeam = function() {
    const rows = document.querySelectorAll('.competitor-row');
    rows.forEach(row => {
        if (row.classList.contains('our-team')) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.classList.add('flash-alert');
            setTimeout(() => row.classList.remove('flash-alert'), 2000);
        }
    });
};

// ==================== LIVE TIMING EMBED (IFRAME) ====================
window.openLiveTimingEmbed = function() {
    const url = window.liveTimingConfig.url;
    if (!url) return;
    document.getElementById('liveTimingEmbed').classList.remove('hidden');
    document.getElementById('liveTimingIframe').src = url;
};

window.closeLiveTimingEmbed = function() {
    document.getElementById('liveTimingEmbed').classList.add('hidden');
    document.getElementById('liveTimingIframe').src = 'about:blank';
};

window.toggleLiveTimingEmbed = function() {
    const embed = document.getElementById('liveTimingEmbed');
    if (embed.classList.contains('hidden')) window.openLiveTimingEmbed();
    else window.closeLiveTimingEmbed();
};

window.refreshLiveTiming = function() {
    window.fetchLiveTimingFromProxy();
};

window.startLiveTimingUpdates = function() {
    if (window.liveTimingConfig.demoMode) {
        window.liveTimingInterval = setInterval(window.updateDemoData, 1000);
    } else if (window.liveTimingConfig.url) {
        window.startProxyLiveTiming();
    }
};

window.stopLiveTiming = function() {
    if (window.liveTimingManager) {
        window.liveTimingManager.stop();
        window.liveTimingManager = null;
    }
    
    // איפוס נתונים
    window.liveData = { 
        position: null, lastLap: null, bestLap: null, 
        laps: 0, gapToLeader: 0, competitors: [] 
    };
    
    document.getElementById('liveTimingPanel')?.classList.add('hidden');
    document.getElementById('liveIndicator')?.classList.add('hidden');
    
    window.updateLiveTimingUI();
    window.updateProxyStatus("⏹️ " + window.t('stopped'));
    window.liveTimingConfig.enabled = false;
};

window.stopLiveTimingUpdates = function() {
    if (window.liveTimingInterval) {
        clearInterval(window.liveTimingInterval);
        window.liveTimingInterval = null;
    }
    window.stopProxyLiveTiming();
};

// ==================== DEMO MODE ====================

window.startDemoMode = function() {
    window.liveTimingConfig.demoMode = true;
    window.liveTimingConfig.enabled = true;
    window.initializeDemoCompetitors();
    
    const statusEl = document.getElementById('liveTimingStatus');
    if (statusEl) {
        statusEl.innerText = "🎮 Demo Mode Active";
        statusEl.className = "text-[10px] text-neon text-center font-bold";
    }
};

window.initializeDemoCompetitors = function() {
    const teamNames = [
        'Your Team', 'Racing Stars', 'Speed Demons', 'Track Masters', 
        'Nitro Force', 'Apex Racing', 'Thunder Karts', 'Pro Racers',
        'Fast Lane', 'Grid Warriors'
    ];
    
    window.demoState.competitors = teamNames.map((name, idx) => ({
        name: name,
        position: idx + 1,
        previousPosition: idx + 1,
        laps: 0,
        lastLap: null,
        bestLap: null,
        baseLapTime: null,
        totalRaceTime: 0,
        pitStops: 0,
        inPit: false,
        isOurTeam: idx === 0
    }));
};

window.updateDemoData = function() {
    if (!window.liveTimingConfig.demoMode || !window.state.isRunning) return;
    
    const raceElapsed = Date.now() - window.state.startTime;
    
    window.demoState.competitors.forEach((comp, idx) => {
        if (!comp.baseLapTime) {
            comp.baseLapTime = 61000 + (idx * 400) + (Math.random() * 500);
        }
        
        const expectedLaps = Math.floor(raceElapsed / comp.baseLapTime);
        if (expectedLaps > comp.laps) {
            comp.laps = expectedLaps;
            comp.lastLap = comp.baseLapTime + (Math.random() - 0.5) * 1000;
            if (!comp.bestLap || comp.lastLap < comp.bestLap) comp.bestLap = comp.lastLap;
        }
        
        // סימולציית פיטס פשוטה
        const pitInterval = 50 * 60 * 1000 + (idx * 2 * 60 * 1000);
        const expectedPits = Math.floor(raceElapsed / pitInterval);
        if (expectedPits > comp.pitStops) comp.pitStops = expectedPits;
        
        const pitTimePenalty = 120000;
        const timeSinceLastPit = raceElapsed - (comp.pitStops * pitInterval);
        comp.inPit = timeSinceLastPit >= 0 && timeSinceLastPit < pitTimePenalty && comp.pitStops > 0;
        
        let currentPitPenalty = comp.pitStops * pitTimePenalty;
        if (comp.inPit) currentPitPenalty = ((comp.pitStops - 1) * pitTimePenalty) + timeSinceLastPit;
        
        comp.totalRaceTime = (comp.laps * comp.baseLapTime) + currentPitPenalty;
    });
    
    // מיון לפי זמן מירוץ כולל (קובע את המיקום)
    window.demoState.competitors.sort((a, b) => {
        if (b.laps !== a.laps) return b.laps - a.laps;
        return a.totalRaceTime - b.totalRaceTime;
    });
    
    const leader = window.demoState.competitors[0];
    window.demoState.competitors.forEach((c, i) => {
        c.previousPosition = c.position;
        c.position = i + 1;
        c.gapToLeader = (i === 0) ? 0 : (c.totalRaceTime - leader.totalRaceTime);
    });
    
    // עדכון Live Data
    const ourTeam = window.demoState.competitors.find(c => c.isOurTeam);
    if (ourTeam) {
        window.liveData.previousPosition = window.liveData.position;
        window.liveData.position = ourTeam.position;
        window.liveData.lastLap = ourTeam.lastLap;
        window.liveData.bestLap = ourTeam.bestLap;
        window.liveData.laps = ourTeam.laps;
        window.liveData.gapToLeader = ourTeam.gapToLeader;
    }
    
    window.liveData.competitors = window.demoState.competitors;
    window.updateLiveTimingUI();
};