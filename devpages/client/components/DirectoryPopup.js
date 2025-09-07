/**
 * DirectoryPopup - A context popup that shows directory siblings for quick navigation
 * 
 * Features:
 * - Shows all directories at the current level
 * - Highlights the currently selected directory
 * - Click to navigate to any sibling directory
 * - Keyboard shortcuts (Escape to close)
 * - Smart positioning near clicked element
 */

import { pathJoin } from '/client/utils/pathUtils.js';
import { logContext } from '/client/logging/logContext.js';
import { appStore } from '/client/appState.js';
import { pathThunks } from '/client/store/slices/pathSlice.js';

export class DirectoryPopup {
    constructor() {
        this.popupElement = null;
        this.cleanupHandlers = null;
    }

    /**
     * Create and show the directory popup
     * @param {string} clickedDir - The directory that was clicked/selected
     * @param {string[]} allDirs - All directories at this level
     * @param {string} parentPath - The parent path of these directories
     * @param {Event} clickEvent - The original click event for positioning
     */
    show(clickedDir, allDirs, parentPath, clickEvent) {
        logContext(`=== CREATING DIRECTORY POPUP ===`, 'EVENT');
        logContext(`Clicked dir: '${clickedDir}', Parent path: '${parentPath}', All dirs: [${allDirs.join(', ')}]`, 'EVENT');
        
        // Remove existing popup if any
        this.hide();

        // Create popup element
        logContext(`Creating popup DOM element`, 'EVENT');
        this.popupElement = document.createElement('div');
        // Remove inline styles, use CSS classes instead
        this.popupElement.className = 'directory-context-popup base-popup';
        // Remove hardcoded styles

        // Add header
        this._createHeader(parentPath);
        
        // Add directory items
        this._createDirectoryItems(clickedDir, allDirs, parentPath);
        
        // Position popup
        this._positionPopup(clickEvent);
        
        // Add to document
        document.body.appendChild(this.popupElement);
        logContext(`Popup added to document body`, 'EVENT');

        // Setup cleanup handlers
        this._setupEventHandlers();

        logContext(`Directory context popup created for '${clickedDir}' with ${allDirs.length} siblings`, 'EVENT');
        logContext(`=== POPUP CREATION COMPLETE ===`, 'EVENT');
    }

    /**
     * Hide and cleanup the popup
     */
    hide() {
        if (this.popupElement) {
            logContext(`Hiding directory popup`, 'EVENT');
            this.popupElement.remove();
            this.popupElement = null;
        }
        if (this.cleanupHandlers) {
            this.cleanupHandlers();
            this.cleanupHandlers = null;
        }
    }

    /**
     * Create the popup header
     * @private
     */
    _createHeader(parentPath) {
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 10px 16px 8px 16px;
            font-weight: 600;
            border-bottom: 1px solid #f0f0f0;
            color: #555;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: #fafafa;
        `;
        header.textContent = `📁 ${parentPath || 'root'}`;
        this.popupElement.appendChild(header);
        logContext(`Added header to popup`, 'EVENT');
    }

    /**
     * Create directory item elements
     * @private
     */
    _createDirectoryItems(clickedDir, allDirs, parentPath) {
        logContext(`Adding ${allDirs.length} directory items`, 'EVENT');
        
        allDirs.forEach((dirName, index) => {
            const item = document.createElement('div');
            item.className = 'popup-directory-item';
            
            const isSelected = dirName === clickedDir;
            item.style.cssText = `
                padding: 10px 16px;
                cursor: pointer;
                display: flex;
                align-items: center;
                transition: background-color 0.15s ease;
                border-left: 3px solid transparent;
                ${isSelected ? 'background-color: #e8f4fd; border-left-color: #2196f3; font-weight: 500;' : ''}
            `;

            // Add folder icon
            const icon = document.createElement('span');
            icon.textContent = '📁 ';
            icon.style.marginRight = '8px';
            item.appendChild(icon);

            // Add directory name
            const name = document.createElement('span');
            name.textContent = dirName;
            if (isSelected) {
                name.style.color = '#1976d2';
            }
            item.appendChild(name);

            // Add navigation handler
            this._addItemEventHandlers(item, dirName, parentPath, isSelected);

            this.popupElement.appendChild(item);
            logContext(`Added directory item ${index + 1}: '${dirName}'`, 'EVENT');
        });
    }

    /**
     * Add event handlers to directory items
     * @private
     */
    _addItemEventHandlers(item, dirName, parentPath, isSelected) {
        // Click handler
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const newPath = parentPath ? pathJoin(parentPath, dirName) : dirName;
            logContext(`Directory popup navigation: '${newPath}'`, 'EVENT');
            appStore.dispatch(pathThunks.navigateToPath({ pathname: newPath, isDirectory: true }));
            this.hide();
        });

        // Hover effects
        item.addEventListener('mouseenter', () => {
            if (!isSelected) {
                item.style.backgroundColor = '#f8f9fa';
                item.style.borderLeftColor = '#e0e0e0';
            }
        });

        item.addEventListener('mouseleave', () => {
            if (!isSelected) {
                item.style.backgroundColor = '';
                item.style.borderLeftColor = 'transparent';
            }
        });
    }

    /**
     * Position the popup near the clicked element
     * @private
     */
    _positionPopup(clickEvent) {
        const rect = clickEvent.target.getBoundingClientRect();
        const popupX = Math.min(rect.right + 10, window.innerWidth - 220);
        const popupY = Math.min(rect.top, window.innerHeight - 320);
        
        this.popupElement.style.left = `${popupX}px`;
        this.popupElement.style.top = `${popupY}px`;
        logContext(`Positioning popup at (${popupX}, ${popupY})`, 'EVENT');
    }

    /**
     * Setup event handlers for popup dismissal
     * @private
     */
    _setupEventHandlers() {
        const hideOnClickOutside = (e) => {
            if (!this.popupElement.contains(e.target)) {
                this.hide();
            }
        };

        const hideOnEscape = (e) => {
            if (e.key === 'Escape') {
                this.hide();
            }
        };

        document.addEventListener('click', hideOnClickOutside, true);
        document.addEventListener('keydown', hideOnEscape, true);

        this.cleanupHandlers = () => {
            document.removeEventListener('click', hideOnClickOutside, true);
            document.removeEventListener('keydown', hideOnEscape, true);
        };
    }

    /**
     * Cleanup on destroy
     */
    destroy() {
        this.hide();
        logContext('DirectoryPopup destroyed', 'INFO');
    }
}

/**
 * Factory function to create a DirectoryPopup instance
 * @returns {DirectoryPopup} New DirectoryPopup instance
 */
export function createDirectoryPopup() {
    return new DirectoryPopup();
} 