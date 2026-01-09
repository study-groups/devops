/**
 * FileSummaryDisplay.js - Simple file summary display for DevPages
 * Shows when both text and preview panels are disabled (blank mode)
 */

import { appStore } from '/client/appState.js';

export function createFileSummaryDisplay(containerId) {
    let element = null;
    let appStateUnsubscribe = null;
    let fileThunks = null;
    let prevState = appStore.getState(); // Initialize previous state

    /**
     * Get current file information
     */
    const getFileInfo = () => {
        try {
            const appState = appStore.getState();
            const file = appState.file || {};
            const content = file.content || '';
            
            // v2: pathname is at file.currentFile.pathname
            const currentPathname = file.currentFile?.pathname;
            const fileName = currentPathname ?
                currentPathname.split('/').pop() : null;
            
            const lineCount = content ? content.split('\n').length : 0;
            
            let status = 'Ready';
            if (file.isLoading) status = 'Loading...';
            if (file.isSaving) status = 'Saving...';
            if (!fileName) status = 'No file';
            
            return {
                fileName,
                filePath: currentPathname || null,
                fileSize: content.length,
                lineCount,
                status
            };
        } catch (error) {
            return {
                fileName: null,
                filePath: null,
                fileSize: 0,
                lineCount: 0,
                status: 'Error'
            };
        }
    };

    /**
     * Render the file summary content
     */
    const render = () => {
        if (!element) return;

        const info = getFileInfo();
        
        element.innerHTML = `
            <div class="file-summary-display">
                <div class="summary-line">FILE: ${info.fileName || 'No file selected'}</div>
                <div class="summary-line">PATH: ${info.filePath || 'N/A'}</div>
                <div class="summary-line">SIZE: ${info.fileSize} chars, ${info.lineCount} lines</div>
                <div class="summary-line">NOTE: Toggle Edit/Preview panels to work with content</div>
            </div>
        `;
    };

    /**
     * Mount the component
     */
    const mount = () => {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`[FileSummaryDisplay] Container #${containerId} not found`);
            return false;
        }

        // Create a separate overlay element instead of replacing content
        element = document.createElement('div');
        element.id = 'file-summary-overlay';
        element.className = 'file-summary-overlay';
        
        // Subscribe to app state changes
        appStateUnsubscribe = appStore.subscribe(() => {
            const newState = appStore.getState();
            handleStateChange(newState, prevState);
            prevState = newState; // Update previous state
        });

        // Append overlay to container
        container.appendChild(element);

        // Initial render
        render();

        console.log('[FileSummaryDisplay] Mounted as overlay');
        return true;
    };

    function handleStateChange(newState, prevState) {
        if (!prevState) return; // Guard against initial undefined state
        const newFile = newState.file;
        const prevFile = prevState.file;

        // v2: pathname is at file.currentFile.pathname
        if (newFile?.currentFile?.pathname !== prevFile?.currentFile?.pathname ||
            newFile?.currentFile?.content !== prevFile?.currentFile?.content) {
            render();
        }
    }

    /**
     * Unmount the component
     */
    const unmount = () => {
        if (appStateUnsubscribe) {
            appStateUnsubscribe();
            appStateUnsubscribe = null;
        }

        if (element && element.parentNode) {
            element.parentNode.removeChild(element);
        }

        element = null;
        console.log('[FileSummaryDisplay] Unmounted overlay');
    };

    return {
        mount,
        unmount,
        render
    };
} 