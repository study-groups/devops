// editor.js
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import mermaid from "https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.2.4/mermaid.esm.min.mjs";

import { initializeFileManager, loadFiles, loadFile, saveFile, connectLoadButton, connectFileSelect, connectSaveButton } from "./fileManager.js";
import { uploadImage } from "./imageManager.js";
import { setView } from "./viewManager.js";

// Only scroll sync + lock, no preview logic
import { syncScroll, toggleScrollLock } from "./scrollSync.js";

// For logging, if needed
import { logMessage } from "./log.js";


// Import SVG processing functionality
import { initSvgRefreshButton, registerRefreshFunction, executeRefresh } from "./markdown-svg.js";

// Debounce variables
let updateScheduled = false;
let updateTimeout = null;
const DEBOUNCE_INTERVAL = 500; // Adjust as needed

// Use the updatePreview from markdown.js instead
import { updatePreview, schedulePreviewUpdate } from "./markdown.js";

// Add this import at the top
import { getFileSystemContext, loadFileSystemState } from './fileSystemState.js';

// Add this import at the top
import { initKeyboardShortcuts } from './keyboardShortcuts.js';

// Add this import at the top
import { initPreviewRefreshButton } from './previewRefresh.js';

// Add this import at the top
import { initRefreshButton } from './refresh.js';

// Add this import at the top
import { initializeTopNav } from './uiManager.js';

/**
 * Inserts Markdown image syntax at the current editor cursor location.
 */
function insertMarkdownImage(imageUrl) {
    if (!imageUrl) return;
    const editor = document.getElementById("md-editor");
    if (!editor) return;

    const cursorPos = editor.selectionStart;
    const textBefore = editor.value.substring(0, cursorPos);
    const textAfter = editor.value.substring(cursorPos);
    editor.value = `${textBefore}\n![](${imageUrl})\n${textAfter}`;
    
    // Schedule a preview update after inserting an image
    schedulePreviewUpdate();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        logMessage('[EDITOR] DOMContentLoaded event fired');

        // Initialize mermaid
        mermaid.initialize({ startOnLoad: false });
        
        // Connect file operation buttons
        connectLoadButton();
        connectFileSelect();
        connectSaveButton();
        
        // Initialize the unified refresh button
        initRefreshButton();
        
        // Initialize preview refresh button
        initPreviewRefreshButton();
        
        // Set up editor event listeners
        const editorTextarea = document.querySelector('#md-editor textarea');
        if (editorTextarea) {
            editorTextarea.addEventListener("input", schedulePreviewUpdate);
            editorTextarea.addEventListener("scroll", syncScroll);
            
            // Add keyboard shortcut for saving (Ctrl+S)
            editorTextarea.addEventListener('keydown', async (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                    e.preventDefault();
                    logMessage('[SAVE] Save triggered by keyboard shortcut (Ctrl+S)');
                    await saveFile();
                }
            });
        } else {
            logMessage('[EDITOR ERROR] Editor textarea not found');
        }
        
        // Set up view controls with localStorage saving
        document.getElementById("code-view")?.addEventListener("click", () => {
            setView("code");
            localStorage.setItem('viewMode', 'code');
        });
        document.getElementById("preview-view")?.addEventListener("click", () => {
            setView("preview");
            localStorage.setItem('viewMode', 'preview');
        });
        document.getElementById("split-view")?.addEventListener("click", () => {
            setView("split");
            localStorage.setItem('viewMode', 'split');
        });
        
        // Set up scroll lock
        const scrollLockBtn = document.getElementById("scroll-lock-btn");
        if (scrollLockBtn) {
            scrollLockBtn.addEventListener("click", toggleScrollLock);
        }
        
        // Initialize SVG refresh button
        initSvgRefreshButton();
        
        // Check URL parameters for initial state
        const urlParams = new URLSearchParams(window.location.search);
        const urlDir = urlParams.get('dir');
        const urlFile = urlParams.get('file');
        
        // If URL has parameters, use them
        if (urlDir) {
            // Directory will be set when files are loaded
            logMessage(`[EDITOR] URL parameter dir=${urlDir}`);
        }
        
        if (urlFile) {
            logMessage(`[EDITOR] URL parameter file=${urlFile}`);
        }
        
        // Set default view (or restore from localStorage)
        const savedView = localStorage.getItem('viewMode') || 'split';
        setView(savedView);
        logMessage(`[EDITOR] View mode changed to: ${savedView}`);

        // Initialize resizable editor
        initializeResizableEditor();

        // Initialize keyboard shortcuts
        initKeyboardShortcuts();

        // Initialize top navigation
        initializeTopNav();
    } catch (error) {
        logMessage(`[EDITOR ERROR] Initialization failed: ${error.message}`);
        console.error('[EDITOR ERROR]', error);
    }

    // Paste Image from Clipboard
    document.addEventListener("paste", async (event) => {
        const items = (event.clipboardData || window.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf("image") === 0) {
                const blob = item.getAsFile();
                const imageUrl = await uploadImage(blob);
                insertMarkdownImage(imageUrl);
            }
        }
    });

    // Drag & Drop Image Upload
    const dropZone = document.getElementById("drop-zone");
    if (dropZone) {
        dropZone.addEventListener("dragover", (event) => {
            event.preventDefault();
            dropZone.classList.add("active");
        });

        dropZone.addEventListener("dragleave", () => {
            dropZone.classList.remove("active");
        });

        dropZone.addEventListener("drop", async (event) => {
            event.preventDefault();
            dropZone.classList.remove("active");

            if (event.dataTransfer.files.length > 0) {
                const file = event.dataTransfer.files[0];
                const imageUrl = await uploadImage(file);
                insertMarkdownImage(imageUrl);
            }
        });
    }

    // Add a keyboard shortcut for refreshing (Ctrl+Alt+R)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'r') {
            e.preventDefault();
            logMessage('[REFRESH] Refresh triggered by keyboard shortcut (Ctrl+Alt+R)');
            executeRefresh();
        }
    });
});

// Extract resizable editor initialization to a separate function
function initializeResizableEditor() {
    const resizeHandle = document.querySelector('.resize-handle');
    const editorContainer = document.getElementById('md-editor');

    if (resizeHandle && editorContainer) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        resizeHandle.addEventListener('mousedown', (e) => {
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = editorContainer.offsetWidth;
            startHeight = editorContainer.offsetHeight;
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', () => {
                isResizing = false;
                document.removeEventListener('mousemove', handleMouseMove);
            });
            
            e.preventDefault();
        });

        function handleMouseMove(e) {
            if (!isResizing) return;
            
            const newWidth = startWidth + (e.clientX - startX);
            const newHeight = startHeight + (e.clientY - startY);
            
            editorContainer.style.width = `${newWidth}px`;
            editorContainer.style.height = `${newHeight}px`;
        }
    }
}
