// ==========================================
// ⏱️ LIVE TIMING CONTROLLER
// ==========================================

function getLapWord(count) {
    // Use translation system so all 12 languages are supported automatically
    return count === 1
        ? (window.t ? window.t('lapSingular') : 'lap')
        : (window.t ? window.t('lapPlural') : 'laps');
}

function formatLapGapFromDiff(diff) {
    if (!diff || diff < 1) return '';
    return `+${diff} ${getLapWord(diff)}`;
}

function dedupeLiveCompetitors(list) {
    if (!Array.isArray(list) || list.length === 0) return [];

    // Phase 1: deduplicate by rowId (authoritative — each rowId is a unique row from the feed).
    // This prevents the crash where repeated packets for the same physical row produce
    // multiple entries at identical positions 1/2/3 when kart and name are both absent.
    const byRowId = new Map();
    for (const c of list) {
        const rid = c.rowId;
        if (!rid) continue;
        if (!byRowId.has(rid)) {
            byRowId.set(rid, c);
        } else {
            // Keep the entry with more timing data (richer packet wins)
            const prev = byRowId.get(rid);
            const score = (c.lastLap ? 1 : 0) + (c.bestLap ? 1 : 0) + ((c.laps || c.totalLaps || 0) > 0 ? 1 : 0);
            const prevScore = (prev.lastLap ? 1 : 0) + (prev.bestLap ? 1 : 0) + ((prev.laps || prev.totalLaps || 0) > 0 ? 1 : 0);
            if (score > prevScore) byRowId.set(rid, c);
        }
    }

    // Items without a rowId fall through to the secondary key pass
    const noRowId = list.filter(c => !c.rowId);

    // Phase 2: deduplicate the rowId-less items (demo mode) by kart → name → unique position slot
    const usedPositions = new Set(Array.from(byRowId.values()).map(c => c.position));
    const secondary = new Map();
    for (const c of noRowId) {
        const kartStr = String(c.kart || '').trim();
        const nameStr = String(c.name || '').trim().toUpperCase();
        // Give each position its own unique key so two entries at P1 and P2 don't collide
        const key = kartStr
            ? `kart:${kartStr}`
            : (nameStr
                ? `name:${nameStr}`
                : `pos:${parseInt(c.position, 10) || 0}:${Math.random()}`); // unique fallback
        if (!secondary.has(key)) {
            secondary.set(key, c);
        } else {
            const prev = secondary.get(key);
            const score = (c.lastLap ? 1 : 0) + (c.bestLap ? 1 : 0) + ((c.laps || c.totalLaps || 0) > 0 ? 1 : 0);
            const prevScore = (prev.lastLap ? 1 : 0) + (prev.bestLap ? 1 : 0) + ((prev.laps || prev.totalLaps || 0) > 0 ? 1 : 0);
            if (score > prevScore) secondary.set(key, c);
        }
    }

    const merged = [...byRowId.values(), ...secondary.values()];
    return merged.sort((a, b) => (a.position || 999) - (b.position || 999));
}

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
    // Pro gate check for live timing
    if (!window.checkProFeature('liveTiming')) {
        window.showProGate('Live Timing');
        return;
    }
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
    statusEl.className = "text-[10px] text-yellow-500 text-center animate-pulse";
    
    // Stop existing scraper to force fresh test
    if (window.liveTimingManager) {
        window.liveTimingManager.stop();
        window.liveTimingManager = null;
    }
    
    // Clear previous results to detect fresh data
    const prevPosition = window.liveData.position;
    window.liveData.position = null;
    
    // Start the scraper (async — data arrives via callbacks)
    window.fetchLiveTimingFromProxy();
    
    // Poll for data arrival with timeout
    let elapsed = 0;
    const pollInterval = 500;
    const maxWait = 15000; // 15 seconds
    
    const checkTimer = setInterval(() => {
        elapsed += pollInterval;
        
        if (window.liveData.position) {
            clearInterval(checkTimer);
            statusEl.innerText = `${window.t('found')} P${window.liveData.position}`;
            statusEl.className = "text-[10px] text-green-500 text-center font-bold";
            return;
        }
        
        // Update status with elapsed time
        const secs = Math.floor(elapsed / 1000);
        statusEl.innerText = `🔄 ${window.t('testing')} (${secs}s...)`;
        
        if (elapsed >= maxWait) {
            clearInterval(checkTimer);
            // Restore previous position if we had one
            if (prevPosition && !window.liveData.position) {
                window.liveData.position = prevPosition;
            }
            statusEl.innerText = window.t('notFound');
            statusEl.className = "text-[10px] text-red-500 text-center";
        }
    }, pollInterval);
};

