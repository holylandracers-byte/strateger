// Saving strategies: works offline first.
//   - 15 seconds after the last change the plan is saved privately on this device (localStorage).
//   - "Save" in the preview keeps a copy on this device and also sends it to the cloud when there is
//     a connection; without one it is queued and sent as soon as the device is back online.
//   - The library lists the cloud copies plus anything that only exists on this device.

(function() {
    const KEY = 'strateger_strategies';
    const PENDING = 'strateger_pending_cloud';
    const IDLE_MS = 15000;
    const MAX_AUTOSAVES = 3;
    const tr = function(k, fb) { const v = window.t ? window.t(k) : null; return (v && v !== k) ? v : fb; };
    const esc = function(x) { return window._escHtml ? window._escHtml(x) : String(x); };

    const read = function(key) { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
    const write = function(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; } };

    window._localStrategies = function() { return read(KEY); };

    function snapshot(name, isPublic) {
        if (!window.cachedStrategy || !window.previewData || !window.previewData.timeline) return null;
        return {
            name: name,
            isPublic: !!isPublic,
            config: window.config,
            drivers: window.drivers,
            timeline: window.previewData.timeline,
            driverSchedule: window.previewData.driverSchedule,
            userId: window.myId || 'anonymous',
            deviceId: sessionStorage.getItem('strateger_host_id')
        };
    }

    // what makes two plans "the same" for autosave purposes
    function signature(p) {
        return JSON.stringify([p.config && [p.config.duration, p.config.raceTarget, p.config.raceLaps, p.config.avgLapSec, p.config.reqStops, p.config.minStint, p.config.maxStint, p.config.pitTime],
            (p.drivers || []).map(function(d) { return d.name; }),
            (p.timeline || []).map(function(x) { return [x.type, x.driverIdx, x.duration]; })]);
    }

    function setStatus(text, kind) {
        const el = document.getElementById('saveStatus');
        if (!el) return;
        el.textContent = text;
        el.className = 'save-status' + (kind ? ' is-' + kind : '');
        el.classList.toggle('hidden', !text);
    }
    window._setSaveStatus = setStatus;

    // ----- local saves -----

    window.saveStrategyLocal = function(opts) {
        const p = snapshot(opts.name, opts.isPublic);
        if (!p) return null;
        const list = read(KEY);
        const entry = {
            id: opts.auto ? 'auto-' + Date.now() : 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
            name: opts.name,
            auto: !!opts.auto,
            synced: false,
            type: opts.isPublic ? 'public' : 'private',
            timestamp: new Date().toISOString(),
            config: p.config, drivers: p.drivers, timeline: p.timeline, driverSchedule: p.driverSchedule,
            sig: signature(p)
        };
        if (opts.auto) {
            const last = list.filter(function(s) { return s.auto; }).sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); })[0];
            if (last && last.sig === entry.sig) return last;          // nothing changed since the last autosave
            // keep only the newest few autosaves
            const autos = list.filter(function(s) { return s.auto; }).sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
            autos.slice(MAX_AUTOSAVES - 1).forEach(function(old) { list.splice(list.indexOf(old), 1); });
        }
        list.push(entry);
        if (!write(KEY, list)) return null;
        return entry;
    };

    let dirty = false, timer = null;
    window._markStrategyDirty = function() {
        if (!window.cachedStrategy) return;
        dirty = true;
        clearTimeout(timer);
        setStatus(tr('autosavePending', 'Unsaved changes…'), 'pending');
        timer = setTimeout(window._autosaveNow, IDLE_MS);
    };

    window._autosaveNow = function() {
        clearTimeout(timer);
        if (!dirty) return;
        if (window.state && window.state.isRunning) { dirty = false; return; }   // a live race has its own state saving
        const label = tr('autoSavedName', 'Auto-saved') + ' · ' + new Date().toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const saved = window.saveStrategyLocal({ name: label, auto: true });
        dirty = false;
        setStatus(saved ? tr('savedOnDevice', 'Saved on this device') + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : tr('autosaveFailed', 'Could not save on this device'), saved ? 'ok' : 'bad');
    };

    // activity anywhere in setup or the preview keeps pushing the 15 s timer back
    ['input', 'change', 'click'].forEach(function(ev) {
        document.addEventListener(ev, function(e) {
            if (!e.target || !e.target.closest) return;
            if (e.target.closest('#saveStrategyModal, #strategyModal, #confirmModal')) return;
            if (e.target.closest('#setupScreen, #previewScreen')) window._markStrategyDirty();
        }, true);
    });
    window.addEventListener('pagehide', function() { if (dirty) window._autosaveNow(); });
    document.addEventListener('visibilitychange', function() { if (document.hidden && dirty) window._autosaveNow(); });

    // ----- cloud -----

    function postCloud(payload) {
        const ctl = typeof AbortController === 'function' ? new AbortController() : null;
        const to = setTimeout(function() { if (ctl) ctl.abort(); }, 12000);
        return fetch(window.APP_CONFIG.API_BASE + '/.netlify/functions/save-strategy', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: ctl ? ctl.signal : undefined
        }).then(function(r) { return r.json(); }).then(function(res) {
            if (!res.success) throw new Error(res.error || 'Server error');
            return res;
        }).finally(function() { clearTimeout(to); });
    }

    window.syncPendingStrategies = async function() {
        if (navigator.onLine === false) return;
        const ids = read(PENDING);
        if (!ids.length) return;
        const list = read(KEY);
        const left = [];
        let sent = 0;
        for (const id of ids) {
            const s = list.find(function(x) { return x.id === id; });
            if (!s) continue;
            try {
                await postCloud({ name: s.name, isPublic: s.type === 'public', config: s.config, drivers: s.drivers, timeline: s.timeline, driverSchedule: s.driverSchedule, userId: window.myId || 'anonymous', deviceId: sessionStorage.getItem('strateger_host_id') });
                s.synced = true; sent++;
            } catch (e) { left.push(id); }
        }
        write(KEY, list); write(PENDING, left);
        if (sent && window.showToast) window.showToast('☁️ ' + sent + ' ' + tr('savedStrategiesSynced', 'saved strategies synced to the cloud'), 'success');
    };
    window.addEventListener('online', function() { window.syncPendingStrategies(); });
    window.addEventListener('load', function() { setTimeout(window.syncPendingStrategies, 4000); });

    // Save button: device copy first, cloud copy when a connection exists.
    window.performStrategySave = async function() {
        const name = document.getElementById('saveStrategyName').value || 'Untitled';
        const isPublic = (document.querySelector('input[name="strategyVisibility"]:checked')?.value || 'private') === 'public';
        if (!window.cachedStrategy) return window.showToast(window.tt('No strategy generated yet!'), 'warning');

        const btn = document.getElementById('saveStrategyConfirmBtn');
        const original = btn ? btn.innerHTML : '';
        if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; btn.disabled = true; }
        try {
            const entry = window.saveStrategyLocal({ name: name, isPublic: isPublic });
            if (!entry) throw new Error(tr('autosaveFailed', 'Could not save on this device'));
            dirty = false; clearTimeout(timer);
            let cloud = false;
            if (navigator.onLine !== false) {
                try {
                    await postCloud(snapshot(name, isPublic));
                    const list = read(KEY);
                    const mine = list.find(function(x) { return x.id === entry.id; });
                    if (mine) { mine.synced = true; write(KEY, list); }
                    cloud = true;
                } catch (e) { console.warn('Cloud save failed, kept on device:', e); }
            }
            if (!cloud) { const q = read(PENDING); q.push(entry.id); write(PENDING, q); }
            window.closeSaveStrategyModal();
            setStatus(cloud ? '☁️ ' + tr('savedToCloud', 'Saved to cloud') : tr('savedOnDevice', 'Saved on this device'), 'ok');
            window.showToast(cloud ? '☁️ ' + tr('savedToCloud', 'Saved to cloud') + ' · ' + tr('andOnDevice', 'and on this device')
                : '💾 ' + tr('savedOnDevice', 'Saved on this device') + ' — ' + tr('willSyncLater', 'it will sync when you are back online'), cloud ? 'success' : 'info', 5000);
        } catch (e) {
            window.showToast(tr('saveFailed', 'Save failed') + ': ' + e.message, 'error');
        } finally {
            if (btn) { btn.innerHTML = original; btn.disabled = false; }
        }
    };

    // ----- library -----

    window.loadStrategyLibrary = async function() {
        const modal = document.getElementById('strategyModal');
        const list = document.getElementById('strategyList');
        if (modal) modal.classList.remove('hidden');
        const local = read(KEY).map(function(s) { s._local = true; return s; });
        // Show what is on this device straight away; the cloud list is added when it arrives.
        window.currentStrategies = local.slice();
        window.renderStrategyList(window.currentStrategies, navigator.onLine !== false ? tr('xLoading', 'Loading…') : tr('offlineBanner', 'Offline — showing strategies saved on this device'));

        if (navigator.onLine === false) return;
        try {
            const deviceId = sessionStorage.getItem('strateger_host_id') || '';
            const response = await fetch(window.APP_CONFIG.API_BASE + '/.netlify/functions/get-strategies?deviceId=' + deviceId);
            const result = await response.json();
            if (!result.success || !Array.isArray(result.strategies)) throw new Error(result.error || 'Unknown error');
            const cloud = result.strategies.map(function(s) {
                return {
                    name: s.name,
                    config: s.config || { duration: (s.race_duration_ms || 0) / 3600000, reqStops: s.required_stops || 0 },
                    drivers: s.drivers || [], timeline: s.timeline || [], driverSchedule: s.driver_schedule || [],
                    timestamp: s.created_at || new Date().toISOString(), type: s.is_public ? 'public' : 'private', id: 'cloud-' + s.id, synced: true
                };
            });
            // a device copy that already reached the cloud would show twice: the cloud one wins
            const only = local.filter(function(s) { return !s.synced; });
            window.currentStrategies = cloud.concat(only);
            window.renderStrategyList(window.currentStrategies);
        } catch (e) {
            console.warn('Cloud list unavailable, showing device copies:', e);
            window.renderStrategyList(local, tr('offlineBanner', 'Offline — showing strategies saved on this device'));
        }
    };

    window.renderStrategyList = function(strategies, banner) {
        const list = document.getElementById('strategyList');
        if (!list) return;
        const head = banner ? '<div class="text-center text-yellow-500 p-2 text-xs">' + esc(banner) + '</div>' : '';
        if (!strategies.length) {
            list.innerHTML = head + '<div class="text-center py-8 opacity-50"><div class="text-4xl mb-2">📂</div><div class="text-sm">' + window.tt('No saved strategies found.') + '</div></div>';
            return;
        }
        strategies.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
        window.currentStrategies = strategies;
        list.innerHTML = head + strategies.map(function(s, index) {
            const c = s.config || {};
            const size = c.raceTarget === 'laps' ? (c.raceLaps || 0) + ' ' + tr('laps', 'laps') : (Math.round((c.duration || 0) * 100) / 100) + 'h';
            const badge = s.auto ? '<span class="text-[11px] bg-slate-700 text-slate-300 px-1 rounded">AUTO</span>'
                : (s.type === 'public' ? '<span class="text-[11px] bg-green-900 text-green-300 px-1 rounded">PUB</span>' : '');
            const where = s.synced ? '<i class="fas fa-cloud text-ice" title="Cloud"></i>' : '<i class="fas fa-mobile-alt text-gray-500" title="' + esc(tr('savedOnDevice', 'Saved on this device')) + '"></i>';
            return '<div class="bg-navy-800 p-3 rounded border border-gray-700 flex justify-between items-center mb-2 hover:border-ice transition group">'
                + '<div class="flex-1 cursor-pointer min-w-0" onclick="window.applyStrategy(' + index + ')">'
                + '<div class="font-bold text-white text-sm flex items-center gap-2 flex-wrap">' + where + ' ' + esc(s.name) + ' ' + badge + '</div>'
                + '<div class="text-[11px] text-gray-400 mt-1">📅 ' + new Date(s.timestamp).toLocaleString() + ' | ⏱️ ' + size + ' | 🛑 ' + (c.reqStops || 0) + ' ' + tr('stopsLabel', 'stops') + '</div></div>'
                + '<div class="flex gap-2"><button onclick="window.applyStrategy(' + index + ')" class="bg-ice/20 text-ice px-3 py-1.5 rounded text-xs font-bold hover:bg-ice/40 transition">' + window.tt('Load') + '</button>'
                + (s._local ? '<button onclick="window.deleteStrategy(' + index + ')" class="text-gray-600 hover:text-red-400 text-xs px-2 transition" aria-label="Delete"><i class="fas fa-trash"></i></button>' : '')
                + '</div></div>';
        }).join('');
    };

    window.deleteStrategy = function(index) {
        const s = (window.currentStrategies || [])[index];
        if (!s || !s._local) return;
        window.showConfirmModal('🗑️ Delete Strategy', s.name, tr('deletePermanently', 'Delete permanently?'), function() {
            write(KEY, read(KEY).filter(function(x) { return x.id !== s.id; }));
            write(PENDING, read(PENDING).filter(function(id) { return id !== s.id; }));
            window.loadStrategyLibrary();
        });
    };
})();
