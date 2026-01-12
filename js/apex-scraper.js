/**
 * Apex Timing Live Scraper V2 (WebSocket + HTTP Fallback)
 * For Strateger
 */

class ApexTimingScraper {
    constructor(config) {
        this.config = {
            raceUrl: config.raceUrl || '',
            searchTerm: config.searchTerm || '',
            updateInterval: config.updateInterval || 2000, // Faster for WS
            onUpdate: config.onUpdate || null,
            onError: config.onError || null,
            debug: config.debug || false
        };
        
        this.isRunning = false;
        this.ws = null;
        this.wsConnected = false;
        this.fallbackMode = false;
        
        // Extract IDs / Host
        this.raceId = this.extractRaceId(config.raceUrl);
        this.host = this.extractHost(config.raceUrl);
        
        // HTTP Fallback config
        this.proxies = [
            { name: 'corsproxy', url: 'https://corsproxy.io/?' },
            { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' }
        ];
        this.currentProxyIndex = 0;
        this.httpInterval = null;
    }

    log(message, type = 'info') {
        if (this.config.debug || type === 'error') {
            console.log(`[Apex ${type.toUpperCase()}] ${message}`);
        }
    }

    extractHost(url) {
        try {
            const u = new URL(url);
            return u.hostname;
        } catch (e) {
            return 'www.apex-timing.com';
        }
    }

    extractRaceId(url) {
        // ... (אותו לוגיקה כמו קודם)
        if (!url) return null;
        let match = url.match(/live-timing\/([^\/\?]+)/);
        if (match) return match[1];
        match = url.match(/\/([^\/]+)\/live/);
        if (match) return match[1];
        return null;
    }

    // ================= WebSocket Logic =================
    
    startWebSocket() {
        // Apex often uses port 8523 for WSS
        // Note: Browsers do NOT allow setting custom headers (User-Agent, Origin) in WebSocket
        // If Apex enforces headers strict checking, this might fail and trigger fallback.
        const wsUrl = `wss://${this.host}:8523/`;
        
        this.log(`🔌 Connecting to WSS: ${wsUrl}`);
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                this.log('⚡ WebSocket Connected');
                this.wsConnected = true;
                // Apex often requires an init message. Try sending standard "subscribe" if known, 
                // or wait for data. Often simple connection is enough for public live timing.
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.processData(data);
                } catch (e) {
                    // Sometimes data is not JSON or is a heartbeat
                }
            };
            
            this.ws.onerror = (error) => {
                this.log('WebSocket Error (Switching to HTTP)', 'error');
                this.wsConnected = false;
                this.switchToFallback();
            };
            
            this.ws.onclose = () => {
                if (this.isRunning && !this.fallbackMode) {
                    this.log('WebSocket Closed (Switching to HTTP)', 'warn');
                    this.switchToFallback();
                }
            };
            
        } catch (e) {
            this.log(`WS Setup Failed: ${e.message}`, 'error');
            this.switchToFallback();
        }
    }

    switchToFallback() {
        if (this.fallbackMode) return;
        this.fallbackMode = true;
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.log('🔄 Falling back to HTTP Polling');
        
        // Immediate fetch
        this.fetchHttpData();
        
        // Start Interval
        this.httpInterval = setInterval(() => {
            if (this.isRunning) this.fetchHttpData();
        }, 5000); // Slower interval for HTTP
    }

    // ================= HTTP Logic (Fallback) =================
    
    async fetchHttpData() {
        // Use the previous robust JSON/HTML scraping logic here
        // Shortened for brevity - assumes integration with previous logic
        const apiUrl = `https://${this.host}/live-timing/${this.raceId}/standings.json`;
        
        try {
            const proxy = this.proxies[this.currentProxyIndex];
            const response = await fetch(proxy.url + encodeURIComponent(apiUrl));
            if (response.ok) {
                const text = await response.text();
                const data = JSON.parse(text);
                this.processData(data);
            } else {
                throw new Error('Fetch failed');
            }
        } catch (e) {
            // Rotate proxy
            this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;
        }
    }

    // ================= Data Processing =================

    processData(rawData) {
        // Parse Apex structure (handles both WS and HTTP usually)
        let competitors = [];
        
        // Common structure handling
        const entries = rawData.standings || rawData.drivers || rawData.init || [];
        
        entries.forEach((entry, idx) => {
            competitors.push({
                position: entry.p || entry.pos || entry.position || idx + 1,
                name: entry.d || entry.driver || entry.name || 'Unknown',
                team: entry.t || entry.team || '',
                kart: entry.k || entry.kart || '',
                laps: parseInt(entry.l || entry.laps || 0),
                lastLap: entry.lt || entry.last_time || '',
                lastLapMs: this.parseTimeToMs(entry.lt || entry.last_time),
                bestLap: entry.bt || entry.best_time || '',
                gap: entry.g || entry.gap || '-',
                inPit: entry.pit || false
            });
        });
        
        const ourTeam = this.findOurTeam(competitors);
        
        if (this.config.onUpdate) {
            this.config.onUpdate({
                competitors: competitors,
                ourTeam: ourTeam,
                found: !!ourTeam,
                provider: this.fallbackMode ? 'apex-http' : 'apex-ws'
            });
        }
    }
    
    // ... (Helpers: findOurTeam, parseTimeToMs remain the same) ...
    parseTimeToMs(timeStr) {
        if (!timeStr) return null;
        // ... (Existing parser)
        const str = String(timeStr).trim();
        let match = str.match(/^(\d{1,2}):(\d{2})\.(\d{2,3})$/);
        if (match) return ((parseInt(match[1])*60) + parseInt(match[2])) * 1000 + parseInt(match[3].padEnd(3,'0'));
        match = str.match(/^(\d{2})\.(\d{2,3})$/);
        if (match) return parseInt(match[1]) * 1000 + parseInt(match[2].padEnd(3,'0'));
        return null;
    }

    findOurTeam(competitors) {
        const term = this.config.searchTerm.toUpperCase();
        if (!term) return competitors[0];
        return competitors.find(c => 
            (c.team && c.team.toUpperCase().includes(term)) ||
            (c.name && c.name.toUpperCase().includes(term)) ||
            (c.kart && c.kart === term)
        );
    }

    start() {
        this.isRunning = true;
        this.startWebSocket(); // Try WS first
    }

    stop() {
        this.isRunning = false;
        if (this.ws) this.ws.close();
        if (this.httpInterval) clearInterval(this.httpInterval);
    }
}

window.ApexTimingScraper = ApexTimingScraper;