// הפונקציה הראשית שמושכת נתונים
window.fetchLiveTimingFromProxy = async function() {
    if (!window.liveTimingConfig.url) return;
    
    // Only read from DOM if the setup inputs exist and have values
    // After refresh+continue, the inputs are empty but searchConfig is already restored
    const searchValueEl = document.getElementById('searchValue');
    if (searchValueEl && searchValueEl.value) {
        window.updateSearchConfig();
    }
    
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
    const searchType = window.searchConfig.kartNumber ? 'kart' : (window.searchConfig.driverName ? 'driver' : 'team');
    const configSignature = `${url}|${searchType}|${searchTerm}`;
    
    // Check if already running with same config - don't restart
    const stats = window.liveTimingManager.getStats();
    const scraperRunning = !!(window.liveTimingManager.currentScraper && window.liveTimingManager.currentScraper.isRunning);
    const hasSameConfig = window._liveTimingConfigSignature === configSignature;
    if (((stats && stats.isRunning) || scraperRunning) && hasSameConfig) {
        console.log('[LiveTiming] Already running, skipping restart');
        return;
    }

    if ((stats && stats.isRunning) || scraperRunning) {
        console.log('[LiveTiming] Config changed, restarting scraper');
        window.liveTimingManager.stop();
    }
    
    window.updateProxyStatus("🔄 " + window.t('connecting'));

    // התחלת הסקרייפר דרך המנהל
    window.liveTimingManager.start(url, searchTerm, {
        searchType: searchType,
        updateInterval: 2000, 
        
        onUpdate: (data) => {
            console.log('[LiveTiming] Data update:', { 
                hasOurTeam: !!data.ourTeam, 
                position: data.ourTeam?.position,
                compCount: data.competitors?.length 
            });

            window.liveData.heartbeatCount = (window.liveData.heartbeatCount || 0) + 1;
            window.liveData.heartbeatAt = Date.now();
            
            if (data.ourTeam) {
                window.liveData.previousPosition = window.liveData.position;
                window.liveData.position = data.ourTeam.position;
                window.liveData.lastLap = data.ourTeam.lastLap;
                window.liveData.bestLap = data.ourTeam.bestLap;
                window.liveData.laps = data.ourTeam.totalLaps;
                window.liveData.gapToLeader = data.ourTeam.gap;

                // === Track stint lap history for pace analysis ===
                if (data.ourTeam.lastLap && data.ourTeam.lastLap > 0 && data.ourTeam.lastLap !== window.liveData.lastRecordedLap) {
                    window.liveData.lastRecordedLap = data.ourTeam.lastLap;
                    if (!window.liveData.stintLapHistory) window.liveData.stintLapHistory = [];
                    window.liveData.stintLapHistory.push(data.ourTeam.lastLap);
                    // Update stint best
                    if (!window.liveData.stintBestLap || data.ourTeam.lastLap < window.liveData.stintBestLap) {
                        window.liveData.stintBestLap = data.ourTeam.lastLap;
                    }
                }

                // === Pit status from live timing ===
                const wasInPit = window.liveData.ourTeamInPit;
                window.liveData.ourTeamInPit = !!data.ourTeam.inPit;
                const prevPitCount = window.liveData.ourTeamPitCount;
                window.liveData.ourTeamPitCount = data.ourTeam.pitCount ?? null;

                // Auto-detect pit entry from live timing — AUTHORITATIVE: live timing always wins
                const now = Date.now();

                if (window.state && window.state.isRunning && !window.state.isInPit && data.ourTeam.inPit) {
                    // Live timing says we are in pit — override everything
                    console.log('[LiveTiming] 🛑 AUTHORITATIVE PIT ENTRY from live data (inPit=true)');
                    if (typeof window.confirmPitEntry === 'function') {
                        window.confirmPitEntry(true); // true = auto-detected, skip confirm dialog
                        window._driverPitIntent = null;
                    }
                }
                // Fallback: detect pit entry from pitCount increase (catches cases where inPit flag was missed between polls)
                else if (window.state && window.state.isRunning && !window.state.isInPit
                    && prevPitCount != null && data.ourTeam.pitCount != null
                    && data.ourTeam.pitCount > prevPitCount) {
                    console.log(`[LiveTiming] 🛑 PIT ENTRY detected via pitCount increase (${prevPitCount} → ${data.ourTeam.pitCount})`);
                    window.liveData.ourTeamInPit = true; // Force so exit detection works
                    window.liveData._pitEntryForcedAt = now; // Track when we forced entry
                    if (typeof window.confirmPitEntry === 'function') {
                        window.confirmPitEntry(true);
                        window._driverPitIntent = null;
                    }
                }
                // Auto-detect pit exit from live timing — AUTHORITATIVE
                if (window.state && window.state.isRunning && window.state.isInPit && !data.ourTeam.inPit && wasInPit === true) {
                    // Guard: don't auto-exit if pit time is too short (< 20s) — prevents false exits from pitCount fallback
                    const pitElapsed = window.state.pitStart ? (now - window.state.pitStart) : Infinity;
                    if (pitElapsed >= 20000) {
                        console.log('[LiveTiming] ✅ AUTHORITATIVE PIT EXIT from live data');
                        // Reset stint lap tracking for new stint
                        window.liveData.stintLapHistory = [];
                        window.liveData.stintBestLap = null;
                        window.liveData.lastRecordedLap = null;
                        if (typeof window.confirmPitExit === 'function') {
                            window.confirmPitExit(true); // true = auto-detected from live timing
                            window._driverPitIntent = null;
                        }
                    } else {
                        console.log(`[LiveTiming] ⏳ Pit exit suppressed — only ${Math.round(pitElapsed/1000)}s in pit (min 20s)`);
                    }
                }
                
                // === Penalty detection from live timing ===
                const prevPenalty = window.liveData.ourTeamPenalty || 0;
                const newPenalty = data.ourTeam.penalty || 0;
                const newPenaltyTime = data.ourTeam.penaltyTime || 0;
                window.liveData.ourTeamPenalty = newPenalty;
                window.liveData.ourTeamPenaltyTime = newPenaltyTime;
                
                // Detect new penalty (penalty count increased)
                if (newPenalty > prevPenalty && window.state && window.state.isRunning) {
                    const penaltyMsg = data.ourTeam.penaltyReason || '';
                    console.log(`[LiveTiming] ⚠️ PENALTY DETECTED: count=${newPenalty}, time=${newPenaltyTime}s, reason="${penaltyMsg}"`);
                    
                    // Notify admin via strategy notification
                    if (typeof window._fireStrategyNotification === 'function') {
                        const msg = `⚠️ PENALTY! ${newPenaltyTime > 0 ? `${newPenaltyTime} Lap` : ''} ${penaltyMsg}`;
                        window._fireStrategyNotification(msg, 'warning');
                    }
                    
                    // Auto-adjust pit time if penalty has a time component
                    if (newPenaltyTime > 0 && typeof window.adjustPitTime === 'function') {
                        const addedSec = newPenaltyTime;
                        window.adjustPitTime(addedSec);
                        console.log(`[LiveTiming] ⏱️ Auto-adjusted pit time by +${addedSec}s for penalty`);
                        if (typeof window._fireStrategyNotification === 'function') {
                            window._fireStrategyNotification(`⏱️ Pit time adjusted +${addedSec}s for penalty`, 'info');
                        }
                    }
                    
                    // Play alert sound
                    if (typeof window.playAlertBeep === 'function') {
                        window.playAlertBeep('warning');
                    }
                }
            }
            window.liveData.competitors = dedupeLiveCompetitors(data.competitors || []);

            // === Race time from live timing (RaceFacer provides timeLeftSeconds) ===
            if (data.race && data.race.timeLeftSeconds != null) {
                window.liveData.raceTimeLeftMs = data.race.timeLeftSeconds * 1000;
                // Store the timestamp when we received this so we can count down locally between API updates
                window.liveData._raceTimeReceivedAt = Date.now();
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
        },

        onComment: (entry) => {
            console.log(`[LiveTiming] 💬 Race comment: ${entry.text}`);
            if (typeof window.showToast === 'function') {
                window.showToast(`📢 ${entry.text}`, 'info', 8000);
            }
            // Also fire as strategy notification if race is running
            if (window.state && window.state.isRunning && typeof window._fireStrategyNotification === 'function') {
                window._fireStrategyNotification(`📢 ${entry.text}`, 'info');
            }
        }
    });

    window._liveTimingConfigSignature = configSignature;
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
    // Always use '.' internally then substitute locale decimal separator for display
    const sec = (totalSec % 60).toFixed(3).padStart(6, '0');
    const decSep = window.t ? window.t('numDecSep') : '.';
    return `${min}:${decSep !== '.' ? sec.replace('.', decSep) : sec}`;
};

window.updateLiveTimingUI = function() {
    // Always show widget if we have data, regardless of enabled flag
    const hasData = window.liveData && (window.liveData.position || window.liveData.competitors.length > 0);

    const wrapper = document.getElementById('liveTimingWidgetWrapper');
    const indicator = document.getElementById('liveIndicator');

    if (hasData || window.liveTimingConfig.enabled) {
        if (wrapper) wrapper.classList.remove('hidden');
        if (indicator) indicator.classList.remove('hidden');
    }
    // panel is always visible inside wrapper — no need to show/hide it directly
    const panel = document.getElementById('liveTimingPanel');

    const heartbeatEl = document.getElementById('liveHeartbeat');
    if (heartbeatEl) {
        const count = window.liveData.heartbeatCount || 0;
        const ageMs = window.liveData.heartbeatAt ? (Date.now() - window.liveData.heartbeatAt) : null;
        const ageSec = ageMs == null ? '--' : Math.floor(ageMs / 1000);
        heartbeatEl.innerText = `HB ${count} (${ageSec}s)`;
        heartbeatEl.className = ageMs != null && ageMs > 7000
            ? 'text-[10px] text-red-400'
            : 'text-[10px] text-gray-400';
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
    
    // Update gap to leader — use lap count difference
    const gapEl = document.getElementById('liveGap');
    if (gapEl) {
        if (window.liveData.position === 1) {
            gapEl.innerText = window.t ? window.t('leaderLabel') : 'LEADER';
            gapEl.className = 'text-sm font-mono text-gold';
        } else {
            // Compute lap-based gap from competitors data
            const comps = window.liveData.competitors || [];
            const leader = comps.find(c => c.position === 1);
            const ourLaps = window.liveData.laps || 0;
            const leaderLaps = leader ? (leader.laps || leader.totalLaps || 0) : 0;
            const lapDiff = leaderLaps - ourLaps;
            const decSep = window.t ? window.t('numDecSep') : '.';
            if (lapDiff >= 1) {
                gapEl.innerText = formatLapGapFromDiff(lapDiff);
                gapEl.className = 'text-sm font-mono text-fuel';
            } else if (window.liveData.gapToLeader) {
                const gapSec = (window.liveData.gapToLeader / 1000).toFixed(1);
                const gapStr = decSep !== '.' ? gapSec.replace('.', decSep) : gapSec;
                gapEl.innerText = `+${gapStr}s`;
                gapEl.className = 'text-sm font-mono text-fuel';
            } else {
                gapEl.innerText = '-';
                gapEl.className = 'text-sm font-mono text-fuel';
            }
        }
    }
    
    // Update total cars count
    const totalCarsEl = document.getElementById('liveTotalCars');
    if (totalCarsEl && window.liveData.competitors) {
        totalCarsEl.innerText = dedupeLiveCompetitors(window.liveData.competitors).length || '-';
    }
    
    window.updateCompetitorsTable();

    // ---- Competitor table header: show/hide based on whether we have sector data ----
    const tableHeader = document.getElementById('competitorsTableHeader');
    if (tableHeader) {
        const hasSectors = (window.liveData.competitors || []).some(c => c.sector1 || c.sector2);
        tableHeader.style.display = hasSectors ? 'grid' : 'none';
    }

    // ---- Update right-zone widget: stint average for our team ----
    const wStintAvgEl = document.getElementById('wStintAvg');
    if (wStintAvgEl) {
        const hist = window.liveData.stintLapHistory || [];
        if (hist.length > 0) {
            const stintAvgMs = Math.round(hist.reduce((a, b) => a + b, 0) / hist.length);
            const overallAvgMs = window.liveData.avgLap || 0;
            wStintAvgEl.textContent = window.formatLapTime(stintAvgMs);
            // Trend vs overall
            if (overallAvgMs > 0) {
                if (stintAvgMs < overallAvgMs * 0.998) {
                    wStintAvgEl.className = 'stint-avg-badge improving';
                } else if (stintAvgMs > overallAvgMs * 1.002) {
                    wStintAvgEl.className = 'stint-avg-badge degrading';
                } else {
                    wStintAvgEl.className = 'stint-avg-badge';
                }
            }
        } else {
            // Fall back to demo stintAvgLap for our team competitor
            const ourComp = (window.liveData.competitors || []).find(c => c.isOurTeam);
            if (ourComp && ourComp.stintAvgLap) {
                wStintAvgEl.textContent = window.formatLapTime(ourComp.stintAvgLap);
                wStintAvgEl.className = 'stint-avg-badge';
            } else {
                wStintAvgEl.textContent = '--:--.---';
                wStintAvgEl.className = 'stint-avg-badge';
            }
        }
    }
};

window.updateCompetitorsTable = function() {
    const tableEl = document.getElementById('competitorsTable');
    if (!tableEl) return;

    // ---- Stable data: cache last known so table never flickers ----
    const fresh = window.liveData.competitors;
    if (fresh && fresh.length > 0) {
        window._lastKnownCompetitors = fresh;
    }
    const allCompetitors = dedupeLiveCompetitors(window._lastKnownCompetitors);
    if (!allCompetitors || allCompetitors.length === 0) {
        tableEl.innerHTML = `<div class="text-gray-500 text-center py-2">${window.t('waitingData')}</div>`;
        return;
    }

    // ---- Auto-refocus state (once) ----
    if (!window._ltScroll) {
        window._ltScroll = { userScrolled: false, refocusTimer: null };
        tableEl.addEventListener('scroll', () => {
            if (window._ltScroll._programmaticScroll) return;
            window._ltScroll.userScrolled = true;
        }, { passive: true });
    }

    const totalRows = allCompetitors.length;
    const goodPaceThreshold = window._calcGoodPaceThreshold(allCompetitors);

    // ---- Update kart performance tracking ----
    window._updateKartStats(allCompetitors);

    // ---- Stable DOM: only rebuild when row count changes ----
    const existingRows = tableEl.querySelectorAll('.competitor-row');
    if (existingRows.length !== totalRows) {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < totalRows; i++) {
            const row = document.createElement('div');
            row.className = 'competitor-row';
            row.dataset.compIdx = i;
            row.innerHTML = `<div class="cr-left">
<span class="cr-pos"></span><span class="cr-kart"></span><span class="cr-cat"></span><span class="cr-name"></span><span class="cr-badges"></span>
</div><div class="cr-right">
<span class="cr-laps"></span><span class="cr-pits"></span><span class="cr-gap"></span><span class="cr-int"></span><span class="cr-lap"></span><span class="cr-avg"></span>
</div>`;
            frag.appendChild(row);
        }
        tableEl.textContent = ''; // clear without layout thrash
        tableEl.appendChild(frag);
    }

    const ourTeam = allCompetitors.find(c => c.isOurTeam);
    const rows = tableEl.querySelectorAll('.competitor-row');
    let ourTeamRow = null;

    allCompetitors.forEach((comp, idx) => {
        const row = rows[idx];
        if (!row) return;

        const isUs = comp.isOurTeam;
        if (isUs) ourTeamRow = row;

        const isDanger = !isUs && window.liveData.position && Math.abs(comp.position - window.liveData.position) <= 2;
        const isGoodPace = !isUs && goodPaceThreshold && comp.bestLap && comp.bestLap <= goodPaceThreshold;
        const isPB = comp.lastLap && comp.bestLap && comp.lastLap > 0 && comp.lastLap <= comp.bestLap;
        const kartKey = comp.kart || '';
        const isTopKart = kartKey && window._fastKarts && window._fastKarts.has(kartKey);

        // ---- Row class (only update if changed) ----
        let rowCls = 'competitor-row';
        if (isUs) rowCls += ' our-team';
        else if (isDanger) rowCls += ' danger-zone';
        if (row.className !== rowCls) row.className = rowCls;

        // ---- Position ----
        const posEl = row.querySelector('.cr-pos');
        if (posEl) {
            const posTxt = String(comp.position);
            if (posEl.textContent !== posTxt) posEl.textContent = posTxt;
            let posCls = 'cr-pos';
            if (comp.position === 1) posCls += ' p1';
            else if (comp.position === 2) posCls += ' p2';
            else if (comp.position === 3) posCls += ' p3';
            else posCls += ' text-gray-400';
            if (posEl.className !== posCls) posEl.className = posCls;
        }

        // ---- Kart number ----
        const kartEl = row.querySelector('.cr-kart');
        if (kartEl) {
            const kartTxt = kartKey ? `#${kartKey}` : '';
            if (kartEl.textContent !== kartTxt) kartEl.textContent = kartTxt;
            let kartCls = 'cr-kart';
            if (isTopKart) kartCls += ' fast-kart';
            if (kartEl.className !== kartCls) kartEl.className = kartCls;
        }

        // ---- Category badge (GOLD / SILVER / etc.) ----
        const catEl = row.querySelector('.cr-cat');
        if (catEl) {
            const catVal = (comp.category || '').trim().toUpperCase();
            if (catEl.textContent !== catVal) catEl.textContent = catVal;
            let catCls = 'cr-cat';
            if (catVal === 'GOLD') catCls += ' cat-gold';
            else if (catVal === 'SILVER') catCls += ' cat-silver';
            else if (catVal === 'BRONZE') catCls += ' cat-bronze';
            else if (catVal) catCls += ' cat-other';
            if (catEl.className !== catCls) catEl.className = catCls;
        }

        // ---- Name (rotate team ↔ driver every 5s; Pro: show logo for our team) ----
        const nameEl = row.querySelector('.cr-name');
        if (nameEl) {
            const teamStr = (comp.team || '').trim();
            const driverStr = (comp.name || '').trim();

            // Pro logo: only for our team and only when a logo is stored
            if (isUs && typeof window._getTeamLogoHtml === 'function') {
                const logoHtml = window._getTeamLogoHtml(true);
                if (logoHtml) {
                    if (nameEl.innerHTML !== logoHtml) nameEl.innerHTML = logoHtml;
                    const nameCls = 'cr-name text-ice font-bold';
                    if (nameEl.className !== nameCls) nameEl.className = nameCls;
                    nameEl.removeAttribute('data-text');
                } else {
                    const displayName = teamStr || driverStr;
                    if (nameEl.textContent !== displayName) nameEl.textContent = displayName;
                    const nameCls = 'cr-name text-ice font-bold';
                    if (nameEl.className !== nameCls) nameEl.className = nameCls;
                }
            } else {
                const cycleMs = 5000;
                const showDriver = teamStr && driverStr && teamStr !== driverStr
                    ? (Date.now() % cycleMs) > 3000
                    : false;
                const displayName = showDriver ? driverStr : (teamStr || driverStr);
                if (nameEl.textContent !== displayName) nameEl.textContent = displayName;

                // Adaptive font size based on name length
                const len = displayName.length;
                let nameCls = isUs ? 'cr-name text-ice font-bold' : 'cr-name';
                if (len > 18) nameCls += ' name-xlong';
                else if (len > 13) nameCls += ' name-long';
                if (nameEl.className !== nameCls) nameEl.className = nameCls;
            }

            // Marquee: apply if text is wider than the cell (checked lazily)
            requestAnimationFrame(() => {
                if (!nameEl || !nameEl.parentElement) return;
                const overflow = nameEl.scrollWidth > nameEl.clientWidth + 2;
                if (overflow) {
                    const dist = -(nameEl.scrollWidth - nameEl.clientWidth + 4);
                    nameEl.style.setProperty('--marquee-dist', dist + 'px');
                    // Only add marquee class on hover row or our-team row to avoid distraction
                    if (isUs) nameEl.classList.add('name-marquee-active');
                }
            });
        }

        // ---- Badges (pit + penalty + top 3 lap) ----
        const badgesEl = row.querySelector('.cr-badges');
        if (badgesEl) {
            let badges = '';
            if (comp.inPit) badges += `<span class="badge-pit">${window.t ? window.t('pitLabel') : 'PIT'}</span>`;
            const penaltyVal = comp.penalty || comp.penaltyTime || 0;
            if (penaltyVal > 0) {
                const penLabel = comp.penaltyTime ? `${comp.penaltyTime} Lap` : '';
                const reason = (comp.penaltyReason || 'Penalty').replace(/"/g, '&quot;');
                badges += `<span class="badge-penalty" title="${reason}" style="background:rgba(239,68,68,0.3);color:#f87171;font-size:8px;padding:0 3px;border-radius:2px;margin-left:2px;">⚠${penLabel}</span>`;
            }
            // Only show ⚡ for top 3 fastest best-lap karts, not all "good pace"
            if (comp.position <= 3 && isPB) badges += '<span class="badge-fast" title="Top 3">⚡</span>';
            if (badgesEl.innerHTML !== badges) badgesEl.innerHTML = badges;
        }

        // ---- Gap from P1 (lap-count based) ----
        const gapEl = row.querySelector('.cr-gap');
        if (gapEl) {
            const decSep = window.t ? window.t('numDecSep') : '.';
            let gapHTML = '';
            if (comp.position === 1) {
                const leaderLbl = window.t ? window.t('leaderLabel') : 'P1';
                gapHTML = `<span class="text-gold">${leaderLbl}</span>`;
            } else {
                const leader = allCompetitors.find(c => c.position === 1);
                const leaderLaps = leader ? (leader.laps || leader.totalLaps || 0) : 0;
                const compLaps = comp.laps || comp.totalLaps || 0;
                const lapDiff = leaderLaps - compLaps;
                const gapMs = comp.gap ?? comp.gapToLeader ?? 0;

                // Determine color relative to our team
                const ourLaps = ourTeam ? (ourTeam.laps || ourTeam.totalLaps || 0) : null;
                const ourLapDiff = ourLaps != null ? (leaderLaps - ourLaps) : null;
                let color = 'gap-neutral';
                if (ourLapDiff != null) {
                    if (lapDiff > ourLapDiff) color = 'gap-behind';
                    else if (lapDiff < ourLapDiff) color = 'gap-ahead';
                    else if (lapDiff === ourLapDiff) {
                        const ourGapMs = ourTeam ? (ourTeam.gap ?? ourTeam.gapToLeader ?? 0) : 0;
                        if (gapMs > ourGapMs) color = 'gap-behind';
                        else if (gapMs < ourGapMs) color = 'gap-ahead';
                        else color = 'gap-us';
                    }
                }

                if (lapDiff >= 1) {
                    const gapStr = formatLapGapFromDiff(lapDiff);
                    gapHTML = `<span class="${color}">${gapStr}</span>`;
                } else if (gapMs > 0) {
                    const sec = gapMs / 1000;
                    const secStr = decSep !== '.' ? sec.toFixed(1).replace('.', decSep) : sec.toFixed(1);
                    gapHTML = `<span class="${color}">+${secStr}s</span>`;
                }
            }
            if (gapEl.innerHTML !== gapHTML) gapEl.innerHTML = gapHTML;
        }

        // ---- Interval (gap to car ahead) — lap-count based ----
        const intEl = row.querySelector('.cr-int');
        if (intEl) {
            const decSep = window.t ? window.t('numDecSep') : '.';
            let intHTML = '';
            if (comp.position !== 1) {
                const carAhead = allCompetitors.find(c => c.position === comp.position - 1);
                const aheadLaps = carAhead ? (carAhead.laps || carAhead.totalLaps || 0) : 0;
                const compLaps = comp.laps || comp.totalLaps || 0;
                const intLapDiff = aheadLaps - compLaps;
                const intMs = comp.interval ?? 0;

                if (intLapDiff >= 1) {
                    intHTML = `<span class="text-gray-500">${formatLapGapFromDiff(intLapDiff).replace('+', '')}</span>`;
                } else if (intMs > 0) {
                    const intSec = intMs / 1000;
                    const intStr = decSep !== '.' ? intSec.toFixed(1).replace('.', decSep) : intSec.toFixed(1);
                    intHTML = `<span class="text-gray-500">${intStr}s</span>`;
                }
            }
            if (intEl.innerHTML !== intHTML) intEl.innerHTML = intHTML;
        }

        // ---- Laps count ----
        const lapsRowEl = row.querySelector('.cr-laps');
        if (lapsRowEl) {
            const lapCount = comp.laps || comp.totalLaps || '';
            const lapsTxt = lapCount ? `${lapCount}` : '';
            if (lapsRowEl.textContent !== lapsTxt) lapsRowEl.textContent = lapsTxt;
        }

        // ---- Pit count ----
        const pitsEl = row.querySelector('.cr-pits');
        if (pitsEl) {
            const pitCount = comp.pitCount ?? 0;
            const pitsTxt = pitCount > 0 ? `P${pitCount}` : '';
            if (pitsEl.textContent !== pitsTxt) pitsEl.textContent = pitsTxt;
        }

        // ---- Last lap + personal best glow ----
        const lapEl = row.querySelector('.cr-lap');
        if (lapEl) {
            const lapTxt = comp.lastLap ? window.formatLapTime(comp.lastLap) : '';
            if (lapEl.textContent !== lapTxt) lapEl.textContent = lapTxt;
            const lapCls = isPB ? 'cr-lap lap-pb' : 'cr-lap';
            if (lapEl.className !== lapCls) lapEl.className = lapCls;
        }

        // ---- Avg lap (per-stint preferred; fall back to overall) ----
        const avgEl = row.querySelector('.cr-avg');
        if (avgEl) {
            // Use per-stint average when available (demo mode sets stintAvgLap)
            const stintAvgMs = comp.stintAvgLap || 0;
            const avgMs = stintAvgMs > 0 ? stintAvgMs : (comp.avgLap || 0);
            const avgTxt = avgMs > 0 ? window.formatLapTime(avgMs) : '';
            if (avgEl.textContent !== avgTxt) avgEl.textContent = avgTxt;
            // Trend: compare stint avg to overall avg to detect degradation
            let avgCls = 'cr-avg';
            if (stintAvgMs > 0 && comp.avgLap > 0) {
                if (stintAvgMs < comp.avgLap * 0.998) avgCls += ' avg-improving';
                else if (stintAvgMs > comp.avgLap * 1.002) avgCls += ' avg-degrading';
            }
            if (avgEl.className !== avgCls) avgEl.className = avgCls;
        }
    });

    // ---- Update kart ranking mini-panel ----
    window._updateKartRankingPanel();
};

// ==================== KART PERFORMANCE TRACKING ====================
window._kartStatsMap = window._kartStatsMap || {};
window._fastKarts = window._fastKarts || new Set();

window._updateKartStats = function(competitors) {
    if (!competitors || competitors.length === 0) return;
    const stats = window._kartStatsMap;

    competitors.forEach(c => {
        const kart = (c.kart || '').trim();
        if (!kart) return;

        if (!stats[kart]) {
            stats[kart] = { bestLapMs: Infinity, recentLaps: [], team: '', pos: 0, laps: 0, inPit: false, pitCount: 0 };
        }
        const s = stats[kart];
        s.team = c.team || c.name || s.team;
        s.pos = c.position || s.pos;
        s.laps = c.laps || c.totalLaps || s.laps;
        s.inPit = !!c.inPit;
        if (c.pitCount != null) s.pitCount = c.pitCount;

        if (c.bestLap && c.bestLap > 0 && c.bestLap < s.bestLapMs && c.bestLap >= 20000 && c.bestLap <= 180000) {
            s.bestLapMs = c.bestLap;
        }
        if (c.lastLap && c.lastLap > 0 && c.lastLap >= 20000 && c.lastLap <= 180000) {
            s.recentLaps.push(c.lastLap);
            if (s.recentLaps.length > 30) s.recentLaps.shift();
        }
    });

    // Determine fast karts: within 101.5% of the best kart's best lap
    let bestKartLap = Infinity;
    Object.values(stats).forEach(s => {
        if (s.bestLapMs < bestKartLap) bestKartLap = s.bestLapMs;
    });
    const threshold = bestKartLap < Infinity ? bestKartLap * 1.015 : null;
    const fastSet = new Set();
    if (threshold) {
        Object.entries(stats).forEach(([kart, s]) => {
            if (s.bestLapMs <= threshold) fastSet.add(kart);
        });
    }
    window._fastKarts = fastSet;
};

// Foldable state for kart panel (persisted in session)
if (window._kartPanelOpen == null) window._kartPanelOpen = true;

window._toggleKartPanel = function() {
    window._kartPanelOpen = !window._kartPanelOpen;
    const body = document.getElementById('kartRankingBody');
    const arrow = document.getElementById('kartRankingArrow');
    if (body) body.style.display = window._kartPanelOpen ? '' : 'none';
    if (arrow) arrow.textContent = window._kartPanelOpen ? '▾' : '▸';
};

window._updateKartRankingPanel = function() {
    const panel = document.getElementById('kartRankingPanel');
    if (!panel) return;
    const stats = window._kartStatsMap;
    const entries = Object.entries(stats).filter(([, s]) => s.bestLapMs < Infinity);
    if (entries.length === 0) { panel.classList.add('hidden'); return; }

    panel.classList.remove('hidden');
    entries.sort((a, b) => a[1].bestLapMs - b[1].bestLapMs);
    const top = entries.slice(0, 5);
    const ourKart = window.liveData.competitors?.find(c => c.isOurTeam)?.kart || '';

    const arrowChar = window._kartPanelOpen ? '▾' : '▸';
    const bodyDisplay = window._kartPanelOpen ? '' : 'display:none;';
    const topKartsTitle = window.t ? window.t('topKartsTitle') : 'TOP KARTS';
    let html = `<div class="kart-panel-header" onclick="window._toggleKartPanel()">`;
    html += `<span>🏎️ ${topKartsTitle}</span><span id="kartRankingArrow">${arrowChar}</span></div>`;
    html += `<div id="kartRankingBody" style="${bodyDisplay}">`;
    top.forEach(([kart, s]) => {
        const isFast = window._fastKarts.has(kart);
        const isOurs = kart === ourKart;
        const avg = s.recentLaps.length >= 3
            ? (s.recentLaps.slice(-5).reduce((a, b) => a + b, 0) / Math.min(s.recentLaps.length, 5))
            : null;
        const avgStr = avg ? window.formatLapTime(Math.round(avg)) : '-';
        const cls = isOurs ? 'text-ice font-bold' : isFast ? 'text-neon' : 'text-gray-400';
        const pitInfo = s.pitCount > 0 ? `<span class="text-[8px] text-fuel"> P${s.pitCount}</span>` : '';
        html += `<div class="flex justify-between items-center text-[10px] ${cls}">`;
        html += `<span>#${kart} <span class="text-[9px] text-gray-500">${s.team.substring(0, 12)}</span>${pitInfo}</span>`;
        html += `<span>${window.formatLapTime(s.bestLapMs)} <span class="text-[9px] text-gray-600">(avg ${avgStr})</span></span>`;
        html += `</div>`;
    });
    html += `</div>`;
    panel.innerHTML = html;
};

// Scroll to our team row in competitors table
window._scrollToOurTeamRow = function() {
    const tableEl = document.getElementById('competitorsTable');
    if (!tableEl) return;
    const ourRow = tableEl.querySelector('.our-team');
    if (!ourRow) return;

    window._ltScroll._programmaticScroll = true;
    ourRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => { if (window._ltScroll) window._ltScroll._programmaticScroll = false; }, 500);
};

// Calculate good pace threshold: competitors whose best lap is within 102% of the overall best
window._calcGoodPaceThreshold = function(competitors) {
    if (!competitors || competitors.length < 2) return null;

    let overallBest = Infinity;
    competitors.forEach(c => {
        if (c.bestLap && c.bestLap > 0 && c.bestLap < overallBest) {
            overallBest = c.bestLap;
        }
    });

    if (overallBest === Infinity) return null;
    return overallBest * 1.02;
};

window.scrollToOurTeam = function() {
    if (window._ltScroll) {
        window._ltScroll.userScrolled = false;
        if (window._ltScroll.refocusTimer) clearTimeout(window._ltScroll.refocusTimer);
    }
    window._scrollToOurTeamRow();
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
        // Re-initialize demo competitors if empty (e.g. after page refresh)
        if (!window.demoState.competitors || window.demoState.competitors.length === 0) {
            window.initializeDemoCompetitors();
        }
        if (window.liveTimingDemoTimer) clearTimeout(window.liveTimingDemoTimer);
        const scheduleDemoTick = () => {
            if (!window.__liveTimingStarted || !window.liveTimingConfig.demoMode) return;
            window.updateDemoData();
            const nextDelay = 750 + Math.floor(Math.random() * 550); // jitter for production-like cadence
            window.liveTimingDemoTimer = setTimeout(scheduleDemoTick, nextDelay);
        };
        scheduleDemoTick();
    } else if (window.liveTimingConfig.url) {
        window.startProxyLiveTiming();
    }
};

