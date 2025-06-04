import { appStore } from '/client/appState.js'; // Dependency

let tagsBarElementRef = null;
let storeUnsubscribe = null;

function logFilterBarMessage(message, level = 'debug') {
    // Optional: local logger for this module if needed for debugging its own ops
    // For now, assume major logging is handled by appStore changes elsewhere or not needed
    console.log(`[LogFilterBar] ${message}`);
}

// Extract the 4 categories: LEVEL, SOURCE, TYPE, SUBTYPE
function extractCategoriesFromLogEntries() {
    const categories = {
        levels: new Set(),
        sources: new Set(), 
        types: new Set(),
        subtypes: new Set()
    };

    const logElement = document.getElementById('log');
    if (logElement) {
        const logEntries = logElement.querySelectorAll('.log-entry');
        logEntries.forEach(entry => {
            // Extract from dataset (directly set by LogPanel)
            if (entry.dataset.logLevel) {
                categories.levels.add(entry.dataset.logLevel.toUpperCase());
            }
            if (entry.dataset.logType) {
                categories.types.add(entry.dataset.logType.toUpperCase());
            }
            if (entry.dataset.logSubtype) {
                categories.subtypes.add(entry.dataset.logSubtype.toUpperCase());
            }
            
            // Extract SOURCE from message pattern: [INDEX] TIMESTAMP [LEVEL] [SOURCE] [TYPE] message
            if (entry.dataset.rawOriginalMessage) {
                const message = entry.dataset.rawOriginalMessage;
                // Pattern: [0] 5:08:37 AM [INFO] [DEBUG] [AUTH_CHANGE_HANDLER] message
                const sourceMatch = message.match(/\[\d+\]\s+\d+:\d+:\d+\s+(AM|PM)\s+\[([A-Z]+)\]\s+\[([A-Z_]+)\]/);
                if (sourceMatch) {
                    categories.sources.add(sourceMatch[3]); // Third bracket is source
                }
            }
        });
    }

    return {
        levels: Array.from(categories.levels).sort(),
        sources: Array.from(categories.sources).sort(),
        types: Array.from(categories.types).sort(),
        subtypes: Array.from(categories.subtypes).sort()
    };
}

function createCategoryGroup(container, title, items, categoryType, activeFilters) {
    if (items.length === 0) return;

    const groupContainer = document.createElement('div');
    groupContainer.className = 'log-filter-group';
    
    const groupLabel = document.createElement('span');
    groupLabel.className = 'log-filter-group-label';
    groupLabel.textContent = title + ':';
    groupContainer.appendChild(groupLabel);

    items.forEach(item => {
        const button = document.createElement('button');
        button.className = `log-tag-button filter-${categoryType}`;
        button.textContent = item;
        button.dataset.filterCategory = categoryType;
        button.dataset.filterValue = item;
        button.dataset.logType = `${categoryType}:${item}`;
        
        // Determine if this specific filter is currently active
        const filterKey = `${categoryType}:${item}`;
        let isCurrentlyActive = false;
        
        // Special case: Clear All mode
        if (activeFilters.includes('__CLEAR_ALL__')) {
            isCurrentlyActive = false;
        }
        // Normal filtering mode
        else if (activeFilters.length > 0) {
            isCurrentlyActive = activeFilters.includes(filterKey);
        }
        // Initial state (no filters) - default behavior
        else {
            // Default: all active except LOG_PANEL type
            isCurrentlyActive = !(categoryType === 'type' && item === 'LOG_PANEL');
        }
        
        // Apply the correct visual state
        if (isCurrentlyActive) {
            button.classList.add('active');
            button.classList.remove('ghost');
        } else {
            button.classList.add('ghost');
            button.classList.remove('active');
        }
        
        groupContainer.appendChild(button);
    });

    container.appendChild(groupContainer);
}

