import { appStore, dispatch } from '/client/appState.js';
import { setActiveFilters, toggleFilter, clearEntries } from '/client/store/slices/logSlice.js';

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

        // Hide All button (was Clear All)
        const hideAllButton = document.createElement('button');
        hideAllButton.textContent = 'Hide All';
        hideAllButton.className = 'log-tag-button clear-all-button';
        hideAllButton.dataset.action = 'clear-all';
        controlGroup.appendChild(hideAllButton);

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
            const shouldBeVisible = localStorage.getItem('logTypesVisible') !== 'false';
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
 * Handle filter button clicks (clear log, select all, clear all, individual filters)
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
            // Clear the main LogPanel
            if (window.logPanel && typeof window.logPanel.clearLog === 'function') {
                window.logPanel.clearLog();
            }
            
            // Clear the console log manager buffer
            if (window.consoleLogManager && typeof window.consoleLogManager.clearLogBuffer === 'function') {
                window.consoleLogManager.clearLogBuffer();
            }
            
            // Clear any other log manager that might exist
            if (window.logManager && window.logManager !== window.consoleLogManager && typeof window.logManager.clearLogBuffer === 'function') {
                window.logManager.clearLogBuffer();
            }
            
            // Also reset filters in the state
            dispatch(clearEntries());
            
            return; // Exit after clearing
        }

        // Handle Copy Log button
        if (action === 'copy-log') {
            if (window.logPanel && typeof window.logPanel.copyLog === 'function') {
                window.logPanel.copyLog();
                // Show feedback
                const originalContent = targetButton.innerHTML;
                targetButton.innerHTML = '✅';
                setTimeout(() => {
                    targetButton.innerHTML = originalContent;
                }, 2000);
            }
            return;
        }

        // Handle Select All button
        if (action === 'select-all') {
            dispatch(setActiveFilters([]));
            return;
        }

        // Handle Hide All button
        if (action === 'clear-all') {
            dispatch(setActiveFilters(['__CLEAR_ALL__']));
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
                localStorage.setItem('logTypesVisible', String(isHidden));
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
    
    const controlButtons = [
        { text: 'Select All', action: 'select-all' },
        { text: 'Clear All', action: 'clear-all' }
    ];

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
export function applyFiltersToLogEntries(logElement, activeFilters, updateEntryCountCallback) {
    if (!logElement) return;

    const filtersByCategory = { source: [], type: [], subtype: [], level: [] };
    const hasActiveCategory = { source: false, type: false, subtype: false, level: false };

    // If filters are active, parse them into categories.
    if (activeFilters && activeFilters.length > 0 && !activeFilters.includes('__CLEAR_ALL__')) {
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
    const shouldHideAll = activeFilters && activeFilters.includes('__CLEAR_ALL__');

    allEntries.forEach(entry => {
        // Ensure we're only processing element nodes
        if (entry.nodeType !== 1) return;

        let isHidden = false;
        if (shouldHideAll) {
            isHidden = true;
        } else {
            const entrySource = (entry.dataset.source || '').toUpperCase();
            const entryType = (entry.dataset.logType || '').toUpperCase();
            const entrySubtype = (entry.dataset.logSubtype || '').toUpperCase();
            const entryLevel = (entry.dataset.logLevel || '').toUpperCase();

            // An entry is visible if it matches the active filters for each category.
            // If a category has no active filters, it's considered a match.
            const sourceMatch = !hasActiveCategory.source || filtersByCategory.source.includes(entrySource);
            const typeMatch = !hasActiveCategory.type || filtersByCategory.type.includes(entryType);
            const subtypeMatch = !hasActiveCategory.subtype || filtersByCategory.subtype.includes(entrySubtype);
            const levelMatch = !hasActiveCategory.level || filtersByCategory.level.includes(entryLevel);

            if (!(sourceMatch && typeMatch && subtypeMatch && levelMatch)) {
                isHidden = true;
            }
        }

        entry.classList.toggle('log-entry-hidden-by-filter', isHidden);
        if (!isHidden) {
            visibleCount++;
        }
    });

    if (typeof updateEntryCountCallback === 'function') {
        updateEntryCountCallback(allEntries.length, visibleCount);
    }
}

function saveFilterSnapshot(state) {
    try {
        localStorage.setItem('logFilterSnapshot', JSON.stringify(state));
    } catch (e) {
        console.warn('Could not save log filter snapshot to localStorage:', e);
    }
}

function loadFilterSnapshot() {
    try {
        const snapshot = localStorage.getItem('logFilterSnapshot');
        return snapshot ? JSON.parse(snapshot) : null;
    } catch (e) {
        console.warn('Could not load log filter snapshot from localStorage:', e);
        return null;
    }
}

function saveFilterPreset(state) {
    try {
        localStorage.setItem('logFilterPreset', JSON.stringify(state));
    } catch (e) {
        console.warn('Could not save log filter preset to localStorage:', e);
    }
}

function loadFilterPreset() {
    try {
        const preset = localStorage.getItem('logFilterPreset');
        return preset ? JSON.parse(preset) : [];
    } catch (e) {
        console.warn('Could not load log filter preset from localStorage:', e);
        return [];
    }
}
