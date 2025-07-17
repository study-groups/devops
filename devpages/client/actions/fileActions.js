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
     * Saves the current file using thunks
     */
    saveFile: async () => {
        logAction('Triggering saveFile action...');
        try {
            const currentPathname = selectors.getCurrentFilePath(appStore.getState());
            const currentContent = selectors.getCurrentFileContent(appStore.getState());
            
            if (!currentPathname || !currentContent) {
                throw new Error('No file selected or no content to save');
            }
            
            // Use the thunk action creator
            await dispatch(fileActions.saveFileContent(currentPathname, currentContent));
            
            logAction('saveFile executed successfully.');
            return true;
        } catch (error) {
            logAction(`Error during saveFile trigger: ${error.message}`, 'error');
            alert('An error occurred while trying to save.');
            return false;
        }
    },

    /**
     * Loads a file using thunks
     * @param {string} pathname - File path to load
     */
    loadFile: async (pathname) => {
        logAction(`Triggering loadFile action for: ${pathname}`);
        try {
            // Use the thunk action creator
            await dispatch(fileActions.loadFileContent(pathname));
            
            logAction(`loadFile executed successfully for: ${pathname}`);
            return true;
        } catch (error) {
            logAction(`Error during loadFile trigger: ${error.message}`, 'error');
            alert(`An error occurred while trying to load ${pathname}`);
            return false;
        }
    },

    /**
     * Loads directory listing using thunks
     * @param {string} pathname - Directory path to load
     */
    loadDirectory: async (pathname) => {
        logAction(`Triggering loadDirectory action for: ${pathname}`);
        try {
            // Use the thunk action creator
            await dispatch(fileActions.loadDirectoryListing(pathname));
            
            logAction(`loadDirectory executed successfully for: ${pathname}`);
            return true;
        } catch (error) {
            logAction(`Error during loadDirectory trigger: ${error.message}`, 'error');
            alert(`An error occurred while trying to load directory ${pathname}`);
            return false;
        }
    },

    /**
     * Loads top-level directories using thunks
     */
    loadTopLevelDirectories: async () => {
        logAction('Triggering loadTopLevelDirectories action...');
        try {
            // Use the thunk action creator
            await dispatch(fileActions.loadTopLevelDirectories());
            
            logAction('loadTopLevelDirectories executed successfully.');
            return true;
        } catch (error) {
            logAction(`Error during loadTopLevelDirectories trigger: ${error.message}`, 'error');
            alert('An error occurred while trying to load top-level directories');
            return false;
        }
    },

    /**
     * Deletes a file using thunks
     * @param {string} pathname - File path to delete
     */
    deleteFile: async (pathname) => {
        logAction(`Triggering deleteFile action for: ${pathname}`);
        try {
            // Use the thunk action creator
            await dispatch(fileActions.deleteFile(pathname));
            
            logAction(`deleteFile executed successfully for: ${pathname}`);
            return true;
        } catch (error) {
            logAction(`Error during deleteFile trigger: ${error.message}`, 'error');
            alert(`An error occurred while trying to delete ${pathname}`);
            return false;
        }
    },

    /**
     * Downloads static HTML for the current file
     */
    downloadStaticHTML: async () => {
        logAction('Triggering downloadStaticHTML action...');
        try {
            const currentPathname = selectors.getCurrentFilePath(appStore.getState());
            const currentContent = selectors.getCurrentFileContent(appStore.getState());
            
            if (!currentPathname || !currentContent) {
                throw new Error('No file selected or no content to download');
            }
            
            // Generate static HTML
            const htmlContent = await generateStaticHtmlForPublish(currentContent);
            
            // Create download link
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${pathname.replace(/\.md$/, '')}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            logAction('downloadStaticHTML executed successfully.');
            return true;
        } catch (error) {
            logAction(`Error during downloadStaticHTML trigger: ${error.message}`, 'error');
            alert('An error occurred while trying to download static HTML');
            return false;
        }
    },

    /**
     * Publishes to Spaces using thunks
     * @param {string} pathname - File path to publish
     * @param {string} htmlContent - HTML content to publish
     */
    publishToSpaces: async (pathname, htmlContent) => {
        logAction(`Triggering publishToSpaces action for: ${pathname}`);
        try {
            const result = await publishService.publishToSpaces(htmlContent, pathname);
            
            logAction(`publishToSpaces executed successfully for: ${pathname}`);
            return result;
        } catch (error) {
            logAction(`Error during publishToSpaces trigger: ${error.message}`, 'error');
            alert(`An error occurred while trying to publish ${pathname}`);
            throw error;
        }
    }
}; 