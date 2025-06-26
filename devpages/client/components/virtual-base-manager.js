/**
 * Virtual Base Path Manager Component
 * Allows users to switch between different virtual MD_DIR contexts
 */
import { dispatch } from '/client/messaging/messageQueue.js';
import { ActionTypes } from '/client/messaging/actionTypes.js';
import { appStore } from '/client/appState.js';
import { pathUtils } from '/client/utils/pathUtils.js';
import { getFile } from '/client/api.js';
import { setVirtualBasePath, getAvailableBasePaths } from '/client/utils/virtualPathUtils.js';
import eventBus from '/client/eventBus.js';

class VirtualBaseManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentBasePath = '';
        this.availablePaths = [];
        
        if (!this.container) {
            console.warn('[VirtualBaseManager] Container not found:', containerId);
            return;
        }
        
        this.setupEventListeners();
        this.render();
        
        // Subscribe to state changes
        this.unsubscribe = appStore.subscribe((newState, prevState) => {
            const newBasePath = newState.file.virtualBasePath;
            const newAvailablePaths = newState.file.availableTopLevelDirs;
            
            if (newBasePath !== this.currentBasePath || 
                JSON.stringify(newAvailablePaths) !== JSON.stringify(this.availablePaths)) {
                this.currentBasePath = newBasePath;
                this.availablePaths = newAvailablePaths;
                this.render();
            }
        });
    }
    
    setupEventListeners() {
        // Listen for when file manager loads top-level directories
        eventBus.on('fs:topDirsLoaded', () => {
            this.render(); // Re-render when new directories are available
        });
    }
    
    render() {
        console.log('[VirtualBaseManager] Rendering...', {
            container: this.container,
            currentBasePath: this.currentBasePath,
            availablePaths: this.availablePaths
        });
        
        const state = appStore.getState();
        this.currentBasePath = state.file?.virtualBasePath || '';
        this.availablePaths = getAvailableBasePaths();
        
        const isAuthenticated = state.auth?.isAuthenticated;
        
        console.log('[VirtualBaseManager] State check:', {
            isAuthenticated,
            currentBasePath: this.currentBasePath,
            availablePaths: this.availablePaths
        });
        
        if (!isAuthenticated) {
            this.container.innerHTML = '<div style="color: #6c757d; font-size: 11px;">Not authenticated</div>';
            return;
        }
        
        // Fallback if no paths available yet
        if (this.availablePaths.length === 0) {
            this.container.innerHTML = '<div style="color: #6c757d; font-size: 11px;">Loading...</div>';
            return;
        }
        
        this.container.innerHTML = `
            <div class="virtual-base-manager" style="display: flex; align-items: center; gap: 8px; background: #f0f0f0; padding: 4px; border-radius: 3px;">
                <label style="font-size: 11px; color: #6c757d; white-space: nowrap;">Base:</label>
                <select id="virtual-base-select" style="font-size: 11px; padding: 2px 4px; border: 1px solid #ddd; border-radius: 3px; background: white; min-width: 80px;">
                    ${this.availablePaths.map(path => {
                        const displayName = path === '' ? '(Root)' : path;
                        const selected = path === this.currentBasePath ? 'selected' : '';
                        return `<option value="${path}" ${selected}>${displayName}</option>`;
                    }).join('')}
                </select>
                <button id="virtual-base-reset" style="font-size: 10px; padding: 2px 6px; background: #6c757d; color: white; border: none; border-radius: 3px; cursor: pointer;" title="Reset to root">⌂</button>
            </div>
        `;
        
        console.log('[VirtualBaseManager] Rendered HTML:', this.container.innerHTML);
        
        // Add event listeners
        const select = document.getElementById('virtual-base-select');
        const resetBtn = document.getElementById('virtual-base-reset');
        
        if (select) {
            select.addEventListener('change', (e) => {
                this.changeBasePath(e.target.value);
            });
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.changeBasePath('');
            });
        }
    }
    
    async changeBasePath(newBasePath) {
        const normalizedPath = (newBasePath || '').replace(/^\/+|\/+$/g, '');
        
        console.log(`[VirtualBaseManager] Changing base path from '${this.currentBasePath}' to '${normalizedPath}'`);
        
        // Set the new virtual base path
        setVirtualBasePath(normalizedPath);
        
        // Clear current file/directory selection since paths will change
        dispatch({
            type: ActionTypes.FS_SET_STATE,
            payload: {
                currentPathname: null,
                isDirectorySelected: false,
                currentListing: { pathname: null, dirs: [], files: [] },
                parentListing: { pathname: null, triggeringPath: null, dirs: [], files: [] },
                error: null
            }
        });
        
        // Clear editor content
        if (typeof window.setContent === 'function') {
            window.setContent('');
        }
        
        // Trigger reload of file manager with new base
        try {
            // Load the root of the new virtual base
            eventBus.emit('navigate:pathname', { 
                pathname: '', // Root of virtual base
                isDirectory: true 
            });
        } catch (error) {
            console.error('[VirtualBaseManager] Error navigating to new base:', error);
        }
    }
    
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        eventBus.off('fs:topDirsLoaded');
    }
}

export default VirtualBaseManager; 