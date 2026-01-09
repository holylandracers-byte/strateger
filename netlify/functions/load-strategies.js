const { neon } = require('@neondatabase/serverless');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    const id = event.queryStringParameters?.id;
    
    if (!id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing strategy ID' }) };
    }

    try {
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        const result = await sql`
            SELECT * FROM strategies WHERE id = ${id}
        `;
        
        if (result.length === 0) {
            return { statusCode: 404, headers, body: JSON.stringify({ error: 'Strategy not found' }) };
        }
        
        const s = result[0];
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                strategy: {
                    id: s.id,
                    name: s.name,
                    config: s.config,
                    drivers: s.drivers,
                    timeline: s.timeline,
                    driverSchedule: s.driver_schedule,
                    createdAt: s.created_at
                }
            })
        };
        
    } catch (error) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
};