/**
 * Tray Index - Registers all top bar trays
 */

import { topBarTray } from '../TopBarTray.js';

// Import and register all trays
import './NewFileTray.js';
import './PublishTray.js';

// Export the tray manager for external use
export { topBarTray };

// Export individual tray openers
export { openNewFileTray } from './NewFileTray.js';
export { openPublishTray } from './PublishTray.js';
