// ================================================================
// Netlify Function: Send Feedback Email
// File: /netlify/functions/send-feedback.js
// ================================================================

const { Resend } = require('resend');

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

        // Get Resend API key from environment
        const resendApiKey = process.env.RESEND_API_KEY;
        
        if (!resendApiKey) {
            console.error('Missing RESEND_API_KEY in environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Email service not configured',
                    details: 'Resend API key missing'
                })
            };
        }
        
        // Sanitize user input to prevent XSS
        const sanitizedText = escapeHtml(text);
        const sanitizedRole = escapeHtml(role || 'Unknown');
        const sanitizedType = type === 'bug' ? 'Bug Report' : 'Feature Suggestion';
        const typeEmoji = type === 'bug' ? '🐛' : '💡';

        console.log('📨 Sending email via Resend API...');

        const resend = new Resend(resendApiKey);

        // Format the email body
        const emailBody = `
            <h2>${typeEmoji} ${sanitizedType}</h2>
            <p><strong>Feedback Type:</strong> ${sanitizedType}</p>
            <p><strong>Role:</strong> ${sanitizedRole}</p>
            <p><strong>Race Time:</strong> ${raceTime ? Math.floor(raceTime / 60) + ':' + String(raceTime % 60).padStart(2, '0') : 'N/A'}</p>
            <p><strong>Submitted:</strong> ${new Date(timestamp || Date.now()).toLocaleString()}</p>
            <hr />
            <div style="white-space: pre-wrap; font-family: sans-serif; background: #f4f4f4; padding: 15px; border-radius: 5px;">${sanitizedText}</div>
        `;

        const { data, error } = await resend.emails.send({
            from: 'Strateger Feedback <onboarding@resend.dev>',
            to: ['holylandracers@gmail.com'],
            subject: `[Strateger] ${sanitizedType}: ${sanitizedText.substring(0, 50)}${sanitizedText.length > 50 ? '...' : ''}`,
            html: emailBody
        });

        if (error) {
            console.error('❌ Resend API error:', error);
            throw error;
        }

        console.log('✅ Email sent successfully via Resend:', data.id);

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