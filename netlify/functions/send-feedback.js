// ================================================================
// Netlify Function: Send Feedback Email
// File: /netlify/functions/send-feedback.js
// Updated for Render compatibility
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
        
        const cleanUser = gmailUser.trim();
        
        // Create transporter with Render-optimized settings
        // KEY CHANGES: Disabled pooling and reduced timeouts to prevent AbortError
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: cleanUser,
                pass: gmailPassword
            },
            // Optimized timeouts for Render
            connectionTimeout: 10000,
            socketTimeout: 10000,
            greetingTimeout: 5000,
            // CRITICAL: Disable pooling to prevent AbortError
            pool: false,
            // TLS settings for security
            tls: {
                rejectUnauthorized: true,
                minVersion: 'TLSv1.2'
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

        // Prepare mail options
        const mailOptions = {
            from: cleanUser,
            to: 'holylandracers@gmail.com',
            subject: `[Strateger ${type === 'bug' ? 'BUG' : 'FEATURE'}] ${new Date().toLocaleString()}`,
            html: emailBody,
            replyTo: cleanUser
        };

        // Send email with timeout wrapper to prevent hanging
        const sendWithTimeout = (timeout = 25000) => {
            return Promise.race([
                transporter.sendMail(mailOptions),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Email send timeout')), timeout)
                )
            ]);
        };

        const info = await sendWithTimeout();
        
        console.log('✅ Email sent successfully:', info.messageId);

        // CRITICAL: Close the transporter to prevent hanging connections
        transporter.close();

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