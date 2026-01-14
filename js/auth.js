// ==========================================
// 🔐 GOOGLE AUTH & INTEGRATIONS
// ==========================================

const GOOGLE_CLIENT_ID = '944328539678-cm1ao0asklck15o9rpneh48nbdtpdstk.apps.googleusercontent.com';
let googleUser = null;
let googleAccessToken = null;

// --- Initialization & Persistence ---
window.initGoogleAuth = function() {
    if (typeof google === 'undefined') {
        console.log('Google API not loaded yet');
        setTimeout(window.initGoogleAuth, 1000);
        return;
    }
    
    const savedUser = localStorage.getItem('strateger_google_user');
    const savedToken = localStorage.getItem('strateger_google_token');
    const tokenTime = localStorage.getItem('strateger_token_time');

    if (savedUser && savedToken && tokenTime) {
        const now = Date.now();
        // תוקף טוקן: שעה אחת (3600 שניות)
        if (now - parseInt(tokenTime) < 3600 * 1000) {
            try {
                googleUser = JSON.parse(savedUser);
                googleAccessToken = savedToken;
                window.updateGoogleUI(true);
                console.log('✅ Session restored');
            } catch (e) {
                console.error('Session restore failed:', e);
                window.googleSignOut();
            }
        } else {
            console.log('⚠️ Session expired');
            window.googleSignOut();
        }
    }
    console.log('✅ Google Auth initialized');
};

// --- Sign In ---
window.googleSignIn = function() {
    if (typeof google === 'undefined') return alert('Google API not loaded.');
    
    const client = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
        callback: async (tokenResponse) => {
            if (tokenResponse.error) {
                console.error('Auth error:', tokenResponse.error);
                return;
            }
            
            googleAccessToken = tokenResponse.access_token;
            localStorage.setItem('strateger_google_token', googleAccessToken);
            localStorage.setItem('strateger_token_time', Date.now());
            
            await window.fetchGoogleUserInfo(tokenResponse.access_token);
        }
    });
    
    client.requestAccessToken();
};

window.fetchGoogleUserInfo = async function(accessToken) {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        
        if (!response.ok) throw new Error('Failed to fetch user info');
        
        const data = await response.json();
        googleUser = {
            name: data.name,
            email: data.email,
            picture: data.picture,
            id: data.id
        };
        
        localStorage.setItem('strateger_google_user', JSON.stringify(googleUser));
        window.updateGoogleUI(true);
        
    } catch (error) {
        console.error(error);
        alert('Auth Error: ' + error.message);
        window.googleSignOut();
    }
};

window.googleSignOut = function() {
    if (googleAccessToken) {
        google.accounts.oauth2.revoke(googleAccessToken, () => console.log('Token revoked'));
    }
    googleUser = null;
    googleAccessToken = null;
    localStorage.removeItem('strateger_google_user');
    localStorage.removeItem('strateger_google_token');
    localStorage.removeItem('strateger_token_time');
    window.updateGoogleUI(false);
};

window.updateGoogleUI = function(signedIn) {
    const btn = document.getElementById('googleSignInBtn');
    const userDisplay = document.getElementById('googleUserDisplay');
    const actionsBar = document.getElementById('googleActionsBar');
    const statusEl = document.getElementById('googleStatus');
    
    if (signedIn && googleUser) {
        if (btn) btn.classList.add('hidden');
        if (userDisplay) {
            userDisplay.classList.remove('hidden');
            userDisplay.classList.add('flex');
        }
        if (actionsBar) actionsBar.classList.remove('hidden');
        if (statusEl) {
            statusEl.innerText = '✅ Connected';
            statusEl.className = 'text-[10px] text-green-400';
        }
        
        const avatar = document.getElementById('googleAvatarSmall');
        const name = document.getElementById('googleNameSmall');
        
        if (avatar) avatar.src = googleUser.picture || '';
        if (name) name.innerText = googleUser.name ? googleUser.name.split(' ')[0] : 'User';
        
    } else {
        if (btn) btn.classList.remove('hidden');
        if (userDisplay) userDisplay.classList.add('hidden');
        if (actionsBar) actionsBar.classList.add('hidden');
        if (statusEl) {
            statusEl.innerText = 'Not connected';
            statusEl.className = 'text-[10px] text-gray-500';
        }
    }
};

// --- Email Functions ---
window.showTeamEmailModal = function() {
    if (!googleUser) return alert(window.t('signInGoogle'));
    
    // שחזור נמענים אחרונים
    const savedRecipients = localStorage.getItem('strateger_email_recipients');
    if (savedRecipients) {
        const recipientsInput = document.getElementById('emailRecipients');
        if (recipientsInput) recipientsInput.value = savedRecipients;
    }

    const raceDur = document.getElementById('raceDuration')?.value || '12';
    const driverNames = window.drivers ? window.drivers.map(d => d.name).join(', ') : '';
    
    const msgInput = document.getElementById('emailMessage');
    if (msgInput) {
        msgInput.value = `Race Strategy Update:\n📍 Duration: ${raceDur} hours\n👥 Drivers: ${driverNames}\n\nPlease confirm availability and review the attached strategy.`;
    }
    
    document.getElementById('emailTeamModal').classList.remove('hidden');
};

