import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';
import { globalFetch } from '/client/globalFetch.js';

// Helper for logging within this module
function logStaticGen(message, level = 'debug') {
    const type = 'STATIC_GEN_API'; // Keep distinct type for debugging
    if (typeof logMessage === 'function') {
        logMessage(message, level, type);
    } else {
        // Fallback if global logger not ready
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

/**
 * Triggers static HTML generation via a server API endpoint and initiates download.
 */
export async function downloadStaticHTML() {
    logStaticGen('Requesting static HTML generation via API...');

    try {
        // --- Get Preview Div Content ---
        const previewElement = document.getElementById('preview-container');
        if (!previewElement) {
            // Log the error but also alert the user
            logStaticGen('Preview container element (#preview-container) not found.', 'error');
            alert('Error: Preview container element not found. Cannot generate static HTML.');
            return; // Stop execution
        }
        // Capture the innerHTML, assuming the server wrapper adds the container back
        // Or capture outerHTML if the server expects the full container. Let's start with outerHTML
        // as the diff implies the old version sent renderedHtml from client.
        const renderedHtml = previewElement.outerHTML;
        logStaticGen(`Captured preview div outerHTML (length: ${renderedHtml.length})`);
        if (!renderedHtml || renderedHtml.trim() === '') {
             logStaticGen('Preview container content is empty.', 'warn');
             // Optional: Alert user? Proceeding might result in empty file.
        }

        // --- Get File Info (using appStore) ---
        const state = appStore.getState(); // Use appStore here
        const currentPathname = state.file?.currentPathname || null;
        const isDirectory = state.file?.isDirectorySelected || false;
        let baseFilename = 'static-preview'; // Default base filename

        if (currentPathname && !isDirectory) {
             baseFilename = currentPathname.split('/').pop() || baseFilename;
        } else {
             logStaticGen(`Selection is directory or unknown: Path='${currentPathname}', IsDir=${isDirectory}. Using default base filename.`, 'warning');
        }
        logStaticGen(`Using file info: Pathname='${currentPathname}', BaseFilename='${baseFilename}'`);


        // --- Get Original Markdown ---
        let markdownContent = '<!-- Could not retrieve original Markdown source -->';
        // Access editor content directly from appStore state if possible/reliable
        if (state.editor && typeof state.editor.content === 'string') {
             markdownContent = state.editor.content;
             logStaticGen(`Retrieved markdown from appStore state (length: ${markdownContent.length})`);
        } else {
            // Fallback: Try importing editor module dynamically (might fail if editor not loaded)
            try {
                const editorModule = await import('/client/editor.js'); // Ensure path is correct
                if (editorModule && typeof editorModule.getContent === 'function') {
                    markdownContent = editorModule.getContent() || markdownContent;
                    logStaticGen(`Retrieved markdown via editorModule.getContent() (length: ${markdownContent.length})`);
                } else {
                     logStaticGen('Editor module loaded but getContent not found or returned null.', 'warn');
                }
            } catch (editorError) {
                logStaticGen(`Could not get markdown content dynamically from editor: ${editorError.message}`, 'warn');
            }
        }


        // --- Get Active CSS Files (using appStore) ---
        // Assuming previewCssFiles is the correct state path now
        const activeCssFiles = state.editor?.previewCssFiles || [];
        const rootCssEnabled = state.editor?.rootCssEnabled ?? true; // Default to true
        const cssFilesToSend = [...activeCssFiles];
        if (rootCssEnabled) {
             cssFilesToSend.unshift('styles.css'); // Add root styles if enabled
        }
        logStaticGen(`Including ${cssFilesToSend.length} active CSS paths: ${JSON.stringify(cssFilesToSend)}`);


        // --- Call Server API ---
        logStaticGen(`Sending request to /api/preview/generate-static...`);
        const response = await globalFetch('/api/preview/generate-static', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // globalFetch should handle auth headers if needed based on its implementation
            },
            body: JSON.stringify({
                filePath: currentPathname, // Send the original path for context
                markdownSource: markdownContent,
                renderedHtml: renderedHtml, // Send the client-captured rendered HTML
                activeCssPaths: cssFilesToSend // Send the list of CSS files used
            })
        });

        if (!response.ok) {
             const errorText = await response.text();
             let errorMessage = `Server error ${response.status}: ${errorText || response.statusText}`;
             try {
                 // Attempt to parse JSON error from server for a cleaner message
                 const errorJson = JSON.parse(errorText);
                 errorMessage = `Server error ${response.status}: ${errorJson.error || errorJson.details || errorText}`;
             } catch (e) {
                 // Ignore parsing error, use plain text
             }
             logStaticGen(errorMessage, 'error'); // Log the detailed error
             throw new Error(`Failed to generate static file (${response.status})`); // Throw generic error for alert
        }

        // --- Get HTML from Response ---
        const finalHtmlContent = await response.text();
        logStaticGen(`Received static HTML content from server (length: ${finalHtmlContent.length})`);
        if (!finalHtmlContent) {
            throw new Error('Server returned empty HTML content.');
        }

        // --- Trigger Download (using client-side baseFilename) ---
        const blob = new Blob([finalHtmlContent], { type: 'text/html;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        // --- Updated Filename Generation ---
        // 1. Get Unix epoch time in seconds
        const epochSeconds = Math.floor(Date.now() / 1000);
        // 2. Convert to base-36
        const base36Timestamp = epochSeconds.toString(36);
        // 3. Get base filename and sanitize
        const safeBaseFilename = baseFilename.replace(/[^a-z0-9_.-]/gi, '_').replace(/ /g, '-');
        // 4. Construct the final filename
        a.download = `${safeBaseFilename}-${base36Timestamp}.html`;
        // --- End Updated Filename Generation ---

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        logStaticGen(`Static HTML download initiated as ${a.download}.`);

    } catch (error) {
        logStaticGen(`Error during static HTML generation via API: ${error.message}`, 'error');
        console.error("[STATIC HTML GEN API ERROR]", error); // Keep console error for details
        // Provide a user-friendly alert
        alert(`Failed to generate static HTML: ${error.message}`);
    }
}

