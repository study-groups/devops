/**
 * client/dom-inspector/managers/AnnotationManager.js
 * Manages z-index and stacking context annotations for DOM elements
 */

export class AnnotationManager {
    constructor() {
        // Annotation settings for z-index and stacking context display
        this.settings = {
            showZIndex: true,
            showStackingContext: true,
            showComputedZIndex: false,
            showZIndexLayer: true,
            annotationMode: 'compact',
            showBreadcrumbAnnotations: true
        };
    }

    /**
     * Update annotation settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    /**
     * Get annotation settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Get annotations for an element
     */
    getElementAnnotations(element) {
        const annotations = [];
        
        if (!element || element.nodeType !== Node.ELEMENT_NODE) {
            return annotations;
        }

        const computedStyle = window.getComputedStyle(element);
        const zIndexInfo = window.zIndexManager ? window.zIndexManager.getZIndexInfo(element) : null;

        // Z-Index annotations
        if (this.settings.showZIndex) {
            const zIndex = computedStyle.zIndex;
            if (zIndex !== 'auto') {
                annotations.push({
                    type: 'z-index',
                    value: zIndex,
                    label: `z:${zIndex}`,
                    className: 'annotation-zindex'
                });
            }
        }

        // Computed Z-Index (effective value)
        if (this.settings.showComputedZIndex && zIndexInfo) {
            const computedZ = zIndexInfo.computedZIndex;
            if (computedZ !== parseInt(computedStyle.zIndex) || computedStyle.zIndex === 'auto') {
                annotations.push({
                    type: 'computed-z-index',
                    value: computedZ,
                    label: `cz:${computedZ}`,
                    className: 'annotation-computed-zindex'
                });
            }
        }

        // Z-Index Layer
        if (this.settings.showZIndexLayer && zIndexInfo) {
            const layer = zIndexInfo.layer;
            if (layer && layer !== 'BASE') {
                annotations.push({
                    type: 'z-layer',
                    value: layer,
                    label: layer.toLowerCase(),
                    className: `annotation-layer annotation-layer-${layer.toLowerCase()}`
                });
            }
        }

        // Stacking Context
        if (this.settings.showStackingContext && zIndexInfo?.stackingContext?.isStackingContext) {
            const reasons = zIndexInfo.stackingContext.reasons;
            annotations.push({
                type: 'stacking-context',
                value: reasons,
                label: 'SC',
                title: `Stacking Context: ${reasons.join(', ')}`,
                className: 'annotation-stacking-context'
            });
        }

        return annotations;
    }

    /**
     * Format annotations for display
     */
    formatAnnotationsForDisplay(annotations, mode = null) {
        if (!annotations.length) return '';

        const displayMode = mode || this.settings.annotationMode;

        switch (displayMode) {
            case 'minimal':
                // Show only the most important annotation
                const important = annotations.find(a => a.type === 'stacking-context') || annotations[0];
                return important ? `<span class="${important.className}" title="${important.title || ''}">${important.label}</span>` : '';
                
            case 'detailed':
                // Show all annotations with full labels
                return annotations.map(a => 
                    `<span class="${a.className}" title="${a.title || a.type}: ${a.value}">${a.label}</span>`
                ).join(' ');
                
            case 'compact':
            default:
                // Show key annotations in compact form
                return annotations.slice(0, 3).map(a => 
                    `<span class="${a.className}" title="${a.title || a.value}">${a.label}</span>`
                ).join(' ');
        }
    }

    /**
     * Check if element creates a stacking context
     */
    isStackingContext(element, computedStyle = null) {
        const style = computedStyle || window.getComputedStyle(element);
        
        if (style.position !== 'static' && style.zIndex !== 'auto') return true;
        if (style.opacity !== '1') return true;
        if (style.transform !== 'none') return true;
        if (style.filter !== 'none') return true;
        if (style.isolation === 'isolate') return true;
        if (style.mixBlendMode !== 'normal') return true;
        if (style.contain === 'layout' || style.contain === 'paint' || 
            style.contain.includes('layout') || style.contain.includes('paint')) return true;
        
        return false;
    }

    /**
     * Get effective z-index for an element
     */
    getEffectiveZIndex(element) {
        let current = element;
        let effectiveZ = null;
        
        while (current && current !== document.documentElement) {
            const style = window.getComputedStyle(current);
            const zIndex = style.zIndex;
            
            if (zIndex !== 'auto') {
                const numericZ = parseInt(zIndex, 10);
                if (!isNaN(numericZ)) {
                    effectiveZ = numericZ;
                }
            }
            
            if (this.isStackingContext(current, style) && current !== element) {
                break;
            }
            
            current = current.parentElement;
        }
        
        return effectiveZ;
    }

    /**
     * Create element identifier for breadcrumbs
     */
    createElementIdentifier(element) {
        if (element.id) {
            return `#${element.id}`;
        }
        return '';
    }

    /**
     * Clean up resources
     */
    destroy() {
        // Nothing specific to clean up for now
    }
} 