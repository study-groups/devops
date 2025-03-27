/**
 * Core Module Index
 * Exports core functionality from each module
 * IMPORTANT: Do not import from this file within the core modules themselves
 */

// Import core modules
import * as authModule from './auth.js';
import * as viewsModule from './views.js';
import * as uiModule from './ui.js';
import * as buttonsModule from './buttons.js';
import * as mainModule from './main.js';
import * as editorModule from './editor.js';
import * as previewModule from './preview.js';
import * as fileManagerModule from './fileManager.js';

// Re-export as object properties for easy access
export const auth = authModule;
export const views = viewsModule;
export const ui = uiModule;
export const buttons = buttonsModule;
export const main = mainModule;
export const editor = editorModule;
export const preview = previewModule;
export const fileManager = fileManagerModule;

// Export important functions directly for convenience
export const { initializeApplication } = mainModule;
export const { registerButtonHandler, registerButtons } = buttonsModule;
export const { setView, getView, initViewControls } = viewsModule;
export const { initializeEditor, setContent, getContent } = editorModule;
export const { initializePreview, refreshPreview, schedulePreviewUpdate } = previewModule;
export const { 
  initializeFileManager, 
  loadFile, 
  saveFile, 
  getCurrentDirectory, 
  getCurrentFile 
} = fileManagerModule;

/**
 * Initialize core functionality
 */
export function initializeCore() {
  console.log('Core modules initialized');
  
  // Any additional initialization can go here
  
  return {
    auth: authModule,
    views: viewsModule,
    ui: uiModule,
    buttons: buttonsModule,
    main: mainModule,
    editor: editorModule,
    preview: previewModule,
    fileManager: fileManagerModule
  };
}