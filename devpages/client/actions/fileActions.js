/**
 * File action handlers
 * Responsible for file operations like loading, saving, and navigation
 */
import { generateStaticHtmlForPublish, downloadStaticHTML } from '/client/utils/staticHtmlGenerator.js';
import { fileActions } from '/client/messaging/actionCreators.js';
import { appStore } from '/client/appState.js';
import * as selectors from '/client/store/selectors.js';
import { publishService } from '/client/services/PublishService.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('FileActions');

export const fileActionHandlers = {
    /**
     * Saves the current file using thunks
     */
    saveFile: async () => {
        log.info('ACTION', 'SAVE_FILE_START', 'Triggering saveFile action...');
        try {
            const currentPathname = selectors.getCurrentFilePath(appStore.getState());
            const currentContent = selectors.getCurrentFileContent(appStore.getState());
            
            if (!currentPathname || !currentContent) {
                throw new Error('No file selected or no content to save');
            }
            
            // Use the thunk action creator
            await appStore.dispatch(fileActions.saveFileContent(currentPathname, currentContent));
            
            log.info('ACTION', 'SAVE_FILE_SUCCESS', 'saveFile executed successfully.');
            return true;
        } catch (error) {
            log.error('ACTION', 'SAVE_FILE_FAILED', `Error during saveFile trigger: ${error.message}`, error);
            alert('An error occurred while trying to save.');
            return false;
        }
    },

    /**
     * Loads a file using thunks
     * @param {string} pathname - File path to load
     */
    loadFile: async (pathname) => {
        log.info('ACTION', 'LOAD_FILE_START', `Triggering loadFile action for: ${pathname}`);
        try {
            // Use the thunk action creator
            await appStore.dispatch(fileActions.loadFileContent(pathname));
            
            log.info('ACTION', 'LOAD_FILE_SUCCESS', `loadFile executed successfully for: ${pathname}`);
            return true;
        } catch (error) {
            log.error('ACTION', 'LOAD_FILE_FAILED', `Error during loadFile trigger: ${error.message}`, error);
            alert(`An error occurred while trying to load ${pathname}`);
            return false;
        }
    },

    /**
     * Loads directory listing using thunks
     * @param {string} pathname - Directory path to load
     */
    loadDirectory: async (pathname) => {
        log.info('ACTION', 'LOAD_DIRECTORY_START', `Triggering loadDirectory action for: ${pathname}`);
        try {
            // Use the thunk action creator
            await appStore.dispatch(fileActions.loadDirectoryListing(pathname));
            
            log.info('ACTION', 'LOAD_DIRECTORY_SUCCESS', `loadDirectory executed successfully for: ${pathname}`);
            return true;
        } catch (error) {
            log.error('ACTION', 'LOAD_DIRECTORY_FAILED', `Error during loadDirectory trigger: ${error.message}`, error);
            alert(`An error occurred while trying to load directory ${pathname}`);
            return false;
        }
    },

    /**
     * Loads top-level directories using thunks
     */
    loadTopLevelDirectories: async () => {
        log.info('ACTION', 'LOAD_TOP_LEVEL_DIRECTORIES_START', 'Triggering loadTopLevelDirectories action...');
        try {
            // Use the thunk action creator
            await appStore.dispatch(fileActions.loadTopLevelDirectories());
            
            log.info('ACTION', 'LOAD_TOP_LEVEL_DIRECTORIES_SUCCESS', 'loadTopLevelDirectories executed successfully.');
            return true;
        } catch (error) {
            log.error('ACTION', 'LOAD_TOP_LEVEL_DIRECTORIES_FAILED', `Error during loadTopLevelDirectories trigger: ${error.message}`, error);
            alert('An error occurred while trying to load top-level directories');
            return false;
        }
    },

    /**
     * Deletes a file using thunks
     * @param {string} pathname - File path to delete
     */
    deleteFile: async (pathname) => {
        log.info('ACTION', 'DELETE_FILE_START', `Triggering deleteFile action for: ${pathname}`);
        try {
            // Use the thunk action creator
            await appStore.dispatch(fileActions.deleteFile(pathname));
            
            log.info('ACTION', 'DELETE_FILE_SUCCESS', `deleteFile executed successfully for: ${pathname}`);
            return true;
        } catch (error) {
            log.error('ACTION', 'DELETE_FILE_FAILED', `Error during deleteFile trigger: ${error.message}`, error);
            alert(`An error occurred while trying to delete ${pathname}`);
            return false;
        }
    },

    /**
     * Downloads static HTML for the current file
     */
    downloadStaticHTML: async () => {
        log.info('ACTION', 'DOWNLOAD_STATIC_HTML_START', 'Triggering downloadStaticHTML action...');
        try {
            const currentPathname = selectors.getCurrentFilePath(appStore.getState());
            const currentContent = selectors.getCurrentFileContent(appStore.getState());
            
            if (!currentPathname || !currentContent) {
                throw new Error('No file selected or no content to download');
            }
            
            // Generate static HTML
            const htmlContent = await generateStaticHtmlForPublish(currentContent, currentPathname);
            
            // Create download link
            downloadStaticHTML(htmlContent, currentPathname);
            
            log.info('ACTION', 'DOWNLOAD_STATIC_HTML_SUCCESS', 'downloadStaticHTML executed successfully.');
            return true;
        } catch (error) {
            log.error('ACTION', 'DOWNLOAD_STATIC_HTML_FAILED', `Error during downloadStaticHTML trigger: ${error.message}`, error);
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
        log.info('ACTION', 'PUBLISH_TO_SPACES_START', `Triggering publishToSpaces action for: ${pathname}`);
        try {
            const result = await publishService.publishToSpaces(htmlContent, pathname);
            
            log.info('ACTION', 'PUBLISH_TO_SPACES_SUCCESS', `publishToSpaces executed successfully for: ${pathname}`);
            return result;
        } catch (error) {
            log.error('ACTION', 'PUBLISH_TO_SPACES_FAILED', `Error during publishToSpaces trigger: ${error.message}`, error);
            alert(`An error occurred while trying to publish ${pathname}`);
            throw error;
        }
    }
}; 