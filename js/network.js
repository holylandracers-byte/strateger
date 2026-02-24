// ==========================================
// 📡 NETWORK & PEER JS HANDLER
// ==========================================

const PEER_CONFIG = {
    debug: 2,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            }
        ]
    }
};

window.selectRole = function(r) {
    if (window.peer) {
        window.peer.destroy();
        window.peer = null;
    }
    window.conn = null;
    window.connections = [];
    window.role = r;

    if (r === 'host') {
        window.initHostPeer();
    } else {
        window.initClientPeer();
    }
};

// === Helper: Update Share UI ===
// זה מופיע כאן כי זה קשור ישירות לסטטוס הרשת
window.updateShareUI = function() {
    const shareBtn = document.getElementById('shareRaceBtn');
    const manageBtn = document.getElementById('viewerManageBtn');
    const driverLinkBtn = document.getElementById('driverLinkBtn');
    
    // מציג את הכפתור רק אם יש ID והמשתמש הוא HOST
    if (window.myId && window.role === 'host') {
        if (shareBtn) {
            shareBtn.classList.remove('hidden');
            shareBtn.innerHTML = '<i class="fas fa-link"></i> <span class="hidden sm:inline">Invite</span>';
        }
        
        if (driverLinkBtn) {
            driverLinkBtn.classList.remove('hidden');
        }
        
        if (manageBtn) {
            manageBtn.classList.remove('hidden');
        }
        
        const idEl = document.getElementById('myHostId');
        if (idEl) idEl.innerText = window.myId;
        
        const dashIdEl = document.getElementById('dashboardHostId');
        if (dashIdEl) {
            dashIdEl.innerText = window.myId;
            dashIdEl.classList.remove('hidden');
        }
    }
};

// Add a map to track connected viewers by their peer ID
window.connectedViewers = new Map();

// Add a set to track used viewer names
window.usedViewerNames = new Set();

// Add a map to track connected viewers by their peer ID
window.connectedViewers = new Map();

// Add a set to track used viewer names
window.usedViewerNames = new Set();

// Reserve viewer names per peer ID so they cannot be taken by others during the race
window.reservedViewerNames = new Map();

// === NEW: Viewer Approval System ===
// Track pending approval requests (viewer peerId -> {peerId, name, timestamp})
window.pendingViewerApprovals = new Map();

// Track approved viewers (viewer peerId -> true)
window.approvedViewers = new Map();

// Function to request approval from host
window.requestViewerApproval = function(name) {
    if (window.role === 'viewer' && window.conn && window.conn.open) {
        window.conn.send({ 
            type: 'VIEWER_APPROVAL_REQUEST', 
            name: name.trim(),
            timestamp: Date.now()
        });
    }
};

// Function to approve a viewer (host only)
window.approveViewer = function(peerId, name) {
    const conn = window.connectedViewers.get(peerId);
    if (!conn) return;
    
    // Mark as approved
    window.approvedViewers.set(peerId, true);
    window.pendingViewerApprovals.delete(peerId);
    
    // Notify the viewer
    try {
        conn.send({ 
            type: 'APPROVAL_GRANTED', 
            name: name,
            viewerId: peerId,
            message: 'Your request to join has been approved!'
        });
    } catch(e) { console.error('Failed to send approval', e); }
    
    // Send full race state to the newly approved viewer
    try {
        conn.send({
            type: 'UPDATE',
            state: window.state,
            config: window.config,
            drivers: window.drivers,
            liveData: window.liveData,
            liveTimingConfig: window.liveTimingConfig,
            searchConfig: window.searchConfig,
            currentPitAdjustment: window.currentPitAdjustment || 0,
            timestamp: Date.now()
        });
    } catch(e) { console.error('Failed to send state after approval', e); }

    // Update UI
    window.updateViewerApprovalUI();
    console.log(`✅ Viewer ${peerId} (${name}) approved`);
};

// Function to reject a viewer (host only)  
window.rejectViewer = function(peerId, name) {
    const conn = window.connectedViewers.get(peerId);
    if (!conn) return;
    
    // Remove from pending
    window.pendingViewerApprovals.delete(peerId);
    
    // Notify the viewer
    try {
        conn.send({ 
            type: 'APPROVAL_REJECTED', 
            message: 'Your request to join was rejected by the host.'
        });
    } catch(e) { console.error('Failed to send rejection', e); }
    
    // Close connection
    setTimeout(() => {
        try { conn.close(); } catch(e) {}
    }, 500);
    
    window.updateViewerApprovalUI();
    console.log(`❌ Viewer ${peerId} (${name}) rejected`);
};

