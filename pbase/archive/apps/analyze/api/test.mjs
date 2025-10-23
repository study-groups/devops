import { fileURLToPath } from 'url';
import path from 'path';

// Get the current file's directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the PORT environment variable or default to 5000
const PORT = process.env.PORT || 5000;

// Log the application path and port
console.log(`Application path: ${__dirname}`);
console.log(`Server listening on port: ${PORT}`);