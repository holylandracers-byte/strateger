/**
 * Live Timing Manager
 * Manages all timing scrapers (RaceFacer, APEX, etc.)
 * For Strateger - Netlify Deployment
 */

/**
 * Convert any gap value (string or number) to milliseconds.
 * Handles: Apex time strings ("1:05.387", "5.387"), 
 *          RaceFacer strings ("+12.345"), laps ("2 Laps"), 
 *          and numeric seconds from parseGap.
 */
function gapToMs(gapValue) {
    if (gapValue == null) return 0;
    // Number → treat as seconds (from parseGap or raw float), convert to ms
    if (typeof gapValue === 'number') return Math.round(gapValue * 1000);
    let str = String(gapValue).trim().replace(/^\+/, '');
    if (!str || str === '-') return 0;
    // "M:SS.mmm" (e.g., "1:05.387" or "0:05.387")
    const mmss = str.match(/^(\d+):(\d{2})\.(\d{1,3})$/);
    if (mmss) {
        const ms = mmss[3].padEnd(3, '0');
        return (parseInt(mmss[1]) * 60 + parseInt(mmss[2])) * 1000 + parseInt(ms);
    }
    // "M:SS" or "M:SS." from Apex "to" token
    const mmssNoMs = str.match(/^(\d+):(\d{2})\.?$/);
    if (mmssNoMs) {
        return (parseInt(mmssNoMs[1]) * 60 + parseInt(mmssNoMs[2])) * 1000;
    }
    // "SS.mmm" (e.g., "5.387" or "65.123")
    const ss = str.match(/^(\d+)\.(\d{1,3})$/);
    if (ss) {
        const ms = ss[2].padEnd(3, '0');
        return parseInt(ss[1]) * 1000 + parseInt(ms);
    }
    // Laps behind: "2 Laps", "1 Lap"
    const laps = str.match(/^(\d+)\s*[Ll]ap/);
    if (laps) return parseInt(laps[1]) * 90000; // ~90s estimate per lap
    // Fallback: parse as seconds
    const num = parseFloat(str);
    return !isNaN(num) ? Math.round(num * 1000) : 0;
}

/**
 * Sanitize avg lap ms value from API.
 * RaceFacer avg_lap_raw can return garbage (e.g. 6.77e-23, 1.86e+20).
 * Valid kart lap times are between 20s (20000ms) and 3min (180000ms).
 * Falls back to parsing the formatted avg_lap string.
 */
function sanitizeAvgLapMs(rawMs, formattedStr) {
    // Check if rawMs is a sane value (between 20s and 3min)
    if (typeof rawMs === 'number' && rawMs >= 20000 && rawMs <= 180000) {
        return rawMs;
    }
    // Try parsing the formatted string (e.g. "0:56.052")
    if (formattedStr) {
        const parsed = gapToMs(formattedStr);
        if (parsed >= 20000 && parsed <= 180000) return parsed;
    }
    return 0;
}

class LiveTimingManager {
    constructor() {
        this.currentScraper = null;
        this.config = {
            onUpdate: null,
            onError: null,
            searchTerm: '',
            updateInterval: 5000
        };
        this.provider = null;
    }

    /**
     * זיהוי אוטומטי של ספק Live Timing
     */
    detectProvider(url) {
        if (url.includes('racefacer')) return 'racefacer';
        if (url.includes('apex-timing') || url.includes('apex_timing') || url.includes('apextiming')) return 'apex';
        if (url.includes('alphatiming.co.uk')) return 'alpha';
        return 'unknown';
    }

    /**
     * חילוץ race slug מ-URL של RaceFacer
     * דוגמה: https://live.racefacer.com/circuittokiobay -> circuittokiobay
     */
    extractRaceFacerSlug(url) {
        const match = url.match(/racefacer\.com\/([^\/\?]+)/);
        return match ? match[1] : null;
    }

    /**
     * התחלת scraping עם URL
     */
    start(url, searchTerm, callbacks) {
        // עצור scraper קיים אם יש
        this.stop();

        // שמור config
        this.config = {
            searchTerm: searchTerm || '',
            searchType: callbacks.searchType || 'team',
            onUpdate: callbacks.onUpdate || null,
            onError: callbacks.onError || null,
            onFatalError: callbacks.onFatalError || null,
            onComment: callbacks.onComment || null,
            updateInterval: callbacks.updateInterval || 5000
        };

        // זהה ספק
        this.provider = this.detectProvider(url);
        console.log(`[LiveTimingManager] Detected provider: ${this.provider}`);

        // התחל scraper מתאים
        if (this.provider === 'racefacer') {
            this.startRaceFacerScraper(url);
        } else if (this.provider === 'apex') {
            this.startApexScraper(url);
        } else if (this.provider === 'alpha') {
            this.startAlphaScraper(url);
        } else {
            console.error('[LiveTimingManager] Unknown timing provider');
            if (this.config.onError) {
                this.config.onError(new Error('Unknown timing provider'));
            }
        }
    }

