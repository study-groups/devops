import { views } from '/client/index.js';
import { ui } from '/client/index.js';

class ViewControls {
  constructor(container) {
    this.container = container;
    this.controlsContainer = null;
    this.unsubscribe = null;
    
    this.initialize();
  }
  
  initialize() {
    // Create view controls container
    this.controlsContainer = document.createElement('div');
    this.controlsContainer.className = 'view-controls';
    
    // Create buttons for each view mode
    const { VIEW_MODES } = views;
    
    Object.entries(VIEW_MODES).forEach(([key, value]) => {
      const button = document.createElement('button');
      button.className = 'view-button';
      button.dataset.view = value;
      button.textContent = key.charAt(0) + key.slice(1).toLowerCase();
      
      // Set initial active state
      const isActive = views.getView() === value;
      this.updateButtonState(button, isActive);
      
      // Add click handler
      button.addEventListener('click', () => this.handleViewChange(value));
      
      this.controlsContainer.appendChild(button);
    });
    
    // Append to container
    this.container.appendChild(this.controlsContainer);
    
    // Subscribe to view changes
    this.unsubscribe = views.onViewChange(this.handleViewChangeEvent.bind(this));
  }
  
  handleViewChange(viewMode) {
    views.setView(viewMode);
  }
  
  handleViewChangeEvent(newView) {
    // Update all buttons to reflect the current view
    const buttons = this.controlsContainer.querySelectorAll('.view-button');
    
    buttons.forEach(button => {
      const isActive = button.dataset.view === newView;
      this.updateButtonState(button, isActive);
    });
  }
  
  updateButtonState(button, isActive) {
    button.classList.toggle('active', isActive);
    
    // Store button state in UI state manager
    const buttonId = `view-${button.dataset.view}`;
    ui.setButtonState(buttonId, isActive);
  }
  
  destroy() {
    // Clean up event listeners
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    
    // Remove from DOM
    if (this.controlsContainer && this.controlsContainer.parentNode) {
      this.controlsContainer.parentNode.removeChild(this.controlsContainer);
    }
  }
}

export default ViewControls; 