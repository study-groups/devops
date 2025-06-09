import { triggerActions } from '/client/actions.js';
// import { renderMarkdown, postProcessRender } from '/client/preview/renderer.js'; // Already in LogPanel.js

// Placeholder for logError, logDebug from LogCore.js if needed directly here
// import { logError, logDebug } from './LogCore.js';

/**
 * Updates the display content of a log entry based on the requested mode (raw, markdown, html).
 * This would be the new home for much of LogPanel.js's _updateLogEntryDisplay.
 * @param {HTMLElement} logEntryDiv The .log-entry element.
 * @param {string} requestedMode 'raw', 'markdown', or 'html'.
 * @param {object} renderContext - Contextual data like RENDER_MODE_RAW, RENDER_MODE_MARKDOWN constants,
 *                                 and potentially references to renderMarkdown, postProcessRender.
 * @param {boolean} [forceRawState=false] If true, forces the state to raw.
 */
export async function updateLogEntryDisplayContent(logEntryDiv, requestedMode, renderContext, forceRawState = false) {
    if (!logEntryDiv) return;

    const textWrapper = logEntryDiv.querySelector('.log-entry-text-wrapper');
    const markdownToggleButton = logEntryDiv.querySelector('.markdown-toggle-button'); // Assumes these buttons exist if this is called
    const htmlToggleButton = logEntryDiv.querySelector('.html-toggle-button');

    if (!textWrapper) {
        console.warn('[logPanelEntryDisplay] _updateLogEntryDisplay: Could not find textWrapper for entry.');
        return;
    }

    const coreMessage = logEntryDiv.dataset.logCoreMessage || '';
    const rawOriginalMessage = logEntryDiv.dataset.rawOriginalMessage || coreMessage; // Fallback for truly raw
    const logIndex = logEntryDiv.dataset.logIndex || 'unknown';

    const finalMode = forceRawState ? renderContext.RENDER_MODE_RAW : requestedMode;
    logEntryDiv.dataset.renderMode = finalMode;

    if (markdownToggleButton) markdownToggleButton.classList.toggle('active', finalMode === renderContext.RENDER_MODE_MARKDOWN);
    if (htmlToggleButton) htmlToggleButton.classList.toggle('active', finalMode === renderContext.RENDER_MODE_HTML);

    textWrapper.innerHTML = ''; // Clear previous content
    textWrapper.classList.remove('markdown-rendered', 'html-rendered', 'raw-rendered'); // Clear all mode classes

    try {
        if (finalMode === renderContext.RENDER_MODE_MARKDOWN) {
            textWrapper.classList.add('markdown-rendered');
            const mdResult = await renderContext.renderMarkdown(coreMessage);
            textWrapper.innerHTML = mdResult.html;
            await renderContext.postProcessRender(textWrapper); // Standard post-processing (e.g., syntax highlighting)
            enhanceMarkdownContent(textWrapper, logIndex);     // <<< OUR NEW FUNCTION CALL
        } else if (finalMode === renderContext.RENDER_MODE_HTML) {
            textWrapper.classList.add('html-rendered');
            const iframe = document.createElement('iframe');
            iframe.className = 'log-entry-html-iframe';
            iframe.style.cssText = 'width:100%; height:300px; border:1px solid #ccc; background-color:#fff;';
            iframe.srcdoc = coreMessage;
            textWrapper.appendChild(iframe);
        } else { // Default to Raw
            textWrapper.classList.add('raw-rendered');
            const pre = document.createElement('pre');
            pre.textContent = rawOriginalMessage; // Show the full raw message for "raw" mode
            textWrapper.appendChild(pre);
        }
    } catch (err) {
        console.error(`[logPanelEntryDisplay] Error rendering content for log entry ${logIndex} (mode: ${finalMode}):`, err);
        textWrapper.innerHTML = `<pre>Error rendering content (mode: ${finalMode}):\n${err.message || err}</pre>`;
    }
}