function _updateDisplay(discoveredTypes, activeFilters) {
    if (!tagsBarElementRef) return;
    
    const safeActiveFilters = Array.isArray(activeFilters) ? activeFilters : [];
    
    try {
        tagsBarElementRef.innerHTML = '';
        tagsBarElementRef.style.display = 'flex';

        // Control buttons group
        const controlGroup = document.createElement('div');
        controlGroup.className = 'log-filter-control-group';

        // Clear Log button
        const clearLogButton = document.createElement('button');
        clearLogButton.className = 'log-tag-button clear-log-button';
        clearLogButton.textContent = 'Clear Log';
        clearLogButton.dataset.action = 'clear-log';
        clearLogButton.title = 'Clear All Log Entries';
        controlGroup.appendChild(clearLogButton);

        // Select All button  
        const selectAllButton = document.createElement('button');
        selectAllButton.className = 'log-tag-button select-all-button';
        selectAllButton.textContent = 'Select All';
        selectAllButton.dataset.action = 'select-all';
        selectAllButton.title = 'Show All Log Types';
        controlGroup.appendChild(selectAllButton);

        // Clear All button
        const clearAllButton = document.createElement('button');
        clearAllButton.className = 'log-tag-button clear-all-button';
        clearAllButton.textContent = 'Clear All';
        clearAllButton.dataset.action = 'clear-all';
        clearAllButton.title = 'Hide All Log Types';
        controlGroup.appendChild(clearAllButton);

        // Clear Filters button (reset to default)
        const clearFiltersButton = document.createElement('button');
        clearFiltersButton.className = 'log-tag-button clear-filters-button';
        clearFiltersButton.textContent = 'Reset';
        clearFiltersButton.dataset.action = 'clear-filters';
        clearFiltersButton.title = 'Reset to Default (LOG_PANEL off)';
        controlGroup.appendChild(clearFiltersButton);

        tagsBarElementRef.appendChild(controlGroup);

        // Extract all 4 categories from current log entries
        const categories = extractCategoriesFromLogEntries();

        // Create groups in order: LEVEL, SOURCE, TYPE, SUBTYPE
        // Pass the current activeFilters so buttons show correct state
        createCategoryGroup(tagsBarElementRef, 'Level', categories.levels, 'level', safeActiveFilters);
        createCategoryGroup(tagsBarElementRef, 'Source', categories.sources, 'source', safeActiveFilters);  
        createCategoryGroup(tagsBarElementRef, 'Type', categories.types, 'type', safeActiveFilters);
        createCategoryGroup(tagsBarElementRef, 'Subtype', categories.subtypes, 'subtype', safeActiveFilters);

    } catch (error) {
        console.error('[LogFilterBar] Error in _updateDisplay:', error);
    }
}

function _handleTagClick(event) {
    try {
        const targetButton = event.target.closest('.log-tag-button');
        if (!targetButton) return;

        const action = targetButton.dataset.action;

        // Handle Clear Log button
        if (action === 'clear-log') {
            if (window.logPanel && typeof window.logPanel.clearLog === 'function') {
                window.logPanel.clearLog();
            }
            return;
        }

        // Handle Select All - turn on all filters
        if (action === 'select-all') {
            const categories = extractCategoriesFromLogEntries();
            const allActiveFilters = [];
            
            ['level', 'source', 'type', 'subtype'].forEach(categoryType => {
                const items = categories[categoryType + 's'] || [];
                items.forEach(item => {
                    allActiveFilters.push(`${categoryType}:${item}`);
                });
            });
            
            appStore.update(prevState => ({
                ...prevState,
                logFiltering: {
                    ...prevState.logFiltering,
                    activeFilters: allActiveFilters
                }
            }));
            return;
        }

        // Handle Clear All - turn off all filters (special marker to hide everything)
        if (action === 'clear-all') {
            appStore.update(prevState => ({
                ...prevState,
                logFiltering: {
                    ...prevState.logFiltering,
                    activeFilters: ['__CLEAR_ALL__'] // Special marker for "hide everything"
                }
            }));
            return;
        }

        // Handle Reset - default state (all on except LOG_PANEL)
        if (action === 'clear-filters') {
            const categories = extractCategoriesFromLogEntries();
            const defaultActiveFilters = [];
            
            ['level', 'source', 'type', 'subtype'].forEach(categoryType => {
                const items = categories[categoryType + 's'] || [];
                items.forEach(item => {
                    if (!(categoryType === 'type' && item === 'LOG_PANEL')) {
                        defaultActiveFilters.push(`${categoryType}:${item}`);
                    }
                });
            });
            
            appStore.update(prevState => ({
                ...prevState,
                logFiltering: {
                    ...prevState.logFiltering,
                    activeFilters: defaultActiveFilters
                }
            }));
            return;
        }

        // Handle individual category filter toggle
        const filterType = targetButton.dataset.logType;
        if (filterType) {
            appStore.update(prevState => {
                const currentFiltering = prevState.logFiltering || { discoveredTypes: [], activeFilters: [] };
                let currentActiveFilters = currentFiltering.activeFilters || [];
                
                // If currently in "clear all" mode, start fresh
                if (currentActiveFilters.includes('__CLEAR_ALL__')) {
                    currentActiveFilters = [];
                }
                
                let newActiveFilters;
                if (currentActiveFilters.includes(filterType)) {
                    newActiveFilters = currentActiveFilters.filter(t => t !== filterType);
                } else {
                    newActiveFilters = [...currentActiveFilters, filterType];
                }
                
                return {
                    ...prevState,
                    logFiltering: {
                        discoveredTypes: currentFiltering.discoveredTypes || [],
                        activeFilters: newActiveFilters
                    }
                };
            });
        }
    } catch (error) {
        console.error('[LogFilterBar] Error in _handleTagClick:', error);
    }
}

