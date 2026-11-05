// ==========================================
// 🤝 DELEGATE (co-admin): a device between "viewer" (read only) and "driver" (pit taps)
// ==========================================
// The host stays the single source of truth. A delegate device mirrors the live race like
// a viewer, but the controls the host granted are wired to send commands back; the host
// checks the invite's permissions and runs the real action. Invites are unlimited, each
// carries its own permission set, can be edited live and revoked at any time.

window.DELEGATE_PERMS = {
    pit:    { icon: 'fa-flag-checkered', label: 'Pit stops',        hint: 'Enter / exit pit, force pit out', cmds: ['confirmPitEntry', 'confirmPitExit', 'forcePitOut', 'cancelPitStop'] },
    pitAdj: { icon: 'fa-stopwatch',      label: 'Pit time adjust',  hint: '± seconds on the pit stop',       cmds: ['adjustPitTime'] },
    driver: { icon: 'fa-user-astronaut', label: 'Next driver',      hint: 'Change who drives next',          cmds: ['cycleNextDriver'] },
    mode:   { icon: 'fa-gauge-high',     label: 'Pace & squads',    hint: 'Push / problem, night, squad',    cmds: ['setMode', 'toggleNightMode', 'switchNightSquad'] },
    plan:   { icon: 'fa-list-check',     label: 'Edit the plan',    hint: 'Stint minutes, driver order, add or remove a stint (rules are checked)', cmds: ['coSetStintMin', 'coMoveStint', 'coAddStint', 'coRemoveStint'] },
    finish: { icon: 'fa-flag',           label: 'Confirm finish',   hint: 'Confirm the race finish',         cmds: ['confirmRaceFinish'] },
    chat:   { icon: 'fa-comments',       label: 'Chat as admin',    hint: 'Message all viewers',             cmds: [] },
    takeover: { icon: 'fa-crown',        label: 'Take over if host is lost', hint: 'Become the host if the main device dies', cmds: [] }
};
window.DELEGATE_PRESETS = {
    full:       { label: 'Full admin',   perms: ['pit', 'pitAdj', 'driver', 'mode', 'plan', 'finish', 'chat', 'takeover'] },
    pit:        { label: 'Pit crew',     perms: ['pit', 'pitAdj', 'driver'] },
    strategist: { label: 'Strategist',   perms: ['mode', 'driver', 'pitAdj', 'plan', 'chat'] },
    watch:      { label: 'Watch + chat', perms: ['chat'] }
};
// Elements each permission re-enables on the delegate's screen (enforceViewerMode hides them for viewers)
window.DELEGATE_SELECTORS = {
    pit:    '#pitEntryBtn, #forcePitOutBtn',
    pitAdj: '.penalty-btn, .pit-adj-btn, #penaltyBtnMinus5, #penaltyBtnPlus5',
    mode:   '#btnPush, #btnBad, #btnResetMode, #btnNightMode, #btnSwitchSquad',
    finish: '#confirmRaceFinishBtn'
};
// Every permission that puts a control in the delegate's hands (chat and takeover alone do not make a screen "hands-on")
window.DELEGATE_HANDS_ON = ['pit', 'pitAdj', 'driver', 'mode', 'plan', 'finish'];

const _dlgEsc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- HOST SIDE
window.delegateInvites = (function () {
    try { return JSON.parse(localStorage.getItem('strateger_delegates') || '[]'); } catch (e) { return []; }
})();
window._saveDelegates = function () {
    try { localStorage.setItem('strateger_delegates', JSON.stringify(window.delegateInvites)); } catch (e) {}
};

window._delegateToken = function () {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 18);
};

window._delegateConns = function (inv) {
    return (window.connections || []).filter(c => c._co && c._co.id === inv.id && c.open);
};

window.createDelegateInvite = function () {
    const labelEl = document.getElementById('dlgLabel');
    const label = (labelEl && labelEl.value.trim()) || window.tt('Co-admin') + ' ' + (window.delegateInvites.length + 1);
    const perms = {};
    document.querySelectorAll('#dlgNewPerms input[data-perm]').forEach(i => { perms[i.dataset.perm] = i.checked; });
    if (!Object.values(perms).some(Boolean)) {
        window.showToast(window.tt('Pick at least one permission'), 'warning');
        return;
    }
    window.delegateInvites.push({ id: 'd' + Date.now().toString(36), token: window._delegateToken(), label, perms, created: Date.now() });
    window._saveDelegates();
    if (labelEl) labelEl.value = '';
    window.renderDelegateModal();
};

