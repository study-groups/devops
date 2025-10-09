// pdata/index.js - Main entry point for the PData module

// Import the PData class definition
import { PData } from './PData.js';
// Import the router *factory function*
import { createPDataRoutes } from './routes.js';
// Import AuditLogger for custom hooks
import { AuditLogger } from './AuditLogger.js';
// Import LogAdapter for production logging
import { LogAdapter } from './adapters/LogAdapter.js';

// Export the PData class itself as a named export.
export { PData };

// Export the router factory function as a named export.
export { createPDataRoutes };

// Export AuditLogger for custom hook configuration
export { AuditLogger };

// Export LogAdapter for file-based logging
export { LogAdapter };

// NOTE:
// Initialization of the PData instance (`