// Function to remove an approved viewer
window.removeViewer = function(peerId, name) {
    const conn = window.connectedViewers.get(peerId);
    if (!conn) return;
    
    // Mark as removed
    window.approvedViewers.delete(peerId);
    window.pendingViewerApprovals.delete(peerId);
    
    // Notify the viewer before disconnecting
    try {
        conn.send({ 
            type: 'VIEWER_REMOVED', 
            message: 'You have been removed from this race.'
        });
    } catch(e) {}
    
    // Close connection
    setTimeout(() => {
        try { conn.close(); } catch(e) {}
    }, 500);
    
    window.updateViewerApprovalUI();
    console.log(`🚫 Viewer ${peerId} (${name}) removed`);
};

// Update the UI for viewer approval modal
window.updateViewerApprovalUI = function() {
    const modal = document.getElementById('viewerApprovalModal');
    const badge = document.getElementById('viewerPendingBadge');
    const manageBtn = document.getElementById('viewerManageBtn');
    
    // Always update the pending badge (even if modal is closed)
    const pendingCount = window.pendingViewerApprovals.size;
    if (badge) {
        if (pendingCount > 0) {
            badge.innerText = pendingCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
    // Ensure manage button is visible when there are pending or approved viewers
    if (manageBtn && window.role === 'host' && window.myId) {
        manageBtn.classList.remove('hidden');
    }
    
    if (!modal) return;
    
    const pendingList = document.getElementById('pendingViewersList');
    const approvedList = document.getElementById('approvedViewersContent');
    
    if (!pendingList || !approvedList) return;
    
    // Clear lists
    pendingList.innerHTML = '';
    approvedList.innerHTML = '';
    
    // Render pending viewers
    if (window.pendingViewerApprovals.size > 0) {
        window.pendingViewerApprovals.forEach((data, peerId) => {
            const div = document.createElement('div');
            div.className = 'bg-navy-800 border border-yellow-600/30 rounded p-3';
            div.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="font-bold text-yellow-400">${data.name}</div>
                        <div class="text-xs text-gray-400">#${peerId.substring(0, 8)}</div>
                    </div>
                    <span class="text-xs text-yellow-600" data-i18n="approvalPending">Pending</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="window.approveViewer('${peerId}', '${data.name}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-1 rounded" data-i18n="approveViewer">Approve</button>
                    <button onclick="window.rejectViewer('${peerId}', '${data.name}')" class="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1 rounded" data-i18n="rejectViewer">Reject</button>
                </div>
            `;
            pendingList.appendChild(div);
        });
    } else {
        pendingList.innerHTML = '<div class="text-xs text-gray-500 text-center py-4">No pending requests</div>';
    }
    
    // Render approved viewers
    if (window.approvedViewers.size > 0) {
        window.approvedViewers.forEach((_, peerId) => {
            const conn = window.connectedViewers.get(peerId);
            if (!conn || !conn.viewerName) return;
            
            const div = document.createElement('div');
            div.className = 'bg-navy-800 border border-green-600/30 rounded p-2 flex justify-between items-center';
            div.innerHTML = `
                <div>
                    <div class="font-bold text-green-400">${conn.viewerName}</div>
                    <div class="text-xs text-gray-500">#${peerId.substring(0, 8)}</div>
                </div>
                <button onclick="window.removeViewer('${peerId}', '${conn.viewerName}')" class="bg-red-600/50 hover:bg-red-600 text-white text-xs px-2 py-1 rounded" data-i18n="removeViewer">Remove</button>
            `;
            approvedList.appendChild(div);
        });
    } else {
        approvedList.innerHTML = '<div class="text-xs text-gray-500">No approved viewers yet</div>';
    }
};

// Open/close approval modal
window.openViewerApprovalModal = function() {
    const modal = document.getElementById('viewerApprovalModal');
    if (modal) {
        modal.classList.remove('hidden');
        window.updateViewerApprovalUI();
    }
};

window.closeViewerApprovalModal = function() {
    const modal = document.getElementById('viewerApprovalModal');
    if (modal) modal.classList.add('hidden');
};

window.initHostPeer = function() {
    // אם כבר קיים חיבור
    if (window.peer && !window.peer.destroyed) {
        if (window.myId) window.updateShareUI();
        return;
    }

    try {
        const hasSavedRace = localStorage.getItem('strateger_race_state');
        let storedId = localStorage.getItem('strateger_host_id');
        
        // יצירת ID חדש אם אין מירוץ שמור
        if (!hasSavedRace) {
            storedId = String(Math.floor(1000000 + Math.random() * 9000000));
            localStorage.setItem('strateger_host_id', storedId);
            console.log("🆕 New Race Setup: Generated New Host ID");
        } else if (!storedId) {
            storedId = String(Math.floor(1000000 + Math.random() * 9000000));
            localStorage.setItem('strateger_host_id', storedId);
        }
        
        window.myId = storedId;
        window.peer = new Peer(window.myId, PEER_CONFIG);
        
        window.peer.on('open', (id) => {
            console.log("Host ID initialized:", id);
            window.updateShareUI();
        });
        
        window.peer.on('connection', (c) => {
            // Check if the viewer is already connected
            if (window.connectedViewers.has(c.peer)) {
                console.log(`Viewer with ID ${c.peer} is already connected. Reusing connection.`);
                c.close(); // Close the duplicate connection
                return;
            }

            window.connections.push(c);
            c.viewerId = c.peer; // Store viewer's peer ID
            c.viewerName = null; // Will be set when first chat message received
            window.connectedViewers.set(c.peer, c); // Add to connected viewers map
            window.updateViewerDropdown(); // Update dropdown when new connection

            c.on('open', () => {
                // Update sync status when connection actually opens
                window.updateSyncStatus();
                // If we had previously reserved a name for this peer, restore it
                if (window.reservedViewerNames.has(c.peer)) {
                    const reserved = window.reservedViewerNames.get(c.peer);
                    c.viewerName = reserved;
                    window.usedViewerNames.add(reserved);
                    window.connectedViewers.set(c.peer, c);
                    window.updateViewerDropdown();
                }
                if (window.state && window.state.isRunning && typeof window.broadcast === 'function') {
                    window.broadcast();
                }
                const chatHistory = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
                if(chatHistory.length) {
                    chatHistory.forEach(msg => c.send(msg));
                }
            });
            
            c.on('data', (data) => {
                // === Handle REQUEST_INIT from viewer (plain string) — send state immediately ===
                if (data === 'REQUEST_INIT') {
                    console.log(`📡 Viewer ${c.peer} requested init data`);
                    try {
                        c.send({
                            type: 'INIT',
                            state: window.state,
                            config: window.config,
                            drivers: window.drivers,
                            liveData: window.liveData,
                            liveTimingConfig: window.liveTimingConfig,
                            searchConfig: window.searchConfig,
                            currentPitAdjustment: window.currentPitAdjustment || 0,
                            timestamp: Date.now()
                        });
                    } catch(e) { console.error('Failed to send INIT to viewer', e); }
                    return;
                }

                // === Handle Viewer Approval Requests ===
                if (data.type === 'VIEWER_APPROVAL_REQUEST') {
                    const name = data.name || 'Unknown';
                    
                    // If this viewer was previously approved (reconnection), auto-accept
                    if (window.approvedViewers.has(c.peer)) {
                        console.log(`🔄 Viewer ${name} (${c.peer.substring(0, 8)}) reconnected — auto-approved`);
                        try {
                            c.send({ type: 'APPROVAL_GRANTED', name: name, viewerId: c.peer, message: 'Reconnected — auto-approved!' });
                        } catch(e) {}
                        // Send fresh state
                        try {
                            c.send({ type: 'UPDATE', state: window.state, config: window.config, drivers: window.drivers, liveData: window.liveData, liveTimingConfig: window.liveTimingConfig, searchConfig: window.searchConfig, currentPitAdjustment: window.currentPitAdjustment || 0, timestamp: Date.now() });
                        } catch(e) {}
                        return;
                    }
                    
                    // Track as pending approval
                    window.pendingViewerApprovals.set(c.peer, {
                        peerId: c.peer,
                        name: name,
                        timestamp: data.timestamp
                    });
                    
                    // Alert host that someone is requesting approval
                    console.log(`🔔 Viewer approval request from ${name} (#${c.peer.substring(0, 8)})`);
                    
                    // Update pending badge
                    window.updateViewerApprovalUI();
                    
                    // Play alert sound to notify admin
                    if (typeof window.playAlertBeep === 'function') {
                        window.playAlertBeep('info');
                    }
                    
                    // Auto-show approval modal if host is viewing
                    if (window.role === 'host') {
                        window.openViewerApprovalModal();
                    }
                    
                    return; // Don't process further until approved
                }
                
                // === All other messages require approval (unless it's APPROVAL_GRANTED message) ===
                if (!window.approvedViewers.has(c.peer) && data.type !== 'APPROVAL_GRANTED') {
                    // Pending approval - only allow approval requests
                    console.log(`⏳ Viewer ${c.peer} is pending approval. Ignoring ${data.type} message.`);
                    return;
                }
                
                if (data.type === 'CHAT') {
                    // Store viewer name from first chat message if not set yet (validate & reserve)
                    if (!c.viewerName && data.sender) {
                        let candidate = data.sender.trim();
                        const invalidNames = ['admin', 'host', 'moderator'];
                        if (!candidate || invalidNames.includes(candidate.toLowerCase()) || candidate.length < 3) {
                            // ignore name from chat - force client to explicitly SET_NAME
                        } else {
                            // Ensure not reserved by someone else
                            const reservedTaken = [...window.reservedViewerNames.entries()].find(([pid, n]) => n === candidate && pid !== c.peer);
                            if (!reservedTaken) {
                                // Ensure active uniqueness
                                let base = candidate;
                                let counter = 1;
                                while (window.usedViewerNames.has(candidate)) {
                                    candidate = `${base}_${counter++}`;
                                }
                                c.viewerName = candidate;
                                window.reservedViewerNames.set(c.peer, candidate);
                                window.usedViewerNames.add(candidate);
                                window.updateViewerDropdown();
                            }
                        }
                    }
                    // === Viewer messages go to ADMIN only (not broadcast) ===
                    // Tag message with sender's peerId so admin can reply
                    data.senderPeerId = c.peer;
                    window.renderChatMessage(data);
                    // Do NOT broadcast viewer messages - admin sees them privately 
                } else if (data.type === 'SET_NAME') {
                    // Ensure unique and valid viewer names
                    let uniqueName = data.name.trim();

                    // Validate name (e.g., no inciteful or invalid names)
                    const invalidNames = ['admin', 'host', 'moderator']; // Add more as needed
                    if (invalidNames.includes(uniqueName.toLowerCase()) || uniqueName.length < 3) {
                        c.send({ type: 'ERROR', message: 'Invalid or restricted name. Please choose another.' });
                        return;
                    }

                        // Ensure name is not reserved for another peer
                        const reservedTaken = [...window.reservedViewerNames.entries()].find(([pid, n]) => n === uniqueName && pid !== c.peer);
                        if (reservedTaken) {
                            c.send({ type: 'ERROR', message: 'Name already reserved by another viewer. Choose another.' });
                            return;
                        }

                        // Ensure active uniqueness; if name exists among actively used names, append suffix
                        let counter = 1;
                        let base = uniqueName;
                        while (window.usedViewerNames.has(uniqueName)) {
                            uniqueName = `${base}_${counter++}`;
                        }

                        c.viewerName = uniqueName;
                        // Reserve name for this peer for the duration of the race
                        window.reservedViewerNames.set(c.peer, uniqueName);
                        window.usedViewerNames.add(uniqueName); // Mark as currently used
                        window.connectedViewers.set(c.peer, c); // Update with unique name
                        // Send confirmation back to viewer with their canonical name
                        try { c.send({ type: 'NAME_ACCEPTED', name: uniqueName, viewerId: c.peer }); } catch(e) { console.error('Failed to send NAME_ACCEPTED', e); }
                        console.log(`Viewer ${c.peer} set name to ${uniqueName}`);
                        window.updateViewerDropdown();
                }

                if (data.type === 'PRIVATE_MESSAGE') {
                    const { recipientId, message } = data;
                    const recipientConn = window.connectedViewers.get(recipientId);
                    if (recipientConn) {
                        recipientConn.send({ type: 'PRIVATE_MESSAGE', sender: c.viewerName, message });
                    }
                }
            });
            
            c.on('close', () => {
                console.log(`Viewer ${c.peer} disconnected.`);
                if (c.viewerName) window.usedViewerNames.delete(c.viewerName); // Remove name from used names set
                window.connectedViewers.delete(c.peer); // Remove from connected viewers map
                window.connections = window.connections.filter(conn => conn.peer !== c.peer);
                window.updateViewerDropdown();
            });
        });
        
        window.peer.on('error', (err) => {
            console.error("Peer Error:", err);
             if (err.type === 'unavailable-id') {
                localStorage.removeItem('strateger_host_id');
                window.initHostPeer(); 
             }
        });
        
    } catch (e) {
        console.error("Peer Init Error:", e);
    }
};

