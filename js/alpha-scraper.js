/**
 * Alpha Timing Scraper
 * Polls https://results.alphatiming.co.uk/api/v1/{venue}/live/current
 * Emits same data interface as ApexTimingScraper.
 */

class AlphaTimingScraper {
    constructor(config = {}) {
        this.raceUrl    = config.raceUrl || '';
        this.searchTerm = config.searchTerm || '';
        this.searchType = config.searchType || 'team';
        this.updateInterval = config.updateInterval || 5000;
        this.debug      = config.debug || false;

        this.onUpdate   = config.onUpdate   || null;
        this.onError    = config.onError    || null;
        this.onComment  = config.onComment  || null;

        this.isRunning  = false;
        this._timer     = null;
        this._consecutiveErrors = 0;
        this._updateNumber = 0;
        this._seenNotificationIds = new Set();

        // Extract venue slug from URL, e.g. https://results.alphatiming.co.uk/buckmore/live → buckmore
        this.venue = this._extractVenue(this.raceUrl);
        this._apiBase = 'https://results.alphatiming.co.uk';
        this._currentUrl = this._apiBase + '/api/v1/' + this.venue + '/live/current';
        this._notificationsUrl = this._apiBase + '/api/v1/' + this.venue + '/live/notifications/0';
    }

    _extractVenue(url) {
        try {
            const u = new URL(url);
            const parts = u.pathname.split('/').filter(Boolean);
            return parts[0] || 'unknown';
        } catch (e) {
            return 'unknown';
        }
    }

    _proxyUrl(targetUrl) {
        return '/.netlify/functions/cors-proxy?url=' + encodeURIComponent(targetUrl);
    }

