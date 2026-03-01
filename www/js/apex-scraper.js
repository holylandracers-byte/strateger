class ApexTimingScraper {
    constructor(config) {
        config = config || {};
        this.ws = null;
        this.competitors = new Map();
        this.isRunning = false;
        this.raceUrl = config.raceUrl || '';
        this.wsUrl = '';
        this.pollInterval = null;
        this.consecutiveErrors = 0;
        this.maxConsecutiveErrors = 15;
        this.searchTerm = config.searchTerm || '';
        this.searchType = config.searchType || 'team';
        this.gridHtml = '';
        this.sessionId = '';
        this.debug = config.debug || false;
        this._activeController = null;
        this._errorLogThrottle = {};

        // Callbacks from LiveTimingManager
        this.onUpdate = config.onUpdate || null;
        this.onError = config.onError || null;
    }

    log(level, msg) {
        const prefix = `[Apex ${level}]`;
        // Throttle repeated error messages (same message within 30s)
        if (level === 'ERROR' || level === 'WARN') {
            const key = String(msg).substring(0, 80);
            const now = Date.now();
            if (this._errorLogThrottle[key] && (now - this._errorLogThrottle[key]) < 30000) {
                return;
            }
            this._errorLogThrottle[key] = now;
        }
        if (level === 'ERROR') console.error(`${prefix} ${msg}`);
        else if (level === 'WARN') console.warn(`${prefix} ${msg}`);
        else if (this.debug || level !== 'INFO') console.log(`${prefix} ${msg}`);
        else console.log(`${prefix} ${msg}`);
    }

    async start(url, searchConfig) {
        // Support both: start() with no args (manager style) or start(url) with args
        if (url) this.raceUrl = url;
        if (searchConfig) this.searchTerm = searchConfig.value || searchConfig;
        
        if (!this.raceUrl) {
            this.log('ERROR', 'No race URL provided');
            return;
        }

        this.isRunning = true;
        this.consecutiveErrors = 0;

        // Build WSS URL from the race page URL
        try {
            const urlObj = new URL(this.raceUrl);
            this.wsUrl = `wss://${urlObj.hostname}:8523/`;
        } catch (e) {
            this.log('ERROR', `Invalid race URL: ${this.raceUrl}`);
            return;
        }

        this.log('INFO', `🔌 Race URL: ${this.raceUrl}`);
        this.log('INFO', `🔌 WS URL: ${this.wsUrl}`);
        this.log('INFO', `🔍 Search term: "${this.searchTerm}"`);

        this.connectWebSocket();
        this.scrapeInitialGrid();
    }

    extractHost(url) {
        try { return new URL(url).hostname; } catch (e) { return 'www.apex-timing.com'; }
    }

    extractRaceId(url) {
        try {
            const parts = new URL(url).pathname.split('/').filter(Boolean);
            const ltIdx = parts.indexOf('live-timing');
            return (ltIdx >= 0 && parts[ltIdx + 1]) ? parts[ltIdx + 1] : (parts[parts.length - 1] || 'race');
        } catch (e) { return 'race'; }
    }

    /* REMOVED: detectWebSocketUrl - was causing Invalid URL errors
    */

    connectWebSocket() {
        if (!this.isRunning) return;

        this.log('INFO', `🔌 Connecting to WSS: ${this.wsUrl}`);
        
        try {
            this.ws = new WebSocket(this.wsUrl);
        } catch (e) {
            this.log('ERROR', `WebSocket creation failed: ${e.message}`);
            this.scheduleReconnect();
            return;
        }

        this.ws.onopen = () => {
            this.log('INFO', '⚡ WebSocket Connected to Apex');
            this.consecutiveErrors = 0;
        };

        this.ws.onmessage = (event) => {
            try {
                this.handleMessage(event.data);
            } catch (e) {
                this.log('ERROR', `Message handling error: ${e.message}`);
            }
        };

        this.ws.onclose = () => {
            this.log('WARN', 'WebSocket Closed');
            if (this.isRunning) {
                this.scheduleReconnect();
            }
        };

        this.ws.onerror = (err) => {
            this.log('ERROR', 'WebSocket Error');
            this.consecutiveErrors++;
            if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
                this.log('ERROR', '🛑 Too many consecutive errors, stopping');
                this.stop();
                if (this.onError) this.onError(new Error('Too many WebSocket errors'));
            }
        };
    }

    scheduleReconnect() {
        if (!this.isRunning) return;
        const delay = Math.min(2000 * Math.pow(2, this.consecutiveErrors), 30000);
        this.log('INFO', `Reconnecting in ${delay / 1000}s...`);
        setTimeout(() => this.connectWebSocket(), delay);
    }

    handleMessage(data) {
        const lines = data.split('\n');
        
        this.log('INFO', `📨 WS Message (${data.length} chars)`);
        this.log('INFO', `📨 Message has ${lines.length} lines. First 3:`);
        for (let i = 0; i < Math.min(3, lines.length); i++) {
            this.log('INFO', `  Line ${i}: "${lines[i].substring(0, 80)}"`);
        }

        for (const line of lines) {
            if (!line.trim()) continue;
            const pipeIdx = line.indexOf('|');
            if (pipeIdx === -1) continue;

            const key = line.substring(0, pipeIdx);
            const rest = line.substring(pipeIdx + 1);

            if (key === 'grid') {
                // Format: grid|<sessionId>|<html>
                // rest = "<sessionId>|<html>"
                const secondPipe = rest.indexOf('|');
                let gridHtml = '';
                if (secondPipe !== -1) {
                    this.sessionId = rest.substring(0, secondPipe);
                    gridHtml = rest.substring(secondPipe + 1);
                } else {
                    // Fallback: rest is just HTML directly
                    gridHtml = rest;
                }
                this.log('INFO', `📋 Received grid message (${gridHtml.length} chars HTML), sessionId="${this.sessionId}"`);
                if (gridHtml.length > 0) {
                    this.gridHtml = gridHtml;
                    this.parseGridHTML(gridHtml);
                } else {
                    this.log('WARN', '📋 Grid HTML was empty in WS message — waiting for HTTP fallback');
                }
            } else if (key === 'r' || key.startsWith('r')) {
                this.handleRowUpdate(line);
            } else if (key === 'title') {
                this.log('INFO', `🏁 Race title: ${rest}`);
            } else if (key === 'comment') {
                this.log('INFO', `💬 Comment: ${rest}`);
            } else if (key === 'init') {
                this.log('INFO', `🔧 Init: ${rest}`);
            } else if (key === 'best') {
                this.log('INFO', `🏆 Best: ${rest}`);
            } else if (key === 'css') {
                // Style info, skip
            } else if (key === 'ti') {
                this.log('INFO', `⏱️ Timer: ${rest}`);
            }
        }
    }

    handleRowUpdate(line) {
        // Cell update: r<rowId>c<colIdx>|<value>|
        const cellMatch = line.match(/^(r\d+)c(\d+)\|([^|]*)\|?$/);
        if (cellMatch) {
            const rowId = cellMatch[1];
            const colIdx = parseInt(cellMatch[2]);
            const value = cellMatch[3];
            
            const comp = this.competitors.get(rowId);
            if (comp) {
                this.updateCompetitorCell(comp, colIdx, value);
                this.emitUpdate();
            }
            return;
        }

        // Lap update: r<rowId>|*|<laptime>|<totaltime>
        const lapMatch = line.match(/^(r\d+)\|\*\|([^|]*)\|([^|]*)/);
        if (lapMatch) {
            const rowId = lapMatch[1];
            const lapTime = lapMatch[2];
            const comp = this.competitors.get(rowId);
            if (comp) {
                comp.lastLap = lapTime;
                const lapMs = this.parseTimeToMs(lapTime);
                if (lapMs > 0 && (!comp.bestLapMs || lapMs < comp.bestLapMs)) {
                    comp.bestLap = lapTime;
                    comp.bestLapMs = lapMs;
                }
                comp.totalLaps = (comp.totalLaps || 0) + 1;
                this.emitUpdate();
            }
            return;
        }

        // Position update: r<rowId>|#|<position>
        const posMatch = line.match(/^(r\d+)\|#\|(\d+)/);
        if (posMatch) {
            const rowId = posMatch[1];
            const newPos = parseInt(posMatch[2]);
            const comp = this.competitors.get(rowId);
            if (comp) {
                comp.previousPosition = comp.position;
                comp.position = newPos;
                this.emitUpdate();
            }
            return;
        }

        // Pit status: r<rowId>|p|<0or1>
        const pitMatch = line.match(/^(r\d+)\|p\|(\d)/);
        if (pitMatch) {
            const rowId = pitMatch[1];
            const inPit = pitMatch[2] === '1';
            const comp = this.competitors.get(rowId);
            if (comp) {
                comp.inPit = inPit;
                this.emitUpdate();
            }
            return;
        }
    }

    updateCompetitorCell(comp, colIdx, value) {
        // Apex column mapping (standard layout):
        // 0,1 = hidden status cells
        // 2 = position (Rnk)
        // 3 = kart number
        // 4 = driver name/alias
        // 5 = first name
        // 6 = last name
        // 7 = S1
        // 8 = S2
        // 9 = S3
        // 10 = last lap
        // 11 = best lap
        // 12 = gap
        // 13 = laps
        switch (colIdx) {
            case 2: comp.position = parseInt(value) || comp.position; break;
            case 3: comp.kartNumber = value; break;
            case 4: comp.driverName = value; break;
            case 5: comp.firstName = value; break;
            case 6: comp.lastName = value; break;
            case 7: comp.sector1 = value; break;
            case 8: comp.sector2 = value; break;
            case 9: comp.sector3 = value; break;
            case 10: 
                comp.lastLap = value; 
                const ms = this.parseTimeToMs(value);
                if (ms > 0) {
                    comp.lastLapMs = ms;
                    if (!comp.bestLapMs || ms < comp.bestLapMs) {
                        comp.bestLapMs = ms;
                        comp.bestLap = value;
                    }
                }
                break;
            case 11: 
                comp.bestLap = value; 
                comp.bestLapMs = this.parseTimeToMs(value);
                break;
            case 12: comp.gap = value; break;
            case 13: comp.totalLaps = parseInt(value) || 0; break;
        }
    }

    parseGridHTML(html) {
        const parser = new DOMParser();
        // Wrap in a basic HTML structure to ensure proper parsing
        const doc = parser.parseFromString(`<html><body><table>${html}</table></body></html>`, 'text/html');
        
        // Try multiple selectors to find rows — Apex uses various structures
        let rows = doc.querySelectorAll('tr[id^="r"]');
        
        if (rows.length === 0) {
            // Try just all TRs with cells
            rows = doc.querySelectorAll('tr');
            // Filter out header rows (rows without enough cells or without numeric position)
            rows = Array.from(rows).filter(tr => {
                const cells = tr.querySelectorAll('td');
                return cells.length >= 10; // Apex rows have 14 cells (2 hidden + 12 visible)
            });
        }

        this.log('INFO', `📋 Parsing grid HTML, found ${rows.length} rows`);

        if (rows.length === 0 && html.length > 100) {
            // Debug: show what tags exist
            const allTags = doc.querySelectorAll('*');
            const tagNames = new Set();
            allTags.forEach(el => tagNames.add(el.tagName.toLowerCase()));
            this.log('WARN', `📋 HTML tags found: ${[...tagNames].join(', ')}`);
            
            // Try to find any element with an id starting with 'r' followed by digits
            const rElements = doc.querySelectorAll('[id^="r"]');
            this.log('WARN', `📋 Elements with id^="r": ${rElements.length}`);
            if (rElements.length > 0) {
                this.log('WARN', `📋 First r-element: tag=${rElements[0].tagName}, id=${rElements[0].id}, children=${rElements[0].children.length}`);
            }
            
            // Last resort: try parsing as raw HTML with regex
            this.parseGridHTMLRegex(html);
            return;
        }

        this.competitors.clear();

        for (const row of rows) {
            const cells = row.querySelectorAll('td');
            if (cells.length < 10) continue;

            const rowId = row.id || `r${this.competitors.size}`;
            
            const comp = {
                rowId: rowId,
                position: parseInt(cells[2]?.textContent?.trim()) || 0,
                kartNumber: cells[3]?.textContent?.trim() || '',
                driverName: cells[4]?.textContent?.trim() || '',
                firstName: cells[5]?.textContent?.trim() || '',
                lastName: cells[6]?.textContent?.trim() || '',
                sector1: cells[7]?.textContent?.trim() || '',
                sector2: cells[8]?.textContent?.trim() || '',
                sector3: cells[9]?.textContent?.trim() || '',
                lastLap: cells[10]?.textContent?.trim() || '',
                bestLap: cells[11]?.textContent?.trim() || '',
                gap: cells[12]?.textContent?.trim() || '',
                totalLaps: parseInt(cells[13]?.textContent?.trim()) || 0,
                lastLapMs: 0,
                bestLapMs: 0,
                inPit: false,
                previousPosition: 0
            };

            comp.lastLapMs = this.parseTimeToMs(comp.lastLap);
            comp.bestLapMs = this.parseTimeToMs(comp.bestLap);
            comp.previousPosition = comp.position;

            // Skip invalid/header rows (position 0 or no data)
            if (comp.position <= 0 && !comp.driverName && !comp.kartNumber) continue;

            // Check pit status from hidden cells (cells 0 and 1)
            const statusCell = cells[0]?.textContent?.trim() || cells[1]?.textContent?.trim() || '';
            if (statusCell.includes('P') || statusCell.includes('pit')) {
                comp.inPit = true;
            }

            this.competitors.set(rowId, comp);
        }

        this.log('INFO', `Grid initialized with ${this.competitors.size} competitors`);
        if (this.competitors.size > 0) {
            this.emitUpdate();
        }
    }

    parseGridHTMLRegex(html) {
        // Fallback regex parser for when DOMParser doesn't find rows
        // Look for <tr id="rXXXXX"> patterns and extract cell content
        const rowRegex = /<tr[^>]*\bid=["']?(r\d+)["']?[^>]*>([\s\S]*?)<\/tr>/gi;
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        
        this.competitors.clear();
        let match;

        while ((match = rowRegex.exec(html)) !== null) {
            const rowId = match[1];
            const rowHtml = match[2];
            const cells = [];
            let cellMatch;

            cellRegex.lastIndex = 0;
            while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
                // Strip inner HTML tags to get text content
                const text = cellMatch[1].replace(/<[^>]*>/g, '').trim();
                cells.push(text);
            }

            if (cells.length < 10) continue;

            const comp = {
                rowId: rowId,
                position: parseInt(cells[2]) || 0,
                kartNumber: cells[3] || '',
                driverName: cells[4] || '',
                firstName: cells[5] || '',
                lastName: cells[6] || '',
                sector1: cells[7] || '',
                sector2: cells[8] || '',
                sector3: cells[9] || '',
                lastLap: cells[10] || '',
                bestLap: cells[11] || '',
                gap: cells[12] || '',
                totalLaps: parseInt(cells[13]) || 0,
                lastLapMs: 0,
                bestLapMs: 0,
                inPit: false,
                previousPosition: 0
            };

            comp.lastLapMs = this.parseTimeToMs(comp.lastLap);
            comp.bestLapMs = this.parseTimeToMs(comp.bestLap);
            comp.previousPosition = comp.position;

            // Skip invalid/header rows
            if (comp.position <= 0 && !comp.driverName && !comp.kartNumber) continue;

            this.competitors.set(rowId, comp);
        }

        this.log('INFO', `Regex parser found ${this.competitors.size} competitors`);
        if (this.competitors.size > 0) {
            this.emitUpdate();
        }
    }

    parseTimeToMs(timeStr) {
        if (!timeStr || timeStr === '-') return 0;
        
        // Handle formats: "1:01.573", "61.573", "24.185"
        const parts = timeStr.match(/(?:(\d+):)?(\d+)\.(\d+)/);
        if (!parts) return 0;
        
        const minutes = parseInt(parts[1] || '0');
        const seconds = parseInt(parts[2]);
        const millis = parseInt(parts[3].padEnd(3, '0').substring(0, 3));
        
        return (minutes * 60 + seconds) * 1000 + millis;
    }

    emitUpdate() {
        if (!this.onUpdate || this.competitors.size === 0) return;

        const allCompetitors = Array.from(this.competitors.values())
            .filter(c => c.position > 0) // Filter out invalid/header rows (position 0)
            .sort((a, b) => (a.position || 999) - (b.position || 999));

        // Find our team using searchTerm + searchType for precision
        let ourTeam = null;
        const term = (this.searchTerm || '').toUpperCase().trim();

        if (term) {
            if (this.searchType === 'kart') {
                // Kart search: ONLY match by kart number (exact or parsed int)
                ourTeam = allCompetitors.find(c => {
                    return (c.kartNumber || '').trim() === term ||
                           String(parseInt(c.kartNumber)) === String(parseInt(term));
                }) || null;
            } else if (this.searchType === 'driver') {
                // Driver search: match driver/first/last name only
                ourTeam = allCompetitors.find(c => {
                    const nameMatch = (c.driverName || '').toUpperCase().includes(term);
                    const firstMatch = (c.firstName || '').toUpperCase().includes(term);
                    const lastMatch = (c.lastName || '').toUpperCase().includes(term);
                    return nameMatch || firstMatch || lastMatch;
                }) || null;
            } else {
                // Team/generic search: check all fields (name, team, kart)
                ourTeam = allCompetitors.find(c => {
                    const nameMatch = (c.driverName || '').toUpperCase().includes(term);
                    const firstMatch = (c.firstName || '').toUpperCase().includes(term);
                    const lastMatch = (c.lastName || '').toUpperCase().includes(term);
                    const kartMatch = (c.kartNumber || '').trim() === term || String(parseInt(c.kartNumber)) === String(parseInt(term));
                    return nameMatch || firstMatch || lastMatch || kartMatch;
                }) || null;
            }
        }

        // Map to field names LiveTimingManager expects: kart, laps, found
        const mapComp = c => ({
            position: c.position,
            name: c.driverName || `${c.firstName} ${c.lastName}`.trim(),
            team: c.lastName || '',
            kart: c.kartNumber || '',
            lastLap: c.lastLap || '',
            lastLapMs: c.lastLapMs || 0,
            bestLap: c.bestLap || '',
            bestLapMs: c.bestLapMs || 0,
            gap: c.gap || '-',
            laps: c.totalLaps || 0,
            totalLaps: c.totalLaps || 0,
            inPit: c.inPit || false,
            previousPosition: c.previousPosition || c.position
        });

        const result = {
            competitors: allCompetitors.map(mapComp),
            ourTeam: ourTeam ? {
                ...mapComp(ourTeam),
                sector1: ourTeam.sector1 || '',
                sector2: ourTeam.sector2 || '',
                sector3: ourTeam.sector3 || ''
            } : null,
            found: !!ourTeam,
            totalCompetitors: allCompetitors.length,
            provider: 'apex-ws'
        };

        this.log('INFO', `📊 Update: ${allCompetitors.length} competitors, ourTeam: ${ourTeam ? ourTeam.driverName : 'not found'}`);
        this.onUpdate(result);
    }

    async scrapeInitialGrid() {
        this.log('INFO', '🌐 Fetching initial grid via HTTP (with CORS proxy)');
        try {
            const html = await this.fetchWithProxy(this.raceUrl);
            
            // Extract the grid table from the full page HTML
            // Look for the main timing table — Apex uses <table id="tbl"> or similar
            const tableMatch = html.match(/<table[^>]*id=["']?tbl["']?[^>]*>([\s\S]*?)<\/table>/i) ||
                               html.match(/<table[^>]*class=["'][^"']*live[^"']*["'][^>]*>([\s\S]*?)<\/table>/i);
            
            let gridContent = '';
            if (tableMatch) {
                gridContent = tableMatch[1];
                this.log('INFO', `📋 Extracted table content (${gridContent.length} chars)`);
            } else {
                // Try to find rows directly in the full HTML
                gridContent = html;
                this.log('INFO', `📋 No table tag found, using full HTML (${html.length} chars)`);
            }

            this.log('INFO', `📋 Scraped grid HTML (${gridContent.length} chars)`);
            
            // Only use HTTP result if WS didn't already give us data
            if (this.competitors.size === 0 && gridContent.length > 0) {
                this.parseGridHTML(gridContent);
            }
        } catch (e) {
            this.log('WARN', `HTTP grid scrape failed: ${e.message}`);
        }
    }

    async fetchWithProxy(url) {
        // Cancel any previous in-flight request
        if (this._activeController) {
            try { this._activeController.abort(); } catch(e) {}
        }
        
        const controller = new AbortController();
        this._activeController = controller;
        
        const proxies = [
            { prefix: '/.netlify/functions/cors-proxy?url=', label: 'netlify-proxy', timeoutMs: 20000 },
            { prefix: 'https://corsproxy.io/?', label: 'corsproxy', timeoutMs: 12000 },
            { prefix: 'https://api.allorigins.win/raw?url=', label: 'allorigins', timeoutMs: 12000 }
        ];

        for (const proxy of proxies) {
            if (!this.isRunning || controller.signal.aborted) return '';
            
            try {
                const timeout = setTimeout(() => {
                    if (!controller.signal.aborted) controller.abort();
                }, proxy.timeoutMs);
                
                const resp = await fetch(proxy.prefix + encodeURIComponent(url), {
                    signal: controller.signal
                });
                clearTimeout(timeout);

                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                return await resp.text();
            } catch (e) {
                if (e.name === 'AbortError' && !this.isRunning) return '';
                this.log('WARN', `${proxy.label} failed: ${e.message}`);
            }
        }

        throw new Error('All proxies failed');
    }

    stop() {
        this.isRunning = false;
        
        // Abort any in-flight HTTP request
        if (this._activeController) {
            try { this._activeController.abort(); } catch(e) {}
            this._activeController = null;
        }
        
        if (this.ws) {
            try { this.ws.close(); } catch (e) {}
            this.ws = null;
        }
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
        }
        
        this._errorLogThrottle = {};
    }
}

// Export for use
window.ApexTimingScraper = ApexTimingScraper;