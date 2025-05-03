// In server/routes/configRoutes.js (or similar)
import express from 'express';
import { config } from '#server/config.js'; // Import the unified config object
import pkg from './package.json' assert { type: 'json' }; // Import package.json for version

const router = express.Router();

router.get('/', (req, res) => {
    // Only expose necessary and safe config values to the client
    const clientSafeConfig = {
        // Example: maybe the client needs to know the base for display?
        // dataDirBaseName: path.basename(config.dataDir), // Or maybe just the PD_DIR name?
        serverVersion: pkg.version || 'N/A',
        // Add any other *non-sensitive* config the client absolutely needs
    };
    res.json(clientSafeConfig);
});

export default router;