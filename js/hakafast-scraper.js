/**
 * Hakafast Live Timing — WebSocket client for HAKAFAST server
 * Same interface as ApexTimingScraper / AlphaTimingScraper for Strateger.
 */

class HakafastTimingScraper {
  constructor(config = {}) {
    this.raceUrl = config.raceUrl || '';
    this.searchTerm = (config.searchTerm || '').trim();
    this.searchType = config.searchType || 'kart';
    this.onUpdate = config.onUpdate || null;
    this.onError = config.onError || null;
    this.debug = config.debug || false;

    this.isRunning = false;
    this.ws = null;
    this._consecutiveErrors = 0;
    this._updateNumber = 0;
    this._lastPayload = null;

    this._parseUrl();
  }

  _log(level, msg) {
    if (this.debug) console.log(`[Hakafast ${level}]`, msg);
  }

  _parseUrl() {
    try {
      const u = new URL(this.raceUrl);
      this.baseOrigin = u.origin;
      const parts = u.pathname.split('/').filter(Boolean);
      const routeIdx = parts.findIndex((p) => p === 'live-timing' || p === 'admin');
      this.trackSlug = routeIdx >= 0 && parts[routeIdx + 1] ? parts[routeIdx + 1] : 'kart-demo';
      this.workspaceId = u.searchParams.get('ws') || u.searchParams.get('workspace') || null;
      this.trackId = u.searchParams.get('trackId') || '1';
    } catch (e) {
      this.baseOrigin = '';
      this.trackSlug = 'kart-demo';
      this.workspaceId = null;
      this.trackId = '1';
    }
  }

  _lapToMs(lap) {
    if (lap == null || lap === '') return null;
    const s = String(lap).trim();
    if (s.includes(':')) {
      const [mins, rest] = s.split(':');
      const sec = (parseInt(mins, 10) || 0) * 60 + (parseFloat(rest) || 0);
      return Math.round(sec * 1000);
    }
    const v = parseFloat(s);
    return Number.isNaN(v) ? null : Math.round(v * 1000);
  }

  _matchesSearch(row) {
    const term = this.searchTerm.trim();
    if (!term) return false;
    const lower = term.toLowerCase();
    if (this.searchType === 'kart') {
      const kart = String(row.kart_number || '').replace(/^#/, '');
      return kart === term.replace(/^#/, '') || kart === term;
    }
    if (this.searchType === 'driver') {
      return String(row.driver_name || '').toLowerCase().includes(lower);
    }
    const team = String(row.team_name || row.driver_name || '').toLowerCase();
    return team.includes(lower);
  }

  _buildPayload(msg) {
    const rows = Array.isArray(msg.rows) ? msg.rows.slice() : [];
    const leaderBest = this._lapToMs(rows[0]?.best_lap_time);
    const competitors = rows.map((row, idx) => {
      const bestMs = this._lapToMs(row.best_lap_time);
      const lastMs = this._lapToMs(row.last_lap_time);
      const gapMs = idx === 0 || !leaderBest || !bestMs ? 0 : Math.max(0, bestMs - leaderBest);
      const gapStr = idx === 0 ? '' : `+${(gapMs / 1000).toFixed(3)}`;
      return {
        position: idx + 1,
        rowId: `hf-${row.kart_number}`,
        name: row.driver_name || '',
        team: row.team_name || row.driver_name || '',
        kart: String(row.kart_number ?? ''),
        kartNumber: String(row.kart_number ?? ''),
        lastLapMs: lastMs,
        bestLapMs: bestMs,
        avgLapMs: this._lapToMs(row.avg_lap_time),
        totalLaps: row.lap_count || row.total_laps || 0,
        laps: row.lap_count || row.total_laps || 0,
        gap: gapStr,
        gapMs,
        intervalMs: 0,
        inPit: Boolean(row.in_pits),
        pitCount: row.pit_visits || 0,
        penalty: row.unserved_penalty_sec || 0,
        isOurTeam: this._matchesSearch(row),
      };
    });

    competitors.forEach((c, idx) => {
      if (idx === 0) {
        c.intervalMs = 0;
      } else {
        c.intervalMs = Math.max(0, (c.gapMs || 0) - (competitors[idx - 1].gapMs || 0));
      }
    });

    const ourTeam = competitors.find((c) => c.isOurTeam) || null;
    const clock = msg.heatClock || {};
    const heatType = msg.heatType || 'time';

    return {
      race: {
        timeLeftSeconds: clock.remainingSec ?? null,
        status: clock.running ? 'running' : (clock.started ? 'running' : 'waiting'),
        isEndurance: heatType === 'endurance',
        hasPits: heatType === 'endurance',
        heatNumber: msg.heatNumber ?? null,
        sessionName: msg.heatNumber ? `Heat ${msg.heatNumber}` : '',
      },
      ourTeam: ourTeam ? {
        position: ourTeam.position,
        name: ourTeam.name,
        team: ourTeam.team,
        kart: ourTeam.kart,
        lastLapMs: ourTeam.lastLapMs,
        bestLapMs: ourTeam.bestLapMs,
        avgLapMs: ourTeam.avgLapMs,
        totalLaps: ourTeam.totalLaps,
        gap: ourTeam.gap,
        gapMs: ourTeam.gapMs,
        inPit: ourTeam.inPit,
        pitCount: ourTeam.pitCount,
      } : null,
      competitors,
      found: Boolean(ourTeam),
      heatType,
      updateNumber: this._updateNumber,
      provider: 'hakafast-ws',
    };
  }

  start() {
    if (this.isRunning) return;
    if (!this.baseOrigin) {
      if (this.onError) this.onError(new Error('Invalid Hakafast URL'), 1);
      return;
    }
    this.isRunning = true;
    this._consecutiveErrors = 0;

    const wsProto = this.baseOrigin.startsWith('https') ? 'wss' : 'ws';
    const host = this.baseOrigin.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProto}://${host}/ws/live-timing`;

    this._log('INFO', `Connecting ${wsUrl} track=${this.trackSlug}`);

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (e) {
      this.isRunning = false;
      if (this.onError) this.onError(e, 1);
      return;
    }

    this.ws.onopen = () => {
      this._consecutiveErrors = 0;
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        trackSlug: this.trackSlug,
        workspaceId: this.workspaceId,
        trackId: String(this.trackId),
        mode: 'timing',
      }));
      this._log('INFO', 'WebSocket connected');
    };

    this.ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type !== 'update') return;
        this._updateNumber += 1;
        this._consecutiveErrors = 0;
        const payload = this._buildPayload(msg);
        this._lastPayload = payload;
        if (this.onUpdate) this.onUpdate(payload);
      } catch (e) {
        this._log('WARN', e.message);
      }
    };

    this.ws.onerror = () => {
      this._consecutiveErrors += 1;
      if (this.onError) this.onError(new Error('Hakafast WebSocket error'), this._consecutiveErrors);
    };

    this.ws.onclose = () => {
      if (this.isRunning) {
        this._consecutiveErrors += 1;
        if (this.onError) this.onError(new Error('Hakafast WebSocket closed'), this._consecutiveErrors);
      }
    };
  }

  stop() {
    this.isRunning = false;
    if (this.ws) {
      try { this.ws.close(); } catch (e) { /* ignore */ }
      this.ws = null;
    }
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      provider: 'hakafast',
      updateNumber: this._updateNumber,
      trackSlug: this.trackSlug,
    };
  }
}

window.HakafastTimingScraper = HakafastTimingScraper;
