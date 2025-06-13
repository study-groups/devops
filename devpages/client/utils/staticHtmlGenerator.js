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
 * Fetches CSS content from the server
 * @param {string} cssPath - Path to the CSS file
 * @returns {Promise<string>} CSS content or empty string if failed
 */
async function fetchCssContent(cssPath) {
    try {
        logStaticGen(`Fetching CSS content for: ${cssPath}`);
        
        let response;
        
        if (cssPath.startsWith('/client/')) {
            // Client CSS files: fetch directly from client path
            response = await globalFetch(cssPath);
        } else {
            // User CSS files: use /public/css endpoint (expects files in PD_DIR/data)
            response = await globalFetch(`/public/css?path=${encodeURIComponent(cssPath)}`);
        }
        
        if (!response.ok) {
            logStaticGen(`Failed to fetch CSS ${cssPath}: ${response.status} ${response.statusText}`, 'warn');
            return '';
        }
        
        const cssContent = await response.text();
        logStaticGen(`Successfully fetched CSS ${cssPath} (${cssContent.length} chars)`);
        return cssContent;
    } catch (error) {
        logStaticGen(`Error fetching CSS ${cssPath}: ${error.message}`, 'error');
        return '';
    }
}

/**
 * Bundles all active CSS files into a single CSS string
 * @returns {Promise<string>} Bundled CSS content
 */
async function bundleActiveCss() {
    logStaticGen(`Bundling CSS for published content`);
    
    // Get all active CSS files from app state
    const state = appStore.getState();
    const activeCssFiles = state.settings?.preview?.activeCssFiles || [];
    const enableRootCss = state.settings?.preview?.enableRootCss ?? true;
    
    // Build list of CSS files to bundle
    const cssFilesToBundle = [];
    
    // Always include base markdown styling
    cssFilesToBundle.push('/client/preview/md.css');
    
    // Add root styles.css if enabled
    if (enableRootCss && !activeCssFiles.includes('styles.css')) {
        cssFilesToBundle.push('styles.css');
    }
    
    // Add all active CSS files
    activeCssFiles.forEach(cssPath => {
        if (!cssFilesToBundle.includes(cssPath)) {
            cssFilesToBundle.push(cssPath);
        }
    });
    
    logStaticGen(`Bundling ${cssFilesToBundle.length} CSS files: ${JSON.stringify(cssFilesToBundle)}`);
    
    // Fetch CSS files in parallel
    const cssPromises = cssFilesToBundle.map(async (cssPath) => {
        const content = await fetchCssContent(cssPath);
        return content ? `/* === BUNDLED CSS: ${cssPath} === */\n${content}\n` : `/* === FAILED TO LOAD: ${cssPath} === */\n`;
    });
    
    const cssContents = await Promise.all(cssPromises);
    const bundledCss = cssContents.filter(content => content.trim()).join('\n');
    
    logStaticGen(`CSS bundling complete. Total bundled size: ${bundledCss.length} chars`);
    return bundledCss;
}

/**
 * Generates static HTML for publishing with CSS handling based on settings
 * @param {Object} options - Configuration options
 * @param {string} options.markdownSource - The markdown content to convert
 * @param {string} options.originalFilePath - Original file path for context
 * @returns {Promise<string>} Complete HTML document
 */
