import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';
import { cssManager, CSS_CONTEXT, generateCssSection } from '/client/utils/CssManager.js';
import { markdownRenderingService } from '/client/preview/MarkdownRenderingService.js';

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
            response = await window.APP.services.globalFetch(cssPath);
        } else {
            // User CSS files: use /public/css endpoint (expects files in PD_DIR/data)
            response = await window.APP.services.globalFetch(`/public/css?path=${encodeURIComponent(cssPath)}`);
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
    
    // Add theme CSS files if enabled (replaces old styles.css)
    if (enableRootCss) {
        const themeFiles = ['themes/classic/core.css', 'themes/classic/light.css'];
        themeFiles.forEach(themeFile => {
            if (!activeCssFiles.includes(themeFile)) {
                cssFilesToBundle.push(themeFile);
            }
        });
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
 * Extracts all applicable CSS rules from document stylesheets as a single string.
 * This captures the live state of CSS, including themes and user overrides, 
 * as rendered by the browser.
 * @returns {string} A string containing all CSS rules.
 */
function getLiveCssFromBrowser() {
    logStaticGen('Extracting live CSS from browser stylesheets...');
    const allCss = [];
    // Iterate over all stylesheets in the document
    for (const sheet of document.styleSheets) {
        try {
            // Some stylesheets might be cross-origin and inaccessible
            if (sheet.disabled || !sheet.cssRules) continue;
            
            for (const rule of sheet.cssRules) {
                allCss.push(rule.cssText);
            }
        } catch (error) {
            logStaticGen(`Could not read CSS rules from stylesheet: ${sheet.href || 'inline sheet'}. Error: ${error.message}`, 'warn');
        }
    }
    const cssString = allCss.join('\n\n');
    logStaticGen(`Extracted ${cssString.length} chars of live CSS.`);
    return cssString;
}

/**
 * Generates static HTML for publishing with unified CSS management
 * @param {Object} options - Configuration options
 * @param {string} options.markdownSource - The markdown content to convert
 * @param {string} options.originalFilePath - Original file path for context
 * @param {string} options.publishMode - 'local' or 'spaces' (defaults to 'local')
 * @returns {Promise<string>} Complete HTML document
 */
export async function generateStaticHtmlForPublish({ 
    markdownSource, 
    originalFilePath, 
    publishMode = 'local' 
}) {
    const logPrefix = 'generateStaticHtmlForPublish';
    logStaticGen(`${logPrefix} called for: ${originalFilePath}, mode: ${publishMode}`);
    
    try {
        // 1. Convert Markdown to HTML using the unified preview renderer
        const state = appStore.getState();
        const enabledPlugins = Object.entries(state.plugins?.plugins || {})
            .filter(([_, plugin]) => plugin.enabled)
            .map(([id, plugin]) => ({ id, ...plugin }));

        const result = await markdownRenderingService.render(markdownSource, originalFilePath, {
            mode: 'publish',
            enabledPlugins
        });

        if (!result.html) {
            throw new Error('Markdown rendering returned empty content');
        }
        logStaticGen(`Markdown rendered successfully (${result.html.length} chars)`);
        
        // 2. Determine CSS context based on publish mode
        const cssContext = publishMode === 'spaces' ? CSS_CONTEXT.PUBLISH_SPACES : CSS_CONTEXT.PUBLISH_LOCAL;
        
        // 3. Generate CSS section using unified CSS manager
        const cssSection = await generateCssSection(cssContext);
        logStaticGen(`CSS section generated for context: ${cssContext}`);
        
        // 4. Build complete HTML document
        const completeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${originalFilePath ? originalFilePath.replace(/\.md$/, '') : 'Document'}</title>
    <meta name="generator" content="DevPages Static HTML Generator">
${cssSection}
</head>
<body>
    <div class="markdown-content">
${result.html}
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
 * Generates a static HTML file from the live preview and initiates a download.
 * This function captures the current rendered HTML and all active CSS from the browser,
 * ensuring the downloaded file is a "what you see is what you get" version of the preview.
 */
export async function downloadStaticHTML() {
    logStaticGen('Generating static HTML from live browser content...');

    try {
        // 1. Get Preview Content
        const previewElement = document.querySelector(".preview-container");
        if (!previewElement) {
            logStaticGen('Preview container element (.preview-container) not found.', 'error');
            alert('Error: Preview container element not found.');
            return;
        }
        // Use outerHTML to preserve the container div and its classes
        const renderedHtml = previewElement.outerHTML; 
        logStaticGen(`Captured preview content (length: ${renderedHtml.length})`);

        // 2. Get Live CSS from Browser
        const liveCss = getLiveCssFromBrowser();
        if (!liveCss) {
            logStaticGen('No CSS found in browser stylesheets.', 'warn');
        }

        // 3. Get File Info for Naming
        const state = appStore.getState();
        const currentPathname = state.file?.currentPathname || null;
        const isDirectory = state.file?.isDirectorySelected || false;
        let descriptiveNamePart = 'static-preview';

        if (currentPathname && !isDirectory) {
            let pathForName = currentPathname.toLowerCase().endsWith('.md')
                ? currentPathname.substring(0, currentPathname.length - 3)
                : currentPathname;
            descriptiveNamePart = pathForName.replace(/\//g, '-').replace(/[^a-z0-9_.-]/gi, '_');
        }
        logStaticGen(`Using base filename: '${descriptiveNamePart}'`);

        // 4. Construct the Full HTML Document Locally
        const completeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${descriptiveNamePart}</title>
    <meta name="generator" content="DevPages Static HTML Generator (Live)">
    <style>
/* --- BEGIN BUNDLED CSS --- */
${liveCss}
/* --- END BUNDLED CSS --- */
    </style>
</head>
<body>
${renderedHtml}
</body>
</html>`;
        logStaticGen(`Complete HTML generated locally (${completeHtml.length} chars)`);

        // 5. Trigger Download
        const blob = new Blob([completeHtml], { type: 'text/html;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.dataset.visible = 'false';
        a.href = url;
        
        const epochSeconds = Math.floor(Date.now() / 1000);
        const base36Timestamp = epochSeconds.toString(36);
        a.download = `${descriptiveNamePart}-${base36Timestamp}.html`;

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        logStaticGen(`Static HTML download initiated as ${a.download}.`);

    } catch (error) {
        logStaticGen(`Error during local static HTML generation: ${error.message}`, 'error');
        console.error("[STATIC HTML GEN CLIENT ERROR]", error);
        alert(`Failed to generate static HTML: ${error.message}`);
    }
}

