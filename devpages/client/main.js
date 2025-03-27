/**
 * Main Application Entry Point
 * Delegates to core/main.js for actual implementation
 */
import { initializeApplication } from './core/index.js';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Starting application...');
  
  // Initialize the application using the core implementation
  initializeApplication()
    .then(() => {
      console.log('Application initialized successfully');
    })
    .catch(error => {
      console.error('Application initialization failed:', error);
    });
});

// Re-export from core/main.js for backward compatibility
export { initializeApplication }; 