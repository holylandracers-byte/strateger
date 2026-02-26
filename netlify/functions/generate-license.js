// ==========================================
// 🔑 ADMIN: GENERATE PRO LICENSE KEY
// ==========================================
// Protected by ADMIN_SECRET env var.
// Usage: POST with { secret, email, name, notes }
// Returns: { success, key }

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

function generateKey() {
    // Format: STRAT-XXXX-XXXX-XXXX-XXXX (25 chars)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
    const segments = [];
    for (let s = 0; s < 4; s++) {
        let seg = '';
        for (let i = 0; i < 4; i++) {
            seg += chars[crypto.randomInt(chars.length)];
        }
        segments.push(seg);
    }
    return 'STRAT-' + segments.join('-');
}

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const { secret, email, name, notes } = body;

        // Admin auth check
        const adminSecret = process.env.ADMIN_SECRET;
        if (!adminSecret || secret !== adminSecret) {
            return { statusCode: 403, headers, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
        }

        const sql = neon(process.env.NETLIFY_DATABASE_URL);

        // Ensure table exists
        await sql`
            CREATE TABLE IF NOT EXISTS pro_licenses (
                id SERIAL PRIMARY KEY,
                license_key VARCHAR(64) UNIQUE NOT NULL,
                customer_email VARCHAR(255),
                customer_name VARCHAR(255),
                created_at TIMESTAMPTZ DEFAULT NOW(),
                activated_at TIMESTAMPTZ,
                is_active BOOLEAN DEFAULT true,
                notes TEXT
            )
        `;

        // Generate unique key (retry if collision)
        let key;
        let attempts = 0;
        while (attempts < 5) {
            key = generateKey();
            try {
                await sql`
                    INSERT INTO pro_licenses (license_key, customer_email, customer_name, notes)
                    VALUES (${key}, ${email || null}, ${name || null}, ${notes || null})
                `;
                break;
            } catch (e) {
                if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
                    attempts++;
                    continue;
                }
                throw e;
            }
        }

        console.log(`🔑 New Pro license generated: ${key} for ${email || 'no email'}`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, key, email: email || null, name: name || null })
        };

    } catch (err) {
        console.error('Generate license error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: 'Server error: ' + err.message }) };
    }
};