window.applyDelegatePreset = function (key) {
    const p = window.DELEGATE_PRESETS[key];
    if (!p) return;
    document.querySelectorAll('#dlgNewPerms input[data-perm]').forEach(i => { i.checked = p.perms.includes(i.dataset.perm); });
};

window.toggleDelegatePerm = function (id, perm, on) {
    const inv = window.delegateInvites.find(i => i.id === id);
    if (!inv) return;
    inv.perms[perm] = !!on;
    window._saveDelegates();
    if (perm === 'takeover' && on) window._delegateConns(inv).forEach(window._coSendSync);
    window._delegateConns(inv).forEach(c => { try { c.send({ type: 'COADMIN_PERMS', perms: inv.perms }); } catch (e) {} });
};

// Everything a delegate needs to carry on if the host device dies: the parts of the race the live UPDATE
// stream does not include (full strategy, preview timeline), the invite list (so the other delegates can
// re-join the new host) and who was already approved (so viewers are let straight back in).
window._coSyncPayload = function () {
    return {
        type: 'COADMIN_SYNC',
        hostId: window.myId,
        strategy: window.cachedStrategy || null,
        previewData: window.previewData || null,
        invites: window.delegateInvites,
        approved: Array.from(window.approvedViewers.keys()).map(pid => [pid, window.reservedViewerNames.get(pid) || null]),
        timestamp: Date.now()
    };
};
window._coSendSync = function (c) {
    if (!c || !c.open || !c._co) return;
    const inv = window.delegateInvites.find(i => i.id === c._co.id);
    if (!inv || !inv.perms.takeover) return;
    try { c.send(window._coSyncPayload()); } catch (e) { console.warn('Delegate sync failed', e); }
};
setInterval(function () {
    if (window.role !== 'host' || !window.delegateInvites.length || !window.state || !window.state.isRunning) return;
    (window.connections || []).forEach(window._coSendSync);
}, 20000);

window.revokeDelegate = function (id) {
    const inv = window.delegateInvites.find(i => i.id === id);
    if (!inv) return;
    if (!confirm(window.tt('Revoke this delegate? Their link stops working immediately.'))) return;
    window._delegateConns(inv).forEach(c => {
        try { c.send({ type: 'VIEWER_REMOVED', message: window.tt('Your delegate access was revoked') }); } catch (e) {}
        window.approvedViewers.delete(c.peer);
        setTimeout(() => { try { c.close(); } catch (e) {} }, 400);
    });
    window.delegateInvites = window.delegateInvites.filter(i => i.id !== id);
    window._saveDelegates();
    window.renderDelegateModal();
};

window.delegateLink = function (inv) {
    return `${window.location.origin}${window.location.pathname}?co=${window.myId}&k=${inv.token}`;
};

window.copyDelegateLink = function (id) {
    const inv = window.delegateInvites.find(i => i.id === id);
    if (!inv) return;
    if (!window.myId) return window.showToast(window.tt('No connection ID yet'), 'warning');
    const link = window.delegateLink(inv);
    if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        navigator.share({ title: 'Strateger', text: inv.label, url: link }).catch(() => {});
        return;
    }
    navigator.clipboard.writeText(link)
        .then(() => window.showToast(window.tt('Link copied'), 'success'))
        .catch(() => prompt(window.tt('Copy this link:'), link));
};

window.openDelegateModal = function () {
    document.getElementById('headerOverflowMenu')?.classList.add('hidden');
    document.getElementById('delegateModal')?.classList.remove('hidden');
    const tx = (id, en) => { const el = document.getElementById(id); if (el) el.textContent = window.tt(en); };
    tx('dlgIntro', 'Hand part of the admin job to another phone, tablet or laptop. Pick what it may do; guests stay read-only and drivers keep driver mode. Create as many as you need and change or revoke them any time.');
    tx('dlgCreateTxt', 'Create delegate link');
    const nm = document.getElementById('dlgLabel'); if (nm) nm.placeholder = window.tt('Name (e.g. Pit wall tablet)');
    window.renderDelegateModal();
};
window.closeDelegateModal = function () {
    document.getElementById('delegateModal')?.classList.add('hidden');
};

