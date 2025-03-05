import { logMessage } from "./log.js";
import { updatePreview } from "./markdown.js";

let scrollLockEnabled = false;
let updateScheduled = false;
let updateTimeout = null;
let syncInProgress = false;

/**
 * Synchronizes the preview scroll position to match the editor scroll position.
 */
export function syncScroll() {
    if (!scrollLockEnabled) return;

    // Use requestAnimationFrame for smoother scrolling
    if (!syncInProgress) {
        syncInProgress = true;
        requestAnimationFrame(() => {
            const editor = document.querySelector('#md-editor textarea');
            const preview = document.getElementById('md-preview');
            
            if (!editor || !preview) {
                syncInProgress = false;
                return;
            }

            const editorScrollHeight = editor.scrollHeight - editor.clientHeight;
            if (editorScrollHeight <= 0) {
                syncInProgress = false;
                return; // Avoid division by zero
            }
            
            const scrollRatio = editor.scrollTop / editorScrollHeight;
            const previewScrollHeight = preview.scrollHeight - preview.clientHeight;
            
            // Only update if there's a significant change
            if (Math.abs(preview.scrollTop - (scrollRatio * previewScrollHeight)) > 2) {
                preview.scrollTop = scrollRatio * previewScrollHeight;
            }
            
            syncInProgress = false;
        });
    }
}

/**
 * Toggles whether scroll syncing is enabled or disabled.
 */
export function toggleScrollLock() {
    scrollLockEnabled = !scrollLockEnabled;
    
    // Add or remove the scroll-lock class to the content container
    const content = document.getElementById('content');
    if (content) {
        if (scrollLockEnabled) {
            content.classList.add('scroll-lock');
        } else {
            content.classList.remove('scroll-lock');
        }
    }
    
    const button = document.getElementById("scroll-lock-btn");
    if (button) {
        // Keep the ⇄ icon consistent with the refresh button style
        button.textContent = "⇄";
        button.classList.toggle('active', scrollLockEnabled);
        button.title = scrollLockEnabled ? "Unlock Scroll" : "Lock Scroll";
    }
    
    logMessage(`[SCROLL] Scroll Lock: ${scrollLockEnabled ? "Enabled" : "Disabled"}`);
}

/**
 * Debounces the Markdown preview update to avoid excessive re-renders.
 */
export function schedulePreviewUpdate() {
    if (updateScheduled) return;
    updateScheduled = true;

    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
            updatePreview(document.getElementById("md-editor").value);
            updateScheduled = false;
        });
    }, 300);
}

document.addEventListener("DOMContentLoaded", () => {
    const editor = document.getElementById("md-editor");
    if (editor) {
        editor.addEventListener("input", schedulePreviewUpdate);
        editor.addEventListener("scroll", syncScroll);
    }

    // Manually placed scroll-lock button in HTML
    const scrollLockBtn = document.getElementById("scroll-lock-btn");
    if (scrollLockBtn) {
        // Initialize the button with the icon
        scrollLockBtn.textContent = "⇄";
        scrollLockBtn.addEventListener("click", toggleScrollLock);
    }
});
