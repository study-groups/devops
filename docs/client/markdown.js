import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import mermaid from "https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.2.4/mermaid.esm.min.mjs";
import { logMessage } from "./utils.js";

mermaid.initialize({ startOnLoad: false });

let lastMarkdown = "";
let updateScheduled = false;
let updateTimeout;

export function updatePreview(mdText) {
    if (mdText === lastMarkdown) return; // Skip if unchanged
    lastMarkdown = mdText;

    logMessage('Updating preview...');
    try {
        const preview = document.getElementById('preview');
        preview.innerHTML = marked.parse(mdText, { gfm: true, breaks: true });

        // Render Mermaid diagrams
        mermaid.init(undefined, document.querySelectorAll('.language-mermaid'));

        //logMessage('Preview updated');
    } catch (error) {
        logMessage(`Preview error: ${error.message}`);
        console.error('Preview error:', error);
    }
}

export function schedulePreviewUpdate() {
    if (updateScheduled) return;
    updateScheduled = true;

    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
            updatePreview(document.getElementById('md-editor').value);
            updateScheduled = false;
        });
    }, 1000); // Debounce interval
}
