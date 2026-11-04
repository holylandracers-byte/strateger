// Race rules: structured rules that change the strategy itself, not just a note.
//   closedWindows      [[fromMin, toMin], ...]  pit lane closed, minutes from the race start
//   directionChanges  [{at:'clock'|'half', time:'HH:MM', lane:'in'|'out'|'both', before, after}]  track reverses at this clock
//                                               time (or at half the race length); the pit lane is shut from `before` minutes
//                                               ahead to `after` minutes behind it. `lane` says which pit is closed: entering
//                                               (in), leaving (out) or both. It becomes a closed window.
//   minStintsPerDriver n                         every driver must drive at least n stints
//   notes              [text, ...]               rules the engine cannot model, kept as a checklist
// The engine (applyRaceRules) runs from runSim() after the base plan is built, nudges pit stops out of
// closed windows without breaking min/max stint, rebalances stints between drivers, and reports each rule.

window._RULE_FIELDS = {
    raceLaps: 'Total laps', raceDuration: 'Duration (h)', reqPitStops: 'Required stops', minStint: 'Min stint (min)', maxStint: 'Max stint (min)',
    minPitTime: 'Min pit time (s)', pitClosedStart: 'Pit closed at start (min)', pitClosedEnd: 'Pit closed at end (min)',
    minDriverTime: 'Min driver total (min)', maxDriverTime: 'Max driver total (min)', kartChangeInterval: 'Kart change every (min)',
    reqExtraPits: 'Extra pits', numTeams: 'Competing teams', minPitLapSec: 'Min pit lap (s)'
};

window.raceRules = (function() {
    let r = null;
    try { r = JSON.parse(localStorage.getItem('strateger_race_rules') || 'null'); } catch (e) {}
    if (!r) {
        let notes = [];
        try { notes = JSON.parse(localStorage.getItem('strateger_rule_notes') || '[]'); } catch (e) {}
        r = { closedWindows: [], directionChanges: [], minStintsPerDriver: 0, maxStintsPerDriver: 0, notes: notes };
    }
    r.closedWindows = Array.isArray(r.closedWindows) ? r.closedWindows : [];
    r.directionChanges = Array.isArray(r.directionChanges) ? r.directionChanges : [];
    r.notes = Array.isArray(r.notes) ? r.notes : [];
    r.minStintsPerDriver = Number(r.minStintsPerDriver) || 0;
    r.maxStintsPerDriver = Number(r.maxStintsPerDriver) || 0;
    return r;
})();
window._ruleMessages = [];

// Every closed pit window in minutes from the race start: the typed windows plus each direction change
// converted from its clock time (needs the race start time; a change before the start rolls to the next day).
window.raceClosedWindows = function() {
    const r = window.raceRules || {};
    const out = (r.closedWindows || []).map(function(w) { return [Number(w[0]), Number(w[1]), 'in']; });
    const st = String((document.getElementById('raceStartTime') || {}).value || '').split(':');
    const hasStart = st.length >= 2 && Number.isFinite(+st[0]) && Number.isFinite(+st[1]);
    const startMin = hasStart ? (+st[0]) * 60 + (+st[1]) : 0;
    const raceMin = ((window.config && window.config.raceMs) || (parseFloat((document.getElementById('raceDuration') || {}).value) || 0) * 3600000) / 60000;
    (r.directionChanges || []).forEach(function(d) {
        let at;
        if (d.at === 'half') {
            if (!(raceMin > 0)) return;
            at = raceMin / 2;
        } else {
            const p = String(d.time || '').split(':');
            if (!hasStart || p.length < 2 || !Number.isFinite(+p[0]) || !Number.isFinite(+p[1])) return;
            at = (+p[0]) * 60 + (+p[1]) - startMin;
            if (at < 0) at += 1440;
        }
        const lane = d.lane === 'out' || d.lane === 'both' ? d.lane : 'in';
        out.push([Math.max(0, at - (Number(d.before) || 0)), at + (Number(d.after) || 0), lane]);
    });
    return out;
};

