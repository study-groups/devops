/**
 * CallerInfo.js - Utilities for capturing caller information from stack traces
 */

/**
 * Class for capturing and parsing stack traces to get caller information
 */
export class CallerInfo {
  /**
   * Skip patterns - patterns in the stack trace that should be skipped
   * @type {Array<string>}
   */
  static skipPatterns = [
    'ConsoleLogManager.js',
    'LogManager.js',
    'LogFilter.js', 
    'LogEntry.js',
    'LogBuffer.js',
    'CallerInfo.js',
    'log/core.js',
    'proxiedConsole.',
    'createStructuredLog'
  ];

  /**
   * Captures the caller information for the current execution context
   * @param {number} skipFrames - Additional frames to skip
   * @returns {Object} - Object containing file, line, and function name of the caller
   */
  static capture(skipFrames = 0) {
    try {
      // Create an Error to get its stack trace
      const err = new Error();
      const stack = err.stack;
      
      // Split the stack by lines
      const stackLines = stack.split('\n');
      
      // Default caller info
      let caller = { file: 'unknown', line: 0, function: 'anonymous' };
      
      // Skip error message line plus any additional frames
      const startIdx = 2 + skipFrames;
      
      // Find first line not matching skip patterns
      for (let i = startIdx; i < stackLines.length; i++) {
        const line = stackLines[i].trim();
        
        // Skip internal framework calls
        if (CallerInfo.skipPatterns.some(pattern => line.includes(pattern))) {
          continue;
        }
        
        // Extract file and line info from the stack trace
        // Format varies by browser, this targets Chrome/Firefox format
        const match = line.match(/at (?:(.+?)\s+\()?(?:(.+?):(\d+)(?::(\d+))?|([^)]+))\)?/);
        if (match) {
          // We found our caller
          const [, fnName, filePath, lineNo] = match;
          const fileNameMatch = filePath?.match(/([^\/\\]+)$/);
          const fileName = fileNameMatch ? fileNameMatch[1] : filePath;
          
          caller = {
            file: fileName || 'unknown',
            line: parseInt(lineNo, 10) || 0,
            function: fnName || 'anonymous'
          };
          break;
        }
      }
      
      return caller;
    } catch (e) {
      console.error('[CALLER_INFO] Error capturing caller info:', e);
      return { file: 'unknown', line: 0, function: 'anonymous' };
    }
  }

  /**
   * Add a pattern to the skip list
   * @param {string} pattern - String pattern to skip in stack traces
   */
  static addSkipPattern(pattern) {
    if (typeof pattern === 'string' && pattern && !CallerInfo.skipPatterns.includes(pattern)) {
      CallerInfo.skipPatterns.push(pattern);
    }
    return CallerInfo;
  }

  /**
   * Remove a pattern from the skip list
   * @param {string} pattern - Pattern to remove
   */
  static removeSkipPattern(pattern) {
    CallerInfo.skipPatterns = CallerInfo.skipPatterns.filter(p => p !== pattern);
    return CallerInfo;
  }

  /**
   * Reset the skip patterns to defaults
   */
  static resetSkipPatterns() {
    CallerInfo.skipPatterns = [
      'ConsoleLogManager.js',
      'LogManager.js',
      'LogFilter.js', 
      'LogEntry.js',
      'LogBuffer.js',
      'CallerInfo.js',
      'log/core.js',
      'proxiedConsole.',
      'createStructuredLog'
    ];
    return CallerInfo;
  }

  /**
   * Parse a message for caller information in parentheses
   * @param {string} message - Message to parse
   * @returns {Object|null} - Object with file and line if found, null otherwise
   */
  static parseFromMessage(message) {
    if (typeof message !== 'string') return null;
    
    // Match (filename.js:123) or (filename.js:123:45) patterns
    const match = message.match(/\(([^:)]+):(\d+)(?::(\d+))?\)/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        column: match[3] ? parseInt(match[3], 10) : undefined
      };
    }
    
    return null;
  }
} 