/**
 * Enhances markdown content after rendering, primarily by adding menus to code fences and Mermaid diagrams.
 * This would be the new home for LogPanel.js's _enhanceCodeBlocksAndMermaid.
 * @param {HTMLElement} parentElement - The element containing the rendered markdown.
 * @param {string} logEntryIndex - The index of the log entry.
 * @param {object} menuContext - Contextual data like logPanelInstance for _codeFenceBufferA/B,
 *                               _showTemporaryFeedback, and triggerActions.
 */
export function enhanceMarkdownContent(parentElement, logEntryIndex, menuContext) {
    if (!parentElement) return;

    // Handle standard code blocks: <pre><code>...</code></pre>
    const codeBlocks = parentElement.querySelectorAll('pre'); // Select <pre> as it's the visual container
    codeBlocks.forEach((preElement, index) => {
        const codeElement = preElement.querySelector('code');
        const contentToCopy = codeElement ? codeElement.innerText : preElement.innerText;
        if (contentToCopy.trim()) {
            // Check if a menu isn't already there (simple check by class)
            if (!preElement.parentElement.querySelector('.code-fence-menu-button')) {
                 addCodeFenceMenu(preElement, contentToCopy, `${logEntryIndex}-code-${index}`, 'code');
            }
        }
    });

    // Handle Mermaid diagrams (assuming they are rendered into divs with a specific class, e.g., .mermaid)
    const mermaidDiagrams = parentElement.querySelectorAll('.mermaid'); // Adjust selector if needed
    mermaidDiagrams.forEach((diagElement, index) => {
        // For Mermaid, contentToCopy might need to be the original DOT/graph string.
        // This might require storing the original string in a data attribute during rendering.
        // For now, let's assume its innerText is a representation or we can extract from a data-attribute.
        const contentToCopy = diagElement.dataset.mermaidSource || diagElement.innerText; 
        if (contentToCopy.trim()) {
             if (!diagElement.parentElement.querySelector('.code-fence-menu-button')) {
                addCodeFenceMenu(diagElement, contentToCopy, `${logEntryIndex}-mermaid-${index}`, 'mermaid');
             }
        }
    });
    console.debug(`[logPanelEntryDisplay] enhanceMarkdownContent finished for entry ${logEntryIndex}. Found ${codeBlocks.length} code blocks, ${mermaidDiagrams.length} mermaid diagrams.`);
}

/**
 * Adds a hamburger menu to a specific code fence or Mermaid diagram element.
 * This would be the new home for LogPanel.js's _addHamburgerMenuToElement.
 * @param {HTMLElement} targetElement - The <pre> or diagram element.
 * @param {string} contentToCopy - The text content of the block.
 * @param {string} logEntryIndex - The index of the log entry.
 * @param {string} blockType - The type of block (e.g., 'code', 'mermaid').
 * @param {object} menuContext - Contextual data (see enhanceMarkdownContent).
 */
