// config.js
const path = require('path');

// Collect all environment variables
const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PJ_DIR: process.env.PJ_DIR || path.join(__dirname, '..'),
    MD_DIR: process.env.MD_DIR || path.join(__dirname, '../md'),
    PORT: process.env.PORT || 4000,
    AUTH_USER: process.env.AUTH_USER || 'gridranger',
    AUTH_PASS: process.env.AUTH_PASS || 'gridranger'
};

// Make configuration very visible in logs
console.log('\n' + '='.repeat(50));
console.log('[CONFIG] ENVIRONMENT CONFIGURATION');
console.log('='.repeat(50));
Object.entries(env).forEach(([key, value]) => {
    console.log(`[CONFIG] ${key.padEnd(15)} = ${value}`);
});
console.log('='.repeat(50) + '\n');

// Log derived paths
console.log('[PATHS] Derived configuration paths:');
console.log(`[PATHS] Base MD Dir    = ${env.MD_DIR}`);
console.log(`[PATHS] Images Dir     = ${path.join(env.MD_DIR, '../images')}`);
console.log(`[PATHS] Uploads Dir    = ${path.join(__dirname, '../uploads')}`);
console.log('');

const baseMarkdownDirectory = env.MD_DIR;
const getUserMarkdownDirectory = (username) => path.join(baseMarkdownDirectory, username);
const imagesDirectory = path.join(baseMarkdownDirectory, '../images');
const uploadsDirectory = path.join(__dirname, '../uploads');

// Export everything including environment info
module.exports = {
    env,
    baseMarkdownDirectory,
    getUserMarkdownDirectory,
    imagesDirectory,
    uploadsDirectory,
    port: env.PORT,
    auth: {
        username: env.AUTH_USER,
        password: env.AUTH_PASS
    }
};
