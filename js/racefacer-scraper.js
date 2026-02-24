/**
 * RaceFacer Live Timing Scraper V3
 * For Strateger - Netlify Deployment
 * 
 * Features:
 * - Cache-busting for continuous updates
 * - Automatic proxy rotation
 * - Comprehensive error handling
 * - Real-time data synchronization
 */

class RaceFacerScraper {
    constructor(config) {
        this.config = {
            raceSlug: config.raceSlug || 'circuittokiobay',
            searchTerm: config.searchTerm || '',
            updateInterval: config.updateInterval || 5000,
            onUpdate: config.onUpdate || null,
            onError: config.onError || null,
            debug: config.debug || false
        };
        
        this.isRunning = false;
        this.intervalId = null;
        this.lastData = null;
        this.consecutiveErrors = 0;
        this.lastSuccessTime = null;
        this.updateCount = 0;
        
        this.apiUrl = `https://live.racefacer.com/ajax/live-data?slug=${this.config.raceSlug}`;
        
        // Netlify serverless proxy (primary - most reliable, no CORS issues)
        // External proxies as fallbacks only
        this.proxies = [
            { name: 'netlify', url: '/.netlify/functions/cors-proxy?url=' },
            { name: 'corsproxy', url: 'https://corsproxy.io/?' },
            { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' }
        ];
        this.currentProxyIndex = 0;
    }

    log(message, type = 'info') {
        if (this.config.debug || type === 'error') {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] [RaceFacer ${type.toUpperCase()}]`, message);
        }
    }

    addCacheBuster(url) {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}_t=${Date.now()}&_r=${Math.random().toString(36).substring(7)}`;
    }

    async fetchWithProxy(url) {
        const urlWithCacheBust = this.addCacheBuster(url);
        this.log(`Fetching: ${urlWithCacheBust.substring(0, 100)}...`);
        
        for (let attempt = 0; attempt < this.proxies.length * 2; attempt++) {
            const proxy = this.proxies[this.currentProxyIndex];
            
            try {
                const proxyUrl = proxy.url + encodeURIComponent(urlWithCacheBust);
                this.log(`Attempt ${attempt + 1}: Using ${proxy.name}`);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000);
                
                const response = await fetch(proxyUrl, {
                    method: 'GET',
                    headers: { 
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    const text = await response.text();
                    
                    try {
                        const data = JSON.parse(text);
                        
                        if (!data.data || !data.data.runs) {
                            throw new Error('Invalid response structure');
                        }
                        
                        this.log(`✅ Success via ${proxy.name} (${text.length} chars)`, 'success');
                        this.consecutiveErrors = 0;
                        this.lastSuccessTime = Date.now();
                        
                        return data;
                    } catch (parseError) {
                        this.log(`Invalid JSON from ${proxy.name}: ${parseError.message}`, 'error');
                        throw parseError;
                    }
                } else {
                    this.log(`${proxy.name} returned ${response.status}`, 'warn');
                }
            } catch (error) {
                this.log(`${proxy.name} failed: ${error.message}`, 'error');
            }
            
            this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        throw new Error('All proxies failed after multiple attempts');
    }

    parseRaceData(apiResponse) {
        if (!apiResponse || !apiResponse.data) {
            throw new Error('Invalid API response structure');
        }

        const data = apiResponse.data;
        
        const raceInfo = {
            status: data.status_string,
            eventName: data.event_name,
            timeLeft: data.time_left,
            timeLeftSeconds: data.time_left_in_seconds,
            totalLaps: data.total_laps,
            currentLap: data.current_lap,
            isEndurance: data.is_endurance,
            hasPits: data.has_pits,
            timestamp: data.timestamp
        };

        const competitors = (data.runs || []).map(run => ({
            id: run.id,
            position: run.pos,
            name: run.name,
            team: run.team,
            kart: run.kart,
            kartId: run.kart_id,
            totalLaps: run.total_laps,
            lastLap: run.last_time,
            lastLapMs: run.last_time_raw,
            prevLapMs: run.prev_time_raw,
            bestLap: run.best_time,
            bestLapMs: run.best_time_raw,
            avgLap: run.avg_lap,
            avgLapMs: run.avg_lap_raw,
            consistency: run.consistency_lap,
            gap: run.gap,
            interval: run.int,
            inPit: run.in_pit,
            pitCount: run.number_of_pits,
            currentLapMs: run.current_lap_milliseconds,
            status: run.run_status
        }));

        return {
            race: raceInfo,
            competitors: competitors,
            rawData: apiResponse
        };
    }

    findOurTeam(competitors) {
        const searchTerm = (this.config.searchTerm || '').toUpperCase().trim();
        
        if (!searchTerm) {
            return competitors[0];
        }

        const found = competitors.find(c => {
            // בדיקת תקינות (Safety Check) לפני המרה לאותיות גדולות
            // זה מונע את השגיאה Cannot read properties of null
            const team = (c.team || '').toString().toUpperCase();
            const name = (c.name || '').toString().toUpperCase();
            const kart = (c.kart || '').toString().toUpperCase();
            
            return team.includes(searchTerm) ||
                   name.includes(searchTerm) ||
                   kart === searchTerm ||
                   kart.replace(/\D/g, '') === searchTerm.replace(/\D/g, '');
        });

        if (!found) {
            this.log(`⚠️ Team/driver not found with search: "${searchTerm}"`, 'warn');
        }

        return found || null;
    }

    async fetchLiveData() {
        try {
            this.log(`\n=== Update #${this.updateCount + 1} ===`);
            
            const startTime = Date.now();
            const apiResponse = await this.fetchWithProxy(this.apiUrl);
            const fetchDuration = Date.now() - startTime;
            
            this.log(`Fetch completed in ${fetchDuration}ms`);
            
            const parsedData = this.parseRaceData(apiResponse);
            const ourTeam = this.findOurTeam(parsedData.competitors);
            
            const result = {
                ...parsedData,
                ourTeam: ourTeam,
                found: !!ourTeam,
                updateNumber: this.updateCount,
                fetchDuration: fetchDuration
            };

            if (this.lastData) {
                const timeChanged = result.race.timeLeftSeconds !== this.lastData.race.timeLeftSeconds;
                const lapChanged = result.race.currentLap !== this.lastData.race.currentLap;
                
                if (timeChanged || lapChanged) {
                    this.log(`✅ Data changed! Time: ${result.race.timeLeft}, Lap: ${result.race.currentLap}`, 'success');
                }
            }

            this.lastData = result;
            this.updateCount++;
            
            if (this.config.onUpdate) {
                this.config.onUpdate(result);
            }

            return result;

        } catch (error) {
            this.consecutiveErrors++;
            this.log(`❌ Error (${this.consecutiveErrors} consecutive): ${error.message}`, 'error');
            
            if (this.config.onError) {
                this.config.onError(error, this.consecutiveErrors);
            }
            
            if (this.consecutiveErrors >= 5) {
                this.log('🛑 Too many consecutive errors, stopping scraper', 'error');
                this.stop();
            }
            
            throw error;
        }
    }

    start() {
        if (this.isRunning) {
            this.log('Already running', 'warn');
            return;
        }

        this.log('🚀 Starting live timing scraper...');
        this.log(`Race: ${this.config.raceSlug}`);
        this.log(`Search: "${this.config.searchTerm}"`);
        this.log(`Interval: ${this.config.updateInterval}ms`);
        
        this.isRunning = true;
        this.consecutiveErrors = 0;
        this.updateCount = 0;
        
        this.fetchLiveData().catch(e => {
            this.log(`Initial fetch failed: ${e.message}`, 'error');
        });
        
        this.intervalId = setInterval(() => {
            if (this.isRunning) {
                this.fetchLiveData().catch(e => {});
            }
        }, this.config.updateInterval);
        
        this.log('✅ Scraper started successfully');
    }

    stop() {
        if (!this.isRunning) {
            this.log('Not running', 'warn');
            return;
        }

        this.log('⏹️ Stopping live timing scraper...');
        this.isRunning = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        this.log('✅ Scraper stopped');
    }

    getStats() {
        return {
            isRunning: this.isRunning,
            updateCount: this.updateCount,
            consecutiveErrors: this.consecutiveErrors,
            lastSuccessTime: this.lastSuccessTime,
            timeSinceLastSuccess: this.lastSuccessTime ? Date.now() - this.lastSuccessTime : null
        };
    }
}

// Helper functions
function formatLapTime(ms) {
    if (!ms) return '--:--.---';
    const seconds = Math.floor(ms / 1000);
    const millis = ms % 1000;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
}

function parseGap(gapStr) {
    if (!gapStr || gapStr === '-') return 0;
    return parseFloat(gapStr.replace('+', '')) || 0;
}

function calculateUndercutWindow(ourTeam, competitors) {
    if (!ourTeam) return null;
    
    const position = ourTeam.position;
    const carAhead = competitors.find(c => c.position === position - 1);
    const carBehind = competitors.find(c => c.position === position + 1);
    
    if (!carAhead) {
        return { 
            status: 'leading', 
            message: '🏆 Leading!',
            canUndercut: false
        };
    }
    
    const gapToAhead = parseGap(ourTeam.interval);
    const gapFromBehind = carBehind ? parseGap(carBehind.interval) : 999;
    
    const undercut = {
        canUndercut: gapToAhead < 25 && gapToAhead > 5,
        risk: gapFromBehind < 20 ? 'high' : 'low',
        gapToAhead: gapToAhead,
        gapFromBehind: gapFromBehind,
        carAhead: carAhead.name,
        carBehind: carBehind ? carBehind.name : 'None',
        recommendation: ''
    };
    
    if (undercut.canUndercut && undercut.risk === 'low') {
        undercut.recommendation = '✅ UNDERCUT OPPORTUNITY!';
        undercut.status = 'good';
    } else if (undercut.canUndercut && undercut.risk === 'high') {
        undercut.recommendation = '⚠️ Undercut possible but risky';
        undercut.status = 'warning';
    } else if (gapToAhead < 5) {
        undercut.recommendation = '⚠️ Too close';
        undercut.status = 'warning';
    } else {
        undercut.recommendation = '❌ Stay out';
        undercut.status = 'bad';
    }
    
    return undercut;
}

// Export to window for browser usage
window.RaceFacerScraper = RaceFacerScraper;
window.formatLapTime = formatLapTime;
window.parseGap = parseGap;
window.calculateUndercutWindow = calculateUndercutWindow;