export function addCodeFenceMenu(targetElement, contentToCopy, logEntryIndex, blockType, menuContext) {
    if (!targetElement || !targetElement.parentElement) return;

    const menuId = `cf-menu-${logEntryIndex}-${blockType}-${Math.random().toString(36).substring(2, 7)}`;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative'; // For positioning the menu button

    // Hamburger Button
    const menuButton = document.createElement('button');
    menuButton.innerHTML = '&#x2630;'; // Hamburger icon
    menuButton.className = 'code-fence-menu-button';
    menuButton.style.position = 'absolute';
    menuButton.style.top = '5px';
    menuButton.style.right = '5px';
    menuButton.style.zIndex = '10'; // Ensure it's above the code block's content
    menuButton.style.padding = '2px 5px';
    menuButton.style.fontSize = '12px';
    menuButton.style.backgroundColor = '#f0f0f0';
    menuButton.style.border = '1px solid #ccc';
    menuButton.style.borderRadius = '3px';
    menuButton.style.cursor = 'pointer';
    menuButton.title = 'Code Actions';

    // Dropdown Menu
    const dropdown = document.createElement('div');
    dropdown.className = 'code-fence-dropdown';
    dropdown.id = menuId;
    dropdown.style.display = 'none';
    dropdown.style.position = 'absolute';
    dropdown.style.top = '25px'; // Below the button
    dropdown.style.right = '5px';
    dropdown.style.backgroundColor = 'white';
    dropdown.style.border = '1px solid #ccc';
    dropdown.style.borderRadius = '3px';
    dropdown.style.boxShadow = '0 2px 5px rgba(0,0,0,0.15)';
    dropdown.style.zIndex = '20'; // Above button and content
    dropdown.style.minWidth = '150px';

    const createMenuItem = (text, actionType, bufferKey = null) => {
        const item = document.createElement('div');
        item.textContent = text;
        item.style.padding = '5px 10px';
        item.style.cursor = 'pointer';
        item.style.fontSize = '0.9em';
        item.onmouseenter = () => item.style.backgroundColor = '#f0f0f0';
        item.onmouseleave = () => item.style.backgroundColor = 'white';
        item.onclick = (e) => {
            e.stopPropagation();
            let actionPayload = { text: contentToCopy };
            if (bufferKey) {
                actionPayload.bufferKey = bufferKey; // For future use if actions differentiate
            }
            
            console.debug(`[CodeFenceMenu] Triggering action: ${actionType}, with content: ${contentToCopy.substring(0,30)}...`);
            try {
                triggerActions[actionType](actionPayload, item); // Assuming triggerActions is available
                showTemporaryFeedback(item, `'${text}' executed.`);
            } catch (err) {
                console.error(`[CodeFenceMenu] Error triggering action ${actionType}:`, err);
                showTemporaryFeedback(item, `Error: ${err.message}`, true);
            }
            dropdown.style.display = 'none'; // Hide menu after action
        };
        return item;
    };

    // Assuming you have actions like 'setSmartCopyBufferA', 'setSmartCopyBufferB', and 'replaceEditorSelection'
    // The user mentioned "A buffer, B buffer" - let's assume these map to existing state/actions.
    // If `setSelectionStateA/B` are purely for editor selections, we might need new actions for these code buffers.
    // For now, using 'setSmartCopyBufferA/B' as placeholders, adjust if your actions are named differently.
    dropdown.appendChild(createMenuItem('Copy to A', 'setSmartCopyBufferA', 'A'));
    dropdown.appendChild(createMenuItem('Copy to B', 'setSmartCopyBufferB', 'B'));
    dropdown.appendChild(createMenuItem('Replace Editor Selection', 'replaceEditorSelection'));

    menuButton.onclick = (e) => {
        e.stopPropagation();
        const isHidden = dropdown.style.display === 'none';
        // Hide all other code fence menus
        document.querySelectorAll('.code-fence-dropdown').forEach(d => {
            if (d.id !== menuId) d.style.display = 'none';
        });
        dropdown.style.display = isHidden ? 'block' : 'none';
    };

    // Add to the DOM
    // Wrap the targetElement with the wrapper, then add menuButton and dropdown to wrapper
    const parent = targetElement.parentNode;
    if (parent) {
        parent.insertBefore(wrapper, targetElement);
        wrapper.appendChild(targetElement); // Move targetElement inside wrapper
        wrapper.appendChild(menuButton);
        wrapper.appendChild(dropdown);
    } else { // Fallback if no parent (should not happen for <pre> in rendered HTML)
        targetElement.style.position = 'relative'; // Ensure target can host absolute positioned button
        targetElement.appendChild(menuButton);
        targetElement.appendChild(dropdown);
    }

    // Global click listener to hide the menu if clicked outside
    // Ensure this listener is only added once or managed properly to avoid multiple listeners
    const clickOutsideListener = (event) => {
        if (!dropdown.contains(event.target) && event.target !== menuButton) {
            dropdown.style.display = 'none';
        }
    };
    // A more robust way might be to add this listener when menu is shown, and remove when hidden,
    // or use a single global listener managed by LogPanel that checks for open menus.
    // For now, adding it directly:
    document.addEventListener('click', clickOutsideListener, { capture: true, once: false });
    // Consider how to clean up this listener if the log entry is removed or re-rendered.
    // A simple way is to remove it if the dropdown itself is removed from DOM.
    const observer = new MutationObserver((mutationsList, obs) => {
        for(const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                let removed = false;
                mutation.removedNodes.forEach(node => {
                    if (node === dropdown) removed = true;
                });
                if (removed) {
                    document.removeEventListener('click', clickOutsideListener, { capture: true });
                    obs.disconnect();
                    break;
                }
            }
        }
    });
    if (dropdown.parentNode) { // Start observing only if dropdown is in the DOM
        observer.observe(dropdown.parentNode, { childList: true });
    }
}

