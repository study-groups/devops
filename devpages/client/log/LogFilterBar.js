import { appStore } from '/client/appState.js'; // Dependency

let tagsBarElementRef = null;
let storeUnsubscribe = null;

function logFilterBarMessage(message, level = 'debug') {
    // Optional: local logger for this module if needed for debugging its own ops
    // For now, assume major logging is handled by appStore changes elsewhere or not needed
    console.log(`[LogFilterBar] ${message}`);
}

function _updateDisplay(discoveredTypes, activeFilters) {
    if (!tagsBarElementRef) return;
    tagsBarElementRef.innerHTML = ''; // Clear existing

    if (discoveredTypes.length === 0) {
        tagsBarElementRef.style.display = 'none';
        return;
    }
    tagsBarElementRef.style.display = 'flex';

    discoveredTypes.forEach(type => {
        const button = document.createElement('button');
        button.className = 'log-tag-button'; // From log.css
        button.textContent = type;
        button.dataset.logType = type;
        if (activeFilters.includes(type)) {
            button.classList.add('active');
        }
        tagsBarElementRef.appendChild(button);
    });
}

function _handleTagClick(event) {
    const targetButton = event.target.closest('.log-tag-button');
    if (targetButton && targetButton.dataset.logType) {
        const logTypeToToggle = targetButton.dataset.logType;
        appStore.update(prevState => {
            const currentActiveFilters = prevState.logFiltering.activeFilters;
            let newActiveFilters;
            if (currentActiveFilters.includes(logTypeToToggle)) {
                newActiveFilters = currentActiveFilters.filter(t => t !== logTypeToToggle);
            } else {
                newActiveFilters = [...currentActiveFilters, logTypeToToggle];
            }
            return {
                ...prevState,
                logFiltering: {
                    ...prevState.logFiltering,
                    activeFilters: newActiveFilters
                }
            };
        });
    }
}

export function initializeLogFilterBar(element) {
    if (!element) {
        console.error('[LogFilterBar] Initialization failed: target element not provided.');
        return;
    }
    tagsBarElementRef = element;
    tagsBarElementRef.addEventListener('click', _handleTagClick);

    if (storeUnsubscribe) storeUnsubscribe(); // Clean up previous, if any
    storeUnsubscribe = appStore.subscribe((newState, prevState) => {
        if (newState.logFiltering !== prevState.logFiltering) {
             // No logging here to avoid noise when tags are clicked
            _updateDisplay(newState.logFiltering.discoveredTypes, newState.logFiltering.activeFilters);
        }
    });
    
    // Initial render
    const initialState = appStore.getState().logFiltering;
    _updateDisplay(initialState.discoveredTypes, initialState.activeFilters);
    logFilterBarMessage('Initialized.');
}

export function destroyLogFilterBar() {
    if (storeUnsubscribe) {
        storeUnsubscribe();
        storeUnsubscribe = null;
    }
    if (tagsBarElementRef) {
        tagsBarElementRef.removeEventListener('click', _handleTagClick);
        tagsBarElementRef.innerHTML = ''; // Clear content
    }
    tagsBarElementRef = null;
    logFilterBarMessage('Destroyed.');
}

/**
 * Updates the tags bar with buttons for each discovered log type
 * @param {HTMLElement} tagsBarElement - The tags bar element
 * @param {object} logFilteringState - The filtering state from appStore
 */
export function updateTagsBar(tagsBarElement, logFilteringState) {
    // The _updateTagsBar method from LogPanel.js (lines ~798-850)
    if (!tagsBarElement) {
        console.warn('Tags bar element not found for update.');
        return;
    }

    const { discoveredTypes, activeFilters } = logFilteringState;
    tagsBarElement.innerHTML = ''; // Clear existing buttons

    // Create and add the "Clear Filters" button
    const clearFiltersButton = document.createElement('button');
    clearFiltersButton.className = 'log-tag-button clear-filters-button';
    clearFiltersButton.textContent = 'Clear Filters';
    clearFiltersButton.dataset.action = 'clear-all-log-filters';

    // Determine if "Clear Filters" should be disabled
    if (activeFilters.length === 0 || discoveredTypes.length === 0) {
        clearFiltersButton.classList.add('disabled');
        clearFiltersButton.disabled = true;
    } else {
        clearFiltersButton.classList.remove('disabled');
        clearFiltersButton.disabled = false;
    }
    tagsBarElement.appendChild(clearFiltersButton);

    // Add individual type filter buttons
    if (discoveredTypes.length > 0) {
        discoveredTypes.forEach(type => {
            const button = document.createElement('button');
            button.className = 'log-tag-button';
            button.textContent = type;
            button.dataset.logType = type;
            if (activeFilters.includes(type)) {
                button.classList.add('active');
            }
            tagsBarElement.appendChild(button);
        });
    }
    
    // Visibility of the bar itself
    if (discoveredTypes.length === 0) { 
        tagsBarElement.style.display = 'none'; 
    } else {
        tagsBarElement.style.display = 'flex';
    }
}

/**
 * Applies filters to log entries based on their type
 * @param {HTMLElement} logElement - The log element containing entries
 * @param {string[]} activeFilters - Array of active filter types 
 * @param {Function} updateEntryCountCallback - Callback to update entry count after filtering
 */
export function applyFiltersToLogEntries(logElement, activeFilters, updateEntryCountCallback) {
    // The _applyFiltersToLogEntries method from LogPanel.js (lines ~851-877)
    if (!logElement) {
        console.warn('Log element not found for applying filters.');
        return;
    }

    const logEntries = logElement.querySelectorAll('.log-entry');

    logEntries.forEach(entry => {
        const entryType = entry.dataset.logType;
        if (entryType) {
            if (activeFilters.includes(entryType)) {
                entry.classList.remove('log-entry-hidden-by-filter');
            } else {
                entry.classList.add('log-entry-hidden-by-filter');
            }
        }
    });
    
    // Update the count after filters are applied
    if (typeof updateEntryCountCallback === 'function') {
        updateEntryCountCallback();
    }
}
