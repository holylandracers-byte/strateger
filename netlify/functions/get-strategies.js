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
        const deviceId = event.queryStringParameters?.deviceId || '';
        
        // Get public strategies OR private strategies matching device ID
        let strategies;
        if (deviceId) {
            strategies = await sql`
                SELECT id, name, race_duration_ms, required_stops, 
                    drivers, timeline, driver_schedule, config, created_at, is_public, device_id
                FROM strategies 
                WHERE is_public = true 
                OR device_id = ${deviceId}
                ORDER BY created_at DESC 
                LIMIT 50
            `;
        } else {
            strategies = await sql`
                SELECT id, name, race_duration_ms, required_stops, 
                    drivers, timeline, driver_schedule, config, created_at, is_public, device_id
                FROM strategies 
                WHERE is_public = true
                ORDER BY created_at DESC 
                LIMIT 50
            `;
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                strategies: strategies.map(s => ({
                    id: s.id,
                    name: s.name,
                    race_duration_ms: s.race_duration_ms,
                    required_stops: s.required_stops,
                    drivers: s.drivers,
                    timeline: s.timeline,
                    driver_schedule: s.driver_schedule,
                    config: s.config,
                    created_at: s.created_at,
                    is_public: s.is_public,
                    device_id: s.device_id
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