// ==========================================
// 🎟️ ADMIN: MANAGE COUPON CODES
// ==========================================
// GET  ?secret=xxx            → list all coupons
// POST { secret, action:'create', code?, discount, maxUses?, expiresAt?, notes? }
// POST { secret, action:'deactivate', id }
// POST { secret, action:'activate', id }
// POST { secret, action:'delete', id }

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

function generateCouponCode() {
    // Format: SAVE-XXXX (short & memorable)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars[crypto.randomInt(chars.length)];
    }
    return 'SAVE-' + code;
}

async function ensureTable(sql) {
    await sql`
        CREATE TABLE IF NOT EXISTS pro_coupons (
            id SERIAL PRIMARY KEY,
            code VARCHAR(32) UNIQUE NOT NULL,
            discount_percent INTEGER NOT NULL CHECK (discount_percent >= 1 AND discount_percent <= 100),
            max_uses INTEGER DEFAULT NULL,
            current_uses INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT true,
            expires_at TIMESTAMPTZ DEFAULT NULL,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `;
}

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

    // --- GET: List all coupons ---
    if (event.httpMethod === 'GET') {
        const secret = event.queryStringParameters?.secret;
        if (!adminSecret || secret !== adminSecret) {
            return { statusCode: 403, headers, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
        }

        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        await ensureTable(sql);

        const coupons = await sql`SELECT * FROM pro_coupons ORDER BY created_at DESC`;
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true, coupons })
        };
    }

    // --- POST: Create / Toggle / Delete ---
    if (event.httpMethod === 'POST') {
        const body = JSON.parse(event.body || '{}');
        const { secret, action } = body;

        if (!adminSecret || secret !== adminSecret) {
            return { statusCode: 403, headers, body: JSON.stringify({ success: false, message: 'Unauthorized' }) };
        }

        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        await ensureTable(sql);

        if (action === 'create') {
            const { code: customCode, discount, maxUses, expiresAt, notes } = body;
            const discountPercent = parseInt(discount);
            if (!discountPercent || discountPercent < 1 || discountPercent > 100) {
                return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Discount must be 1-100%' }) };
            }

            const code = (customCode && customCode.trim()) ? customCode.trim().toUpperCase() : generateCouponCode();
            const maxUsesVal = maxUses ? parseInt(maxUses) : null;
            const expiresVal = expiresAt || null;

            try {
                await sql`
                    INSERT INTO pro_coupons (code, discount_percent, max_uses, expires_at, notes)
                    VALUES (${code}, ${discountPercent}, ${maxUsesVal}, ${expiresVal}, ${notes || null})
                `;
                console.log(`🎟️ Coupon created: ${code} (${discountPercent}% off)`);
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, code, discount: discountPercent })
                };
            } catch (e) {
                if (e.message?.includes('unique') || e.message?.includes('duplicate')) {
                    return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Coupon code already exists' }) };
                }
                throw e;
            }
        }

        if (action === 'deactivate' || action === 'activate') {
            const isActive = action === 'activate';
            await sql`UPDATE pro_coupons SET is_active = ${isActive} WHERE id = ${body.id}`;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        if (action === 'delete') {
            await sql`DELETE FROM pro_coupons WHERE id = ${body.id}`;
            return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
        }

        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: 'Unknown action' }) };
    }

    return { statusCode: 405, headers, body: JSON.stringify({ success: false, message: 'Method not allowed' }) };
};
