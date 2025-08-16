import { appStore, dispatch } from '/client/appState.js';
import { setActiveFilters, toggleFilter, clearEntries } from '/client/store/slices/logSlice.js';
import { storageService } from '/client/services/storageService.js';

/**
 * Utility function to extract emoji symbols from CSS variable tokens
 * Converts "var(--icon-copy, '📋')" to "📋"
 */
function extractIconFromCSSVar(text) {
    if (typeof text !== 'string') return text;
    
    // Match CSS variable pattern: var(--icon-name, 'emoji')
    const cssVarPattern = /var\(--icon-[^,]+,\s*['"]([^'"]+)['"]\)/g;
    return text.replace(cssVarPattern, '$1');
}

let tagsBarElementRef = null;
let storeUnsubscribe = null;
let filterSnapshot = null; // Or use localStorage for persistence
let filterPreset = null;

function logFilterBarMessage(message, level = 'debug') {
    // Optional: local logger for this module if needed for debugging its own ops
    // For now, assume major logging is handled by appStore changes elsewhere or not needed
    console.log(`[LogFilterBar] ${message}`);
}

// Extract the 4 categories: LEVEL, SOURCE, TYPE, SUBTYPE
function extractCategoriesFromLogEntries() {
    const categories = {
        sources: new Set(),   // SOURCE (DEVPAGES, DEVPAGES_SERVER, etc.)
        types: new Set(),     // TYPE (CONSOLE_LOG_PANEL, PREVIEW, AUTH, etc.)
        subtypes: new Set(),  // SUBTYPE (FILTER_REFRESH, MANAGER_UPDATE, etc.)
        levels: new Set()     // LEVEL (DEBUG, INFO, WARN, ERROR)
    };

    const logElement = document.getElementById('log');
    if (logElement) {
        const logEntries = logElement.querySelectorAll('.log-entry');
        logEntries.forEach(entry => {
            if (entry.dataset.source) categories.sources.add(entry.dataset.source.toUpperCase());
            if (entry.dataset.logType) categories.types.add(entry.dataset.logType.toUpperCase());
            if (entry.dataset.logSubtype) categories.subtypes.add(entry.dataset.logSubtype.toUpperCase());
            if (entry.dataset.logLevel) categories.levels.add(entry.dataset.logLevel.toUpperCase());
        });
    }

    return {
        sources: Array.from(categories.sources).sort(),
        types: Array.from(categories.types).sort(),
        subtypes: Array.from(categories.subtypes).sort(),
        levels: Array.from(categories.levels).sort()
    };
}

