/**
 * HistoryManager.js - Manages selector history and presets
 * Handles history buttons, preset management, and UI updates
 */

export class HistoryManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.historyContainer = null;
        this.querySelectorInput = null;
    }

    /**
     * Set UI element references
     */
    setUIElements(historyContainer, querySelectorInput) {
        this.historyContainer = historyContainer;
        this.querySelectorInput = querySelectorInput;
    }

    /**
     * Add to history
     */
    addToHistory(selector) {
        if (selector) {
            this.stateManager.addToHistory(selector);
        }
    }

    /**
     * Save preset
     */
    savePreset(selector) {
        if (!selector) return;
        this.stateManager.addToHistory(selector);
        this.updateHistoryButtons(); // Update the UI after saving
        console.log('HistoryManager: Saved preset:', selector);
    }

    /**
     * Remove preset
     */
    removePreset(selector) {
        if (!selector) return;
        this.stateManager.removeFromHistory(selector);
        this.updateHistoryButtons(); // Update the UI after removing
        console.log('HistoryManager: Removed preset:', selector);
    }

    /**
     * Update history buttons
     */
    updateHistoryButtons() {
        if (!this.historyContainer) return;
        
        // Clear existing buttons
        this.historyContainer.innerHTML = '';
        
        // Get current history from state
        const history = this.stateManager.getSelectorHistory();
        console.log('HistoryManager: Updating history buttons, history:', history);
        
        // Create buttons for each history item
        history.forEach(selector => {
            const button = document.createElement('button');
            button.textContent = this.abbreviateSelector(selector);
            button.className = 'dom-inspector-preset-btn';
            button.title = `Click to use preset: ${selector}`;
            button.dataset.fullSelector = selector;
            
            // Click handler to load the preset
            button.addEventListener('click', () => {
                if (this.querySelectorInput) {
                    this.querySelectorInput.value = selector;
                }
                this.onPresetClick?.(selector);
            });
            
            this.historyContainer.appendChild(button);
        });
    }

    /**
     * Abbreviate selector for display in buttons
     */
    abbreviateSelector(selector, maxLength = 30) {
        if (selector.length <= maxLength) return selector;
        
        // Try to keep the most important parts
        const parts = selector.split(' ');
        if (parts.length === 1) {
            // Single selector, truncate in middle
            const start = selector.substring(0, Math.floor(maxLength / 2) - 2);
            const end = selector.substring(selector.length - Math.floor(maxLength / 2) + 2);
            return `${start}...${end}`;
        }
        
        // Multiple parts, try to keep first and last meaningful parts
        if (parts.length > 2) {
            const abbreviated = `${parts[0]} ... ${parts[parts.length - 1]}`;
            if (abbreviated.length <= maxLength) return abbreviated;
        }
        
        // Fallback to simple truncation
        return selector.substring(0, maxLength - 3) + '...';
    }

    /**
     * Set callback for preset clicks
     */
    setOnPresetClick(callback) {
        this.onPresetClick = callback;
    }
} 