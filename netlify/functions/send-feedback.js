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
        
        // Log credential status (without exposing actual values)
        console.log('Gmail credentials check:', {
            userExists: !!gmailUser,
            passwordExists: !!gmailPassword,
            passwordHasQuotes: gmailPassword ? /^["'].*["']$/.test(gmailPassword) : false,
            passwordHasSpaces: gmailPassword ? /\s/.test(gmailPassword) : false
        });
        
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
        // Clean credentials: remove spaces, quotes, and any surrounding whitespace
        // This handles cases where env vars are stored as "value" or " value "
        const cleanUser = gmailUser
            .trim()                        // Remove leading/trailing whitespace
            .replace(/^["']|["']$/g, '')   // Remove leading/trailing quotes
            .replace(/\s/g, '');           // Remove any remaining spaces
        
        const cleanPassword = gmailPassword
            .trim()                        // Remove leading/trailing whitespace
            .replace(/^["']|["']$/g, '')   // Remove leading/trailing quotes
            .replace(/\s/g, '');           // Remove any remaining spaces
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: cleanUser,
                pass: cleanPassword
            },
            connectionTimeout: 15000,  // Increased timeout for Render
            socketTimeout: 15000,      // Increased timeout for Render
            greetingTimeout: 10000,    // Add greeting timeout
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

        // Verify transporter connection before sending
        // This helps catch authentication errors early
        try {
            await transporter.verify();
            console.log('Email transporter verified successfully');
        } catch (verifyError) {
            console.error('Email transporter verification failed:', verifyError.message);
            throw new Error(`Email authentication failed: ${verifyError.message}`);
        }

        // Send email
        const mailOptions = {
            from: cleanUser,
            to: 'holylandracers@gmail.com',
            subject: `[Strateger ${type === 'bug' ? 'BUG' : 'FEATURE'}] ${new Date().toLocaleString()}`,
            html: emailBody,
            replyTo: cleanUser
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
        // Enhanced error logging for debugging on Render
        console.error('Error sending feedback:', {
            message: error.message,
            code: error.code,
            command: error.command,
            response: error.response,
            responseCode: error.responseCode,
            // Only log stack trace in development
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
        
        // Provide more specific error messages
        let errorMessage = 'Failed to send feedback';
        if (error.code === 'EAUTH') {
            errorMessage = 'Email authentication failed. Please check Gmail credentials.';
        } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKET') {
            errorMessage = 'Connection timeout. Please try again.';
        } else if (error.code === 'ECONNECTION') {
            errorMessage = 'Unable to connect to email server.';
        }
        
        // Return generic error to client, keep details in server logs only
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: errorMessage,
                // Only include technical details in development mode
                details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                code: process.env.NODE_ENV === 'development' ? error.code : undefined
            })
        };
    }
};
