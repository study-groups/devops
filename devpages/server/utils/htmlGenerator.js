import path from 'path';
import { promises as fs } from 'fs';

// --- Logging Helper ---
function logGenerator(message, level = 'info') {
    const logFunc = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
    logFunc(`[HTML_GENERATOR] ${message}`);
}

// --- Define Base/Essential CSS Resources ---
// Moved from previewRoutes, adjust if needed
const basePreviewCssResources = [
    // 'client/output.css', // Exclude Tailwind by default for portability? Or include if always needed.
    'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css', // KaTeX CDN URL
    // Add other essential CDN URLs or local paths ONLY IF NEEDED universally
];

// --- CSS Reading Function (Only for local files) ---
async function readLocalCssFile(relativePath, dataRootDir, projectRootDir) {
    logGenerator(`readLocalCssFile called with: relativePath='${relativePath}', dataRootDir='${dataRootDir}', projectRootDir='${projectRootDir}'`, 'debug');

    try {
        let absolutePath;
        const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');

        if (normalizedPath === 'styles.css') {
             logGenerator(`Attempting to resolve 'styles.css'...`);
        }

        if (normalizedPath.startsWith('client/')) {
            absolutePath = path.resolve(projectRootDir, normalizedPath);
            logGenerator(`Resolved as project path: ${absolutePath}`, 'debug');
        } else if (normalizedPath.startsWith('node_modules/')) {
             absolutePath = path.resolve(projectRootDir, normalizedPath);
             logGenerator(`Resolved as node_modules path: ${absolutePath}`, 'debug');
        } else {
             if (!dataRootDir) throw new Error('Data root directory (MD_DIR) is not configured.');
             absolutePath = path.resolve(dataRootDir, normalizedPath);
             logGenerator(`Resolved relative to data root: ${absolutePath}`, 'debug');
        }

        // Basic security check
        if (!absolutePath.startsWith(projectRootDir) && (!dataRootDir || !absolutePath.startsWith(dataRootDir))) {
             throw new Error(`CSS path escape attempt detected: ${relativePath}`);
        }

        logGenerator(`Reading LOCAL CSS file: ${absolutePath}`);
        let content = await fs.readFile(absolutePath, 'utf-8');
        logGenerator(`Successfully read CSS file: ${absolutePath} (Length: ${content.length})`, 'debug');
        return { source: relativePath, content: content };
    } catch (error) {
        logGenerator(`Error reading LOCAL CSS file ${relativePath} (Resolved Path: ${absolutePath || 'N/A'}): ${error.message}`, 'error');
        return { source: relativePath, content: `/* CSS File Read Error: ${relativePath} */`, error: true };
    }
}

/**
 * Generates a static HTML string from PRE-RENDERED HTML content.
 * @param {object} options
 * @param {string} options.renderedHtml - The pre-rendered HTML content.
 * @param {string} [options.markdownSource] - Optional raw Markdown for metadata embedding.
 * @param {string[]} [options.requestedCssPaths=[]] - Array of CSS paths requested (relative or URLs).
 * @param {string} [options.originalFilePath=''] - Original path of the markdown file for metadata.
 * @param {string} options.dataRootDir - The root directory for user data (MD_DIR).
 * @param {string} options.projectRootDir - The root directory of the project.
 * @returns {Promise<string>} The generated HTML content.
 */
export async function generateStaticHtml({
    renderedHtml,
    markdownSource,
    requestedCssPaths = [],
    originalFilePath = '',
    dataRootDir,
    projectRootDir
}) {
    logGenerator('Generating static HTML from pre-rendered content...');

    if (renderedHtml === undefined || renderedHtml === null) throw new Error('renderedHtml is required.');
    if (!dataRootDir) throw new Error('dataRootDir is required.');
    if (!projectRootDir) throw new Error('projectRootDir is required.');

    // --- Combine Base CSS with Requested CSS ---
    const combinedCssResources = new Set([...basePreviewCssResources, ...requestedCssPaths]);
    const resourcesToInclude = Array.from(combinedCssResources);

    // --- Separate URLs and Local Paths ---
    const cssUrlsToLink = [];
    const localCssPathsToRead = [];
    resourcesToInclude.forEach(resource => {
        if (resource.startsWith('http://') || resource.startsWith('https://')) {
            cssUrlsToLink.push(resource);
        } else if (resource) { // Ensure not empty string
            localCssPathsToRead.push(resource);
        }
    });

    // --- Read ONLY Local CSS Files Concurrently ---
    logGenerator(`Reading ${localCssPathsToRead.length} local CSS files...`, 'debug');
    const cssReadPromises = localCssPathsToRead.map(relativePath =>
        readLocalCssFile(relativePath, dataRootDir, projectRootDir)
    );
    const cssResults = await Promise.all(cssReadPromises);

    // --- Combine Local CSS ---
    let combinedLocalCSS = '';
    cssResults.forEach(result => {
         combinedLocalCSS += `\n/* Styles from ${result.source} ${result.error ? '(READ ERROR)' : ''} */\n${result.content}\n`;
    });
    logGenerator(`Combined local CSS length: ${combinedLocalCSS.length}.`, 'debug');

    // --- Construct Link Tags for URLs ---
    const linkTags = cssUrlsToLink.map(url =>
        `<link rel="stylesheet" href="${url.replace(/"/g, '&quot;')}">`
    ).join('\n  ');

    // --- Construct Metadata ---
    let baseFilename = 'static-preview';
    let directory = '.';
    if (originalFilePath) {
        const safeFilePath = String(originalFilePath);
        baseFilename = path.basename(safeFilePath);
         directory = path.dirname(safeFilePath) === '.' && !safeFilePath.includes(path.sep) ? '.' : path.dirname(safeFilePath);
    }
    const generationTime = new Date().toISOString();

    const yamlFrontMatter = `---
file: ${baseFilename}
directory: ${directory}
generated_at: ${generationTime}
source_markdown_embedded: ${!!markdownSource}
embedded_local_css_files: ${JSON.stringify(localCssPathsToRead)}
linked_external_css_files: ${JSON.stringify(cssUrlsToLink)}
---`;
    // Optional: Embed metadata/source if needed, otherwise omit for published version
    // const metadataContainer = `\n<div id="devpages-metadata-source" style="display:none;">...</div>`;

    // --- Construct Final HTML ---
    const finalHtmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${baseFilename}</title>
  <!-- Linked CSS Files -->
  ${linkTags}
  <!-- Embedded Local CSS Files -->
  <style id="embedded-styles">
    /* Basic page styles */
    body { margin: 1em; padding: 0; font-family: sans-serif; line-height: 1.5; } /* Add some margin */
    *, ::before, ::after { box-sizing: border-box; } /* Basic reset */
    img, video { max-width: 100%; height: auto; }

    /* --- Embedded Preview Styles --- */
    ${combinedLocalCSS}
  </style>
</head>
<body>
  ${renderedHtml}
  <!-- Metadata Comment (Hidden) -->
  <!--
  ${yamlFrontMatter.replace(/-->/g, '-- >')}
  -->
</body>
</html>`;

    logGenerator(`Final HTML content assembled (length: ${finalHtmlContent.length}).`, 'debug');
    return finalHtmlContent;
}