function createCategoryGroup(container, title, items, categoryType, activeFilters) {
    if (items.length === 0) return;

    const groupContainer = document.createElement('div');
    groupContainer.className = 'log-filter-group';
    groupContainer.dataset.category = categoryType; // For easier selection
    
    if (categoryType !== 'type') { // Do not add a label for the 'type' category
        const groupLabel = document.createElement('span');
        groupLabel.className = 'log-filter-group-label';
        groupLabel.textContent = title + ':';
        groupContainer.appendChild(groupLabel);
    }

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
        
        // Normal filtering mode
        if (activeFilters.length > 0) {
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
    return groupContainer; // Return the created group
}

function _updateDisplay(discoveredTypes, activeFilters) {
    if (!tagsBarElementRef) return;
    
    const safeActiveFilters = Array.isArray(activeFilters) ? activeFilters : [];
    
    try {
        tagsBarElementRef.innerHTML = '';
        tagsBarElementRef.dataset.visible = 'true';

        const controlsWrapper = document.createElement('div');
        controlsWrapper.className = 'log-controls-wrapper';

        // Left-aligned control buttons group
        const controlGroup = document.createElement('div');
        controlGroup.className = 'log-filter-control-group';

        // Search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.id = 'log-search-input';
        searchInput.className = 'log-search-input';
        searchInput.placeholder = 'Search logs...';
        searchInput.title = 'Search log messages (supports regex)';
        controlGroup.appendChild(searchInput);

        // Clear search button
        const clearSearchButton = document.createElement('button');
        clearSearchButton.className = 'log-tag-button clear-search-button';
        clearSearchButton.innerHTML = '✕';
        clearSearchButton.dataset.action = 'clear-search';
        clearSearchButton.title = 'Clear Search';
        clearSearchButton.style.display = 'none'; // Hidden by default
        controlGroup.appendChild(clearSearchButton);

        // Clear Log button
        const clearLogButton = document.createElement('button');
        clearLogButton.className = 'log-tag-button clear-log-button';
        clearLogButton.textContent = 'Clear Log';
        clearLogButton.dataset.action = 'clear-log';
        clearLogButton.title = 'Clear All Log Entries';
        controlGroup.appendChild(clearLogButton);



        // "Toggle Types" button
        const toggleTypesButton = document.createElement('button');
        toggleTypesButton.className = 'log-tag-button toggle-types-button';
        toggleTypesButton.textContent = 'Types';
        toggleTypesButton.dataset.action = 'toggle-types';
        toggleTypesButton.title = 'Show/Hide Type Filters';
        controlGroup.appendChild(toggleTypesButton);

        // Collapse All button (new)
        const collapseAllButton = document.createElement('button');
        collapseAllButton.innerHTML = '⊟'; // Minimize/collapse icon
        collapseAllButton.className = 'log-tag-button collapse-all-button';
        collapseAllButton.dataset.action = 'collapse-all';
        collapseAllButton.title = 'Collapse All Log Entries';
        controlGroup.appendChild(collapseAllButton);

        controlsWrapper.appendChild(controlGroup);

        // Right-aligned copy button group
        const copyGroup = document.createElement('div');
        copyGroup.className = 'log-filter-copy-group';

        // Copy button (copies visible entries)
        const copyButton = document.createElement('button');
        copyButton.innerHTML = `<img src="/client/styles/icons/copy.svg" alt="Copy" class="icon" />`;
        copyButton.className = 'log-tag-button copy-button';
        copyButton.dataset.action = 'copy-log';
        copyButton.title = 'Copy Visible Log Entries';
        copyGroup.appendChild(copyButton);
        controlsWrapper.appendChild(copyGroup);

        tagsBarElementRef.appendChild(controlsWrapper);

        // Filter groups (Sources, Types, etc.)
        const filterGroupsContainer = document.createElement('div');
        filterGroupsContainer.className = 'log-filter-groups-container';
        tagsBarElementRef.appendChild(filterGroupsContainer);

        // Extract all 4 categories from current log entries
        const categories = extractCategoriesFromLogEntries();

        // Create groups in order: SOURCE, TYPE, SUBTYPE, LEVEL
        createCategoryGroup(filterGroupsContainer, 'Source', categories.sources, 'source', safeActiveFilters);
        const typeGroup = createCategoryGroup(filterGroupsContainer, 'Type', categories.types, 'type', safeActiveFilters);
        if (typeGroup) {
            const shouldBeVisible = storageService.getItem('logTypesVisible') !== false;
            typeGroup.style.display = shouldBeVisible ? 'flex' : 'none'; // Use flex for proper group display
            toggleTypesButton.classList.toggle('active', shouldBeVisible);
        }
        createCategoryGroup(filterGroupsContainer, 'Subtype', categories.subtypes, 'subtype', safeActiveFilters);
        createCategoryGroup(filterGroupsContainer, 'Level', categories.levels, 'level', safeActiveFilters);

    } catch (error) {
        console.error('[LogFilterBar] Error in _updateDisplay:', error);
    }
}

function _handleGlobalClick(event) {
    const menuContainer = document.getElementById('log-menu-container');
    const menuButton = document.getElementById('log-help-toggle-btn');
    const state = appStore.getState();

    // If the menu is visible and the user clicks outside of it and its button, close it.
    if (
        state.ui.logMenuVisible &&
        menuContainer &&
        menuButton &&
        !menuContainer.contains(event.target) &&
        !menuButton.contains(event.target)
    ) {
        dispatch({ type: 'UI_TOGGLE_LOG_MENU' });
    }
}

/**
 * Handle filter button clicks (clear log, individual filters)
 * @param {Event} event - The click event
 */
export function _handleTagClick(event) {
    // Find the actual button element (in case the click target is a child element like SVG)
    let targetButton = event.target.closest('.log-tag-button');
    
    if (!targetButton) {
        return; // No valid button found
    }
    
    const action = targetButton.dataset.action;

    try {
        // Handle Clear Log button
        if (action === 'clear-log') {
            // Clear the main LogDisplay using APP namespace
            const logDisplay = window.APP?.services?.logDisplay || window.APP?.services?.logPanel || window.logPanel;
            if (logDisplay && typeof logDisplay.clearLog === 'function') {
                logDisplay.clearLog();
            }
            
            // Clear the console log manager buffer using APP namespace
            const consoleLogManager = window.APP?.services?.consoleLogManager || window.consoleLogManager;
            if (consoleLogManager && typeof consoleLogManager.clearLogBuffer === 'function') {
                consoleLogManager.clearLogBuffer();
            }
            
            // Clear any other log manager that might exist
            const logManager = window.APP?.services?.logManager || window.logManager;
            if (logManager && logManager !== consoleLogManager && typeof logManager.clearLogBuffer === 'function') {
                logManager.clearLogBuffer();
            }
            
            // Also reset filters in the state
            dispatch(clearEntries());
            
            return; // Exit after clearing
        }

        // Handle Copy Log button
        if (action === 'copy-log') {
            // Try APP namespace first, then legacy
            const logDisplay = window.APP?.services?.logDisplay || window.APP?.services?.logPanel || window.logPanel;
            if (logDisplay && typeof logDisplay.copyLog === 'function') {
                logDisplay.copyLog();
                // Show feedback
                const originalContent = targetButton.innerHTML;
                targetButton.innerHTML = '✅';
                setTimeout(() => {
                    targetButton.innerHTML = originalContent;
                }, 2000);
            }
            return;
        }

        // Handle Clear Search button
        if (action === 'clear-search') {
            const searchInput = document.getElementById('log-search-input');
            if (searchInput) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
                targetButton.style.display = 'none';
            }
            return;
        }



        // Handle Collapse All button
        if (action === 'collapse-all') {
            if (window.logPanel && typeof window.logPanel.hideAllEntries === 'function') {
                window.logPanel.hideAllEntries();
            }
            return;
        }

        if (action === 'toggle-types') {
            const typeGroup = tagsBarElementRef.querySelector('.log-filter-group[data-category="type"]');
            if (typeGroup) {
                const isHidden = typeGroup.style.display === 'none';
                typeGroup.style.display = isHidden ? 'flex' : 'none'; // Use flex to restore
                targetButton.classList.toggle('active', isHidden);
                storageService.setItem('logTypesVisible', isHidden);
            }
            return;
        }

        // Handle individual tag toggling
        const filterCategory = targetButton.dataset.filterCategory;
        const filterValue = targetButton.dataset.filterValue;
        
        if (filterCategory && filterValue) {
            const filterKey = `${filterCategory}:${filterValue}`;
            dispatch(toggleFilter(filterKey));
        }
    } catch (error) {
        console.error('[LogFilterBar] Error in _handleTagClick:', error);
    }
}