window.closeEmailModal = function() {
    document.getElementById('emailTeamModal').classList.add('hidden');
};

window.sendTeamEmail = async function() {
    if (!googleAccessToken) return alert(window.t('signInGoogle'));
    
    const recipients = document.getElementById('emailRecipients').value;
    const subject = document.getElementById('emailSubject').value;
    let message = document.getElementById('emailMessage').value;
    const attachStrategy = document.getElementById('attachStrategy').checked;
    
    if (!recipients || !subject) return alert('Missing fields');

    // שמירת נמענים להיסטוריה
    localStorage.setItem('strateger_email_recipients', recipients);

    // הוספת פרטי אסטרטגיה אם נדרש
    if (attachStrategy && (window.cachedStrategy || window.previewData)) {
        const data = window.cachedStrategy || window.previewData;
        message += '\n\n🏁 STRATEGY SUMMARY:\n';
        if (data.timeline) {
            const stints = data.timeline.filter(t => t.type === 'stint').length;
            const stops = data.timeline.filter(t => t.type === 'pit').length;
            message += `Total Stints: ${stints}\nTotal Stops: ${stops}\n`;
        }
        if (window.drivers) {
            message += `Drivers: ${window.drivers.map(d => d.name).join(', ')}\n`;
        }
        message += `\nGenerated by Strateger`;
    }
    
    const emailContent = [
        `To: ${recipients}`,
        `Subject: ${subject}`,
        `Content-Type: text/plain; charset=utf-8`,
        '',
        message
    ].join('\r\n');
    
    const encodedEmail = btoa(unescape(encodeURIComponent(emailContent))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    
    try {
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${googleAccessToken}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ raw: encodedEmail })
        });
        
        if (response.ok) {
            alert('✅ Email sent!');
            window.closeEmailModal();
        } else {
            throw new Error('Failed to send email');
        }
    } catch (e) {
        alert('Error sending email: ' + e.message);
    }
};

window.shareStrategyEmail = function() {
    if (!window.cachedStrategy && !window.previewData) return alert('Generate strategy first');
    window.showTeamEmailModal();
    const subInput = document.getElementById('emailSubject');
    if(subInput) subInput.value = '🏎️ Race Strategy Plan';
};

// --- Calendar Functions ---
window.checkTeamAvailability = async function() {
    if (!googleAccessToken) return alert(window.t('signInGoogle'));
    
    const dateStr = prompt('Enter date (YYYY-MM-DD):', new Date().toISOString().split('T')[0]);
    if (!dateStr) return;
    
    try {
        const timeMin = new Date(`${dateStr}T00:00:00`).toISOString();
        const timeMax = new Date(`${dateStr}T23:59:59`).toISOString();
        
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`, {
            headers: { 'Authorization': `Bearer ${googleAccessToken}` }
        });
        
        const data = await res.json();
        
        if (!data.items || data.items.length === 0) {
            alert(window.t('noEvents'));
        } else {
            let msg = `${window.t('eventsFound')}\n`;
            data.items.forEach(event => {
                const start = event.start.dateTime 
                    ? new Date(event.start.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) 
                    : 'All Day';
                msg += `• ${start}: ${event.summary}\n`;
            });
            alert(msg);
        }
    } catch (e) {
        console.error(e);
        alert('Calendar Error: ' + e.message);
    }
};

window.showCalendarModal = function() {
    if (!googleUser) return alert(window.t('signInGoogle'));
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('calendarDate').value = today;
    document.getElementById('calendarTime').value = '09:00';
    document.getElementById('calendarModal').classList.remove('hidden');
};

window.closeCalendarModal = function() {
    document.getElementById('calendarModal').classList.add('hidden');
};

window.createCalendarEvent = async function() {
    if (!googleAccessToken) return alert(window.t('signInGoogle'));
    
    const title = document.getElementById('calendarTitle').value;
    const date = document.getElementById('calendarDate').value;
    const time = document.getElementById('calendarTime').value;
    const location = document.getElementById('calendarLocation').value;
    
    if (!title || !date || !time) return alert('Missing required fields');
    
    const startDateTime = new Date(`${date}T${time}`);
    const raceDur = parseFloat(document.getElementById('raceDuration')?.value || 12);
    const endDateTime = new Date(startDateTime.getTime() + raceDur * 60 * 60 * 1000);
    
    const event = {
        summary: title,
        location: location,
        description: 'Race event managed by Strateger',
        start: { dateTime: startDateTime.toISOString() },
        end: { dateTime: endDateTime.toISOString() }
    };
    
    try {
        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${googleAccessToken}`, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(event)
        });
        
        if(res.ok) {
            alert('✅ Event created!');
            window.closeCalendarModal();
        } else {
            throw new Error('Failed to create event');
        }
    } catch(e) {
        alert('Error: ' + e.message);
    }
};

// Auto-init on load
window.addEventListener('load', () => setTimeout(window.initGoogleAuth, 1500));