window.copyInviteLink = function() {
    const id = window.myId; 
    if (!id) return alert("No connection ID yet");
    
    const link = `${window.location.origin}${window.location.pathname}?join=${id}`;
    
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.getElementById('shareRaceBtn');
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.classList.add('bg-green-500', 'text-white');
        
        setTimeout(() => {
            btn.innerHTML = original;
            btn.classList.remove('bg-green-500', 'text-white');
        }, 2000);
    }).catch(err => {
        prompt("Copy this link:", link);
    });
};

// === Copy Driver Link (opens directly into Driver Mode HUD) ===
window.copyDriverLink = function() {
    const id = window.myId;
    if (!id) return alert("No connection ID yet");
    
    const link = `${window.location.origin}${window.location.pathname}?driver=${id}`;
    
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.getElementById('driverLinkBtn');
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> <span class="hidden sm:inline">Copied!</span>';
        btn.style.background = '#15803d';
        
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.background = '';
        }, 2000);
    }).catch(err => {
        prompt("Copy this driver link:", link);
    });
};

window.updateSyncStatus = function() {
    const count = window.connections.filter(c => c.open).length;
    const el = document.getElementById('syncControls');
    const txt = document.getElementById('syncText');
    const dot = document.getElementById('syncDot');
    
    if (el && txt && dot) {
        el.classList.remove('hidden');
        if (count > 0) {
            dot.className = "sync-dot bg-green-500";
            txt.innerText = `${count} Viewer${count > 1 ? 's' : ''}`;
        } else {
            dot.className = "sync-dot bg-yellow-500";
            txt.innerText = "Waiting";
        }
    }
};

