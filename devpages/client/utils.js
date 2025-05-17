// General utility functions
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Measures and logs the execution time of a function without interrupting console logging
 * @param {Function} fn - Function to measure
 * @param {Object} options - Config options
 * @returns {Function} - Wrapped function with timing
 */
export function timeFunction(fn, options = {}) {
  const {
    name = fn.name || 'anonymous',
    logLevel = 'info',
    thresholdMs = 0,
    includeStackTrace = false
  } = options;
  
  // Create logging function based on level
  const originalConsole = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: console.warn,
    error: console.error
  };
  
  const logFunc = 
    logLevel === 'error' ? originalConsole.error :
    logLevel === 'warn' ? originalConsole.warn :
    logLevel === 'debug' ? originalConsole.debug :
    originalConsole.info;
  
  return async function(...args) {
    // Only measure if performance logging is enabled
    if (localStorage.getItem('performanceLoggingEnabled') !== 'true') {
      return await fn.apply(this, args);
    }
    
    const start = performance.now();
    try {
      return await fn.apply(this, args);
    } finally {
      const duration = performance.now() - start;
      if (duration >= thresholdMs) {
        let message = `[TIMING] ${name}: ${duration.toFixed(2)}ms`;
        
        if (includeStackTrace) {
          const stack = new Error().stack
            .split('\n')
            .slice(2)
            .join('\n');
          message += `\n${stack}`;
        }
        
        logFunc(message);
      }
    }
  };
}

/**
 * Creates a timer for measuring code blocks that doesn't interrupt console logging
 * @param {string} label - Label for the timer
 * @param {Object} options - Configuration options
 * @returns {Object} - Timer object with end() method
 */
export function createTimer(label, options = {}) {
  const {
    logLevel = 'info',
    thresholdMs = 0,
    includeStackTrace = false
  } = options;
  
  const start = performance.now();
  // Store original console methods to ensure we don't get affected by console overrides
  const originalConsole = {
    log: console.log,
    info: console.info,
    debug: console.debug,
    warn: console.warn,
    error: console.error
  };
  
  // Only log start if debugging is on
  if (localStorage.getItem('consoleLoggingEnabled') === 'true' && 
      localStorage.getItem('detailedPerformanceLog') === 'true') {
    originalConsole.log(`[TIMER-START] ${label}`);
  }
  
  // Create logging function based on level
  const logFunc = 
    logLevel === 'error' ? originalConsole.error :
    logLevel === 'warn' ? originalConsole.warn :
    logLevel === 'debug' ? originalConsole.debug :
    originalConsole.info;
  
  return {
    // Get current duration without ending timer
    current() {
      return performance.now() - start;
    },
    
    // Create checkpoint within the timer
    checkpoint(checkpointName) {
      const current = performance.now();
      const duration = current - start;
      
      if (duration >= thresholdMs && 
          localStorage.getItem('performanceLoggingEnabled') === 'true') {
        logFunc(`[TIMER-CHECKPOINT] ${label} > ${checkpointName}: ${duration.toFixed(2)}ms`);
      }
      
      return duration;
    },
    
    // End the timer and return the duration
    end() {
      const duration = performance.now() - start;
      
      if (duration >= thresholdMs && 
          localStorage.getItem('performanceLoggingEnabled') === 'true') {
        let message = `[TIMER-END] ${label}: ${duration.toFixed(2)}ms`;
        
        if (includeStackTrace) {
          const stack = new Error().stack
            .split('\n')
            .slice(2)
            .join('\n');
          message += `\n${stack}`;
        }
        
        logFunc(message);
      }
      
      return duration;
    }
  };
}

// Add any other utility functions here that aren't related to logging
