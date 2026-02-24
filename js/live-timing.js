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
    
    // Check if already running with same config - don't restart
    const stats = window.liveTimingManager.getStats();
    if (stats && stats.isRunning) {
        console.log('[LiveTiming] Already running, skipping restart');
        return;
    }
    
    window.updateProxyStatus("🔄 " + window.t('connecting'));

    // התחלת הסקרייפר דרך המנהל
    window.liveTimingManager.start(url, searchTerm, {
        updateInterval: 2000, 
        
        onUpdate: (data) => {
            console.log('[LiveTiming] Data update:', { 
                hasOurTeam: !!data.ourTeam, 
                position: data.ourTeam?.position,
                compCount: data.competitors?.length 
            });
            
            if (data.ourTeam) {
                window.liveData.previousPosition = window.liveData.position;
                window.liveData.position = data.ourTeam.position;
                window.liveData.lastLap = data.ourTeam.lastLap;
                window.liveData.bestLap = data.ourTeam.bestLap;
                window.liveData.laps = data.ourTeam.totalLaps;
                window.liveData.gapToLeader = data.ourTeam.gap;

                // === Pit status from live timing ===
                const wasInPit = window.liveData.ourTeamInPit;
                window.liveData.ourTeamInPit = !!data.ourTeam.inPit;
                window.liveData.ourTeamPitCount = data.ourTeam.pitCount ?? null;

                // Auto-detect pit entry from live timing
                if (window.state && window.state.isRunning && !window.state.isInPit && wasInPit === false && data.ourTeam.inPit) {
                    console.log('[LiveTiming] 🛑 Auto-detected PIT ENTRY from live data');
                    if (typeof window.confirmPitEntry === 'function') {
                        window.confirmPitEntry(true); // true = auto-detected, skip confirm dialog
                    }
                }
                // Auto-detect pit exit from live timing
                if (window.state && window.state.isRunning && window.state.isInPit && wasInPit === true && !data.ourTeam.inPit) {
                    console.log('[LiveTiming] ✅ Auto-detected PIT EXIT from live data');
                    if (typeof window.confirmPitExit === 'function') {
                        window.confirmPitExit();
                    }
                }
            }
            window.liveData.competitors = data.competitors || [];

            // === Race time from live timing (RaceFacer provides timeLeftSeconds) ===
            if (data.race && data.race.timeLeftSeconds != null) {
                window.liveData.raceTimeLeftMs = data.race.timeLeftSeconds * 1000;
            }
            
            // Force enable if data arrived
            if (!window.liveTimingConfig.enabled) {
                window.liveTimingConfig.enabled = true;
            }
            
            // עדכון הממשק - always call
            if (typeof window.updateLiveTimingUI === 'function') {
                window.updateLiveTimingUI();
            }
            
            // שידור ללקוחות אם אנחנו Host
            if (window.state && window.state.isRunning && typeof window.broadcast === 'function') {
                window.broadcast();
            }

            // Persist live timing state so refresh/back keeps it
            if (typeof window.saveRaceState === 'function') window.saveRaceState();

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
    // Always show panel if we have data, regardless of enabled flag
    const hasData = window.liveData && (window.liveData.position || window.liveData.competitors.length > 0);
    
    const panel = document.getElementById('liveTimingPanel');
    const indicator = document.getElementById('liveIndicator');
    
    if (hasData || window.liveTimingConfig.enabled) {
        if (panel) panel.classList.remove('hidden');
        if (indicator) indicator.classList.remove('hidden');
    }
    
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
    
    // Update laps counter
    const lapsEl = document.getElementById('liveLaps');
    if (lapsEl) lapsEl.innerText = window.liveData.laps != null ? window.liveData.laps : '-';
    
    // Update gap to leader
    const gapEl = document.getElementById('liveGap');
    if (gapEl) {
        if (window.liveData.position === 1) {
            gapEl.innerText = 'LEADER';
            gapEl.className = 'text-sm font-mono text-gold';
        } else if (window.liveData.gapToLeader) {
            const gapSec = (window.liveData.gapToLeader / 1000).toFixed(1);
            gapEl.innerText = `+${gapSec}s`;
            gapEl.className = 'text-sm font-mono text-fuel';
        } else {
            gapEl.innerText = '-';
            gapEl.className = 'text-sm font-mono text-fuel';
        }
    }
    
    // Update total cars count
    const totalCarsEl = document.getElementById('liveTotalCars');
    if (totalCarsEl && window.liveData.competitors) {
        totalCarsEl.innerText = window.liveData.competitors.length || '-';
    }
    
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
    
    // Show context around our team: 3 before, us, 3 after (or top 7 if no team found)
    let displayList = [];
    if (ourTeam) {
        const ourIndex = window.liveData.competitors.findIndex(c => c.isOurTeam);
        const startIdx = Math.max(0, ourIndex - 3);
        const endIdx = Math.min(window.liveData.competitors.length, ourIndex + 4);
        displayList = window.liveData.competitors.slice(startIdx, endIdx);
    } else {
        displayList = window.liveData.competitors.slice(0, 7);
    }
    
    // Pad to exactly 7 rows for stable height
    const FIXED_ROWS = 7;
    while (displayList.length < FIXED_ROWS) {
        displayList.push(null); // placeholder empty row
    }

    // Reuse existing rows if count matches, otherwise rebuild
    const existingRows = tableEl.querySelectorAll('.competitor-row');
    const needsRebuild = existingRows.length !== FIXED_ROWS;
    
    if (needsRebuild) {
        let html = '';
        for (let i = 0; i < FIXED_ROWS; i++) {
            html += `<div class="competitor-row py-1 px-2 rounded flex justify-between items-center" style="height:28px;min-height:28px;">
                <div class="flex items-center gap-1" style="min-width:0;">
                    <span class="comp-pos font-bold" style="width:20px;text-align:right;"></span>
                    <span class="comp-name text-[11px] truncate" style="width:80px;"></span>
                    <span class="comp-pit text-[10px]" style="width:24px;"></span>
                </div>
                <div class="flex items-center gap-2 text-[10px]" style="min-width:0;">
                    <span class="comp-lap text-gray-400" style="width:60px;text-align:right;"></span>
                    <span class="comp-gap" style="width:60px;text-align:right;"></span>
                </div>
            </div>`;
        }
        tableEl.innerHTML = html;
    }
    
    const rows = tableEl.querySelectorAll('.competitor-row');
    
    displayList.forEach((comp, idx) => {
        const row = rows[idx];
        if (!row) return;
        
        if (!comp) {
            // Empty placeholder row — keep it invisible but sized
            row.className = 'competitor-row py-1 px-2 rounded flex justify-between items-center opacity-0';
            row.style.height = '28px';
            row.style.minHeight = '28px';
            return;
        }
        
        const isUs = comp.isOurTeam;
        const isDanger = !isUs && window.liveData.position && Math.abs(comp.position - window.liveData.position) <= 2;
        
        // Row class — stable, no flash/pulse for our team
        let rowCls = 'competitor-row py-1 px-2 rounded flex justify-between items-center';
        if (isUs) rowCls += ' our-team';
        else if (isDanger) rowCls += ' danger-zone';
        row.className = rowCls;
        row.style.height = '28px';
        row.style.minHeight = '28px';
        row.style.opacity = '1';
        
        // Position
        const posEl = row.querySelector('.comp-pos');
        if (posEl) {
            posEl.innerText = comp.position;
            if (comp.position === 1) posEl.className = 'comp-pos font-bold text-gold';
            else if (comp.position === 2) posEl.className = 'comp-pos font-bold text-silver';
            else if (comp.position === 3) posEl.className = 'comp-pos font-bold text-bronze';
            else posEl.className = 'comp-pos font-bold text-gray-400';
            posEl.style.width = '20px';
            posEl.style.textAlign = 'right';
        }
        
        // Name
        const nameEl = row.querySelector('.comp-name');
        if (nameEl) {
            nameEl.innerText = comp.name;
            nameEl.className = isUs ? 'comp-name text-[11px] truncate text-ice font-bold' : 'comp-name text-[11px] truncate text-white';
            nameEl.style.width = '80px';
        }
        
        // Pit indicator
        const pitEl = row.querySelector('.comp-pit');
        if (pitEl) {
            if (comp.inPit) {
                pitEl.innerHTML = '<span class="text-fuel font-bold">PIT</span>';
            } else {
                pitEl.innerHTML = '';
            }
        }
        
        // Last lap
        const lapEl = row.querySelector('.comp-lap');
        if (lapEl) {
            lapEl.innerText = comp.lastLap ? window.formatLapTime(comp.lastLap) : '';
        }
        
        // Gap
        const gapEl = row.querySelector('.comp-gap');
        if (gapEl) {
            if (comp.position === 1) {
                gapEl.innerHTML = '<span class="text-gold">P1</span>';
            } else if (comp.gapToLeader) {
                if (ourTeam && !isUs) {
                    const gapToUs = comp.totalRaceTime - ourTeam.totalRaceTime;
                    const gapSec = (gapToUs / 1000).toFixed(1);
                    gapEl.innerHTML = `<span class="${gapToUs > 0 ? 'text-green-400' : 'text-red-400'}">${gapToUs > 0 ? '+' : ''}${gapSec}s</span>`;
                } else if (!isUs) {
                    const gapSec = (comp.gapToLeader / 1000).toFixed(1);
                    gapEl.innerHTML = `<span class="text-gray-500">+${gapSec}s</span>`;
                } else {
                    gapEl.innerHTML = '';
                }
            } else {
                gapEl.innerHTML = '';
            }
        }
    });
};

window.scrollToOurTeam = function() {
    // No-op: our team is always centered in the view, no scroll/flash needed
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
    // Prevent duplicate starts
    if (window.__liveTimingStarted) {
        console.log('[LiveTiming] Already started, skipping duplicate call');
        return;
    }
    window.__liveTimingStarted = true;
    
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
    
    // Clear demo/live interval
    if (window.liveTimingInterval) {
        clearInterval(window.liveTimingInterval);
        window.liveTimingInterval = null;
    }
    
    window.__liveTimingStarted = false;
    window.liveTimingConfig.demoMode = false;
    
    // איפוס נתונים
    window.liveData = { 
        position: null, previousPosition: null, lastLap: null, bestLap: null, 
        laps: 0, gapToLeader: 0, competitors: [] 
    };
    
    // Reset demo state
    window.demoState = { competitors: [], updateInterval: null };
    
    document.getElementById('liveTimingPanel')?.classList.add('hidden');
    document.getElementById('liveIndicator')?.classList.add('hidden');
    
    // Reset UI elements
    const posEl = document.getElementById('livePosition');
    if (posEl) posEl.innerText = '-';
    const lastEl = document.getElementById('liveLastLap');
    if (lastEl) lastEl.innerText = '-';
    const bestEl = document.getElementById('liveBestLap');
    if (bestEl) bestEl.innerText = '-';
    const lapsEl = document.getElementById('liveLaps');
    if (lapsEl) lapsEl.innerText = '-';
    const gapEl = document.getElementById('liveGap');
    if (gapEl) { gapEl.innerText = '-'; gapEl.className = 'text-sm font-mono text-fuel'; }
    const carsEl = document.getElementById('liveTotalCars');
    if (carsEl) carsEl.innerText = '-';
    const changeEl = document.getElementById('livePositionChange');
    if (changeEl) { changeEl.innerText = ''; changeEl.className = 'text-[10px] position-same'; }
    const tableEl = document.getElementById('competitorsTable');
    if (tableEl) tableEl.innerHTML = '';
    
    // Hide demo badge
    const badge = document.getElementById('demoBadge');
    if (badge) badge.classList.add('hidden');
    
    window.updateProxyStatus("⏹️ " + window.t('stopped'));
    window.liveTimingConfig.enabled = false;
    window.stopProxyLiveTiming();
};

window.stopLiveTimingUpdates = function() {
    if (window.liveTimingInterval) {
        clearInterval(window.liveTimingInterval);
        window.liveTimingInterval = null;
    }
    window.__liveTimingStarted = false;
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
        'Fast Lane', 'Grid Warriors', 'Velocity', 'Turbo Squad',
        'Drift Kings', 'Iron Wheels', 'Storm Racing', 'Pole Hunters',
        'Circuit Wolves', 'Checkered Flag', 'Rev Limit', 'Slipstream'
    ];
    
    // Shuffle base speeds so "Your Team" isn't always P1
    const speedOffsets = teamNames.map(() => Math.random() * 3000);
    
    window.demoState.competitors = teamNames.map((name, idx) => ({
        name: name,
        position: idx + 1,
        previousPosition: idx + 1,
        laps: 0,
        lastLap: null,
        bestLap: null,
        baseLapTime: null,
        speedOffset: speedOffsets[idx],
        totalRaceTime: 0,
        pitStops: 0,
        inPit: false,
        isOurTeam: idx === 0
    }));
};

window.updateDemoData = function() {
    if (!window.liveTimingConfig.demoMode || !window.state.isRunning) return;
    
    const raceElapsed = Date.now() - window.state.startTime;
    const raceDurationMs = (window.config.duration || window.config.raceDuration || 0.5) * 3600000;
    const configPitTimeSec = window.config.pitTime || 60;
    const configStops = window.config.reqStops || window.config.stops || 2;
    
    window.demoState.competitors.forEach((comp, idx) => {
        if (!comp.baseLapTime) {
            // Base time 58-63s range with random spread per team
            comp.baseLapTime = 58000 + (comp.speedOffset || idx * 400) + (Math.random() * 500);
        }
        
        // Add per-lap variance (tire degradation, traffic, mistakes)
        const lapVariance = (Math.random() - 0.4) * 2000;
        const currentLapTime = comp.baseLapTime + lapVariance;
        
        const expectedLaps = Math.floor(raceElapsed / comp.baseLapTime);
        if (expectedLaps > comp.laps) {
            comp.laps = expectedLaps;
            comp.lastLap = currentLapTime;
            if (!comp.bestLap || comp.lastLap < comp.bestLap) comp.bestLap = comp.lastLap;
        }
        
        // Pit simulation: spread pits evenly across race, staggered per team
        const pitTimeMs = configPitTimeSec * 1000;
        const segmentLength = raceDurationMs / (configStops + 1);
        const teamOffset = idx * 15000; // 15s stagger between teams
        
        let pitsDone = 0;
        let isCurrentlyInPit = false;
        let totalPitPenalty = 0;
        
        for (let p = 1; p <= configStops; p++) {
            const pitEntryTime = (segmentLength * p) + teamOffset;
            if (raceElapsed >= pitEntryTime) {
                pitsDone++;
                const timeSincePitEntry = raceElapsed - pitEntryTime;
                if (timeSincePitEntry < pitTimeMs) {
                    isCurrentlyInPit = true;
                    totalPitPenalty += timeSincePitEntry;
                } else {
                    totalPitPenalty += pitTimeMs;
                }
            }
        }
        
        comp.pitStops = pitsDone;
        comp.inPit = isCurrentlyInPit;
        comp.totalRaceTime = (comp.laps * comp.baseLapTime) + totalPitPenalty;
    });
    
    // Sort by race progress (most laps, then least total time)
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
    
    // Update Live Data from our team
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