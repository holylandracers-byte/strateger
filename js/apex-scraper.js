/**
 * Apex Timing Live Scraper V3 (WebSocket with Pipe-Delimited Parser)
 * For Strateger
 */

class ApexTimingScraper {
    constructor(config) {
        this.config = {
            raceUrl: config.raceUrl || '',
            searchTerm: config.searchTerm || '',
            updateInterval: config.updateInterval || 1000,
            onUpdate: config.onUpdate || null,
            onError: config.onError || null,
            debug: config.debug || false
        };
        
        this.isRunning = false;
        this.ws = null;
        this.wsConnected = false;
        
        // Data storage
        this.competitors = new Map(); // rowId -> competitor data
        this.gridInitialized = false;
        
        this.host = this.extractHost(config.raceUrl);
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

    // ================= WebSocket Logic =================
    
    startWebSocket() {
        const wsUrl = `wss://${this.host}:8523/`;
        
        this.log(`🔌 Connecting to WSS: ${wsUrl}`);
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                this.log('⚡ WebSocket Connected to Apex');
                this.wsConnected = true;
                // Scrape initial grid data via HTTP since WS may not send it
                this.scrapeInitialGrid();
            };
            
            this.ws.onmessage = (event) => {
                if (this.config.debug) {
                    this.log(`📨 WS Message (${event.data.length} chars)`);
                }
                this.parseApexMessage(event.data);
            };
            
            this.ws.onerror = (error) => {
                this.log('WebSocket Error', 'error');
                if (this.config.onError) {
                    this.config.onError('WebSocket connection failed');
                }
            };
            
            this.ws.onclose = () => {
                this.log('WebSocket Closed', 'warn');
                this.wsConnected = false;
                if (this.isRunning) {
                    // Try to reconnect after 3 seconds
                    setTimeout(() => {
                        if (this.isRunning) this.startWebSocket();
                    }, 3000);
                }
            };
            
        } catch (e) {
            this.log(`WS Setup Failed: ${e.message}`, 'error');
            if (this.config.onError) {
                this.config.onError(e.message);
            }
        }
    }

    // ================= Initial Grid Scraping =================

    async scrapeInitialGrid() {
        try {
            this.log('🌐 Fetching initial grid via HTTP');
            const response = await fetch(this.config.raceUrl);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            const html = await response.text();
            
            // Parse the HTML to find the grid table
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            // Look for the main timing table (adjust selector as needed)
            const table = doc.querySelector('table') || doc.querySelector('.timing-table') || doc.querySelector('#grid');
            if (!table) {
                this.log('No grid table found in HTML', 'warn');
                return;
            }
            
            const htmlString = table.innerHTML;
            this.log(`📋 Scraped grid HTML (${htmlString.length} chars)`);
            this.parseGridHtml(htmlString);
            
        } catch (error) {
            this.log(`Initial grid scrape failed: ${error.message}`, 'error');
        }
    }

    // ================= Apex Message Parser =================

    parseApexMessage(message) {
        // Apex sends pipe-delimited commands
        const lines = message.split('\n');
        
        if (this.config.debug && lines.length > 0) {
            this.log(`📨 Message has ${lines.length} lines. First 3:`);
            lines.slice(0, 3).forEach((line, i) => {
                const preview = line.length > 100 ? line.substring(0, 100) + '...' : line;
                this.log(`  Line ${i}: "${preview}"`);
            });
        }
        
        lines.forEach(line => {
            if (!line.trim()) return;
            
            const parts = line.split('|');
            const key = parts[0];
            
            if (this.config.debug && key === 'grid') {
                this.log(`📋 Grid parts: key="${key}", parts.length=${parts.length}, parts[1] length=${parts[1]?.length || 0}`);
                if (parts.length > 1 && parts[1].length < 200) {
                    this.log(`Grid content preview: "${parts[1]}"`);
                }
            }
            
            // Initial grid data (HTML table)
            if (key === 'grid' && parts.length > 1) {
                this.log(`📋 Received grid message (${parts[1].length} chars HTML)`);
                this.parseGridHtml(parts[1]);
                return;
            }
            
            // Cell update: r59c2|in|
            if (key.match(/^r\d+c\d+$/)) {
                const match = key.match(/^r(\d+)c(\d+)$/);
                if (match) {
                    const rowId = 'r' + match[1];
                    const colId = parseInt(match[2]);
                    const value = parts[1] || '';
                    this.updateCell(rowId, colId, value);
                }
                return;
            }
            
            // Row update with lap data: r66|*|67641|27171
            if (key.match(/^r\d+$/) && parts[1] === '*') {
                const rowId = key;
                const lastLapMs = parts[2] ? parseInt(parts[2]) : null;
                const sector1Ms = parts[3] ? parseInt(parts[3]) : null;
                this.updateLapData(rowId, lastLapMs, sector1Ms);
                return;
            }
            
            // Position update: r66|#|5
            if (key.match(/^r\d+$/) && parts[1] === '#') {
                const rowId = key;
                const position = parseInt(parts[2]);
                this.updatePosition(rowId, position);
                return;
            }
        });
        
        // Trigger update callback if we have data
        if (this.gridInitialized && this.competitors.size > 0) {
            this.sendUpdate();
        }
    }

    parseGridHtml(htmlString) {
        // Parse the initial grid HTML to extract driver info
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<table>${htmlString}</table>`, 'text/html');
        const rows = doc.querySelectorAll('tr[data-id^="r"]');
        
        this.log(`📋 Parsing grid HTML, found ${rows.length} rows`);
        
        rows.forEach(row => {
            const rowId = row.getAttribute('data-id');
            if (rowId === 'r0') return; // Skip header
            
            const cells = row.querySelectorAll('td');
            
            if (this.config.debug && this.competitors.size === 0) {
                // Log first row's cells to see structure
                this.log(`First row cells (${cells.length} total):`, Array.from(cells).map((c, i) => `[${i}]="${c.textContent.trim()}"`).join(', '));
            }
            
            const competitor = {
                rowId: rowId,
                position: this.getCellText(cells, 2),
                kart: this.getCellText(cells, 3),
                driver: this.getCellText(cells, 4),
                firstName: this.getCellText(cells, 5),
                lastName: this.getCellText(cells, 6),
                sector1: this.getCellText(cells, 7),
                sector2: this.getCellText(cells, 8),
                sector3: this.getCellText(cells, 9),
                lastLap: this.getCellText(cells, 10),
                bestLap: this.getCellText(cells, 11),
                gap: this.getCellText(cells, 12),
                laps: this.getCellText(cells, 13),
                lastLapMs: this.parseTimeToMs(this.getCellText(cells, 10)),
                bestLapMs: this.parseTimeToMs(this.getCellText(cells, 11))
            };
            
            this.competitors.set(rowId, competitor);
        });
        
        this.gridInitialized = true;
        this.log(`Grid initialized with ${this.competitors.size} competitors`);
        
        // Log first competitor as example
        if (this.competitors.size > 0 && this.config.debug) {
            const first = Array.from(this.competitors.values())[0];
            this.log(`Example competitor:`, first);
            this.log(`Cells parsed - driver: "${first.driver}", lastName: "${first.lastName}", kart: "${first.kart}"`);
        }
    }

    getCellText(cells, index) {
        if (!cells[index]) return '';
        return cells[index].textContent.trim();
    }

    updateCell(rowId, colId, value) {
        if (!this.competitors.has(rowId)) {
            this.competitors.set(rowId, { rowId });
        }
        
        const competitor = this.competitors.get(rowId);
        
        // Map column IDs to properties
        switch(colId) {
            case 3: competitor.position = value; break;
            case 4: competitor.kart = value; break;
            case 5: competitor.driver = value; break;
            case 6: competitor.firstName = value; break;
            case 7: competitor.lastName = value; break;
            case 8: competitor.sector1 = value; break;
            case 9: competitor.sector2 = value; break;
            case 10: competitor.sector3 = value; break;
            case 11: 
                competitor.lastLap = value;
                competitor.lastLapMs = this.parseTimeToMs(value);
                break;
            case 12: 
                competitor.bestLap = value;
                competitor.bestLapMs = this.parseTimeToMs(value);
                break;
            case 13: competitor.gap = value; break;
            case 14: competitor.laps = value; break;
        }
    }

    updateLapData(rowId, lastLapMs, sector1Ms) {
        if (!this.competitors.has(rowId)) return;
        
        const competitor = this.competitors.get(rowId);
        if (lastLapMs) {
            competitor.lastLapMs = lastLapMs;
            competitor.lastLap = this.formatMsToTime(lastLapMs);
        }
    }

    updatePosition(rowId, position) {
        if (!this.competitors.has(rowId)) return;
        
        const competitor = this.competitors.get(rowId);
        competitor.position = position.toString();
    }

    sendUpdate() {
        this.log(`🔄 Preparing update: ${this.competitors.size} total competitors`);
        
        // Debug: show what's in competitors before filtering
        if (this.config.debug && this.competitors.size > 0) {
            const sample = Array.from(this.competitors.values())[0];
            this.log(`Sample before filter: position=${sample.position}, kart=${sample.kart}, driver="${sample.driver}", lastName="${sample.lastName}"`);
        }
        
        const competitorsArray = Array.from(this.competitors.values())
            .filter(c => c.driver) // Only include rows with driver names
            .sort((a, b) => {
                const posA = parseInt(a.position) || 999;
                const posB = parseInt(b.position) || 999;
                return posA - posB;
            })
            .map(c => ({
                position: parseInt(c.position) || 0,
                name: c.driver || 'Unknown',
                team: c.lastName || '',
                kart: c.kart || '',
                laps: parseInt(c.laps) || 0,
                lastLap: c.lastLap || '',
                lastLapMs: c.lastLapMs,
                bestLap: c.bestLap || '',
                bestLapMs: c.bestLapMs,
                gap: c.gap || '-',
                inPit: false
            }));
        
        const ourTeam = this.findOurTeam(competitorsArray);
        
        this.log(`📊 Sending ${competitorsArray.length} competitors, ourTeam: ${ourTeam ? ourTeam.name : 'not found'}`);
        
        if (this.config.onUpdate) {
            this.config.onUpdate({
                competitors: competitorsArray,
                ourTeam: ourTeam,
                found: !!ourTeam,
                provider: 'apex-ws'
            });
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

    formatMsToTime(ms) {
        if (ms == null || isNaN(ms)) return '';
        const total = Number(ms);
        const minutes = Math.floor(total / 60000);
        const seconds = Math.floor((total % 60000) / 1000);
        const millis = total % 1000;
        const msStr = String(millis).padStart(3, '0');
        if (minutes > 0) {
            return `${minutes}:${String(seconds).padStart(2, '0')}.${msStr}`;
        }
        return `${String(seconds).padStart(2, '0')}.${msStr}`;
    }

    findOurTeam(competitors) {
        const term = this.config.searchTerm.toUpperCase().trim();
        if (!term) return competitors[0];
        
        this.log(`🔍 Searching for: "${term}" in ${competitors.length} competitors`);
        
        const found = competitors.find(c => {
            const teamMatch = c.team && c.team.toUpperCase().includes(term);
            const nameMatch = c.name && c.name.toUpperCase().includes(term);
            const kartMatch = c.kart && (
                c.kart.toUpperCase() === term || 
                c.kart === term || 
                String(parseInt(c.kart)) === String(parseInt(term))
            );
            
            if (teamMatch || nameMatch || kartMatch) {
                this.log(`✅ Found match: ${c.name} (Kart: ${c.kart}, Team: ${c.team})`);
            }
            
            return teamMatch || nameMatch || kartMatch;
        });
        
        if (!found) {
            this.log(`❌ No match found for "${term}"`);
            if (competitors.length > 0) {
                this.log(`Available karts: ${competitors.map(c => c.kart).join(', ')}`);
            }
        }
        
        return found;
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