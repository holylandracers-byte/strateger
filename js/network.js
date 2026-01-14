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

// --- Role Selection (Logic Only) ---
window.selectRole = function(r) {
    // איפוס חיבורים קודמים
    if (window.peer) {
        window.peer.destroy();
        window.peer = null;
    }
    window.conn = null;
    window.connections = [];
    window.role = r;

    // כאן הסרנו את כל ה-DOM Manipulations שגרמו לקריסה
    // הממשק כבר מסודר ב-HTML

    if (r === 'host') {
        window.initHostPeer();
    } else {
        window.initClientPeer();
    }
};

// --- Host Logic ---
window.initHostPeer = function() {
    // אם כבר קיים, לא ניצור שוב
    if (window.peer && !window.peer.destroyed) return;

    try {
        window.myId = String(Math.floor(1000000 + Math.random() * 9000000));
        window.peer = new Peer(window.myId, PEER_CONFIG);
        
        window.peer.on('open', (id) => {
            console.log("Host ID created:", id);
            
            // עדכון המזהה הנסתר (להעתקה)
            const idEl = document.getElementById('myHostId');
            if (idEl) idEl.innerText = id;
            
            // חשיפת כפתור השיתוף (רק כשיש חיבור)
            const shareBtn = document.getElementById('shareRaceBtn');
            if (shareBtn) {
                shareBtn.classList.remove('hidden');
                shareBtn.innerHTML = '<i class="fas fa-link"></i> <span class="hidden sm:inline">Invite</span>';
            }
        });
        
        window.peer.on('connection', (c) => {
            console.log("New Viewer:", c.peer);
            window.connections.push(c);
            window.updateSyncStatus();
            
            c.on('open', () => {
                if (window.state.isRunning && typeof window.broadcast === 'function') {
                    window.broadcast();
                }
            });
            
            c.on('close', () => {
                window.connections = window.connections.filter(x => x !== c);
                window.updateSyncStatus();
            });
        });
        
        window.peer.on('error', (err) => {
            console.error("Peer Error:", err);
            // אפשר להוסיף חיווי ויזואלי עדין אם תרצה
        });
        
    } catch (e) {
        console.error("Peer Init Error:", e);
    }
};

window.copyInviteLink = function() {
    const id = document.getElementById('myHostId').innerText;
    if (!id || id === '---') return alert("No connection ID yet");
    
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
        
        window.peer.on('open', (id) => {
            resolve(id);
        });
        
        window.peer.on('error', (err) => console.error("Client Error:", err));
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
            
            // עדכון מסך המתנה
            const waitScreen = document.getElementById('clientWaitScreen');
            if (waitScreen) waitScreen.innerHTML = '<div class="text-2xl text-green-400">Connected!</div><div class="text-sm text-gray-500">Loading data...</div>';
        });

        window.conn.on('data', (data) => {
            // הסתרת מסך המתנה וכניסה לדשבורד
            const waitScreen = document.getElementById('clientWaitScreen');
            if (waitScreen) waitScreen.classList.add('hidden');
            
            if (data.type === 'UPDATE' || data.type === 'INIT') {
                if (data.state) window.state = data.state;
                if (data.config) window.config = data.config;
                if (data.drivers) window.drivers = data.drivers;
                if (data.liveData) window.liveData = data.liveData;
                
                // הפעלת מצב צפייה
                document.getElementById('setupScreen').classList.add('hidden');
                document.getElementById('raceDashboard').classList.remove('hidden');
                if (typeof window.renderFrame === 'function') window.renderFrame();
            }
        });

        window.conn.on('close', () => {
            alert("Connection lost");
            window.location.reload();
        });
    };

    if (!window.peer || window.peer.destroyed) {
        window.initClientPeer().then(startConn);
    } else {
        startConn();
    }
};

// --- Broadcast ---
window.broadcast = function() {
    if (window.role !== 'host' || !window.peer) return;
    
    const payload = {
        type: 'UPDATE',
        state: window.state,
        config: window.config,
        drivers: window.drivers,
        liveData: window.liveData,
        timestamp: Date.now()
    };
    
    window.connections.forEach(c => { if (c.open) c.send(payload); });
};