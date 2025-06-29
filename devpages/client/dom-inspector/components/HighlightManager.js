/**
 * HighlightManager.js - Manages highlight button functionality
 * Handles highlight mode cycling, button visuals, and state updates
 */

export class HighlightManager {
    constructor(stateManager) {
        this.stateManager = stateManager;
        this.highlightToggleButton = null;
    }

    /**
     * Set UI element references
     */
    setUIElements(highlightToggleButton) {
        this.highlightToggleButton = highlightToggleButton;
        this.setupHighlightButtonEvents();
        this.updateHighlightButtonVisuals();
    }

    /**
     * Update highlight button visuals
     */
    updateHighlightButtonVisuals() {
        if (!this.highlightToggleButton) return;
        
        const state = this.stateManager.getState();
        const highlight = state.highlight;
        
        // Update button appearance based on mode
        this.highlightToggleButton.classList.remove('active', 'mode-border', 'mode-shade', 'mode-both', 'mode-none');
        
        if (highlight.enabled && highlight.mode !== 'none') {
            this.highlightToggleButton.classList.add('active');
            this.highlightToggleButton.classList.add(`mode-${highlight.mode}`);
        } else {
            this.highlightToggleButton.classList.add('mode-none');
        }
        
        // Update button title to show current mode
        const modeText = highlight.mode.charAt(0).toUpperCase() + highlight.mode.slice(1);
        this.highlightToggleButton.title = `Highlight Mode: ${modeText} (click to cycle)`;
        
        console.log('HighlightManager: Updated highlight button for mode:', highlight.mode);
    }

    /**
     * Setup highlight button events
     */
    setupHighlightButtonEvents() {
        if (!this.highlightToggleButton) return;
        
        this.highlightToggleButton.addEventListener('click', () => {
            this.toggleHighlightMode();
        });
    }

    /**
     * Toggle highlight mode
     */
    toggleHighlightMode() {
        const state = this.stateManager.getState();
        const currentMode = state.highlight.mode;
        
        // Cycle through 3 highlight modes: border -> both -> none -> border
        let nextMode;
        switch (currentMode) {
            case 'border':
                nextMode = 'both';
                break;
            case 'both':
                nextMode = 'none';
                break;
            case 'none':
            default:
                nextMode = 'border';
                break;
        }
        
        console.log('HighlightManager: Cycling highlight mode from', currentMode, 'to', nextMode);
        
        this.stateManager.setHighlight({
            ...state.highlight,
            mode: nextMode,
            enabled: nextMode !== 'none' // Enable if not 'none'
        });
    }
} 