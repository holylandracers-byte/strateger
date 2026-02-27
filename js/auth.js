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
    if (typeof google === 'undefined') return window.showToast('Google API not loaded.', 'error');
    
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
        
        // Request notification permission for race countdown alerts
        if (typeof window.requestNotificationPermission === 'function') {
            window.requestNotificationPermission();
        }
        
    } catch (error) {
        console.error(error);
        window.showToast('Auth Error: ' + error.message, 'error');
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
    if (!googleUser) return window.showToast(window.t('signInGoogle'), 'warning');
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
    if (!googleAccessToken) return window.showToast(window.t('signInGoogle'), 'warning');
    
    const recipients = document.getElementById('emailRecipients').value;
    const subject = document.getElementById('emailSubject').value;
    let message = document.getElementById('emailMessage').value;
    const attachStrategy = document.getElementById('attachStrategy').checked;
    
    if (!recipients || !subject) return window.showToast('Missing fields', 'warning');

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
            window.showToast('✅ Email sent!', 'success');
            window.closeEmailModal();
        } else {
            throw new Error('Failed to send email');
        }
    } catch (e) {
        window.showToast('Error sending email: ' + e.message, 'error');
    }
};

window.shareStrategyEmail = function() {
    if (!window.cachedStrategy && !window.previewData) return window.showToast('Generate strategy first', 'warning');
    window.showTeamEmailModal();
    const subInput = document.getElementById('emailSubject');
    if(subInput) subInput.value = '🏎️ Race Strategy Plan';
};

// --- Calendar Functions ---
window.checkTeamAvailability = async function() {
    if (!googleAccessToken) return window.showToast(window.t('signInGoogle'), 'warning');
    
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
            window.showToast(window.t('noEvents'), 'info');
        } else {
            let msg = `${window.t('eventsFound')}\n`;
            data.items.forEach(event => {
                const start = event.start.dateTime 
                    ? new Date(event.start.dateTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) 
                    : 'All Day';
                msg += `• ${start}: ${event.summary}\n`;
            });
            window.showToast(msg, 'info', 8000);
        }
    } catch (e) {
        console.error(e);
        window.showToast('Calendar Error: ' + e.message, 'error');
    }
};

window.showCalendarModal = function() {
    if (!googleUser) return window.showToast(window.t('signInGoogle'), 'warning');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('calendarDate').value = today;
    document.getElementById('calendarTime').value = '09:00';
    document.getElementById('calendarUseRange').checked = false;
    document.getElementById('calendarEndDateContainer').classList.add('hidden');
    document.getElementById('calendarModal').classList.remove('hidden');
};

window.toggleCalendarRange = function() {
    const useRange = document.getElementById('calendarUseRange').checked;
    const endContainer = document.getElementById('calendarEndDateContainer');
    if (useRange) {
        endContainer.classList.remove('hidden');
        const startDate = document.getElementById('calendarDate').value;
        if (startDate) {
            document.getElementById('calendarEndDate').value = startDate;
        }
        document.getElementById('calendarEndTime').value = '18:00';
    } else {
        endContainer.classList.add('hidden');
    }
};

window.closeCalendarModal = function() {
    document.getElementById('calendarModal').classList.add('hidden');
};

window.addToGoogleCalendar = async function() {
    const t = window.t || ((k) => k);

    // בדיקת התחברות
    if (!googleUser) {
        window.showToast(t('googleLogin'), 'warning');
        window.handleGoogleLogin();
        return;
    }
    
    // חישוב זמנים לאירוע בודד
    // משתמשים בזמן הנוכחי כהתחלה (או בזמן שנשמר ב-previewData)
    const startTime = window.previewData?.startTime || new Date();
    const durationHours = parseFloat(document.getElementById('raceDuration')?.value || 12);
    const endTime = new Date(startTime.getTime() + durationHours * 3600000);
    
    const eventTitle = t('raceEventTitle') || "Endurance Race";

    const event = {
        summary: eventTitle,
        description: 'Generated by Strateger',
        start: { dateTime: startTime.toISOString() },
        end: { dateTime: endTime.toISOString() }
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
            window.showToast('✅ ' + t('eventCreated'), 'success');
        } else {
            throw new Error('API Error');
        }
    } catch(e) {
        window.showToast('❌ ' + t('eventError') + ': ' + e.message, 'error');
    }
};

window.createCalendarEvent = async function() {
    if (!googleAccessToken) return window.showToast(window.t('signInGoogle'), 'warning');
    
    const title = document.getElementById('calendarTitle').value;
    const date = document.getElementById('calendarDate').value;
    const time = document.getElementById('calendarTime').value;
    const location = document.getElementById('calendarLocation').value;
    const useRange = document.getElementById('calendarUseRange').checked;
    
    if (!title || !date || !time) return window.showToast('Missing required fields', 'warning');
    
    const startDateTime = new Date(`${date}T${time}`);
    let endDateTime;
    
    if (useRange) {
        const endDate = document.getElementById('calendarEndDate').value;
        const endTime = document.getElementById('calendarEndTime').value;
        if (!endDate || !endTime) return window.showToast('Please fill in end date and time for date range', 'warning');
        endDateTime = new Date(`${endDate}T${endTime}`);
        if (endDateTime <= startDateTime) return window.showToast('End date/time must be after start date/time', 'warning');
    } else {
        // Single day event - use race duration or default to same day end
        const raceDur = parseFloat(document.getElementById('raceDuration')?.value || 12);
        endDateTime = new Date(startDateTime.getTime() + raceDur * 60 * 60 * 1000);
    }
    
    const event = {
        summary: title,
        location: location,
        description: 'Race event managed by Strateger' + (useRange ? ' (Date Range)' : ''),
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
            window.showToast('✅ Event created!', 'success');
            window.closeCalendarModal();
        } else {
            throw new Error('Failed to create event');
        }
    } catch(e) {
        window.showToast('Error: ' + e.message, 'error');
    }
};

// Auto-init on load
window.addEventListener('load', () => setTimeout(window.initGoogleAuth, 1500));