// --- Client Logic ---
window.initClientPeer = function() {
    return new Promise((resolve) => {
        const clientId = 'viewer_' + Math.random().toString(36).substr(2, 9);
        window.peer = new Peer(clientId, PEER_CONFIG);
        window.peer.on('open', (id) => resolve(id));
    });
};

// Track reconnection state for viewers
window.reconnectState = {
    hostId: null,
    isReconnecting: false,
    retryCount: 0,
    maxRetries: 10,
    retryDelay: 1000 // Start with 1 second
};

// Modify connectToHost to handle already used peer IDs
window.connectToHost = function(hostId) {
    if (!hostId) return;
    window.reconnectState.hostId = hostId;
    const startConn = () => {
        if (window.conn) window.conn.close();

        // Check if the client already has a peer ID
        let clientId = localStorage.getItem('strateger_client_id');
        if (!clientId) {
            clientId = 'viewer_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('strateger_client_id', clientId);
        }

        // Check if the peer ID is already in use
        if (window.connectedViewers && window.connectedViewers.has(clientId)) {
            console.error(`Peer ID "${clientId}" is already in use for this race.`);
            return;
        }

        window.peer = new Peer(clientId, PEER_CONFIG);
        window.peer.on('open', (id) => {
            console.log(`Client Peer ID initialized: ${id}`);
            window.conn = window.peer.connect(hostId, { reliable: true });

            // Connection timeout — if host is unreachable, don't hang forever
            const connTimeout = setTimeout(() => {
                if (window.conn && !window.conn.open) {
                    console.warn('Connection to host timed out after 15s');
                    try { window.conn.close(); } catch(e) {}
                    // Show timeout on whichever screen is visible
                    const viewerScreen = document.getElementById('viewerNameScreen');
                    const waitScreen = document.getElementById('clientWaitScreen');
                    const errorHtml = '<div class="flex flex-col items-center justify-center gap-2"><div class="text-xl text-yellow-400 font-bold">⏱️ Connection Timed Out</div><div class="text-xs text-gray-400 mt-2">Host may be offline or link expired</div><button onclick="location.reload()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500">Try Again</button></div>';
                    const viewerError = document.getElementById('viewerNameError');
                    const viewerWaiting = document.getElementById('viewerWaitingMsg');
                    if (viewerScreen && !viewerScreen.classList.contains('hidden')) {
                        if (viewerWaiting) viewerWaiting.innerHTML = errorHtml;
                        else if (viewerError) { viewerError.classList.remove('hidden'); viewerError.innerText = 'Connection timed out. Host may be offline.'; }
                    } else if (waitScreen) {
                        waitScreen.innerHTML = errorHtml;
                    }
                }
            }, 15000);

            window.conn.on('open', () => {
                clearTimeout(connTimeout);
                console.log("Connected to Host");
                // Reset reconnection state on successful connection
                window.resetReconnectionState();
                window.conn.send('REQUEST_INIT');
                
                // Auto-send viewer approval request with pending name
                if (window.pendingChatName && !window._autoDriverMode) {
                    window.requestViewerApproval(window.pendingChatName);
                    console.log(`📡 Sent approval request as "${window.pendingChatName}"`);
                }
                
                // Update wait screen / viewer name screen to show connected status
                const waitScreen = document.getElementById('clientWaitScreen');
                if (waitScreen && !waitScreen.classList.contains('hidden')) {
                    waitScreen.innerHTML = '<div class="flex flex-col items-center justify-center gap-2"><div class="text-2xl text-green-400 font-bold">✅ Connected!</div><div class="text-xs text-gray-400 mt-1">Receiving race data...</div></div>';
                }
            });

            window.conn.on('data', (data) => {
                if (data.type === 'UPDATE' || data.type === 'INIT') {
                    // Always absorb state data
                    if (data.state) window.state = data.state;
                    if (data.config) window.config = data.config;
                    if (data.drivers) window.drivers = data.drivers;
                    if (data.liveData) window.liveData = data.liveData;
                    if (data.liveTimingConfig) window.liveTimingConfig = data.liveTimingConfig;
                    if (data.searchConfig) window.searchConfig = data.searchConfig;

                    // Sync clock offset: host sends its Date.now() — compute how far ahead/behind we are
                    if (data.timestamp) {
                        const localNow = Date.now();
                        const newOffset = data.timestamp - localNow;
                        // Smooth it: blend with previous offset to avoid jumps
                        if (window._hostTimeOffset === undefined) {
                            window._hostTimeOffset = newOffset;
                        } else {
                            window._hostTimeOffset = window._hostTimeOffset * 0.7 + newOffset * 0.3;
                        }
                    }

                    // Update pit adjustment from host
                    if (data.currentPitAdjustment !== undefined) {
                        window.currentPitAdjustment = data.currentPitAdjustment;
                    }

                    // Store strategy timeline for driver notifications
                    if (data.strategyTimeline) {
                        window._receivedTimeline = data.strategyTimeline;
                    }

                    // For viewers (non-driver): gate dashboard behind approval
                    if (!window._autoDriverMode && window.viewerApprovalStatus !== 'approved') {
                        // Don't show dashboard yet — just store state silently
                        return;
                    }

                    // === Show dashboard ===
                    document.getElementById('clientWaitScreen').classList.add('hidden');
                    document.getElementById('viewerNameScreen')?.classList.add('hidden');
                    window.enforceViewerMode();
                    document.getElementById('setupScreen').classList.add('hidden');
                    document.getElementById('raceDashboard').classList.remove('hidden');

                    // Show chat button for viewers (but NOT for driver mode)
                    if (!window._autoDriverMode) {
                        const chatBtn = document.getElementById('chatToggleBtn');
                        if (chatBtn) chatBtn.style.display = 'block';
                    }

                    // Auto-open Driver Mode if opened via driver link
                    if (window._autoDriverMode && !window._driverModeOpened) {
                        window._driverModeOpened = true;
                        
                        // Show driver identity picker if not already identified
                        if (window._myDriverIdx === undefined && window.drivers && window.drivers.length > 1) {
                            window._showDriverPicker();
                        } else {
                            if (window.drivers && window.drivers.length === 1) {
                                window._myDriverIdx = 0;
                            }
                            setTimeout(() => {
                                if (typeof window.toggleDriverMode === 'function') {
                                    window.toggleDriverMode();
                                }
                            }, 300);
                        }
                    }

                    if (typeof window.renderFrame === 'function') window.renderFrame();
                } else if (data.type === 'CHAT') {
                    // Render incoming chats for viewers
                    window.renderChatMessage(data);
                } else if (data.type === 'PRIVATE_MESSAGE') {
                    // Legacy support: convert to CHAT-like message
                    const msg = { type: 'CHAT', sender: data.sender || 'Host', text: data.message, role: 'host', recipient: window.myId, timestamp: Date.now() };
                    window.renderChatMessage(msg);
                } else if (data.type === 'ERROR') {
                    // Show a friendly message on the join screen (if present)
                    if (window.role === 'viewer' && typeof window.onNameRejected === 'function') {
                        window.onNameRejected(data.message || 'Name rejected by host');
                    } else {
                        alert(data.message || 'Error from host');
                    }
                } else if (data.type === 'NAME_ACCEPTED') {
                    // Host confirmed/normalized our name
                    try {
                        localStorage.setItem('strateger_chat_name', data.name);
                    } catch (e) { console.error('Failed to store accepted name', e); }
                    if (window.role === 'viewer' && typeof window.onNameAccepted === 'function') {
                        window.onNameAccepted(data.name);
                    }
                } else if (data.type === 'APPROVAL_GRANTED') {
                    // Host approved our request to view
                    console.log('✅ Your request has been approved by the host!');
                    window.viewerApprovalStatus = 'approved';
                    
                    // Save approved name for chat auto-login and reconnection
                    const approvedName = data.name || window.pendingChatName || 'Viewer';
                    localStorage.setItem('strateger_chat_name', approvedName);
                    localStorage.setItem('strateger_viewer_name', approvedName);
                    window.pendingChatName = null;
                    
                    // Send SET_NAME so host registers our name
                    if (window.conn && window.conn.open) {
                        try { window.conn.send({ type: 'SET_NAME', name: approvedName }); } catch(e) {}
                    }
                    
                    // === Transition to dashboard ===
                    document.getElementById('viewerNameScreen')?.classList.add('hidden');
                    document.getElementById('clientWaitScreen')?.classList.add('hidden');
                    document.getElementById('setupScreen')?.classList.add('hidden');
                    document.getElementById('raceDashboard')?.classList.remove('hidden');
                    if (typeof window.enforceViewerMode === 'function') window.enforceViewerMode();
                    
                    // Show chat button
                    const chatBtn = document.getElementById('chatToggleBtn');
                    if (chatBtn) chatBtn.style.display = 'block';
                    
                    // Auto-set chat to messages view (skip login since name is known)
                    document.getElementById('chatLoginView')?.classList.add('hidden');
                    document.getElementById('chatMessagesView')?.classList.remove('hidden');
                    document.getElementById('chatMessagesView')?.classList.add('flex');
                    
                    // Load chat history
                    const feed = document.getElementById('chatFeed');
                    if (feed && feed.children.length === 0) {
                        try {
                            const history = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
                            history.forEach(msg => window.renderChatMessage(msg));
                        } catch(e) {}
                    }
                    
                    // Update placeholder for viewer
                    if (typeof window.updateChatPlaceholder === 'function') window.updateChatPlaceholder();
                    
                    // Render current state if available
                    if (typeof window.renderFrame === 'function' && window.state?.isRunning) {
                        window.renderFrame();
                    }
                } else if (data.type === 'APPROVAL_REJECTED') {
                    // Host rejected our request
                    console.log('❌ Your request was rejected by the host.');
                    window.viewerApprovalStatus = 'rejected';
                    localStorage.removeItem('strateger_viewer_name');
                    
                    // Show rejection on the viewer name screen
                    const viewerNameScreen = document.getElementById('viewerNameScreen');
                    const errorEl = document.getElementById('viewerNameError');
                    const waitingMsg = document.getElementById('viewerWaitingMsg');
                    const nameInput = document.getElementById('viewerNameInput');
                    
                    if (viewerNameScreen) viewerNameScreen.classList.remove('hidden');
                    if (waitingMsg) waitingMsg.classList.add('hidden');
                    if (nameInput) nameInput.disabled = false;
                    // Re-show submit button
                    const submitBtn = viewerNameScreen?.querySelector('button[onclick*="submitViewerName"]');
                    if (submitBtn) submitBtn.classList.remove('hidden');
                    if (errorEl) {
                        errorEl.classList.remove('hidden');
                        errorEl.innerText = data.message || (window.t ? window.t('approvalRejected') : 'Your request was rejected');
                    }
                    // Close connection
                    setTimeout(() => {
                        try { window.conn.close(); } catch(e) {}
                    }, 1000);
                } else if (data.type === 'VIEWER_REMOVED') {
                    // We were removed by the host
                    console.log('🚫 You have been removed from this race.');
                    alert(data.message || 'You have been removed from this race');
                    // Close connection
                    setTimeout(() => {
                        try { window.conn.close(); } catch(e) {}
                        location.reload();
                    }, 500);
                }
            });

            window.conn.on('close', () => {
                console.log("Disconnected from Host");
                window.conn = null;
                // Attempt automatic reconnection
                if ((window.role === 'client' || window.role === 'viewer') && !window.reconnectState.isReconnecting) {
                    window.attemptReconnection();
                }
            });

            window.conn.on('error', (err) => {
                console.error("Connection error:", err);
            });
        });

        window.peer.on('error', (err) => {
            console.error("PeerJS Error:", err);
            if (err.type === 'unavailable-id') {
                console.error(`Peer ID "${clientId}" is already taken. Generating a new ID.`);
                localStorage.removeItem('strateger_client_id'); // Clear the stored ID
                startConn(); // Retry with a new ID
            } else if (err.type === 'peer-unavailable') {
                // Host ID doesn't exist on the signaling server
                console.error('Host peer not found — link may be expired');
                const waitScreen = document.getElementById('clientWaitScreen');
                if (waitScreen) {
                    waitScreen.innerHTML = '<div class="flex flex-col items-center justify-center gap-2"><div class="text-xl text-red-400 font-bold">❌ Host Not Found</div><div class="text-xs text-gray-400 mt-2">The race link may have expired or the host is offline</div><button onclick="location.reload()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500">Try Again</button></div>';
                }
            }
        });
    };

    startConn();
};