/**
 * Shows temporary feedback near an element (e.g., "Copied!").
 * This would be the new home for LogPanel.js's _showTemporaryFeedback.
 * @param {HTMLElement} anchorElement - The element to position the feedback near.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - If true, styles as an error.
 */
export function showTemporaryFeedback(anchorElement, message, isError = false) {
    if (!anchorElement) return;

    const feedbackElement = document.createElement('div');
    feedbackElement.className = 'log-entry-feedback';
    feedbackElement.textContent = message;
    if (isError) {
        feedbackElement.style.color = 'red';
    } else {
        feedbackElement.style.color = 'green';
    }
    feedbackElement.style.position = 'absolute';
    feedbackElement.style.zIndex = '1000';
    feedbackElement.style.padding = '2px 5px';
    feedbackElement.style.fontSize = '0.8em';
    feedbackElement.style.backgroundColor = 'white';
    feedbackElement.style.border = '1px solid #ccc';
    feedbackElement.style.borderRadius = '3px';
    feedbackElement.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

    // Position near the anchor
    const rect = anchorElement.getBoundingClientRect();
    document.body.appendChild(feedbackElement); // Append to body to avoid clipping issues
    feedbackElement.style.top = `${window.scrollY + rect.top - feedbackElement.offsetHeight - 2}px`;
    feedbackElement.style.left = `${window.scrollX + rect.left}px`;


    setTimeout(() => {
        feedbackElement.remove();
    }, 1500);
}

/**
 * Enhances code blocks and Mermaid diagrams with hamburger menus.
 * @param {HTMLElement} parentElement - The container element with code blocks
 * @param {number} logEntryIndex - The index of the log entry
 * @param {LogPanel} logPanelInstance - Reference to the LogPanel instance
 */
export function enhanceCodeBlocksAndMermaid(parentElement, logEntryIndex, logPanelInstance) {
    // Selector for standard code blocks (pre elements that likely contain code)
    const standardCodeBlockSelector = 'pre'; 
    
    // Selector for Mermaid diagrams
    const mermaidDiagramSelector = 'div.mermaid, pre.mermaid, [data-mermaid-source]';

    const potentialBlocks = parentElement.querySelectorAll(`${standardCodeBlockSelector}, ${mermaidDiagramSelector}`);
    
    if (!potentialBlocks.length) {
        return;
    }

    const processedElements = new Set(); 

    potentialBlocks.forEach((element) => {
        if (processedElements.has(element)) return;

        let contentToCopy = null;
        let blockType = 'unknown';
        let targetElementForMenu = element;
        let languageHint = '';  // Store language hint for proper formatting

        // Get the log entry that contains this element
        const logEntry = element.closest('.log-entry');
        const originalMessage = logEntry?.dataset.logCoreMessage || '';

        if (element.matches(mermaidDiagramSelector)) {
            // It's a mermaid diagram
            blockType = 'mermaid';
            languageHint = 'mermaid';
            
            // Try to extract the original mermaid code from markdown
            contentToCopy = extractCodeFenceFromMarkdown(originalMessage, 'mermaid');
            
            // If we couldn't extract it, fall back to element content
            if (!contentToCopy) {
                contentToCopy = element.textContent;
            }
        } else if (element.tagName === 'PRE') {
            // It's a code block
            const codeElement = element.querySelector('code');
            
            if (codeElement) {
                // Try to determine language from class
                const langMatch = codeElement.className.match(/language-(\S+)/);
                languageHint = langMatch ? langMatch[1] : '';
                blockType = `code-${languageHint || 'unknown'}`;
                
                // Try to extract from original markdown first
                contentToCopy = extractCodeFenceFromMarkdown(originalMessage, languageHint);
                
                // If that fails, use the code element content
                if (!contentToCopy) {
                    contentToCopy = codeElement.textContent;
                }
            } else {
                // Pre without code element
                blockType = 'text-block';
                contentToCopy = element.textContent;
            }
        }

        if (contentToCopy && contentToCopy.trim()) {
            // Pass the language hint to the hamburger menu handler
            addHamburgerMenuToElement(
                targetElementForMenu, 
                contentToCopy.trim(), 
                logEntryIndex, 
                blockType, 
                logPanelInstance,
                languageHint
            );
            processedElements.add(targetElementForMenu);
        }
    });
}

