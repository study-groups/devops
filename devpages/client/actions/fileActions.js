/**
 * File action handlers
 * Responsible for file operations like loading, saving, and navigation
 */
import { logMessage } from '/client/log/index.js';
import { loadFile, saveFile } from '/client/filesystem/fileManager.js';
import { generateStaticHtmlForPublish, downloadStaticHTML } from '/client/utils/staticHtmlGenerator.js';
import { dispatch } from '/client/messaging/messageQueue.js';
import { fileActions } from '/client/messaging/actionCreators.js';
import { appStore } from '/client/appState.js';
import * as selectors from '/client/store/selectors.js';
import eventBus from '/client/eventBus.js';
import { publishService } from '/client/services/PublishService.js';

// Helper for logging within this module
function logAction(message, level = 'debug') {
    const type = 'ACTION'
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

export const fileActionHandlers = {
    /**
     * Saves the current file
     */
    saveFile: async () => {
        logAction('Triggering saveFile action...');
        try {
            // First dispatch the save start action
            const currentPathname = selectors.getCurrentFilePath(appStore.getState());
            if (currentPathname) {
                dispatch(fileActions.saveFileStart(currentPathname));
            }
            
            // Use the imported saveFile function directly
            const success = await saveFile();
            
            if (success) {
                logAction('saveFile executed successfully.');
                // Dispatch success action
                if (currentPathname) {
                    dispatch(fileActions.saveFileSuccess(currentPathname));
                }
            } else {
                logAction('saveFile failed.', 'error');
                dispatch(fileActions.saveFileError('Unknown save error'));
            }
        } catch (error) {
            logAction(`Error during saveFile trigger: ${error.message}`, 'error');
            dispatch(fileActions.saveFileError(error.message));
            alert('An error occurred while trying to save.');
        }
    },

    /**
     * Loads a file into the editor
     * @param {Object} data - Optional data containing filename
     */
    loadFile: async (data) => {
        // Get the filename either from the data parameter or from the file select element
        let filenameToLoad = data?.filename;
        
        if (!filenameToLoad) {
            // Try to get from #file-select
            const fileSelect = document.getElementById('file-select');
            if (fileSelect && fileSelect.value) {
                filenameToLoad = fileSelect.value;
                logAction(`Getting filename from #file-select: ${filenameToLoad}`);
            } else {
                // As a last resort, try to get from current file state
                const fileManager = await import('/client/filesystem/fileManager.js');
                if (fileManager.default?.getCurrentFile) {
                    filenameToLoad = fileManager.default.getCurrentFile();
                    logAction(`Getting filename from fileManager state: ${filenameToLoad}`);
                }
            }
            
            if (!filenameToLoad) {
                logAction('Error: No filename found in data, select element, or file state.', 'error');
                return;
            }
        }
        
        logAction(`Load file action triggered for: ${filenameToLoad}`, 'debug');
        try {
            const fileManager = await import('/client/filesystem/fileManager.js');
            
            // Check if fileManager.default exists and has the necessary functions
            if (!fileManager.default) {
                logAction('Error: fileManager module not available.', 'error');
                return;
            }

            const topLevelDir = document.getElementById('dir-select')?.value || '';
            
            // Get the subdirectory if selected
            let relativePath = '';
            const subdirSelect = document.getElementById('subdir-select');
            if (subdirSelect && subdirSelect.value) {
                // Remove trailing slash if present (e.g., "iframe/" becomes "iframe")
                relativePath = subdirSelect.value.replace(/\/$/, '');
                logAction(`Using subdirectory from dropdown: ${relativePath}`, 'debug');
            }
            
            logAction(`Attempting to load '${filenameToLoad}' with context: Top='${topLevelDir}', Rel='${relativePath}'`, 'debug');

            // Dispatch file loading start action
            dispatch(fileActions.loadFileStart(filenameToLoad));

            // Call loadFile with all required arguments
            await fileManager.default.loadFile(filenameToLoad, topLevelDir, relativePath);
             
            logAction(`File load attempt complete for ${filenameToLoad}.`);
        } catch (error) {
            logAction(`Error loading file via fileManager: ${error.message}`, 'error');
            dispatch(fileActions.loadFileError(error.message));
            console.error('[ACTION loadFile ERROR]', error); // Log the full error
        }
    },

    /**
     * Generates and downloads a static HTML version of the current file
     */
    downloadStaticHTML: async () => {
        logAction('Triggering static HTML generation via imported function...');
        // Call the refactored function
        await downloadStaticHTML();
    },

    /**
     * Publishes the current file based on publish settings
     */
    publishToSpaces: async () => {
        const state = appStore.getState();
        const currentFile = state.file?.currentPathname;
        
        if (!currentFile) {
            alert('No file selected');
            return;
        }

        // Get editor content
        const editor = document.querySelector('#md-editor textarea, #editor-container textarea, textarea');
        if (!editor) {
            alert('Editor not found');
            return;
        }

        try {
            await publishService.publish(editor.value, currentFile);
        } catch (error) {
            alert(`Publish failed: ${error.message}`);
        }
    }
}; 