window.renderDelegateModal = function () {
    const modal = document.getElementById('delegateModal');
    if (!modal || modal.classList.contains('hidden')) return;
    const permRow = (key, checked, extra) => {
        const p = window.DELEGATE_PERMS[key];
        return `<label class="dlg-perm"><input type="checkbox" data-perm="${key}" ${checked ? 'checked' : ''} ${extra || ''}>
            <i class="fas ${p.icon} text-ice w-4 text-center"></i><span>${_dlgEsc(window.tt(p.label))}<small>${_dlgEsc(window.tt(p.hint))}</small></span></label>`;
    };
    const newBox = document.getElementById('dlgNewPerms');
    if (newBox && !newBox.dataset.ready) {
        newBox.innerHTML = Object.keys(window.DELEGATE_PERMS).map(k => permRow(k, window.DELEGATE_PRESETS.pit.perms.includes(k))).join('');
        newBox.dataset.ready = '1';
        const pre = document.getElementById('dlgPresets');
        if (pre) pre.innerHTML = Object.entries(window.DELEGATE_PRESETS).map(([k, p]) =>
            `<button type="button" onclick="window.applyDelegatePreset('${k}')" class="text-[11px] bg-navy-700 border border-gray-600 text-gray-200 px-2 py-1 rounded">${_dlgEsc(window.tt(p.label))}</button>`).join('');
    }
    const list = document.getElementById('dlgList');
    if (!list) return;
    if (!window.delegateInvites.length) {
        list.innerHTML = `<div class="text-xs text-gray-500 text-center py-3">${_dlgEsc(window.tt('No delegates yet'))}</div>`;
        return;
    }
    list.innerHTML = window.delegateInvites.map(inv => {
        const online = window._delegateConns(inv).length;
        return `<div class="bg-navy-800 border border-gray-700 rounded-lg p-2 space-y-2">
            <div class="flex items-center justify-between gap-2">
                <div class="min-w-0"><div class="font-bold text-sm text-white truncate">${_dlgEsc(inv.label)}</div>
                <div class="text-[11px] ${online ? 'text-green-400' : 'text-gray-500'}">${online ? '● ' + online + ' ' + _dlgEsc(window.tt('connected')) : '○ ' + _dlgEsc(window.tt('not connected'))}</div></div>
                <div class="flex gap-1 shrink-0">
                    <button type="button" onclick="window.copyDelegateLink('${inv.id}')" class="text-xs bg-ice text-navy-950 font-bold px-2 py-1 rounded"><i class="fas fa-link"></i> ${_dlgEsc(window.tt('Link'))}</button>
                    <button type="button" onclick="window.revokeDelegate('${inv.id}')" class="text-xs bg-red-700 text-white px-2 py-1 rounded" aria-label="${_dlgEsc(window.tt('Revoke'))}"><i class="fas fa-ban"></i></button>
                </div></div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-1">${Object.keys(window.DELEGATE_PERMS).map(k => {
                const p = window.DELEGATE_PERMS[k];
                return `<label class="dlg-perm"><input type="checkbox" ${inv.perms[k] ? 'checked' : ''} onchange="window.toggleDelegatePerm('${inv.id}','${k}',this.checked)">
                    <i class="fas ${p.icon} text-ice w-4 text-center"></i><span>${_dlgEsc(window.tt(p.label))}</span></label>`;
            }).join('')}</div></div>`;
    }).join('');
};