    /**
     * התחל RaceFacer scraper
     */
    startRaceFacerScraper(url) {
        // וודא ש-RaceFacerScraper זמין
        if (typeof RaceFacerScraper === 'undefined') {
            console.error('[LiveTimingManager] RaceFacerScraper not loaded!');
            if (this.config.onError) {
                this.config.onError(new Error('RaceFacerScraper not available'));
            }
            return;
        }

        // חלץ slug
        const slug = this.extractRaceFacerSlug(url);
        if (!slug) {
            console.error('[LiveTimingManager] Could not extract race slug from URL');
            if (this.config.onError) {
                this.config.onError(new Error('Invalid RaceFacer URL'));
            }
            return;
        }

        console.log(`[LiveTimingManager] Starting RaceFacer scraper with slug: ${slug}`);

        // צור scraper
        this.currentScraper = new RaceFacerScraper({
            raceSlug: slug,
            searchTerm: this.config.searchTerm,
            searchType: this.config.searchType || 'team',
            updateInterval: this.config.updateInterval,
            debug: false, // כבוי בפרודקשן

            onUpdate: (data) => {
                // המרה לפורמט Strateger
                const strategerData = this.convertToStrategerFormat(data, 'racefacer');
                
                // קריאה ל-callback
                if (this.config.onUpdate) {
                    this.config.onUpdate(strategerData);
                }
            },

            onError: (error, consecutiveErrors) => {
                console.error(`[LiveTimingManager] Scraper error (${consecutiveErrors} consecutive):`, error);
                
                if (this.config.onError) {
                    this.config.onError(error, consecutiveErrors);
                }

                // אם יותר מדי שגיאות, הפעל fatal error callback
                if (consecutiveErrors >= 5 && this.config.onFatalError) {
                    this.config.onFatalError(error);
                }
            }
        });

        // התחל
        this.currentScraper.start();
        console.log('[LiveTimingManager] Scraper started successfully');
    }

    /**
     * התחל Alpha Timing scraper
     */
    startAlphaScraper(url) {
        if (typeof AlphaTimingScraper === 'undefined') {
            console.error('[LiveTimingManager] AlphaTimingScraper not loaded!');
            if (this.config.onError) {
                this.config.onError(new Error('AlphaTimingScraper not available'));
            }
            return;
        }

        console.log(`[LiveTimingManager] Starting Alpha Timing scraper with URL: ${url}`);

        this.currentScraper = new AlphaTimingScraper({
            raceUrl: url,
            searchTerm: this.config.searchTerm,
            searchType: this.config.searchType || 'team',
            updateInterval: this.config.updateInterval,
            debug: false,

            onUpdate: (data) => {
                const strategerData = this.convertToStrategerFormat(data, 'alpha');
                if (this.config.onUpdate) {
                    this.config.onUpdate(strategerData);
                }
            },

            onComment: (entry) => {
                if (this.config.onComment) {
                    this.config.onComment(entry);
                }
            },

            onError: (error, consecutiveErrors) => {
                console.error(`[LiveTimingManager] Alpha error (${consecutiveErrors}):`, error);
                if (this.config.onError) {
                    this.config.onError(error, consecutiveErrors);
                }
                if (consecutiveErrors >= 5 && this.config.onFatalError) {
                    this.config.onFatalError(error);
                }
            }
        });

        this.currentScraper.start();
        console.log('[LiveTimingManager] Alpha Timing scraper started');
    }

    /**
     * התחל APEX scraper)
     */
    startApexScraper(url) {
    if (typeof ApexTimingScraper === 'undefined') {
        console.error('[LiveTimingManager] ApexTimingScraper not loaded!');
        if (this.config.onError) {
            this.config.onError(new Error('ApexTimingScraper not available'));
        }
        return;
    }

    console.log(`[LiveTimingManager] Starting Apex scraper with URL: ${url}`);

    this.currentScraper = new ApexTimingScraper({
        raceUrl: url,
        searchTerm: this.config.searchTerm,
        searchType: this.config.searchType || 'team',
        updateInterval: this.config.updateInterval,
        debug: false,

        onUpdate: (data) => {
            const strategerData = this.convertToStrategerFormat(data, 'apex');
            
            if (this.config.onUpdate) {
                this.config.onUpdate(strategerData);
            }
        },

        onComment: (entry) => {
            if (this.config.onComment) {
                this.config.onComment(entry);
            }
        },

        onError: (error, consecutiveErrors) => {
            console.error(`[LiveTimingManager] Apex error (${consecutiveErrors}):`, error);
            
            if (this.config.onError) {
                this.config.onError(error, consecutiveErrors);
            }

            if (consecutiveErrors >= 5 && this.config.onFatalError) {
                this.config.onFatalError(error);
            }
        }
    });

    this.currentScraper.start();
    console.log('[LiveTimingManager] Apex scraper started');
}

