/**
 * Publish/Unpublish Button Component - Interacts with Server for DO Spaces
 * Creates/removes a publicly accessible link via a server endpoint.
 */

import eventBus from '/client/eventBus.js';
import { appStore } from '/client/appState.js'; 

// --- Configuration ---
const PUBLISH_API_ENDPOINT = '/api/publish'; // Base endpoint
const EDITOR_SELECTORS = [
    '#md-editor textarea',           // Original selector
    '#editor-container textarea',    // From actions.js
    'textarea.markdown-editor',      // Class-based selector
    'textarea#editor',               // ID-based selector
    'textarea'                       // Last resort - any textarea
];

// --- State ---
let currentPublishedState = { isPublished: false, url: null, path: null };
let isHandlingClick = false; // Prevent double clicks

// --- DOM Elements ---
let publishButtonElement = null;
let linkDisplayElement = null;
let linkInputElement = null;
let copyButtonElement = null;

// Helper for logging
const logMessage = (message, level = 'info') => {
    const type = "PUBLISH";
    if (typeof window.logMessage === 'function') {
        window.logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : 
                      (level === 'warning' ? console.warn : 
                      (level === 'info' ? console.info : console.log));
        logFunc(`[${type}] ${message}`);
    }
};

// Setup event listeners
function setupPublishButtonListener() {
    logMessage('Setting up publish button listener...', 'info');
    
    // Listen for requests from ContextManagerComponent
    eventBus.on('publish:request', handlePublishRequest);
    
    // Initial check when setup is called
    const fileState = appStore.getState().file;
    if (fileState.currentPathname && !fileState.isDirectorySelected) {
        checkPublishStatus(fileState.currentPathname);
    } else {
        updateButtonUI(false); // Assume not published if no file selected
    }

    // Also listen for navigation events to re-check status
    eventBus.on('navigate:pathname', (data) => {
        if (data.pathname && !data.isDirectory) {
            checkPublishStatus(data.pathname);
        } else {
            // Clear publish state if navigating to a directory or null path
            currentPublishedState = { isPublished: false, url: null, path: null };
            updateButtonUI(false);
        }
    });
    
    logMessage('Publish button listener setup complete', 'info');
}

// Find and cache button elements
function ensureElements() {
    if (!publishButtonElement) {
        publishButtonElement = document.getElementById('publish-btn');
    }
    
    if (!linkDisplayElement) {
        const container = document.querySelector('.file-action-buttons'); 
        if (container) {
            linkDisplayElement = container.querySelector('.publish-link-display');
            if (!linkDisplayElement) {
                linkDisplayElement = document.createElement('div');
                linkDisplayElement.className = 'publish-link-display';
                linkDisplayElement.style.display = 'none';
                linkDisplayElement.innerHTML = `
                    <input type="text" readonly class="publish-link-input" />
                    <button class="copy-link-btn">Copy</button>
                `;
                container.appendChild(linkDisplayElement);

                linkInputElement = linkDisplayElement.querySelector('.publish-link-input');
                copyButtonElement = linkDisplayElement.querySelector('.copy-link-btn');
                copyButtonElement.addEventListener('click', handleCopyClick);
            } else {
                linkInputElement = linkDisplayElement.querySelector('.publish-link-input');
                copyButtonElement = linkDisplayElement.querySelector('.copy-link-btn');
            }
        }
    }
    return publishButtonElement && linkDisplayElement;
}

