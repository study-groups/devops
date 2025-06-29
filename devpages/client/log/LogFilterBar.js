import { appStore } from '/client/appState.js'; // Dependency

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
        clearAllButton.textContent = 'Hide All';
        clearAllButton.className = 'log-tag-button clear-all-button';
        clearAllButton.dataset.action = 'clear-all';
        controlGroup.appendChild(clearAllButton);

        // Collapse All button (new)
        const collapseAllButton = document.createElement('button');
        collapseAllButton.innerHTML = '⊟'; // Minimize/collapse icon
        collapseAllButton.className = 'log-tag-button collapse-all-button';
        collapseAllButton.dataset.action = 'collapse-all';
        collapseAllButton.title = 'Collapse All Log Entries';
        controlGroup.appendChild(collapseAllButton);

        // Copy button (copies visible entries)
        const copyButton = document.createElement('button');
        copyButton.innerHTML = '📋';
        copyButton.className = 'log-tag-button copy-button';
        copyButton.dataset.action = 'copy-log';
        copyButton.title = 'Copy Visible Log Entries';
        controlGroup.appendChild(copyButton);

        // Preset button (reset to preset, long-hold to set)
        const presetButton = document.createElement('button');
        presetButton.className = 'log-tag-button preset-button';
        presetButton.textContent = 'Preset';
        presetButton.dataset.action = 'preset';
        presetButton.title = 'Restore filter preset (hold to set preset)';
        controlGroup.appendChild(presetButton);

        // Dual-function: short click restores, long hold saves
        let pressTimer = null;
        let pressStart = 0;
        presetButton.addEventListener('mousedown', (e) => {
            pressStart = Date.now();
            pressTimer = setTimeout(() => {
                // Long hold: save preset (do NOT change filter state)
                const currentFilters = appStore.getState().logFiltering.activeFilters;
                saveFilterPreset(currentFilters);
                logMessage('Saved filter preset!', 'info', 'LOG_FILTER', 'PRESET', { component: 'LogFilterBar' });
                // Visual feedback
                presetButton.textContent = 'Preset Saved!';
                presetButton.classList.add('preset-saved');
                setTimeout(() => {
                    presetButton.textContent = 'Preset';
                    presetButton.classList.remove('preset-saved');
                }, 1200);
            }, 900); // 900ms threshold for long hold
        });
        presetButton.addEventListener('mouseup', (e) => {
            clearTimeout(pressTimer);
            const held = Date.now() - pressStart;
            if (held < 900) {
                // Short click: restore preset
                const preset = loadFilterPreset();
                appStore.update(prevState => ({
                    ...prevState,
                    logFiltering: {
                        ...prevState.logFiltering,
                        activeFilters: preset,
                        isInitialized: true
                    }
                }));
                if (window.logPanel) {
                    window.logPanel._applyFiltersToLogEntries();
                    window.logPanel._updateTagsBar();
                }
                logMessage('Restored filter preset!', 'info', 'LOG_FILTER', 'PRESET', { component: 'LogFilterBar' });
            }
        });
        presetButton.addEventListener('mouseleave', () => {
            clearTimeout(pressTimer);
        });

        tagsBarElementRef.appendChild(controlGroup);

        // Extract all 4 categories from current log entries
        const categories = extractCategoriesFromLogEntries();

        // Create groups in order: SOURCE, TYPE, SUBTYPE, LEVEL
        // Pass the current activeFilters so buttons show correct state
        createCategoryGroup(tagsBarElementRef, 'Source', categories.sources, 'source', safeActiveFilters);
        createCategoryGroup(tagsBarElementRef, 'Type', categories.types, 'type', safeActiveFilters);  
        createCategoryGroup(tagsBarElementRef, 'Subtype', categories.subtypes, 'subtype', safeActiveFilters);
        createCategoryGroup(tagsBarElementRef, 'Level', categories.levels, 'level', safeActiveFilters);

    } catch (error) {
        console.error('[LogFilterBar] Error in _updateDisplay:', error);
    }
}

/**
 * Handle filter button clicks (clear log, select all, clear all, individual filters)
 * @param {Event} event - The click event
 */
