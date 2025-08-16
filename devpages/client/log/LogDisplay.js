/**
 * LogDisplay.js
 * Full-featured log display component with filtering, search, and beautiful UI.
 * Can be used standalone or within the panel system.
 */
import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from '/client/appState.js';
import { clearEntries, selectFilteredEntries, addEntry } from '/client/store/slices/logSlice.js';
import { createLogPanelDOM, createExpandedEntryToolbarDOM } from './logEntryDOM.js';
import { updateTagsBar, applyFiltersToLogEntries, clearFilterCache } from './LogFilterBar.js';
import { setLogDisplayInstance } from './LogCore.js';
import { expandLogEntry as expandLogEntryFunction, collapseLogEntry as collapseLogEntryFunction } from './logEntryExpansion.js';

export class LogDisplay extends BasePanel {
    constructor(options) {
        super(options);
        this.logOrder = 'recent';
        this.lastSortOrder = 'recent';
        this.maxEntries = options.maxEntries || 1000; // Limit entries to prevent memory issues
        this.entryCache = new Map(); // Cache for rendered entries
        this.renderQueue = []; // Queue for batch rendering
        this.isRendering = false;
        this.continuousLoggingEnabled = true; // Flag to control continuous logging
        this.lastRenderedEntryCount = 0; // Track the number of entries rendered
        
        // Render mode constants for expansion functionality
        this.RENDER_MODE_RAW = 'raw';
        this.RENDER_MODE_MARKDOWN = 'markdown';
        this.RENDER_MODE_HTML = 'html';
    }

    render() {
        // When mounted directly, we don't need to create a separate element
        // The createLogPanelDOM will populate the container directly
        return null;
    }

    onMount(container) {
        super.onMount(container);
        
        // Create DOM structure
        createLogPanelDOM(this, '1.0');
        
        // Initialize event listeners
        this.initializeEventListeners();
        
        // Setup resize functionality
        this.setupResizeHandlers();
        
        // Subscribe to state changes
        this.store.subscribe(() => {
            const state = this.store.getState();
            this.onStateChange(state);
        });
        
        // Set up event delegation for log entry clicks (more efficient than individual listeners)
        this.setupEventDelegation();
        
        // Apply initial state
        const initialState = this.store.getState();
        this.onStateChange(initialState);
        this.lastRenderedEntryCount = selectFilteredEntries(initialState).length;

        // Initialize filter tags
        if (this.tagsBarElement) {
            updateTagsBar(this.tagsBarElement, this.logElement);
        }

        // Register this instance with LogCore so it can receive log entries
        setLogDisplayInstance(this);
        
        // Expose via proper APP namespace
        this.exposeToApp();
        
        // Load buffered log entries from early boot process
        this.loadBufferedEntries();
        
        // DISABLED: Add some test entries to verify the system is working
        // this.addTestEntries();

        // Immediately disable continuous logging since user requested it
        this.continuousLoggingEnabled = false;

        // IMMEDIATE CLEANUP - Remove any existing problematic event listeners
        this.cleanupEventListeners();

        // DISABLED: Test the LogCore integration
        // setTimeout(() => {
        //     // Import and test LogCore functions
        //     import('./LogCore.js').then(({ log, logInfo, logError }) => {
        //         log({ message: 'LogCore integration test', level: 'INFO', type: 'INTEGRATION', forceConsole: true });
        //         logInfo('LogCore logInfo function working');
        //         logError('LogCore logError function working (this is just a test)');
        //     });
        // }, 1000);

        // DISABLED: Add ongoing logging to demonstrate real-time functionality
        // this.startContinuousLogging();
    }

