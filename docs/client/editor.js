// editor.js
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import mermaid from "https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.2.4/mermaid.esm.min.mjs";

import { loadFiles, loadFile, saveFile } from "./fileManager.js";
import { uploadImage } from "./imageManager.js";
import { setView } from "./viewManager.js";

// Only scroll sync + lock, no preview logic
import { syncScroll, toggleScrollLock } from "./scrollSync.js";

// For logging, if needed
import { logMessage } from "./utils.js";

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

document.addEventListener("DOMContentLoaded", async () => {
    mermaid.initialize({ startOnLoad: false });

    const editor = document.getElementById("md-editor");
    if (editor) {
        // Debounced preview on input
        editor.addEventListener("input", schedulePreviewUpdate);
    }

    document.getElementById("load-btn").addEventListener("click", () => {
        const filename = document.getElementById("file-select").value;
        loadFile(filename);
    });

    document.getElementById("save-btn").addEventListener("click", saveFile);
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

    await loadFiles();
    setView("split");
});