// Called from the host's data handler. Returns true when the message was consumed.
window.handleDelegateMessage = function (c, data) {
    if (!data || typeof data !== 'object') return false;

    if (data.type === 'COADMIN_JOIN') {
        const inv = window.delegateInvites.find(i => i.token === data.key);
        if (!inv) {
            try { c.send({ type: 'VIEWER_REMOVED', message: window.tt('This delegate link is no longer valid') }); } catch (e) {}
            setTimeout(() => { try { c.close(); } catch (e) {} }, 400);
            return true;
        }
        c._co = inv;
        window.approvedViewers.set(c.peer, true);
        window.pendingViewerApprovals.delete(c.peer);
        c.viewerName = inv.label;
        window.reservedViewerNames.set(c.peer, inv.label);
        window.connectedViewers.set(c.peer, c);
        try { c.send({ type: 'COADMIN_GRANTED', label: inv.label, perms: inv.perms, id: inv.id }); } catch (e) {}
        try {
            c.send({ type: 'UPDATE', state: window.state, config: window.config, drivers: window.drivers, liveData: window.liveData,
                liveTimingConfig: window.liveTimingConfig, searchConfig: window.searchConfig,
                currentPitAdjustment: window.currentPitAdjustment || 0, timestamp: Date.now() });
        } catch (e) {}
        window._coSendSync(c);
        window.updateViewerApprovalUI && window.updateViewerApprovalUI();
        window.renderDelegateModal();
        return true;
    }

    if (!c._co) return false;
    // Revoked or edited since the connection opened: always re-read the live invite
    const inv = window.delegateInvites.find(i => i.id === c._co.id);
    if (!inv) return true;
    c._co = inv;

    if (data.type === 'CO_CMD') {
        const cmd = data.cmd;
        const perm = Object.keys(window.DELEGATE_PERMS).find(k => window.DELEGATE_PERMS[k].cmds.includes(cmd));
        if (!perm || !inv.perms[perm] || typeof window[cmd] !== 'function') {
            try { c.send({ type: 'ERROR', message: window.tt('Not allowed for this delegate') }); } catch (e) {}
            return true;
        }
        const args = Array.isArray(data.args) ? data.args.slice(0, 3).filter(a => ['string', 'number', 'boolean'].includes(typeof a) || a == null) : [];
        let result;
        try { result = window[cmd](...args); } catch (e) { console.error('Delegate command failed', cmd, e); }
        // Plan commands answer with a short English sentence when they refuse; the delegate translates it
        if (typeof result === 'string' && result) { try { c.send({ type: 'CO_NOTICE', text: result, kind: 'error' }); } catch (e) {} }
        // Live timing can hold a manual pit exit; tell the delegate so a second tap can force it, like on the host
        if (cmd === 'confirmPitExit' && !args[0] && window.state && window.state.isInPit) {
            try { c.send({ type: 'CO_BLOCKED', cmd }); } catch (e) {}
        }
        if (typeof window.broadcast === 'function') window.broadcast();
        return true;
    }

    if (data.type === 'CHAT' && inv.perms.chat && typeof data.text === 'string' && data.text.trim()) {
        const msg = { type: 'CHAT', sender: inv.label + ' (co-admin)', text: data.text.slice(0, 500), role: 'host', recipient: null, timestamp: Date.now() };
        window.broadcast(msg);
        window.renderChatMessage(msg);
        return true;
    }
    return false;
};

window.delegateConnClosed = function () { window.renderDelegateModal && window.renderDelegateModal(); };

// ---------------------------------------------------------------- DELEGATE (CLIENT) SIDE
window.coSend = function (cmd, args) {
    if (window.conn && window.conn.open) {
        window.conn.send({ type: 'CO_CMD', cmd, args: args || [] });
    } else {
        window.showToast(window.tt('Not connected to host'), 'error');
    }
};

window.coAllowsEl = function (el) {
    const co = window._coAdmin;
    if (!co || !co.granted) return false;
    return Object.keys(window.DELEGATE_SELECTORS).some(k => co.perms[k] && el.matches(window.DELEGATE_SELECTORS[k]));
};

// The page renders once as a plain viewer before the host's grant arrives, and that pass strips the
// onclick / enables nothing back. Give the granted controls their behaviour back.
window._coRestoreControls = function () {
    const clicks = { btnPush: "window.setMode('push')", btnBad: "window.setMode('bad')", btnResetMode: "window.setMode('normal')" };
    Object.keys(clicks).forEach(id => {
        const el = document.getElementById(id);
        if (!el || !window.coAllowsEl(el)) return;
        el.setAttribute('onclick', clicks[id]);
        el.style.pointerEvents = '';
        el.disabled = false;
        el.classList.remove('opacity-60', 'cursor-not-allowed');
        delete el.dataset.viewerDisabled;
    });
    document.querySelectorAll('#pitEntryBtn, .penalty-btn, .pit-adj-btn').forEach(el => {
        if (window.coAllowsEl(el)) { el.classList.remove('hidden'); el.disabled = false; }
    });
};

