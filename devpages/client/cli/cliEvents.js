// client/cli/cliEvents.js - Event definitions for CLI
export const CLI_EVENTS = {
  // User input events
  COMMAND_ENTERED: 'cli:command-entered',
  COMMAND_CLEARED: 'cli:command-cleared',
  
  // Processing events
  COMMAND_PROCESSING: 'cli:command-processing',
  COMMAND_ERROR: 'cli:command-error',
  
  // Result events
  COMMAND_EXECUTED: 'cli:command-executed',
  COMMAND_RESPONSE: 'cli:command-response',
  
  // UI events
  CLI_READY: 'cli:ready',
};

export default CLI_EVENTS; 