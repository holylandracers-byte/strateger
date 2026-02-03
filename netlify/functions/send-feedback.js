// ================================================================
// Netlify Function: Send Feedback Email
// File: /netlify/functions/send-feedback.js
// ================================================================

const nodemailer = require('nodemailer');

const ALLOWED_ORIGINS = [
    'https://strateger.onrender.com',
    'http://localhost:3000'
];

/**
 * Escapes HTML characters to prevent XSS attacks when embedding user input in HTML.
 * @param {string} str - The string to escape.
 * @returns {string} - The escaped string.
 */
function escapeHtml(str) {
    if (!str) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return str.replace(/[&<>"']/g, (m) => map[m]);
}

exports.handler = async (event, context) => {
    // CORS headers
    const requestOrigin =
        (event.headers && (event.headers.origin || event.headers.Origin)) || '';
    const corsOrigin = ALLOWED_ORIGINS.includes(requestOrigin)
        ? requestOrigin
        : ALLOWED_ORIGINS[0];

    const headers = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        // Parse request data
        let parsedBody;
        try {
            parsedBody = JSON.parse(event.body);
        } catch (parseError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid JSON in request body' })
            };
        }
        const { type, text, timestamp, role, raceTime } = parsedBody;

        if (!text) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Feedback text is required' })
            };
        }

        // Get Gmail OAuth2 credentials from environment
        const gmailUser = process.env.GMAIL_USER;
        const gmailClientId = process.env.GMAIL_CLIENT_ID;
        const gmailClientSecret = process.env.GMAIL_CLIENT_SECRET;
        const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;
        
        // Validate OAuth2 credentials exist
        if (!gmailUser || !gmailClientId || !gmailClientSecret || !gmailRefreshToken) {
            console.error('Missing Gmail OAuth2 credentials in environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Email service not configured',
                    details: 'Gmail OAuth2 credentials missing'
                })
            };
        }
        
        const cleanUser = gmailUser.trim();
        
        // Sanitize user input to prevent XSS
        const sanitizedText = escapeHtml(text);
        const sanitizedRole = escapeHtml(role || 'Unknown');
        const sanitizedType = type === 'bug' ? 'Bug Report' : 'Feature Suggestion';
        const typeEmoji = type === 'bug' ? 'BUG' : 'FEATURE';

        console.log('📨 Attempting to send email via Gmail OAuth2 (Port 587)...');
        console.log('🔑 Using credentials:', {
            user: cleanUser,
            clientIdPrefix: gmailClientId.substring(0, 20) + '...',
            hasSecret: !!gmailClientSecret,
            hasToken: !!gmailRefreshToken
        });

        // Create transporter with Port 587 and STARTTLS
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                type: 'OAuth2',
                user: cleanUser,
                clientId: gmailClientId.replace(/"/g, ''),
                clientSecret: gmailClientSecret.replace(/"/g, ''),
                refreshToken: gmailRefreshToken.replace(/"/g, '')
            },
            connectionTimeout: 20000,
            socketTimeout: 20000,
            greetingTimeout: 20000,
            pool: false,
            logger: true, // Enable logging
            debug: true, // Enable debug output
            tls: {
                rejectUnauthorized: false,
                minVersion: 'TLSv1.2'
            }
        });

        // Verify connection configuration
        console.log('🔍 Verifying SMTP connection...');
        try {
            await transporter.verify();
            console.log('✅ SMTP connection verified successfully');
        } catch (verifyError) {
            console.error('❌ SMTP verification failed:', verifyError);
            throw new Error(`SMTP Connection Failed: ${verifyError.message}`);
        }

        // Format the email body
        const emailBody = `
            <h2>${typeEmoji}: ${sanitizedType}</h2>
            <p><strong>Feedback Type:</strong> ${sanitizedType}</p>
            <p><strong>Role:</strong> ${sanitizedRole}</p>
            <p><strong>Race Time:</strong> ${raceTime ? Math.floor(raceTime / 60) + ':' + String(raceTime % 60).padStart(2, '0') : 'N/A'}</p>
            <p><strong>Submitted:</strong> ${new Date(timestamp || Date.now()).toLocaleString()}</p>
            <hr />
            <div style="white-space: pre-wrap; font-family: sans-serif; background: #f4f4f4; padding: 15px; border-radius: 5px;">${sanitizedText}</div>
        `;

        const mailOptions = {
            from: `"Strateger Feedback" <${cleanUser}>`,
            to: 'holylandracers@gmail.com',
            subject: `[Strateger] ${sanitizedType}: ${sanitizedText.substring(0, 50)}${sanitizedText.length > 50 ? '...' : ''}`,
            html: emailBody,
            text: `Type: ${sanitizedType}\nRole: ${sanitizedRole}\nTime: ${raceTime}\n\nMessage:\n${text}`
        };

        const sendWithTimeout = (timeout = 10000) => {
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    timeoutId = null;
                    reject(new Error('Email send timeout'));
                }, timeout);
            });

            const sendPromise = transporter.sendMail(mailOptions).finally(() => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
            });

            return Promise.race([sendPromise, timeoutPromise]);
        };

        const info = await sendWithTimeout();
        console.log('✅ Email sent successfully:', info.messageId);
        transporter.close();

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'Feedback sent successfully!' 
            })
        };
    } catch (error) {
        // Enhanced error logging for debugging
        console.error('❌ Error sending feedback:', {
            message: error.message,
            code: error.code,
            command: error.command,
            name: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        
        // Provide specific error messages
        let errorMessage = 'Failed to send feedback';
        let statusCode = 500;
        
        if (error.message === 'Email send timeout') {
            errorMessage = 'Request timed out. Please try again.';
            statusCode = 504;
        } else if (error.code === 'EAUTH') {
            errorMessage = 'Email authentication failed. Please check Gmail credentials.';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
            errorMessage = 'Connection timeout. Please try again.';
            statusCode = 504;
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'Unable to connect to email server.';
        } else if (error.name === 'AbortError') {
            errorMessage = 'Request was cancelled. Please try again.';
            statusCode = 408;
        }
        
        // Return error to client
        return {
            statusCode,
            headers,
            body: JSON.stringify({ 
                error: errorMessage,
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                code: process.env.NODE_ENV === 'development' ? error.code : undefined
            })
        };
    }
};