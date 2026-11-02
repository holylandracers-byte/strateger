const IS_RENDER = location.hostname.includes('onrender.com');

window.APP_CONFIG = {
    API_BASE: IS_RENDER
        ? ''                                 // On Render itself → relative paths
        : 'https://strateger.onrender.com',  // Local dev → Render
    GOOGLE_CLIENT_ID: '656730854589-b30koq0rm67abjanisu7ss8pqjpavlip.apps.googleusercontent.com'
};
