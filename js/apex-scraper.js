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
        this.columnMap = null;
        this._reverseColMap = null;
        this._comments = [];       // recent race-control comments
        this._maxComments = 50;
        this._emitTimer = null;
        this._lastGridAt = 0;

        // Callbacks from LiveTimingManager
        this.onUpdate = config.onUpdate || null;
        this.onError = config.onError || null;
        this.onComment = config.onComment || null;

        // Race time remaining (parsed from Apex countdown WS messages)
        this.raceTimeLeftSec = null;
        this._raceTimeReceivedAt = null;
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

        let urlObj;
        try {
            urlObj = new URL(this.raceUrl);
        } catch (e) {
            this.log('ERROR', `Invalid race URL: ${this.raceUrl}`);
            return;
        }

        this.log('INFO', `🔌 Race URL: ${this.raceUrl}`);
        this.log('INFO', `🔍 Search term: "${this.searchTerm}"`);

        // Resolve the Apex socket endpoint from the race config instead of guessing.
        // Apex uses configPort+3 for WSS (HTTPS page) and configPort+2 for WS (HTTP page).
        let socketConfig;
        try {
            socketConfig = await this.resolveSocketConfig(this.raceUrl, urlObj);
        } catch (e) {
            this.isRunning = false;
            this.log('ERROR', `Could not resolve Apex socket URL: ${e.message}`);
            if (this.onError) this.onError(e, this.consecutiveErrors);
            return;
        }

        this.wsUrl = socketConfig.wsUrl;
        this.log('INFO', `🔌 WS URL: ${this.wsUrl} (${socketConfig.source}, base ${socketConfig.configPort} → wsPort ${socketConfig.wsPort})`);

        this.connectWebSocket();
        this.scrapeInitialGrid();
    }

    getRaceBaseUrl(raceUrl) {
        const u = new URL(raceUrl);
        const path = u.pathname || '/';
        const basePath = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
        return `${u.origin}${basePath}`;
    }

    extractConfigPort(text) {
        if (!text) return null;
        const m = text.match(/var\s+configPort\s*=\s*(\d+)/i);
        if (!m) return null;
        const p = parseInt(m[1], 10);
        return Number.isFinite(p) && p > 0 ? p : null;
    }

    extractConfigScriptUrl(html, raceUrl) {
        if (!html) return null;
        const scriptMatch = html.match(/<script[^>]+src=["']([^"']*config\.js(?:\?[^"']*)?)["']/i);
        if (!scriptMatch || !scriptMatch[1]) return null;
        try {
            return new URL(scriptMatch[1], raceUrl).toString();
        } catch (e) {
            return null;
        }
    }

    async resolveSocketConfig(raceUrl, urlObj) {
        const raceProtocol = (urlObj.protocol || '').toLowerCase();
        const isSecureRace = raceProtocol === 'https:';
        const wsScheme = isSecureRace ? 'wss' : 'ws';
        const wsOffset = isSecureRace ? 3 : 2;

        const configPort = await this.fetchConfigPort(raceUrl);
        const wsPort = configPort + wsOffset;
        return {
            configPort,
            wsPort,
            wsUrl: `${wsScheme}://${urlObj.hostname}:${wsPort}/`,
            source: isSecureRace ? 'config.js + HTTPS(+3)' : 'config.js + HTTP(+2)'
        };
    }

    /**
     * Fetch circuit-specific WebSocket port from javascript/config.js.
     * Each Apex Timing circuit has a unique port stored in configPort.
     */
    async fetchConfigPort(raceUrl) {
        const tried = [];
        const logTry = (label, cfgUrl) => {
            tried.push(cfgUrl);
            this.log('INFO', `🔍 Fetching Apex config (${label}): ${cfgUrl}`);
        };

        const base = this.getRaceBaseUrl(raceUrl);
        const defaultConfigUrl = `${base}javascript/config.js`;

        // 1) Preferred direct config path under the race folder.
        try {
            logTry('default', defaultConfigUrl);
            const text = await this.fetchWithProxy(defaultConfigUrl);
            const p = this.extractConfigPort(text);
            if (p) {
                this.log('INFO', `✅ Detected configPort: ${p}`);
                return p;
            }
            this.log('WARN', 'configPort not found in default config.js');
        } catch (e) {
            this.log('WARN', `Default config fetch failed: ${e.message}`);
        }

        // 2) Parse race page HTML and discover the exact config.js script URL (often has cache_version query).
        try {
            this.log('INFO', `🔍 Fetching Apex page HTML to locate config script: ${raceUrl}`);
            const html = await this.fetchWithProxy(raceUrl);

            // Some deployments inline configPort directly.
            const inlinePort = this.extractConfigPort(html);
            if (inlinePort) {
                this.log('INFO', `✅ Detected configPort inline in page HTML: ${inlinePort}`);
                return inlinePort;
            }

            const scriptUrl = this.extractConfigScriptUrl(html, raceUrl);
            if (scriptUrl && !tried.includes(scriptUrl)) {
                logTry('discovered-from-html', scriptUrl);
                const scriptText = await this.fetchWithProxy(scriptUrl);
                const p = this.extractConfigPort(scriptText);
                if (p) {
                    this.log('INFO', `✅ Detected configPort: ${p}`);
                    return p;
                }
                this.log('WARN', 'configPort not found in discovered config.js');
            }
        } catch (e) {
            this.log('WARN', `HTML config discovery failed: ${e.message}`);
        }

        throw new Error(`Unable to resolve Apex configPort for ${raceUrl}`);
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
        let hasRowDelta = false;
        
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
                    const now = Date.now();
                    if (this._lastGridAt && (now - this._lastGridAt) < 350) {
                        this.log('INFO', '📋 Grid message throttled (arrived too soon after previous grid)');
                        continue;
                    }
                    this._lastGridAt = now;
                    this.gridHtml = gridHtml;
                    this.parseGridHTML(gridHtml);
                } else {
                    this.log('WARN', '📋 Grid HTML was empty in WS message — waiting for HTTP fallback');
                }
            } else if (key === 'r' || key.startsWith('r')) {
                if (this.handleRowUpdate(line, true)) {
                    hasRowDelta = true;
                }
            } else if (key === 'title') {
                this.log('INFO', `🏁 Race title: ${rest}`);
            } else if (key === 'comment') {
                this.log('INFO', `💬 Comment: ${rest}`);
                this._addComment(rest);
            } else if (key === 'init') {
                this.log('INFO', `🔧 Init: ${rest}`);
            } else if (key === 'best') {
                this.log('INFO', `🏆 Best: ${rest}`);
            } else if (key === 'css') {
                // Style info, skip
            } else if (key === 'ti') {
                this._parsePotentialTimer('ti', rest);
            } else {
                // Generic Apex element update: <data-id>|<type>|<value>|...
                // Catches countdown timer regardless of which data-id key is used
                this._parsePotentialTimer(key, rest);
            }
        }

        if (hasRowDelta) {
            this.scheduleEmitUpdate();
        }
    }

    scheduleEmitUpdate(delayMs = 90) {
        if (this._emitTimer) return;
        this._emitTimer = setTimeout(() => {
            this._emitTimer = null;
            this.emitUpdate();
        }, delayMs);
    }

    _ensureCompetitor(rowId) {
        let comp = this.competitors.get(rowId);
        if (comp) return comp;

        comp = {
            rowId,
            position: 0,
            kartNumber: '',
            driverName: '',
            firstName: '',
            lastName: '',
            sector1: '',
            sector2: '',
            sector3: '',
            lastLap: '',
            bestLap: '',
            gap: '',
            totalLaps: 0,
            category: '',
            lastLapMs: 0,
            bestLapMs: 0,
            inPit: false,
            pitCount: 0,
            previousPosition: 0,
            penalty: 0,
            penaltyTime: 0,
            penaltyReason: ''
        };

        this.competitors.set(rowId, comp);
        return comp;
    }

    _parseLapNumber(value) {
        if (value == null) return 0;
        const direct = parseInt(value, 10);
        if (!isNaN(direct) && direct >= 0) return direct;
        const match = String(value).match(/(\d+)/);
        return match ? (parseInt(match[1], 10) || 0) : 0;
    }

    handleRowUpdate(line, deferEmit = false) {
        // Pit in/out via Apex *in/*out/*i1/*i2 markers: r<rowId>|*in| or r<rowId>|*out|
        const starPitMatch = line.match(/^(r\d+)\|\*(in|i1|i2|out)\|?/i);
        if (starPitMatch) {
            const rowId = starPitMatch[1];
            const dir = starPitMatch[2].toLowerCase();
            const isEntering = dir !== 'out';
            const comp = this.competitors.get(rowId);
            if (comp) {
                if (isEntering && !comp.inPit) comp.pitCount = (comp.pitCount || 0) + 1;
                comp.inPit = isEntering;
                this.log('INFO', `🏎️ Pit ${isEntering ? 'entry' : 'exit'} (*${dir}) for ${comp.driverName || rowId}`);
                if (!deferEmit) this.emitUpdate();
                return true;
            }
            return false;
        }

        // Cell update: r<rowId>c<colIdx>|<value>|
        const typedCellMatch = line.match(/^(r\d+)c(\d+)\|([^|]*)\|([^|]*)\|?$/);
        if (typedCellMatch) {
            const rowId = typedCellMatch[1];
            const colIdx = parseInt(typedCellMatch[2], 10);
            const token = (typedCellMatch[3] || '').trim().toLowerCase();
            const rawValue = (typedCellMatch[4] || '').trim();
            const comp = this._ensureCompetitor(rowId);

            if (token === 'dr' || token === 'drteam') {
                comp.driverName = rawValue;
                if (!comp.lastName) comp.lastName = rawValue;
            } else if (token === 'in') {
                // Apex often sends "Giro 1008" in this channel.
                const laps = this._parseLapNumber(rawValue);
                if (laps > 0) comp.totalLaps = laps;
                this.updateCompetitorCell(comp, colIdx, rawValue);
            } else {
                this.updateCompetitorCell(comp, colIdx, rawValue);
            }

            if (!deferEmit) this.emitUpdate();
            return true;
        }

        const cellMatch = line.match(/^(r\d+)c(\d+)\|([^|]*)\|?$/);
        if (cellMatch) {
            const rowId = cellMatch[1];
            const colIdx = parseInt(cellMatch[2]);
            const value = cellMatch[3];
            
            const comp = this._ensureCompetitor(rowId);
            this.updateCompetitorCell(comp, colIdx, value);
            if (!deferEmit) this.emitUpdate();
            return true;
        }

        // Lap update: r<rowId>|*|<laptime>|<totaltime>
        const lapMatch = line.match(/^(r\d+)\|\*\|([^|]*)\|([^|]*)/);
        if (lapMatch) {
            const rowId = lapMatch[1];
            const lapTime = lapMatch[2];
            const comp = this._ensureCompetitor(rowId);
            if (comp) {
                comp.lastLap = lapTime;
                const lapMs = this.parseTimeToMs(lapTime);
                if (lapMs > 0 && (!comp.bestLapMs || lapMs < comp.bestLapMs)) {
                    comp.bestLap = lapTime;
                    comp.bestLapMs = lapMs;
                }
                comp.totalLaps = (comp.totalLaps || 0) + 1;
                if (!deferEmit) this.emitUpdate();
                return true;
            }
            return false;
        }

        // Position update: r<rowId>|#|<position>
        const posMatch = line.match(/^(r\d+)\|#\|(\d+)/);
        if (posMatch) {
            const rowId = posMatch[1];
            const newPos = parseInt(posMatch[2]);
            const comp = this._ensureCompetitor(rowId);
            if (comp) {
                comp.previousPosition = comp.position;
                comp.position = newPos;
                if (!deferEmit) this.emitUpdate();
                return true;
            }
            return false;
        }

        // Pit status: r<rowId>|p|<0or1>
        const pitMatch = line.match(/^(r\d+)\|p\|(\d)/);
        if (pitMatch) {
            const rowId = pitMatch[1];
            const inPit = pitMatch[2] === '1';
            const comp = this._ensureCompetitor(rowId);
            if (comp) {
                // Track pitCount: increment when transitioning into pit
                if (inPit && !comp.inPit) {
                    comp.pitCount = (comp.pitCount || 0) + 1;
                    this.log('INFO', `🛑 Pit entry detected for ${comp.driverName || rowId} (pit #${comp.pitCount})`);
                } else if (!inPit && comp.inPit) {
                    this.log('INFO', `✅ Pit exit detected for ${comp.driverName || rowId}`);
                }
                comp.inPit = inPit;
                if (!deferEmit) this.emitUpdate();
                return true;
            }
            return false;
        }

        // Penalty message: r<rowId>|pen|<seconds> or penalty|r<rowId>|<seconds>
        const penMatch = line.match(/^(r\d+)\|pen\|(\d+)/) || line.match(/^penalty\|(r\d+)\|(\d+)/);
        if (penMatch) {
            const rowId = penMatch[1];
            const penSec = parseInt(penMatch[2]) || 0;
            const comp = this._ensureCompetitor(rowId);
            if (comp) {
                comp.penalty = (comp.penalty || 0) + 1;
                comp.penaltyTime = (comp.penaltyTime || 0) + penSec;
                comp.penaltyReason = `${penSec} Lap`;
                this.log('INFO', `⚠️ Penalty: ${comp.driverName || rowId} ${penSec} Lap`);
                if (!deferEmit) this.emitUpdate();
                return true;
            }
            return false;
        }

        return false;
    }

    mergeCompetitor(prev, next) {
        if (!prev) return next;

        const merged = { ...prev, ...next };

        const textFields = ['kartNumber', 'driverName', 'firstName', 'lastName', 'sector1', 'sector2', 'sector3', 'lastLap', 'bestLap', 'gap', 'category'];
        for (const field of textFields) {
            if ((!next[field] || next[field] === '-') && prev[field]) {
                merged[field] = prev[field];
            }
        }

        if (!next.position && prev.position) merged.position = prev.position;
        if (!next.totalLaps && prev.totalLaps) merged.totalLaps = prev.totalLaps;
        if (!next.lastLapMs && prev.lastLapMs) merged.lastLapMs = prev.lastLapMs;
        if (!next.bestLapMs && prev.bestLapMs) merged.bestLapMs = prev.bestLapMs;
        if ((!next.pitCount || next.pitCount < 0) && prev.pitCount) merged.pitCount = prev.pitCount;
        if (next.inPit == null && prev.inPit != null) merged.inPit = prev.inPit;

        return merged;
    }

    /**
     * Auto-detect column roles from header cells.
     * Supports: Italian, German, English, French, Spanish, Dutch, Portuguese.
     */
    /**
     * Store a race-control comment and notify listeners.
     */
    _addComment(text) {
        if (!text || !text.trim()) return;
        const entry = { text: text.trim(), ts: Date.now() };
        this._comments.push(entry);
        if (this._comments.length > this._maxComments) this._comments.shift();
        if (this.onComment) {
            this.onComment(entry);
        }
    }

    /** Convert time string (H:MM:SS, MM:SS, or decimal seconds) to seconds */
    _timerStringToSeconds(str) {
        if (!str) return null;
        const s = str.trim().split('_')[0]; // strip "_Running" suffix
        const hms = s.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
        if (hms) return parseInt(hms[1]) * 3600 + parseInt(hms[2]) * 60 + parseInt(hms[3]);
        const ms = s.match(/^(\d{1,3}):(\d{2})$/);
        if (ms) return parseInt(ms[1]) * 60 + parseInt(ms[2]);
        const f = parseFloat(s);
        return (!isNaN(f) && f > 0 && f < 90000) ? f : null;
    }

    /**
     * Parse race time from Apex WS message.
     * Handles: ti|HH:MM:SS  and  <data-id>|countdown|<seconds>  and  <data-id>|countdown_text|MM:SS_status
     */
    _parsePotentialTimer(key, rest) {
        if (key === 'ti') {
            // ti messages carry the time value directly in rest
            const sec = this._timerStringToSeconds(rest.split('|')[0]);
            if (sec !== null && sec > 0) {
                this.raceTimeLeftSec = sec;
                this._raceTimeReceivedAt = Date.now();
                this.log('INFO', `⏱️ Race time from ti: ${Math.round(sec)}s`);
            }
            return;
        }
        // Generic element update: rest = "<type>|<value>|..."
        const p = rest.indexOf('|');
        if (p === -1) return;
        const type = rest.substring(0, p);
        if (type !== 'countdown' && type !== 'countdown_text' && type !== 'count') return;
        const value = rest.substring(p + 1).split('|')[0];
        const timePart = value.split('_')[0];
        let sec;
        if (type === 'countdown' && /^\d+\.\d+$/.test(timePart)) {
            sec = parseFloat(timePart); // Apex sends decimal seconds for countdown type
        } else {
            sec = this._timerStringToSeconds(timePart);
        }
        if (sec !== null && sec > 0 && sec < 86400) {
            this.raceTimeLeftSec = sec;
            this._raceTimeReceivedAt = Date.now();
            this.log('INFO', `⏱️ Race time from ${key}|${type}: ${Math.round(sec)}s`);
        }
    }

    detectColumnMapping(headerCells) {
        const patterns = [
            { field: 'position',   re: /^(cla|pos|rnk|rank|platz|p\.?|#|classifica)$/i },
            { field: 'kartNumber', re: /^(kart|no|n[°ºo.]?|num|nr|number|startnr|cart)$/i },
            { field: 'driverName', re: /^(team|name|nom|nome|fahrer|driver|pilota|pilote|concurrent|concorrente|conductor|competitor|equipe|squadra|mannschaft)$/i },
            { field: 'totalLaps',  re: /^(giri|laps?|nbgiri|nbtrs?|tours?|rdn|runden|vueltas?|tr|rondes?)$/i },
            { field: 'gap',        re: /^(distacco|gap|diff|dist|abst|abstand|[eé]cart|dif|ecart)$/i },
            { field: 'lastLap',    re: /^(ultimo\.?\s*t\.?|last|dern\.?|dernier|ultimo|letzte|[uú]ltimo|latest|ult)$/i },
            { field: 'bestLap',    re: /^(giro\s*mig\.?|best|meilleur|migliore|beste|mejor|melhor)$/i },
            { field: 'sector1',    re: /^s1$/i },
            { field: 'sector2',    re: /^s2$/i },
            { field: 'sector3',    re: /^s3$/i },
            { field: 'pitCount',   re: /^(pit\s*stop|pits?|box|arr[eê]ts?)$/i },
            { field: 'penalty',    re: /^(pena|pen|penal|penalty|p[eé]nalit[eé]|strafe)$/i },
            { field: 'category',   re: /^(categoria|category|cat|classe|klasse|class)$/i },
            { field: 'country',    re: /^(paese|country|land|pays|pa[ií]s|nation)$/i },
            { field: 'totalTime',  re: /^(tempo|time|temps|zeit|tiempo|total)$/i },
            { field: 'onTrack',    re: /^(in\s*pista|on\s*track|auf\s*strecke|en\s*piste)$/i },
        ];

        const mapping = {};
        const headerTexts = [];
        for (let i = 0; i < headerCells.length; i++) {
            const raw = (headerCells[i].textContent || headerCells[i]).toString().trim();
            headerTexts.push(raw);
            if (!raw) continue;
            for (const p of patterns) {
                if (p.re.test(raw) && mapping[p.field] == null) {
                    mapping[p.field] = i;
                    break;
                }
            }
        }

        this.log('INFO', `🔍 Header texts: [${headerTexts.join(' | ')}]`);

        const hasEnough = mapping.driverName != null || mapping.kartNumber != null || mapping.position != null;
        if (hasEnough) {
            this.log('INFO', `🔍 Detected column mapping: ${JSON.stringify(mapping)}`);
            return mapping;
        }

        this.log('WARN', '🔍 Could not detect column mapping from headers — using fallback');
        return null;
    }

    updateCompetitorCell(comp, colIdx, value) {
        const cm = this.columnMap;

        if (cm) {
            // Build reverse map once: colIndex → fieldName
            if (!this._reverseColMap) {
                this._reverseColMap = {};
                for (const [field, idx] of Object.entries(cm)) {
                    this._reverseColMap[idx] = field;
                }
            }
            const field = this._reverseColMap[colIdx];
            if (field) {
                switch (field) {
                    case 'position':   comp.position = parseInt(value) || comp.position; break;
                    case 'kartNumber': comp.kartNumber = value; break;
                    case 'driverName': comp.driverName = value; break;
                    case 'totalLaps': {
                        const lapNum = this._parseLapNumber(value);
                        comp.totalLaps = lapNum || comp.totalLaps || 0;
                        break;
                    }
                    case 'gap':        comp.gap = value; break;
                    case 'category':   comp.category = value; break;
                    case 'lastLap': {
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
                    }
                    case 'bestLap':
                        comp.bestLap = value;
                        comp.bestLapMs = this.parseTimeToMs(value);
                        break;
                    case 'onTrack': {
                        // 'in'/'si' = in pit, 'out'/'so' = on track
                        const v = value.toLowerCase().trim();
                        if (v === 'in' || v === 'si') comp.inPit = true;
                        else if (v === 'out' || v === 'so') comp.inPit = false;
                        break;
                    }
                    case 'sector1':    comp.sector1 = value; break;
                    case 'sector2':    comp.sector2 = value; break;
                    case 'sector3':    comp.sector3 = value; break;
                    case 'pitCount':   comp.pitCount = parseInt(value) || 0; break;
                    case 'penalty': {
                        const penSec = parseInt(value);
                        if (!isNaN(penSec) && penSec > 0) {
                            comp.penalty = 1;
                            comp.penaltyTime = penSec;
                            comp.penaltyReason = `${penSec} Lap`;
                        }
                        break;
                    }
                    // category, country, totalTime, onTrack — stored but no special handling
                }
            }
            return;
        }

        // Fallback: original hardcoded mapping (14-column English layout)
        switch (colIdx) {
            case 2: comp.position = parseInt(value) || comp.position; break;
            case 3: comp.kartNumber = value; break;
            case 4: comp.driverName = value; break;
            case 5: comp.firstName = value; break;
            case 6: comp.lastName = value; break;
            case 7: comp.sector1 = value; break;
            case 8: comp.sector2 = value; break;
            case 9: comp.sector3 = value; break;
            case 10: {
                comp.lastLap = value;
                const ms2 = this.parseTimeToMs(value);
                if (ms2 > 0) {
                    comp.lastLapMs = ms2;
                    if (!comp.bestLapMs || ms2 < comp.bestLapMs) {
                        comp.bestLapMs = ms2;
                        comp.bestLap = value;
                    }
                }
                break;
            }
            case 11:
                comp.bestLap = value;
                comp.bestLapMs = this.parseTimeToMs(value);
                break;
            case 12: comp.gap = value; break;
            case 13: {
                const lapNum = this._parseLapNumber(value);
                comp.totalLaps = lapNum || comp.totalLaps || 0;
                break;
            }
        }
    }

    parseGridHTML(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<html><body><table>${html}</table></body></html>`, 'text/html');

        // ── Detect column mapping from header row ──
        if (!this.columnMap) {
            // 1) Explicit header row by class
            let headerRow = doc.querySelector('tr.titles') || doc.querySelector('thead tr');
            // 2) Scan all rows to find one whose cells match known header patterns
            if (!headerRow) {
                const candidates = doc.querySelectorAll('tr');
                for (const tr of candidates) {
                    const cells = tr.querySelectorAll('th, td');
                    if (cells.length < 5) continue;
                    // Check if ≥3 cells match header keywords
                    let hits = 0;
                    const headerTest = /^(cla|pos|rnk|rank|kart|no|team|name|nom|nome|giri|laps?|gap|diff|distacco|ultimo|last|best|giro\s*mig|s1|s2|s3|pit|pen|categoria|category|paese|country|tempo|time|in\s*pista|on\s*track)$/i;
                    for (const c of cells) {
                        if (headerTest.test(c.textContent.trim())) hits++;
                    }
                    if (hits >= 3) { headerRow = tr; break; }
                }
            }
            if (headerRow) {
                const headerCells = headerRow.querySelectorAll('th, td');
                if (headerCells.length >= 5) {
                    const detected = this.detectColumnMapping(headerCells);
                    if (detected) {
                        this.columnMap = detected;
                        this._reverseColMap = null;
                    }
                }
            }
        }

        // ── Collect the header row's id so we can skip it later ──
        const headerRowId = (() => {
            const hr = doc.querySelector('tr.titles') || doc.querySelector('thead tr');
            return hr ? hr.id : null;
        })();

        // ── Find data rows ──
        let rows = doc.querySelectorAll('tr[id^="r"]');
        if (rows.length === 0) {
            rows = Array.from(doc.querySelectorAll('tr')).filter(tr => {
                const cells = tr.querySelectorAll('td');
                return cells.length >= 5;
            });
        }

        const cm = this.columnMap;
        this.log('INFO', `📋 Parsing grid HTML, found ${rows.length} rows, columnMap: ${cm ? 'detected' : 'fallback'}`);

        if (rows.length === 0 && html.length > 100) {
            const allTags = doc.querySelectorAll('*');
            const tagNames = new Set();
            allTags.forEach(el => tagNames.add(el.tagName.toLowerCase()));
            this.log('WARN', `📋 HTML tags found: ${[...tagNames].join(', ')}`);
            const rElements = doc.querySelectorAll('[id^="r"]');
            this.log('WARN', `📋 Elements with id^="r": ${rElements.length}`);
            if (rElements.length > 0) {
                this.log('WARN', `📋 First r-element: tag=${rElements[0].tagName}, id=${rElements[0].id}, children=${rElements[0].children.length}`);
            }
            this.parseGridHTMLRegex(html);
            return;
        }

        // Preserve current state and merge grid snapshots on top (Apex stream is stateful).
        const prevComps = new Map(this.competitors);
        const prevPitStates = new Map([...prevComps].map(([k, v]) => [k, v.inPit]));
        const nextComps = new Map(prevComps);
        const getCell = (cells, field, fallbackIdx) => {
            const idx = cm ? cm[field] : fallbackIdx;
            return (idx != null && idx < cells.length) ? cells[idx].textContent.trim() : '';
        };

        let skippedRows = 0;
        for (const row of rows) {
            // Skip header / titles rows explicitly
            if (row.classList && (row.classList.contains('titles') || row.classList.contains('header'))) {
                skippedRows++;
                continue;
            }
            if (headerRowId && row.id === headerRowId) { skippedRows++; continue; }

            const cells = row.querySelectorAll('td');
            if (cells.length < 5) continue;

            const rowId = row.id || `r${nextComps.size}`;

            const comp = {
                rowId: rowId,
                position:   parseInt(getCell(cells, 'position', 2)) || 0,
                kartNumber: getCell(cells, 'kartNumber', 3),
                driverName: getCell(cells, 'driverName', 4),
                firstName:  cm ? '' : (cells[5]?.textContent?.trim() || ''),
                lastName:   cm ? '' : (cells[6]?.textContent?.trim() || ''),
                sector1:    getCell(cells, 'sector1', 7),
                sector2:    getCell(cells, 'sector2', 8),
                sector3:    getCell(cells, 'sector3', 9),
                lastLap:    getCell(cells, 'lastLap', 10),
                bestLap:    getCell(cells, 'bestLap', 11),
                gap:        getCell(cells, 'gap', 12),
                totalLaps:  parseInt(getCell(cells, 'totalLaps', 13)) || 0,
                category:   cm?.category != null ? getCell(cells, 'category', null) : '',
                lastLapMs: 0,
                bestLapMs: 0,
                inPit: prevPitStates.get(rowId) || false,
                pitCount: cm?.pitCount != null ? (parseInt(getCell(cells, 'pitCount', null)) || 0) : 0,
                previousPosition: 0,
                penalty: 0,
                penaltyTime: 0,
                penaltyReason: ''
            };

            comp.lastLapMs = this.parseTimeToMs(comp.lastLap);
            comp.bestLapMs = this.parseTimeToMs(comp.bestLap);
            comp.previousPosition = comp.position;

            // Penalty — from detected column or fallback col 14
            const penIdx = cm?.penalty ?? 14;
            const penaltyCell = (penIdx < cells.length) ? cells[penIdx].textContent.trim() : '';
            if (penaltyCell) {
                const penSec = parseInt(penaltyCell);
                if (!isNaN(penSec) && penSec > 0) {
                    comp.penalty = 1;
                    comp.penaltyTime = penSec;
                    comp.penaltyReason = `${penSec} Lap`;
                }
            }

            // Strict validation: must have position > 0 OR a numeric kart number OR timing data
            const posValid = comp.position > 0;
            const kartNumeric = /^\d+$/.test(comp.kartNumber);
            const hasTimingData = comp.lastLapMs > 0 || comp.bestLapMs > 0 || comp.totalLaps > 0;
            if (!posValid && !kartNumeric && !hasTimingData) {
                skippedRows++;
                continue;
            }

            // Pit status: row class > onTrack column > hidden status cells
            // Preserves prev inPit state when no definitive indicator is present.
            const rowCls = (row.className || '').toLowerCase();
            if (/\bpit\b/.test(rowCls) || rowCls.includes('in_pit')) {
                comp.inPit = true;
            } else if (rowCls.includes('on_track') || rowCls.includes('ontrack')) {
                comp.inPit = false; // Explicit CSS class confirms out of pit
            } else if (cm?.onTrack != null && cm.onTrack < cells.length) {
                const stVal = cells[cm.onTrack].textContent.trim().toLowerCase();
                if (stVal === 'in' || stVal === 'si') comp.inPit = true;
                else if (stVal === 'out' || stVal === 'so') comp.inPit = false;
                // else: preserve existing comp.inPit (from prevPitStates)
            } else {
                const sc = (cells[0]?.textContent?.trim() || '') + (cells[1]?.textContent?.trim() || '');
                if (/^[Pp]$/.test(sc) || sc.toLowerCase().includes('pit')) comp.inPit = true;
                // else: preserve existing comp.inPit (from prevPitStates)
            }

            nextComps.set(rowId, this.mergeCompetitor(prevComps.get(rowId), comp));
        }

        this.competitors = nextComps;
        this.log('INFO', `Grid merged with ${this.competitors.size} competitors (skipped ${skippedRows} non-data rows)`);
        if (this.competitors.size > 0) {
            this.emitUpdate();
        }
    }

    parseGridHTMLRegex(html) {
        const rowRegex = /<tr[^>]*\bid=["']?(r\d+)["']?[^>]*>([\s\S]*?)<\/tr>/gi;
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

        // Preserve current state and merge regex-parsed snapshots on top.
        const prevComps = new Map(this.competitors);
        const prevPitStates = new Map([...prevComps].map(([k, v]) => [k, v.inPit]));
        const nextComps = new Map(prevComps);
        const cm = this.columnMap;
        let match;

        while ((match = rowRegex.exec(html)) !== null) {
            const rowId = match[1];
            const rowHtml = match[2];
            const cells = [];
            let cellMatch;

            cellRegex.lastIndex = 0;
            while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
                const text = cellMatch[1].replace(/<[^>]*>/g, '').trim();
                cells.push(text);
            }

            if (cells.length < 5) continue;

            // Skip rows whose HTML class suggests header
            if (/titles|header/i.test(match[0])) continue;

            const getCell = (field, fallbackIdx) => {
                const idx = cm ? cm[field] : fallbackIdx;
                return (idx != null && idx < cells.length) ? cells[idx] : '';
            };

            const comp = {
                rowId: rowId,
                position:   parseInt(getCell('position', 2)) || 0,
                kartNumber: getCell('kartNumber', 3),
                driverName: getCell('driverName', 4),
                firstName:  cm ? '' : (cells[5] || ''),
                lastName:   cm ? '' : (cells[6] || ''),
                sector1:    getCell('sector1', 7),
                sector2:    getCell('sector2', 8),
                sector3:    getCell('sector3', 9),
                lastLap:    getCell('lastLap', 10),
                bestLap:    getCell('bestLap', 11),
                gap:        getCell('gap', 12),
                totalLaps:  parseInt(getCell('totalLaps', 13)) || 0,
                category:   cm?.category != null ? getCell('category', null) : '',
                lastLapMs: 0,
                bestLapMs: 0,
                inPit: prevPitStates.get(rowId) || false,
                pitCount: cm?.pitCount != null ? (parseInt(getCell('pitCount', null)) || 0) : 0,
                previousPosition: 0,
                penalty: 0,
                penaltyTime: 0,
                penaltyReason: ''
            };

            comp.lastLapMs = this.parseTimeToMs(comp.lastLap);
            comp.bestLapMs = this.parseTimeToMs(comp.bestLap);
            comp.previousPosition = comp.position;

            // Strict validation: must have position > 0 OR numeric kart OR timing data
            const posValid = comp.position > 0;
            const kartNumeric = /^\d+$/.test(comp.kartNumber);
            const hasTimingData = comp.lastLapMs > 0 || comp.bestLapMs > 0 || comp.totalLaps > 0;
            if (!posValid && !kartNumeric && !hasTimingData) continue;

            // Pit status: check row's opening tag class attribute
            // Preserves prev inPit state when no definitive indicator is present.
            const trTag = match[0].substring(0, match[0].indexOf('>') + 1).toLowerCase();
            if (/\bpit\b/.test(trTag) || trTag.includes('in_pit')) {
                comp.inPit = true;
            } else if (trTag.includes('on_track') || trTag.includes('ontrack')) {
                comp.inPit = false; // Explicit CSS class confirms out of pit
            } else if (cm?.onTrack != null && cm.onTrack < cells.length) {
                const stVal = (cells[cm.onTrack] || '').toLowerCase().trim();
                if (stVal === 'in' || stVal === 'si') comp.inPit = true;
                else if (stVal === 'out' || stVal === 'so') comp.inPit = false;
                // else: preserve comp.inPit (from prevPitStates)
            } else {
                const sc = (cells[0] || '') + (cells[1] || '');
                if (/^[Pp]$/.test(sc) || sc.toLowerCase().includes('pit')) comp.inPit = true;
                // else: preserve comp.inPit (from prevPitStates)
            }

            nextComps.set(rowId, this.mergeCompetitor(prevComps.get(rowId), comp));
        }

        this.competitors = nextComps;
        this.log('INFO', `Regex parser merged ${this.competitors.size} competitors`);
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
            rowId: c.rowId,
            position: c.position,
            name: c.driverName || `${c.firstName} ${c.lastName}`.trim(),
            team: c.lastName || '',
            kart: c.kartNumber || '',
            lastLap: c.lastLap || '',
            lastLapMs: c.lastLapMs || 0,
            bestLap: c.bestLap || '',
            bestLapMs: c.bestLapMs || 0,
            gap: c.gap || '',
            laps: c.totalLaps || 0,
            totalLaps: c.totalLaps || 0,
            inPit: c.inPit || false,
            pitCount: c.pitCount || 0,
            previousPosition: c.previousPosition || c.position,
            penalty: c.penalty || 0,
            penaltyTime: c.penaltyTime || 0,
            penaltyReason: c.penaltyReason || '',
            category: c.category || '',
            isOurTeam: c.rowId === ourTeam?.rowId
        });

        const result = {
            race: { timeLeftSeconds: this.raceTimeLeftSec },
            competitors: allCompetitors.map(mapComp),
            ourTeam: ourTeam ? {
                ...mapComp(ourTeam),
                sector1: ourTeam.sector1 || '',
                sector2: ourTeam.sector2 || '',
                sector3: ourTeam.sector3 || ''
            } : null,
            found: !!ourTeam,
            totalCompetitors: allCompetitors.length,
            provider: 'apex-ws',
            comments: this._comments.slice(-10)
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
            this._activeController = null;
        }

        const proxies = [
            { prefix: '/.netlify/functions/cors-proxy?url=', label: 'netlify-proxy', timeoutMs: 20000 },
            { prefix: 'https://corsproxy.io/?', label: 'corsproxy', timeoutMs: 12000 },
            { prefix: 'https://api.allorigins.win/raw?url=', label: 'allorigins', timeoutMs: 12000 }
        ];

        for (const proxy of proxies) {
            if (!this.isRunning) return '';

            const controller = new AbortController();
            this._activeController = controller;
            let timeout = null;
            
            try {
                timeout = setTimeout(() => {
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
            } finally {
                if (timeout) clearTimeout(timeout);
                if (this._activeController === controller) {
                    this._activeController = null;
                }
            }
        }

        throw new Error('All proxies failed');
    }

    stop() {
        this.isRunning = false;

        if (this._emitTimer) {
            clearTimeout(this._emitTimer);
            this._emitTimer = null;
        }
        
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

    getStats() {
        return {
            isRunning: this.isRunning,
            consecutiveErrors: this.consecutiveErrors,
            competitorsCount: this.competitors.size,
            sessionId: this.sessionId || null,
            wsUrl: this.wsUrl || null,
            raceTimeLeftSec: this.raceTimeLeftSec
        };
    }
}

// Export for use
window.ApexTimingScraper = ApexTimingScraper;