window.onCoAdminGranted = function (data) {
    const co = window._coAdmin = Object.assign(window._coAdmin || {}, { granted: true, perms: data.perms || {}, label: data.label, invId: data.id });
    if (!co.perms.takeover) { try { localStorage.removeItem('strateger_takeover_pack'); } catch (e) {} }
    if (co.shownPerms && JSON.stringify(co.shownPerms) !== JSON.stringify(co.perms)) { location.reload(); return; }
    co.shownPerms = Object.assign({}, co.perms);
    window.viewerApprovalStatus = 'approved';
    try { localStorage.setItem('strateger_chat_name', data.label); localStorage.setItem('strateger_viewer_name', data.label); } catch (e) {}
    document.body.classList.add('co-admin-session');
    // Route every granted action to the host
    Object.keys(window.DELEGATE_PERMS).forEach(k => {
        if (!co.perms[k]) return;
        window.DELEGATE_PERMS[k].cmds.forEach(cmd => { window[cmd] = (...a) => window.coSend(cmd, a); });
    });
    // Pit exit: if live timing held the last manual exit (CO_BLOCKED), a second tap within 4s forces it, same as on the host
    if (co.perms.pit) {
        // Pit entry before the minimum stint asks "proceed?". That question has to be answered here, on the
        // delegate's screen: asked on the host it would sit there waiting for someone who is not holding that device.
        window.confirmPitEntry = (autoDetected) => {
            const st = window.state, cfg = window.config || {};
            if (!autoDetected && st && st.isRunning && !st.isInPit) {
                const now = window.getSyncedNow ? window.getSyncedNow() : Date.now();
                const cur = (now - st.stintStart) + (st.stintOffset || 0);
                const minMs = (cfg.minStint || 0) * 60000;
                if (minMs > 0 && cur < minMs && typeof window.showConfirmModal === 'function') {
                    const t = window.t || (k => k);
                    window.showConfirmModal(`⚠️ ${t('shortStintMsg')}`, `${t('missingSeconds') || 'Missing'}: ${Math.ceil((minMs - cur) / 1000)}s`,
                        t('proceedToPit') || 'Proceed to Pit?', () => window.coSend('confirmPitEntry', [true]));
                    return;
                }
            }
            window.coSend('confirmPitEntry', autoDetected ? [true] : []);
        };
        window.confirmPitExit = (autoDetected) => {
            const force = !!autoDetected || (Date.now() - (co.exitBlockedAt || 0) < 4000);
            if (force) co.exitBlockedAt = 0;
            window.coSend('confirmPitExit', force ? [true] : []);
        };
    }
    ['viewerNameScreen', 'clientWaitScreen', 'setupScreen'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('raceDashboard')?.classList.remove('hidden');
    window._coRestoreControls();
    if (typeof window.enforceViewerMode === 'function') window.enforceViewerMode();
    const chatBtn = document.getElementById('chatToggleBtn');
    if (chatBtn) chatBtn.style.display = 'block';
    document.getElementById('chatLoginView')?.classList.add('hidden');
    const mv = document.getElementById('chatMessagesView');
    if (mv) { mv.classList.remove('hidden'); mv.classList.add('flex'); }
    if (!document.getElementById('coBadge')) {
        const b = document.createElement('div');
        b.id = 'coBadge'; b.className = 'co-badge';
        b.textContent = '🤝 ' + data.label;
        document.body.appendChild(b);
    }
    if (typeof window.renderFrame === 'function' && window.state?.isRunning) window.renderFrame();
};

window.onCoAdminPerms = function (data) {
    if (!window._coAdmin) return;
    window._coAdmin.perms = data.perms || {};
    window.showToast(window.tt('Your permissions were updated'), 'info');
    setTimeout(() => location.reload(), 900);
};

// Entry point from main.js when the page is opened with ?co=<hostId>&k=<token>
window.startCoAdminSession = function (hostId, key) {
    window.role = 'client';
    window._coAdmin = { key, granted: false, perms: {} };
    ['setupScreen', 'viewerNameScreen'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('clientWaitScreen')?.classList.remove('hidden');
    if (typeof window.connectToHost === 'function') window.connectToHost(hostId);
};

// A delegate holding any hands-on permission is a driver of the dashboard, not a spectator
window.coHasControls = function () {
    const co = window._coAdmin;
    return !!(co && co.granted && window.DELEGATE_HANDS_ON.some(k => co.perms[k]));
};

// The host held a manual pit exit back (live timing is authoritative): arm the "tap again to force" window
window.onCoBlocked = function () {
    const co = window._coAdmin;
    if (!co) return;
    co.exitBlockedAt = Date.now();
    window.showToast('🔒 ' + window.tt('Pit exit follows live timing. Tap again to force it.'), 'warning', 4000);
};

// The pit screen is opened by the host's own tap, so a mirrored session never sees it. Mirror it for
// delegates who may run the pits: same timer, same exit button, driven by the synced race state.
window._coSyncUi = function () {
    const co = window._coAdmin;
    if (!co || !co.granted || !co.perms.pit || !window.state) return;
    const modal = document.getElementById('pitModal');
    const inPit = !!(window.state.isInPit && window.state.isRunning && !window.state.isFinished);
    if (modal) {
        if (inPit && modal.classList.contains('hidden')) modal.classList.remove('hidden');
        else if (!inPit && !modal.classList.contains('hidden')) modal.classList.add('hidden');
    }
    if (inPit) { try { window.updatePitModalLogic(); } catch (e) {} }
    try { window._syncForcePitOutBtn && window._syncForcePitOutBtn(); } catch (e) {}
};
setInterval(window._coSyncUi, 500);

// ---------------------------------------------------------------- TAKEOVER (host device lost)
// A delegate with the "take over" permission keeps a local copy of everything needed to run the race.
// If the main device dies it can become the host: the copy is written exactly like a crash-recovery save
// and the page reloads as host on the same race link, so viewers, drivers and the other delegates
// reconnect on their own.
const CO_PACK_KEY = 'strateger_takeover_pack';

window._coLoadPack = function () {
    try { return JSON.parse(localStorage.getItem(CO_PACK_KEY) || 'null'); } catch (e) { return null; }
};

window.onCoAdminSync = function (data) {
    const co = window._coAdmin;
    if (!co) return;
    co.sync = data;
    window._coSavePack();
};

window._coSavePack = function () {
    const co = window._coAdmin;
    if (!co || !co.granted || !co.perms.takeover || !window.state || !window.config || !window.drivers) return;
    if (!window.state.isRunning && !window.state.isFinished) return;
    const prev = window._coLoadPack();
    const pack = {
        v: 1,
        savedAt: Date.now(),
        hostId: (window.reconnectState && window.reconnectState.hostId) || (co.sync && co.sync.hostId) || null,
        invId: co.invId || null,
        offset: window._hostTimeOffset || 0,
        snap: {
            config: window.config, state: window.state, drivers: window.drivers,
            liveTimingConfig: window.liveTimingConfig, searchConfig: window.searchConfig, liveData: window.liveData,
            currentPitAdjustment: window.currentPitAdjustment || 0
        },
        sync: co.sync || (prev && prev.sync) || null
    };
    try { localStorage.setItem(CO_PACK_KEY, JSON.stringify(pack)); } catch (e) {}
};
setInterval(window._coSavePack, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) window._coSavePack(); });
window.addEventListener('pagehide', () => window._coSavePack());

