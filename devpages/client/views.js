// Compatibility layer for views.js
import { views } from './core/index.js';

// Re-export everything from core/views.js
export const {
  VIEW_MODES,
  setView,
  getView,
  onViewChange
} = views;

// For default import compatibility
export default views; 