/**
 * Initialize the log filter bar with control buttons and discovered type filters
 * @param {HTMLElement} element - The tags bar element
 */
export function initializeLogFilterBar(element) {
    if (!element) {
        console.error('[LogFilterBar] Initialization failed: provided element is null.');
        return;
    }

    if (tagsBarElementRef && tagsBarElementRef === element && storeUnsubscribe) {
        // Already initialized and subscribed for this element
        // Force a display update in case state is stale
        const { discoveredTypes, activeFilters } = appStore.getState().logFiltering;
        _updateDisplay(discoveredTypes, activeFilters);
        return;
    }

    tagsBarElementRef = element;

    // Attach click handler using event delegation
    tagsBarElementRef.addEventListener('click', _handleTagClick);
    
    // Setup search functionality
    setupSearchFunctionality();
    
    // Subscribe to appStore state changes for logFiltering
    if (storeUnsubscribe) {
        storeUnsubscribe(); // Unsubscribe from any previous listeners
    }
    
    let lastKnownState = appStore.getState().logFiltering;

    storeUnsubscribe = appStore.subscribe(() => {
        const currentState = appStore.getState().logFiltering;
        
        // Basic dirty check to avoid unnecessary re-renders
        if (JSON.stringify(lastKnownState) !== JSON.stringify(currentState)) {
            _updateDisplay(currentState.discoveredTypes, currentState.activeFilters);
            
            // After updating display, apply filters to the entries in the log panel
            if (window.logPanel && typeof window.logPanel._applyFiltersToLogEntries === 'function') {
                window.logPanel._applyFiltersToLogEntries();
            }
            
            lastKnownState = currentState; // Update last known state
        }
    });

    // Initial render
    const { discoveredTypes, activeFilters } = lastKnownState;
    _updateDisplay(discoveredTypes, activeFilters);
    
    // Add a global click listener to handle clicks outside the filter bar if needed
    // This is for things like closing menus that might pop up from the filter bar
    document.addEventListener('click', _handleGlobalClick);

    // Load initial filter state from snapshot if available
    const snapshot = loadFilterSnapshot();
    if (snapshot && snapshot.activeFilters) {
        dispatch(setActiveFilters(snapshot.activeFilters));
    }


}

