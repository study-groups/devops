// Compatibility layer for buttons.js
import { buttons } from './core/index.js';

// Re-export everything from core/buttons.js
export const {
  registerButtonHandler,
  registerButtons,
  unregisterButton,
  getButtonInfo,
  getAllButtons,
  setupButtonGroup,
  setButtonEnabled
} = buttons;

// For default import compatibility
export default buttons; 