export async function generateStaticHtmlForPublish({ markdownSource, originalFilePath }) {
    const logPrefix = 'generateStaticHtmlForPublish';
    logStaticGen(`${logPrefix} called for: ${originalFilePath}`);
    
    try {
        // Get settings from state
        const state = appStore.getState();
        const previewSettings = state.settings?.preview || {};
        // FORCE CSS bundling for publishing - external links don't work for standalone HTML
        const bundleCss = true; // Always bundle for publishing
        const cssPrefix = previewSettings.cssPrefix || '';
        
        logStaticGen(`CSS bundling FORCED to true for publishing (was: ${previewSettings.bundleCss !== false}), CSS prefix: "${cssPrefix}"`);
        
        // 1. Convert Markdown to HTML using the full preview renderer (with plugins)
        const { renderMarkdown } = await import('/client/preview/renderer.js');
        const renderResult = await renderMarkdown(markdownSource, originalFilePath);
        const htmlContent = renderResult.html || renderResult;
        
        if (!htmlContent) {
            throw new Error('Markdown rendering returned empty content');
        }
        logStaticGen(`Markdown rendered successfully (${htmlContent.length} chars)`);
        
        // 2. Handle CSS based on bundling setting
        let cssContent = '';
        let cssMode = 'LINKED (external)';
        
        if (bundleCss) {
            // Bundle CSS inline for published content
            cssContent = await bundleActiveCss();
            cssMode = 'BUNDLED (inline)';
            logStaticGen(`CSS bundled inline (${cssContent.length} chars)`);
                 } else {
             // Use external links with optional prefix
             const state = appStore.getState();
             const activeCssFiles = state.settings?.preview?.activeCssFiles || [];
             const enableRootCss = state.settings?.preview?.enableRootCss ?? true;
             
             const cssFilesToLink = [];
             cssFilesToLink.push('/client/preview/md.css');
             
             if (enableRootCss && !activeCssFiles.includes('styles.css')) {
                 cssFilesToLink.push('/styles.css');
             }
             
             activeCssFiles.forEach(cssPath => {
                 const linkPath = cssPath.startsWith('/') ? cssPath : `/${cssPath}`;
                 if (!cssFilesToLink.includes(linkPath)) {
                     cssFilesToLink.push(linkPath);
                 }
             });
             
             const cssLinks = cssFilesToLink.map(cssPath => {
                 const fullPath = cssPrefix ? `${cssPrefix}${cssPath}` : cssPath;
                 return `    <link rel="stylesheet" href="${fullPath}">`;
             }).join('\n');
             cssContent = cssLinks;
             logStaticGen(`CSS links generated for ${cssFilesToLink.length} files with prefix "${cssPrefix}"`);
         }
        
        // 3. Build complete HTML document
        const cssSection = bundleCss ? 
            `    <style>\n${cssContent}\n    </style>` : 
            cssContent;
            
        const completeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${originalFilePath ? originalFilePath.replace(/\.md$/, '') : 'Document'}</title>
    <meta name="generator" content="DevPages Static HTML Generator">
    <!-- CSS Generated by staticHtmlGenerator.js generateStaticHtmlForPublish() -->
    <!-- CSS Mode: ${cssMode} - FORCED BUNDLING for standalone HTML -->
    <!-- CSS Files: All active CSS files bundled inline -->
${cssSection}
</head>
<body>
    <div class="markdown-content">
${htmlContent}
    </div>
</body>
</html>`;

        logStaticGen(`Complete HTML generated (${completeHtml.length} chars total)`);
        return completeHtml;
        
    } catch (error) {
        logStaticGen(`${logPrefix} error: ${error.message}`, 'error');
        throw new Error(`Failed to generate static HTML: ${error.message}`);
    }
}

/**
 * Triggers static HTML generation via a server API endpoint and initiates download.
 * This is the legacy function for backward compatibility.
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
        const renderedHtml = previewElement.outerHTML;
        logStaticGen(`Captured preview div outerHTML (length: ${renderedHtml.length})`);
        console.log("STATIC_GEN_CLIENT: Captured HTML to be sent to server:", renderedHtml);
        if (!renderedHtml || renderedHtml.trim() === '') {
             logStaticGen('Preview container content is empty.', 'warn');
             // Optional: Alert user? Proceeding might result in empty file.
        }

        // --- Get File Info (using appStore) ---
        const state = appStore.getState();
        const currentPathname = state.file?.currentPathname || null;
        const isDirectory = state.file?.isDirectorySelected || false;
        let descriptiveNamePart = 'static-preview'; // Default

        if (currentPathname && !isDirectory) {
            // Example: currentPathname = "observability/screenshots/screenshot-001.md"
            let pathForName = currentPathname;
            // Remove .md extension if present
            if (pathForName.toLowerCase().endsWith('.md')) {
                pathForName = pathForName.substring(0, pathForName.length - 3);
            }
            // Replace slashes with hyphens
            descriptiveNamePart = pathForName.replace(/\//g, '-');
            // Sanitize further (optional, but good practice)
            descriptiveNamePart = descriptiveNamePart.replace(/[^a-z0-9_.-]/gi, '_').replace(/ /g, '-');
        } else {
             logStaticGen(`Selection is directory or unknown: Path='${currentPathname}', IsDir=${isDirectory}. Using default base filename.`, 'warning');
        }
        logStaticGen(`Using file info: Pathname='${currentPathname}', BaseFilename='${descriptiveNamePart}'`);


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
        // Get CSS settings from the correct state path
        const activeCssFiles = state.settings?.preview?.activeCssFiles || [];
        const rootCssEnabled = state.settings?.preview?.enableRootCss ?? true; // Default to true
        logStaticGen(`CSS settings state path: activeCssFiles=${JSON.stringify(activeCssFiles)}, rootCssEnabled=${rootCssEnabled}`);

        // Start with active files, ensuring no duplicates initially
        const cssFilesToSend = [...new Set(activeCssFiles)];
        const rootCssPath = 'styles.css'; // Define root path
        
        // Add root styles if enabled AND not already included
        if (rootCssEnabled && !cssFilesToSend.includes(rootCssPath)) {
            cssFilesToSend.unshift(rootCssPath); // Add root styles if enabled and not already present
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
                cssFiles: cssFilesToSend // Send the list of CSS files used (Corrected field name)
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

        // --- Updated Filename Generation (incorporating new descriptiveNamePart) ---
        const epochSeconds = Math.floor(Date.now() / 1000);
        const base36Timestamp = epochSeconds.toString(36);
        
        // Construct the final filename using the new descriptiveNamePart
        a.download = `${descriptiveNamePart}-${base36Timestamp}.html`;
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

