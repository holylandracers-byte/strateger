const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const data = JSON.parse(event.body);
        
        if (!data.name || !data.config || !data.timeline) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: 'Missing required fields: name, config, timeline' })
            };
        }
        
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        // Create table if not exists
        await sql`
            CREATE TABLE IF NOT EXISTS strategies (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                race_duration_ms BIGINT,
                required_stops INTEGER,
                drivers JSONB,
                timeline JSONB,
                driver_schedule JSONB,
                config JSONB,
                created_at TIMESTAMP DEFAULT NOW(),
                user_id VARCHAR(255)
            )
        `;
        
        const result = await sql`
            INSERT INTO strategies (
                name, race_duration_ms, required_stops, drivers,
                timeline, driver_schedule, config, user_id
            ) VALUES (
                ${data.name},
                ${data.config.raceMs},
                ${data.config.reqStops},
                ${JSON.stringify(data.drivers)},
                ${JSON.stringify(data.timeline)},
                ${JSON.stringify(data.driverSchedule)},
                ${JSON.stringify(data.config)},
                ${data.userId || 'anonymous'}
            )
            RETURNING id, name, created_at
        `;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                strategyId: result[0].id,
                name: result[0].name,
                createdAt: result[0].created_at
            })
        };
        
    } catch (error) {
        console.error('Error saving strategy:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};