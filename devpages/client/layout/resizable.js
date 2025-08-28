/**
 * resizable.js
 * 
 * Manages the resizing of workspace panels (Sidebar, Editor, Preview)
 * and stores the positions in Redux.
 */

import { appStore } from '../appState.js';
import { setPanelSize } from '../redux/panelSizes.js';

class ResizableManager {
    constructor() {
        this.initialized = false;
        this.resizers = {};
        this.panels = {};
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

        this.panels = {
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

        appStore.subscribe(this.updatePanelSizes.bind(this));
        this.updatePanelSizes();
        
        this.initialized = true;
        return this;
    }

    updatePanelSizes() {
        const state = appStore.getState();
        const { panelSizes } = state;

        if (panelSizes) {
            for (const panelKey in panelSizes) {
                const panel = this.panels[panelKey];
                if (panel && panelSizes[panelKey]) {
                    panel.style.width = `${panelSizes[panelKey]}px`;
                }
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

        this.panels[resizerKey].style.width = `${newWidth}px`;
    }

    onMouseUp() {
        if (!this.currentResizerKey) return;
        const resizerKey = this.currentResizerKey;

        document.removeEventListener('mousemove', this.boundOnMouseMove);
        document.removeEventListener('mouseup', this.boundOnMouseUp);

        const newWidth = this.panels[resizerKey].offsetWidth;

        appStore.dispatch(setPanelSize(resizerKey, newWidth));
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