/**
 * Extract code fence blocks from markdown content
 * @param {string} markdown - The markdown content to search
 * @param {string} language - Optional language hint to find the right block
 * @returns {string|null} - The content of the code block without the fence markers
 */
function extractCodeFenceFromMarkdown(markdown, language = '') {
    if (!markdown) return null;
    
    // Updated pattern to require code fences to start at the beginning of a line
    // The ^ anchor ensures the ``` starts at the beginning of a line
    const codeBlockRegex = /^```(\S*)\s+([\s\S]*?)^```/gm;
    const matches = [];
    let match;
    
    // Find all code blocks
    while ((match = codeBlockRegex.exec(markdown)) !== null) {
        const blockLang = match[1].trim();
        const blockContent = match[2].trim();
        
        matches.push({
            language: blockLang,
            content: blockContent,
            fullMatch: match[0]
        });
    }
    
    // If language is specified, try to find a matching block
    if (language && matches.length > 0) {
        // First look for exact language match
        const exactMatch = matches.find(m => m.language === language);
        if (exactMatch) return exactMatch.content;
        
        // Then try case-insensitive match
        const caseInsensitiveMatch = matches.find(
            m => m.language.toLowerCase() === language.toLowerCase()
        );
        if (caseInsensitiveMatch) return caseInsensitiveMatch.content;
    }
    
    // If no language match or no language specified, return the first block
    return matches.length > 0 ? matches[0].content : null;
}

/**
 * Adds a hamburger menu to code blocks for copying to buffers.
 * @param {HTMLElement} targetElement - The element to attach the menu to
 * @param {string} contentToCopy - Content to copy from the code block
 * @param {number} logEntryIndex - Log entry index for logging
 * @param {string} blockType - Type of block (code, mermaid, etc.)
 * @param {LogPanel} logPanelInstance - Reference to the LogPanel instance
 * @param {string} languageHint - Optional language hint for formatting
 */