/**
 * Update the tags bar with current discovered types and active filter state
 * @param {HTMLElement} element - The tags bar element
 * @param {Object} logFilteringState - Current filtering state from app store
 */
export function updateTagsBar(element, logFilteringState) {
    if (!element || !logFilteringState) return;

    // Simple diffing
    const currentContent = element.dataset.renderedFor || '';
    const newContentSignature = `${(logFilteringState.discoveredTypes || []).join(',')}-${(logFilteringState.activeFilters || []).join(',')}`;

    if (currentContent === newContentSignature) return;

    element.innerHTML = '';
    element.dataset.visible = 'true';
    element.style.flexWrap = 'wrap';
    element.style.alignItems = 'center';
    element.style.gap = '0.25rem';
    element.style.padding = 'var(--space-2) var(--space-3)';
    element.style.borderBottom = '1px solid var(--color-border-primary)';

    const { discoveredTypes = [], activeFilters = [] } = logFilteringState;
    const allTypes = Array.from(new Set([...discoveredTypes, ...Object.values(logFilteringState.defaultFilters || {})]));
    
    const createFilterButton = (category, value, isActive) => {
        const button = document.createElement('button');
        button.className = 'log-tag-button';
        button.textContent = value;
        button.dataset.filterCategory = category;
        button.dataset.filterValue = value;
        button.classList.toggle('active', isActive);
        return button;
    };

    const createFilterGroup = (categories, sameLine = false) => {
        const group = document.createElement('div');
        group.className = 'log-filter-group';
        if (sameLine) {
            group.style.display = 'contents'; // Use contents to avoid extra div in flex layout
        }
        
        categories.forEach(type => {
            const isActive = !activeFilters.length || activeFilters.includes(`type:${type}`);
            const button = createFilterButton('type', type, isActive);
            group.appendChild(button);
        });

        return group;
    };
    
    const controlButtons = [];

    const controlGroup = document.createElement('div');
    controlGroup.className = 'log-filter-control-group';
    controlButtons.forEach(btnInfo => {
        const button = document.createElement('button');
        button.className = 'log-tag-button';
        button.textContent = btnInfo.text;
        button.dataset.action = btnInfo.action;
        controlGroup.appendChild(button);
    });
    element.appendChild(controlGroup);

    element.appendChild(createFilterGroup(allTypes));

    element.dataset.renderedFor = newContentSignature;
}

/**
 * Apply current filters to all log entries, showing/hiding them as appropriate
 * @param {HTMLElement} logElement - The log container element
 * @param {Array} activeFilters - Array of active filter strings like "type:API", "level:INFO"
 * @param {Function} updateEntryCountCallback - Function to call after filtering to update entry count
 */
// Performance optimized filtering with caching
let filterCache = new Map();
let lastFilterState = null;

