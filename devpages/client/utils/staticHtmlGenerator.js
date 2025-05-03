import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';
import { globalFetch } from '/client/globalFetch.js'; // Assuming globalFetch handles auth headers if needed

// Helper for logging within this module
function logStaticGen(message, level = 'debug') {
    const type = 'STATIC_GEN_API';
    if (typeof logMessage === 'function') {
        logMessage(message, level, type);
    } else {
        const logFunc = level === 'error' ? console.error : (level === 'warning' ? console.warn : console.log);
        logFunc(`[${type}] ${message}`);
    }
}

/**
 * Generates static HTML by sending context to a server API endpoint.
 */
export async function downloadStaticHTML() {
    logStaticGen('Requesting static HTML generation via API...');

    try {
        // --- Get Preview Div Content ---
        const previewElement = document.getElementById('preview-container');
        if (!previewElement) {
            throw new Error('Preview container element (#preview-container) not found.');
        }
        const renderedHtml = previewElement.outerHTML;
        logStaticGen(`Captured preview div outerHTML (length: ${renderedHtml.length})`);

        // --- Get File Info (using appStore) ---
        const state = appStore.getState();
        const currentPathname = state.file?.currentPathname || null; // Full path is better for server context
        const isDirectory = state.file?.isDirectorySelected || false;
        let baseFilename = 'unknown_file'; // Used for download filename

        if (currentPathname && !isDirectory) {
             baseFilename = currentPathname.split('/').pop();
        } else {
             logStaticGen(`Selection is directory or unknown: Path='${currentPathname}', IsDir=${isDirectory}. Using default base filename.`, 'warning');
        }
        logStaticGen(`Using file info: Pathname='${currentPathname}', BaseFilename='${baseFilename}'`);


        // --- Get Original Markdown ---
        let markdownContent = '<!-- Could not retrieve original Markdown source -->';
        try {
            const editorModule = await import('/client/editor.js');
            markdownContent = editorModule?.getContent?.() || markdownContent;
        } catch (editorError) {
            logStaticGen(`Could not get markdown content from editor: ${editorError.message}`, 'warning');
        }

        // --- Get Active CSS Files from Settings ---
        const activeCssFiles = state.settings?.preview?.activeCssFiles || [];
        logStaticGen(`Including ${activeCssFiles.length} active CSS paths from settings: ${JSON.stringify(activeCssFiles)}`);


        // --- Call Server API ---
        logStaticGen(`Sending request to /api/preview/generate-static...`);
        const response = await globalFetch('/api/preview/generate-static', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // globalFetch might add auth headers automatically
            },
            body: JSON.stringify({
                filePath: currentPathname, // Send the full path if available
                markdownSource: markdownContent,
                renderedHtml: renderedHtml,
                activeCssPaths: activeCssFiles // <<< SEND ACTIVE CSS PATHS
            })
        });

        if (!response.ok) {
             const errorText = await response.text();
             try {
                 // Attempt to parse JSON error from server
                 const errorJson = JSON.parse(errorText);
                 throw new Error(`Server error ${response.status}: ${errorJson.error || errorJson.details || errorText}`);
             } catch (e) {
                 // Fallback to plain text error
                 throw new Error(`Server error ${response.status}: ${errorText || response.statusText}`);
             }
        }

        // --- Get HTML from Response ---
        const finalHtmlContent = await response.text();
        logStaticGen(`Received static HTML content from server (length: ${finalHtmlContent.length})`);

        // --- Trigger Download (using client-side baseFilename) ---
        const blob = new Blob([finalHtmlContent], { type: 'text/html;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        // Filename logic (using baseFilename derived on client)
        let downloadBase = baseFilename;
        const lastDotIndex = downloadBase.lastIndexOf('.');
        if (lastDotIndex > 0 && downloadBase !== 'unknown_file') {
            downloadBase = downloadBase.substring(0, lastDotIndex);
        }
        const sanitizedBaseName = downloadBase.replace(/[\\/:\*\?"<>\|]/g, '_');
        const downloadFilename = `${sanitizedBaseName || 'static-preview'}.html`;

        a.download = downloadFilename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        logStaticGen(`Static HTML download initiated as ${downloadFilename}.`);

    } catch (error) {
        logStaticGen(`Error during static HTML generation via API: ${error.message}`, 'error');
        console.error("[STATIC HTML GEN API ERROR]", error);
        alert(`Failed to generate static HTML: ${error.message}`);
    }
    // No iframe cleanup needed anymore
} 