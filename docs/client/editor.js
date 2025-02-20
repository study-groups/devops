// editor.js
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import mermaid from "https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.2.4/mermaid.esm.min.mjs";

import { initializeFileManager, loadFiles, loadFile, saveFile } from "./fileManager.js";
import { uploadImage } from "./imageManager.js";
import { setView } from "./viewManager.js";

// Only scroll sync + lock, no preview logic
import { syncScroll, toggleScrollLock } from "./scrollSync.js";

// For logging, if needed
import { logMessage } from "./utils.js";

import { updateTopBar } from './components/topBar.js';

// Debounce variables
let updateScheduled = false;
let updateTimeout = null;
const DEBOUNCE_INTERVAL = 500; // Adjust as needed

/**
 * Renders Markdown/mermaid into the #preview element.
 */
function updatePreview(mdText) {
    const preview = document.getElementById("preview");
    preview.innerHTML = marked.parse(mdText, { gfm: true, breaks: true });
    mermaid.init(undefined, document.querySelectorAll(".language-mermaid"));
    logMessage('[EDITOR] Preview updated');
}

/**
 * Debounces the preview update to avoid excessive re-renders.
 */
function schedulePreviewUpdate() {
    if (updateScheduled) return;
    updateScheduled = true;

    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
        // Request animation frame to reduce layout thrashing
        requestAnimationFrame(() => {
            const editor = document.getElementById("md-editor");
            if (editor) {
                updatePreview(editor.value);
            }
            updateScheduled = false;
        });
    }, DEBOUNCE_INTERVAL);
}

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
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await initializeFileManager();
    mermaid.initialize({ startOnLoad: false });
    
    const editor = document.getElementById("md-editor");
    if (editor) {
        editor.addEventListener("input", schedulePreviewUpdate);
        editor.addEventListener("scroll", syncScroll);
    }

    // Add scroll lock button handler
    const scrollLockBtn = document.getElementById("scroll-lock-btn");
    if (scrollLockBtn) {
        scrollLockBtn.addEventListener("click", toggleScrollLock);
    }

    document.getElementById("code-view").addEventListener("click", () => setView("code"));
    document.getElementById("preview-view").addEventListener("click", () => setView("preview"));
    document.getElementById("split-view").addEventListener("click", () => setView("split"));

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

    setView("split");
    logMessage('[EDITOR] View mode changed to: split');
});
