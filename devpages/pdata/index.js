// pdata/index.js - Main entry point for the PData module

// Import the PData class definition
import { PData } from './PData.js';
// Import the router *factory function*
import { createPDataRoutes } from './routes.js';

// Export the PData class itself as a named export.
export { PData };

// Export the router factory function as a named export.
export { createPDataRoutes };

// NOTE:
// Initialization of the PData instance (`