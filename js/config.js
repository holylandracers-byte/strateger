// Detects whether running as native Capacitor app or in browser
const IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const IS_RENDER = location.hostname.includes('onrender.com');

window.APP_CONFIG = {
    IS_NATIVE: IS_NATIVE,
    API_BASE: IS_RENDER
        ? ''                                 // On Render itself → relative paths
        : 'https://strateger.onrender.com',  // Native app + local dev → Render
    GOOGLE_CLIENT_ID: '656730854589-b30koq0rm67abjanisu7ss8pqjpavlip.apps.googleusercontent.com'
};