export function initializeLogFilterBar(element) {
    if (!element) {
        console.error('[LogFilterBar] Initialization failed: target element not provided.');
        return;
    }
    
    try {
        tagsBarElementRef = element;
        tagsBarElementRef.addEventListener('click', _handleTagClick);

        if (storeUnsubscribe) storeUnsubscribe();
        
        storeUnsubscribe = appStore.subscribe((newState, prevState) => {
            try {
                const newFiltering = newState.logFiltering || { discoveredTypes: [], activeFilters: [] };
                const prevFiltering = prevState.logFiltering || { discoveredTypes: [], activeFilters: [] };
                
                if (JSON.stringify(newFiltering) !== JSON.stringify(prevFiltering)) {
                    _updateDisplay(newFiltering.discoveredTypes, newFiltering.activeFilters);
                }
            } catch (error) {
                console.error('[LogFilterBar] Error in store subscription:', error);
            }
        });
        
        const currentState = appStore.getState();
        const initialFiltering = currentState.logFiltering || { discoveredTypes: [], activeFilters: [] };
        _updateDisplay(initialFiltering.discoveredTypes || [], initialFiltering.activeFilters || []);
        
        logFilterBarMessage('Initialized.');
    } catch (error) {
        console.error('[LogFilterBar] Error during initialization:', error);
    }
}

export function destroyLogFilterBar() {
    try {
        if (storeUnsubscribe) {
            storeUnsubscribe();
            storeUnsubscribe = null;
        }
        if (tagsBarElementRef) {
            tagsBarElementRef.removeEventListener('click', _handleTagClick);
            tagsBarElementRef.innerHTML = '';
        }
        tagsBarElementRef = null;
        logFilterBarMessage('Destroyed.');
    } catch (error) {
        console.error('[LogFilterBar] Error during destruction:', error);
    }
}

/**
 * Updates the tags bar with categorized filter buttons
 */
export function updateTagsBar(tagsBarElement, logFilteringState) {
    if (!tagsBarElement) {
        console.warn('Tags bar element not found for update.');
        return;
    }

    try {
        const safeState = logFilteringState || { discoveredTypes: [], activeFilters: [] };
        _updateDisplay(safeState.discoveredTypes || [], safeState.activeFilters || []);
    } catch (error) {
        console.error('[LogFilterBar] Error in updateTagsBar:', error);
    }
}

/**
 * Applies categorized filters to log entries
 */
export function applyFiltersToLogEntries(logElement, activeFilters, updateEntryCountCallback) {
    if (!logElement) {
        console.warn('Log element not found for applying filters.');
        return;
    }

    try {
        const safeActiveFilters = Array.isArray(activeFilters) ? activeFilters : [];
        const logEntries = logElement.querySelectorAll('.log-entry');

        logEntries.forEach(entry => {
            let shouldShow = true; // Default: show everything

            // Special case: "Clear All" mode - hide everything
            if (safeActiveFilters.includes('__CLEAR_ALL__')) {
                shouldShow = false;
            }
            // If filters are active, apply proper AND logic between categories
            else if (safeActiveFilters.length > 0) {
                // Group filters by category
                const filtersByCategory = {
                    level: [],
                    source: [],
                    type: [],
                    subtype: []
                };

                safeActiveFilters.forEach(filter => {
                    const [category, value] = filter.split(':');
                    if (filtersByCategory[category]) {
                        filtersByCategory[category].push(value);
                    }
                });

                // Entry must match ALL active categories (AND logic between categories)
                shouldShow = true;

                // Check level category
                if (filtersByCategory.level.length > 0) {
                    const entryLevel = entry.dataset.logLevel;
                    if (!entryLevel || !filtersByCategory.level.includes(entryLevel)) {
                        shouldShow = false;
                    }
                }

                // Check source category
                if (shouldShow && filtersByCategory.source.length > 0) {
                    let sourceMatches = false;
                    if (entry.dataset.rawOriginalMessage) {
                        const sourceMatch = entry.dataset.rawOriginalMessage.match(/\[\d+\]\s+\d+:\d+:\d+\s+(AM|PM)\s+\[([A-Z]+)\]\s+\[([A-Z_]+)\]/);
                        if (sourceMatch && filtersByCategory.source.includes(sourceMatch[3])) {
                            sourceMatches = true;
                        }
                    }
                    if (!sourceMatches) {
                        shouldShow = false;
                    }
                }

                // Check type category
                if (shouldShow && filtersByCategory.type.length > 0) {
                    const entryType = entry.dataset.logType;
                    if (!entryType || !filtersByCategory.type.includes(entryType)) {
                        shouldShow = false;
                    }
                }

                // Check subtype category
                if (shouldShow && filtersByCategory.subtype.length > 0) {
                    const entrySubtype = entry.dataset.logSubtype;
                    if (!entrySubtype || !filtersByCategory.subtype.includes(entrySubtype)) {
                        shouldShow = false;
                    }
                }
            }
            // If no filters are active (initial state), apply default filtering (hide LOG_PANEL)
            else {
                const isLogPanel = entry.dataset.logType === 'LOG_PANEL';
                shouldShow = !isLogPanel; // Show everything except LOG_PANEL
            }

            if (shouldShow) {
                entry.classList.remove('log-entry-hidden-by-filter');
            } else {
                entry.classList.add('log-entry-hidden-by-filter');
            }
        });
        
        if (typeof updateEntryCountCallback === 'function') {
            updateEntryCountCallback();
        }
    } catch (error) {
        console.error('[LogFilterBar] Error in applyFiltersToLogEntries:', error);
    }
}
