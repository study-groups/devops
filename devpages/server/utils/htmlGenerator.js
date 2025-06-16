import path from 'path';
import { promises as fs } from 'fs';
import http from 'http';
import https from 'https';
import { URL } from 'url';

// --- Logging Helper ---
function logGenerator(message, level = 'info') {
    const logFunc = level === 'error' ? console.error : (level === 'warn' ? console.warn : console.log);
    logFunc(`[HTML_GENERATOR] ${message}`);
}

// --- Define Base/Essential CSS Resources ---
// Moved from previewRoutes, adjust if needed
const basePreviewCssResources = [
    // 'client/output.css', // Exclude Tailwind by default for portability? Or include if always needed.
    'https://cdn.jsdelivr.net/npm/katex@latest/dist/katex.min.css', // KaTeX CDN URL
    // Add other essential CDN URLs or local paths ONLY IF NEEDED universally
];

// --- CSS Reading Function (Only for local files) ---
async function readLocalCssFile(relativePath, dataRootDir, projectRootDir) {
    logGenerator(`readLocalCssFile ENTRY: relativePath='${relativePath}', received dataRootDir='${dataRootDir}'`, 'debug');
    let absolutePath = 'N/A'; // Initialize for error logging

    try {
        const normalizedPath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');

        if (normalizedPath.startsWith('client/')) {
            absolutePath = path.resolve(projectRootDir, normalizedPath);
            logGenerator(`Resolved as project path: ${absolutePath}`, 'debug');
        } else if (normalizedPath.startsWith('node_modules/')) {
             absolutePath = path.resolve(projectRootDir, normalizedPath);
             logGenerator(`Resolved as node_modules path: ${absolutePath}`, 'debug');
        } else {
             // Assume relative to data root (dataRootDir should be PD_DIR)
             // User content (markdown, and potentially their CSS) is often in a 'data' subdirectory of PD_DIR.
             if (!dataRootDir) throw new Error('Data root directory (PD_DIR) is not configured or available.');
             
             // Construct the path to MD_DIR (e.g., /root/pj/pd/data)
             const mdDataDir = path.join(dataRootDir, 'data');
             absolutePath = path.resolve(mdDataDir, normalizedPath);
             logGenerator(`Resolved relative to MD_DIR (${mdDataDir}): ${absolutePath}`, 'debug');

             // Security check needs to ensure it's within mdDataDir now for these files
             if (!absolutePath.startsWith(path.resolve(mdDataDir))) {
                throw new Error(`CSS path escape attempt detected (relative to MD_DIR): ${relativePath} resolved to ${absolutePath}`);
             }
        }

        // Security check for client/ and node_modules/ paths still applies to projectRootDir
        if ((normalizedPath.startsWith('client/') || normalizedPath.startsWith('node_modules/')) && !absolutePath.startsWith(projectRootDir)) {
             throw new Error(`CSS path escape attempt detected (relative to project root): ${relativePath} resolved to ${absolutePath}`);
        }

        logGenerator(`Reading LOCAL CSS file: ${absolutePath}`);
        let content = await fs.readFile(absolutePath, 'utf-8');
        logGenerator(`Successfully read CSS file: ${absolutePath} (Length: ${content.length})`, 'debug');
        return { source: relativePath, content: content };
    } catch (error) {
        logGenerator(`Error reading LOCAL CSS file ${relativePath} (Resolved Path: ${absolutePath}): ${error.message}`, 'error');
        return { source: relativePath, content: `/* CSS File Read Error: ${relativePath} */`, error: true };
    }
}

// --- NEW: Image Processing Helper Functions ---

/**
 * Guesses MIME type from file extension.
 * @param {string} filePathOrUrl - The file path or URL.
 * @returns {string} The guessed MIME type.
 */
function getMimeType(filePathOrUrl) {
    const ext = path.extname(filePathOrUrl).toLowerCase();
    switch (ext) {
        case '.png': return 'image/png';
        case '.jpg': case '.jpeg': return 'image/jpeg';
        case '.gif': return 'image/gif';
        case '.svg': return 'image/svg+xml';
        case '.webp': return 'image/webp';
        default:
            logGenerator(`Unknown extension '${ext}' for MIME type, defaulting to application/octet-stream for ${filePathOrUrl}`, 'warn');
            return 'application/octet-stream';
    }
}

