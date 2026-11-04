// ==========================================
// 🤝 DELEGATE (co-admin): a device between "viewer" (read only) and "driver" (pit taps)
// ==========================================
// The host stays the single source of truth. A delegate device mirrors the live race like
// a viewer, but the controls the host granted are wired to send commands back; the host
// checks the invite's permissions and runs the real action. Invites are unlimited, each
// carries its own permission set, can be edited live and revoked at any time.

window.DELEGATE_PERMS = {
    pit:    { icon: 'fa-flag-checkered', label: 'Pit stops',        hint: 'Enter / exit pit, force pit out', cmds: ['confirmPitEntry', 'confirmPitExit', 'forcePitOut'] },
    pitAdj: { icon: 'fa-stopwatch',      label: 'Pit time adjust',  hint: '± seconds on the pit stop',       cmds: ['adjustPitTime'] },
    driver: { icon: 'fa-user-astronaut', label: 'Next driver',      hint: 'Change who drives next',          cmds: ['cycleNextDriver'] },
    mode:   { icon: 'fa-gauge-high',     label: 'Pace & squads',    hint: 'Push / problem, night, squad',    cmds: ['setMode', 'toggleNightMode', 'switchNightSquad'] },
    finish: { icon: 'fa-flag',           label: 'Confirm finish',   hint: 'Confirm the race finish',         cmds: ['confirmRaceFinish'] },
    chat:   { icon: 'fa-comments',       label: 'Chat as admin',    hint: 'Message all viewers',             cmds: [] }
};
window.DELEGATE_PRESETS = {
    full:       { label: 'Full admin',   perms: ['pit', 'pitAdj', 'driver', 'mode', 'finish', 'chat'] },
    pit:        { label: 'Pit crew',     perms: ['pit', 'pitAdj', 'driver'] },
    strategist: { label: 'Strategist',   perms: ['mode', 'driver', 'pitAdj', 'chat'] },
    watch:      { label: 'Watch + chat', perms: ['chat'] }
};
// Elements each permission re-enables on the delegate's screen (enforceViewerMode hides them for viewers)
window.DELEGATE_SELECTORS = {
    pit:    '#pitEntryBtn, #forcePitOutBtn',
    pitAdj: '.penalty-btn, .pit-adj-btn, #penaltyBtnMinus5, #penaltyBtnPlus5',
    mode:   '#btnPush, #btnBad, #btnResetMode, #btnNightMode, #btnSwitchSquad',
    finish: '#confirmRaceFinishBtn'
};

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
    window._delegateConns(inv).forEach(c => { try { c.send({ type: 'COADMIN_PERMS', perms: inv.perms }); } catch (e) {} });
};

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
        try { window[cmd](...args); } catch (e) { console.error('Delegate command failed', cmd, e); }
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

window.onCoAdminGranted = function (data) {
    const co = window._coAdmin = Object.assign(window._coAdmin || {}, { granted: true, perms: data.perms || {}, label: data.label });
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
    ['viewerNameScreen', 'clientWaitScreen', 'setupScreen'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('raceDashboard')?.classList.remove('hidden');
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