// The saved copy that a takeover would use, or null when there is nothing safe to take over
window.coTakeoverAvailable = function () {
    if (!window._coAdmin) return null;
    const pack = window._coLoadPack();
    if (!pack || !pack.snap || !pack.snap.state || !pack.snap.config || !pack.hostId) return null;
    if (Date.now() - pack.savedAt > 12 * 3600000) return null;
    const joined = window.reconnectState && window.reconnectState.hostId;
    if (joined && String(pack.hostId) !== String(joined)) return null;
    if (!pack.snap.state.isRunning || pack.snap.state.isFinished) return null;
    return pack;
};

// Button for the join/"host not found" screens, so a delegate who reloads after the host died can still take over
window.coTakeoverHtml = function () {
    if (!window.coTakeoverAvailable()) return '';
    return '<button onclick="window.coTakeover()" class="mt-3 bg-amber-500 text-black font-bold px-4 py-2 rounded hover:bg-amber-400">👑 ' + _dlgEsc(window.tt('Take over as host')) + '</button>';
};

// Move epoch-millisecond timestamps from the host's clock to this device's clock
function _coShiftClock(v, d) {
    if (!d) return v;
    if (typeof v === 'number') return (v > 1e12 && v < 4e12) ? v - d : v;
    if (Array.isArray(v)) return v.map(x => _coShiftClock(x, d));
    if (v && typeof v === 'object') { Object.keys(v).forEach(k => { v[k] = _coShiftClock(v[k], d); }); }
    return v;
}

