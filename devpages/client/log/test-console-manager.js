/**
 * Test script for ConsoleLogManager.js
 * Run this in the browser console to verify functionality.
 */

import {
  enableConsoleLogging,
  disableConsoleLogging,
  enableTimestamps,
  disableTimestamps,
  setIncludeTypes,
  setExcludeTypes,
  setIncludeSubtypes,
  setExcludeSubtypes,
  setIncludeLevels,
  setExcludeLevels,
  createTimer,
  createSilentTimer,
  getLogBuffer,
  clearLogBuffer,
  clearAllFilters,
  enableDetailedTiming,
  disableDetailedTiming
} from './ConsoleLogManager.js';

// This allows us to call the test functions from the browser console
window.testConsoleManager = {
  runAllTests() {
    this.setup();
    this.testBasicLogs();
    this.testStructuredLogs();
    this.testTypeFiltering();
    this.testSubtypeFiltering();
    this.testLevelFiltering();
    this.testTimestamps();
    this.testTimers();
    this.testSilentTimers();
    this.testTimingMethod();
    this.testBufferOperations();
  },

  setup() {
    console.log('Setting up test environment...');
    clearAllFilters(true);
    clearLogBuffer();
    enableConsoleLogging(true);
    enableTimestamps(true);
    // Enable detailed timing to see TIMING level messages
    enableDetailedTiming(true);
  },

  testBasicLogs() {
    console.log('--- Test: Basic Logs ---');
    console.log('Simple log message');
    console.info('Info log message');
    console.debug('Debug log message');
    console.warn('Warning log message');
    console.error('Error log message');
  },

  testStructuredLogs() {
    console.log('--- Test: Structured Logs ---');
    console.log('[USER] User login successful');
    console.log('[API] [REQUEST] GET /api/users');
    console.log('[DATABASE] [QUERY] SELECT * FROM users');
    console.log('[PERFORMANCE] [TIMING] Render took 42ms');
    
    // Test with explicit level in object format
    console.log({
      message: 'This is a DEBUG message with object format',
      level: 'DEBUG',
      type: 'TEST'
    });
    
    console.log({
      message: 'This is an ERROR message with object format',
      level: 'ERROR',
      type: 'TEST',
      subtype: 'STRUCTURED'
    });
  },

  testTypeFiltering() {
    console.log('--- Test: Type Filtering ---');
    
    // Set include filter to only show USER type
    console.log('Setting include filter to only show USER type...');
    setIncludeTypes(['USER'], true);
    
    // These should show
    console.log('[USER] This should show');
    console.log('[USER] [LOGIN] This should also show');
    
    // These should not show
    console.log('[API] This should NOT show');
    console.log('[DATABASE] This should NOT show');
    
    // Clear filters
    console.log('Clearing all filters...');
    clearAllFilters(true);
    
    // Set exclude filter to hide API type
    console.log('Setting exclude filter to hide API type...');
    setExcludeTypes(['API'], true);
    
    // These should show
    console.log('[USER] This should show');
    console.log('[DATABASE] This should show');
    
    // These should not show
    console.log('[API] This should NOT show');
    console.log('[API] [REQUEST] This should NOT show');
    
    // Clear filters
    console.log('Clearing all filters...');
    clearAllFilters(true);
  },

  testSubtypeFiltering() {
    console.log('--- Test: Subtype Filtering ---');
    
    // Set include filter to only show LOGIN subtype
    console.log('Setting include filter to only show LOGIN subtype...');
    setIncludeSubtypes(['LOGIN'], true);
    
    // These should show
    console.log('[USER] [LOGIN] This should show');
    console.log('[AUTH] [LOGIN] This should also show');
    
    // These should not show
    console.log('[USER] [LOGOUT] This should NOT show');
    console.log('[USER] This should NOT show (no subtype)');
    
    // Clear filters
    console.log('Clearing all filters...');
    clearAllFilters(true);
    
    // Set exclude filter to hide REQUEST subtype
    console.log('Setting exclude filter to hide REQUEST subtype...');
    setExcludeSubtypes(['REQUEST'], true);
    
    // These should show
    console.log('[API] [RESPONSE] This should show');
    console.log('[API] This should show (no subtype)');
    
    // These should not show
    console.log('[API] [REQUEST] This should NOT show');
    console.log('[USER] [REQUEST] This should NOT show');
    
    // Clear filters
    console.log('Clearing all filters...');
    clearAllFilters(true);
  },
  
  testLevelFiltering() {
    console.log('--- Test: Level Filtering ---');
    
    // Test include levels
    console.log('Setting include filter to only show ERROR level...');
    setIncludeLevels(['ERROR'], true);
    
    // This should show
    console.error('This ERROR message should show');
    
    // These should not show
    console.log('This INFO message should NOT show');
    console.warn('This WARN message should NOT show');
    console.debug('This DEBUG message should NOT show');
    
    // Clear filters
    console.log('Clearing all filters...');
    clearAllFilters(true);
    
    // Test exclude levels
    console.log('Setting exclude filter to hide DEBUG level...');
    setExcludeLevels(['DEBUG'], true);
    
    // These should show
    console.log('This INFO message should show');
    console.warn('This WARN message should show');
    console.error('This ERROR message should show');
    
    // This should not show
    console.debug('This DEBUG message should NOT show');
    
    // Clear filters
    console.log('Clearing all filters...');
    clearAllFilters(true);
  },

  testTimestamps() {
    console.log('--- Test: Timestamps ---');
    
    // Enable timestamps
    console.log('Enabling timestamps...');
    enableTimestamps(true);
    
    // These should have timestamps
    console.log('This log should have a timestamp');
    
    // Disable timestamps
    console.log('Disabling timestamps...');
    disableTimestamps(true);
    
    // These should not have timestamps
    console.log('This log should NOT have a timestamp');
    
    // Re-enable timestamps for other tests
    enableTimestamps(true);
  },

  testTimers() {
    console.log('--- Test: Timers ---');
    
    // Create a timer
    const timer = createTimer('TestTimer');
    
    // Do some work
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += i;
    }
    
    // Add checkpoints
    timer.checkpoint('After loop');
    
    // Do more work
    sum = 0;
    for (let i = 0; i < 500000; i++) {
      sum += Math.sqrt(i);
    }
    
    // End timer
    const duration = timer.end();
    console.log(`Timer duration: ${duration.toFixed(2)}ms`);
  },
  
  testSilentTimers() {
    console.log('--- Test: Silent Timers ---');
    
    // Create a silent timer (which won't auto-log to console)
    const timer = createSilentTimer('SilentTimer');
    
    // Do some work
    let sum = 0;
    for (let i = 0; i < 1000000; i++) {
      sum += i;
    }
    
    // Add checkpoints (these won't show in console)
    timer.checkpoint('After loop');
    
    // Do more work
    sum = 0;
    for (let i = 0; i < 500000; i++) {
      sum += Math.sqrt(i);
    }
    
    // End timer and get duration (this won't auto-log)
    const duration = timer.end();
    console.log(`Silent timer duration: ${duration.toFixed(2)}ms`);
    
    // Explicitly log the result as a TIMING level message if desired
    timer.log();
  },
  
  testTimingMethod() {
    console.log('--- Test: Timing Method ---');
    
    // Use console.timing for timing messages
    console.timing('This is a direct timing message');
    
    // Use object form with TIMING level
    console.log({
      message: 'This is a timing message with TIMING level',
      level: 'TIMING',
      type: 'PERFORMANCE'
    });
  },

  testBufferOperations() {
    console.log('--- Test: Buffer Operations ---');
    
    // Clear buffer
    console.log('Clearing buffer...');
    clearLogBuffer();
    
    // Add some logs
    console.log('Adding logs to buffer...');
    console.log('[BUFFER] Test log 1');
    console.log('[BUFFER] Test log 2');
    console.log('[BUFFER] Test log 3');
    
    // Get and display buffer contents
    const buffer = getLogBuffer();
    console.log(`Buffer size: ${buffer.length}`);
    console.log('Buffer contents (first 3 entries):', buffer.slice(0, 3));
  }
};

// Log a message indicating the test script is loaded
console.log('[TEST] ConsoleLogManager test script loaded. Run window.testConsoleManager.runAllTests() to test.'); 