    async _fetchJson(url) {
        const res = await fetch(this._proxyUrl(url), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
        const wrapper = await res.json();
        // cors-proxy wraps response in { body, statusCode, contentType }
        if (wrapper && typeof wrapper.body === 'string') {
            return JSON.parse(wrapper.body);
        }
        return wrapper;
    }

    start() {
        if (this.isRunning) return;
        if (!this.venue || this.venue === 'unknown') {
            if (this.onError) this.onError(new Error('Cannot extract venue from URL: ' + this.raceUrl), 1);
            return;
        }
        this.isRunning = true;
        this._consecutiveErrors = 0;
        if (this.debug) console.log('[AlphaTimingScraper] Starting for venue:', this.venue);
        this._poll();
    }

    stop() {
        this.isRunning = false;
        if (this._timer) {
            clearTimeout(this._timer);
            this._timer = null;
        }
        if (this.debug) console.log('[AlphaTimingScraper] Stopped');
    }

    async _poll() {
        if (!this.isRunning) return;
        const t0 = Date.now();
        try {
            const data = await this._fetchJson(this._currentUrl);
            this._consecutiveErrors = 0;
            this._updateNumber++;
            const parsed = this._parse(data);
            if (this.onUpdate) this.onUpdate(parsed);

            // Fetch notifications in background (don't await to keep polling fast)
            this._fetchNotifications(data.Sequence || 0).catch(() => {});

        } catch (err) {
            this._consecutiveErrors++;
            if (this.debug) console.error('[AlphaTimingScraper] Error:', err);
            if (this.onError) this.onError(err, this._consecutiveErrors);
        }

        if (this.isRunning) {
            const elapsed = Date.now() - t0;
            const delay = Math.max(0, this.updateInterval - elapsed);
            this._timer = setTimeout(() => this._poll(), delay);
        }
    }

    async _fetchNotifications(sequence) {
        if (!this.onComment) return;
        try {
            const url = this._apiBase + '/api/v1/' + this.venue + '/live/notifications/' + sequence;
            const items = await this._fetchJson(url);
            if (!Array.isArray(items)) return;
            for (const n of items) {
                const id = n.Id || n.id || (n.Time + '_' + n.Message);
                if (this._seenNotificationIds.has(id)) continue;
                this._seenNotificationIds.add(id);
                this.onComment({
                    time: n.Time || n.time || '',
                    message: n.Message || n.message || '',
                    type: n.Type || n.type || 'info'
                });
            }
        } catch (_) { /* silent */ }
    }

    _stateToStatus(state) {
        if (!state) return 'unknown';
        const s = state.toLowerCase();
        if (s.includes('started') || s === 'running') return 'running';
        if (s.includes('chequered') || s.includes('finished')) return 'finished';
        if (s.includes('formation') || s.includes('grid')) return 'formation';
        if (s.includes('paused') || s.includes('stopped') || s.includes('red')) return 'paused';
        if (s.includes('practice')) return 'practice';
        return s;
    }

    _msToTimeStr(ms) {
        if (!ms) return '';
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        const frac = ms % 1000;
        return m + ':' + String(s).padStart(2, '0') + '.' + String(frac).padStart(3, '0');
    }

    _gapStrToMs(val) {
        if (val == null || val === '' || val === '0') return 0;
        const n = parseFloat(val);
        return isNaN(n) ? 0 : Math.round(n * 1000);
    }

    _matchesSearch(comp) {
        if (!this.searchTerm) return false;
        const term = this.searchTerm.toLowerCase();
        if (this.searchType === 'kart') {
            return String(comp.CompetitorNumber || '').toLowerCase() === term;
        }
        const name = (comp.CompetitorName || '').toLowerCase();
        const team = (comp.TeamName || '').toLowerCase();
        return name.includes(term) || team.includes(term);
    }

    _parse(raw) {
        const competitors = (raw.Competitors || []).slice().sort((a, b) =>
            (parseInt(a.Position) || 99) - (parseInt(b.Position) || 99)
        );

        const status = this._stateToStatus(raw.State);
        // tl appears to be time-left in seconds; treat 0 or sentinel as 0
        const tl = (raw.tl && raw.tl < 900) ? raw.tl : 0;

        let ourTeam = null;
        const mapped = competitors.map(c => {
            const pos = parseInt(c.Position) || 0;
            const kartNumber = String(c.CompetitorNumber || '');
            const name = c.CompetitorName || '';
            const team = c.TeamName || name;
            const bestLapMs = c.BestLaptime || null;
            const lastLapMs = c.LastLaptime || null;
            const totalLaps = parseInt(c.NumberOfLaps || (Array.isArray(c.Laps) ? c.Laps.length : 0)) || 0;
            const gapMs = this._gapStrToMs(c.Behind);     // gap to leader
            const intervalMs = this._gapStrToMs(c.Gap);   // gap to car ahead
            const inPit = !!c.InPit;
            const pitCount = c.ps || 0;
            const category = c.CompetitorClass || '';
            const isMatch = this._matchesSearch(c);

            // Compute avgLapMs from Laps[] — filter valid (non-pit) laps
            const validLaps = Array.isArray(c.Laps)
                ? c.Laps.filter(l => l.LapTime && l.LapTime > 0 && l.LapTime < 300000)
                : [];
            const avgLapMs = validLaps.length > 1
                ? Math.round(validLaps.reduce((s, l) => s + l.LapTime, 0) / validLaps.length)
                : (bestLapMs || null);

            const entry = {
                position: pos,
                name,
                team,
                kart: kartNumber,
                kartNumber,
                bestLapMs,
                lastLapMs,
                avgLapMs,
                totalLaps,
                laps: totalLaps,
                gap: c.Behind || '0',
                gapMs,
                interval: c.Gap || '0',
                intervalMs,
                inPit,
                pitCount,
                category,
                penalty: 0,
                penaltyTime: 0,
                penaltyReason: '',
                isOurTeam: isMatch,
                rowId: c.CompetitorId || kartNumber
            };

            if (isMatch) ourTeam = entry;
            return entry;
        });

        return {
            race: {
                status,
                timeLeftSeconds: tl,
                sessionName: raw.SessionName || '',
                sessionType: raw.SessionType || '',
                trackName: raw.tn || '',
                isEndurance: (raw.SessionType || '').toLowerCase().includes('endurance')
            },
            ourTeam,
            competitors: mapped,
            found: !!ourTeam,
            updateNumber: this._updateNumber,
            fetchDuration: 0,
            provider: 'alpha',
            venue: this.venue
        };
    }

    getStats() {
        return {
            provider: 'alpha',
            venue: this.venue,
            isRunning: this.isRunning,
            updateNumber: this._updateNumber,
            consecutiveErrors: this._consecutiveErrors
        };
    }
}

window.AlphaTimingScraper = AlphaTimingScraper;
