// ==========================================
// 🔑 ADMIN: LIST / MANAGE PRO LICENSES
// ==========================================
// Protected by ADMIN_SECRET env var.
// GET ?secret=...            → list all licenses
// POST { secret, id, action } → deactivate/reactivate a license

const { neon } = require('@neondatabase/serverless');

exports.handler = async (event) => {
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const adminSecret = process.env.ADMIN_SECRET;

    // === GET: List all licenses ===
    if (event.httpMethod === 'GET') {
        const secret = (event.queryStringParameters || {}).secret;
        if (!adminSecret || secret !== adminSecret) {
            return { statusCode: 403, headers, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
        }

        try {
            const sql = neon(process.env.NETLIFY_DATABASE_URL);

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

            const rows = await sql`
                SELECT id, license_key, customer_email, customer_name, created_at, activated_at, is_active, notes
                FROM pro_licenses
                ORDER BY created_at DESC
            `;

            return { statusCode: 200, headers, body: JSON.stringify({ success: true, licenses: rows }) };
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: err.message }) };
        }
    }

    // === POST: Toggle active status ===
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { secret, id, action } = body;

            if (!adminSecret || secret !== adminSecret) {
                return { statusCode: 403, headers, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
            }

            const sql = neon(process.env.NETLIFY_DATABASE_URL);

            if (action === 'deactivate') {
                await sql`UPDATE pro_licenses SET is_active = false WHERE id = ${id}`;
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'License deactivated' }) };
            } else if (action === 'activate') {
                await sql`UPDATE pro_licenses SET is_active = true WHERE id = ${id}`;
                return { statusCode: 200, headers, body: JSON.stringify({ success: true, message: 'License activated' }) };
            } else {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Unknown action' }) };
            }
        } catch (err) {
            return { statusCode: 500, headers, body: JSON.stringify({ success: false, message: err.message }) };
        }
    }

    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
};
