// Detects whether running as native Capacitor app or in browser
const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

window.APP_CONFIG = {
    IS_NATIVE: IS_NATIVE,
    API_BASE: IS_NATIVE
        ? 'https://strateger.onrender.com'  // Native app always hits your real server
        : '',                               // Browser uses relative paths (Netlify)
    GOOGLE_CLIENT_ID: '656730854589-b30koq0rm67abjanisu7ss8pqjpavlip.apps.googleusercontent.com'
};
