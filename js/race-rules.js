// Race rules: structured rules that change the strategy itself, not just a note.
//   closedWindows      [[fromMin, toMin], ...]  pit lane closed, minutes from the race start
//   minStintsPerDriver n                         every driver must drive at least n stints
//   notes              [text, ...]               rules the engine cannot model, kept as a checklist
// The engine (applyRaceRules) runs from runSim() after the base plan is built, nudges pit stops out of
// closed windows without breaking min/max stint, rebalances stints between drivers, and reports each rule.

window._RULE_FIELDS = {
    raceDuration: 'Duration (h)', reqPitStops: 'Required stops', minStint: 'Min stint (min)', maxStint: 'Max stint (min)',
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
        r = { closedWindows: [], minStintsPerDriver: 0, maxStintsPerDriver: 0, notes: notes };
    }
    r.closedWindows = Array.isArray(r.closedWindows) ? r.closedWindows : [];
    r.notes = Array.isArray(r.notes) ? r.notes : [];
    r.minStintsPerDriver = Number(r.minStintsPerDriver) || 0;
    r.maxStintsPerDriver = Number(r.maxStintsPerDriver) || 0;
    return r;
})();
window._ruleMessages = [];

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
    const okLen = function(ms) { return ms >= minMs && (!maxMs || ms <= maxMs); };
    const wins = (rules.closedWindows || [])
        .map(function(w) { return [Number(w[0]) * 60000, Number(w[1]) * 60000]; })
        .filter(function(w) { return Number.isFinite(w[0]) && Number.isFinite(w[1]) && w[1] > w[0]; });

    // 1) keep pit entries out of closed windows. A run of consecutive pits [p..q] is shifted together by d:
    //    the stint before pit p absorbs +d, the stint after pit q absorbs -d, stints in between keep their length.
    const stintsArr = timeline.filter(function(x) { return x.type === 'stint'; });
    const pitsArr = timeline.filter(function(x) { return x.type === 'pit'; });
    const inWin = function(t) { return wins.some(function(w) { return t >= w[0] && t <= w[1]; }); };
    const entriesNow = function() {
        let t = 0; const e = [];
        timeline.forEach(function(it) { if (it.type === 'pit') e.push(t); t += it.duration; });
        return e;
    };
    const stuck = {};
    for (let pass = 0; pass < 24 && wins.length; pass++) {
        const e = entriesNow();
        let k = -1;
        for (let i = 0; i < e.length; i++) if (inWin(e[i]) && !stuck[i]) { k = i; break; }
        if (k < 0) break;
        const w = wins.filter(function(x) { return e[k] >= x[0] && e[k] <= x[1]; })[0];
        let best = null;
        [(w[0] - 30000) - e[k], (w[1] + 5000) - e[k]].forEach(function(d) {
            for (let span = 0; span < pitsArr.length; span++) {
                for (let p = Math.max(0, k - span); p <= k; p++) {
                    const q = p + span;
                    if (q < k || q >= pitsArr.length) continue;
                    if (!okLen(stintsArr[p].duration + d) || !okLen(stintsArr[q + 1].duration - d)) continue;
                    let clear = true;
                    for (let j = p; j <= q; j++) if (inWin(e[j] + d)) clear = false;
                    if (!clear) continue;
                    const cost = Math.abs(d) + span * 1000;
                    if (!best || cost < best.cost) best = { d: d, p: p, q: q, cost: cost };
                }
            }
        });
        if (!best) { stuck[k] = true; continue; }
        stintsArr[best.p].duration += best.d;
        stintsArr[best.q + 1].duration -= best.d;
    }
    (function() { const e = entriesNow(); pitsArr.forEach(function(p, i) { p.raceTimeAtEntry = e[i]; }); })();

    // 2) every driver drives at least N stints
    const need = Number(rules.minStintsPerDriver) || 0;
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
            msgs.push({ ok: c >= need, text: d.name + ': ' + c + '/' + need + ' stints' });
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
            msgs.push({ ok: c <= cap, text: d.name + ': ' + c + ' stints (max ' + cap + ')' });
        });
    }

    // 3) report each closed window
    wins.forEach(function(w) {
        let t = 0, bad = 0;
        timeline.forEach(function(item) {
            if (item.type === 'pit' && t >= w[0] && t <= w[1]) bad++;
            t += item.duration;
        });
        msgs.push({ ok: bad === 0, text: window.tt('Pit closed') + ' ' + w[0] / 60000 + '–' + w[1] / 60000 + ' min: ' + (bad ? bad + ' ' + window.tt('pit(s) inside the window') : window.tt('clear')) });
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

window.renderRuleNotes = function() {
    const anchor = document.getElementById('maxConsecutiveRow');
    const body = anchor && anchor.closest('.collapse-body');
    if (!body) return;
    let card = document.getElementById('raceRuleNotesCard');
    if (!card) {
        card = document.createElement('div');
        card.id = 'raceRuleNotesCard';
        card.className = 'rule rule-custom';
        card.setAttribute('data-rule', '');
        const intro = body.querySelector('p');
        body.insertBefore(card, intro ? intro.nextSibling : body.firstChild);
    }
    const r = window.raceRules;
    const esc = window._escHtml;
    card.innerHTML =
        '<div class="rule-head" style="cursor:default"><span class="rule-title">' + window.tt('Custom race rules') + '</span><span class="rule-note" style="color:#c4b5fd">' + window.tt('applied to the strategy') + '</span></div>'
        + '<div class="set-sublabel" style="margin-top:4px">' + window.tt('Pit lane closed windows (minutes from race start)') + '</div>'
        + '<div class="rule-windows">'
        + r.closedWindows.map(function(w, i) {
            return '<div class="rule-window"><input type="number" min="0" value="' + Number(w[0]) + '" class="input-field" data-win="' + i + '" data-pos="0" aria-label="' + window.tt('From') + '">'
                + '<i class="fas fa-long-arrow-alt-right" aria-hidden="true"></i><input type="number" min="0" value="' + Number(w[1]) + '" class="input-field" data-win="' + i + '" data-pos="1" aria-label="' + window.tt('To') + '">'
                + '<button type="button" class="rule-window-del" data-win-del="' + i + '" aria-label="' + window.tt('Remove window') + '"><i class="fas fa-trash-alt"></i></button></div>';
        }).join('')
        + '</div><button type="button" id="ruleAddWindow" class="rule-add"><i class="fas fa-plus"></i> ' + window.tt('Add closed window') + '</button>'
        + '<div class="set-grid-2">'
        + '<div><label class="set-sublabel" for="ruleMinStints">' + window.tt('Min stints per driver') + '</label><input type="number" min="0" id="ruleMinStints" class="input-field" value="' + r.minStintsPerDriver + '"></div>'
        + '<div><label class="set-sublabel" for="ruleMaxStints">' + window.tt('Max stints per driver') + '</label><input type="number" min="0" id="ruleMaxStints" class="input-field" value="' + r.maxStintsPerDriver + '"></div>'
        + '</div>'
        + (r.notes.length
            ? '<div class="rule-body"><div class="rule-head" style="min-height:0;cursor:default"><span class="rule-title" style="font-size:13px">' + window.tt('Other rules') + ' <span class="rule-note" style="color:#94a3b8">' + window.tt('checklist, not calculated') + '</span></span>'
                + '<button type="button" id="ruleClearNotes" class="rule-add" style="margin:0">' + window.tt('Clear') + '</button></div><ul class="rule-notes">'
                + r.notes.map(function(n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div>'
            : '')
        + '<div id="ruleStatus" class="rule-status"></div>';

    const changed = function() { window.saveRaceRules(); if (typeof window.runSim === 'function') window.runSim(); };
    card.querySelectorAll('input[data-win]').forEach(function(inp) {
        inp.addEventListener('change', function() {
            r.closedWindows[Number(inp.dataset.win)][Number(inp.dataset.pos)] = Number(inp.value) || 0;
            changed();
        });
    });
    card.querySelectorAll('[data-win-del]').forEach(function(btn) {
        btn.addEventListener('click', function() { r.closedWindows.splice(Number(btn.dataset.winDel), 1); window.saveRaceRules(); window.renderRuleNotes(); window.runSim && window.runSim(); });
    });
    card.querySelector('#ruleAddWindow').addEventListener('click', function() {
        r.closedWindows.push([0, 0]); window.saveRaceRules(); window.renderRuleNotes();
    });
    card.querySelector('#ruleMinStints').addEventListener('change', function(e) { r.minStintsPerDriver = Math.max(0, parseInt(e.target.value) || 0); changed(); });
    card.querySelector('#ruleMaxStints').addEventListener('change', function(e) { r.maxStintsPerDriver = Math.max(0, parseInt(e.target.value) || 0); changed(); });
    const clr = card.querySelector('#ruleClearNotes');
    if (clr) clr.addEventListener('click', function() { r.notes = []; window.saveRaceRules(); window.renderRuleNotes(); });
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
    const reasons = (parsed.reasons && typeof parsed.reasons === 'object') ? parsed.reasons : {};
    const minStints = Number(parsed.minStintsPerDriver) > 0 ? Math.floor(Number(parsed.minStintsPerDriver)) : 0;
    const maxStints = Number(parsed.maxStintsPerDriver) > 0 ? Math.floor(Number(parsed.maxStintsPerDriver)) : 0;
    const notes = Array.isArray(parsed.notes) ? parsed.notes.map(String).filter(Boolean).slice(0, 20) : [];
    if (!settings.length && !wins.length && !minStints && !maxStints && !notes.length) return;

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
            if (el) el.value = cb.dataset.ruleVal;
        });
        if (wins.length && ov.querySelector('input[data-rule-wins]:checked')) r.closedWindows = wins;
        const ms = ov.querySelector('input[data-rule-minstints]:checked');
        if (ms) r.minStintsPerDriver = minStints;
        if (ov.querySelector('input[data-rule-maxstints]:checked')) r.maxStintsPerDriver = maxStints;
        if (notes.length) r.notes = notes;
        window.saveRaceRules();
        ['kartChangeInterval', 'numTeams'].forEach(function(id) {
            const el = document.getElementById(id);
            const sec = document.getElementById('extraPitSection');
            if (el && sec && Number(el.value) > 0) sec.classList.remove('hidden');
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