export function addHamburgerMenuToElement(
    targetElement, 
    contentToCopy, 
    logEntryIndex, 
    blockType = 'unknown', 
    logPanelInstance,
    languageHint = ''
) {
    // Create the hamburger button
    const hamburgerBtn = document.createElement('button');
    hamburgerBtn.innerHTML = '&#x2630;'; 
    hamburgerBtn.className = 'log-entry-codefence-menu-btn';
    hamburgerBtn.title = `${blockType.startsWith('code-') ? 'Code' : blockType.charAt(0).toUpperCase() + blockType.slice(1)} Actions`;
    
    if (getComputedStyle(targetElement).position === 'static') {
        targetElement.style.position = 'relative'; 
    }
    
    // Create the menu
    const menuDiv = document.createElement('div');
    menuDiv.className = 'log-entry-codefence-menu';

    const actions = [
        { label: 'Copy to A Buffer', action: 'copyA' },
        { label: 'Copy to B Buffer', action: 'copyB' },
        { label: 'Replace Editor Selection', action: 'replaceSelection' }
    ];

    actions.forEach(act => {
        const item = document.createElement('div');
        item.textContent = act.label;
        item.className = 'log-entry-codefence-menu-item';
        
        item.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const codeContentRaw = contentToCopy;
            menuDiv.style.display = 'none'; 
            hamburgerBtn.style.opacity = '0.7';

            // For debugging
            console.log(`Content for ${act.action} action - ${blockType}:`, codeContentRaw.substring(0, 100));

            if (act.action === 'copyA') {
                logPanelInstance._codeFenceBufferA = codeContentRaw;
                showTemporaryFeedback(hamburgerBtn, 'Copied to A!');
            } else if (act.action === 'copyB') {
                logPanelInstance._codeFenceBufferB = codeContentRaw;
                showTemporaryFeedback(hamburgerBtn, 'Copied to B!');
            } else if (act.action === 'replaceSelection') {
                // Format content as a proper code fence
                let lang = '';
                
                // Determine language for the code fence
                if (blockType === 'mermaid') {
                    lang = 'mermaid';
                } else if (blockType.startsWith('code-') && blockType !== 'code-unknown') {
                    lang = blockType.substring(5);
                } else if (languageHint) {
                    lang = languageHint;
                }
                
                // Create the full code fence with proper language
                const contentToInsert = '```' + lang + '\n' + codeContentRaw + '\n```';
                
                // Replace editor selection
                if (typeof triggerActions.replaceEditorSelection === 'function') {
                    triggerActions.replaceEditorSelection({ codeContent: contentToInsert });
                    showTemporaryFeedback(hamburgerBtn, 'Sent to editor!');
                } else {
                    const errorMsg = 'Feature to replace editor selection is not fully configured.';
                    console.error(errorMsg);
                    alert(errorMsg); 
                    showTemporaryFeedback(hamburgerBtn, 'Error!', true);
                }
            }
        });
        menuDiv.appendChild(item);
    });

    targetElement.appendChild(hamburgerBtn);
    targetElement.appendChild(menuDiv);

    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const parentLogEntry = targetElement.closest('.log-entry');
        if (parentLogEntry) {
            parentLogEntry.querySelectorAll('.log-entry-codefence-menu').forEach(m => {
                if (m !== menuDiv) {
                    m.style.display = 'none';
                    const otherHamburger = m.previousElementSibling;
                    if (otherHamburger && otherHamburger.classList.contains('log-entry-codefence-menu-btn')) {
                        otherHamburger.style.opacity = '0.7';
                    }
                }
            });
        }
        const currentlyVisible = menuDiv.style.display === 'block';
        menuDiv.style.display = currentlyVisible ? 'none' : 'block';
        hamburgerBtn.style.opacity = currentlyVisible ? '0.7' : '1';
    });
    
    // Setup global click handler if not already set
    setupGlobalClickHandler();
}

// Global click handler for closing menus (setup once)
let globalClickHandlerSetup = false;
function setupGlobalClickHandler() {
    if (globalClickHandlerSetup) return;
    
    document.addEventListener('click', (event) => {
        document.querySelectorAll('.log-entry-codefence-menu').forEach(openMenu => {
            const buttonForThisMenu = openMenu.previousElementSibling;
            // Check if click is outside the menu AND its button
            if (!openMenu.contains(event.target) && !(buttonForThisMenu && buttonForThisMenu.contains(event.target))) {
                openMenu.style.display = 'none';
                if (buttonForThisMenu && buttonForThisMenu.classList.contains('log-entry-codefence-menu-btn')) {
                    buttonForThisMenu.style.opacity = '0.7';
                }
            }
        });
    }, true);
    
    globalClickHandlerSetup = true;
}

/**
 * Updates the display of a log entry based on the requested render mode
 * @param {HTMLElement} logEntryDiv - The log entry DOM element
 * @param {string} requestedMode - The requested render mode (raw, markdown, html)
 * @param {boolean} forceRawState - Whether to force raw state
 * @param {object} logPanelInstance - The LogPanel instance for context
 */
