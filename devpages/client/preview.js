/**
 * preview.js
 * Provides backward compatibility for code that imports from preview.js
 * Re-exports all functionality from core/preview.js
 */

import { preview } from './core/index.js';

// Re-export all properties and methods from core preview
export const {
  initializePreview,
  refreshPreview,
  schedulePreviewUpdate,
  setupContentViewer
} = preview;

// For compatibility with old code that used the default export
export default preview; 