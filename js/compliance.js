// Rule compliance: one place that checks a strategy against every rule the setup knows about
// (stint limits, stops, pit windows, driver totals, double stints, kart changes, lap target, custom
// rules from the regulations) and, before a plan is shown, repairs driver assignments that break them.
//
//   window.checkCompliance(timeline, config) -> { items, failing, total, score }
//   window.repairAssignments(timeline, config) -> true when anything changed
//   window.renderComplianceBanner()            draws the result in the preview screen

(function() {
    const F = function(key, vars) { return typeof window.tf === 'function' ? window.tf(key, vars) : key; };
    const fmtMin = function(ms) { return String(Math.round(ms / 60000)); };
    const fmtHM = function(ms) { return typeof window.fmtHM === 'function' ? window.fmtHM(ms) : Math.round(ms / 60000) + 'm'; };
    const unitM = function() { const v = window.t ? window.t('unitMin') : 'm'; return v && v !== 'unitMin' ? v : 'm'; };

    window.checkCompliance = function(timeline, config) {
        config = config || window.config || {};
        const rules = window.raceRules || {};
        const items = [];
        const add = function(id, ok, text, pen) { items.push({ id: id, ok: ok, text: text, pen: ok ? 0 : (pen || 1) }); };
        if (!Array.isArray(timeline) || !timeline.length) return { items: items, failing: [], total: 0, score: 0 };

        const stints = timeline.filter(function(x) { return x.type === 'stint'; });
        const pits = timeline.filter(function(x) { return x.type === 'pit'; });
        const drivers = window.drivers || [];
        const raceMs = config.raceMs || 0;
        const totalMs = timeline.reduce(function(a, x) { return a + x.duration; }, 0);
        const driveMs = stints.reduce(function(a, x) { return a + x.duration; }, 0);

        // pit entry times, measured from the green flag
        const entries = [];
        (function() { let t = 0; timeline.forEach(function(it) { if (it.type === 'pit') entries.push(t); t += it.duration; }); })();

        // 1) race length: the time target, or the lap target
        if (config.raceTarget === 'laps' && config.raceLaps > 0 && config.avgLapSec > 0) {
            const laps = driveMs / (config.avgLapSec * 1000);
            const off = Math.abs(laps - config.raceLaps);
            add('laps', off <= 1, F('cpLapTarget', { done: Math.round(laps), goal: config.raceLaps, time: fmtHM(totalMs) }), off);
        } else if (raceMs > 0) {
            const off = Math.abs(totalMs - raceMs);
            add('length', off <= 60000, F('cpRaceLength', { done: fmtHM(totalMs), goal: fmtHM(raceMs) }), off / 60000);
        }

        // 2) required number of stops
        if (config.reqStops > 0) {
            add('stops', pits.length >= config.reqStops, F('cpStops', { done: pits.length, goal: config.reqStops }), config.reqStops - pits.length);
        }

        // 3) stint length limits (min, max, fuel tank)
        const bounds = typeof window.getStintBoundsMs === 'function' ? window.getStintBoundsMs(config) : { minStintMs: 0, effectiveMaxStint: Infinity };
        if (bounds.minStintMs > 0 || bounds.effectiveMaxStint !== Infinity) {
            const bad = [];
            stints.forEach(function(s, i) {
                if (s._actual || s._done) return;
                if ((bounds.minStintMs > 0 && s.duration < bounds.minStintMs - 500) || (bounds.effectiveMaxStint !== Infinity && s.duration > bounds.effectiveMaxStint + 500)) bad.push(i + 1);
            });
            const range = (bounds.minStintMs > 0 ? fmtMin(bounds.minStintMs) : '0') + '–' + (bounds.effectiveMaxStint !== Infinity ? fmtMin(bounds.effectiveMaxStint) : '∞') + unitM();
            add('stint', bad.length === 0, F(bad.length ? 'cpStintBad' : 'cpStintOk', { range: range, list: bad.join(', ') }), bad.length * 10);
        }

        // 3b) per-driver stamina cap (used when there is no global max stint)
        if (!(config.maxStint > 0)) {
            const bad = [];
            stints.forEach(function(s, i) {
                const d = drivers[s.driverIdx];
                if (d && d.staminaMin > 0 && s.duration > d.staminaMin * 60000 + 500) bad.push(i + 1);
            });
            if (drivers.some(function(d) { return d.staminaMin > 0; })) add('stamina', bad.length === 0, F(bad.length ? 'cpStaminaBad' : 'cpStaminaOk', { list: bad.join(', ') }), bad.length * 10);
        }

        // 4) minimum pit time
        if (config.pitTime > 0 && pits.length) {
            const bad = pits.filter(function(p) { return p.duration < config.pitTime * 1000 - 500; }).length;
            add('pittime', bad === 0, F(bad ? 'cpPitTimeBad' : 'cpPitTimeOk', { n: config.pitTime, c: bad }), bad);
        }

        // 5) pit lane closed at the start / end of the race
        if (config.closedStart > 0 && entries.length) {
            const early = entries.filter(function(e) { return e < config.closedStart * 60000 - 500; }).length;
            add('closedStart', early === 0, F(early ? 'cpClosedStartBad' : 'cpClosedStartOk', { n: config.closedStart, c: early }), early * 10);
        }
        if (config.closedEnd > 0 && entries.length) {
            const limit = raceMs - config.closedEnd * 60000;
            const late = entries.filter(function(e) { return e > limit + 500; }).length;
            add('closedEnd', late === 0, F(late ? 'cpClosedEndBad' : 'cpClosedEndOk', { n: config.closedEnd, c: late }), late * 10);
        }

        // 6) custom closed windows from the regulations
        (rules.closedWindows || []).forEach(function(w) {
            const a = Number(w[0]) * 60000, b = Number(w[1]) * 60000;
            if (!(b > a)) return;
            const inside = entries.filter(function(e) { return e >= a && e <= b; }).length;
            add('window' + w[0] + '-' + w[1], inside === 0, F(inside ? 'cpWindowBad' : 'cpWindowOk', { a: w[0], b: w[1], c: inside }), inside * 10);
        });

        // 7) kart change at least every N minutes
        if (config.kartChangeIntervalMin > 0) {
            const lim = config.kartChangeIntervalMin * 60000;
            const marks = [0].concat(entries, [totalMs]);
            let worst = 0;
            for (let i = 1; i < marks.length; i++) worst = Math.max(worst, marks[i] - marks[i - 1]);
            add('kart', worst <= lim + 60000, F('cpKart', { n: config.kartChangeIntervalMin, g: fmtMin(worst) }), (worst - lim) / 60000);
        }

        // 8) driver rotation: no back-to-back stints, or at most N in a row
        if (stints.length > 1 && drivers.length > 1) {
            let run = 1, longest = 1;
            for (let i = 1; i < stints.length; i++) {
                run = stints[i].driverIdx === stints[i - 1].driverIdx ? run + 1 : 1;
                longest = Math.max(longest, run);
            }
            if (!config.allowDouble) {
                add('double', longest <= 1, F(longest <= 1 ? 'cpDoubleOk' : 'cpDoubleBad'), (longest - 1) * 100);
            } else if (config.maxConsecutive > 0) {
                add('double', longest <= config.maxConsecutive, F('cpMaxConsec', { n: config.maxConsecutive, r: longest }), (longest - config.maxConsecutive) * 100);
            }
        }

        // 9) driver totals and stint counts
        const perDriver = drivers.map(function(d, idx) {
            const mine = stints.filter(function(s) { return s.driverIdx === idx; });
            return { name: d.name, ms: mine.reduce(function(a, s) { return a + s.duration; }, 0), n: mine.length };
        });
        if (config.minDriverTotal > 0 && perDriver.length) {
            const lim = config.minDriverTotal * 60000;
            const low = perDriver.filter(function(d) { return d.ms < lim - 30000; });
            add('minDrive', low.length === 0, F(low.length ? 'cpMinDriveBad' : 'cpMinDriveOk', { n: config.minDriverTotal, list: low.map(function(d) { return d.name + ' ' + fmtMin(d.ms) + unitM(); }).join(', ') }), low.reduce(function(a, d) { return a + (lim - d.ms) / 60000; }, 0));
        }
        if (config.maxDriverTotal > 0 && perDriver.length) {
            const lim = config.maxDriverTotal * 60000;
            const high = perDriver.filter(function(d) { return d.ms > lim + 30000; });
            add('maxDrive', high.length === 0, F(high.length ? 'cpMaxDriveBad' : 'cpMaxDriveOk', { n: config.maxDriverTotal, list: high.map(function(d) { return d.name + ' ' + fmtMin(d.ms) + unitM(); }).join(', ') }), high.reduce(function(a, d) { return a + (d.ms - lim) / 60000; }, 0));
        }
        const needN = Number(rules.minStintsPerDriver) || 0;
        if (needN > 0 && perDriver.length) {
            const low = perDriver.filter(function(d) { return d.n < needN; });
            add('minStints', low.length === 0, F(low.length ? 'cpMinStintsBad' : 'cpMinStintsOk', { n: needN, list: low.map(function(d) { return d.name + ' ' + d.n; }).join(', ') }), low.reduce(function(a, d) { return a + (needN - d.n) * 5; }, 0));
        }
        const capN = Number(rules.maxStintsPerDriver) || 0;
        if (capN > 0 && perDriver.length) {
            const high = perDriver.filter(function(d) { return d.n > capN; });
            add('maxStints', high.length === 0, F(high.length ? 'cpMaxStintsBad' : 'cpMaxStintsOk', { n: capN, list: high.map(function(d) { return d.name + ' ' + d.n; }).join(', ') }), high.reduce(function(a, d) { return a + (d.n - capN) * 5; }, 0));
        }

        const failing = items.filter(function(i) { return !i.ok; });
        return { items: items, failing: failing, total: items.length, score: items.reduce(function(a, i) { return a + i.pen; }, 0) };
    };

    // Swap or reassign drivers (durations and pits stay put) while that lowers the rule score.
    window.repairAssignments = function(timeline, config) {
        config = config || window.config || {};
        if (window.state && window.state.isRunning) return false;
        const stints = (timeline || []).filter(function(x) { return x.type === 'stint'; });
        const drivers = window.drivers || [];
        if (stints.length < 2 || drivers.length < 2 || stints.length > 80) return false;

        const set = function(s, idx) {
            const d = drivers[idx];
            s.driverIdx = idx; s.driverName = d.name; s.color = d.color; s.squad = d.squad;
        };
        const snap = function(s) { return { driverIdx: s.driverIdx, driverName: s.driverName, color: s.color, squad: s.squad }; };
        const score = function() { return window.checkCompliance(timeline, config).score; };

        let cur = score(), changed = false;
        for (let iter = 0; iter < 40 && cur > 0; iter++) {
            let best = null;
            for (let i = 1; i < stints.length; i++) {            // stint 0 keeps the chosen starter
                const orig = snap(stints[i]);
                for (let d = 0; d < drivers.length; d++) {        // move: give stint i to driver d
                    if (d === orig.driverIdx) continue;
                    set(stints[i], d);
                    const sc = score();
                    if (sc < cur && (!best || sc < best.sc)) best = { sc: sc, moves: [[i, d]] };
                }
                Object.assign(stints[i], orig);
                for (let j = i + 1; j < stints.length; j++) {     // swap: i and j trade drivers
                    if (stints[j].driverIdx === stints[i].driverIdx) continue;
                    const oi = snap(stints[i]), oj = snap(stints[j]);
                    set(stints[i], oj.driverIdx); set(stints[j], oi.driverIdx);
                    const sc = score();
                    Object.assign(stints[i], oi); Object.assign(stints[j], oj);
                    if (sc < cur && (!best || sc < best.sc)) best = { sc: sc, moves: [[i, oj.driverIdx], [j, oi.driverIdx]] };
                }
            }
            if (!best) break;
            best.moves.forEach(function(m) { set(stints[m[0]], m[1]); });
            cur = best.sc; changed = true;
        }
        return changed;
    };

    // ---------- preview banner ----------

    window.renderComplianceBanner = function() {
        const el = document.getElementById('complianceBanner');
        if (!el) return;
        const c = window.checkCompliance(window.previewData && window.previewData.timeline, window.config);
        window._compliance = c;
        if (!c.total) { el.classList.add('hidden'); return; }
        const ok = c.failing.length === 0;
        const open = el.dataset.open === '1';
        const esc = window._escHtml || function(x) { return x; };
        const head = ok
            ? '<i class="fas fa-shield-alt"></i> ' + F('cpHeadOk', { n: c.total })
            : '<i class="fas fa-exclamation-triangle"></i> ' + F('cpHeadBad', { b: c.failing.length, n: c.total });
        el.className = 'compliance ' + (ok ? 'is-ok' : 'is-bad');
        el.innerHTML = '<button type="button" class="compliance-head" onclick="window._toggleCompliance()">' + head
            + '<i class="fas fa-chevron-' + (open ? 'up' : 'down') + ' compliance-chev"></i></button>'
            + (open ? '<ul class="compliance-list">' + c.items.map(function(i) {
                return '<li class="' + (i.ok ? 'ok' : 'bad') + '"><i class="fas fa-' + (i.ok ? 'check' : 'times') + '"></i> ' + esc(i.text) + '</li>';
            }).join('') + '</ul>' : '');
        el.dataset.open = open ? '1' : '0';
    };

    window._toggleCompliance = function() {
        const el = document.getElementById('complianceBanner');
        if (!el) return;
        el.dataset.open = el.dataset.open === '1' ? '0' : '1';
        window.renderComplianceBanner();
    };
})();