// Automatic reconnection with exponential backoff
window.attemptReconnection = function() {
    if (window.reconnectState.retryCount >= window.reconnectState.maxRetries) {
        console.error('Max reconnection attempts reached');
        const waitScreen = document.getElementById('clientWaitScreen');
        if (waitScreen) {
            waitScreen.innerHTML = '<div class="flex flex-col items-center justify-center gap-2"><div class="text-xl text-red-400 font-bold">⚠️ Connection Lost</div><div class="text-xs text-gray-400 mt-2">Host may have ended the race or closed connection</div><button onclick="location.reload()" class="mt-4 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500">Refresh Page</button></div>';
        }
        return;
    }

    window.reconnectState.isReconnecting = true;
    const delay = Math.min(window.reconnectState.retryDelay * Math.pow(2, window.reconnectState.retryCount), 30000); // Cap at 30 seconds
    
    const waitScreen = document.getElementById('clientWaitScreen');
    if (waitScreen) {
        waitScreen.innerHTML = `<div class="flex flex-col items-center justify-center gap-2"><div class="text-lg text-yellow-400 font-bold">🔄 Reconnecting...</div><div class="text-xs text-gray-400 mt-2">Attempt ${window.reconnectState.retryCount + 1} of ${window.reconnectState.maxRetries}</div><div class="text-xs text-gray-500 mt-1">Retrying in ${(delay / 1000).toFixed(1)}s</div></div>`;
    }
    
    setTimeout(() => {
        console.log(`Reconnection attempt ${window.reconnectState.retryCount + 1}...`);
        window.reconnectState.retryCount++;
        window.reconnectState.isReconnecting = false;
        window.connectToHost(window.reconnectState.hostId);
    }, delay);
};

