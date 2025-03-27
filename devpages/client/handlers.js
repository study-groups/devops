// client/handlers.js - Simple event handler registry for HTML elements
const Handlers = {
  // Setup an event handler for a specific element
  setup(elementId, eventType, handler) {
    console.log(`[HANDLERS] Setting up ${eventType} handler for #${elementId}`);
    
    // Find the element
    const element = document.getElementById(elementId);
    if (!element) {
      console.warn(`[HANDLERS] Element #${elementId} not found`);
      return false;
    }
    
    // Attach the event listener
    element.addEventListener(eventType, handler);
    console.log(`[HANDLERS] Handler attached to #${elementId}`);
    return true;
  },
  
  // Initialize all handlers
  init() {
    console.log('[HANDLERS] Initializing handlers');
    document.dispatchEvent(new Event('handlers:ready'));
  }
};

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  Handlers.init();
});

export default Handlers; 