window.toggleApexIframe = function() {
    const iframeContainer = document.getElementById('apexIframeContainer');
    const tableContainer = document.getElementById('competitorsTable');
    const statsGrids = document.querySelectorAll('#liveTimingPanel .grid');
    const btn = document.getElementById('apexViewToggle');
    if (!iframeContainer) return;

    const showingIframe = !iframeContainer.classList.contains('hidden');

    if (showingIframe) {
        // Switch back to data view
        iframeContainer.classList.add('hidden');
        if (tableContainer) tableContainer.classList.toggle('hidden', window._competitorsTableOpen === false);
        if (btn) {
            btn.textContent = '🌐';
            btn.classList.remove('bg-ice', 'text-navy-900');
            btn.classList.add('bg-navy-700', 'text-gray-300');
        }
    } else {
        // Switch to iframe view — lazy-load the URL
        const iframeEl = document.getElementById('apexIframe');
        const url = window.liveTimingConfig && window.liveTimingConfig.url;
        if (iframeEl && url && !iframeEl.getAttribute('src')) {
            iframeEl.setAttribute('src', url);
        }
        iframeContainer.classList.remove('hidden');
        if (tableContainer) tableContainer.classList.add('hidden');
        if (btn) {
            btn.textContent = '📊';
            btn.classList.remove('bg-navy-700', 'text-gray-300');
            btn.classList.add('bg-ice', 'text-navy-900');
        }
    }
};