window._escHtml = function(x) {
    return String(x).replace(/[&<>"]/g, function(c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; });
};

window.saveRaceRules = function() {
    try { localStorage.setItem('strateger_race_rules', JSON.stringify(window.raceRules)); } catch (e) {}
    if (typeof window.saveHostState === 'function') { try { window.saveHostState(); } catch (e) {} }
};

// ---------- engine ----------

window.applyRaceRules = function(timeline, config) {
    const rules = window.raceRules || {};
    const msgs = [];
    const minMs = (config.minStint || 0) * 60000;
    const maxMs = (config.maxStint || 0) * 60000;
    const raceTotalMs = Number(config.raceMs) || 0;
    const wins = window.raceClosedWindows()
        .map(function(w) { return [Number(w[0]) * 60000, Number(w[1]) * 60000, w[2] || 'in']; });
    // The "closed at start / end" settings are closed windows too: pits must stay out of them like any other.
    if ((config.closedStart || 0) > 0) wins.push([0, config.closedStart * 60000, 'in']);
    if ((config.closedEnd || 0) > 0 && raceTotalMs > 0) wins.push([raceTotalMs - config.closedEnd * 60000, raceTotalMs, 'in']);
    for (let i = wins.length - 1; i >= 0; i--) if (!Number.isFinite(wins[i][0]) || !Number.isFinite(wins[i][1]) || wins[i][1] <= wins[i][0]) wins.splice(i, 1);

    // 1) keep pits out of closed windows. A closed window shuts the pit entry, the pit exit or both (its `lane`).
    //    A run of consecutive pits [p..q] is shifted together by d: the stint before pit p absorbs +d, the stint
    //    after pit q absorbs -d, stints in between keep their length. Stints aim one minute under the max first.
    const stintsArr = timeline.filter(function(x) { return x.type === 'stint'; });
    const pitsArr = timeline.filter(function(x) { return x.type === 'pit'; });
    const hit = function(w, entry, dur) {
        const lane = w[2];
        return ((lane === 'in' || lane === 'both') && entry >= w[0] && entry <= w[1])
            || ((lane === 'out' || lane === 'both') && entry + dur >= w[0] && entry + dur <= w[1]);
    };
    const blocked = function(entry, dur) { return wins.filter(function(w) { return hit(w, entry, dur); })[0] || null; };
    const entriesNow = function() {
        let t = 0; const e = [];
        timeline.forEach(function(it) { if (it.type === 'pit') e.push(t); t += it.duration; });
        return e;
    };
    const stuck = {};
    const softMs = maxMs > 0 ? Math.max(minMs, maxMs - 60000) : 0;
    for (let pass = 0; pass < 48 && wins.length; pass++) {
        const e = entriesNow();
        let k = -1;
        for (let i = 0; i < e.length; i++) if (blocked(e[i], pitsArr[i].duration) && !stuck[i]) { k = i; break; }
        if (k < 0) break;
        const w = blocked(e[k], pitsArr[k].duration);
        const dur = pitsArr[k].duration;
        const exitAdj = (w[2] === 'in') ? 0 : dur;
        const tries = [(w[0] - 30000) - (e[k] + exitAdj), (w[1] + 5000) - e[k] - (w[2] === 'out' ? dur : 0)];
        let best = null;
        [softMs, maxMs].forEach(function(limit, level) {
            if (best) return;
            const okAt = function(ms) { return ms >= minMs && (!limit || ms <= limit); };
            tries.forEach(function(d) {
                for (let span = 0; span < pitsArr.length; span++) {
                    for (let p = Math.max(0, k - span); p <= k; p++) {
                        const q = p + span;
                        if (q < k || q >= pitsArr.length) continue;
                        if (!okAt(stintsArr[p].duration + d) || !okAt(stintsArr[q + 1].duration - d)) continue;
                        let clear = true;
                        for (let j = p; j <= q; j++) if (blocked(e[j] + d, pitsArr[j].duration)) clear = false;
                        if (!clear) continue;
                        const cost = Math.abs(d) + span * 1000;
                        if (!best || cost < best.cost) best = { d: d, p: p, q: q, cost: cost };
                    }
                }
            });
        });
        if (!best) { stuck[k] = true; continue; }
        stintsArr[best.p].duration += best.d;
        stintsArr[best.q + 1].duration -= best.d;
    }
    (function() { const e = entriesNow(); pitsArr.forEach(function(p, i) { p.raceTimeAtEntry = e[i]; }); })();

    // 2) every driver drives at least N stints
    const need = Math.max(Number(rules.minStintsPerDriver) || 0, config.everyoneDrives ? 1 : 0);
    if (need > 0) {
        const stints = timeline.filter(function(x) { return x.type === 'stint'; });
        const nDrivers = (window.drivers || []).length;
        const count = function(idx) { return stints.filter(function(s) { return s.driverIdx === idx; }).length; };
        const adjacentSame = function(k, idx) {
            return !config.allowDouble && ((stints[k - 1] && stints[k - 1].driverIdx === idx) || (stints[k + 1] && stints[k + 1].driverIdx === idx));
        };
        for (let guard = 0; guard < 40; guard++) {
            let low = -1;
            for (let d = 0; d < nDrivers; d++) if (count(d) < need && (low < 0 || count(d) < count(low))) low = d;
            if (low < 0) break;
            let best = -1;
            stints.forEach(function(s, k) {
                if (k === 0 || count(s.driverIdx) <= need || adjacentSame(k, low)) return;
                if (best < 0 || count(s.driverIdx) > count(stints[best].driverIdx)) best = k;
            });
            if (best < 0) break;
            const drv = window.drivers[low];
            stints[best].driverIdx = low;
            stints[best].driverName = drv.name;
            stints[best].color = drv.color;
            stints[best].squad = drv.squad;
        }
        (window.drivers || []).forEach(function(d, idx) {
            const c = count(idx);
            msgs.push({ ok: c >= need, text: d.name + ': ' + c + '/' + need + ' ' + window.tt('stints') });
        });
    }

    // 2b) no driver drives more than N stints: hand the extra ones to whoever has the fewest
    const cap = Number(rules.maxStintsPerDriver) || 0;
    if (cap > 0) {
        const st = timeline.filter(function(x) { return x.type === 'stint'; });
        const n = (window.drivers || []).length;
        const cnt = function(idx) { return st.filter(function(s) { return s.driverIdx === idx; }).length; };
        for (let guard = 0; guard < 60; guard++) {
            let over = -1;
            for (let d = 0; d < n; d++) if (cnt(d) > cap && (over < 0 || cnt(d) > cnt(over))) over = d;
            if (over < 0) break;
            let done = false;
            for (let k = st.length - 1; k > 0 && !done; k--) {
                if (st[k].driverIdx !== over) continue;
                const cands = [];
                for (let d = 0; d < n; d++) {
                    if (d === over || cnt(d) >= cap) continue;
                    if (!config.allowDouble && ((st[k - 1] && st[k - 1].driverIdx === d) || (st[k + 1] && st[k + 1].driverIdx === d))) continue;
                    cands.push(d);
                }
                cands.sort(function(a, b) { return cnt(a) - cnt(b); });
                if (cands.length) {
                    const drv = window.drivers[cands[0]];
                    st[k].driverIdx = cands[0]; st[k].driverName = drv.name; st[k].color = drv.color; st[k].squad = drv.squad;
                    done = true;
                }
            }
            if (!done) break;
        }
        (window.drivers || []).forEach(function(d, idx) {
            const c = cnt(idx);
            msgs.push({ ok: c <= cap, text: d.name + ': ' + c + ' ' + window.tt('stints') + ' (' + window.tt('max') + ' ' + cap + ')' });
        });
    }

    // 3) report each closed window
    const laneTxt = { 'in': window.tt('pit in'), out: window.tt('pit out'), both: window.tt('pit in and out') };
    wins.forEach(function(w) {
        let t = 0, bad = 0;
        timeline.forEach(function(item) {
            if (item.type === 'pit' && hit(w, t, item.duration)) bad++;
            t += item.duration;
        });
        const mins = function(ms) { return Math.round(ms / 600) / 100; };
        msgs.push({ ok: bad === 0, text: window.tt('Pit closed') + ' ' + mins(w[0]) + '–' + mins(w[1]) + ' ' + window.tt('min') + (w[2] !== 'in' ? ' (' + laneTxt[w[2]] + ')' : '') + ': ' + (bad ? bad + ' ' + window.tt('pit(s) inside the window') : window.tt('clear')) });
    });

    window._ruleMessages = msgs;
    if (typeof window.recalculateTimelineTimes === 'function') window.recalculateTimelineTimes();
    return msgs;
};

window._ruleMessagesHtml = function() {
    const msgs = window._ruleMessages || [];
    if (!msgs.length) return '';
    return msgs.map(function(m) { return '<span class="rule-status-' + (m.ok ? 'ok' : 'bad') + '"><i class="fas fa-' + (m.ok ? 'check' : 'times') + '"></i> ' + window._escHtml(m.text) + '</span>'; }).join('');
};

// ---------- setup UI: "Custom rules" card inside Advanced Constraints ----------

// Rules the user added by hand this session (kart changes is a section that lives elsewhere in the page).
window._ruleShow = window._ruleShow || { stints: false, kart: false };
window._ruleMenuOpen = false;
window._KART_FIELDS = ['kartChangeInterval', 'reqExtraPits', 'minPitLapSec', 'numTeams'];
window._kartRuleActive = function() {
    return window._KART_FIELDS.some(function(id) { const el = document.getElementById(id); return el && Number(el.value) > 0; });
};

window.renderRuleNotes = function() {
    const anchor = document.getElementById('maxConsecutiveRow');
    const body = anchor && anchor.closest('.collapse-body');
    if (!body) return;
    let card = document.getElementById('raceRuleNotesCard');
    if (!card) {
        card = document.createElement('div');
        card.id = 'raceRuleNotesCard';
        card.className = 'rule-custom';
        body.appendChild(card);
    }
    const r = window.raceRules;
    const esc = window._escHtml;
    const show = window._ruleShow;
    const kartSec = document.getElementById('extraPitSection');
    const showStints = show.stints || r.minStintsPerDriver > 0 || r.maxStintsPerDriver > 0;
    const showKart = show.kart || window._kartRuleActive();
    let collapsed = true;
    try { collapsed = localStorage.getItem('strateger_rules_card_collapsed') !== '0'; } catch (e) {}
    const active = (r.directionChanges || []).length + (showStints ? 1 : 0) + (showKart ? 1 : 0) + r.notes.length + r.closedWindows.length;
    card.classList.toggle('is-collapsed', collapsed);
    const opt = function(v, cur, label) { return '<option value="' + v + '"' + (v === cur ? ' selected' : '') + '>' + label + '</option>'; };
    const delBtn = function(attr, label) { return '<button type="button" class="rule-window-del rule-dir-del" ' + attr + ' aria-label="' + label + '"><i class="fas fa-trash-alt"></i></button>'; };
    const dirRows = (r.directionChanges || []).map(function(d, i) {
        const half = d.at === 'half';
        const lane = d.lane === 'out' || d.lane === 'both' ? d.lane : 'in';
        return '<div class="rule-dir">'
            + '<div class="rule-dir-title">' + window.tt('Track direction change') + '</div>'
            + '<label class="rule-dir-f"><span>' + window.tt('Direction changes at') + '</span><select class="input-field" data-dir="' + i + '" data-f="at">' + opt('clock', half ? 'half' : 'clock', window.tt('Clock time')) + opt('half', half ? 'half' : 'clock', window.tt('Half the race')) + '</select></label>'
            + '<label class="rule-dir-f"><span>' + window.tt('Closed pit') + '</span><select class="input-field" data-dir="' + i + '" data-f="lane">' + opt('in', lane, window.tt('Pit in')) + opt('out', lane, window.tt('Pit out')) + opt('both', lane, window.tt('Pit in and out')) + '</select></label>'
            + (half ? '' : '<label class="rule-dir-f rule-dir-time"><span>' + window.tt('Time') + '</span><input type="time" class="input-field" value="' + esc(d.time || '') + '" data-dir="' + i + '" data-f="time"></label>')
            + '<label class="rule-dir-f"><span>' + window.tt('Closed before (min)') + '</span><input type="number" min="0" class="input-field" value="' + Number(d.before || 0) + '" data-dir="' + i + '" data-f="before"></label>'
            + '<label class="rule-dir-f"><span>' + window.tt('Closed after (min)') + '</span><input type="number" min="0" class="input-field" value="' + Number(d.after || 0) + '" data-dir="' + i + '" data-f="after"></label>'
            + delBtn('data-dir-del="' + i + '"', window.tt('Remove'))
            + '</div>';
    }).join('');
    const winRows = r.closedWindows.map(function(w, i) {
        return '<div class="rule-dir"><div class="rule-dir-title">' + window.tt('Pit lane closed windows (minutes from race start)') + '</div>'
            + '<label class="rule-dir-f"><span>' + window.tt('From') + '</span><input type="number" min="0" value="' + Number(w[0]) + '" class="input-field" data-win="' + i + '" data-pos="0"></label>'
            + '<label class="rule-dir-f"><span>' + window.tt('To') + '</span><input type="number" min="0" value="' + Number(w[1]) + '" class="input-field" data-win="' + i + '" data-pos="1"></label>'
            + delBtn('data-win-del="' + i + '"', window.tt('Remove')) + '</div>';
    }).join('');
    const stintRow = showStints
        ? '<div class="rule-dir"><div class="rule-dir-title">' + window.tt('Stints per driver') + '</div>'
            + '<label class="rule-dir-f"><span>' + window.tt('Min stints per driver') + '</span><input type="number" min="0" id="ruleMinStints" class="input-field" value="' + r.minStintsPerDriver + '"></label>'
            + '<label class="rule-dir-f"><span>' + window.tt('Max stints per driver') + '</span><input type="number" min="0" id="ruleMaxStints" class="input-field" value="' + r.maxStintsPerDriver + '"></label>'
            + delBtn('id="ruleStintsDel"', window.tt('Remove')) + '</div>'
        : '';
    const menuItem = function(id, icon, title, hint) {
        return '<button type="button" class="rule-menu-item" id="' + id + '"><i class="fas fa-' + icon + '" aria-hidden="true"></i><span><b>' + title + '</b><small>' + hint + '</small></span></button>';
    };
    const noteRows = r.notes.length
        ? '<div class="rule-dir"><div class="rule-dir-title">' + window.tt('Other rules') + ' <span class="rule-note" style="color:#94a3b8">' + window.tt('checklist, not calculated') + '</span></div>'
            + '<ul class="rule-notes" style="grid-column:1/-1">' + r.notes.map(function(n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>'
            + delBtn('id="ruleClearNotes"', window.tt('Clear')) + '</div>'
        : '';
    card.innerHTML =
        '<button type="button" id="ruleCardToggle" class="sub-head rule-card-toggle" aria-expanded="' + (!collapsed) + '" aria-controls="ruleCardBody"><span class="sub-title">' + window.tt('Custom race rules') + '</span>'
        + '<span class="sub-sum">' + (active ? active + ' ' + window.tt('set') : '') + '</span><i class="fas fa-chevron-down sub-chev" aria-hidden="true"></i></button>'
        + '<div id="ruleCardBody" class="rule-card-body"' + (collapsed ? ' hidden' : '') + '>'
        + (active ? '' : '<p class="set-hint" style="margin-top:0">' + window.tt('Only for rules in the regulations that the settings above do not cover, such as a track direction change. Nothing here is needed otherwise.') + '</p>')
        + dirRows + winRows + stintRow + noteRows
        + '<div id="ruleKartSlot"></div>'
        + '<button type="button" id="ruleAddRule" class="rule-add" aria-expanded="' + window._ruleMenuOpen + '"><i class="fas fa-plus"></i> ' + window.tt('Add a rule') + '</button>'
        + (window._ruleMenuOpen
            ? '<div class="rule-menu">'
                + menuItem('ruleMenuDir', 'random', window.tt('Track direction change'), window.tt('The pit lane is shut around the moment the track reverses.'))
                + (showStints ? '' : menuItem('ruleMenuStints', 'user-clock', window.tt('Stints per driver'), window.tt('Each driver must drive at least, or at most, this many stints.')))
                + (showKart ? '' : menuItem('ruleMenuKart', 'exchange-alt', window.tt('Kart changes'), window.tt('Forced kart swaps, extra pits, rotating between teams.')))
                + '</div>'
            : '')
        + (active ? '<div id="ruleStatus" class="rule-status"></div>' : '')
        + '</div>';

    const slot = card.querySelector('#ruleKartSlot');
    if (kartSec && slot) {
        slot.appendChild(kartSec);
        kartSec.classList.toggle('hidden', !showKart);
        if (showKart) {
            const del = document.createElement('button');
            del.type = 'button'; del.id = 'ruleKartDel'; del.className = 'rule-add';
            del.innerHTML = '<i class="fas fa-trash-alt"></i> ' + window.tt('Remove kart rules');
            del.addEventListener('click', function() {
                window._KART_FIELDS.forEach(function(id) { const el = document.getElementById(id); if (el) el.value = ''; });
                show.kart = false; window.renderRuleNotes(); if (window.runSim) window.runSim();
            });
            slot.appendChild(del);
        }
    }

    const changed = function() { window.saveRaceRules(); if (typeof window.runSim === 'function') window.runSim(); };
    const redo = function() { window.saveRaceRules(); window.renderRuleNotes(); if (window.runSim) window.runSim(); };
    card.querySelectorAll('input[data-win]').forEach(function(inp) {
        inp.addEventListener('change', function() {
            r.closedWindows[Number(inp.dataset.win)][Number(inp.dataset.pos)] = Number(inp.value) || 0;
            changed();
        });
    });
    card.querySelectorAll('[data-win-del]').forEach(function(btn) {
        btn.addEventListener('click', function() { r.closedWindows.splice(Number(btn.dataset.winDel), 1); redo(); });
    });
    card.querySelectorAll('[data-dir]').forEach(function(inp) {
        inp.addEventListener('change', function() {
            const d = r.directionChanges[Number(inp.dataset.dir)];
            const f = inp.dataset.f;
            d[f] = (f === 'time' || f === 'at' || f === 'lane') ? inp.value : Math.max(0, Number(inp.value) || 0);
            if (f === 'at') window.renderRuleNotes();
            changed();
        });
    });
    card.querySelectorAll('[data-dir-del]').forEach(function(btn) {
        btn.addEventListener('click', function() { r.directionChanges.splice(Number(btn.dataset.dirDel), 1); redo(); });
    });
    const pick = function(key) { window._ruleMenuOpen = false; if (key) show[key] = true; window.renderRuleNotes(); };
    card.querySelector('#ruleAddRule').addEventListener('click', function() { window._ruleMenuOpen = !window._ruleMenuOpen; window.renderRuleNotes(); });
    const mDir = card.querySelector('#ruleMenuDir');
    if (mDir) mDir.addEventListener('click', function() { window._ruleMenuOpen = false; r.directionChanges.push({ at: 'half', time: '', lane: 'in', before: 5, after: 5 }); redo(); });
    const mSt = card.querySelector('#ruleMenuStints');
    if (mSt) mSt.addEventListener('click', function() { pick('stints'); });
    const mKart = card.querySelector('#ruleMenuKart');
    if (mKart) mKart.addEventListener('click', function() { pick('kart'); });
    const minS = card.querySelector('#ruleMinStints'), maxS = card.querySelector('#ruleMaxStints');
    if (minS) minS.addEventListener('change', function(e) { r.minStintsPerDriver = Math.max(0, parseInt(e.target.value) || 0); changed(); });
    if (maxS) maxS.addEventListener('change', function(e) { r.maxStintsPerDriver = Math.max(0, parseInt(e.target.value) || 0); changed(); });
    const sDel = card.querySelector('#ruleStintsDel');
    if (sDel) sDel.addEventListener('click', function() { r.minStintsPerDriver = 0; r.maxStintsPerDriver = 0; show.stints = false; redo(); });
    card.querySelector('#ruleCardToggle').addEventListener('click', function() {
        const now = !card.classList.contains('is-collapsed');
        try { localStorage.setItem('strateger_rules_card_collapsed', now ? '1' : '0'); } catch (e) {}
        window.renderRuleNotes();
    });
    const clr = card.querySelector('#ruleClearNotes');
    if (clr) clr.addEventListener('click', function() { r.notes = []; redo(); });
    window.renderRuleStatus();
};

window.renderRuleStatus = function() {
    const el = document.getElementById('ruleStatus');
    if (el) el.innerHTML = window._ruleMessagesHtml();
};

// ---------- AI proposal: review, then apply ----------

window._showRulesProposal = function(text) {
    const m = text.match(/\{[\s\S]*\}/);
    let parsed = null;
    try { parsed = m && JSON.parse(m[0]); } catch (e) { return; }
    if (!parsed) return;
    const settings = Object.entries(parsed.settings || {}).filter(function(kv) {
        return window.tt(window._RULE_FIELDS[kv[0]]) && kv[1] !== null && kv[1] !== '' && Number.isFinite(Number(kv[1])) && document.getElementById(kv[0]);
    });
    const sv = function(k) { const f = settings.filter(function(kv) { return kv[0] === k; })[0]; return f ? Number(f[1]) : 0; };
    const raceMin = (sv('raceDuration') || parseFloat(document.getElementById('raceDuration')?.value) || 0) * 60;
    let wins = (Array.isArray(parsed.closedWindows) ? parsed.closedWindows : [])
        .filter(function(w) { return Array.isArray(w) && Number.isFinite(Number(w[0])) && Number.isFinite(Number(w[1])) && Number(w[1]) > Number(w[0]); })
        .map(function(w) { return [Number(w[0]), Number(w[1])]; }).slice(0, 12);
    // The first/last-N-minutes closures already have their own settings: don't list them twice.
    wins = wins.filter(function(w) {
        const isStart = sv('pitClosedStart') && w[0] === 0 && w[1] === sv('pitClosedStart');
        const isEnd = sv('pitClosedEnd') && raceMin && w[1] === raceMin && w[0] === raceMin - sv('pitClosedEnd');
        return !(isStart || isEnd);
    });
    // "Kart change every N min" is only a real rule when the organizer forces a swap on a clock,
    // on top of normal pit stops. A value equal to the average stint is just derived from the stop count.
    const avgStint = sv('reqPitStops') && raceMin ? raceMin / (sv('reqPitStops') + 1) : 0;
    const ksi = settings.findIndex(function(kv) { return kv[0] === 'kartChangeInterval'; });
    if (ksi >= 0 && avgStint && Math.abs(Number(settings[ksi][1]) - avgStint) <= 2) settings.splice(ksi, 1);
    const dirs = (Array.isArray(parsed.directionChanges) ? parsed.directionChanges : [])
        .filter(function(d) { return d && /^\d{1,2}:\d{2}/.test(String(d.time || '')); })
        .map(function(d) { return { at: 'clock', lane: 'in', time: String(d.time).slice(0, 5).padStart(5, '0'), before: Math.max(0, Number(d.beforeMin) || 0), after: Math.max(0, Number(d.afterMin) || 0) }; }).slice(0, 6);
    const reasons = (parsed.reasons && typeof parsed.reasons === 'object') ? parsed.reasons : {};
    const minStints = Number(parsed.minStintsPerDriver) > 0 ? Math.floor(Number(parsed.minStintsPerDriver)) : 0;
    const maxStints = Number(parsed.maxStintsPerDriver) > 0 ? Math.floor(Number(parsed.maxStintsPerDriver)) : 0;
    const notes = Array.isArray(parsed.notes) ? parsed.notes.map(String).filter(Boolean).slice(0, 20) : [];
    if (!settings.length && !wins.length && !dirs.length && !minStints && !maxStints && !notes.length) return;

    const old = document.getElementById('rulesProposalModal');
    if (old) old.remove();
    const esc = window._escHtml;
    // Plain-language meaning shown under a rule, plus the regulation's own wording when the AI quoted it.
    const MEANING = {
        kartChangeInterval: 'The organizer forces a kart swap on this clock, on top of normal pit stops.',
        pitClosedStart: 'No pit stops during the first minutes of the race.',
        pitClosedEnd: 'No pit stops during the last minutes of the race.',
        minDriverTime: 'Every driver must drive at least this long in total.',
        maxDriverTime: 'No driver may drive more than this in total.'
    };
    const row = function(attrs, label, from, to, key) {
        const meaning = MEANING[key] ? window.tt(MEANING[key]) : '';
        const why = reasons[key] ? '“' + esc(String(reasons[key]).slice(0, 140)) + '”' : '';
        const note = (meaning || why) ? '<span class="block text-[11px] text-gray-500 leading-snug">' + esc(meaning) + (meaning && why ? ' ' : '') + why + '</span>' : '';
        return '<label class="flex items-center gap-3 bg-navy-800 border border-gray-700 rounded-lg px-3 py-2 cursor-pointer">'
            + '<input type="checkbox" checked ' + attrs + ' class="accent-ice w-4 h-4"><span class="flex-1 text-sm text-gray-200"><span class="block">' + label + '</span>' + note + '</span>'
            + '<span class="text-xs text-gray-500">' + esc(from) + ' →</span><span class="text-sm font-bold text-neon">' + esc(to) + '</span></label>';
    };
    const ov = document.createElement('div');
    ov.id = 'rulesProposalModal';
    ov.className = 'fixed inset-0 bg-black/85 flex items-center justify-center p-4';
    ov.style.zIndex = 210;
    ov.innerHTML = '<div class="bg-navy-900 border border-purple-500/40 rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto">'
        + '<div class="text-base font-black text-white">' + window.tt('Rules found in the regulations') + '</div>'
        + '<div class="text-[11px] text-gray-500">' + window.tt('Untick anything that is wrong. Applied rules change the strategy.') + '</div>'
        + '<div class="space-y-1">'
        + settings.map(function(kv) { return row('data-rule-key="' + kv[0] + '" data-rule-val="' + Number(kv[1]) + '"', window.tt(window._RULE_FIELDS[kv[0]]), document.getElementById(kv[0]).value || '—', Number(kv[1]), kv[0]); }).join('')
        + (wins.length ? row('data-rule-wins="1"', window.tt('Pit lane closed during the race (min from start)'), '—', wins.map(function(w) { return w[0] + '–' + w[1]; }).join(', '), 'closedWindows') : '')
        + (dirs.length ? row('data-rule-dirs="1"', window.tt('Track direction change (clock time)'), '—', dirs.map(function(d) { return d.time + ' (−' + d.before + '/+' + d.after + ')'; }).join(', '), 'directionChanges') : '')
        + (minStints ? row('data-rule-minstints="' + minStints + '"', window.tt('Min stints per driver'), window.raceRules.minStintsPerDriver || '—', minStints, 'minStintsPerDriver') : '')
        + (maxStints ? row('data-rule-maxstints="' + maxStints + '"', window.tt('Max stints per driver'), window.raceRules.maxStintsPerDriver || '—', maxStints, 'maxStintsPerDriver') : '')
        + '</div>'
        + (notes.length ? '<div><div class="text-xs font-bold text-purple-300 mb-1">' + window.tt('Also noted (kept as a checklist)') + '</div><ul class="space-y-1">'
            + notes.map(function(n) { return '<li class="text-xs text-gray-300">• ' + esc(n) + '</li>'; }).join('') + '</ul></div>' : '')
        + '<div class="flex gap-2 pt-1"><button type="button" id="rulesProposalNo" class="flex-1 bg-navy-800 border border-gray-600 text-gray-300 font-bold py-2 rounded-lg text-sm">' + window.tt('Dismiss') + '</button>'
        + '<button type="button" id="rulesProposalYes" class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg text-sm">' + window.tt('Apply to setup') + '</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#rulesProposalNo').onclick = function() { ov.remove(); };
    ov.querySelector('#rulesProposalYes').onclick = function() {
        const r = window.raceRules;
        ov.querySelectorAll('input[data-rule-key]:checked').forEach(function(cb) {
            const el = document.getElementById(cb.dataset.ruleKey);
            if (cb.dataset.ruleKey === 'raceLaps' && el) { el.value = cb.dataset.ruleVal; if (typeof window._setRaceTarget === 'function') window._setRaceTarget('laps', true); return; }
            if (cb.dataset.ruleKey === 'raceDuration' && window.isLapRace && window.isLapRace()) return;
            if (el) el.value = cb.dataset.ruleVal;
        });
        if (typeof window._normalizeOffFields === 'function') window._normalizeOffFields();
        if (wins.length && ov.querySelector('input[data-rule-wins]:checked')) r.closedWindows = wins;
        if (dirs.length && ov.querySelector('input[data-rule-dirs]:checked')) r.directionChanges = dirs;
        const ms = ov.querySelector('input[data-rule-minstints]:checked');
        if (ms) r.minStintsPerDriver = minStints;
        if (ov.querySelector('input[data-rule-maxstints]:checked')) r.maxStintsPerDriver = maxStints;
        if (notes.length) r.notes = notes;
        window.saveRaceRules();
        ['kartChangeInterval', 'numTeams'].forEach(function(id) {
            const el = document.getElementById(id);
            const sec = document.getElementById('extraPitSection');
            if (el && sec && Number(el.value) > 0) window._ruleShow.kart = true;
        });
        document.querySelectorAll('#setupScreen .collapsible-section.collapsed').forEach(function(s) { if (s.querySelector('#raceRuleNotesCard, #maxConsecutiveRow')) s.classList.remove('collapsed'); });
        if (typeof window.runSim === 'function') window.runSim();
        window.renderRuleNotes();
        ov.remove();
        window.showToast('✓ Rules applied to the strategy', 'success', 3000);
    };
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function() { window.renderRuleNotes(); });
else window.renderRuleNotes();