/**
 * Fetches an image using Node.js built-in http/https modules.
 * @param {string} imageUrl - The URL of the image to fetch.
 * @returns {Promise<{imageBuffer: Buffer, mimeType: string}>}
 */
async function fetchImageNodeHttp(imageUrl) {
    return new Promise((resolve, reject) => {
        let urlObj;
        try {
            urlObj = new URL(imageUrl);
        } catch (e) {
            return reject(new Error(`Invalid URL: ${imageUrl} - ${e.message}`));
        }

        const client = urlObj.protocol === 'https:' ? https : http;

        const request = client.get(urlObj, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                return reject(new Error(`Failed to fetch image, status code: ${response.statusCode} for ${imageUrl}`));
            }

            const dataChunks = [];
            response.on('data', (chunk) => {
                dataChunks.push(chunk);
            });

            response.on('end', () => {
                try {
                    const imageBuffer = Buffer.concat(dataChunks);
                    const mimeType = response.headers['content-type'] ? response.headers['content-type'].split(';')[0].trim() : getMimeType(imageUrl);
                    logGenerator(`Fetched ${imageUrl}, size: ${imageBuffer.length}, mime: ${mimeType}`, 'debug');
                    resolve({ imageBuffer, mimeType });
                } catch (e) {
                    reject(e);
                }
            });
        });

        request.on('error', (err) => {
            reject(new Error(`Request error fetching image ${imageUrl}: ${err.message}`));
        });
        request.setTimeout(10000, () => { // 10 second timeout
            request.destroy(new Error(`Timeout fetching image ${imageUrl} after 10s`));
        });
        request.end();
    });
}

/**
 * Processes img src attributes in HTML content to convert them to Data URLs.
 * @param {string} htmlContent - The HTML string.
 * @param {string} dataRootDir - Root directory for user data (e.g., PD_DIR/data or MD_DIR).
 * @param {string} projectRootDir - Project's root directory.
 * @param {string} uploadsDir - Root directory for uploads.
 * @param {string} [pdataFilesPrefix='/pdata-files'] - URL prefix for /pdata-files route.
 * @param {string} [imagesPrefix='/images'] - URL prefix for /images route.
 * @returns {Promise<string>} HTML string with image srcs processed.
 */
