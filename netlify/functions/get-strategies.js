const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    if (event.httpMethod !== 'GET') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        const strategies = await sql`
            SELECT id, name, race_duration_ms, required_stops, 
                   drivers, config, created_at
            FROM strategies 
            ORDER BY created_at DESC 
            LIMIT 20
        `;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                strategies: strategies.map(s => ({
                    id: s.id,
                    name: s.name,
                    raceDuration: s.race_duration_ms,
                    requiredStops: s.required_stops,
                    drivers: s.drivers,
                    config: s.config,
                    createdAt: s.created_at
                }))
            })
        };
        
    } catch (error) {
        console.error('Error fetching strategies:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ success: false, error: error.message })
        };
    }
};