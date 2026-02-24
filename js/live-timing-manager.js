/**
 * Live Timing Manager
 * Manages all timing scrapers (RaceFacer, APEX, etc.)
 * For Strateger - Netlify Deployment
 */

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
            onUpdate: callbacks.onUpdate || null,
            onError: callbacks.onError || null,
            onFatalError: callbacks.onFatalError || null,
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
        updateInterval: this.config.updateInterval,
        debug: true,

        onUpdate: (data) => {
            const strategerData = this.convertToStrategerFormat(data, 'apex');
            
            if (this.config.onUpdate) {
                this.config.onUpdate(strategerData);
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
                    avgLap: data.ourTeam.avgLapMs,
                    totalLaps: data.ourTeam.totalLaps,
                    gap: parseGap(data.ourTeam.gap),
                    interval: parseGap(data.ourTeam.interval),
                    inPit: data.ourTeam.inPit,
                    pitCount: data.ourTeam.pitCount,
                    consistency: data.ourTeam.consistency
                } : null,

                // כל המתחרים
                competitors: data.competitors.map(c => ({
                    position: c.position,
                    name: c.name,
                    team: c.team,
                    kart: c.kart,
                    lastLap: c.lastLapMs,
                    bestLap: c.bestLapMs,
                    avgLap: c.avgLapMs,
                    laps: c.totalLaps,
                    gap: parseGap(c.gap),
                    interval: parseGap(c.interval),
                    inPit: c.inPit,
                    pitCount: c.pitCount,
                    consistency: c.consistency,
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

        // עבור ספקים אחרים - פשוט החזר את הדאטה כמו שהיא
        if (provider === 'apex') {
            return {
                race: data.race || {},
                ourTeam: data.ourTeam ? {
                    position: parseInt(data.ourTeam.position) || 0,
                    name: data.ourTeam.name || '',
                    team: data.ourTeam.team || '',
                    kart: data.ourTeam.kart || '',
                    lastLap: data.ourTeam.lastLapMs || null,
                    bestLap: data.ourTeam.bestLapMs || null,
                    totalLaps: parseInt(data.ourTeam.laps) || 0,
                    gap: data.ourTeam.gap || '-',
                    inPit: data.ourTeam.inPit || false,
                    pitCount: data.ourTeam.pitCount || 0
                } : null,
                competitors: (data.competitors || []).map(c => ({
                    position: parseInt(c.position) || 0,
                    name: c.name || '',
                    team: c.team || '',
                    kart: c.kart || '',
                    lastLap: c.lastLapMs || null,
                    bestLap: c.bestLapMs || null,
                    laps: parseInt(c.laps) || 0,
                    gap: c.gap || '-',
                    inPit: c.inPit || false,
                    isOurTeam: data.ourTeam ? (c.name === data.ourTeam.name && c.kart === data.ourTeam.kart) : false
                })),
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
