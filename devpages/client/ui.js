// ui.js - Basic UI state management (e.g., button states)

// State
let buttonStates = {};
const uiChangeCallbacks = {};

// Public API
function setButtonState(buttonId, state) {
  buttonStates[buttonId] = state;
  
  // Notify listeners for this specific button
  if (uiChangeCallbacks[buttonId]) {
    uiChangeCallbacks[buttonId].forEach(callback => callback(state));
  }
  
  return state;
}

function getButtonState(buttonId) {
  return buttonStates[buttonId] || false;
}

function getAllButtonStates() {
  return { ...buttonStates };
}

function onButtonStateChange(buttonId, callback) {
  if (!uiChangeCallbacks[buttonId]) {
    uiChangeCallbacks[buttonId] = [];
  }
  
  uiChangeCallbacks[buttonId].push(callback);
  
  return () => {
    if (!uiChangeCallbacks[buttonId]) return;
    
    const index = uiChangeCallbacks[buttonId].indexOf(callback);
    if (index !== -1) uiChangeCallbacks[buttonId].splice(index, 1);
  };
}

export {
  setButtonState,
  getButtonState,
  getAllButtonStates,
  onButtonStateChange
}; 