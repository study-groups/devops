/**
 * resizable.js
 * 
 * Manages the resizing of workspace zones (Sidebar, Editor, Preview)
 * and stores the positions in Redux.
 */

import { appStore } from '../appState.js';
import { uiActions } from '../store/uiSlice.js';

class ResizableManager {
    constructor() {
        this.initialized = false;
        this.resizers = {};
        // Removed - using this.zones instead
        this.minMaxWidths = {
            sidebar: { min: 0, max: window.innerWidth },
            preview: { min: 0, max: window.innerWidth },
        };
        this.currentResizerKey = null;
        this.boundOnMouseMove = this.onMouseMove.bind(this);
        this.boundOnMouseUp = this.onMouseUp.bind(this);
    }

    initialize() {
        if (this.initialized) {
            return this;
        }

        this.resizers = {
            sidebar: document.querySelector('.resizer[data-resizer-for="sidebar"]'),
            preview: document.querySelector('.resizer[data-resizer-for="preview"]'),
        };

        this.zones = {
            sidebar: document.getElementById('workspace-sidebar'),
            editor: document.getElementById('workspace-editor'),
            preview: document.getElementById('workspace-preview'),
        };

        for (const resizerKey in this.resizers) {
            const resizer = this.resizers[resizerKey];
            if (resizer) {
                resizer.addEventListener('mousedown', (e) => this.onMouseDown(resizerKey, e));
            }
        }

        // Update max width on window resize
        window.addEventListener('resize', () => {
            this.minMaxWidths.sidebar.max = window.innerWidth;
            this.minMaxWidths.preview.max = window.innerWidth;
        });

        // Only update zone sizes on initial load, not on every state change
        this.updateZoneSizes();
        
        this.initialized = true;
        return this;
    }

    updateZoneSizes() {
        const state = appStore.getState();
        const { workspaceDimensions } = state.ui;

        if (workspaceDimensions) {
            if (this.zones.sidebar && workspaceDimensions.sidebarWidth) {
                this.zones.sidebar.style.width = `${workspaceDimensions.sidebarWidth}px`;
            }
            if (this.zones.preview && workspaceDimensions.previewWidth) {
                this.zones.preview.style.width = `${workspaceDimensions.previewWidth}px`;
            }
        }
    }

    onMouseDown(resizerKey, e) {
        e.preventDefault();
        this.currentResizerKey = resizerKey;
        document.addEventListener('mousemove', this.boundOnMouseMove);
        document.addEventListener('mouseup', this.boundOnMouseUp);
    }

    onMouseMove(e) {
        if (!this.currentResizerKey) return;
        const resizerKey = this.currentResizerKey;

        const workspaceContainer = document.querySelector('.workspace-container');
        const containerRect = workspaceContainer.getBoundingClientRect();
        const { min, max } = this.minMaxWidths[resizerKey];

        let newWidth;
        if (resizerKey === 'sidebar') {
            newWidth = e.clientX - containerRect.left;
        } else if (resizerKey === 'preview') {
            newWidth = containerRect.right - e.clientX;
        }

        if (newWidth < min) newWidth = min;
        if (newWidth > max) newWidth = max;

        this.zones[resizerKey].style.width = `${newWidth}px`;
    }

    onMouseUp() {
        if (!this.currentResizerKey) return;
        const resizerKey = this.currentResizerKey;

        document.removeEventListener('mousemove', this.boundOnMouseMove);
        document.removeEventListener('mouseup', this.boundOnMouseUp);

        const newWidth = this.zones[resizerKey].offsetWidth;

        // Save to UI slice workspaceDimensions instead of panelSizes
        const state = appStore.getState();
        const currentDimensions = state.ui.workspaceDimensions || {};
        const dimensionKey = resizerKey === 'sidebar' ? 'sidebarWidth' : 'previewWidth';
        
        appStore.dispatch(uiActions.updateSetting({
            key: 'workspaceDimensions',
            value: {
                ...currentDimensions,
                [dimensionKey]: newWidth
            }
        }));
        
        this.currentResizerKey = null;
    }
}

let instance = null;

export function initializeResizableManager() {
    if (!instance) {
        instance = new ResizableManager().initialize();
    }
    return instance;
}