window.stopLiveTiming = function() {
    if (window.liveTimingManager) {
        window.liveTimingManager.stop();
        window.liveTimingManager = null;
    }
    if (window.liveTimingDemoTimer) {
        clearTimeout(window.liveTimingDemoTimer);
        window.liveTimingDemoTimer = null;
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
        laps: 0, gapToLeader: 0, competitors: [], heartbeatCount: 0, heartbeatAt: null
    };
    
    // Reset caches
    window._lastKnownCompetitors = null;
    window._kartStatsMap = {};
    window._fastKarts = new Set();
    
    // Reset demo state
    window.demoState = { competitors: [], updateInterval: null };
    
    document.getElementById('liveTimingWidgetWrapper')?.classList.add('hidden');
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
    const heartbeatEl = document.getElementById('liveHeartbeat');
    if (heartbeatEl) { heartbeatEl.innerText = 'HB --'; heartbeatEl.className = 'text-[10px] text-gray-400'; }
    const tableEl = document.getElementById('competitorsTable');
    if (tableEl) tableEl.innerHTML = '';
    const kartPanel = document.getElementById('kartRankingPanel');
    if (kartPanel) { kartPanel.innerHTML = ''; kartPanel.classList.add('hidden'); }
    
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
    if (window.liveTimingDemoTimer) {
        clearTimeout(window.liveTimingDemoTimer);
        window.liveTimingDemoTimer = null;
    }
    window.__liveTimingStarted = false;
    window.stopProxyLiveTiming();
};

