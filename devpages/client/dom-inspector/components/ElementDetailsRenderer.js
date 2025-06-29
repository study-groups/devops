/**
 * ElementDetailsRenderer.js - Creates element-specific details content
 * Handles rendering different types of element information based on tag type
 */

export class ElementDetailsRenderer {
    constructor() {
        // No initialization needed
    }

    /**
     * Create element details content
     */
    createElementDetailsContent(element) {
        const tagName = element.tagName.toLowerCase();
        let details = [];
        
        // Common details for all elements
        details.push(['Tag', tagName]);
        if (element.id) details.push(['ID', element.id]);
        if (element.className) details.push(['Classes', element.className]);
        
        // Element-specific details
        switch (tagName) {
            case 'html':
                details.push(['Language', element.lang || 'None']);
                details.push(['Document Title', document.title || 'Untitled']);
                details.push(['Character Set', document.characterSet || 'Unknown']);
                details.push(['Viewport', this.getViewportInfo()]);
                break;
                
            case 'main':
                details.push(['Role', element.getAttribute('role') || 'main']);
                details.push(['Content Sections', element.querySelectorAll('section, article, aside').length]);
                details.push(['Headings', element.querySelectorAll('h1, h2, h3, h4, h5, h6').length]);
                break;
                
            case 'div':
                const computedStyles = window.getComputedStyle(element);
                details.push(['Display', computedStyles.display]);
                details.push(['Position', computedStyles.position]);
                if (computedStyles.zIndex !== 'auto') details.push(['Z-Index', computedStyles.zIndex]);
                details.push(['Children', element.children.length]);
                if (element.dataset && Object.keys(element.dataset).length > 0) {
                    details.push(['Data Attributes', Object.keys(element.dataset).join(', ')]);
                }
                break;
                
            case 'iframe':
                details.push(['Source', element.src || 'None']);
                details.push(['Sandbox', element.sandbox || 'None']);
                details.push(['Loading', element.loading || 'eager']);
                details.push(['Referrer Policy', element.referrerPolicy || 'Default']);
                try {
                    const iframeDoc = element.contentDocument;
                    if (iframeDoc) {
                        details.push(['Content Title', iframeDoc.title || 'Untitled']);
                        details.push(['Content URL', iframeDoc.URL]);
                    } else {
                        details.push(['Content Access', 'Blocked (cross-origin)']);
                    }
                } catch (e) {
                    details.push(['Content Access', 'Blocked (security)']);
                }
                break;
                
            default:
                // Generic details for other elements
                details.push(['Node Type', element.nodeType]);
                details.push(['Children', element.children.length]);
                if (element.textContent && element.textContent.trim()) {
                    const preview = element.textContent.trim().substring(0, 50);
                    details.push(['Text Preview', preview + (element.textContent.length > 50 ? '...' : '')]);
                }
                
                // Show key attributes for specific element types
                if (['a', 'link'].includes(tagName) && element.href) {
                    details.push(['Href', element.href]);
                }
                if (['img', 'video', 'audio'].includes(tagName) && element.src) {
                    details.push(['Source', element.src]);
                }
                if (['input', 'textarea', 'select'].includes(tagName)) {
                    details.push(['Type', element.type || 'text']);
                    details.push(['Name', element.name || 'None']);
                }
                break;
        }
        
        return this.createDetailsTable(details);
    }

    /**
     * Create events content
     */
    createEventsContent(element) {
        const content = document.createElement('div');
        content.innerHTML = '<p>Event listeners would be shown here.</p>';
        return content;
    }
    
    /**
     * Create engine content
     */
    createEngineContent(element) {
        const content = document.createElement('div');
        content.innerHTML = '<p>Layout engine information would be shown here.</p>';
        return content;
    }

    /**
     * Get viewport information
     */
    getViewportInfo() {
        const viewport = document.querySelector('meta[name="viewport"]');
        return viewport ? viewport.content : 'Not set';
    }

    /**
     * Create details table
     */
    createDetailsTable(details) {
        const table = document.createElement('table');
        table.className = 'dom-inspector-details-table';
        
        details.forEach(([key, value]) => {
            const row = table.insertRow();
            row.insertCell().textContent = key;
            row.insertCell().textContent = value;
        });
        
        return table;
    }
} 