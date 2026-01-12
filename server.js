// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// אפשר בקשות מכל מקום (חשוב ל-CORS)
app.use(cors());

// פענוח JSON (חשוב לבקשות POST)
app.use(bodyParser.json());

// הגדרת תיקיית הקבצים הסטטיים (כדי שה-HTML וה-JS יעבדו)
app.use(express.static(path.join(__dirname, '/'))); 
// הוספנו גם את תיקיית ה-js ספציפית ליתר ביטחון
app.use('/js', express.static(path.join(__dirname, 'js')));

// --- הלב של המערכת: Netlify Function Adapter ---
// הפונקציה הזו "עוטפת" את הפונקציות של Netlify כדי שיעבדו ב-Express
const netlifyFunctionWrapper = (functionName) => async (req, res) => {
    try {
        // טוען את הקובץ מתיקיית netlify/functions המקורית
        const modulePath = path.join(__dirname, 'netlify', 'functions', `${functionName}.js`);
        const { handler } = require(modulePath);

        // מדמה את אובייקט ה-Event של Netlify
        const event = {
            httpMethod: req.method,
            body: JSON.stringify(req.body || {}), // Netlify מצפה ל-Body כ-String
            queryStringParameters: req.query || {},
            headers: req.headers
        };

        const context = {}; // Mock context

        console.log(`⚡ Executing function: ${functionName}`);
        
        // הרצת הפונקציה המקורית
        const result = await handler(event, context);

        // המרת התשובה חזרה ל-Express
        res.status(result.statusCode || 200)
           .set(result.headers || {})
           .send(result.body);

    } catch (error) {
        console.error(`❌ Error in ${functionName}:`, error);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// --- הגדרת הנתיבים (Routes) ---
// אלו בדיוק אותם נתיבים שה-Frontend שלך מחפש
app.all('/.netlify/functions/ai-strategy', netlifyFunctionWrapper('ai-strategy'));
app.all('/.netlify/functions/save-race', netlifyFunctionWrapper('save-race'));
app.all('/.netlify/functions/save-strategy', netlifyFunctionWrapper('save-strategy'));
app.all('/.netlify/functions/load-strategies', netlifyFunctionWrapper('load-strategies'));
app.all('/.netlify/functions/get-strategies', netlifyFunctionWrapper('get-strategies'));

// נתיב ראשי - מגיש את ה-HTML
app.get('*', (req, res) => {
    // אם זו לא פניה ל-API, נחזיר את ה-HTML (חשוב ל-Single Page Apps או סתם כברירת מחדל)
    if (!req.path.startsWith('/.netlify/functions')) {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// התנעת השרת
app.listen(PORT, () => {
    console.log(`
🏎️  Strateger Server Running!
-------------------------------------
🌍 Local:   http://localhost:${PORT}
⚡ Backend: Adapting Netlify Functions
-------------------------------------
    `);
});