export function applyFiltersToLogEntries(logElement, activeFilters, updateEntryCountCallback) {
    if (!logElement) return;

    // Cache key for this filter state
    const filterKey = JSON.stringify(activeFilters);
    
    // Check if we can use cached results
    if (lastFilterState === filterKey && filterCache.has(filterKey)) {
        const cachedResult = filterCache.get(filterKey);
        applyCachedFilters(logElement, cachedResult);
        if (typeof updateEntryCountCallback === 'function') {
            updateEntryCountCallback(cachedResult.totalCount, cachedResult.visibleCount);
        }
        return;
    }

    const filtersByCategory = { source: [], type: [], subtype: [], level: [] };
    const hasActiveCategory = { source: false, type: false, subtype: false, level: false };

    // Parse filters into categories
    if (activeFilters && activeFilters.length > 0) {
        activeFilters.forEach(filter => {
            const separatorIndex = filter.indexOf(':');
            if (separatorIndex > -1) {
                const category = filter.substring(0, separatorIndex);
                const value = filter.substring(separatorIndex + 1);
                if (filtersByCategory[category]) {
                    filtersByCategory[category].push(value.toUpperCase());
                    hasActiveCategory[category] = true;
                }
            }
        });
    }

    const allEntries = Array.from(logElement.children);
    let visibleCount = 0;
    const filterResults = [];

    // Use requestAnimationFrame for better performance on large datasets
    if (allEntries.length > 100) {
        processEntriesInBatches(allEntries, filtersByCategory, hasActiveCategory, 
            (results) => {
                applyFilterResults(logElement, results);
                const visible = results.filter(r => !r.hidden).length;
                if (typeof updateEntryCountCallback === 'function') {
                    updateEntryCountCallback(results.length, visible);
                }
                
                // Cache results
                filterCache.set(filterKey, { results, totalCount: results.length, visibleCount: visible });
                lastFilterState = filterKey;
            });
    } else {
        // Process smaller datasets synchronously
        allEntries.forEach((entry, index) => {
            if (entry.nodeType !== 1) return;

            const isHidden = !matchesFilters(entry, filtersByCategory, hasActiveCategory);
            filterResults.push({ index, hidden: isHidden });
            
            entry.classList.toggle('log-entry-hidden-by-filter', isHidden);
            if (!isHidden) {
                visibleCount++;
            }
        });

        // Cache results
        filterCache.set(filterKey, { results: filterResults, totalCount: allEntries.length, visibleCount });
        lastFilterState = filterKey;

        if (typeof updateEntryCountCallback === 'function') {
            updateEntryCountCallback(allEntries.length, visibleCount);
        }
    }
}

function matchesFilters(entry, filtersByCategory, hasActiveCategory) {
    const entrySource = (entry.dataset.source || '').toUpperCase();
    const entryType = (entry.dataset.logType || '').toUpperCase();
    const entrySubtype = (entry.dataset.logSubtype || '').toUpperCase();
    const entryLevel = (entry.dataset.logLevel || '').toUpperCase();

    const sourceMatch = !hasActiveCategory.source || filtersByCategory.source.includes(entrySource);
    const typeMatch = !hasActiveCategory.type || filtersByCategory.type.includes(entryType);
    const subtypeMatch = !hasActiveCategory.subtype || filtersByCategory.subtype.includes(entrySubtype);
    const levelMatch = !hasActiveCategory.level || filtersByCategory.level.includes(entryLevel);

    return sourceMatch && typeMatch && subtypeMatch && levelMatch;
}

function processEntriesInBatches(entries, filtersByCategory, hasActiveCategory, callback) {
    const batchSize = 50;
    const results = [];
    let currentIndex = 0;

    function processBatch() {
        const endIndex = Math.min(currentIndex + batchSize, entries.length);
        
        for (let i = currentIndex; i < endIndex; i++) {
            const entry = entries[i];
            if (entry.nodeType !== 1) continue;

            const isHidden = !matchesFilters(entry, filtersByCategory, hasActiveCategory);
            results.push({ index: i, hidden: isHidden });
        }

        currentIndex = endIndex;

        if (currentIndex < entries.length) {
            requestAnimationFrame(processBatch);
        } else {
            callback(results);
        }
    }

    requestAnimationFrame(processBatch);
}

function applyFilterResults(logElement, results) {
    const entries = Array.from(logElement.children);
    results.forEach(result => {
        const entry = entries[result.index];
        if (entry) {
            entry.classList.toggle('log-entry-hidden-by-filter', result.hidden);
        }
    });
}

function applyCachedFilters(logElement, cachedResult) {
    applyFilterResults(logElement, cachedResult.results);
}

// Clear cache when needed (e.g., when log entries change significantly)
export function clearFilterCache() {
    filterCache.clear();
    lastFilterState = null;
}

function saveFilterSnapshot(state) {
    try {
        storageService.setItem('logFilterSnapshot', state);
    } catch (e) {
        console.warn('Could not save log filter snapshot to localStorage:', e);
    }
}