// ==================== DEMO MODE ====================

window.startDemoMode = function() {
    window.liveTimingConfig.demoMode = true;
    window.liveTimingConfig.enabled = true;

    // Read feature config from demo chooser (defaults to all on)
    const cfg = window.demoConfig || { rain: true, penalties: true, tires: true };

    // Initialize rain simulation state (only if rain feature enabled)
    if (cfg.rain) {
        window.demoState.rain = {
            active: false,
            intensity: 0,
            drying: false,
            nextEventTime: 0,
            lastChangeTime: 0,
            paceMultiplier: 1.0
        };
        window.demoState.rain.nextEventTime = 120000 + Math.random() * 240000;
    } else {
        window.demoState.rain = { active: false, intensity: 0, drying: false, nextEventTime: Infinity, lastChangeTime: 0, paceMultiplier: 1.0 };
    }

    window.initializeDemoCompetitors();
    window.demoState.nextCommentAt = 45000 + Math.random() * 45000;
    
    const statusEl = document.getElementById('liveTimingStatus');
    if (statusEl) {
        statusEl.innerText = "🎮 Demo Mode Active";
        statusEl.className = "text-[10px] text-neon text-center font-bold";
    }
};

window.initializeDemoCompetitors = function() {
    const baseTeamNames = [
        'Your Team', 'Racing Stars', 'Speed Demons', 'Track Masters',
        'Nitro Force', 'Apex Racing', 'Thunder Karts', 'Pro Racers',
        'Fast Lane', 'Grid Warriors', 'Velocity', 'Turbo Squad',
        'Drift Kings', 'Iron Wheels', 'Storm Racing', 'Pole Hunters',
        'Circuit Wolves', 'Checkered Flag', 'Rev Limit', 'Slipstream'
    ];
    const requestedGrid = Math.max(8, Math.min(40, parseInt(window.demoConfig?.gridSize || 20, 10)));
    const teamNames = Array.from({ length: requestedGrid }, (_, idx) => {
        if (idx < baseTeamNames.length) return baseTeamNames[idx];
        return `Team ${idx + 1}`;
    });

    const raceDurationMs = (window.config.duration || window.config.raceDuration || 0.5) * 3600000;
    const configStops = window.config.reqStops || window.config.stops || 2;
    const configPitTimeSec = window.config.pitTime || 60;
    const stintCount = configStops + 1;

    // Seeded-random helper for deterministic per-team variety
    const rng = (seed) => { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

    window.demoState.competitors = teamNames.map((name, idx) => {
        const r = rng(idx * 7919 + 42);

        // Base pace: 58–63s, tighter spread = more realistic endurance
        const basePace = 58000 + r() * 5000;
        // Consistency: some teams are very consistent, others vary a lot
        const consistency = 300 + r() * 1500; // ms standard deviation per lap

        // Pre-plan pit windows: evenly spaced stints with per-team jitter
        const pitEntryTimes = [];
        for (let p = 1; p <= configStops; p++) {
            const idealTime = (raceDurationMs / stintCount) * p;
            const jitter = (r() - 0.5) * 60000; // ±30s random offset
            pitEntryTimes.push(Math.max(60000, idealTime + jitter));
        }
        pitEntryTimes.sort((a, b) => a - b);

        // Rain skill: 1.0 = no penalty in rain, higher = slower in wet
        // Some teams are much better in rain than others (karting is very sensitive to rain)
        const rainSkill = 1.0 + r() * 0.06; // 0–6% additional slowdown in wet

        return {
            name, kart: String(10 + idx), isOurTeam: idx === 0,
            position: idx + 1, previousPosition: idx + 1,
            basePace, consistency, pitEntryTimes,
            pitTimeMs: configPitTimeSec * 1000,
            rainSkill,
            // Cumulative state — built lap-by-lap
            lapTimes: [],       // every completed lap (ms)
            lastLap: null,
            bestLap: null,
            laps: 0,
            elapsed: 0,         // total elapsed time including pits (ms)
            pitsDone: 0,
            pitTimeSpent: 0,    // total ms spent in pits so far
            inPit: false,
            gapToLeader: 0,
            pitCount: 0,
            _lastSimTime: 0     // last wall-clock we simulated up to
        };
    });
    window.demoState.safetyCar = {
        active: false,
        nextEventAt: 180000 + Math.random() * 240000,
        until: 0
    };
    window.demoState.nextCommentAt = 45000 + Math.random() * 45000;
};

/**
 * Core demo engine: advances each competitor lap-by-lap up to current wall time.
 * Positions and gaps are derived from elapsed time (driving + pits).
 */
window.updateDemoData = function() {
    if (!window.liveTimingConfig.demoMode || !window.state.isRunning) return;

    const now = Date.now();
    const raceStart = window.state.startTime;
    const raceElapsed = now - raceStart;
    const raceMs = window.config.raceMs || (parseFloat(window.config.duration) * 3600000);
    const chaos = window.demoConfig?.chaosLevel || 'normal';
    const chaosFactor = chaos === 'high' ? 1.7 : (chaos === 'low' ? 0.7 : 1);

    // Keep demo telemetry aligned with live feeds (clock + heartbeat freshness).
    window.liveData.heartbeatCount = (window.liveData.heartbeatCount || 0) + 1;
    window.liveData.heartbeatAt = now;
    window.liveData.raceTimeLeftMs = Math.max(0, raceMs - raceElapsed);
    window.liveData._raceTimeReceivedAt = now;

    // --- Rain simulation ---
    const rain = window.demoState.rain;
    if (rain && raceElapsed >= rain.nextEventTime) {
        if (!rain.active && !rain.drying) {
            // Start raining
            rain.active = true;
            rain.drying = false;
            rain.intensity = 0.3 + Math.random() * 0.7; // 0.3–1.0
            rain.lastChangeTime = raceElapsed;
            // Rain lasts 2–8 minutes
            rain.nextEventTime = raceElapsed + 120000 + Math.random() * 360000;

            // Update weather UI and notify
            window.state.trackCondition = 'wet';
            window.state.isRain = true;
            if (typeof updateWeatherUI === 'function') updateWeatherUI();
            const intensityLabel = rain.intensity > 0.7 ? 'Heavy' : rain.intensity > 0.45 ? 'Medium' : 'Light';
            if (typeof window.showToast === 'function') {
                window.showToast(`🌧️ Rain starting! ${intensityLabel} rain — lap times will increase`, 'warning', 6000);
            }
            if (typeof window._fireStrategyNotification === 'function') {
                window._fireStrategyNotification(`🌧️ ${intensityLabel} rain! Track is getting wet — consider strategy adjustments`, 'info');
            }
            if (typeof window.playAlertBeep === 'function') window.playAlertBeep('info');

        } else if (rain.active) {
            // Rain stops → drying phase
            rain.active = false;
            rain.drying = true;
            rain.lastChangeTime = raceElapsed;
            // Drying lasts 2–5 minutes
            rain.nextEventTime = raceElapsed + 120000 + Math.random() * 180000;

            window.state.trackCondition = 'drying';
            window.state.isRain = false;
            if (typeof updateWeatherUI === 'function') updateWeatherUI();
            if (typeof window.showToast === 'function') {
                window.showToast('⛅ Rain stopped — track is drying', 'info', 5000);
            }
            if (typeof window._fireStrategyNotification === 'function') {
                window._fireStrategyNotification('⛅ Rain stopped — track drying, lap times improving', 'info');
            }

        } else if (rain.drying) {
            // Fully dry again
            rain.drying = false;
            rain.intensity = 0;
            rain.lastChangeTime = raceElapsed;
            // Next rain event: 3–10 minutes later
            rain.nextEventTime = raceElapsed + 180000 + Math.random() * 420000;

            window.state.trackCondition = 'dry';
            window.state.isRain = false;
            if (typeof updateWeatherUI === 'function') updateWeatherUI();
            if (typeof window.showToast === 'function') {
                window.showToast('☀️ Track is dry — back to normal pace', 'success', 4000);
            }
        }
    }

    // Calculate current rain pace multiplier
    // Wet karting is significantly slower: ~8-15% slower depending on intensity
    if (rain) {
        if (rain.active) {
            rain.paceMultiplier = 1.0 + rain.intensity * 0.15; // up to 15% slower at full intensity
        } else if (rain.drying) {
            // Gradually dry: pace recovers from 8% down to 0% over the drying period
            const dryingProgress = Math.min(1, (raceElapsed - rain.lastChangeTime) / 180000); // ~3 min to fully dry
            rain.paceMultiplier = 1.0 + rain.intensity * 0.08 * (1 - dryingProgress);
        } else {
            rain.paceMultiplier = 1.0;
        }
    }

    const safetyCar = window.demoState.safetyCar;
    if (window.demoConfig?.safetyCar && safetyCar) {
        if (!safetyCar.active && raceElapsed >= safetyCar.nextEventAt) {
            safetyCar.active = true;
            safetyCar.until = raceElapsed + (40000 + Math.random() * 50000);
            if (typeof window._fireStrategyNotification === 'function') {
                window._fireStrategyNotification('🚩 Safety Car deployed - reduced race pace', 'warning');
            }
            if (typeof window.showToast === 'function') {
                window.showToast('🚩 Safety Car deployed', 'warning', 4500);
            }
        } else if (safetyCar.active && raceElapsed >= safetyCar.until) {
            safetyCar.active = false;
            safetyCar.nextEventAt = raceElapsed + (180000 + Math.random() * 240000);
            if (typeof window._fireStrategyNotification === 'function') {
                window._fireStrategyNotification('🟢 Green flag - racing resumed', 'info');
            }
        }
    }

    if (window.demoState.nextCommentAt != null && raceElapsed >= window.demoState.nextCommentAt) {
        const comments = [
            'Race control: keep pit lane clear',
            'Track clear - green conditions',
            'Incident in sector 2 under review',
            'Pit window trend: increased activity',
            'Reminder: respect pit exit line'
        ];
        const text = comments[Math.floor(Math.random() * comments.length)];
        if (typeof window._fireStrategyNotification === 'function') {
            window._fireStrategyNotification(`📢 ${text}`, 'info');
        }
        if (typeof window.showToast === 'function') {
            window.showToast(`📢 ${text}`, 'info', 5000);
        }
        window.demoState.nextCommentAt = raceElapsed + 60000 + Math.random() * 90000;
    }

    // --- Advance each competitor ---
    window.demoState.competitors.forEach(comp => {
        // Simulate laps until their elapsed time catches up to raceElapsed
        while (comp.elapsed < raceElapsed) {
            // Check if this competitor should be in pit
            if (!comp.inPit && comp.pitsDone < comp.pitEntryTimes.length) {
                const nextPitAt = comp.pitEntryTimes[comp.pitsDone];
                if (comp.elapsed >= nextPitAt) {
                    // Enter pit
                    comp.inPit = true;
                    comp._pitEnterTime = comp.elapsed;
                }
            }

            if (comp.inPit) {
                // In pit: advance time by the pit duration
                const pitEnd = comp._pitEnterTime + comp.pitTimeMs;
                if (pitEnd <= raceElapsed) {
                    // Pit stop finished — reset per-stint lap tracking
                    comp.elapsed = pitEnd;
                    comp.pitTimeSpent += comp.pitTimeMs;
                    comp.pitsDone++;
                    comp.pitCount = comp.pitsDone;
                    comp.inPit = false;
                    comp.stintLaps = [];  // new stint starts
                } else {
                    // Still in pit, jump to current time
                    comp.elapsed = raceElapsed;
                    break;
                }
            } else {
                // Driving: complete one lap
                // Variance: gaussian-ish using Box-Muller approximation
                const u1 = Math.random() || 0.001;
                const u2 = Math.random();
                const gauss = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                // Apply tire degradation multiplier
                const tireMult = comp._tireDeg || 1;
                // Apply rain multiplier: base rain slowdown + per-team rain skill
                const rainMult = rain ? rain.paceMultiplier : 1;
                const teamRainMult = rainMult > 1.01 ? (1 + (rainMult - 1) * comp.rainSkill) : 1;
                const safetyCarMult = (window.demoConfig?.safetyCar && safetyCar?.active) ? 1.18 : 1;
                const lapTime = Math.max(comp.basePace * 0.92, (comp.basePace + gauss * comp.consistency) * tireMult * teamRainMult * safetyCarMult);

                if (comp.elapsed + lapTime > raceElapsed) {
                    // Mid-lap: don't complete it yet
                    break;
                }

                comp.elapsed += lapTime;
                comp.laps++;
                comp.lastLap = Math.round(lapTime);
                comp.lapTimes.push(comp.lastLap);
                if (!comp.stintLaps) comp.stintLaps = [];
                comp.stintLaps.push(comp.lastLap);
                if (!comp.bestLap || comp.lastLap < comp.bestLap) {
                    comp.bestLap = comp.lastLap;
                }
                // Overall average
                comp.avgLap = Math.round(comp.lapTimes.reduce((a, b) => a + b, 0) / comp.lapTimes.length);
                // Per-stint average (only laps since last pit)
                comp.stintAvgLap = comp.stintLaps.length > 0
                    ? Math.round(comp.stintLaps.reduce((a, b) => a + b, 0) / comp.stintLaps.length)
                    : comp.avgLap;
            }
        }
    });

    // --- Sort by distance covered: most elapsed time = furthest ahead ---
    // In endurance, the leader is whoever has driven the most distance.
    // elapsed = driving time + pit time, but position = laps then tie-break on elapsed driving.
    const sorted = [...window.demoState.competitors].sort((a, b) => {
        // Primary: most laps
        if (b.laps !== a.laps) return b.laps - a.laps;
        // Tie-break: less total elapsed (= finished the lap earlier)
        return a.elapsed - b.elapsed;
    });

    // --- Assign positions and gap-to-leader ---
    const leader = sorted[0];
    sorted.forEach((comp, i) => {
        comp.previousPosition = comp.position;
        comp.position = i + 1;

        if (i === 0) {
            comp.gapToLeader = 0;
        } else {
            // Gap = how much more time this competitor has consumed vs the leader
            // A bigger elapsed means further behind in real-time
            // But if they have fewer laps, the gap is even larger
            const lapDiff = leader.laps - comp.laps;
            if (lapDiff > 0) {
                // Estimate: each lap behind ≈ leader's average lap time
                const leaderAvg = leader.elapsed / Math.max(leader.laps, 1);
                comp.gapToLeader = (comp.elapsed - leader.elapsed) + lapDiff * leaderAvg;
            } else {
                // Same lap count: gap = difference in elapsed
                comp.gapToLeader = comp.elapsed - leader.elapsed;
            }
            // Ensure gap is positive (behind leader)
            if (comp.gapToLeader < 0) comp.gapToLeader = Math.abs(comp.gapToLeader);
        }
    });

    // --- Demo scenarios: penalties, tire degradation ---
    const demoCfg = window.demoConfig || { rain: true, penalties: true, tires: true };
    window.demoState.competitors.forEach(comp => {
        // Random penalty chance (~0.3% per update, roughly 1 per 5-6 min at 1Hz)
        if (demoCfg.penalties && !comp._penaltyApplied && comp.laps > 5 && Math.random() < (0.003 * chaosFactor)) {
            const penaltySec = [5, 10, 10, 15, 30][Math.floor(Math.random() * 5)];
            comp.penalty = (comp.penalty || 0) + 1;
            comp.penaltyTime = (comp.penaltyTime || 0) + penaltySec;
            comp.penaltyReason = ['Short stint', 'Pit lane speeding', 'Track limits', 'Unsafe release', 'Jump start'][Math.floor(Math.random() * 5)];
            // Add penalty time to elapsed (time penalty = lost time)
            comp.elapsed += penaltySec * 1000;
            comp._penaltyApplied = true; // Max 1 penalty per team in demo
        }

        if (window.demoConfig?.incidents && comp.laps > 3 && Math.random() < (0.0015 * chaosFactor)) {
            const incidentLoss = 3000 + Math.random() * 7000;
            comp.elapsed += incidentLoss;
            if (comp.isOurTeam && typeof window.showToast === 'function') {
                window.showToast('💥 Minor incident: pace loss recorded', 'warning', 4200);
            }
        }

        // Tire degradation: lap times get ~0.2% slower every 8 laps in a stint
        if (demoCfg.tires) {
            const lapsSincePit = comp.laps - (comp._lapsAtLastPit || 0);
            if (lapsSincePit > 8) {
                comp._tireDeg = 1 + (lapsSincePit - 8) * 0.002;
            } else {
                comp._tireDeg = 1;
            }
            // Reset tire deg on pit
            if (comp.inPit && !comp._wasPitting) {
                comp._lapsAtLastPit = comp.laps;
                comp._tireDeg = 1;
            }
            comp._wasPitting = comp.inPit;
        } else {
            comp._tireDeg = 1;
        }
    });

    // Write sorted order back
    window.demoState.competitors = sorted;

    // --- Update live data from our team ---
    const ourTeam = sorted.find(c => c.isOurTeam);
    if (ourTeam) {
        window.liveData.previousPosition = window.liveData.position;
        window.liveData.position = ourTeam.position;
        window.liveData.lastLap = ourTeam.lastLap;
        window.liveData.bestLap = ourTeam.bestLap;
        window.liveData.laps = ourTeam.laps;
        window.liveData.gapToLeader = ourTeam.gapToLeader;

        // Expose penalty data for UI
        window.liveData.ourTeamPenalty = ourTeam.penalty || 0;
        window.liveData.ourTeamPenaltyTime = ourTeam.penaltyTime || 0;

        // === PIT BRIDGE: sync demo pit state ↔ app pit state ===
        // This mirrors what real live-timing does in processUpdate()
        const wasInPit = window.liveData.ourTeamInPit;
        window.liveData.ourTeamInPit = !!ourTeam.inPit;
        window.liveData.ourTeamPitCount = ourTeam.pitCount ?? null;

        // Case 1: Demo says team entered pit, but app doesn't know yet
        // → trigger confirmPitEntry just like real live timing would
        if (window.state && window.state.isRunning && !window.state.isInPit && ourTeam.inPit) {
            console.log('[Demo] 🛑 AUTO PIT ENTRY from demo simulation');
            if (typeof window.confirmPitEntry === 'function') {
                window.confirmPitEntry(true); // true = auto-detected, skip confirm dialog
            }
        }

        // Case 2: Demo says team exited pit, but app still thinks we're in pit
        // → trigger confirmPitExit just like real live timing would
        if (window.state && window.state.isRunning && window.state.isInPit && !ourTeam.inPit && wasInPit === true) {
            console.log('[Demo] ✅ AUTO PIT EXIT from demo simulation');
            window.liveData.stintLapHistory = [];
            window.liveData.stintBestLap = null;
            window.liveData.lastRecordedLap = null;
            if (typeof window.confirmPitExit === 'function') {
                window.confirmPitExit();
            }
        }

        // Case 3: User manually pressed "Enter Pit" → sync back to demo competitor
        // so the demo knows to hold the car in pit for the configured pit time
        if (window.state && window.state.isInPit && !ourTeam.inPit && !ourTeam._userForcedPit) {
            ourTeam.inPit = true;
            ourTeam._userForcedPit = true;
            ourTeam._pitEnterTime = ourTeam.elapsed;
            window.liveData.ourTeamInPit = true;
            console.log('[Demo] 🔧 User manually entered pit → synced to demo');
        }

        // Case 4: User manually pressed "Exit Pit" → release the demo competitor
        if (window.state && !window.state.isInPit && ourTeam._userForcedPit && ourTeam.inPit) {
            ourTeam.inPit = false;
            ourTeam._userForcedPit = false;
            ourTeam.pitsDone++;
            ourTeam.pitCount = ourTeam.pitsDone;
            ourTeam.pitTimeSpent += (ourTeam.elapsed - (ourTeam._pitEnterTime || ourTeam.elapsed));
            window.liveData.ourTeamInPit = false;
            console.log('[Demo] 🔧 User manually exited pit → synced to demo');
        }

        // Track stint lap history
        if (ourTeam.lastLap && ourTeam.lastLap !== window.liveData.lastRecordedLap) {
            if (!window.liveData.stintLapHistory) window.liveData.stintLapHistory = [];
            window.liveData.stintLapHistory.push(ourTeam.lastLap);
            window.liveData.lastRecordedLap = ourTeam.lastLap;
            if (!window.liveData.stintBestLap || ourTeam.lastLap < window.liveData.stintBestLap) {
                window.liveData.stintBestLap = ourTeam.lastLap;
            }
        }

        // Detect new penalty in demo → fire notification
        if (ourTeam.penalty > (ourTeam._lastNotifiedPenalty || 0)) {
            ourTeam._lastNotifiedPenalty = ourTeam.penalty;
            if (typeof window._fireStrategyNotification === 'function') {
                window._fireStrategyNotification(`⚠️ PENALTY! ${ourTeam.penaltyTime} Lap — ${ourTeam.penaltyReason}`, 'warning');
            }
            if (typeof window.playAlertBeep === 'function') {
                window.playAlertBeep('warning');
            }
            if (typeof window.showToast === 'function') {
                window.showToast(`⚠️ Penalty: ${ourTeam.penaltyTime} Lap (${ourTeam.penaltyReason})`, 'error', 8000);
            }
        }

        ourTeam._wasInPit = ourTeam.inPit;
    }

    window.liveData.competitors = sorted;
    window.updateLiveTimingUI();
};

if (window._competitorsTableOpen == null) window._competitorsTableOpen = true;
window.toggleCompetitorsTable = function() {
    window._competitorsTableOpen = !window._competitorsTableOpen;
    const table = document.getElementById('competitorsTable');
    const btn = document.getElementById('competitorsToggleBtn');
    if (table) table.classList.toggle('hidden', !window._competitorsTableOpen);
    if (btn) btn.textContent = window._competitorsTableOpen ? '📋' : '🗂️';
};

// ==================== DRAGGABLE + RESIZABLE WIDGET ====================

(function initLiveTimingWidget() {
    const STORAGE_KEY = 'strateger_lt_widget_pos';
    const MIN_W = 220, MIN_H = 120;

    let wrapper = null, dragHandle = null, resizeHandle = null;
    let isDragging = false, isResizing = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let startW = 0, startH = 0;

    function clamp(val, lo, hi) { return Math.max(lo, Math.min(hi, val)); }

    function savePos() {
        if (!wrapper || !wrapper.classList.contains('lt-fixed')) return;
        const pos = {
            left: parseInt(wrapper.style.left) || 0,
            top: parseInt(wrapper.style.top) || 0,
            width: parseInt(wrapper.style.width) || 0,
            height: parseInt(wrapper.style.height) || 0,
            fixed: true
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch(e) {}
    }

    function loadPos() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch(e) {}
        return null;
    }

    function applyPos(pos) {
        if (!wrapper || !pos || !pos.fixed) return;
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = Math.max(MIN_W, Math.min(pos.width || 300, vw - 16));
        const h = Math.max(MIN_H, Math.min(pos.height || 300, vh - 16));
        const left = clamp(pos.left || 0, 0, vw - w - 8);
        const top = clamp(pos.top || 0, 0, vh - h - 8);
        wrapper.style.left = left + 'px';
        wrapper.style.top = top + 'px';
        wrapper.style.width = w + 'px';
        wrapper.style.height = h + 'px';
        wrapper.classList.add('lt-fixed');
    }

    function makeFixed() {
        if (!wrapper || wrapper.classList.contains('lt-fixed')) return;
        // Capture current position relative to viewport
        const rect = wrapper.getBoundingClientRect();
        wrapper.classList.add('lt-fixed');
        wrapper.style.left = rect.left + 'px';
        wrapper.style.top = rect.top + 'px';
        wrapper.style.width = rect.width + 'px';
        wrapper.style.height = Math.max(MIN_H, rect.height) + 'px';
    }

    // Re-clamp position whenever window is resized (handles maximise/restore)
    window.addEventListener('resize', function() {
        if (!wrapper || !wrapper.classList.contains('lt-fixed')) return;
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = Math.max(MIN_W, Math.min(parseInt(wrapper.style.width) || 300, vw - 16));
        const h = Math.max(MIN_H, Math.min(parseInt(wrapper.style.height) || 300, vh - 16));
        const left = clamp(parseInt(wrapper.style.left) || 0, 0, vw - w - 8);
        const top = clamp(parseInt(wrapper.style.top) || 0, 0, vh - h - 8);
        wrapper.style.left = left + 'px';
        wrapper.style.top = top + 'px';
        wrapper.style.width = w + 'px';
        wrapper.style.height = h + 'px';
    }, { passive: true });

    // ---- Snap-grid overlay helpers ----
    function showSnapGrid() {
        if (document.getElementById('ltSnapGridOverlay')) return;
        const el = document.createElement('div');
        el.id = 'ltSnapGridOverlay';
        document.body.appendChild(el);
    }
    function hideSnapGrid() {
        const el = document.getElementById('ltSnapGridOverlay');
        if (el) el.remove();
    }
    // Snap to nearest 20px grid
    function snapPos(x, y) {
        const g = 20;
        return { x: Math.round(x / g) * g, y: Math.round(y / g) * g };
    }

    // ---- Drag ----
    function onDragStart(e) {
        if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;
        makeFixed();
        isDragging = true;
        wrapper.classList.add('lt-dragging');
        showSnapGrid();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startX = clientX;
        startY = clientY;
        startLeft = parseInt(wrapper.style.left) || 0;
        startTop = parseInt(wrapper.style.top) || 0;
        e.preventDefault();
    }

    function onDragMove(e) {
        if (!isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = parseInt(wrapper.style.width) || 300;
        const h = parseInt(wrapper.style.height) || 200;
        const newLeft = clamp(startLeft + (clientX - startX), 0, vw - w - 8);
        const newTop = clamp(startTop + (clientY - startY), 0, vh - h - 8);
        wrapper.style.left = newLeft + 'px';
        wrapper.style.top = newTop + 'px';
    }

    function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;
        wrapper.classList.remove('lt-dragging');
        hideSnapGrid();
        // Snap final position to grid
        const rawLeft = parseInt(wrapper.style.left) || 0;
        const rawTop  = parseInt(wrapper.style.top)  || 0;
        const snapped = snapPos(rawLeft, rawTop);
        const vw = window.innerWidth, vh = window.innerHeight;
        const w = parseInt(wrapper.style.width) || wrapper.offsetWidth;
        const h = parseInt(wrapper.style.height) || wrapper.offsetHeight;
        wrapper.style.left = clamp(snapped.x, 0, vw - w - 8) + 'px';
        wrapper.style.top  = clamp(snapped.y, 0, vh - h - 8) + 'px';
        savePos();
    }

    // ---- Resize ----
    function onResizeStart(e) {
        isResizing = true;
        wrapper.classList.add('lt-resizing');
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        startX = clientX;
        startY = clientY;
        startW = parseInt(wrapper.style.width) || wrapper.offsetWidth;
        startH = parseInt(wrapper.style.height) || wrapper.offsetHeight;
        e.preventDefault();
        e.stopPropagation();
    }

    function onResizeMove(e) {
        if (!isResizing) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const vw = window.innerWidth, vh = window.innerHeight;
        const left = parseInt(wrapper.style.left) || 0;
        const top = parseInt(wrapper.style.top) || 0;
        const newW = clamp(startW + (clientX - startX), MIN_W, vw - left - 8);
        const newH = clamp(startH + (clientY - startY), MIN_H, vh - top - 8);
        wrapper.style.width = newW + 'px';
        wrapper.style.height = newH + 'px';
    }

    function onResizeEnd() {
        if (!isResizing) return;
        isResizing = false;
        wrapper.classList.remove('lt-resizing');
        savePos();
    }

    function attachHandlers() {
        wrapper = document.getElementById('liveTimingWidgetWrapper');
        dragHandle = document.getElementById('liveTimingDragHandle');
        resizeHandle = document.getElementById('liveTimingResizeHandle');
        if (!wrapper || !dragHandle || !resizeHandle) return;

        // Drag — mouse
        dragHandle.addEventListener('mousedown', onDragStart);
        document.addEventListener('mousemove', onDragMove);
        document.addEventListener('mouseup', onDragEnd);
        // Drag — touch
        dragHandle.addEventListener('touchstart', onDragStart, { passive: false });
        document.addEventListener('touchmove', function(e) {
            if (isDragging) { e.preventDefault(); onDragMove(e); }
        }, { passive: false });
        document.addEventListener('touchend', onDragEnd);

        // Resize — mouse
        resizeHandle.addEventListener('mousedown', onResizeStart);
        document.addEventListener('mousemove', function(e) { if (isResizing) onResizeMove(e); });
        document.addEventListener('mouseup', onResizeEnd);
        // Resize — touch
        resizeHandle.addEventListener('touchstart', onResizeStart, { passive: false });
        document.addEventListener('touchmove', function(e) {
            if (isResizing) { e.preventDefault(); onResizeMove(e); }
        }, { passive: false });
        document.addEventListener('touchend', onResizeEnd);

        // Restore saved position (only applies if previously fixed)
        const saved = loadPos();
        if (saved) applyPos(saved);
    }

    // Attach after DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachHandlers);
    } else {
        attachHandlers();
    }
})();