async function processImageSrcsToDataUrls(htmlContent, dataRootDir, projectRootDir, uploadsDir, pdataFilesPrefix = '/pdata-files', imagesPrefix = '/images') {
    logGenerator(`PROCESS_IMAGES_ENTRY: Called. htmlContent length: ${htmlContent ? htmlContent.length : 'null or undefined'}, uploadsDir: ${uploadsDir}`, 'info');
    if (htmlContent && htmlContent.length > 0) {
        logGenerator(`PROCESS_IMAGES_SNIPPET_FULL_CHECK: Does htmlContent contain '<img'? ${htmlContent.includes('<img')}`, 'info');
        logGenerator(`PROCESS_IMAGES_SNIPPET_START (first 500 chars): ${htmlContent.substring(0, Math.min(htmlContent.length, 500))}`, 'info');
    }

    if (!htmlContent) {
        logGenerator('PROCESS_IMAGES_EXIT: htmlContent is null or empty, returning early.', 'warn');
        return htmlContent;
    }
    logGenerator('Starting image source processing to Data URLs...', 'debug');

    const imgTagRegex = /<img([^>]*?)src=(['"])([^'"]+?)\2([^>]*?)>/gi;
    
    let currentHtmlContent = htmlContent;
    const promises = [];

    // Find all image tags and create promises to process their sources
    // Store original tag and the promise to get its replacement
    currentHtmlContent.replace(imgTagRegex, (fullImgTag, beforeSrc, quote, srcValue, afterSrc) => {
        if (srcValue.startsWith('data:')) {
            logGenerator(`Src for <img...> is already a Data URL, skipping: ${srcValue.substring(0, 50)}...`, 'debug');
            return; // Skips adding a promise for this match
        }

        const processingPromise = (async () => {
            let imageBuffer;
            let mimeType = getMimeType(srcValue); // Initial guess

            try {
                if (srcValue.startsWith('http://') || srcValue.startsWith('https://')) {
                    logGenerator(`Identified external image: ${srcValue}`, 'debug');
                    const fetchResult = await fetchImageNodeHttp(srcValue);
                    imageBuffer = fetchResult.imageBuffer;
                    mimeType = fetchResult.mimeType;
                } else if (srcValue.startsWith(pdataFilesPrefix + '/')) {
                    if (!dataRootDir) throw new Error('dataRootDir is not configured for pdata-files route.');
                    const relativePath = srcValue.substring((pdataFilesPrefix + '/').length);
                    const absolutePath = path.resolve(dataRootDir, relativePath);
                    if (!absolutePath.startsWith(path.resolve(dataRootDir))) {
                        throw new Error(`Path escape attempt for pdata-file: ${relativePath}`);
                    }
                    logGenerator(`Reading local pdata-file image: ${absolutePath}`, 'debug');
                    imageBuffer = await fs.readFile(absolutePath);
                } else if (srcValue.startsWith(imagesPrefix + '/')) {
                    const relativePath = srcValue.substring((imagesPrefix + '/').length);
                    let absolutePath;
                    let foundLocally = false;

                    // Option 1: image is relative to dataRootDir/images (e.g. user uploaded images in their data space)
                    if (dataRootDir) {
                        absolutePath = path.resolve(dataRootDir, 'images', relativePath);
                         if (absolutePath.startsWith(path.resolve(dataRootDir))) {
                            try {
                                imageBuffer = await fs.readFile(absolutePath);
                                foundLocally = true;
                                logGenerator(`Reading local image from dataRootDir/images: ${absolutePath}`, 'debug');
                            } catch (e) {
                                if (e.code !== 'ENOENT') throw e;
                                logGenerator(`Image not found in dataRootDir/images: ${absolutePath}`, 'debug');
                            }
                        } else { logGenerator(`Path escape attempt for images-route (dataRootDir): ${absolutePath}. Ignoring.`, 'warn');}
                    }
                    // Option 2: image is relative to projectRootDir/images (e.g. theme images)
                    if (!foundLocally && projectRootDir) {
                         absolutePath = path.resolve(projectRootDir, 'images', relativePath);
                         if (absolutePath.startsWith(path.resolve(projectRootDir))) {
                            try {
                                imageBuffer = await fs.readFile(absolutePath);
                                foundLocally = true;
                                logGenerator(`Reading local image from projectRootDir/images: ${absolutePath}`, 'debug');
                            } catch (e) {
                                if (e.code !== 'ENOENT') throw e;
                                // Only error if not found in primary (dataRootDir/images) and also not in fallback
                                if (!dataRootDir) { // If dataRootDir was not even checked
                                     logGenerator(`Image not found in projectRootDir/images: ${absolutePath}`, 'error');
                                     throw new Error(`Image ${srcValue} not found in project image path.`);
                                }
                            }
                        } else { logGenerator(`Path escape attempt for images-route (projectRootDir): ${absolutePath}. Ignoring.`, 'warn'); }
                    }
                     if (!foundLocally) {
                        throw new Error(`Image ${srcValue} could not be located in standard image paths.`);
                    }
                } else if (srcValue.startsWith('/uploads/')) { // NEW: Specific check for /uploads/
                    if (!uploadsDir) {
                         logGenerator(`'uploadsDir' is not configured, but path starts with /uploads/. Skipping: ${srcValue}`, 'warn');
                         return { originalTag: fullImgTag, newTag: fullImgTag }; // Skip if uploadsDir isn't provided
                    }
                    const relativePathFromUploadsDir = srcValue.substring('/uploads/'.length);
                    const absolutePath = path.resolve(uploadsDir, relativePathFromUploadsDir);
                    
                    if (!absolutePath.startsWith(path.resolve(uploadsDir))) { // Security check against uploadsDir
                        throw new Error(`Path escape attempt for /uploads/ image: ${srcValue}`);
                    }
                    logGenerator(`Reading local /uploads/ image: ${absolutePath} (from src: ${srcValue})`, 'debug');
                    imageBuffer = await fs.readFile(absolutePath);
                } else if (srcValue.startsWith('/')) { // Generic root-relative (fallback if not /uploads/)
                    if (!projectRootDir) throw new Error('projectRootDir is not configured for root-relative image paths.');
                    const relativePathFromProjectRoot = srcValue.substring(1);
                    const absolutePath = path.resolve(projectRootDir, relativePathFromProjectRoot);
                    if (!absolutePath.startsWith(path.resolve(projectRootDir))) {
                        throw new Error(`Path escape attempt for root-relative image: ${srcValue}`);
                    }
                    logGenerator(`Reading local generic root-relative image: ${absolutePath} (from src: ${srcValue})`, 'debug');
                    imageBuffer = await fs.readFile(absolutePath);
                } else {
                    logGenerator(`Skipping potentially relative image path (does not start with /, http, ${pdataFilesPrefix}, or ${imagesPrefix}): ${srcValue}. Full resolution requires original MD path context.`, 'warn');
                    return { originalTag: fullImgTag, newTag: fullImgTag };
                }

                if (imageBuffer) {
                    const base64Data = imageBuffer.toString('base64');
                    const dataUrl = `data:${mimeType};base64,${base64Data}`;
                    const newImgTag = `<img${beforeSrc}src=${quote}${dataUrl}${quote}${afterSrc}>`;
                    logGenerator(`Converted "${srcValue}" to Data URL (length: ${dataUrl.length})`, 'debug');
                    return { originalTag: fullImgTag, newTag: newImgTag };
                }
            } catch (error) {
                logGenerator(`Error processing image src "${srcValue}": ${error.message}. Original src will be kept.`, 'error');
            }
            return { originalTag: fullImgTag, newTag: fullImgTag }; // Return original if any error
        })();
        promises.push(processingPromise);
    });

    const settledPromises = await Promise.allSettled(promises);
    
    let finalHtml = currentHtmlContent;
    settledPromises.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
            const { originalTag, newTag } = result.value;
            if (originalTag && newTag && originalTag !== newTag) {
                // Replace only the first occurrence of the specific original tag matched,
                // to handle cases where multiple identical tags might exist but only one was processed
                // by this specific promise. This is safer than global replace.
                finalHtml = finalHtml.replace(originalTag, newTag);
            }
        } else if (result.status === 'rejected') {
            logGenerator(`A promise for image processing was rejected: ${result.reason}`, 'error');
        }
    });
    
    logGenerator('Finished image source processing.', 'debug');
    return finalHtml;
}

