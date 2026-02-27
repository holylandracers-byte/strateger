/**
 * Netlify Serverless CORS Proxy
 * Replaces unreliable third-party CORS proxies (corsproxy.io, allorigins.win)
 * Used by RaceFacer and Apex Timing scrapers
 */

const https = require('https');
const http = require('http');

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    // Get target URL from query parameter
    const targetUrl = event.queryStringParameters && event.queryStringParameters.url;

    if (!targetUrl) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing "url" query parameter' })
        };
    }

    // Validate URL - only allow known racing timing domains
    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (e) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Invalid URL' })
        };
    }

    const allowedDomains = [
        'live.racefacer.com',
        'racefacer.com',
        'www.apex-timing.com',
        'apex-timing.com'
    ];

    // Allow any apex-timing subdomain
    const isAllowed = allowedDomains.some(domain => parsedUrl.hostname === domain) ||
                      parsedUrl.hostname.endsWith('.apex-timing.com') ||
                      parsedUrl.hostname.endsWith('.racefacer.com');

    if (!isAllowed) {
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Domain not allowed', hostname: parsedUrl.hostname })
        };
    }

    try {
        const responseData = await new Promise((resolve, reject) => {
            const protocol = parsedUrl.protocol === 'https:' ? https : http;
            
            const req = protocol.get(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'application/json, text/html, */*'
                },
                timeout: 15000
            }, (res) => {
                // Handle redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, targetUrl).toString();
                    const redirectReq = protocol.get(redirectUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                            'Accept': 'application/json, text/html, */*'
                        },
                        timeout: 15000
                    }, (redirectRes) => {
                        let data = '';
                        redirectRes.on('data', chunk => data += chunk);
                        redirectRes.on('end', () => resolve({
                            statusCode: redirectRes.statusCode,
                            contentType: redirectRes.headers['content-type'] || 'text/plain',
                            body: data
                        }));
                    });
                    redirectReq.on('error', reject);
                    redirectReq.on('timeout', () => { redirectReq.destroy(); reject(new Error('Redirect timeout')); });
                    return;
                }

                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({
                    statusCode: res.statusCode,
                    contentType: res.headers['content-type'] || 'text/plain',
                    body: data
                }));
            });

            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        });

        // Return the proxied response with CORS headers
        const responseHeaders = {
            ...headers,
            'Content-Type': responseData.contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        };

        return {
            statusCode: responseData.statusCode,
            headers: responseHeaders,
            body: responseData.body
        };

    } catch (error) {
        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({ error: 'Proxy request failed', message: error.message })
        };
    }
};
