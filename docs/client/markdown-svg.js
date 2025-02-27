// markdown-svg.js - SVG processing functionality
import { logMessage } from './log.js';

// Track SVG processing state
let svgProcessingInProgress = false;
let svgRefreshRequested = false;

// Array to store refresh functions
const refreshFunctions = [];

/**
 * Helper function to extract SVG content and handle indentation
 */
export function extractSvgContent(content) {
    // Find the SVG tag
    const svgStartIndex = content.indexOf('<svg');
    const svgEndIndex = content.lastIndexOf('</svg>') + 6; // 6 is the length of '</svg>'
    
    if (svgStartIndex >= 0 && svgEndIndex > svgStartIndex) {
        // Extract just the SVG content
        let svgContent = content.substring(svgStartIndex, svgEndIndex);
        
        // Handle indentation by removing common leading whitespace
        const lines = svgContent.split('\n');
        if (lines.length > 1) {
            // Find the minimum indentation (excluding the first line which has the <svg tag)
            let minIndent = Infinity;
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim().length === 0) continue; // Skip empty lines
                
                const indent = line.search(/\S/);
                if (indent >= 0 && indent < minIndent) {
                    minIndent = indent;
                }
            }
            
            // Remove the common indentation
            if (minIndent < Infinity && minIndent > 0) {
                for (let i = 1; i < lines.length; i++) {
                    if (lines[i].trim().length > 0) {
                        lines[i] = lines[i].substring(minIndent);
                    }
                }
                svgContent = lines.join('\n');
            }
        }
        
        return svgContent;
    }
    
    // If we couldn't extract the SVG, return the original content
    return content;
}

/**
 * Process markdown text to handle SVG content
 */
