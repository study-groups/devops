/**
 * Configuration API Routes
 * Provides configuration information to client
 */

import express from 'express';
import { env } from '../config.js';

const router = express.Router();

/**
 * GET /api/config
 * Returns server configuration
 */
router.get('/', (req, res) => {
  try {
    const config = {
      MD_DIR: env.MD_DIR,
      PD_DIR: env.PD_DIR || process.env.PD_DIR,
      NODE_ENV: env.NODE_ENV,
      // Only expose safe configuration values
      themesPath: `${env.MD_DIR}/themes`,
      dataPath: env.MD_DIR
    };

    res.json(config);
  } catch (error) {
    console.error('[CONFIG] Error getting configuration:', error);
    res.status(500).json({ 
      error: 'Failed to get configuration',
      MD_DIR: './data' // fallback
    });
  }
});

export default router;