    /**
     * עצירת scraper
     */
    stop() {
        if (this.currentScraper && typeof this.currentScraper.stop === 'function') {
            console.log('[LiveTimingManager] Stopping scraper...');
            this.currentScraper.stop();
            this.currentScraper = null;
            this.provider = null;
        }
    }

    /**
     * קבלת סטטיסטיקות
     */
    getStats() {
        if (this.currentScraper && typeof this.currentScraper.getStats === 'function') {
            return {
                ...this.currentScraper.getStats(),
                provider: this.provider
            };
        }
        if (this.currentScraper) {
            return {
                provider: this.provider,
                isRunning: !!this.currentScraper.isRunning
            };
        }
        return {
            provider: this.provider,
            isRunning: false
        };
    }

    /**
     * המרה לפורמט Strateger
     * ממיר את הדאטה מהסקרייפר לפורמט שStrateger מצפה לו
     */
    convertToStrategerFormat(data, provider) {
        if (provider === 'racefacer') {
            return {
                // מידע על המרוץ
                race: {
                    status: data.race.status,
                    timeLeft: data.race.timeLeft,
                    timeLeftSeconds: data.race.timeLeftSeconds,
                    currentLap: data.race.currentLap,
                    totalLaps: data.race.totalLaps,
                    isEndurance: data.race.isEndurance,
                    hasPits: data.race.hasPits
                },

                // הקבוצה שלנו
                ourTeam: data.ourTeam ? {
                    position: data.ourTeam.position,
                    previousPosition: this.getPreviousPosition(data),
                    name: data.ourTeam.name,
                    team: data.ourTeam.team,
                    kart: data.ourTeam.kart,
                    lastLap: data.ourTeam.lastLapMs,
                    bestLap: data.ourTeam.bestLapMs,
                    avgLap: sanitizeAvgLapMs(data.ourTeam.avgLapMs, data.ourTeam.avgLap),
                    totalLaps: data.ourTeam.totalLaps,
                    gap: gapToMs(data.ourTeam.gap),
                    interval: gapToMs(data.ourTeam.interval),
                    inPit: data.ourTeam.inPit,
                    pitCount: data.ourTeam.pitCount,
                    consistency: data.ourTeam.consistency,
                    penalty: data.ourTeam.penalty || 0,
                    penaltyTime: data.ourTeam.penaltyTime || 0,
                    penaltyReason: data.ourTeam.penaltyReason || ''
                } : null,

                // כל המתחרים
                competitors: data.competitors.map(c => ({
                    position: c.position,
                    name: c.name,
                    team: c.team,
                    kart: c.kart,
                    lastLap: c.lastLapMs,
                    bestLap: c.bestLapMs,
                    avgLap: sanitizeAvgLapMs(c.avgLapMs, c.avgLap),
                    laps: c.totalLaps,
                    gap: gapToMs(c.gap),
                    gapRaw: c.gap,
                    interval: gapToMs(c.interval),
                    intervalRaw: c.interval,
                    inPit: c.inPit,
                    pitCount: c.pitCount,
                    consistency: c.consistency,
                    penalty: c.penalty || 0,
                    penaltyTime: c.penaltyTime || 0,
                    penaltyReason: c.penaltyReason || '',
                    isOurTeam: data.ourTeam ? c.id === data.ourTeam.id : false
                })),

                // מטא-דאטה
                found: data.found,
                updateNumber: data.updateNumber,
                fetchDuration: data.fetchDuration,
                provider: 'racefacer',
                timestamp: Date.now()
            };
        }

        // Alpha Timing
        if (provider === 'alpha') {
            const alphaComps = (data.competitors || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
            return {
                race: {
                    timeLeftSeconds: data.race?.timeLeftSeconds ?? null,
                    status: data.race?.status || null,
                    sessionName: data.race?.sessionName || '',
                    sessionType: data.race?.sessionType || '',
                    trackName: data.race?.trackName || '',
                    isEndurance: data.race?.isEndurance || false
                },
                ourTeam: data.ourTeam ? {
                    position: data.ourTeam.position,
                    name: data.ourTeam.name || '',
                    team: data.ourTeam.team || '',
                    kart: data.ourTeam.kart || '',
                    lastLap: data.ourTeam.lastLapMs || null,
                    bestLap: data.ourTeam.bestLapMs || null,
                    avgLap: data.ourTeam.avgLapMs || null,
                    totalLaps: data.ourTeam.totalLaps || 0,
                    gap: data.ourTeam.gapMs || 0,
                    gapRaw: data.ourTeam.gap || '',
                    interval: data.ourTeam.intervalMs || 0,
                    inPit: data.ourTeam.inPit || false,
                    pitCount: data.ourTeam.pitCount || 0,
                    category: data.ourTeam.category || '',
                    penalty: data.ourTeam.penalty || 0,
                    penaltyTime: data.ourTeam.penaltyTime || 0,
                    penaltyReason: data.ourTeam.penaltyReason || ''
                } : null,
                competitors: alphaComps.map((c, idx) => ({
                    position: c.position,
                    name: c.name || '',
                    team: c.team || '',
                    kart: c.kart || '',
                    lastLap: c.lastLapMs || null,
                    bestLap: c.bestLapMs || null,
                    avgLap: c.avgLapMs || null,
                    laps: c.totalLaps || 0,
                    totalLaps: c.totalLaps || 0,
                    gap: c.gapMs || 0,
                    gapRaw: c.gap || '',
                    interval: c.intervalMs || 0,
                    inPit: c.inPit || false,
                    pitCount: c.pitCount || 0,
                    category: c.category || '',
                    penalty: c.penalty || 0,
                    penaltyTime: c.penaltyTime || 0,
                    penaltyReason: c.penaltyReason || '',
                    isOurTeam: c.isOurTeam || false
                })),
                comments: [],
                found: data.found,
                provider: 'alpha',
                timestamp: Date.now()
            };
        }

        // עבור ספקים אחרים - פשוט החזר את הדאטה כמו שהיא
        if (provider === 'apex') {
            // Sort by position for interval computation (gap[n] - gap[n-1])
            const apexComps = (data.competitors || []).slice().sort((a, b) => (parseInt(a.position) || 0) - (parseInt(b.position) || 0));
            const gapMsArr = apexComps.map(c => gapToMs(c.gap));
            return {
                race: {
                    timeLeftSeconds: data.race?.timeLeftSeconds ?? null,
                    status: data.race?.status || null
                },
                ourTeam: data.ourTeam ? {
                    position: parseInt(data.ourTeam.position) || 0,
                    name: data.ourTeam.name || '',
                    team: data.ourTeam.team || '',
                    kart: data.ourTeam.kart || data.ourTeam.kartNumber || '',
                    lastLap: data.ourTeam.lastLapMs || null,
                    bestLap: data.ourTeam.bestLapMs || null,
                    avgLap: data.ourTeam.avgLapMs || null,
                    totalLaps: parseInt(data.ourTeam.totalLaps || data.ourTeam.laps) || 0,
                    gap: gapToMs(data.ourTeam.gap),
                    gapRaw: data.ourTeam.gap || '',
                    inPit: data.ourTeam.inPit || false,
                    pitCount: data.ourTeam.pitCount || 0,
                    category: data.ourTeam.category || '',
                    penalty: data.ourTeam.penalty || 0,
                    penaltyTime: data.ourTeam.penaltyTime || 0,
                    penaltyReason: data.ourTeam.penaltyReason || ''
                } : null,
                competitors: apexComps.map((c, idx) => ({
                    position: parseInt(c.position) || 0,
                    name: c.name || '',
                    team: c.team || '',
                    kart: c.kart || c.kartNumber || '',
                    lastLap: c.lastLapMs || null,
                    bestLap: c.bestLapMs || null,
                    avgLap: c.avgLapMs || null,
                    laps: parseInt(c.laps || c.totalLaps) || 0,
                    totalLaps: parseInt(c.laps || c.totalLaps) || 0,
                    gap: gapMsArr[idx],
                    gapRaw: c.gap || '',
                    interval: idx === 0 ? 0 : Math.max(0, gapMsArr[idx] - gapMsArr[idx - 1]),
                    inPit: c.inPit || false,
                    pitCount: c.pitCount || 0,
                    category: c.category || '',
                    penalty: c.penalty || 0,
                    penaltyTime: c.penaltyTime || 0,
                    penaltyReason: c.penaltyReason || '',
                    isOurTeam: c.isOurTeam || (data.ourTeam ? c.rowId === data.ourTeam.rowId : false)
                })),
                comments: data.comments || [],
                found: data.found,
                provider: 'apex',
                timestamp: Date.now()
            };
        }

        return {
            ...data,
            provider: provider,
            timestamp: Date.now()
        };
    }

    /**
     * קבלת מיקום קודם (אם קיים)
     */
    getPreviousPosition(data) {
        // אם יש lastData, נבדוק אם המיקום השתנה
        if (this.currentScraper && this.currentScraper.lastData) {
            const prevOurTeam = this.currentScraper.lastData.ourTeam;
            if (prevOurTeam && prevOurTeam.position !== data.ourTeam.position) {
                return prevOurTeam.position;
            }
        }
        return data.ourTeam.position; // אותו מיקום
    }
}

// Export to window for browser usage
window.LiveTimingManager = LiveTimingManager;