// --- END NEW: Image Processing Helper Functions ---

/**
 * Generates a static HTML string from PRE-RENDERED HTML content.
 * @param {object} options
 * @param {string} options.renderedHtml - The pre-rendered HTML content.
 * @param {string} [options.markdownSource] - Optional raw Markdown for metadata embedding.
 * @param {string[]} [options.requestedCssPaths=[]] - Array of CSS paths requested (relative or URLs).
 * @param {string} [options.originalFilePath=''] - Original path of the markdown file for metadata.
 * @param {string} options.dataRootDir - The root directory for user data (MD_DIR/data or similar).
 * @param {string} options.projectRootDir - The root directory of the project.
 * @param {string} options.uploadsDir - The root directory for uploads.
 * @returns {Promise<string>} The generated HTML content.
 */
export async function generateStaticHtml({
    renderedHtml,
    markdownSource,
    requestedCssPaths = [],
    originalFilePath = '',
    dataRootDir,
    projectRootDir,
    uploadsDir
}) {
    logGenerator(`Generating static HTML. UploadsDir received: ${uploadsDir}`, 'info');
    logGenerator('Generating static HTML from pre-rendered content...');

    if (renderedHtml === undefined || renderedHtml === null) throw new Error('renderedHtml is required.');
    if (!projectRootDir) throw new Error('projectRootDir is required.');
    // dataRootDir is now optional for CSS if all CSS is client/ or http, but required for images if not http

    // --- NEW: Process images in renderedHtml ---
    // Pass dataRootDir and projectRootDir for resolving local image paths
    const processedRenderedHtml = await processImageSrcsToDataUrls(renderedHtml, dataRootDir, projectRootDir, uploadsDir);
    // --- END NEW ---

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
    body { margin: 0; padding: 0; font-family: sans-serif; line-height: 1.5; } /* MODIFIED: margin set to 0 */
    *, ::before, ::after { box-sizing: border-box; } /* Basic reset */
    img, video { max-width: 100%; height: auto; }

    /* --- Embedded Preview Styles --- */
    ${combinedLocalCSS}
  </style>
</head>
<body>
  ${processedRenderedHtml}
  <!-- Metadata Comment (Hidden) -->
  <!--
  ${yamlFrontMatter.replace(/-->/g, '-- >')}
  -->
</body>
</html>`;

    logGenerator(`Final HTML content assembled (length: ${finalHtmlContent.length}).`, 'debug');
    return finalHtmlContent;
}
