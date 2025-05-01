// config.js
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Collect all environment variables
const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    // Use the derived __dirname
    PJ_DIR: process.env.PJ_DIR || path.join(__dirname, '..'),
    MD_DIR: process.env.MD_DIR || path.join(__dirname, '../md'),
    PD_DIR: process.env.PD_DIR || path.join(__dirname, '../pd'),
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
// Use the derived __dirname
console.log(`[PATHS] Images Dir     = ${path.join(env.MD_DIR, '../images')}`); // Assuming images relative to MD_DIR
console.log(`[PATHS] Uploads Dir    = ${path.join(__dirname, '../uploads')}`);
console.log('');

const baseMarkdownDirectory = env.MD_DIR;
const getUserMarkdownDirectory = (username) => path.join(baseMarkdownDirectory, username);
// Use the derived __dirname - CHECK if images path is correct assumption
const imagesDirectory = path.join(env.MD_DIR, '../images'); // Assuming images relative to MD_DIR
const uploadsDirectory = path.join(__dirname, '../uploads');

// Export using named exports
export {
    env,
    baseMarkdownDirectory,
    getUserMarkdownDirectory,
    imagesDirectory,
    uploadsDirectory
};

// Export specific aliases or structures separately if needed
export const configEnv = env;
export const port = env.PORT;
export const auth = {
    username: env.AUTH_USER,
    password: env.AUTH_PASS
};