window.coTakeover = function () {
    if (window._coAdmin && window._coAdmin.granted) window._coSavePack();   // freshest copy if we are still connected
    const pack = window.coTakeoverAvailable();
    if (!pack) return window.showToast(window.tt('No race data to take over yet'), 'warning');

    const hostFresh = !!(window.conn && window.conn.open && window._lastHostUpdateAt && Date.now() - window._lastHostUpdateAt < 15000);
    const ask = hostFresh
        ? 'The main device is still connected. Take over anyway? Two hosts at the same time will conflict.'
        : 'Take over as host? This device will run the race from the last synced state. Do this only if the main device is really down.';
    if (!confirm(window.tt(ask))) return;

    const sync = pack.sync || {};
    const d = Math.abs(pack.offset || 0) >= 200 ? pack.offset : 0;
    const snap = pack.snap;
    const raceSnapshot = {
        config: snap.config,
        state: _coShiftClock(snap.state, d),
        drivers: _coShiftClock(snap.drivers, d),
        strategy: sync.strategy || null,
        previewData: sync.previewData || null,
        liveTimingConfig: snap.liveTimingConfig,
        searchConfig: snap.searchConfig,
        liveData: snap.liveData,
        currentPitAdjustment: snap.currentPitAdjustment || 0,
        hostId: pack.hostId,
        timestamp: Date.now()
    };
    try {
        localStorage.setItem(window.RACE_STATE_KEY, JSON.stringify(raceSnapshot));
        // The other delegates re-join the new host with the invites they already hold (minus this device's own)
        if (Array.isArray(sync.invites)) localStorage.setItem('strateger_delegates', JSON.stringify(sync.invites.filter(i => i.id !== pack.invId)));
        // Viewers/drivers the old host had approved walk straight back in
        sessionStorage.setItem('strateger_takeover_extras', JSON.stringify({ approved: sync.approved || [] }));
        sessionStorage.setItem('strateger_auto_takeover', '1');
        localStorage.removeItem(CO_PACK_KEY);
        // Mid-race there is no room for the first-run language picker / guided tour
        localStorage.setItem('strateger_onboarded', 'true');
        localStorage.setItem('strateger_lang_explicit', 'true');
    } catch (e) {
        return window.showToast(window.tt('Not enough storage to take over'), 'error');
    }
    window.location.replace(window.location.origin + window.location.pathname);
};

// "Host not responding" bar: only for delegates allowed to take over, only while the race should be running
setInterval(function () {
    const co = window._coAdmin;
    let bar = document.getElementById('coTakeoverBar');
    const age = window._lastHostUpdateAt ? Date.now() - window._lastHostUpdateAt : 0;
    const show = !!(co && co.granted && co.perms.takeover && window.state && window.state.isRunning && !window.state.isFinished && age > 15000);
    if (!show) { if (bar) bar.classList.add('hidden'); return; }
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'coTakeoverBar';
        bar.className = 'co-takeover-bar';
        const txt = document.createElement('span');
        txt.id = 'coTakeoverTxt';
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.addEventListener('click', () => window.coTakeover());
        bar.appendChild(txt); bar.appendChild(btn);
        document.body.appendChild(bar);
    }
    bar.classList.remove('hidden');
    document.getElementById('coTakeoverTxt').textContent = '⚠ ' + window.tt('Host not responding') + ' · ' + Math.round(age / 1000) + 's';
    bar.querySelector('button').textContent = '👑 ' + window.tt('Take over as host');
}, 1000);


// ---------------------------------------------------------------- PLAN EDITING (host side)
// A delegate holding "Edit the plan" sends these; the host runs them on the live plan (state.stintTargets,
// stintSchedule and the preview timeline), the same way the host's own PLAN screen edits it. Stint limits are
// enforced by the same clamp/redistribute code, and a change that would break a rule is refused with a sentence.

// What the delegate's read-only plan needs: stints and pits in order, with the real driver for finished stints
window._planForClients = function () {
    const tl = window.previewData && window.previewData.timeline;
    if (!Array.isArray(tl) || !tl.length) return null;
    return {
        items: tl.map(x => ({ t: x.type === 'pit' ? 'p' : 's', d: x.driverIdx, n: x.driverName, c: x.color, q: x.squad, u: Math.round(x.duration || 0), a: (x._actual || x._done) ? 1 : 0, no: x.stintNumber || 0 })),
        rules: window.raceRules || null
    };
};

window._planCtx = function () {
    const st = window.state, cfg = window.config;
    if (window.role !== 'host' || !st || !cfg || !st.isRunning || st.isFinished || !Array.isArray(st.stintTargets)) return { err: 'The race is not running' };
    if (st.isInPit) return { err: 'Change the plan after the pit stop, not during it' };
    const now = window.getSyncedNow ? window.getSyncedNow() : Date.now();
    const raceMs = cfg.raceMs || (parseFloat(cfg.duration) || 0) * 3600000;
    const pitMs = (parseFloat(cfg.minPitTime) || parseFloat(cfg.minPitSec) || parseFloat(cfg.pitTime) || parseFloat(cfg.planPitTime) || 0) * 1000;
    const cur = Math.max(0, (st.globalStintNumber || 1) - 1);
    const elapsed = (now - st.stintStart) + (st.stintOffset || 0);
    const curTarget = st.targetStintMs || st.stintTargets[cur] || 0;
    return {
        st, cfg, cur, pitMs,
        remaining: Math.max(0, raceMs - (now - st.startTime)),
        ttfc: Math.max(0, curTarget - elapsed),
        bounds: window.getStintBoundsMs(cfg),
        futureN: st.stintTargets.length - (cur + 1)
    };
};