export async function updateLogEntryDisplay(logEntryDiv, requestedMode, forceRawState = false, logPanelInstance) {
    // The entire _updateLogEntryDisplay method from LogPanel.js (lines ~504-581)
    // This replaces your current updateLogEntryDisplayContent with the proper implementation
    if (!logEntryDiv || (!logEntryDiv.classList.contains('expanded') && !forceRawState)) {
        if(forceRawState) requestedMode = logPanelInstance.RENDER_MODE_RAW;
        else return; 
    }

    const expandedToolbar = logEntryDiv.querySelector('.log-entry-expanded-toolbar');
    const textWrapper = logEntryDiv.querySelector('.log-entry-text-wrapper');
    const markdownToggleButton = expandedToolbar?.querySelector('.markdown-toggle-button');
    const htmlToggleButton = expandedToolbar?.querySelector('.html-toggle-button');

    if (!textWrapper) {
        console.error('_updateLogEntryDisplay: Could not find textWrapper for entry.', {type: 'LOG_PANEL_ERROR'});
        return;
    }

    // Use the trimmed coreMessage for processing (MD, HTML)
    const coreMessage = logEntryDiv.dataset.logCoreMessage || ''; 
    // Use the new rawContentPart for raw <pre> display
    const rawContentPart = logEntryDiv.dataset.logRawContentPart;
    const logType = logEntryDiv.dataset.logType;
    const logIndex = logEntryDiv.dataset.logIndex;

    const finalMode = forceRawState ? logPanelInstance.RENDER_MODE_RAW : requestedMode;
    logEntryDiv.dataset.renderMode = finalMode;

    if (markdownToggleButton) markdownToggleButton.classList.toggle('active', finalMode === logPanelInstance.RENDER_MODE_MARKDOWN);
    if (htmlToggleButton) htmlToggleButton.classList.toggle('active', finalMode === logPanelInstance.RENDER_MODE_HTML);

    // Explicitly remove all mode classes, then add the current one
    textWrapper.classList.remove('markdown-rendered', 'html-rendered');
    if (finalMode === logPanelInstance.RENDER_MODE_MARKDOWN) {
        textWrapper.classList.add('markdown-rendered');
    } else if (finalMode === logPanelInstance.RENDER_MODE_HTML) {
        textWrapper.classList.add('html-rendered');
    }

    textWrapper.innerHTML = ''; 

    try {
        if (finalMode === logPanelInstance.RENDER_MODE_MARKDOWN) {
            const { renderMarkdown, postProcessRender } = await import('/client/preview/renderer.js');
            const result = await renderMarkdown(coreMessage); 
            textWrapper.innerHTML = result.html;
            await postProcessRender(textWrapper);
            enhanceCodeBlocksAndMermaid(textWrapper, logIndex, logPanelInstance);
        } else if (finalMode === logPanelInstance.RENDER_MODE_HTML) {
            const iframe = document.createElement('iframe');
            iframe.className = 'log-entry-html-iframe';
            iframe.srcdoc = coreMessage;
            textWrapper.appendChild(iframe);
        } else { // Default to Raw/Preformatted
             const pre = document.createElement('pre');
             pre.textContent = (typeof rawContentPart === 'string') ? rawContentPart : coreMessage;
             textWrapper.appendChild(pre);
        }
    } catch (err) {
        console.error(`Error rendering content for log entry ${logIndex} (mode: ${finalMode}): ${err.message}`);
        textWrapper.innerHTML = `<pre>Error rendering content (mode: ${finalMode}):\n${err}</pre>`;
    }
}

/**
 * Expands a log entry and builds its toolbar
 * @param {HTMLElement} logEntryDiv - The log entry DOM element
 * @param {object} logPanelInstance - The LogPanel instance
 */
