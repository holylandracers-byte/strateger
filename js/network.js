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

window.initHostPeer = function() {
    // אם כבר קיים חיבור
    if (window.peer && !window.peer.destroyed) {
        // === תיקון: עדכון ה-UI גם אם החיבור כבר קיים ===
        if (window.myId) window.updateShareUI();
        return;
    }

    try {
        const hasSavedRace = localStorage.getItem('strateger_race_state');
        let storedId = localStorage.getItem('strateger_host_id');
        
        if (!hasSavedRace) {
            // מירוץ חדש -> ID חדש
            storedId = String(Math.floor(1000000 + Math.random() * 9000000));
            localStorage.setItem('strateger_host_id', storedId);
        } else if (!storedId) {
            // הגנה
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
            window.connections.push(c);
            window.updateSyncStatus();
            
            c.on('open', () => {
                if (window.state && window.state.isRunning && typeof window.broadcast === 'function') {
                    window.broadcast();
                }
                // שליחת היסטוריית צ'אט למצטרף החדש
                const chatHistory = JSON.parse(localStorage.getItem('strateger_chat_history') || '[]');
                if(chatHistory.length) {
                    chatHistory.forEach(msg => c.send(msg));
                }
            });
            
            c.on('close', () => {
                window.connections = window.connections.filter(x => x !== c);
                window.updateSyncStatus();
            });

            c.on('data', (data) => {
                if (data.type === 'CHAT') {
                    window.renderChatMessage(data); 
                    window.broadcast(data); 
                }
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
    const id = window.myId; // שימוש במשתנה ולא ב-DOM
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

// ... (Client Logic נשאר ללא שינוי) ...
window.initClientPeer = function() {
    return new Promise((resolve) => {
        const clientId = 'viewer_' + Math.random().toString(36).substr(2, 9);
        window.peer = new Peer(clientId, PEER_CONFIG);
        window.peer.on('open', (id) => resolve(id));
    });
};

window.connectToHost = function(hostId) {
    if (!hostId) return;
    const startConn = () => {
        if (window.conn) window.conn.close();
        window.conn = window.peer.connect(hostId, { reliable: true });
        window.conn.on('open', () => {
            console.log("Connected to Host");
            window.conn.send('REQUEST_INIT');
            document.getElementById('clientWaitScreen').innerHTML = '<div class="text-2xl text-green-400">Connected!</div>';
        });
        window.conn.on('data', (data) => {
            document.getElementById('clientWaitScreen').classList.add('hidden');
            if (data.type === 'UPDATE' || data.type === 'INIT') {
                if (data.state) window.state = data.state;
                if (data.config) window.config = data.config;
                if (data.drivers) window.drivers = data.drivers;
                if (data.liveData) window.liveData = data.liveData;
                
                window.enforceViewerMode();
                document.getElementById('setupScreen').classList.add('hidden');
                document.getElementById('raceDashboard').classList.remove('hidden');
                if (typeof window.renderFrame === 'function') window.renderFrame();
            }
            if (data.type === 'CHAT') window.renderChatMessage(data);
        });
        window.conn.on('close', () => { alert("Connection lost"); window.location.reload(); });
    };
    if (!window.peer || window.peer.destroyed) {
        window.initClientPeer().then(startConn);
    } else {
        startConn();
    }
};

window.broadcast = function(specificPayload = null) {
    if (window.role !== 'host' || !window.peer) return;
    const payload = specificPayload || {
        type: 'UPDATE',
        state: window.state,
        config: window.config,
        drivers: window.drivers,
        liveData: window.liveData,
        timestamp: Date.now()
    };
    window.connections.forEach(c => { if (c.open) c.send(payload); });
};