// Spread the time that is left evenly over the stints after the current one, inside min/max
window._rebalanceFuture = function (ctx) {
    const st = ctx.st, targets = st.stintTargets;
    const n = targets.length - (ctx.cur + 1);
    if (n <= 0) return;
    const pool = ctx.remaining - ctx.ttfc - n * ctx.pitMs;
    const res = window.normalizeStintDurationsMs(new Array(n).fill(pool / n), { totalTargetMs: pool, bounds: ctx.bounds, plan: true });
    for (let i = 0; i < n; i++) targets[ctx.cur + 1 + i] = res.durations[i];
    st.stintTargets = targets;
    window._mirrorTargetsToPreview();
};

window._mirrorTargetsToPreview = function () {
    const tl = window.previewData && window.previewData.timeline;
    const targets = window.state && window.state.stintTargets;
    if (Array.isArray(tl) && Array.isArray(targets)) {
        tl.filter(x => x.type === 'stint').forEach((s, i) => { if (targets[i] != null && !(s._actual || s._done)) s.duration = targets[i]; });
        if (typeof window.recalculateTimelineTimes === 'function') window.recalculateTimelineTimes();
    }
    if (typeof window.renderPreview === 'function' && window.previewData) { try { window.renderPreview(); } catch (e) {} }
    if (typeof window.broadcast === 'function') window.broadcast();
    if (typeof window.saveRaceState === 'function') window.saveRaceState();
};

window.coSetStintMin = function (idx, min) {
    const ctx = window._planCtx();
    if (ctx.err) return ctx.err;
    idx = Math.round(Number(idx)); min = Number(min);
    if (!(min > 0) || !(idx >= ctx.cur) || idx >= ctx.st.stintTargets.length) return 'That stint cannot be changed';
    if (!window._setLiveStintTargetMs(idx, min * 60000, { silent: true })) return 'That stint cannot be changed';
    window._mirrorTargetsToPreview();
    return '';
};

window.coMoveStint = function (idx, dir) {
    const ctx = window._planCtx();
    if (ctx.err) return ctx.err;
    idx = Math.round(Number(idx)); dir = Number(dir) < 0 ? -1 : 1;
    const to = idx + dir;
    if (idx <= ctx.cur || to <= ctx.cur || to >= ctx.st.stintTargets.length) return 'That stint cannot be moved';
    if (typeof window.moveStint === 'function') window.moveStint(idx, dir);
    if (typeof window.broadcast === 'function') window.broadcast();
    if (typeof window.saveRaceState === 'function') window.saveRaceState();
    return '';
};

window.coAddStint = function () {
    const ctx = window._planCtx();
    if (ctx.err) return ctx.err;
    const n = ctx.futureN + 1;
    const pool = ctx.remaining - ctx.ttfc - n * ctx.pitMs;
    if (ctx.bounds.minStintMs > 0 && pool / n < ctx.bounds.minStintMs) return 'Not enough time left for another stint above the minimum';
    window._addStintsToPlan(ctx.cur, 1);
    window._rebalanceFuture(ctx);
    return '';
};

window.coRemoveStint = function () {
    const ctx = window._planCtx();
    if (ctx.err) return ctx.err;
    if (ctx.futureN <= 1) return 'At least one more stint is needed';
    const stopsAfter = ctx.st.stintTargets.length - 2;
    if (stopsAfter < (parseInt(ctx.cfg.reqStops) || 0)) return 'That would go below the required number of stops';
    const n = ctx.futureN - 1;
    const pool = ctx.remaining - ctx.ttfc - n * ctx.pitMs;
    if (ctx.bounds.effectiveMaxStint !== Infinity && pool / n > ctx.bounds.effectiveMaxStint) return 'The remaining time does not fit in fewer stints under the maximum';
    ctx.st.stintTargets.pop();
    if (Array.isArray(ctx.st.stintSchedule) && ctx.st.stintSchedule.length > ctx.st.stintTargets.length) ctx.st.stintSchedule.pop();
    const tl = window.previewData && window.previewData.timeline;
    if (Array.isArray(tl)) {
        const lastS = tl.map(x => x.type).lastIndexOf('stint');
        if (lastS > 0) { tl.splice(lastS, 1); if (tl[lastS - 1] && tl[lastS - 1].type === 'pit') tl.splice(lastS - 1, 1); }
    }
    window._rebalanceFuture(ctx);
    return '';
};