function _handleTagClick(event) {
    const targetButton = event.target;
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
            
            // Clear any API log buffers if they exist
            if (window.apiLogBuffer && typeof window.apiLogBuffer.clear === 'function') {
                window.apiLogBuffer.clear();
            }
            
            // Clear any timing registry if it exists
            if (window.__timingRegistry && typeof window.__timingRegistry.clear === 'function') {
                window.__timingRegistry.clear();
            }
            
            // Force clear any remaining DOM log entries
            const logElement = document.querySelector('#log, .log-entries, #log-entries, .log-panel .log-content');
            if (logElement) {
                logElement.innerHTML = '';
            }
            
            // Also clear from the LogPanel instance directly if available
            if (window.logPanel && window.logPanel.logElement) {
                window.logPanel.logElement.innerHTML = '';
            }
            
            // Reset any global log counters
            if (window.logEntryIndex !== undefined) {
                window.logEntryIndex = 0;
            }
            
            console.log('[LogPanel] Comprehensive log clear completed');
            return;
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

        // Handle Select All - clear all active filters to show everything
        if (action === 'select-all') {
            appStore.update(prevState => ({
                ...prevState,
                logFiltering: {
                    ...prevState.logFiltering,
                    activeFilters: [],
                    isInitialized: true
                }
            }));
            return;
        }

        // Handle Clear All - hide everything by setting a special flag
        if (action === 'clear-all') {
            appStore.update(prevState => ({
                ...prevState,
                logFiltering: {
                    ...prevState.logFiltering,
                    activeFilters: ['__HIDE_ALL__'],
                    isInitialized: true
                }
            }));
            return;
        }

        // Handle Collapse All - collapse all expanded log entries
        if (action === 'collapse-all') {
            if (window.logPanel && typeof window.logPanel.hideAllEntries === 'function') {
                window.logPanel.hideAllEntries();
            }
            return;
        }

        // Handle individual filter toggle
        const filterKey = targetButton.dataset.filterKey; // e.g., "type:API", "level:INFO"
        if (filterKey) {
            appStore.update(prevState => {
                const currentFiltering = prevState.logFiltering || { activeFilters: [] };
                const oldFilters = currentFiltering.activeFilters || [];
                let newFilters;

                // If we were hiding all, start fresh with just the clicked filter
                if (oldFilters.includes('__HIDE_ALL__')) {
                    newFilters = [filterKey];
                } else if (oldFilters.includes(filterKey)) {
                    // Filter is active, remove it
                    newFilters = oldFilters.filter(f => f !== filterKey);
                } else {
                    // Filter is not active, add it
                    newFilters = [...oldFilters, filterKey];
                }

                return {
                    ...prevState,
                    logFiltering: {
                        ...currentFiltering,
                        activeFilters: newFilters,
                        isInitialized: true
                    }
                };
            });
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
    if (!element) return;

    // Clear existing content
    element.innerHTML = '';

    // Create control group
    const controlGroup = document.createElement('div');
    controlGroup.className = 'log-filter-control-group';

    // Clear Log button
    const clearLogButton = document.createElement('button');
    clearLogButton.textContent = 'Clear Log';
    clearLogButton.className = 'log-tag-button clear-log-button';
    clearLogButton.dataset.action = 'clear-log';
    controlGroup.appendChild(clearLogButton);

    // Select All button (shows all logs)
    const selectAllButton = document.createElement('button');
    selectAllButton.textContent = 'Show All';
    selectAllButton.className = 'log-tag-button select-all-button';
    selectAllButton.dataset.action = 'select-all';
    controlGroup.appendChild(selectAllButton);

    // Clear All button (hides all logs)
    const clearAllButton = document.createElement('button');
    clearAllButton.textContent = 'Hide All';
    clearAllButton.className = 'log-tag-button clear-all-button';
    clearAllButton.dataset.action = 'clear-all';
    controlGroup.appendChild(clearAllButton);

    // Collapse All button (new)
    const collapseAllButton = document.createElement('button');
    collapseAllButton.innerHTML = '⊟'; // Minimize/collapse icon
    collapseAllButton.className = 'log-tag-button collapse-all-button';
    collapseAllButton.dataset.action = 'collapse-all';
    collapseAllButton.title = 'Collapse All Log Entries';
    controlGroup.appendChild(collapseAllButton);

    // Copy button (copies visible entries)
    const copyButton = document.createElement('button');
    copyButton.innerHTML = '📋';
    copyButton.className = 'log-tag-button copy-button';
    copyButton.dataset.action = 'copy-log';
    copyButton.title = 'Copy Visible Log Entries';
    controlGroup.appendChild(copyButton);

    element.appendChild(controlGroup);

    // Add event listener
    element.addEventListener('click', _handleTagClick);
}

/**
 * Update the tags bar with current discovered types and active filter state
 * @param {HTMLElement} element - The tags bar element
 * @param {Object} logFilteringState - Current filtering state from app store
 */
export function updateTagsBar(element, logFilteringState) {
    if (!element || !logFilteringState) return;

    const { discoveredTypes = [], activeFilters = [] } = logFilteringState;
    
    // Preserve control group but clear everything else
    const controlGroup = element.querySelector('.log-filter-control-group');
    element.innerHTML = '';
    if (controlGroup) {
        // Clear any level-related content from control group (keep only the main control buttons)
        const controlButtons = controlGroup.querySelectorAll('.clear-log-button, .select-all-button, .clear-all-button, .copy-button');
        controlGroup.innerHTML = '';
        controlButtons.forEach(btn => controlGroup.appendChild(btn));
        
        element.appendChild(controlGroup);
    }

    // Get all current log entries to discover actual filter values that exist
    const logElement = document.getElementById('log');
    const actualValues = {
        level: new Set(),
        source: new Set(),
        module: new Set(), // Keep module concept for internal use
        type: new Set(),
        action: new Set(),
        to: new Set(),
        from: new Set()
    };

    if (logElement) {
        Array.from(logElement.children).forEach(entry => {
            if (entry.dataset.logLevel) actualValues.level.add(entry.dataset.logLevel);
            if (entry.dataset.source) actualValues.source.add(entry.dataset.source);
            if (entry.dataset.logModule) actualValues.module.add(entry.dataset.logModule); // Keep scanning for module
            if (entry.dataset.logType) actualValues.type.add(entry.dataset.logType);
            if (entry.dataset.logAction) actualValues.action.add(entry.dataset.logAction);
            if (entry.dataset.logTo) actualValues.to.add(entry.dataset.logTo);
            if (entry.dataset.logFrom) actualValues.from.add(entry.dataset.logFrom);
        });
    }

    const createFilterButton = (category, value, isActive) => {
        const filterKey = `${category}:${value}`;
        const button = document.createElement('button');
        button.textContent = value;
        button.className = `log-tag-button filter-${category}`;
        button.dataset.filterKey = filterKey;
        
        if (isActive) {
            button.classList.add('active');
        } else {
            button.classList.add('ghost');
        }
        
        return button;
    };

    const createFilterGroup = (categories, sameLine = false) => {
        const group = document.createElement('div');
        group.className = 'log-filter-group';
        if (sameLine) {
            group.style.display = 'flex';
            group.style.alignItems = 'center';
            group.style.gap = '16px';
            group.style.flexWrap = 'wrap'; // Allow wrapping
        }

        categories.forEach(category => {
            const values = actualValues[category];
            
            // Create section for this category
            const section = document.createElement('div');
            section.style.display = 'flex';
            section.style.alignItems = 'center';
            section.style.gap = '3px';
            section.style.flexWrap = 'wrap'; // Allow buttons to wrap within each section
            
            // Create label
            const label = document.createElement('span');
            label.className = 'log-filter-group-label';
            label.textContent = category.charAt(0).toUpperCase() + category.slice(1) + ':';
            label.style.flexShrink = '0'; // Prevent label from shrinking
            section.appendChild(label);

            // Add buttons if values exist, otherwise just show the label as placeholder
            if (values.size > 0) {
                Array.from(values).sort().forEach(value => {
                    const filterKey = `${category}:${value}`;
                    const isActive = activeFilters.includes(filterKey);
                    const button = createFilterButton(category, value, isActive);
                    section.appendChild(button);
                });
            }
            
            group.appendChild(section);
        });

        return group;
    };

    // Line 1: Add level filters to the control group if they exist
    if (controlGroup) {
        // Add flex-wrap to control group too
        controlGroup.style.flexWrap = 'wrap';
        
        if (actualValues.level.size > 0) {
            const levelLabel = document.createElement('span');
            levelLabel.className = 'log-filter-group-label';
            levelLabel.textContent = 'Level:';
            levelLabel.style.marginLeft = '16px';
            levelLabel.style.flexShrink = '0'; // Prevent label from shrinking
            controlGroup.appendChild(levelLabel);

            Array.from(actualValues.level).sort().forEach(value => {
                const filterKey = `level:${value}`;
                const isActive = activeFilters.includes(filterKey);
                const button = createFilterButton('level', value, isActive);
                controlGroup.appendChild(button);
            });
        } else {
            // Just show placeholder label
            const levelLabel = document.createElement('span');
            levelLabel.className = 'log-filter-group-label';
            levelLabel.textContent = 'Level:';
            levelLabel.style.marginLeft = '16px';
            levelLabel.style.flexShrink = '0';
            controlGroup.appendChild(levelLabel);
        }
    }

    // Line 2: Source: (don't display module in filter bar)
    const line2 = createFilterGroup(['source'], false);
    element.appendChild(line2);

    // Line 3: Type:
    const line3 = createFilterGroup(['type']);
    element.appendChild(line3);

    // Line 4: Action:
    const line4 = createFilterGroup(['action']);
    element.appendChild(line4);

    // Line 5: to: from:
    const line5 = createFilterGroup(['to', 'from'], true);
    element.appendChild(line5);
}

/**
 * Apply current filters to all log entries, showing/hiding them as appropriate
 * @param {HTMLElement} logElement - The log container element
 * @param {Array} activeFilters - Array of active filter strings like "type:API", "level:INFO"
 * @param {Function} updateEntryCountCallback - Function to call after filtering to update entry count
 */
export function applyFiltersToLogEntries(logElement, activeFilters, updateEntryCountCallback) {
    if (!logElement) return;

    const entries = Array.from(logElement.children);

    // If no filters are active, show all entries
    if (!activeFilters || activeFilters.length === 0) {
        entries.forEach(entry => {
            entry.classList.remove('log-entry-hidden-by-filter');
        });
        if (updateEntryCountCallback) updateEntryCountCallback();
        return;
    }

    // If special "hide all" flag is set, hide everything
    if (activeFilters.includes('__HIDE_ALL__')) {
        entries.forEach(entry => {
            entry.classList.add('log-entry-hidden-by-filter');
        });
        if (updateEntryCountCallback) updateEntryCountCallback();
        return;
    }

    // Group filters by category
    const filtersByCategory = {};
    activeFilters.forEach(filter => {
        const [category, value] = filter.split(':');
        if (!filtersByCategory[category]) {
            filtersByCategory[category] = [];
        }
        filtersByCategory[category].push(value);
    });

    // Apply filters to each entry
    entries.forEach(entry => {
        let shouldShow = true;

        // Entry must match at least one filter in EVERY active category
        for (const [category, allowedValues] of Object.entries(filtersByCategory)) {
            let categoryMatches = false;
            
            // Get the entry's value for this category
            let entryValue;
            switch (category) {
                case 'level':
                    entryValue = entry.dataset.logLevel;
                    break;
                case 'source':
                    entryValue = entry.dataset.source;
                    break;
                case 'module':
                    entryValue = entry.dataset.logModule; // Keep module filtering capability
                    break;
                case 'type':
                    entryValue = entry.dataset.logType;
                    break;
                case 'action':
                    entryValue = entry.dataset.logAction;
                    break;
                case 'to':
                    entryValue = entry.dataset.logTo;
                    break;
                case 'from':
                    entryValue = entry.dataset.logFrom;
                    break;
                default:
                    entryValue = null;
            }

            // Check if this entry's value matches any of the allowed values for this category
            if (entryValue && allowedValues.includes(entryValue)) {
                categoryMatches = true;
            }

            // If this category doesn't match, hide the entry
            if (!categoryMatches) {
                shouldShow = false;
                break;
            }
        }

        if (shouldShow) {
            entry.classList.remove('log-entry-hidden-by-filter');
        } else {
            entry.classList.add('log-entry-hidden-by-filter');
        }
    });

    if (updateEntryCountCallback) {
        updateEntryCountCallback();
    }
}

function saveFilterSnapshot(state) {
    filterSnapshot = Array.isArray(state) ? [...state] : [];
    // Optionally: localStorage.setItem('logFilterSnapshot', JSON.stringify(filterSnapshot));
}

function loadFilterSnapshot() {
    // Optionally: return JSON.parse(localStorage.getItem('logFilterSnapshot') || '[]');
    return filterSnapshot ? [...filterSnapshot] : [];
}

function saveFilterPreset(state) {
    filterPreset = Array.isArray(state) ? [...state] : [];
    // Optionally: localStorage.setItem('logFilterPreset', JSON.stringify(filterPreset));
}

function loadFilterPreset() {
    // Optionally: return JSON.parse(localStorage.getItem('logFilterPreset') || '[]');
    return filterPreset ? [...filterPreset] : [];
}
