// ==========================================
// 🎟️ VERIFY COUPON CODE (Public endpoint)
// ==========================================
// POST { code }
// Returns: { valid, discount, message }
// If 100% discount: also generates + returns a license key

const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

function generateLicenseKey() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
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
        return { statusCode: 405, headers, body: JSON.stringify({ valid: false, message: 'Method not allowed' }) };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const code = (body.code || '').trim().toUpperCase();

        if (!code || code.length < 3) {
            return { statusCode: 200, headers, body: JSON.stringify({ valid: false, message: 'Invalid coupon code' }) };
        }

        const sql = neon(process.env.NETLIFY_DATABASE_URL);

        // Ensure tables exist
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

        // Look up the coupon
        const rows = await sql`
            SELECT * FROM pro_coupons WHERE code = ${code}
        `;

        if (rows.length === 0) {
            return { statusCode: 200, headers, body: JSON.stringify({ valid: false, message: 'Coupon code not found' }) };
        }

        const coupon = rows[0];

        if (!coupon.is_active) {
            return { statusCode: 200, headers, body: JSON.stringify({ valid: false, message: 'This coupon has been deactivated' }) };
        }

        // Check expiration
        if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
            return { statusCode: 200, headers, body: JSON.stringify({ valid: false, message: 'This coupon has expired' }) };
        }

        // Check max uses
        if (coupon.max_uses !== null && coupon.current_uses >= coupon.max_uses) {
            return { statusCode: 200, headers, body: JSON.stringify({ valid: false, message: 'This coupon has been fully redeemed' }) };
        }

        // Coupon is valid!
        const discount = coupon.discount_percent;
        const originalPrice = 19;
        const discountedPrice = Math.round(originalPrice * (1 - discount / 100) * 100) / 100;

        // If 100% discount: generate a free license key and activate it
        if (discount === 100) {
            // Create license table if needed
            await sql`
                CREATE TABLE IF NOT EXISTS pro_licenses (
                    id SERIAL PRIMARY KEY,
                    license_key VARCHAR(64) UNIQUE NOT NULL,
                    customer_email VARCHAR(255),
                    customer_name VARCHAR(255),
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    activated_at TIMESTAMPTZ DEFAULT NOW(),
                    is_active BOOLEAN DEFAULT true,
                    notes TEXT
                )
            `;

            // Generate key
            let key;
            let attempts = 0;
            while (attempts < 5) {
                key = generateLicenseKey();
                try {
                    await sql`
                        INSERT INTO pro_licenses (license_key, customer_email, notes, activated_at)
                        VALUES (${key}, ${null}, ${'Free via coupon: ' + code}, NOW())
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

            // Increment coupon usage
            await sql`UPDATE pro_coupons SET current_uses = current_uses + 1 WHERE id = ${coupon.id}`;

            console.log(`🎟️ 100% coupon ${code} redeemed → free key ${key?.substring(0, 10)}...`);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    valid: true,
                    discount: 100,
                    freeKey: key,
                    message: 'Coupon applied — Pro activated for free!'
                })
            };
        }

        // Partial discount: increment usage and return discount info
        await sql`UPDATE pro_coupons SET current_uses = current_uses + 1 WHERE id = ${coupon.id}`;

        console.log(`🎟️ Coupon ${code} applied: ${discount}% off ($${discountedPrice})`);
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                valid: true,
                discount: discount,
                originalPrice,
                discountedPrice,
                message: `${discount}% off — pay $${discountedPrice} instead of $${originalPrice}`
            })
        };
    } catch (err) {
        console.error('Coupon verification error:', err);
        return { statusCode: 500, headers, body: JSON.stringify({ valid: false, message: 'Server error' }) };
    }
};
