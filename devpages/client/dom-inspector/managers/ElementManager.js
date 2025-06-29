/**
 * client/dom-inspector/managers/ElementManager.js
 * Manages element caching, selection, and basic element operations
 */

export class ElementManager {
    constructor() {
        this.selectedElement = null;
        this.elementCache = new Map();
        this.nextCacheId = 0;
        this.elementIdCounter = 0;
    }

    /**
     * Cache an element and return its ID
     */
    cacheElement(element) {
        const id = this.nextCacheId++;
        this.elementCache.set(id.toString(), element);
        return id.toString();
    }

    /**
     * Get element from cache by ID
     */
    getElementFromCache(id) {
        return this.elementCache.get(id);
    }

    /**
     * Generate unique ID for DOM tree nodes
     */
    generateElementId(element) {
        if (!element.dataset.domInspectorId) {
            element.dataset.domInspectorId = `dom_node_${this.elementIdCounter++}`;
        }
        return element.dataset.domInspectorId;
    }

    /**
     * Find element ID in cache
     */
    findElementId(element) {
        for (const [id, cachedElement] of this.elementCache.entries()) {
            if (cachedElement === element) {
                return id;
            }
        }
        return null;
    }

    /**
     * Set the currently selected element
     */
    setSelectedElement(element) {
        this.selectedElement = element;
        if (element) {
            this.cacheElement(element);
        }
    }

    /**
     * Get the currently selected element
     */
    getSelectedElement() {
        return this.selectedElement;
    }

    /**
     * Clear the element cache
     */
    clearCache() {
        this.elementCache.clear();
        this.nextCacheId = 0;
    }

    /**
     * Get element status badges for display
     */
    getElementStatusBadges(element) {
        const badges = [];
        const tagName = element.tagName.toLowerCase();
    
        if (element.id) badges.push(`#${element.id}`);
        if (element.className) {
            const classes = element.className.toString().split(' ').filter(c => c);
            badges.push(...classes.map(c => `.${c.substring(0, 20)}`));
        }
        if (element.src) badges.push('src');
        if (element.href) badges.push('href');
        if (element.disabled) badges.push('disabled');
        if (element.required) badges.push('required');
        if (element.type) badges.push(`type="${element.type}"`);
    
        switch (tagName) {
            case 'meta':
                if (element.name) badges.push(`name="${element.name}"`);
                break;
            case 'a':
                if (element.target) badges.push(`target="${element.target}"`);
                break;
        }
    
        return badges;
    }

    /**
     * Check if element is disabled
     */
    isElementDisabled(element) {
        return element.disabled || 
               element.hasAttribute('disabled') || 
               element.getAttribute('aria-disabled') === 'true';
    }

    /**
     * Check if element is readonly
     */
    isElementReadonly(element) {
        return element.readOnly || element.hasAttribute('readonly');
    }

    /**
     * Temporarily enable a disabled element
     */
    temporarilyEnableElement(element) {
        console.log('DOM Inspector: Temporarily enabling element:', element);
        
        // Store original state for restoration
        const originalState = {
            disabled: element.disabled,
            disabledAttr: element.getAttribute('disabled'),
            ariaDisabled: element.getAttribute('aria-disabled'),
            style: element.style.cssText
        };
        
        // Enable the element
        element.disabled = false;
        element.removeAttribute('disabled');
        element.removeAttribute('aria-disabled');
        
        // Override disabled styling
        element.style.cssText += `
            pointer-events: auto !important;
            opacity: 1 !important;
            cursor: pointer !important;
            background-color: var(--color-background) !important;
            color: var(--color-foreground) !important;
        `;
        
        // Store restoration function
        element._domInspectorRestore = () => {
            element.disabled = originalState.disabled;
            if (originalState.disabledAttr !== null) {
                element.setAttribute('disabled', originalState.disabledAttr);
            }
            if (originalState.ariaDisabled) {
                element.setAttribute('aria-disabled', originalState.ariaDisabled);
            }
            element.style.cssText = originalState.style;
            delete element._domInspectorRestore;
        };
        
        console.log('DOM Inspector: Element enabled. Call element._domInspectorRestore() to restore original state.');
        
        // Auto-restore after 30 seconds
        setTimeout(() => {
            if (element._domInspectorRestore) {
                element._domInspectorRestore();
                console.log('DOM Inspector: Auto-restored element to disabled state');
            }
        }, 30000);
    }

    /**
     * Test element clickability at multiple points
     */
    testElementClickability(element) {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // Test multiple points to find where the element is actually clickable
        const testPoints = [
            { x: centerX, y: centerY, name: 'center' },
            { x: rect.left + 5, y: rect.top + 5, name: 'top-left' },
            { x: rect.right - 5, y: rect.top + 5, name: 'top-right' },
            { x: rect.left + 5, y: rect.bottom - 5, name: 'bottom-left' },
            { x: rect.right - 5, y: rect.bottom - 5, name: 'bottom-right' },
            // Test edges
            { x: rect.left + 2, y: centerY, name: 'left-edge' },
            { x: rect.right - 2, y: centerY, name: 'right-edge' },
            { x: centerX, y: rect.top + 2, name: 'top-edge' },
            { x: centerX, y: rect.bottom - 2, name: 'bottom-edge' }
        ];
        
        const results = testPoints.map(point => {
            const elementAtPoint = document.elementFromPoint(point.x, point.y);
            const isDirectHit = elementAtPoint === element;
            const isChildHit = element.contains(elementAtPoint);
            
            return {
                ...point,
                elementAtPoint,
                isDirectHit,
                isChildHit,
                isClickable: isDirectHit || isChildHit
            };
        });
        
        const clickablePoints = results.filter(r => r.isDirectHit);
        const childInterceptPoints = results.filter(r => r.isChildHit && !r.isDirectHit);
        
        console.log('DOM Inspector: Clickability test results:');
        console.log('  Direct hits:', clickablePoints.length);
        console.log('  Child intercepts:', childInterceptPoints.length);
        
        if (childInterceptPoints.length > 0) {
            console.log('  Child elements intercepting clicks:');
            childInterceptPoints.forEach(point => {
                console.log(`    ${point.name}: ${point.elementAtPoint.tagName}${point.elementAtPoint.className ? '.' + point.elementAtPoint.className : ''}`);
            });
        }
        
        return {
            isClickable: clickablePoints.length > 0,
            hasChildIntercepts: childInterceptPoints.length > 0,
            clickablePoints,
            childInterceptPoints,
            bestClickPoint: clickablePoints[0] || null
        };
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.clearCache();
        this.selectedElement = null;
    }
} 