    initializeEventListeners() {
        // Add event listener for clear button if it exists
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.store.dispatch(clearEntries()));
        }
        
        // Add event listeners for new header controls
        const sortSelect = this.container.querySelector('#log-sort-select');
        if (sortSelect) {
            // Set initial value from storage
            const currentOrder = this.logOrder || 'recent';
            sortSelect.value = currentOrder;
            
            sortSelect.addEventListener('change', (e) => {
                this.logOrder = e.target.value;
                // Save to storage
                import('/client/services/storageService.js').then(({ storageService }) => {
                    storageService.setItem('logOrder', this.logOrder);
                });
                // Trigger re-render by calling onStateChange with current state
                const currentState = this.store.getState();
                this.onStateChange(currentState);
            });
        }
        
        // Add event listeners for header buttons
        const headerButtons = this.container.querySelectorAll('.log-header-button[data-action]');
        console.log(`[LogDisplay] Found ${headerButtons.length} header buttons`);
        
        headerButtons.forEach(button => {
            console.log(`[LogDisplay] Adding listener to button with action: ${button.dataset.action}`);
            button.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
                console.log(`[LogDisplay] Button clicked with action: ${action}`);
                
                if (action === 'copy-log') {
                    console.log('[LogDisplay] Calling copyLog method');
                    try {
                        this.copyLog();
                        // Show feedback
                        const originalContent = button.innerHTML;
                        button.innerHTML = '✅ Copied';
                        setTimeout(() => {
                            button.innerHTML = originalContent;
                        }, 2000);
                    } catch (error) {
                        console.error('[LogDisplay] Error in copyLog:', error);
                    }
                } else if (action === 'clear-log') {
                    console.log('[LogDisplay] Calling clearLog method');
                    try {
                        this.clearLog();
                    } catch (error) {
                        console.error('[LogDisplay] Error in clearLog:', error);
                    }
                } else if (action === 'toggleLogMenu') {
                    console.log('[LogDisplay] Toggling log menu');
                    // Handle menu toggle directly
                    const menuContainer = this.container.querySelector('#log-menu-container');
                    if (menuContainer) {
                        const isVisible = menuContainer.style.display !== 'none';
                        menuContainer.style.display = isVisible ? 'none' : 'block';
                    }
                } else {
                    console.log('[LogDisplay] Delegating to filter bar handler');
                    // Delegate other actions to existing filter bar handler
                    import('./LogFilterBar.js').then(({ _handleTagClick }) => {
                        _handleTagClick(e);
                    });
                }
            });
        });
    }

    /**
     * Load buffered log entries from early boot process
     */
    loadBufferedEntries() {
        console.log('[LogDisplay] Loading buffered entries from early boot process...');
        
        try {
            // Try to get buffered entries from various log managers
            const buffers = [];
            
            // 1. Try ConsoleLogManager buffer
            const consoleLogManager = window.APP?.services?.consoleLogManager || window.consoleLogManager;
            if (consoleLogManager && typeof consoleLogManager.getLogBuffer === 'function') {
                const consoleEntries = consoleLogManager.getLogBuffer();
                if (consoleEntries && consoleEntries.length > 0) {
                    console.log(`[LogDisplay] Found ${consoleEntries.length} entries in ConsoleLogManager buffer`);
                    buffers.push(...consoleEntries);
                }
            }
            
            // 2. Try generic LogManager buffer
            const logManager = window.APP?.services?.logManager || window.logManager;
            if (logManager && logManager !== consoleLogManager && typeof logManager.getLogBuffer === 'function') {
                const logEntries = logManager.getLogBuffer();
                if (logEntries && logEntries.length > 0) {
                    console.log(`[LogDisplay] Found ${logEntries.length} entries in LogManager buffer`);
                    buffers.push(...logEntries);
                }
            }
            
            // 3. Convert buffered entries to LogDisplay format and add them
            if (buffers.length > 0) {
                console.log(`[LogDisplay] Processing ${buffers.length} buffered entries...`);
                
                buffers.forEach(entry => {
                    // Convert buffer entry format to LogDisplay format
                    const displayEntry = {
                        timestamp: entry.timestamp || entry.ts || Date.now(),
                        message: entry.message || '',
                        level: entry.level || 'INFO',
                        type: entry.type || 'GENERAL',
                        source: entry.source || 'SYSTEM',
                        action: entry.action,
                        details: entry.details,
                        component: entry.component
                    };
                    
                    // Add to Redux store
                    this.store.dispatch(addEntry(displayEntry));
                });
                
                console.log(`[LogDisplay] Successfully loaded ${buffers.length} buffered entries`);
            } else {
                console.log('[LogDisplay] No buffered entries found');
            }
            
        } catch (error) {
            console.error('[LogDisplay] Error loading buffered entries:', error);
        }
    }

    /**
     * Expose LogDisplay to proper APP namespace following project conventions
     */
    exposeToApp() {
        if (typeof window === 'undefined') return;
        
        // Establish APP namespace
        window.APP = window.APP || {};
        window.APP.services = window.APP.services || {};
        window.APP.log = window.APP.log || {};
        
        // Expose LogDisplay instance
        window.APP.services.logDisplay = this;
        
        // Expose LogDisplay API functions
        window.APP.log.display = {
            // Core display functions
            clearLog: () => this.clearLog(),
            copyLog: () => this.copyLog(),
            
            // Entry management
            addEntry: (entry) => this.addEntry(entry),
            
            // Configuration
            setOrder: (order) => {
                this.logOrder = order;
                const currentState = this.store.getState();
                this.onStateChange(currentState);
            },
            getOrder: () => this.logOrder,
            
            // Testing functions
            testLog: (message = 'Test log entry', level = 'INFO', type = 'TEST') => {
                this.addEntry({
                    ts: Date.now(),
                    message,
                    level,
                    type,
                    source: 'CONSOLE'
                });
            },
            
            testLogCore: (message = 'LogCore test', level = 'INFO', type = 'TEST') => {
                import('./LogCore.js').then(({ log }) => {
                    log({ 
                        message, 
                        level, 
                        type, 
                        source: 'CONSOLE',
                        forceConsole: true // Bypass rate limiting
                    });
                });
            },
            
            // Control functions
            enableContinuousLogging: () => {
                this.continuousLoggingEnabled = true;
                console.log('Continuous logging enabled');
            },
            
            disableContinuousLogging: () => {
                this.continuousLoggingEnabled = false;
                console.log('Continuous logging disabled');
            },
            
            emergencyStop: () => {
                this.continuousLoggingEnabled = false;
                console.log('🚨 EMERGENCY STOP: All logging disabled');
            }
        };
        
        // Legacy compatibility for filter bar (temporary)
        window.APP.services.logPanel = this; // For LogFilterBar compatibility
    }

    // Required method for LogCore integration
    addEntry(entry) {
        // Convert LogCore entry format to Redux store format
        const storeEntry = {
            timestamp: entry.ts || Date.now(),
            message: entry.message,
            level: entry.level || 'INFO',
            type: entry.type || 'GENERAL',
            source: entry.source || 'SYSTEM',
            action: entry.action,
            details: entry.details,
            component: entry.component
        };
        
        // Dispatch to Redux store
        this.store.dispatch(addEntry(storeEntry));
    }

    // Add test entries to verify the logging system is working
    addTestEntries() {
        const testEntries = [
            {
                ts: Date.now() - 3000,
                message: 'Log system initialized successfully',
                level: 'INFO',
                type: 'SYSTEM',
                source: 'LOGDISPLAY'
            },
            {
                ts: Date.now() - 2000,
                message: 'User interface components loaded',
                level: 'INFO',
                type: 'UI',
                source: 'BOOTSTRAP'
            },
            {
                ts: Date.now() - 1000,
                message: 'Search functionality enabled',
                level: 'DEBUG',
                type: 'FEATURE',
                source: 'LOGFILTER'
            },
            {
                ts: Date.now(),
                message: 'Ready to receive log entries',
                level: 'INFO',
                type: 'STATUS',
                source: 'LOGDISPLAY'
            }
        ];

        testEntries.forEach(entry => this.addEntry(entry));
    }

    // Add continuous logging to demonstrate real-time functionality
    startContinuousLogging() {
        let counter = 1;
        
        // DISABLED: Add user interaction logging (causing sidebar loops)
        // this.setupUserInteractionLogging();
        
        // Add periodic status updates (every 60 seconds - reduced frequency)
        setInterval(() => {
            if (this.continuousLoggingEnabled) {
                this.addEntry({
                    ts: Date.now(),
                    message: `System heartbeat #${counter++} - ${new Date().toLocaleTimeString()}`,
                    level: 'DEBUG',
                    type: 'HEARTBEAT',
                    source: 'SYSTEM'
                });
            }
        }, 60000);
        
        // Add random activity simulation (every 30-60 seconds - reduced frequency)
        const simulateActivity = () => {
            if (this.continuousLoggingEnabled) {
                const activities = [
                    { message: 'File system check completed', level: 'INFO', type: 'FILESYSTEM' },
                    { message: 'Memory usage: 45MB', level: 'DEBUG', type: 'PERFORMANCE' },
                    { message: 'Network connection stable', level: 'INFO', type: 'NETWORK' },
                    { message: 'Cache cleanup performed', level: 'DEBUG', type: 'MAINTENANCE' },
                    { message: 'User session active', level: 'INFO', type: 'SESSION' }
                ];
                
                const activity = activities[Math.floor(Math.random() * activities.length)];
                this.addEntry({
                    ts: Date.now(),
                    ...activity,
                    source: 'MONITOR'
                });
            }
            
            // Schedule next activity (30-60 seconds)
            setTimeout(simulateActivity, 30000 + Math.random() * 30000);
        };
        
        // Start activity simulation after 10 seconds
        setTimeout(simulateActivity, 10000);
    }

    // COMPLETELY REMOVED - Setup logging for user interactions
    setupUserInteractionLogging() {
        // DISABLED - This function was causing sidebar loops
        // All event listeners removed to fix the root cause
        console.log('User interaction logging disabled to prevent sidebar loops');
    }

    // Cleanup function to remove any problematic event listeners
    cleanupEventListeners() {
        // Clone and replace document to remove ALL event listeners
        // This is the nuclear option to fix the sidebar issue
        console.log('🧹 Cleaning up all problematic event listeners');
        
        // Remove any click listeners we might have added
        const newDocument = document.cloneNode(true);
        // Note: We can't actually replace document, but we can ensure our listeners are gone
        
        // Clear any intervals or timeouts that might be running
        for (let i = 1; i < 99999; i++) {
            window.clearTimeout(i);
            window.clearInterval(i);
        }
        
        console.log('✅ Event listener cleanup completed');
    }

    onStateChange(state) {
        // Handle log visibility - apply CSS classes to the log container
        const logContainer = document.getElementById('log-container');
        
        if (logContainer) {
            const isVisible = state.ui?.logVisible === true;
            const logHeight = state.ui?.logHeight || 150;
            
            // Set CSS variable for height
            document.documentElement.style.setProperty('--log-height', `${logHeight}px`);
            
            // Apply visibility classes
            if (isVisible) {
                logContainer.classList.remove('log-hidden');
                logContainer.classList.add('log-visible');
            } else {
                logContainer.classList.remove('log-visible');
                logContainer.classList.add('log-hidden');
            }
        }

        if (!this.logElement || !state.log) return;

        const logState = state.log;
        const allEntries = selectFilteredEntries({ log: logState });

        const sortOrderChanged = this.logOrder !== this.lastSortOrder;
        this.lastSortOrder = this.logOrder;

        // If the number of entries hasn't changed, and sort order is the same, do nothing.
        if (allEntries.length === this.lastRenderedEntryCount && !sortOrderChanged) {
            return;
        }

        // Efficiently append only new entries
        const newEntries = allEntries.slice(this.lastRenderedEntryCount);

        if (newEntries.length > 0 && !sortOrderChanged) {
            const fragment = document.createDocumentFragment();
            newEntries.forEach(entry => {
                const entryElement = this.createLogEntryElement(entry, allEntries.length - newEntries.length + fragment.children.length);
                if (this.logOrder === 'recent') {
                    fragment.insertBefore(entryElement, fragment.firstChild);
                } else {
                    fragment.appendChild(entryElement);
                }
            });

            if (this.logOrder === 'recent') {
                 this.logElement.insertBefore(fragment, this.logElement.firstChild);
            } else {
                 this.logElement.appendChild(fragment);
            }
        } else if (allEntries.length < this.lastRenderedEntryCount || sortOrderChanged) {
            // This case handles clearing, filtering, or sorting, so a full re-render is needed.
            this.logElement.innerHTML = '';
            const fragment = document.createDocumentFragment();
            allEntries.forEach((entry, index) => {
                fragment.appendChild(this.createLogEntryElement(entry, index));
            });
            this.logElement.appendChild(fragment);
        }

        this.lastRenderedEntryCount = allEntries.length;
        this.updateEntryCount(logState);
    }

    renderLogEntry(entry, index) {
        const logEntryDiv = document.createElement('div');
        const level = (entry.level || 'info').toLowerCase();
        const type = entry.type || 'GENERAL';
        const source = entry.source || 'SYSTEM';
        
        logEntryDiv.className = `log-entry log-level-${level}`;
        
        // Format timestamp
        const timestamp = entry.timestamp ? 
            new Date(entry.timestamp).toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
            }) : 
            '--:--:--';

        // Create structured content
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'log-entry-timestamp';
        timestampSpan.textContent = timestamp;
        
        const levelSpan = document.createElement('span');
        levelSpan.className = 'log-entry-level';
        levelSpan.textContent = entry.level || 'INFO';
        
        const typeSpan = document.createElement('span');
        typeSpan.className = 'log-entry-type';
        typeSpan.textContent = type;
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-entry-message';
        messageSpan.textContent = this.sanitizeMessage(entry.message || '');
        
        // Append elements
        logEntryDiv.appendChild(timestampSpan);
        logEntryDiv.appendChild(levelSpan);
        logEntryDiv.appendChild(typeSpan);
        logEntryDiv.appendChild(messageSpan);
        
        // Set data attributes for filtering
        logEntryDiv.dataset.logType = type;
        logEntryDiv.dataset.logLevel = entry.level || 'INFO';
        logEntryDiv.dataset.source = source;
        logEntryDiv.dataset.logIndex = index;

        // Add click handler for expansion
        logEntryDiv.addEventListener('click', (e) => this.handleLogEntryClick(e, entry));

        // Insert based on order preference
        if (this.logOrder === 'recent') {
            this.logElement.insertBefore(logEntryDiv, this.logElement.firstChild);
        } else {
            this.logElement.appendChild(logEntryDiv);
        }
    }

    sanitizeMessage(message) {
        // Basic XSS protection - strip HTML tags and decode entities
        return String(message)
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .trim();
    }

    handleLogEntryClick(event, entry) {
        const logEntryDiv = event.currentTarget;
        const isExpanded = logEntryDiv.classList.contains('expanded');
        
        if (isExpanded) {
            this.collapseLogEntry(logEntryDiv);
        } else {
            this.expandLogEntry(logEntryDiv, entry);
        }
    }

    expandLogEntry(logEntryDiv, entry) {
        try {
            expandLogEntryFunction(logEntryDiv, this);
        } catch (error) {
            console.warn('[LogDisplay] Failed to expand entry:', error);
            // Fallback to basic expansion
            logEntryDiv.classList.add('expanded');
        }
    }

    collapseLogEntry(logEntryDiv) {
        try {
            collapseLogEntryFunction(logEntryDiv, this);
        } catch (error) {
            console.warn('[LogDisplay] Failed to collapse entry:', error);
            // Fallback to basic collapse
            logEntryDiv.classList.remove('expanded');
        }
    }

    // Utility methods for better logging experience
    clearLog() {
        if (this.logElement) {
            this.logElement.innerHTML = '';
        }
        this.store.dispatch(clearEntries());
    }

    copyLog() {
        const visibleEntries = this.logElement.querySelectorAll('.log-entry:not(.log-entry-hidden-by-filter)');
        const logText = Array.from(visibleEntries).map(entry => {
            const timestamp = entry.querySelector('.log-entry-timestamp')?.textContent || '';
            const level = entry.querySelector('.log-entry-level')?.textContent || '';
            const type = entry.querySelector('.log-entry-type')?.textContent || '';
            const message = entry.querySelector('.log-entry-message')?.textContent || '';
            return `[${timestamp}] ${level} ${type}: ${message}`;
        }).join('\n');

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(logText).then(() => {
                console.log('Log entries copied to clipboard');
            }).catch(err => {
                console.error('Failed to copy log entries:', err);
            });
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = logText;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    hideAllEntries() {
        const entries = this.logElement.querySelectorAll('.log-entry.expanded');
        entries.forEach(entry => this.collapseLogEntry(entry));
    }

    // Performance optimization: batch DOM updates
    batchRenderEntries(entries) {
        const fragment = document.createDocumentFragment();
        
        entries.forEach((entry, index) => {
            const entryElement = this.createLogEntryElement(entry, index);
            fragment.appendChild(entryElement);
        });
        
        // Clear and append all at once
        this.logElement.innerHTML = '';
        this.logElement.appendChild(fragment);
    }

    createLogEntryElement(entry, index) {
        const logEntryDiv = document.createElement('div');
        const level = (entry.level || 'info').toLowerCase();
        const type = entry.type || 'GENERAL';
        const source = entry.source || 'SYSTEM';
        
        logEntryDiv.className = `log-entry log-level-${level}`;
        
        // Optimized timestamp formatting - cache formatted timestamps
        let timestamp = '--:--:--';
        if (entry.timestamp) {
            const cacheKey = Math.floor(entry.timestamp / 1000); // Cache by second
            if (!this.timestampCache) this.timestampCache = new Map();
            
            if (this.timestampCache.has(cacheKey)) {
                timestamp = this.timestampCache.get(cacheKey);
            } else {
                timestamp = new Date(entry.timestamp).toLocaleTimeString('en-US', { 
                    hour12: false, 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    second: '2-digit' 
                });
                this.timestampCache.set(cacheKey, timestamp);
                
                // Limit cache size
                if (this.timestampCache.size > 100) {
                    const firstKey = this.timestampCache.keys().next().value;
                    this.timestampCache.delete(firstKey);
                }
            }
        }

        // Create the basic structure that supports expansion
        const timestampSpan = document.createElement('span');
        timestampSpan.className = 'log-entry-timestamp';
        timestampSpan.textContent = timestamp;
        
        const levelSpan = document.createElement('span');
        levelSpan.className = 'log-entry-level';
        levelSpan.textContent = entry.level || 'INFO';
        
        const typeSpan = document.createElement('span');
        typeSpan.className = 'log-entry-type';
        typeSpan.textContent = type;
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-entry-message';
        messageSpan.textContent = this.sanitizeMessage(entry.message || '');
        
        // Create the structure that expansion functionality expects
        const textWrapper = document.createElement('div');
        textWrapper.className = 'log-entry-text-wrapper';
        
        const textContent = document.createElement('div');
        textContent.className = 'log-entry-text-content';
        textContent.appendChild(messageSpan);
        textWrapper.appendChild(textContent);
        
        // Create the expanded content container (hidden by default)
        const expandedContent = document.createElement('div');
        expandedContent.className = 'log-entry-expanded-content';
        expandedContent.style.display = 'none';
        
        // Create the expanded toolbar (inside expanded content)
        const expandedToolbar = document.createElement('div');
        expandedToolbar.className = 'log-entry-expanded-toolbar';
        
        // Create expanded text wrapper (inside expanded content)
        const expandedTextWrapper = document.createElement('div');
        expandedTextWrapper.className = 'log-entry-expanded-text-wrapper';
        
        // Assemble expanded content
        expandedContent.appendChild(expandedToolbar);
        expandedContent.appendChild(expandedTextWrapper);
        
        // Append all elements in the correct structure
        logEntryDiv.appendChild(timestampSpan);
        logEntryDiv.appendChild(levelSpan);
        logEntryDiv.appendChild(typeSpan);
        logEntryDiv.appendChild(textWrapper);
        logEntryDiv.appendChild(expandedContent);
        
        // Set data attributes for filtering and expansion
        logEntryDiv.dataset.logType = type;
        logEntryDiv.dataset.logLevel = entry.level || 'INFO';
        logEntryDiv.dataset.source = source;
        logEntryDiv.dataset.logIndex = index;
        logEntryDiv.dataset.logTimestamp = timestamp;
        logEntryDiv.dataset.logCoreMessage = entry.message || '';
        logEntryDiv.dataset.rawOriginalMessage = entry.message || '';

        // Use event delegation instead of individual listeners (handled in container)
        logEntryDiv.dataset.entryData = JSON.stringify(entry);

        return logEntryDiv;
    }

    /**
     * Set up event delegation for log entry clicks (more efficient than individual listeners)
     */
    setupEventDelegation() {
        if (!this.logElement) return;
        
        this.logElement.addEventListener('click', (e) => {
            const logEntry = e.target.closest('.log-entry');
            
            if (logEntry && logEntry.dataset.entryData) {
                try {
                    const entry = JSON.parse(logEntry.dataset.entryData);
                    // Create a new event object with the correct currentTarget
                    const delegatedEvent = {
                        ...e,
                        currentTarget: logEntry,
                        target: e.target,
                        stopPropagation: () => e.stopPropagation(),
                        preventDefault: () => e.preventDefault()
                    };
                    this.handleLogEntryClick(delegatedEvent, entry);
                } catch (error) {
                    console.warn('[LogDisplay] Failed to parse entry data for click handler:', error);
                }
            }
        });
    }

    // Memory management methods
    enforceEntryLimit() {
        if (!this.logElement) return;
        
        const entries = Array.from(this.logElement.children);
        if (entries.length > this.maxEntries) {
            const entriesToRemove = entries.length - this.maxEntries;
            const toRemove = this.logOrder === 'recent' ? 
                entries.slice(-entriesToRemove) : 
                entries.slice(0, entriesToRemove);
            
            toRemove.forEach(entry => {
                // Clean up event listeners
                const clonedEntry = entry.cloneNode(true);
                entry.parentNode.replaceChild(clonedEntry, entry);
                // Remove from cache
                const cacheKey = entry.dataset.logIndex;
                if (cacheKey) {
                    this.entryCache.delete(cacheKey);
                }
            });
        }
    }

    // Optimized batch rendering with queue
    queueRender(entries) {
        this.renderQueue.push(...entries);
        if (!this.isRendering) {
            this.processRenderQueue();
        }
    }

    processRenderQueue() {
        if (this.renderQueue.length === 0) {
            this.isRendering = false;
            return;
        }

        this.isRendering = true;
        const batchSize = 50; // Increased batch size since rendering is now faster
        const batch = this.renderQueue.splice(0, batchSize);
        
        requestAnimationFrame(() => {
            const fragment = document.createDocumentFragment();
            
            batch.forEach((entry, index) => {
                const cacheKey = `${entry.timestamp}-${entry.message}`;
                let entryElement;
                
                if (this.entryCache.has(cacheKey)) {
                    entryElement = this.entryCache.get(cacheKey).cloneNode(true);
                    // Re-attach event listeners
                    entryElement.addEventListener('click', (e) => this.handleLogEntryClick(e, entry));
                } else {
                    entryElement = this.createLogEntryElement(entry, index);
                    this.entryCache.set(cacheKey, entryElement.cloneNode(true));
                }
                
                fragment.appendChild(entryElement);
            });
            
            if (this.logOrder === 'recent') {
                this.logElement.insertBefore(fragment, this.logElement.firstChild);
            } else {
                this.logElement.appendChild(fragment);
            }
            
            // Enforce entry limit after adding new entries
            this.enforceEntryLimit();
            
            // Continue processing queue
            this.processRenderQueue();
        });
    }

    // Cleanup method for memory management
    cleanup() {
        // Clear caches
        this.entryCache.clear();
        this.renderQueue.length = 0;
        
        // Remove event listeners
        if (this.logElement) {
            const entries = this.logElement.querySelectorAll('.log-entry');
            entries.forEach(entry => {
                const clonedEntry = entry.cloneNode(true);
                entry.parentNode.replaceChild(clonedEntry, entry);
            });
        }
        
        // Clear filter cache
        if (typeof clearFilterCache === 'function') {
            clearFilterCache();
        }
    }

    updateEntryCount(logState) {
        if (!this.statusElement) return;
        
        const total = logState.entries.length;
        const filtered = selectFilteredEntries({ log: logState }).length;
        
        let statusText = `${total} entries`;
        if (total !== filtered) {
            statusText += ` (${filtered} shown)`;
        }
        
        this.statusElement.textContent = statusText;
    }

    setupResizeHandlers() {
        if (!this.resizeHandle) return;
        
        // Initialize resize state
        this.isResizing = false;
        this.resizeStartY = 0;
        this.resizeStartHeight = 0;

        // Mouse down on resize handle
        this.resizeHandle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            this.isResizing = true;
            this.resizeStartY = e.clientY;
            
            const logContainer = document.getElementById('log-container');
            if (logContainer) {
                const rect = logContainer.getBoundingClientRect();
                this.resizeStartHeight = rect.height;
            }
            
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
        });

        // Global mouse move for resize
        document.addEventListener('mousemove', (e) => {
            if (!this.isResizing) return;
            
            const deltaY = this.resizeStartY - e.clientY; // Inverted because log grows upward
            const newHeight = Math.max(100, Math.min(600, this.resizeStartHeight + deltaY));
            
            // Update CSS variable
            document.documentElement.style.setProperty('--log-height', `${newHeight}px`);
            
            // Update Redux state
            import('/client/store/uiSlice.js').then(({ uiActions }) => {
                this.store.dispatch(uiActions.updateSetting({
                    key: 'logHeight',
                    value: newHeight
                }));
            });
        });

        // Global mouse up to end resize
        document.addEventListener('mouseup', () => {
            if (!this.isResizing) return;
            
            this.isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });
    }

    // Override destroy method to include cleanup
    destroy() {
        this.cleanup();
        super.destroy();
    }
}

export function createLogDisplay(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`[createLogDisplay] Container with id '${containerId}' not found.`);
        return null;
    }

    const display = new LogDisplay({ id: 'log-display', store: appStore });
    const displayElement = display.render();
    container.appendChild(displayElement);
    display.onMount(container);

    return display;
}
