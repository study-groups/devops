import { logMessage } from "./utils.js";
import { updatePreview } from "./markdown.js";

let scrollLockEnabled = false;
let updateScheduled = false;
let updateTimeout = null;

/**
 * Synchronizes the preview scroll position to match the editor scroll position.
 */
export function syncScroll() {
    if (!scrollLockEnabled) return;

    const editor = document.getElementById("md-editor");
    const preview = document.getElementById("preview");

    const scrollRatio =
        editor.scrollTop / (editor.scrollHeight - editor.clientHeight);
    preview.scrollTop =
        scrollRatio * (preview.scrollHeight - preview.clientHeight);
}

/**
 * Toggles whether scroll syncing is enabled or disabled.
 */
export function toggleScrollLock() {
    scrollLockEnabled = !scrollLockEnabled;
    const button = document.getElementById("scroll-lock-btn");
    if (button) {
        button.textContent = scrollLockEnabled ? "Unlock Scroll" : "Lock Scroll";
    }
    logMessage(`Scroll Lock: ${scrollLockEnabled ? "Enabled" : "Disabled"}`);
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
        scrollLockBtn.addEventListener("click", toggleScrollLock);
    }
});