// ==================== RACE CLOCK SYNC ====================
// Keeps the widget's clock (liveRaceClock) in sync with the main app's race timer.
// Handles: Apex countdown, RaceFacer timeLeftSeconds, demo mode, and DST-safe offsets.

(function initRaceClockSync() {
    const CLOCK_EL_ID = 'liveRaceClock';

    function formatRaceTime(ms) {
        if (ms == null || ms < 0) return '';
        // Use the same format the main UI uses: H:MM:SS
        const totalSec = Math.floor(ms / 1000);
        const h = Math.floor(totalSec / 3600);
        const m = Math.floor((totalSec % 3600) / 60);
        const s = totalSec % 60;
        const mm = String(m).padStart(2, '0');
        const ss = String(s).padStart(2, '0');
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    }

    function tick() {
        const el = document.getElementById(CLOCK_EL_ID);
        if (!el) return;

        // Priority 1: live timing feed has provided a countdown (Apex/RaceFacer)
        const ld = window.liveData;
        if (ld && ld.raceTimeLeftMs != null && ld._raceTimeReceivedAt) {
            // Count down locally between feed packets — DST-safe: only elapsed wall-clock delta
            const elapsed = Date.now() - ld._raceTimeReceivedAt;
            const adjusted = Math.max(0, ld.raceTimeLeftMs - elapsed);
            el.textContent = formatRaceTime(adjusted);
            el.title = window.t ? window.t('raceClockLabel') : 'RACE TIME';
            return;
        }

        // Priority 2: main app race timer (derived from window.state)
        const st = window.state;
        const cfg = window.config;
        if (st && st.isRunning && st.startTime && cfg) {
            const raceDurationMs = (parseFloat(cfg.duration) || 0) * 3600000;
            if (raceDurationMs > 0) {
                const elapsed = Date.now() - st.startTime;
                const remaining = Math.max(0, raceDurationMs - elapsed);
                el.textContent = formatRaceTime(remaining);
                el.title = window.t ? window.t('raceClockLabel') : 'RACE TIME';
                return;
            }
        }

        // No data
        el.textContent = '';
    }

    // Run every second regardless of feed heartbeat rate
    setInterval(tick, 1000);
    tick();
})();

