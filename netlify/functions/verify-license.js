// ==========================================
// 🔑 PRO LICENSE VERIFICATION (Database-backed)
// ==========================================
// Validates license keys against the pro_licenses table in Neon DB.
// Keys are generated via the admin generate-license endpoint.

const { neon } = require('@neondatabase/serverless');

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
        return { statusCode: 405, headers, body: JSON.stringify({ valid: false, message: 'Method not allowed' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const key = (body.key || '').trim();

        if (!key) {
            return { statusCode: 400, headers, body: JSON.stringify({ valid: false, message: 'No license key provided' }) };
        }

        if (!key.startsWith('STRAT-') || key.length < 16) {
            return { statusCode: 200, headers, body: JSON.stringify({ valid: false, message: 'Invalid license key format' }) };
        }

        const sql = neon(process.env.NETLIFY_DATABASE_URL);

        // Create table if it doesn't exist yet
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

        // Look up the key
        const rows = await sql`
            SELECT id, license_key, is_active, customer_email, activated_at
            FROM pro_licenses
            WHERE license_key = ${key}
        `;

        if (rows.length === 0) {
            console.log(`❌ License key not found: ${key.substring(0, 10)}...`);
            return { statusCode: 200, headers, body: JSON.stringify({ valid: false, message: 'Invalid license key' }) };
        }

        const license = rows[0];

        if (!license.is_active) {
            console.log(`⛔ Deactivated license used: ${key.substring(0, 10)}...`);
            return { statusCode: 200, headers, body: JSON.stringify({ valid: false, message: 'This license has been deactivated' }) };
        }

        // Mark first activation timestamp
        if (!license.activated_at) {
            await sql`UPDATE pro_licenses SET activated_at = NOW() WHERE id = ${license.id}`;
        }

        console.log(`✅ Pro license verified: ${key.substring(0, 10)}... (${license.customer_email || 'no email'})`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ valid: true, message: '⭐ Pro license verified!' })
        };

    } catch (err) {
        console.error('License verification error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ valid: false, message: 'Server error during verification' }) };
    }
};
