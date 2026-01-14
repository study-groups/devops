/**
 * PBase Dashboard - Main Entry Point
 */

import * as auth from './modules/auth.js';
import * as tabs from './modules/tabs.js';
import * as games from './modules/games.js';
import * as config from './modules/config.js';
import * as admin from './modules/admin.js';

// Handle magic link tokens first
auth.handleMagicLinkToken();

// Initialize modules
tabs.init();
auth.init(() => tabs.loadTabData('games'));
admin.init();
games.init();
config.init();
