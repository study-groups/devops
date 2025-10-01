// config.js - Basic server configuration
import path from 'path';
import { fileURLToPath } from 'url';

// Derive __dirname in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Basic Configuration Values ---
export const port = process.env.PORT || 4000;
export const nodeEnv = process.env.NODE_ENV || 'development';
export const serverDir = __dirname;
export const rootDir = path.resolve(__dirname, '..');

// TEMPORARY: Add these back for backward compatibility
export const uploadsDirectory = process.env.PD_UPLOADS || 
                              (process.env.PD_DIR ? path.join(process.env.PD_DIR, 'uploads') : 
                              path.join(rootDir, 'uploads'));

export const imagesDirectory = process.env.PD_IMAGES || 
                              (process.env.PD_DIR ? path.join(process.env.PD_DIR, 'images') : 
                              path.join(rootDir, 'images'));

// TEMPORARY: Add env object for backward compatibility
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 4000,
  PD_DIR: process.env.PD_DIR,
};

// Log basic configuration
console.log('==================================================');
console.log('[CONFIG] ENVIRONMENT CONFIGURATION');
console.log('==================================================');
console.log(`[CONFIG] NODE_ENV        = ${nodeEnv}`);
console.log(`[CONFIG] PORT            = ${port}`);
console.log(`[CONFIG] PD_DIR          = ${process.env.PD_DIR || '(not set)'}`);
console.log('==================================================');
