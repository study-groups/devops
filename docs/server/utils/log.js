const fs = require('fs');
const path = require('path');

// Determine the log file path (adjust as needed)
const LOG_FILE = path.join(__dirname, '../../logs/server.log'); // Go up two levels to the project root, then into a logs directory

// Ensure the logs directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    // Log to console
    console.log(logEntry.trim());

    // Log to file
    try {
        fs.appendFileSync(LOG_FILE, logEntry, 'utf8');
    } catch (err) {
        console.error('[SERVER LOG ERROR] Could not write to log file:', err);
    }
}


module.exports = { logMessage }; 