// ==========================================
// 📡 NETWORK & PEER JS HANDLER
// ==========================================

const PEER_CONFIG = {
    debug: 2,
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
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
    
    // מציג את הכפתור רק אם יש ID והמשתמש הוא HOST
    if (window.myId && window.role === 'host') {
        if (shareBtn) {
            shareBtn.classList.remove('hidden');
            shareBtn.innerHTML = '<i class="fas fa-link"></i> <span class="hidden sm:inline">Invite</span>';
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

// Reserve viewer names per peer ID so they cannot be taken by others during the race
window.reservedViewerNames = new Map();

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
                    window.renderChatMessage(data); 
                    window.broadcast(data); 
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

            window.conn.on('open', () => {
                console.log("Connected to Host");
                // Reset reconnection state on successful connection
                window.resetReconnectionState();
                window.conn.send('REQUEST_INIT');
                // If the viewer picked a name before connection opened, send it now
                if (window.pendingChatName) {
                    try { window.conn.send({ type: 'SET_NAME', name: window.pendingChatName }); } catch(e) { console.error('Failed to send pending name', e); }
                    // show waiting message in UI
                    const joinErr = document.getElementById('chatJoinError');
                    if (joinErr) { joinErr.classList.remove('hidden'); joinErr.innerText = 'Waiting for host to accept your name...'; }
                } else {
                    // Try to auto-join with Google name if available
                    if (typeof window.autoJoinChatWithGoogle === 'function') {
                        window.autoJoinChatWithGoogle();
                    }
                }
                // Update wait screen to show connected status
                const waitScreen = document.getElementById('clientWaitScreen');
                if (waitScreen) {
                    waitScreen.innerHTML = '<div class="flex flex-col items-center justify-center gap-2"><div class="text-2xl text-green-400 font-bold">✅ Connected!</div><div class="text-xs text-gray-400 mt-1">Receiving race data...</div></div>';
                }
            });

            window.conn.on('data', (data) => {
                document.getElementById('clientWaitScreen').classList.add('hidden');
                if (data.type === 'UPDATE' || data.type === 'INIT') {
                    if (data.state) window.state = data.state;
                    if (data.config) window.config = data.config;
                    if (data.drivers) window.drivers = data.drivers;
                    if (data.liveData) window.liveData = data.liveData;

                    // Update pit adjustment from host
                    if (data.currentPitAdjustment !== undefined) {
                        window.currentPitAdjustment = data.currentPitAdjustment;
                    }

                    window.enforceViewerMode();
                    document.getElementById('setupScreen').classList.add('hidden');
                    document.getElementById('raceDashboard').classList.remove('hidden');

                    // Show chat button for viewers
                    const chatBtn = document.getElementById('chatToggleBtn');
                    if (chatBtn) chatBtn.style.display = 'block';

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
                }
            });
        });

        window.conn.on('close', () => {
            console.log("Disconnected from Host");
            window.conn = null;
            // Attempt automatic reconnection
            if (window.role === 'viewer' && !window.reconnectState.isReconnecting) {
                window.attemptReconnection();
            }
        });

        window.peer.on('error', (err) => {
            console.error("PeerJS Error:", err);
            if (err.type === 'unavailable-id') {
                console.error(`Peer ID "${clientId}" is already taken. Generating a new ID.`);
                localStorage.removeItem('strateger_client_id'); // Clear the stored ID
                startConn(); // Retry with a new ID
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
        currentPitAdjustment: window.currentPitAdjustment || 0, // 🟢 Include pit adjustment so viewers see it
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
