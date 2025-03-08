import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";
import mermaid from "https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.2.4/mermaid.esm.min.mjs";
import { logMessage } from "./log/index.js";
import { currentDir } from "./fileManager.js";
import { 
    processSvgInMarkdown, 
    processSvgContent, 
    createSvgRenderer, 
    initSvgRefreshButton 
} from "./markdown-svg.js";

mermaid.initialize({ 
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose', // This might be needed for some diagrams
    logLevel: 3 // Error level logging only
});

let lastMarkdown = "";
let updateScheduled = false;
let updateTimeout;

export function schedulePreviewUpdate() {
    if (updateScheduled) return;
    updateScheduled = true;

    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
        requestAnimationFrame(() => {
            updatePreview(document.getElementById('md-editor').value);
            updateScheduled = false;
        });
    }, 300); // Reduced from 1000ms to 300ms for better responsiveness
}

// Ensure the preview container exists and is properly initialized
function ensurePreviewContainer() {
    let preview = document.getElementById('md-preview');
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'md-preview';
        document.getElementById('content').appendChild(preview);
        console.log('Created md-preview container');
    }
    return preview;
}

// Update the markdown parser configuration
export function updatePreview(content) {
    if (!content) {
        logMessage('[PREVIEW] No content to preview');
        return;
    }
    
    try {
        // First check if the content contains SVG code
        const hasSvg = content.includes('<svg') || content.includes('```svg');
        
        // Process SVG in markdown if needed
        let processedContent = content;
        if (hasSvg) {
            const { processedText, hasSvg: svgFound } = processSvgInMarkdown(content);
            processedContent = processedText;
            
            if (svgFound) {
                logMessage('[PREVIEW] SVG content detected and processed');
            }
        }
        
        // Convert markdown to HTML
        const html = marked.parse(processedContent);
        
        // Update the preview
        const preview = document.getElementById('md-preview');
        if (preview) {
            preview.innerHTML = html;
            logMessage('[PREVIEW] Updated preview');
            
            // Process any SVG content that was rendered
            if (hasSvg) {
                // Use setTimeout to ensure the DOM is updated before processing SVG
                setTimeout(() => {
                    processSvgContent().then(() => {
                        logMessage('[PREVIEW] SVG content processed after preview update');
                    });
                }, 50);
            }
            
            // Initialize mermaid diagrams if present
            if (content.includes('```mermaid') || content.includes('graph ') || content.includes('sequenceDiagram')) {
                try {
                    // First ensure the elements are properly created
                    const preview = document.getElementById('md-preview');
                    if (!preview) {
                        logMessage('[PREVIEW ERROR] Preview element not found for mermaid initialization');
                        return;
                    }
                    
                    // Find all mermaid code blocks
                    const mermaidBlocks = preview.querySelectorAll('pre code.language-mermaid');
                    
                    if (mermaidBlocks.length > 0) {
                        logMessage(`[PREVIEW] Found ${mermaidBlocks.length} mermaid blocks to process`);
                        
                        // Process each block to ensure proper DOM structure
                        mermaidBlocks.forEach((block, index) => {
                            const containerId = `mermaid-diagram-${index}`;
                            const container = document.createElement('div');
                            container.className = 'mermaid';
                            container.id = containerId;
                            container.textContent = block.textContent;
                            
                            // Replace the code block with the container
                            const preElement = block.closest('pre');
                            if (preElement && preElement.parentNode) {
                                preElement.parentNode.replaceChild(container, preElement);
                            }
                        });
                        
                        // Now initialize mermaid with a slight delay
                        setTimeout(() => {
                            mermaid.init(undefined, document.querySelectorAll('.mermaid'));
                            logMessage('[PREVIEW] Mermaid diagrams initialized');
                        }, 50);
                    } else {
                        logMessage('[PREVIEW] No mermaid code blocks found');
                    }
                } catch (mermaidError) {
                    logMessage(`[PREVIEW ERROR] Mermaid initialization failed: ${mermaidError.message}`);
                }
            }
        } else {
            logMessage('[PREVIEW ERROR] Preview element not found');
        }
    } catch (error) {
        logMessage(`[PREVIEW ERROR] Failed to update preview: ${error.message}`);
        console.error('[PREVIEW ERROR]', error);
    }
}

// Function to initialize image delete handlers
function initImageDeleteHandlers() {
    if (!window.handleImageDelete) {
        window.handleImageDelete = function(imageName) {
            if (confirm(`Are you sure you want to delete ${imageName}?`)) {
                const imageUrl = `/uploads/${imageName}`;
                import('./imageManager.js').then(module => {
                    module.deleteImage(imageUrl);
                });
            }
        };
    }
}

export async function loadFile(filename) {
    try {
        const response = await globalFetch(`/api/files/get?name=${encodeURIComponent(filename)}&dir=${encodeURIComponent(currentDir)}`);
        if (!response.ok) throw new Error(`Server returned ${response.status}`);
        
        const data = await response.json();
        console.log('Fetched markdown content:', data.content);
        
        const editor = document.getElementById('md-editor');
        if (editor) {
            editor.value = data.content;
        }
        
        updatePreview(data.content);
        saveState(currentDir, filename);
        updateUrlState(currentDir, filename);
    } catch (error) {
        logMessage(`[FILES ERROR] Failed to load file: ${error.message}`);
        console.error('[FILES ERROR]', error);
    }
}

// Add the processMermaidDiagrams function
export function processMermaidDiagrams() {
    try {
        const preview = document.getElementById('md-preview');
        if (!preview) return;
        
        // Find all mermaid code blocks
        const mermaidDiagrams = preview.querySelectorAll('pre code.language-mermaid');
        
        if (mermaidDiagrams.length > 0) {
            logMessage(`[PREVIEW] Found ${mermaidDiagrams.length} mermaid diagrams`);
            
            // Process each diagram
            mermaidDiagrams.forEach((diagram, index) => {
                const diagramId = `mermaid-diagram-${index}`;
                const diagramContainer = document.createElement('div');
                diagramContainer.className = 'mermaid';
                diagramContainer.id = diagramId;
                diagramContainer.textContent = diagram.textContent;
                diagram.parentNode.replaceWith(diagramContainer);
            });
            
            // Initialize mermaid
            try {
                mermaid.init(undefined, document.querySelectorAll('.mermaid'));
                logMessage('[PREVIEW] Mermaid diagrams rendered successfully');
            } catch (mermaidError) {
                logMessage(`[PREVIEW ERROR] Failed to render mermaid diagrams: ${mermaidError.message}`);
                console.error('[PREVIEW ERROR] Mermaid:', mermaidError);
            }
        }
    } catch (error) {
        logMessage(`[PREVIEW ERROR] Failed to process mermaid diagrams: ${error.message}`);
        console.error('[PREVIEW ERROR]', error);
    }
}
