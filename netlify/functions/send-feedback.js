// ================================================================
// Render-Compatible Function: Send Feedback Email
// File: send-feedback.js (for Express/Render deployment)
// ================================================================

const nodemailer = require('nodemailer');

// Export as a regular async function for Express routes
async function sendFeedback(req, res) {
    // CORS headers
    res.set({
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    });

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).send('');
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Parse request data (Express typically auto-parses with body-parser)
        const { type, text, timestamp, role, raceTime } = req.body;

        // Validate required fields
        if (!text || !type) {
            return res.status(400).json({ 
                error: 'Missing required fields: type, text' 
            });
        }

        // Get Gmail credentials from environment
        const gmailUser = process.env.GMAIL_USER;
        const gmailPassword = process.env.GMAIL_PASSWORD;
        
        // Validate credentials exist
        if (!gmailUser || !gmailPassword) {
            console.error('Missing Gmail credentials in environment variables');
            return res.status(500).json({ 
                error: 'Email service not configured',
                details: 'Gmail credentials missing'
            });
        }
        
        const cleanUser = gmailUser.trim();
        
        // Create transporter with Render-optimized settings
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
            // Disable pooling for reliability
            pool: false,
            // TLS settings
            tls: {
                rejectUnauthorized: true,
                minVersion: 'TLSv1.2'
            },
            // Add logger for debugging (optional, remove in production)
            logger: process.env.NODE_ENV === 'development',
            debug: process.env.NODE_ENV === 'development'
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
        
        console.log('Email sent successfully:', info.messageId);

        // Close the transporter connection explicitly
        transporter.close();

        // Return success
        return res.status(200).json({ 
            success: true, 
            message: 'Feedback sent successfully!' 
        });

    } catch (error) {
        // Enhanced error logging
        console.error('Error sending feedback:', {
            message: error.message,
            code: error.code,
            command: error.command,
            name: error.name,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        
        // Provide more specific error messages
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
        return res.status(statusCode).json({ 
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            code: process.env.NODE_ENV === 'development' ? error.code : undefined
        });
    }
}

module.exports = sendFeedback;