// ==================== PRO TEAM LOGO UPLOAD ====================

(function initTeamLogo() {
    const LOGO_KEY = 'strateger_team_logo';
    const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/svg+xml'];

    // Load stored logo on init
    window._teamLogoDataUrl = null;
    try {
        const stored = localStorage.getItem(LOGO_KEY);
        if (stored) window._teamLogoDataUrl = stored;
    } catch(e) {}

    // Show the upload button only for Pro users, after panel is visible
    function refreshLogoBtn() {
        const btn = document.getElementById('teamLogoUploadBtn');
        if (!btn) return;
        const isPro = !!(window._proUnlocked);
        btn.classList.toggle('hidden', !isPro);
        if (isPro) {
            const labelKey = window._teamLogoDataUrl ? 'teamLogoChange' : 'teamLogoUpload';
            btn.title = window.t ? window.t(labelKey) : (window._teamLogoDataUrl ? 'Change Logo' : 'Upload Logo');
        }
    }

    // Called when the user clicks the logo upload button
    window.openTeamLogoUpload = function() {
        if (!window.checkProFeature('teamLogo')) {
            window.showProGate('Team Logo');
            return;
        }
        // Show remove option if logo already set
        if (window._teamLogoDataUrl) {
            const removeLabel = window.t ? window.t('teamLogoRemove') : 'Remove logo';
            if (confirm(removeLabel + '?')) {
                window._teamLogoDataUrl = null;
                try { localStorage.removeItem(LOGO_KEY); } catch(e) {}
                refreshLogoBtn();
                return;
            }
        }
        const input = document.getElementById('teamLogoFileInput');
        if (input) { input.value = ''; input.click(); }
    };

    // Called by the hidden file input's onchange
    window._handleTeamLogoFile = function(input) {
        const file = input.files && input.files[0];
        if (!file) return;

        const btn = document.getElementById('teamLogoUploadBtn');

        // Validate type
        if (!ALLOWED_TYPES.includes(file.type)) {
            const msg = window.t ? window.t('teamLogoInvalidType') : 'Only JPG, PNG or SVG allowed';
            if (typeof window.showToast === 'function') window.showToast('⚠️ ' + msg, 'error', 4000);
            return;
        }

        // Validate size
        if (file.size > MAX_BYTES) {
            const msg = window.t ? window.t('teamLogoTooLarge') : 'File too large (max 2 MB)';
            if (typeof window.showToast === 'function') window.showToast('⚠️ ' + msg, 'error', 4000);
            return;
        }

        // Show uploading state
        if (btn) {
            btn.disabled = true;
            btn.textContent = window.t ? window.t('teamLogoUploading') : 'Uploading…';
        }

        const reader = new FileReader();
        reader.onload = function(ev) {
            const dataUrl = ev.target.result;
            // Sanitize: only accept data URLs with image MIME prefix
            if (!dataUrl || !dataUrl.startsWith('data:image/')) {
                if (btn) { btn.disabled = false; refreshLogoBtn(); }
                return;
            }
            window._teamLogoDataUrl = dataUrl;
            try { localStorage.setItem(LOGO_KEY, dataUrl); } catch(e) {
                // Quota exceeded — fall back gracefully (logo available in memory only)
                console.warn('[TeamLogo] localStorage quota exceeded; logo stored in memory only');
            }
            if (btn) btn.disabled = false;
            refreshLogoBtn();
            // Redraw competitors table to show the new logo
            if (typeof window.updateCompetitorsTable === 'function') window.updateCompetitorsTable();
        };
        reader.onerror = function() {
            if (btn) { btn.disabled = false; refreshLogoBtn(); }
        };
        reader.readAsDataURL(file);
    };

    // Expose helper for the competitors table renderer to call
    window._getTeamLogoHtml = function(isOurTeam) {
        if (!isOurTeam || !window._teamLogoDataUrl) return null;
        // Escape the data URL for use in an HTML attribute (it's a data: URL so no XSS risk,
        // but we still sanitize: only allow data:image/ prefix, no JS execution possible)
        const safe = window._teamLogoDataUrl.replace(/"/g, '&quot;');
        return `<span class="team-logo-cell"><img src="${safe}" alt="" loading="lazy"></span>`;
    };

    // Refresh button visibility whenever Pro status changes
    const _origActivate = window.activateProLicense;
    if (typeof _origActivate === 'function') {
        window.activateProLicense = async function(key, email) {
            const result = await _origActivate(key, email);
            refreshLogoBtn();
            return result;
        };
    }
    const _origDeactivate = window.deactivateProLicense;
    if (typeof _origDeactivate === 'function') {
        window.deactivateProLicense = function() {
            _origDeactivate();
            refreshLogoBtn();
        };
    }

    // Initial state
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', refreshLogoBtn);
    } else {
        refreshLogoBtn();
    }
})();

