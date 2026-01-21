// ================================================================
// Netlify Function: Send Feedback Email
// File: /netlify/functions/send-feedback.js
// ================================================================

const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
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
        const { type, text, timestamp, role, raceTime } = JSON.parse(event.body);

        // Validate required fields
        if (!text || !type) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Missing required fields: type, text' })
            };
        }

        // Get Gmail credentials from environment
        const gmailUser = process.env.GMAIL_USER;
        const gmailPassword = process.env.GMAIL_PASSWORD;
        
        // Validate credentials exist
        if (!gmailUser || !gmailPassword) {
            console.error('Missing Gmail credentials in environment variables');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Email service not configured',
                    details: 'Gmail credentials missing'
                })
            };
        }

        // Create email transporter using Gmail
        // Remove spaces from app password (Gmail sometimes adds them)
        const cleanPassword = gmailPassword.replace(/\s/g, '');
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: gmailUser,
                pass: cleanPassword
            },
            connectionTimeout: 10000,
            socketTimeout: 10000,
            pool: {
                maxConnections: 1,
                maxMessages: 5
            }
        });

        // Format the email body
        const emailBody = `
<h2>${type === 'bug' ? '🐛 Bug Report' : '💡 Feature Suggestion'}</h2>

<p><strong>Feedback Type:</strong> ${type === 'bug' ? 'Bug Report' : 'Feature Suggestion'}</p>
<p><strong>Role:</strong> ${role || 'Unknown'}</p>
<p><strong>Race Time:</strong> ${raceTime ? `${Math.floor(raceTime / 60)}:${String(raceTime % 60).padStart(2, '0')}` : 'N/A'}</p>
<p><strong>Submitted:</strong> ${new Date(timestamp).toLocaleString()}</p>

<hr />

<h3>Message:</h3>
<p>${text.replace(/\n/g, '<br>')}</p>
`;

        // Send email
        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: 'holylandracers@gmail.com',
            subject: `[Strateger ${type === 'bug' ? 'BUG' : 'FEATURE'}] ${new Date().toLocaleString()}`,
            html: emailBody,
            replyTo: process.env.GMAIL_USER
        };

        await transporter.sendMail(mailOptions);

        // Return success
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true, 
                message: 'Feedback sent successfully!' 
            })
        };

    } catch (error) {
        console.error('Error sending feedback:', {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response
        });
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Failed to send feedback',
                details: error.message,
                code: error.code
            })
        };
    }
};