// Reset reconnection state when successfully connected
window.resetReconnectionState = function() {
    window.reconnectState.retryCount = 0;
    window.reconnectState.isReconnecting = false;
    console.log('Reconnection successful, state reset');
};

window.broadcast = function(specificPayload = null) {
    if (window.role !== 'host' || !window.peer) return;
    const payload = specificPayload || {
        type: 'UPDATE',
        state: window.state,
        config: window.config,
        drivers: window.drivers,
        liveData: window.liveData,
        liveTimingConfig: window.liveTimingConfig,
        searchConfig: window.searchConfig,
        currentPitAdjustment: window.currentPitAdjustment || 0, // 🟢 Include pit adjustment so viewers see it
        strategyTimeline: (window.cachedStrategy && window.cachedStrategy.timeline) ? window.cachedStrategy.timeline.filter(t => t.type === 'stint').map(t => ({ driverIdx: t.driverIdx, driverName: t.driverName, start: t.start, end: t.end, duration: t.duration, stintNumber: t.stintNumber, squad: t.squad })) : null,
        timestamp: Date.now()
        };

        // If it's a CHAT message, route depending on `recipient` field
        if (payload.type === 'CHAT') {
            // Save to host history locally
            try {
                let history = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
                const exists = history.some(m => m.timestamp === payload.timestamp && m.text === payload.text && m.sender === payload.sender);
                if (!exists) {
                    history.push(payload);
                    if (history.length > 200) history.shift();
                    localStorage.setItem('strateger_chat_history', JSON.stringify(history));
                }
            } catch (e) { console.error('Failed saving chat history', e); }

            // If recipient is null -> broadcast to all viewers
            if (!payload.recipient) {
                window.connections.forEach(c => {
                    if (c && c.open) {
                        try { c.send(payload); } catch (e) { console.error('Send chat failed', e); }
                    }
                });
            } else if (payload.recipient === 'broadcast') {
                // compatibility: treat as broadcast
                window.connections.forEach(c => { if (c && c.open) try { c.send(payload); } catch (e) {} });
            } else {
                // Private message to a single viewerId
                const dest = window.connectedViewers.get(payload.recipient);
                if (dest && dest.open) {
                    try { dest.send(payload); } catch (e) { console.error('Send private chat failed', e); }
                }
            }

            return;
        }

        // For non-chat updates, send full state to all viewers
        try {
            window.connections.forEach(c => {
                if (c && c.open) {
                    c.send(payload);
                }
            });
        } catch (e) {
            console.error("Broadcast error:", e);
        }
    };

    // Update the host's viewer dropdown used for selecting recipients in chat
    window.updateViewerDropdown = function() {
        const selectorWrapper = document.getElementById('chatViewerSelector');
        const select = document.getElementById('chatRecipientSelect');
        if (!select || !selectorWrapper) return;

        // Only show selector for the host
        if (window.role !== 'host') {
            selectorWrapper.classList.add('hidden');
            return;
        }

        selectorWrapper.classList.remove('hidden');
        // Reset options
        select.innerHTML = '';
        const optAll = document.createElement('option');
        optAll.value = 'broadcast';
        optAll.innerText = 'All Viewers (Chat Members)';
        select.appendChild(optAll);

        // Add only viewers with chat names (those who joined chat)
        window.connectedViewers.forEach((conn, id) => {
            // Only show viewers who have a name (have joined chat)
            if (conn.viewerName) {
                const opt = document.createElement('option');
                opt.value = id;
                opt.innerText = conn.viewerName;
                select.appendChild(opt);
            }
        });
    };

    // Clear reserved viewer names (e.g., at race end or manual reset)
    window.clearReservedViewerNames = function() {
        window.reservedViewerNames.clear();
        window.usedViewerNames.clear();
        window.updateViewerDropdown();
        console.log('Cleared reserved viewer names');
    };