export function processSvgInMarkdown(mdText) {
    // Only process SVGs if the content actually contains SVG tags
    if (!mdText.includes('<svg') && !mdText.includes('.svg')) {
        return { processedText: mdText, hasSvg: false };
    }
    
    // Track all SVG content to ensure we don't miss any
    let allSvgBlocks = [];
    let allInlineSvgBlocks = [];
    let processedText = mdText;
    let svgBlockCount = 0;
    let inlineSvgCount = 0;
    
    // Match SVG code blocks with language identifier
    const svgCodeBlockRegex = /```(?:svg|xml)\s+([\s\S]*?<svg[\s\S]*?<\/svg>[\s\S]*?)```/g;
    // Match SVG code blocks without language identifier
    const plainSvgBlockRegex = /```\s*([\s\S]*?<svg[\s\S]*?<\/svg>[\s\S]*?)```/g;
    // Match inline SVG tags
    const inlineSvgRegex = /(?:^|[^`])<svg[\s\S]*?<\/svg>/g;
    
    // Process SVG code blocks with language identifier
    let match;
    while ((match = svgCodeBlockRegex.exec(mdText)) !== null) {
        const fullMatch = match[0];
        const svgContent = extractSvgContent(match[1]);
        allSvgBlocks.push(svgContent);
        
        // Replace with a placeholder that includes the SVG content as a data attribute
        const placeholder = `<div class="svg-container" data-svg-index="${svgBlockCount}" data-svg-content="${encodeURIComponent(svgContent)}"></div>`;
        processedText = processedText.replace(fullMatch, placeholder);
        svgBlockCount++;
    }
    
    // Process SVG code blocks without language identifier
    // Only match if the content actually contains an SVG tag
    while ((match = plainSvgBlockRegex.exec(mdText)) !== null) {
        const fullMatch = match[0];
        const content = match[1];
        
        // Only process if it actually contains an SVG tag
        if (content.includes('<svg') && content.includes('</svg>')) {
            const svgContent = extractSvgContent(content);
            allSvgBlocks.push(svgContent);
            
            // Replace with a placeholder that includes the SVG content as a data attribute
            const placeholder = `<div class="svg-container" data-svg-index="${svgBlockCount}" data-svg-content="${encodeURIComponent(svgContent)}"></div>`;
            processedText = processedText.replace(fullMatch, placeholder);
            svgBlockCount++;
        }
    }
    
    // Process inline SVG tags (not in code blocks)
    let inlineMatches = [];
    let inlineMatch;
    
    // We need to be careful not to match SVGs inside code blocks
    // So we'll split the text by code blocks and only process non-code parts
    const codeBlockSplits = processedText.split('```');
    for (let i = 0; i < codeBlockSplits.length; i++) {
        // Skip code block contents (odd indices)
        if (i % 2 === 1) continue;
        
        const textPart = codeBlockSplits[i];
        while ((inlineMatch = inlineSvgRegex.exec(textPart)) !== null) {
            const fullMatch = inlineMatch[0];
            // If the match starts with a backtick, it's inside an inline code block
            if (fullMatch.startsWith('`')) continue;
            
            const svgContent = extractSvgContent(fullMatch);
            allInlineSvgBlocks.push(svgContent);
            
            // Store the match info for later replacement
            inlineMatches.push({
                fullMatch,
                index: inlineMatch.index + textPart.indexOf(fullMatch, inlineMatch.index),
                svgContent,
                inlineSvgIndex: inlineSvgCount++
            });
        }
    }
    
    // Replace inline SVGs with placeholders
    // We need to do this from the end to avoid messing up indices
    for (let i = inlineMatches.length - 1; i >= 0; i--) {
        const { fullMatch, svgContent, inlineSvgIndex } = inlineMatches[i];
        const placeholder = `<span class="inline-svg-container" data-inline-svg-index="${inlineSvgIndex}" data-svg-content="${encodeURIComponent(svgContent)}"></span>`;
        processedText = processedText.replace(fullMatch, placeholder);
    }
    
    logMessage(`Found ${svgBlockCount} SVG code blocks and ${inlineSvgCount} inline SVGs`);
    
    return { 
        processedText, 
        hasSvg: svgBlockCount > 0 || inlineSvgCount > 0 
    };
}

/**
 * Process all SVG content in the document
 * @returns {Promise} A promise that resolves when all SVG processing is complete
 */
export function processSvgContent() {
    if (svgProcessingInProgress) {
        svgRefreshRequested = true;
        logMessage('SVG processing already in progress, queuing refresh');
        return Promise.resolve();
    }
    
    svgProcessingInProgress = true;
    svgRefreshRequested = false;
    
    logMessage('Starting SVG processing');
    
    // Process inline SVG elements first
    const inlineSvgContainers = document.querySelectorAll('.svg-container.inline-svg');
    logMessage(`Processing ${inlineSvgContainers.length} inline SVG elements`);
    
    const inlineSvgPromises = Array.from(inlineSvgContainers).map((container, index) => {
        return processInlineSvgContainer(container, index);
    });
    
    // Then process SVG containers that load from URLs
    const svgContainers = document.querySelectorAll('.svg-container:not(.inline-svg)');
    logMessage(`Loading content for ${svgContainers.length} SVG containers (excluding inline SVGs)`);
    
    const svgPromises = Array.from(svgContainers).map((container, index) => {
        return processSvgContainer(container, index);
    });
    
    // Wait for all processing to complete
    return Promise.all([...inlineSvgPromises, ...svgPromises])
        .then(() => {
            svgProcessingInProgress = false;
            logMessage('SVG processing completed');
            
            // If a refresh was requested during processing, run it now
            if (svgRefreshRequested) {
                logMessage('Running queued SVG refresh');
                return processSvgContent();
            }
            
            return Promise.resolve();
        })
        .catch(error => {
            svgProcessingInProgress = false;
            logMessage(`ERROR: SVG processing failed: ${error.message}`);
            console.error('SVG processing error:', error);
            return Promise.resolve();
        });
}

/**
 * Process inline SVG elements
 */
export function processInlineSvgElements() {
    return new Promise((resolve, reject) => {
        try {
            const inlineSvgContainers = document.querySelectorAll('.inline-svg, .inline-svg-container');
            
            logMessage(`Processing ${inlineSvgContainers.length} inline SVG elements`);
            
            if (inlineSvgContainers.length === 0) {
                return resolve();
            }
            
            // Process each container in sequence using promises to ensure reliable processing
            const processContainer = (index) => {
                if (index >= inlineSvgContainers.length) {
                    logMessage(`Finished processing all ${inlineSvgContainers.length} inline SVG elements`);
                    return Promise.resolve();
                }
                
                const container = inlineSvgContainers[index];
                return processInlineSvgContainer(container, index + 1)
                    .then(() => processContainer(index + 1))
                    .catch(error => {
                        logMessage(`ERROR: Failed to process inline SVG container #${index+1}: ${error.message}`);
                        return processContainer(index + 1);
                    });
            };
            
            // Start processing containers
            processContainer(0).then(resolve).catch(reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Process a single inline SVG container
 */
export function processInlineSvgContainer(container, index) {
    return new Promise((resolve, reject) => {
        try {
            // Check if the container already has SVG content
            if (container.querySelector('svg')) {
                logMessage(`Inline SVG container #${index} already has SVG content, skipping`);
                return resolve();
            }
            
            // Get the SVG content from the data attribute
            const encodedSvgContent = container.getAttribute('data-svg-content');
            
            if (encodedSvgContent) {
                logMessage(`Processing inline SVG #${index}, encoded content length: ${encodedSvgContent.length}`);
                
                // Decode the SVG content
                const svgContent = decodeURIComponent(encodedSvgContent);
                logMessage(`Decoded SVG content length: ${svgContent.length}`);
                
                // Set the SVG content directly - we've already extracted and cleaned it
                container.innerHTML = svgContent;
                
                // Make sure SVG is responsive
                const svgElement = container.querySelector('svg');
                if (svgElement) {
                    logMessage(`Found SVG element in container #${index}`);
                    if (!svgElement.hasAttribute('width')) {
                        svgElement.setAttribute('width', '100%');
                    }
                    if (!svgElement.hasAttribute('height')) {
                        // Use CSS for auto height instead of setting the attribute
                        svgElement.style.height = 'auto';
                    }
                    svgElement.style.maxWidth = '100%';
                } else {
                    logMessage(`ERROR: No SVG element found in container #${index} after setting innerHTML`);
                    // Try to display the content for debugging
                    const contentPreview = svgContent.length > 100 ? 
                        svgContent.substring(0, 100) + '...' : 
                        svgContent;
                    logMessage(`Content preview: ${contentPreview}`);
                    
                    // Try to render as HTML if it doesn't contain an SVG element
                    if (svgContent.includes('<') && svgContent.includes('>')) {
                        logMessage(`Attempting to render as HTML for container #${index}`);
                        // Keep the original content but wrap in a div for styling
                        container.innerHTML = `<div class="html-content">${svgContent}</div>`;
                    }
                }
                
                // Remove the data attribute to prevent reprocessing
                container.removeAttribute('data-svg-content');
            } else {
                logMessage(`ERROR: Container #${index} has no data-svg-content attribute`);
            }
            resolve();
        } catch (error) {
            logMessage(`ERROR: Inline SVG processing error for #${index}: ${error.message}`);
            console.error('Inline SVG processing error:', error);
            container.innerHTML = `<div class="error">Failed to process inline SVG: ${error.message}</div>`;
            resolve(); // Resolve even on error to continue processing other containers
        }
    });
}

/**
 * Load SVG content for all svg-container elements
 */
export function loadSvgContent() {
    return new Promise((resolve, reject) => {
        try {
            const svgContainers = document.querySelectorAll('.svg-container:not(.inline-svg)');
            
            logMessage(`Loading content for ${svgContainers.length} SVG containers (excluding inline SVGs)`);
            
            if (svgContainers.length === 0) {
                return resolve();
            }
            
            // Process each container in sequence using promises to ensure reliable loading
            const processContainer = (index) => {
                if (index >= svgContainers.length) {
                    logMessage(`Finished loading all ${svgContainers.length} SVG containers`);
                    return Promise.resolve();
                }
                
                const container = svgContainers[index];
                return processSvgContainer(container, index + 1)
                    .then(() => processContainer(index + 1))
                    .catch(error => {
                        logMessage(`ERROR: Failed to process SVG container #${index+1}: ${error.message}`);
                        return processContainer(index + 1);
                    });
            };
            
            // Start processing containers
            processContainer(0).then(resolve).catch(reject);
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Process a single SVG container
 */
export function processSvgContainer(container, index) {
    return new Promise((resolve, reject) => {
        const svgUrl = container.getAttribute('data-src');
        // Log the container's style to debug
        const containerStyle = container.getAttribute('style') || '';
        logMessage(`Container #${index} style: ${containerStyle}`);
        
        // Store data attributes for width and height
        const dataWidth = container.getAttribute('data-width');
        const dataHeight = container.getAttribute('data-height');
        
        if (dataWidth) {
            logMessage(`Container #${index} has data-width: ${dataWidth}`);
        }
        if (dataHeight) {
            logMessage(`Container #${index} has data-height: ${dataHeight}`);
        }
        
        if (!svgUrl) {
            logMessage(`Container #${index} missing SVG URL, checking if it already has SVG content`);
            
            // Check if the container already has SVG content
            if (container.querySelector('svg')) {
                logMessage(`Container #${index} already has SVG content, skipping`);
                return resolve();
            }
            
            // Check if it has data-svg-content attribute instead
            const encodedSvgContent = container.getAttribute('data-svg-content');
            if (encodedSvgContent) {
                logMessage(`Container #${index} has data-svg-content attribute, processing as inline SVG`);
                try {
                    const svgContent = decodeURIComponent(encodedSvgContent);
                    container.innerHTML = svgContent;
                    
                    // Make SVG responsive
                    const svgElement = container.querySelector('svg');
                    if (svgElement) {
                        // Apply container dimensions to SVG
                        applyContainerDimensionsToSvg(container, svgElement);
                    }
                    
                    // Remove the data attribute
                    container.removeAttribute('data-svg-content');
                    return resolve();
                } catch (error) {
                    logMessage(`ERROR: Failed to process data-svg-content: ${error.message}`);
                }
            }
            
            container.innerHTML = `<div class="error">Missing SVG URL</div>`;
            return resolve();
        }
        
        logMessage(`Loading SVG #${index} from URL: ${svgUrl}`);
        
        // Add a loading indicator
        container.innerHTML = `<div class="loading">Loading SVG...</div>`;
        
        // Normalize the URL - ensure it starts with a slash if it's a relative path
        let normalizedUrl = svgUrl;
        if (!normalizedUrl.startsWith('http') && !normalizedUrl.startsWith('/')) {
            normalizedUrl = '/' + normalizedUrl;
            logMessage(`Normalized SVG URL to: ${normalizedUrl}`);
        }
        
        // Try to load the SVG with multiple path resolution strategies
        const tryLoadSvg = (url, attempt = 1) => {
            logMessage(`SVG #${index} attempt ${attempt} with URL: ${url}`);
            
            fetch(url)
                .then(response => {
                    logMessage(`SVG #${index} fetch response: ${response.status} ${response.statusText}`);
                    if (!response.ok) {
                        throw new Error(`Failed to load SVG: ${response.status}`);
                    }
                    return response.text();
                })
                .then(svgContent => {
                    // Basic validation to ensure it's actually SVG content
                    logMessage(`SVG #${index} content received, length: ${svgContent.length} bytes`);
                    
                    if (!svgContent.includes('<svg') || !svgContent.includes('</svg>')) {
                        logMessage(`ERROR: Invalid SVG content for #${index} - missing svg tags`);
                        throw new Error('Invalid SVG content');
                    }
                    
                    // Sanitize SVG content if needed
                    container.innerHTML = svgContent;
                    
                    // Restore data attributes that might have been lost when setting innerHTML
                    if (dataWidth) {
                        container.setAttribute('data-width', dataWidth);
                    }
                    if (dataHeight) {
                        container.setAttribute('data-height', dataHeight);
                    }
                    
                    // Make sure SVG is responsive
                    const svgElement = container.querySelector('svg');
                    if (svgElement) {
                        logMessage(`Found SVG element in container #${index}`);
                        
                        // Apply container dimensions to SVG
                        applyContainerDimensionsToSvg(container, svgElement);
                    } else {
                        logMessage(`ERROR: No SVG element found in container #${index} after setting innerHTML`);
                        // Try to display the content for debugging
                        const contentPreview = svgContent.length > 100 ? 
                            svgContent.substring(0, 100) + '...' : 
                            svgContent;
                        logMessage(`Content preview: ${contentPreview}`);
                    }
                    resolve();
                })
                .catch(error => {
                    logMessage(`ERROR: SVG #${index} load error with URL ${url}: ${error.message}`);
                    
                    // Try alternative paths if this is the first attempt
                    if (attempt === 1) {
                        // Try with /client/ prefix
                        if (!url.startsWith('/client/') && !url.includes('/uploads/')) {
                            tryLoadSvg('/client/' + url.replace(/^\//, ''), 2);
                            return;
                        }
                    } else if (attempt === 2) {
                        // Try with /uploads/ prefix
                        if (!url.startsWith('/uploads/')) {
                            tryLoadSvg('/uploads/' + url.replace(/^\//, ''), 3);
                            return;
                        }
                    } else {
                        // All attempts failed, show error and fallback
                        console.error(`SVG load error for ${svgUrl} after all attempts:`, error);
                        container.innerHTML = `<div class="error">Failed to load SVG: ${svgUrl}<br>${error.message}</div>`;
                        
                        // Try to display the SVG as an image as fallback
                        if (svgUrl) {
                            logMessage(`Attempting fallback to img tag for SVG #${index}`);
                            container.innerHTML += `<img src="${svgUrl}" alt="SVG fallback" style="max-width:100%; height:auto;" />`;
                        }
                        resolve(); // Resolve even on error to continue processing other containers
                    }
                });
        };
        
        // Start with the normalized URL
        tryLoadSvg(normalizedUrl);
    });
}

/**
 * Helper function to apply container dimensions to SVG element
 */
function applyContainerDimensionsToSvg(container, svgElement) {
    // Get container style
    const containerStyle = container.getAttribute('style') || '';
    logMessage(`Container style: ${containerStyle}`);
    
    // Check for data-width and data-height attributes first (these come from markdown parameters)
    const dataWidth = container.getAttribute('data-width');
    const dataHeight = container.getAttribute('data-height');
    
    if (dataWidth) {
        logMessage(`Found data-width attribute: ${dataWidth}`);
    }
    if (dataHeight) {
        logMessage(`Found data-height attribute: ${dataHeight}`);
    }
    
    // Extract width and height from container style
    const widthMatch = containerStyle.match(/width:\s*([^;]+)/i);
    const heightMatch = containerStyle.match(/height:\s*([^;]+)/i);
    
    // Log the extracted dimensions
    if (widthMatch) {
        logMessage(`Extracted width from container style: ${widthMatch[1].trim()}`);
    }
    if (heightMatch) {
        logMessage(`Extracted height from container style: ${heightMatch[1].trim()}`);
    }
    
    // Apply width if specified (prioritize data-width over style width)
    const width = dataWidth || (widthMatch && widthMatch[1].trim());
    if (width) {
        logMessage(`Applying width ${width} to SVG`);
        
        // Set both the attribute and style for better compatibility
        svgElement.setAttribute('width', width);
        svgElement.style.width = width;
        
        // Also set the container width to ensure it respects the specified width
        container.style.width = width;
    } else {
        // Default responsive behavior
        svgElement.setAttribute('width', '100%');
    }
    
    // Apply height if specified (prioritize data-height over style height)
    const height = dataHeight || (heightMatch && heightMatch[1].trim());
    if (height) {
        logMessage(`Applying height ${height} to SVG`);
        
        // Only set the height attribute if it's a valid length (not 'auto')
        if (height !== 'auto') {
            svgElement.setAttribute('height', height);
        }
        
        // Always set the style height (CSS can handle 'auto')
        svgElement.style.height = height;
        
        // Also set the container height to ensure it respects the specified height
        container.style.height = height;
    } else if (width) {
        // If only width is specified, use CSS for auto height but don't set the attribute
        svgElement.style.height = 'auto';
        // Remove height attribute if it exists to prevent errors
        if (svgElement.hasAttribute('height')) {
            svgElement.removeAttribute('height');
        }
    } else {
        // Default responsive behavior - use CSS only for auto
        svgElement.style.height = 'auto';
        // Remove height attribute if it exists to prevent errors
        if (svgElement.hasAttribute('height')) {
            svgElement.removeAttribute('height');
        }
    }
    
    // Ensure SVG is responsive within its container
    svgElement.style.maxWidth = '100%';
    svgElement.style.display = 'block';
    
    // Log the final SVG dimensions
    logMessage(`Final SVG dimensions - width: ${svgElement.style.width}, height: ${svgElement.style.height}`);
}

/**
 * Check if this is SVG content, either by language tag or by content detection
 */
export function isSvgContent(code, language) {
    const isSvgByLanguage = language === 'svg';
    
    // Only check content if it's not already identified by language
    let isSvgByContent = false;
    if (!isSvgByLanguage && code.includes('<svg') && code.includes('</svg>')) {
        // Check if the SVG tag starts at the beginning of a line
        const lines = code.split('\n');
        for (const line of lines) {
            if (line.trim().startsWith('<svg')) {
                isSvgByContent = true;
                break;
            }
        }
    }
    
    return isSvgByLanguage || isSvgByContent;
}

/**
 * Initialize the SVG refresh button
 */
export function initSvgRefreshButton() {
    const refreshBtn = document.getElementById('svg-refresh-btn');
    if (!refreshBtn) {
        logMessage('[SVG] Refresh button not found');
        return;
    }

    // Register only the SVG processing function
    registerRefreshFunction(processSvgContent);
    
    refreshBtn.addEventListener('click', () => {
        executeRefresh();
    });
    
    logMessage('[REFRESH] Refresh system initialized with SVG processing');
}

/**
 * Register a function to be executed during refresh
 * @param {Function} func - The function to register
 */
export function registerRefreshFunction(func) {
    if (typeof func === 'function' && !refreshFunctions.includes(func)) {
        refreshFunctions.push(func);
        logMessage(`[REFRESH] Registered new refresh function: ${func.name || 'anonymous'}`);
    }
}

/**
 * Execute all registered refresh functions
 */
export function executeRefresh() {
    const refreshBtn = document.getElementById('svg-refresh-btn');
    if (refreshBtn) {
        refreshBtn.classList.add('refreshing');
        refreshBtn.disabled = true;
    }
    
    logMessage('[REFRESH] Starting refresh process...');
    
    // Execute all registered refresh functions
    const promises = refreshFunctions.map(func => {
        try {
            const result = func();
            return result instanceof Promise ? result : Promise.resolve(result);
        } catch (error) {
            logMessage(`[REFRESH ERROR] ${error.message}`);
            return Promise.resolve();
        }
    });
    
    // Also refresh the markdown preview
    try {
        const editor = document.querySelector('#md-editor textarea');
        if (editor) {
            const content = editor.value;
            import('./markdown.js').then(({ updatePreview }) => {
                updatePreview(content);
                logMessage('[REFRESH] Markdown preview refreshed');
            });
        }
    } catch (error) {
        logMessage(`[REFRESH ERROR] Failed to refresh markdown preview: ${error.message}`);
    }
    
    // When all functions have completed
    Promise.all(promises).then(() => {
        if (refreshBtn) {
            refreshBtn.classList.remove('refreshing');
            refreshBtn.disabled = false;
        }
        logMessage('[REFRESH] Refresh process completed');
    });
}

/**
 * Reload the CSS file with a cache-busting parameter
 */
export function reloadCSS() {
    // Function intentionally left empty to avoid jarring CSS refresh
    return Promise.resolve();
}

/**
 * Create a custom renderer for SVG content
 */
export function createSvgRenderer(baseRenderer) {
    const renderer = baseRenderer || new marked.Renderer();
    
    // Override image rendering to handle SVG files
    renderer.image = function(href, title, text) {
        // Log the raw href for debugging
        logMessage(`Raw image href: ${typeof href === 'object' ? JSON.stringify(href) : href}`);
        
        // Handle cases where href is an object
        if (typeof href === 'object') {
            logMessage(`Image href is an object: ${JSON.stringify(href)}`);
            
            // Try to extract href from the object
            if (href && href.href && typeof href.href === 'string') {
                href = href.href;
                logMessage(`Extracted href from object: ${href}`);
            } else if (href && href.src && typeof href.src === 'string') {
                href = href.src;
                logMessage(`Extracted src from object: ${href}`);
            } else if (href && href.url && typeof href.url === 'string') {
                href = href.url;
                logMessage(`Extracted url from object: ${href}`);
            } else {
                // If we can't extract a valid href, use a default empty string
                logMessage(`Could not extract valid href from object`);
                href = '';
            }
        } else if (typeof href !== 'string') {
            logMessage(`WARNING: Image href is not a string or object: ${typeof href}`);
            href = href ? String(href) : '';
        }
        
        // Now href should be a string, check if it's an SVG
        if (href && href.toLowerCase().endsWith('.svg')) {
            // For SVG files, fetch and embed the raw SVG content
            logMessage(`Detected SVG image: ${href}`);
            
            // Parse size parameters from the title or alt text if provided
            // Format: width=300px height=200px or w=300 h=200
            let width = null;
            let height = null;
            let style = 'max-width:100%;';
            
            // Check text (alt) for size parameters first
            if (text) {
                logMessage(`Checking alt text for size parameters: "${text}"`);
                const widthMatch = text.match(/(?:^|\s)(width|w)=(\d+)(px|%|em|rem)?/i);
                const heightMatch = text.match(/(?:^|\s)(height|h)=(\d+)(px|%|em|rem)?/i);
                
                if (widthMatch) {
                    width = widthMatch[2] + (widthMatch[3] || 'px');
                    logMessage(`Found width parameter in alt text: ${width}`);
                }
                
                if (heightMatch) {
                    height = heightMatch[2] + (heightMatch[3] || 'px');
                    logMessage(`Found height parameter in alt text: ${height}`);
                }
            }
            
            // Then check title, which overrides alt text if both are present
            if (title) {
                logMessage(`Checking title for size parameters: "${title}"`);
                const widthMatch = title.match(/(?:^|\s)(width|w)=(\d+)(px|%|em|rem)?/i);
                const heightMatch = title.match(/(?:^|\s)(height|h)=(\d+)(px|%|em|rem)?/i);
                
                if (widthMatch) {
                    width = widthMatch[2] + (widthMatch[3] || 'px');
                    logMessage(`Found width parameter in title: ${width}`);
                }
                
                if (heightMatch) {
                    height = heightMatch[2] + (heightMatch[3] || 'px');
                    logMessage(`Found height parameter in title: ${height}`);
                }
            }
            
            // Build the style string based on width and height
            if (width) {
                style += `width:${width}; `;
                logMessage(`Adding width to style: ${width}`);
            }
            
            if (height) {
                style += `height:${height}; `;
                logMessage(`Adding height to style: ${height}`);
            }
            
            // Create a container for the SVG with the specified dimensions
            logMessage(`Creating SVG container with style: ${style}`);
            // Store width and height as data attributes to ensure they're preserved during processing
            return `<div class="svg-container" data-src="${href}" data-width="${width || ''}" data-height="${height || ''}" style="${style}"></div>`;
        }
        
        // For non-SVG images, use the default renderer
        return `<img src="${href}" alt="${text || ''}" title="${title || ''}" />`;
    };
    
    // Override code block rendering to handle SVG code
    renderer.code = function(code, language) {
        logMessage(`Rendering code block with language: ${language}, type: ${typeof code}`);
        
        // Ensure code is a string
        if (typeof code !== 'string') {
            logMessage(`ERROR: Code is not a string: ${typeof code}`);
            // Try to convert to string if possible
            try {
                if (code === null || code === undefined) {
                    code = '';
                    logMessage('Code was null or undefined, using empty string');
                } else if (typeof code === 'object') {
                    // If it's an object with a value property (which marked sometimes does)
                    if (code.value && typeof code.value === 'string') {
                        code = code.value;
                        logMessage(`Extracted string from code object, length: ${code.length}`);
                    } else {
                        code = JSON.stringify(code, null, 2);
                        logMessage(`Converted object to JSON string, length: ${code.length}`);
                    }
                } else if (typeof code.toString === 'function') {
                    code = code.toString();
                    logMessage(`Converted code to string, length: ${code.length}`);
                } else {
                    // If we can't convert, just return a default code block
                    return `<pre><code class="language-${language || ''}">Unable to process code block</code></pre>`;
                }
            } catch (error) {
                logMessage(`ERROR: Failed to convert code to string: ${error.message}`);
                return `<pre><code class="language-${language || ''}">Unable to process code block</code></pre>`;
            }
        }
        
        // Check if this is SVG content, either by language tag or by content detection
        const isSvgByLanguage = language === 'svg';
        
        // Only check content if it's not already identified by language
        let isSvgByContent = false;
        if (!isSvgByLanguage && code.includes('<svg') && code.includes('</svg>')) {
            // Check if the SVG tag starts at the beginning of a line
            const lines = code.split('\n');
            for (const line of lines) {
                if (line.trim().startsWith('<svg')) {
                    isSvgByContent = true;
                    break;
                }
            }
        }
        
        if (isSvgByLanguage || isSvgByContent) {
            // For SVG code blocks, render the SVG directly
            try {
                // Basic validation
                logMessage(`Processing SVG code block, length: ${code.length} bytes, detected by: ${isSvgByLanguage ? 'language tag' : 'content'}`);
                
                if (!code.includes('<svg') || !code.includes('</svg>')) {
                    logMessage(`ERROR: Invalid SVG content - missing svg tags`);
                    return `<div class="svg-container inline-svg"><div class="error">Invalid SVG content</div></div>`;
                }
                
                // Create a container with the raw SVG content
                // We'll use a data attribute to store the SVG code and process it after rendering
                logMessage(`SVG content valid, creating container with encoded content`);
                return `<div class="svg-container inline-svg" data-svg-content="${encodeURIComponent(code)}"></div>`;
            } catch (error) {
                logMessage(`ERROR: SVG parsing error: ${error.message}`);
                console.error('SVG parsing error:', error);
                return `<div class="svg-container inline-svg"><div class="error">Failed to parse SVG: ${error.message}</div></div>`;
            }
        }
        
        // Default code block rendering
        return `<pre><code class="language-${language || ''}">${code}</code></pre>`;
    };
    
    return renderer;
}