export function expandLogEntry(logEntryDiv, logPanelInstance) {
    // The entire _expandLogEntry method from LogPanel.js (lines ~906-1001)
    logEntryDiv.classList.add('expanded');
    if (logPanelInstance.logElement) { // Move to top
        logPanelInstance.logElement.prepend(logEntryDiv);
    }

    const expandedToolbar = logEntryDiv.querySelector('.log-entry-expanded-toolbar');

    if (expandedToolbar && !expandedToolbar.dataset.toolbarBuilt) {
        expandedToolbar.innerHTML = ''; // Clear previous content
        const { logIndex, logTimestamp, logType, logSubtype, rawOriginalMessage } = logEntryDiv.dataset;

        const createToken = (text, className) => {
            const token = document.createElement('span');
            token.className = `log-token ${className}`;
            token.textContent = text;
            return token;
        };

        // Add tokens: Index, Timestamp, Type, Subtype
        if (logIndex !== undefined) expandedToolbar.appendChild(createToken(`[${logIndex}]`, 'log-token-index'));
        if (logTimestamp) expandedToolbar.appendChild(createToken(logTimestamp, 'log-token-time'));
        if (logType) expandedToolbar.appendChild(createToken(logType, `log-token-type log-type-${logType.toLowerCase()}` ));
        if (logSubtype) expandedToolbar.appendChild(createToken(`[${logSubtype}]`, `log-token-subtype log-subtype-${logSubtype.toLowerCase().replace(/[^a-z0-9\-]/g, '-')}`));

        // Right-align wrapper for buttons
        const expandedButtonWrapper = document.createElement('div');
        expandedButtonWrapper.className = 'button-wrapper';
        expandedToolbar.appendChild(expandedButtonWrapper);

        // MD Toggle Button
        const markdownToggleButton = document.createElement('button');
        markdownToggleButton.textContent = 'MD';
        markdownToggleButton.className = 'log-entry-button markdown-toggle-button';
        markdownToggleButton.title = 'Toggle Markdown Rendering';
        expandedButtonWrapper.appendChild(markdownToggleButton);

        // HTML Toggle Button
        const htmlToggleButton = document.createElement('button');
        htmlToggleButton.textContent = 'HTML';
        htmlToggleButton.className = 'log-entry-button html-toggle-button';
        htmlToggleButton.title = 'Toggle HTML Page Rendering (iframe)';
        expandedButtonWrapper.appendChild(htmlToggleButton);

        // Toolbar Copy Button
        const toolbarCopyButton = document.createElement('button');
        toolbarCopyButton.innerHTML = '&#128203;'; // Copy icon
        toolbarCopyButton.className = 'log-entry-button toolbar-button';
        toolbarCopyButton.title = 'Copy log entry text (Shift+Click to Paste)';
        toolbarCopyButton.dataset.logText = rawOriginalMessage || '';
        expandedButtonWrapper.appendChild(toolbarCopyButton);

        // Collapse "Pin" Button
        const collapsePinButton = document.createElement('button');
        collapsePinButton.innerHTML = '&#128204;'; // Pushpin icon
        collapsePinButton.className = 'log-entry-button collapse-pin-button';
        collapsePinButton.title = 'Collapse Log Entry';
        collapsePinButton.dataset.action = 'collapseLogEntry';
        expandedButtonWrapper.appendChild(collapsePinButton);

        expandedToolbar.dataset.toolbarBuilt = 'true';

        // Add Internal Click Listeners for Toggle Buttons
        markdownToggleButton.addEventListener('click', (mdEvent) => {
            mdEvent.stopPropagation();
            const currentMode = logEntryDiv.dataset.renderMode;
            const newMode = currentMode === logPanelInstance.RENDER_MODE_MARKDOWN ? 
                logPanelInstance.RENDER_MODE_RAW : logPanelInstance.RENDER_MODE_MARKDOWN;
            updateLogEntryDisplay(logEntryDiv, newMode, false, logPanelInstance);
        });

        htmlToggleButton.addEventListener('click', (htmlEvent) => {
            htmlEvent.stopPropagation();
            const currentMode = logEntryDiv.dataset.renderMode;
            const newMode = currentMode === logPanelInstance.RENDER_MODE_HTML ? 
                logPanelInstance.RENDER_MODE_RAW : logPanelInstance.RENDER_MODE_HTML;
            updateLogEntryDisplay(logEntryDiv, newMode, false, logPanelInstance);
        });
        
        collapsePinButton.addEventListener('click', (pinEvent) => {
            pinEvent.stopPropagation();
            collapseLogEntry(logEntryDiv, logPanelInstance);
        });
    }

    // Set Initial Content on Expand
    updateLogEntryDisplay(logEntryDiv, logPanelInstance.RENDER_MODE_RAW, false, logPanelInstance);
}

/**
 * Collapses a log entry
 * @param {HTMLElement} logEntryDiv - The log entry DOM element
 * @param {object} logPanelInstance - The LogPanel instance
 */
export function collapseLogEntry(logEntryDiv, logPanelInstance) {
    // The entire _collapseLogEntry method from LogPanel.js (lines ~1002-1008)
    logEntryDiv.classList.remove('expanded');
    // Reset content to raw text when collapsing
    updateLogEntryDisplay(logEntryDiv, logPanelInstance.RENDER_MODE_RAW, true, logPanelInstance);
}

// Add other display-related utility functions as needed.
