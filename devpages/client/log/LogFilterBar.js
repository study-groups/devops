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