// Handle publish request from button click
async function handlePublishRequest(data) {
    if (isHandlingClick) {
        logMessage('Already handling a publish/unpublish action.', 'warn');
        return;
    }
    
    if (!data || !data.pathname) {
        logMessage('Invalid publish request data.', 'error');
        return;
    }

    const pathname = data.pathname;
    logMessage(`Received publish request for: ${pathname}`);

    if (!ensureElements()) {
        logMessage('Publish button or link display not found.', 'error');
        return;
    }

    isHandlingClick = true;
    publishButtonElement.disabled = true;
    const originalButtonText = publishButtonElement.textContent;
    publishButtonElement.textContent = 'Processing...';

    try {
        const isCurrentlyPublished = currentPublishedState.isPublished && 
                                    currentPublishedState.path === pathname;

        let response;
        let payload;

        if (isCurrentlyPublished) {
            // --- Unpublish ---
            logMessage(`Attempting to unpublish: ${pathname}`);
            response = await fetch(`${PUBLISH_API_ENDPOINT}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pathname: pathname }),
            });
            payload = await response.json();

            if (!response.ok || !payload.success) {
                throw new Error(payload.message || `Failed to unpublish (${response.status})`);
            }
            
            logMessage(`Successfully unpublished: ${pathname}`);
            currentPublishedState = { isPublished: false, url: null, path: pathname };
            updateButtonUI(false);

        } else {
            // --- Publish ---
            logMessage(`Attempting to publish: ${pathname}`);
            let editor = null;
            let content = '';

            // Try each selector until we find the editor
            for (const selector of EDITOR_SELECTORS) {
                editor = document.querySelector(selector);
                if (editor) {
                    logMessage(`Found editor using selector: ${selector}`, 'debug');
                    break;
                }
            }

            if (!editor) {
                // Log which selectors were tried
                logMessage(`Editor not found. Tried selectors: ${EDITOR_SELECTORS.join(', ')}`, 'error');
                throw new Error('Markdown editor not found.');
            }

            // Get editor content
            content = editor.value || '';
            logMessage(`Got editor content (${content.length} characters)`, 'debug');

            response = await fetch(`${PUBLISH_API_ENDPOINT}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pathname: pathname, content: content }),
            });
            payload = await response.json();

            if (!response.ok || !payload.success || !payload.url) {
                throw new Error(payload.message || `Failed to publish (${response.status})`);
            }
            
            logMessage(`Successfully published: ${pathname} at ${payload.url}`);
            currentPublishedState = { isPublished: true, url: payload.url, path: pathname };
            updateButtonUI(true, payload.url);
        }

    } catch (error) {
        logMessage(`Error: ${error.message}`, 'error');
        alert(`Action failed: ${error.message}`);
        updateButtonUI(currentPublishedState.isPublished, currentPublishedState.url);
    } finally {
        isHandlingClick = false;
        if (publishButtonElement) {
            publishButtonElement.disabled = false;
            if (publishButtonElement.textContent === 'Processing...') {
                publishButtonElement.textContent = originalButtonText;
            }
        }
    }
}

// Check if the current file is published
async function checkPublishStatus(pathname) {
    if (!pathname) return;
    
    logMessage(`Checking status for: ${pathname}`);
    
    if (!ensureElements()) {
        logMessage('Cannot check status, UI elements not ready.', 'warn');
        return;
    }
    
    publishButtonElement.disabled = true;

    try {
        const response = await fetch(`${PUBLISH_API_ENDPOINT}?pathname=${encodeURIComponent(pathname)}`, {
            method: 'GET',
        });
        const payload = await response.json();

        if (!response.ok) {
            if (response.status === 404) {
                logMessage(`File not found for status check: ${pathname}`);
                currentPublishedState = { isPublished: false, url: null, path: pathname };
                updateButtonUI(false);
                return;
            }
            throw new Error(payload.message || `Failed to check status (${response.status})`);
        }

        logMessage(`Status checked for ${pathname}: Published=${payload.isPublished}`);
        currentPublishedState = { isPublished: payload.isPublished, url: payload.url, path: pathname };
        updateButtonUI(payload.isPublished, payload.url);

    } catch (error) {
        logMessage(`Status check error: ${error.message}`, 'error');
        currentPublishedState = { isPublished: false, url: null, path: pathname };
        updateButtonUI(false);
    } finally {
        if (publishButtonElement) {
            publishButtonElement.disabled = false;
        }
    }
}

// Update Button and Link Display UI
function updateButtonUI(isPublished, url = null) {
    if (!ensureElements()) return;

    if (isPublished && url) {
        publishButtonElement.textContent = 'Unpublish';
        publishButtonElement.classList.add('published');
        linkInputElement.value = url;
        linkDisplayElement.style.display = 'flex';
        copyButtonElement.textContent = 'Copy';
    } else {
        publishButtonElement.textContent = 'Publish';
        publishButtonElement.classList.remove('published');
        linkDisplayElement.style.display = 'none';
        linkInputElement.value = '';
    }
    publishButtonElement.disabled = isHandlingClick;
}

// Handle Copy Button Click
function handleCopyClick() {
    if (!linkInputElement || !copyButtonElement) return;
    
    linkInputElement.select();
    
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(linkInputElement.value).then(() => {
                copyButtonElement.textContent = 'Copied!';
                setTimeout(() => { copyButtonElement.textContent = 'Copy'; }, 2000);
            }).catch(err => {
                logMessage('Async copy failed: ' + err, 'warn');
                fallbackCopy();
            });
        } else {
            fallbackCopy();
        }
    } catch (error) {
        logMessage(`Copy error: ${error.message}`, 'error');
        alert('Failed to copy link.');
    }
}

function fallbackCopy() {
    if (document.execCommand('copy')) {
        copyButtonElement.textContent = 'Copied!';
        setTimeout(() => { copyButtonElement.textContent = 'Copy'; }, 2000);
    } else {
        logMessage('execCommand copy failed.', 'warn');
        alert('Copy command failed.');
    }
}

// Export at the end only
export { setupPublishButtonListener, checkPublishStatus }; 