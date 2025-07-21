import fileManager from "/client/filesystem/fileManager.js";
import { initPreview, updatePreview } from "./index.js";

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('Markdown');

let requiresMathJax = false;

let lastMarkdown = "";
let updateScheduled = false;
let updateTimeout;
let previewInitialized = false;

// Initialize the markdown preview
export function initMarkdownPreview() {
  try {
    if (previewInitialized) return true;
    
    const result = initPreview({
      container: '#md-preview',
      plugins: ['mermaid', 'katex', 'highlight', 'audioMD'],
      theme: 'light'
    });
    
    previewInitialized = result;
    return result;
  } catch (error) {
    log.error('MARKDOWN', 'INIT_FAILED', `Failed to initialize preview: ${error.message}`, error);
    return false;
  }
}

// Schedule a preview update with debouncing
export function schedulePreviewUpdate() {
  if (updateScheduled) return;
  updateScheduled = true;

  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(() => {
    requestAnimationFrame(() => {
      const editor = document.getElementById('md-editor');
      if (editor) {
        updateMarkdownPreview(editor.value);
      }
      updateScheduled = false;
    });
  }, 300); // Reduced from 1000ms to 300ms for better responsiveness
}

// Ensure the preview container exists and is properly initialized
function ensurePreviewContainer() {
  let preview = document.querySelector(".preview-container");
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'md-preview';
    document.querySelector(".preview-container");
    console.log('Created md-preview container');
  }
  return preview;
}

// Update the markdown preview
export function updateMarkdownPreview(content) {
  return updatePreview(content);
}

// Backward compatibility with existing code
export async function loadFile(filename) {
  try {
    const response = await globalFetch(`/api/files/get?name=${encodeURIComponent(filename)}&dir=${encodeURIComponent(fileManager.getCurrentDirectory())}`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    
    const data = await response.json();
    console.log('Fetched markdown content:', data.content);
    
    const editor = document.getElementById('md-editor');
    if (editor) {
      editor.value = data.content;
    }
    
    updateMarkdownPreview(data.content);
    saveState(fileManager.getCurrentDirectory(), filename);
    updateUrlState(fileManager.getCurrentDirectory(), filename);
  } catch (error) {
    log.error('MARKDOWN', 'LOAD_FILE_FAILED', `Failed to load file: ${error.message}`, error);
  }
}

// Backward compatibility - export the updateMarkdownPreview function as updatePreview
export { updateMarkdownPreview as updatePreview };

// Function to initialize image delete handlers
function initImageDeleteHandlers() {
  // Don't redefine the handler - it's now managed in main.js
  // and domEvents.js
  log.info('MARKDOWN', 'INIT_IMAGE_HANDLERS', '[MARKDOWN] Image delete handlers will be initialized by main.js');
}

// Process Mermaid diagrams (deprecated, kept for backward compatibility)
export function processMermaidDiagrams() {
  log.info('MARKDOWN', 'PROCESS_MERMAID', '[MARKDOWN] processMermaidDiagrams is deprecated, handled by preview system');
}

// Save the current state using consistent keys with main file system
function saveState(directory, filename) {
  try {
    // Use the same keys as the main file system for consistency
    if (filename) {
      const fullPath = directory ? `${directory}/${filename}` : filename;
      localStorage.setItem('devpages_last_file', fullPath);
      if (directory) {
        localStorage.setItem('devpages_last_directory', directory);
      }
      console.log(`[Markdown] Saved last opened file: "${fullPath}"`);
    } else if (directory) {
      localStorage.setItem('devpages_last_directory', directory);
      localStorage.removeItem('devpages_last_file');
      console.log(`[Markdown] Saved last opened directory: "${directory}"`);
    }
  } catch (error) {
    console.error('Failed to save state:', error);
  }
}

// Update URL state
function updateUrlState(directory, filename) {
  try {
    const url = new URL(window.location);
    url.searchParams.set('dir', directory);
    url.searchParams.set('file', filename);
    window.history.replaceState({}, '', url);
  } catch (error) {
    console.error('Failed to update URL state:', error);
  }
}

// Check if MathJax needs to be configured
if (requiresMathJax) {
  configureMathJax(head);
}
