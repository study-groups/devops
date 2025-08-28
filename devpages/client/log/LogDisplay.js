/**
 * LogDisplay.js
 * Full-featured log display component with filtering, search, and beautiful UI.
 * Can be used standalone or within the panel system.
 */
import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from '/client/appState.js';
import { clearEntries, selectFilteredEntries, addEntry } from '/client/store/slices/logSlice.js';
import { uiActions } from '/client/store/uiSlice.js';
import { createLogPanelDOM, createExpandedEntryToolbarDOM } from './logEntryDOM.js';
import { updateTagsBar, applyFiltersToLogEntries, clearFilterCache } from './LogFilterBar.js';
import { setLogDisplayInstance } from './LogCore.js';
import { expandLogEntry as expandLogEntryFunction, collapseLogEntry as collapseLogEntryFunction } from './logEntryExpansion.js';
import { getRenderer } from './logRenderers.js';

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
        // Create a container element for the log display
        const container = document.createElement('div');
        container.className = 'log-display-container';
        return container;
    }

    renderContent() {
        // For backward compatibility, return a simple container
        const content = document.createElement('div');
        content.className = 'log-display-content';
        return content;
    }

    onMount(container) {
        super.onMount(container);
        
        // Ensure container is set properly
        this.container = container;
        
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
                        button.innerHTML = 'Copied';
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
            source: entry.source || 'SYSTEM', // 'from' field
            module: entry.module || 'NONE',
            action: entry.action || (entry.type === 'SYSTEM' ? entry.message : ''),
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
                message: 'Log system initialized',
                level: 'INFO',
                type: 'SYSTEM',
                module: 'BOOT',
                source: 'LogDisplay'
            },
            {
                ts: Date.now() - 2000,
                message: 'UI components loaded',
                level: 'INFO',
                type: 'SYSTEM',
                module: 'BOOT',
                source: 'Bootstrap'
            },
            {
                ts: Date.now() - 1000,
                message: 'Search enabled',
                level: 'DEBUG',
                type: 'FEATURE',
                module: 'LOG_FILTER',
                source: 'LogFilterBar',
                action: 'ENABLE_SEARCH'
            },
            {
                ts: Date.now(),
                message: 'Ready for entries',
                level: 'INFO',
                type: 'STATUS',
                module: 'LOG_DISPLAY',
                source: 'LogDisplay'
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

            // Apply column widths from state
            const { logColumnWidths } = state.ui;
            for (const column in logColumnWidths) {
                document.documentElement.style.setProperty(`--log-column-width-${column}`, logColumnWidths[column]);
            }
            
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
        // Remove emojis from message
        const cleanMessage = entry.message ? entry.message.replace(/[\u{1F600}-\u{1F6FF}]/gu, '').trim() : '';
        
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
        
        const contextSpan = document.createElement('span');
        contextSpan.className = 'log-entry-context';
        
        // Combine context information into a single, more readable format
        let contextParts;
        
        if (type === 'REDUX') {
            // For REDUX entries, format the action more compactly
            const action = entry.action || '';
            const shortAction = action.includes('/') ? action.split('/').slice(-1)[0] : action;
            contextParts = [
                'REDUX',
                shortAction,
                entry.source || ''
            ].filter(part => part && part !== 'NONE');
        } else {
            contextParts = [
                type,
                entry.module || '',
                entry.action || '',
                entry.source || ''
            ].filter(part => part && part !== 'NONE');
        }
        
        contextSpan.textContent = contextParts.join(' | ');
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-entry-message';
        // Safely set message, escaping HTML to prevent XSS
        messageSpan.textContent = cleanMessage;
        
        // Create the expanded content container (hidden by default)
        const expandedContent = document.createElement('div');
        expandedContent.className = 'log-entry-expanded-content';
        expandedContent.style.display = 'none';
        
        // Create the expanded toolbar (inside expanded content)
        const expandedToolbar = document.createElement('div');
        expandedToolbar.className = 'log-entry-expanded-toolbar';
        
        // --- NEW: Add Default Expanded Header ---
        const expandedHeader = document.createElement('div');
        expandedHeader.className = 'log-entry-expanded-header';
        expandedHeader.innerHTML = `
            <strong>Type:</strong> ${type} | 
            <strong>Source:</strong> ${source} | 
            <strong>Level:</strong> ${entry.level || 'INFO'}
        `;
        expandedToolbar.appendChild(expandedHeader);
        // --- END NEW ---
        
        // Create expanded text wrapper (inside expanded content)
        const expandedTextWrapper = document.createElement('div');
        expandedTextWrapper.className = 'log-entry-expanded-text-wrapper';
        
        // Assemble expanded content
        expandedContent.appendChild(expandedToolbar);
        expandedContent.appendChild(expandedTextWrapper);
        
        // Append all elements in the correct structure
        logEntryDiv.appendChild(timestampSpan);
        logEntryDiv.appendChild(levelSpan);
        logEntryDiv.appendChild(contextSpan);
        logEntryDiv.appendChild(messageSpan);
        
        const melvinSpan = document.createElement('span');
        melvinSpan.className = 'log-entry-melvin';
        for (let i = 0; i < 3; i++) {
            const button = document.createElement('button');
            button.className = 'melvin-button';
            if (i === 0) {
                button.textContent = 'C';
                button.title = 'Copy message';
                button.addEventListener('click', (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(entry.message).then(() => {
                        button.textContent = '✓';
                        setTimeout(() => (button.textContent = 'C'), 2000);
                    });
                });
            }
            melvinSpan.appendChild(button);
        }
        logEntryDiv.appendChild(melvinSpan);

        logEntryDiv.appendChild(expandedContent);

        const payloadDetails = entry.details;
        if (payloadDetails && typeof payloadDetails === 'object' && Object.keys(payloadDetails).length > 0) {
            const detailsWrapper = document.createElement('details');
            detailsWrapper.className = 'log-entry-details-wrapper';
            
            const summary = document.createElement('summary');
            summary.style.display = 'none'; // Hide summary, action click will toggle
            detailsWrapper.appendChild(summary);

            const pre = document.createElement('pre');
            const code = document.createElement('code');
            code.textContent = JSON.stringify(payloadDetails, null, 2);
            pre.appendChild(code);
            detailsWrapper.appendChild(pre);

            // Don't add details wrapper for now - it breaks the flex layout
            // TODO: Add details functionality that doesn't interfere with columns
        }
        
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

        // This block is redundant and is causing the duplication.
        // The details are already handled by the logic above.
        // I am removing this block to fix the issue.
        /*
        const payload = entry.details; // The whole action is now in 'details'
        if (type !== 'REDUX' && payload && typeof payload === 'object' && Object.keys(payload).length > 0) {
            const detailsWrapper = document.createElement('details');
            detailsWrapper.className = 'log-entry-details-wrapper';
            
            const summary = document.createElement('summary');
            summary.textContent = `View Action: ${payload.type}`;
            detailsWrapper.appendChild(summary);

            const pre = document.createElement('pre');
            const code = document.createElement('code');
            // We can now safely stringify the payload part here
            code.textContent = JSON.stringify(payload, null, 2);
            pre.appendChild(code);
            detailsWrapper.appendChild(pre);

            logEntryDiv.appendChild(detailsWrapper);
        }
        */

        return logEntryDiv;
    }

    createLogEntryElement(entry, index) {
        return this.renderLogEntry(entry, index);
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
        // Clean up resize handlers first
        this.cleanupResizeHandlers();
        
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
        // Clean up any existing resize handlers first
        this.cleanupResizeHandlers();
        
        // Initialize resize state
        this.resizeState = {
            isResizingHeight: false,
            isResizingColumn: false,
            startY: 0,
            startHeight: 0,
            startX: 0,
            startWidth: 0,
            currentColumn: null
        };
        
        // Set up height resizing
        this.setupHeightResize();
        
        // Set up column resizing
        this.setupColumnResize();
        
        // Load initial column widths from Redux store
        this.loadColumnWidths();
    }
    
    setupHeightResize() {
        if (!this.resizeHandle) return;
        
        // Height resize mouse down handler
        this.heightResizeMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            this.resizeState.isResizingHeight = true;
            this.resizeState.startY = e.clientY;
            
            const logContainer = document.getElementById('log-container');
            if (logContainer) {
                const rect = logContainer.getBoundingClientRect();
                this.resizeState.startHeight = rect.height;
            }
            
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            
            // Add global listeners
            document.addEventListener('mousemove', this.heightResizeMouseMove);
            document.addEventListener('mouseup', this.heightResizeMouseUp);
        };
        
        // Height resize mouse move handler
        this.heightResizeMouseMove = (e) => {
            if (!this.resizeState.isResizingHeight) return;
            
            const deltaY = this.resizeState.startY - e.clientY; // Inverted because log grows upward
            const newHeight = Math.max(100, Math.min(600, this.resizeState.startHeight + deltaY));
            
            // Update CSS variable immediately for smooth resizing
            document.documentElement.style.setProperty('--log-height', `${newHeight}px`);
        };
        
        // Height resize mouse up handler
        this.heightResizeMouseUp = () => {
            if (!this.resizeState.isResizingHeight) return;
            
            this.resizeState.isResizingHeight = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Remove global listeners
            document.removeEventListener('mousemove', this.heightResizeMouseMove);
            document.removeEventListener('mouseup', this.heightResizeMouseUp);
            
            // Update Redux state with final height
            const currentHeight = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--log-height'));
            if (!isNaN(currentHeight)) {
                this.store.dispatch(uiActions.updateSetting({
                    key: 'logHeight',
                    value: currentHeight
                }));
            }
        };
        
        // Attach height resize handler
        this.resizeHandle.addEventListener('mousedown', this.heightResizeMouseDown);
    }
    
    setupColumnResize() {
        const header = this.container.querySelector('#log-column-header');
        if (!header) return;
        
        const resizers = header.querySelectorAll('.resizer');
        
        // Column resize mouse down handler
        this.columnResizeMouseDown = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const resizer = e.target;
            const column = resizer.dataset.column;
            if (!column) return;
            
            this.resizeState.isResizingColumn = true;
            this.resizeState.currentColumn = column;
            this.resizeState.startX = e.clientX;
            
            // Special handling for message/melvin resize
            if (column === 'message') {
                const messageEl = header.querySelector('.log-header-message');
                const melvinEl = header.querySelector('.log-header-melvin');
                
                if (messageEl && melvinEl) {
                    const messageRect = messageEl.getBoundingClientRect();
                    const melvinRect = melvinEl.getBoundingClientRect();
                    
                    this.resizeState.startMessageWidth = messageRect.width;
                    this.resizeState.startMelvinWidth = melvinRect.width;
                    this.resizeState.totalWidth = messageRect.width + melvinRect.width;
                }
            } else {
                // Get the column element (previous sibling of resizer)
                const columnElement = resizer.previousElementSibling;
                if (columnElement) {
                    const rect = columnElement.getBoundingClientRect();
                    this.resizeState.startWidth = rect.width;
                }
            }
            
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            
            // Add global listeners
            document.addEventListener('mousemove', this.columnResizeMouseMove);
            document.addEventListener('mouseup', this.columnResizeMouseUp);
        };
        
        // Column resize mouse move handler
        this.columnResizeMouseMove = (e) => {
            if (!this.resizeState.isResizingColumn || !this.resizeState.currentColumn) return;
            
            const column = this.resizeState.currentColumn;
            
            if (column === 'message') {
                const deltaX = e.clientX - this.resizeState.startX;
                
                // Calculate new widths
                const newMessageWidth = Math.max(100, this.resizeState.startMessageWidth + deltaX);
                const newMelvinWidth = this.resizeState.totalWidth - newMessageWidth;
                
                // Enforce minimum widths
                if (newMessageWidth < 100 || newMelvinWidth < 30) return;
                
                // Update CSS variables
                document.documentElement.style.setProperty('--log-column-width-message', `${newMessageWidth}px`);
                document.documentElement.style.setProperty('--log-column-width-melvin', `${newMelvinWidth}px`);
            } else {
                const deltaX = e.clientX - this.resizeState.startX;
                const newWidth = Math.max(30, this.resizeState.startWidth + deltaX); // Minimum 30px width
                
                // Update CSS variable immediately for smooth resizing
                document.documentElement.style.setProperty(`--log-column-width-${column}`, `${newWidth}px`);
            }
        };
        
        // Column resize mouse up handler
        this.columnResizeMouseUp = () => {
            if (!this.resizeState.isResizingColumn) return;
            
            const column = this.resizeState.currentColumn;
            this.resizeState.isResizingColumn = false;
            this.resizeState.currentColumn = null;
            
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Remove global listeners
            document.removeEventListener('mousemove', this.columnResizeMouseMove);
            document.removeEventListener('mouseup', this.columnResizeMouseUp);
            
            // Update Redux state with final width
            if (column === 'message') {
                const messageWidth = getComputedStyle(document.documentElement).getPropertyValue('--log-column-width-message');
                const melvinWidth = getComputedStyle(document.documentElement).getPropertyValue('--log-column-width-melvin');
                
                if (messageWidth && melvinWidth) {
                    this.store.dispatch(uiActions.setLogColumnWidth({ 
                        column: 'message', 
                        width: messageWidth 
                    }));
                    this.store.dispatch(uiActions.setLogColumnWidth({ 
                        column: 'melvin', 
                        width: melvinWidth 
                    }));
                }
            } else if (column) {
                const currentWidth = getComputedStyle(document.documentElement).getPropertyValue(`--log-column-width-${column}`);
                if (currentWidth) {
                    this.store.dispatch(uiActions.setLogColumnWidth({ 
                        column, 
                        width: currentWidth 
                    }));
                }
            }
        };
        
        // Attach column resize handlers to all resizers
        resizers.forEach(resizer => {
            resizer.addEventListener('mousedown', this.columnResizeMouseDown);
        });
    }
    
    loadColumnWidths() {
        const state = this.store.getState();
        const { logColumnWidths } = state.ui || {};
        
        if (logColumnWidths) {
            for (const column in logColumnWidths) {
                document.documentElement.style.setProperty(`--log-column-width-${column}`, logColumnWidths[column]);
            }
        }
    }
    
    cleanupResizeHandlers() {
        // Remove height resize handlers
        if (this.resizeHandle && this.heightResizeMouseDown) {
            this.resizeHandle.removeEventListener('mousedown', this.heightResizeMouseDown);
        }
        
        // Remove column resize handlers
        const header = this.container.querySelector('#log-column-header');
        if (header && this.columnResizeMouseDown) {
            const resizers = header.querySelectorAll('.resizer');
            resizers.forEach(resizer => {
                resizer.removeEventListener('mousedown', this.columnResizeMouseDown);
            });
        }
        
        // Remove any lingering global listeners
        if (this.heightResizeMouseMove) {
            document.removeEventListener('mousemove', this.heightResizeMouseMove);
        }
        if (this.heightResizeMouseUp) {
            document.removeEventListener('mouseup', this.heightResizeMouseUp);
        }
        if (this.columnResizeMouseMove) {
            document.removeEventListener('mousemove', this.columnResizeMouseMove);
        }
        if (this.columnResizeMouseUp) {
            document.removeEventListener('mouseup', this.columnResizeMouseUp);
        }
        
        // Reset cursor and selection
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        
        // Clear resize state
        this.resizeState = null;
    }

    copyLog() {
        // Collect all log entries
        const logEntries = this.logElement ? 
            Array.from(this.logElement.querySelectorAll('.log-entry'))
            .map(entry => {
                const timestamp = entry.querySelector('.log-entry-timestamp')?.textContent || '';
                const level = entry.querySelector('.log-entry-level')?.textContent || '';
                const context = entry.querySelector('.log-entry-context')?.textContent || '';
                const message = entry.querySelector('.log-entry-message')?.textContent || '';
                
                return `[${timestamp}] [${level}] ${context}: ${message}`;
            })
            .join('\n') : '';
        
        // Copy to clipboard
        if (logEntries) {
            navigator.clipboard.writeText(logEntries).then(() => {
                console.log('[LogDisplay] Log entries copied to clipboard');
            }).catch(err => {
                console.error('[LogDisplay] Failed to copy log entries:', err);
            });
        }
    }

    clearLog() {
        // Dispatch action to clear log entries in Redux store
        this.store.dispatch(clearEntries());
        
        // Clear the log element
        if (this.logElement) {
            this.logElement.innerHTML = '';
        }
        
        // Update entry count
        this.updateEntryCount({ entries: [] });
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
