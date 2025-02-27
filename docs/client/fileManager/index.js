// Main entry point for file management system
import fileManager from './core.js';

export { default as fileManager } from './core.js';
export * from './operations.js';
export * from './state.js';
export * from './ui.js';
export * from './api.js';

// Initialize function
export { initializeFileManager } from './init.js';

// Export currentDir from core
export { currentDir } from './core.js';

// Make globally available
if (typeof window !== 'undefined') {
    window.fileManager = fileManager;
} 