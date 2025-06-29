/**
 * BreadcrumbManager.js - Manages breadcrumb trail navigation
 * Handles breadcrumb creation, navigation, and active state management
 */

export class BreadcrumbManager {
    constructor() {
        this.currentBreadcrumbTrail = null;
        this.activeBreadcrumbIndex = -1;
    }

    /**
     * Create enhanced breadcrumb trail
     */
    createEnhancedBreadcrumbTrail(element) {
        const container = document.createElement('div');
        container.className = 'enhanced-breadcrumb-trail';

        if (!element) return container;

        const trail = [];
        let current = element;
        while (current && current.tagName?.toLowerCase() !== 'html') {
            trail.unshift(current);
            current = current.parentElement;
        }
        if (current && current.tagName?.toLowerCase() === 'html') {
            trail.unshift(current);
        }

        this.currentBreadcrumbTrail = trail;
        this.activeBreadcrumbIndex = trail.length - 1;

        for (let i = 0; i < this.currentBreadcrumbTrail.length; i++) {
            const el = this.currentBreadcrumbTrail[i];
            const link = document.createElement('a');
            link.href = '#';
            link.className = 'breadcrumb-link';
            link.classList.toggle('active', i === this.activeBreadcrumbIndex);

            // Create tag name span (bold)
            const tagSpan = document.createElement('span');
            tagSpan.className = 'breadcrumb-tag';
            tagSpan.textContent = el.tagName.toLowerCase();
            link.appendChild(tagSpan);

            // Create identifier span (normal weight)
            const identifier = this.createElementIdentifier(el);
            if (identifier) {
                const identifierSpan = document.createElement('span');
                identifierSpan.className = 'breadcrumb-identifier';
                identifierSpan.textContent = identifier;
                link.appendChild(identifierSpan);
            }

            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.onBreadcrumbClick?.(i);
            });
            
            container.appendChild(link);

            // Add separator except for last item
            if (i < this.currentBreadcrumbTrail.length - 1) {
                const separator = document.createElement('span');
                separator.className = 'breadcrumb-separator';
                separator.textContent = '>';
                container.appendChild(separator);
            }
        }

        return container;
    }

    /**
     * Create element identifier for breadcrumbs (ID and classes)
     */
    createElementIdentifier(element) {
        let identifier = '';
        
        if (element.id) {
            identifier += `#${element.id}`;
        }
        
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                // Show first 2 classes, indicate if there are more
                const displayClasses = classes.slice(0, 2);
                identifier += `.${displayClasses.join('.')}`;
                if (classes.length > 2) {
                    identifier += ` (+${classes.length - 2})`;
                }
            }
        } else if (element.className && element.className.toString) {
            // Handle DOMTokenList case
            const classes = element.className.toString().split(' ').filter(c => c.trim());
            if (classes.length > 0) {
                const displayClasses = classes.slice(0, 2);
                identifier += `.${displayClasses.join('.')}`;
                if (classes.length > 2) {
                    identifier += ` (+${classes.length - 2})`;
                }
            }
        }
        
        return identifier;
    }

    /**
     * Navigate to a breadcrumb element by index
     */
    navigateToBreadcrumbElement(index) {
        if (this.currentBreadcrumbTrail && this.currentBreadcrumbTrail[index]) {
            const targetElement = this.currentBreadcrumbTrail[index];
            
            // Update cursor position
            this.activeBreadcrumbIndex = index;
            this.updateBreadcrumbActiveState();
            
            // Notify parent component
            this.onNavigate?.(targetElement, index);
            
            console.log('BreadcrumbManager: Navigated to breadcrumb index', index);
            return targetElement;
        }
        return null;
    }

    /**
     * Update breadcrumb active state without rebuilding
     */
    updateBreadcrumbActiveState() {
        // Find breadcrumb trail in DOM
        const breadcrumbTrail = document.querySelector('.enhanced-breadcrumb-trail');
        if (!breadcrumbTrail) return;
        
        const links = breadcrumbTrail.querySelectorAll('.breadcrumb-link');
        links.forEach((link, i) => {
            link.classList.toggle('active', i === this.activeBreadcrumbIndex);
        });
        
        console.log('BreadcrumbManager: Updated active state to index', this.activeBreadcrumbIndex);
    }

    /**
     * Update active breadcrumb based on element
     */
    updateActiveBreadcrumb(newActiveElement) {
        if (!this.currentBreadcrumbTrail) return;
        
        const newIndex = this.currentBreadcrumbTrail.indexOf(newActiveElement);
        if (newIndex === -1) return;

        this.activeBreadcrumbIndex = newIndex;
        this.updateBreadcrumbActiveState();
        
        console.log('BreadcrumbManager: Updated active breadcrumb to index', this.activeBreadcrumbIndex);
    }

    /**
     * Set callbacks for breadcrumb interactions
     */
    setCallbacks({ onBreadcrumbClick, onNavigate }) {
        this.onBreadcrumbClick = onBreadcrumbClick;
        this.onNavigate = onNavigate;
    }

    /**
     * Get current breadcrumb trail
     */
    getCurrentTrail() {
        return this.currentBreadcrumbTrail;
    }

    /**
     * Get active breadcrumb index
     */
    getActiveIndex() {
        return this.activeBreadcrumbIndex;
    }
} 