function loadFilterSnapshot() {
    try {
        return storageService.getItem('logFilterSnapshot');
    } catch (e) {
        console.warn('Could not load log filter snapshot from localStorage:', e);
        return null;
    }
}

function saveFilterPreset(state) {
    try {
        storageService.setItem('logFilterPreset', state);
    } catch (e) {
        console.warn('Could not save log filter preset to localStorage:', e);
    }
}

function loadFilterPreset() {
    try {
        return storageService.getItem('logFilterPreset') || [];
    } catch (e) {
        console.warn('Could not load log filter preset from localStorage:', e);
        return [];
    }
}

let searchTimeout = null;

function setupSearchFunctionality() {
    // Setup search input listener with debouncing
    document.addEventListener('input', (event) => {
        if (event.target.id === 'log-search-input') {
            const searchTerm = event.target.value.trim();
            const clearButton = document.querySelector('[data-action="clear-search"]');
            
            // Show/hide clear button
            if (clearButton) {
                clearButton.style.display = searchTerm ? 'inline-block' : 'none';
            }
            
            // Debounce search to avoid excessive filtering
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performLogSearch(searchTerm);
            }, 300);
        }
    });
    
    // Setup Enter key handling for immediate search
    document.addEventListener('keydown', (event) => {
        if (event.target.id === 'log-search-input' && event.key === 'Enter') {
            clearTimeout(searchTimeout);
            performLogSearch(event.target.value.trim());
        }
    });
}

function performLogSearch(searchTerm) {
    const logElement = document.getElementById('log');
    if (!logElement) return;
    
    const entries = logElement.querySelectorAll('.log-entry');
    let visibleCount = 0;
    
    if (!searchTerm) {
        // No search term - show all entries (respect other filters)
        entries.forEach(entry => {
            entry.classList.remove('log-entry-hidden-by-search');
            if (!entry.classList.contains('log-entry-hidden-by-filter')) {
                visibleCount++;
            }
        });
    } else {
        // Perform search
        let searchRegex;
        try {
            // Try to use the search term as a regex
            searchRegex = new RegExp(searchTerm, 'i');
        } catch (e) {
            // If regex is invalid, escape special characters and use as literal string
            const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            searchRegex = new RegExp(escapedTerm, 'i');
        }
        
        entries.forEach(entry => {
            const messageElement = entry.querySelector('.log-entry-message');
            const typeElement = entry.querySelector('.log-entry-type');
            const levelElement = entry.querySelector('.log-entry-level');
            
            const message = messageElement?.textContent || '';
            const type = typeElement?.textContent || '';
            const level = levelElement?.textContent || '';
            
            // Search in message, type, and level
            const searchText = `${message} ${type} ${level}`;
            const matches = searchRegex.test(searchText);
            
            if (matches) {
                entry.classList.remove('log-entry-hidden-by-search');
                // Highlight matching text
                highlightSearchTerm(messageElement, searchTerm);
            } else {
                entry.classList.add('log-entry-hidden-by-search');
            }
            
            // Count visible entries (not hidden by search OR filter)
            if (!entry.classList.contains('log-entry-hidden-by-search') && 
                !entry.classList.contains('log-entry-hidden-by-filter')) {
                visibleCount++;
            }
        });
    }
    
    // Update entry count
    updateSearchResultCount(visibleCount, entries.length);
}

function highlightSearchTerm(element, searchTerm) {
    if (!element || !searchTerm) return;
    
    const originalText = element.textContent;
    let highlightedText;
    
    try {
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        highlightedText = originalText.replace(regex, '<mark class="search-highlight">$1</mark>');
    } catch (e) {
        // If regex fails, use simple string replacement
        const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedTerm})`, 'gi');
        highlightedText = originalText.replace(regex, '<mark class="search-highlight">$1</mark>');
    }
    
    element.innerHTML = highlightedText;
}

function updateSearchResultCount(visibleCount, totalCount) {
    const statusElement = document.getElementById('log-status');
    if (statusElement) {
        const searchInput = document.getElementById('log-search-input');
        const hasSearch = searchInput && searchInput.value.trim();
        
        if (hasSearch) {
            statusElement.textContent = `${visibleCount} of ${totalCount} entries (filtered)`;
        } else {
            statusElement.textContent = `${totalCount} entries`;
        }
    }
}
