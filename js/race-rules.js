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
        msgs.push({ ok: bad === 0, text: 'Pit closed ' + w[0] / 60000 + '–' + w[1] / 60000 + ' min: ' + (bad ? bad + ' pit(s) inside the window' : 'clear') });
    });

    window._ruleMessages = msgs;
    if (typeof window.recalculateTimelineTimes === 'function') window.recalculateTimelineTimes();
    return msgs;
};

window._ruleMessagesHtml = function() {
    const msgs = window._ruleMessages || [];
    if (!msgs.length) return '';
    return msgs.map(function(m) { return (m.ok ? '✅ ' : '❌ ') + window._escHtml(m.text); }).join('<br>');
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
        card.className = 'mb-3 bg-navy-950/60 border border-purple-500/30 rounded-lg p-3 space-y-3';
        const intro = body.querySelector('p');
        body.insertBefore(card, intro ? intro.nextSibling : body.firstChild);
    }
    const r = window.raceRules;
    const esc = window._escHtml;
    card.innerHTML =
        '<div class="text-xs font-bold text-purple-300">📋 Custom race rules <span class="text-gray-500 font-normal">— applied to the strategy</span></div>'
        + '<div><div class="text-[11px] text-gray-400 font-bold mb-1">Pit lane closed windows (minutes from race start)</div><div class="space-y-1">'
        + r.closedWindows.map(function(w, i) {
            return '<div class="flex items-center gap-2"><input type="number" min="0" value="' + Number(w[0]) + '" class="input-field w-24" data-win="' + i + '" data-pos="0" aria-label="From">'
                + '<span class="text-gray-500">→</span><input type="number" min="0" value="' + Number(w[1]) + '" class="input-field w-24" data-win="' + i + '" data-pos="1" aria-label="To">'
                + '<span class="text-[11px] text-gray-500">min</span><button type="button" class="ml-auto text-gray-500 hover:text-red-400 px-2" data-win-del="' + i + '" aria-label="Remove window">✕</button></div>';
        }).join('')
        + '</div><button type="button" id="ruleAddWindow" class="mt-1 text-[11px] text-purple-300 hover:text-white font-bold">+ Add closed window</button></div>'
        + '<div class="flex items-center gap-3"><label class="text-[11px] text-gray-400 font-bold flex-1">Min stints per driver</label>'
        + '<input type="number" min="0" id="ruleMinStints" class="input-field w-24" value="' + r.minStintsPerDriver + '"></div>'
        + (r.notes.length
            ? '<div><div class="flex items-center justify-between mb-1"><span class="text-[11px] text-gray-400 font-bold">Other rules (checklist, not calculated)</span>'
                + '<button type="button" id="ruleClearNotes" class="text-[11px] text-gray-500 hover:text-red-400">Clear</button></div><ul class="space-y-1">'
                + r.notes.map(function(n) { return '<li class="text-xs text-gray-300 flex gap-2"><span class="text-purple-400">•</span><span>' + esc(n) + '</span></li>'; }).join('') + '</ul></div>'
            : '')
        + '<div class="flex items-center gap-3"><label class="text-[11px] text-gray-400 font-bold flex-1">Max stints per driver</label>'
        + '<input type="number" min="0" id="ruleMaxStints" class="input-field w-24" value="' + r.maxStintsPerDriver + '"></div>'
        + '<div id="ruleStatus" class="text-[11px] space-y-0.5"></div>';

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
        return window._RULE_FIELDS[kv[0]] && kv[1] !== null && kv[1] !== '' && Number.isFinite(Number(kv[1])) && document.getElementById(kv[0]);
    });
    const wins = (Array.isArray(parsed.closedWindows) ? parsed.closedWindows : [])
        .filter(function(w) { return Array.isArray(w) && Number.isFinite(Number(w[0])) && Number.isFinite(Number(w[1])) && Number(w[1]) > Number(w[0]); })
        .map(function(w) { return [Number(w[0]), Number(w[1])]; }).slice(0, 12);
    const minStints = Number(parsed.minStintsPerDriver) > 0 ? Math.floor(Number(parsed.minStintsPerDriver)) : 0;
    const maxStints = Number(parsed.maxStintsPerDriver) > 0 ? Math.floor(Number(parsed.maxStintsPerDriver)) : 0;
    const notes = Array.isArray(parsed.notes) ? parsed.notes.map(String).filter(Boolean).slice(0, 20) : [];
    if (!settings.length && !wins.length && !minStints && !maxStints && !notes.length) return;

    const old = document.getElementById('rulesProposalModal');
    if (old) old.remove();
    const esc = window._escHtml;
    const row = function(attrs, label, from, to) {
        return '<label class="flex items-center gap-3 bg-navy-800 border border-gray-700 rounded-lg px-3 py-2 cursor-pointer">'
            + '<input type="checkbox" checked ' + attrs + ' class="accent-ice w-4 h-4"><span class="flex-1 text-sm text-gray-200">' + label + '</span>'
            + '<span class="text-xs text-gray-500">' + esc(from) + ' →</span><span class="text-sm font-bold text-neon">' + esc(to) + '</span></label>';
    };
    const ov = document.createElement('div');
    ov.id = 'rulesProposalModal';
    ov.className = 'fixed inset-0 bg-black/85 flex items-center justify-center p-4';
    ov.style.zIndex = 210;
    ov.innerHTML = '<div class="bg-navy-900 border border-purple-500/40 rounded-2xl shadow-2xl max-w-lg w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto">'
        + '<div class="text-base font-black text-white">Rules found in the regulations</div>'
        + '<div class="text-[11px] text-gray-500">Untick anything that is wrong. Applied rules change the strategy.</div>'
        + '<div class="space-y-1">'
        + settings.map(function(kv) { return row('data-rule-key="' + kv[0] + '" data-rule-val="' + Number(kv[1]) + '"', window._RULE_FIELDS[kv[0]], document.getElementById(kv[0]).value || '—', Number(kv[1])); }).join('')
        + wins.map(function(w, i) { return row('data-rule-win="' + i + '"', 'Pit lane closed (min from start)', '—', w[0] + '–' + w[1]); }).join('')
        + (minStints ? row('data-rule-minstints="' + minStints + '"', 'Min stints per driver', window.raceRules.minStintsPerDriver || '—', minStints) : '')
        + (maxStints ? row('data-rule-maxstints="' + maxStints + '"', 'Max stints per driver', window.raceRules.maxStintsPerDriver || '—', maxStints) : '')
        + '</div>'
        + (notes.length ? '<div><div class="text-xs font-bold text-purple-300 mb-1">Also noted (kept as a checklist)</div><ul class="space-y-1">'
            + notes.map(function(n) { return '<li class="text-xs text-gray-300">• ' + esc(n) + '</li>'; }).join('') + '</ul></div>' : '')
        + '<div class="flex gap-2 pt-1"><button type="button" id="rulesProposalNo" class="flex-1 bg-navy-800 border border-gray-600 text-gray-300 font-bold py-2 rounded-lg text-sm">Dismiss</button>'
        + '<button type="button" id="rulesProposalYes" class="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 rounded-lg text-sm">Apply to setup</button></div></div>';
    document.body.appendChild(ov);
    ov.querySelector('#rulesProposalNo').onclick = function() { ov.remove(); };
    ov.querySelector('#rulesProposalYes').onclick = function() {
        const r = window.raceRules;
        ov.querySelectorAll('input[data-rule-key]:checked').forEach(function(cb) {
            const el = document.getElementById(cb.dataset.ruleKey);
            if (el) el.value = cb.dataset.ruleVal;
        });
        const winsOn = Array.from(ov.querySelectorAll('input[data-rule-win]:checked')).map(function(cb) { return wins[Number(cb.dataset.ruleWin)]; });
        if (winsOn.length) r.closedWindows = winsOn;
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
