// ================================================================
// Netlify Function: Save Race to Neon DB
// File: /netlify/functions/save-race.js
// ================================================================

const { neon } = require('@neondatabase/serverless');

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
        const data = JSON.parse(event.body);
        
        // Validate required fields
        if (!data.raceDuration || !data.drivers || !data.config) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Missing required fields' 
                })
            };
        }
        
        // Connect to Neon DB
        const sql = neon(process.env.NETLIFY_DATABASE_URL);
        
        // Insert race data
        const result = await sql`
            INSERT INTO races (
                race_date,
                race_duration_ms,
                total_stints,
                total_pit_stops,
                drivers,
                strategy_data,
                config,
                created_at
            ) VALUES (
                NOW(),
                ${data.raceDuration},
                ${data.totalStints || 0},
                ${data.totalPitStops || 0},
                ${JSON.stringify(data.drivers)},
                ${JSON.stringify(data.strategyData || {})},
                ${JSON.stringify(data.config)},
                NOW()
            )
            RETURNING id, race_date
        `;
        
        console.log('✅ Race saved successfully:', result[0].id);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                raceId: result[0].id,
                raceDate: result[0].race_date,
                message: 'Race saved successfully'
            })
        };
        
    } catch (error) {
        console.error('❌ Error saving race:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                details: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
