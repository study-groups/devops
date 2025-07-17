/**
 * client/dom-inspector/managers/TreeManager.js
 * Manages DOM tree building, state preservation, and navigation
 */

export class TreeManager {
    constructor(elementManager, annotationManager) {
        this.elementManager = elementManager;
        this.annotationManager = annotationManager;
        this.treeContainer = null;
        
        // Tree state for preserving expanded nodes
        this.treeState = {
            expandedNodes: new Set(), // Store element IDs of expanded nodes
            selectedElementId: null,
            scrollPosition: 0
        };
    }

    /**
     * Set the tree container element
     */
    setTreeContainer(container) {
        this.treeContainer = container;
    }

    /**
     * Build the complete DOM tree
     */
    buildTree(callbacks = {}) {
        if (!this.treeContainer) {
            console.error('DOM Inspector: No tree container available for building tree');
            return;
        }

        console.log('DOM Inspector: Building tree...');
        console.log('DOM Inspector: Callbacks received:', Object.keys(callbacks));
        
        // Preserve current tree state before clearing
        this.preserveTreeState();
        
        // Clear existing tree
        this.treeContainer.innerHTML = '';
        
        // Start from document.body
        const rootElement = document.body;
        if (!rootElement) {
            console.error('DOM Inspector: No body element found');
            return;
        }
        
        console.log('DOM Inspector: Creating tree from body element');
        const rootNode = this.createFullNodeTree(rootElement, callbacks);
        
        if (rootNode) {
            this.treeContainer.appendChild(rootNode);
            console.log('DOM Inspector: Tree built successfully, root node added');
            
            // Test if event handlers are working
            const firstToggle = this.treeContainer.querySelector('.dom-inspector-node-toggle');
            if (firstToggle) {
                console.log('DOM Inspector: First toggle button found:', firstToggle);
            } else {
                console.warn('DOM Inspector: No toggle buttons found in tree');
            }
            
            const firstHeader = this.treeContainer.querySelector('.dom-inspector-node-header');
            if (firstHeader) {
                console.log('DOM Inspector: First header found:', firstHeader);
            } else {
                console.warn('DOM Inspector: No headers found in tree');
            }
            
            // Auto-restore tree state after a short delay to allow DOM to settle
            setTimeout(() => {
                this.restoreTreeState();
            }, 20);
            
        } else {
            console.error('DOM Inspector: Failed to create root node');
        }
        
        console.log('DOM Inspector: Complete tree built successfully');
    }

    /**
     * Create a full node tree recursively
     */
    createFullNodeTree(element, callbacks = {}) {
        if (!element || !element.tagName) {
            return null;
        }

        const node = document.createElement('div');
        node.className = 'dom-inspector-node'; // All nodes start collapsed
        
        const elementId = this.elementManager.cacheElement(element);
        const nodeId = this.elementManager.generateElementId(element);
        node.dataset.elementId = elementId;
        node.dataset.nodeId = nodeId;

        const header = document.createElement('div');
        header.className = 'dom-inspector-node-header';

        // Create toggle button
        const toggle = document.createElement('span');
        toggle.className = 'dom-inspector-node-toggle';
        if (element.children.length > 0) {
            toggle.textContent = '▶';
        } else {
            toggle.style.visibility = 'hidden';
        }
        header.appendChild(toggle);

        // Create icon element
        const icon = document.createElement('span');
        icon.className = `icon icon-${element.tagName.toLowerCase()}`;
        header.appendChild(icon);

        // Create name element
        const name = document.createElement('span');
        name.className = 'dom-inspector-node-name';
        name.textContent = `<${element.tagName.toLowerCase()}>`;
        header.appendChild(name);

        header.addEventListener('click', (e) => {
            if (e.target === toggle) {
                if (element.children.length > 0 && callbacks.onToggleNode) {
                    callbacks.onToggleNode(node);
                }
            } else {
                if (callbacks.onElementClick) {
                    callbacks.onElementClick(element);
                }
            }
        });

        // Add annotations if available
        if (this.annotationManager) {
            const annotations = this.annotationManager.getElementAnnotations(element);
            if (annotations.length > 0) {
                const annotationContainer = document.createElement('span');
                annotationContainer.className = 'dom-inspector-node-annotations';
                annotationContainer.innerHTML = this.annotationManager.formatAnnotationsForDisplay(annotations);
                header.appendChild(annotationContainer);
            }
        }

        node.appendChild(header);

        // Pre-create children but keep them hidden
        if (element.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'dom-inspector-node-children';
            childrenContainer.style.display = 'none'; // Hidden by default
            
            for (const child of element.children) {
                const childNode = this.createFullNodeTree(child, callbacks);
                if (childNode) {
                    childrenContainer.appendChild(childNode);
                }
            }
            node.appendChild(childrenContainer);
        }

        return node;
    }

    /**
     * Toggle a tree node's expanded state
     */
    toggleNode(node) {
        node.classList.toggle('expanded');
        const isExpanded = node.classList.contains('expanded');
        const toggle = node.querySelector('.dom-inspector-node-toggle');
        const childrenContainer = node.querySelector('.dom-inspector-node-children');

        if (toggle) {
            toggle.textContent = isExpanded ? '▼' : '▶';
        }

        if (childrenContainer) {
            childrenContainer.style.display = isExpanded ? 'block' : 'none';
        }
    }

    /**
     * Find the tree node for a given element
     */
    findTreeNodeForElement(element) {
        if (!this.treeContainer) return null;
        
        const allNodes = this.treeContainer.querySelectorAll('.dom-inspector-node');
        for (const node of allNodes) {
            if (this.elementManager.getElementFromCache(node.dataset.elementId) === element) {
                return node;
            }
        }
        return null;
    }

    /**
     * Expand all parents to make a node visible
     */
    expandParentsToNode(targetNode) {
        console.log('DOM Inspector: Expanding parents for node:', targetNode);
        if (!targetNode) {
            console.warn('DOM Inspector: No target node provided to expandParentsToNode');
            return;
        }

        const nodesToExpand = [];
        let currentNode = targetNode;
        
        // Walk up the DOM tree to find all parent nodes that need to be expanded
        while (currentNode && !currentNode.classList.contains('dom-inspector-tree')) {
            const parentContainer = currentNode.parentElement;
            
            if (parentContainer && parentContainer.classList.contains('dom-inspector-node-children')) {
                // We're in a children container, get the parent node
                const parentNode = parentContainer.parentElement;
                if (parentNode && parentNode.classList.contains('dom-inspector-node')) {
                    nodesToExpand.unshift(parentNode); // Add to beginning to expand from root down
                    currentNode = parentNode;
                } else {
                    break;
                }
            } else if (parentContainer && parentContainer.classList.contains('dom-inspector-tree')) {
                // We've reached the root tree container
                break;
            } else {
                // Try to find the next parent node
                const nextParent = currentNode.parentElement?.closest('.dom-inspector-node');
                if (nextParent && nextParent !== currentNode) {
                    nodesToExpand.unshift(nextParent);
                    currentNode = nextParent;
                } else {
                    break;
                }
            }
        }
        
        console.log('DOM Inspector: Nodes to expand (in order):', nodesToExpand);
        
        // Expand all parent nodes from root down to target
        nodesToExpand.forEach(node => {
            if (!node.classList.contains('expanded')) {
                console.log('DOM Inspector: Expanding node:', node);
                this.toggleNode(node);
            }
        });
        
        // Ensure the target node is visible after expansion
        setTimeout(() => {
            if (targetNode.offsetParent !== null) { // Check if visible
                targetNode.scrollIntoView({ 
                    block: 'center', 
                    behavior: 'smooth',
                    inline: 'nearest'
                });
            }
        }, 100); // Small delay to allow DOM updates
    }

    /**
     * Ensure an element is represented in the tree
     */
    ensureElementInTree(element) {
        // Check if element is already in tree
        if (this.findTreeNodeForElement(element)) {
            return; // Already in tree
        }
        
        console.log('DOM Inspector: Element not found in tree, ensuring it\'s included...');
        
        // Check if element is a descendant of the current root
        const currentRoot = this.treeContainer.querySelector('.dom-inspector-node');
        if (currentRoot) {
            const rootElement = this.elementManager.getElementFromCache(currentRoot.dataset.elementId);
            if (rootElement && rootElement.contains(element)) {
                // Element is within current tree, we just need to expand parents
                this.expandTreeToIncludeElement(element);
                return;
            }
        }
        
        // If element is not in current tree scope, we may need to rebuild
        console.log('DOM Inspector: Rebuilding tree to include target element');
        this.buildTree();
    }

    /**
     * Expand tree to include a specific element by building missing branches
     */
    expandTreeToIncludeElement(element) {
        // Find the path from current tree root to the target element
        const path = [];
        let current = element;
        
        // Build path from element up to a node that exists in the tree
        while (current && current !== document.documentElement) {
            path.unshift(current);
            current = current.parentElement;
            
            // Check if this parent is already in the tree
            if (this.findTreeNodeForElement(current)) {
                break;
            }
        }
        
        // Now expand each level in the path
        for (let i = 0; i < path.length - 1; i++) {
            const parentElement = path[i];
            const parentNode = this.findTreeNodeForElement(parentElement);
            
            if (parentNode && !parentNode.classList.contains('expanded')) {
                this.toggleNode(parentNode);
            }
        }
    }

    /**
     * Expand tree to show a specific element
     */
    expandTreeToElement(element) {
        console.log('DOM Inspector: Expanding tree to element:', element);
        
        // First ensure the element is in the tree
        this.ensureElementInTree(element);
        
        // Find the tree node for this element and expand parents
        const targetNode = this.findTreeNodeForElement(element);
        if (targetNode) {
            this.expandParentsToNode(targetNode);
        } else {
            console.warn('DOM Inspector: Could not find element in tree after ensuring inclusion');
            // Last resort: rebuild tree and try again
            this.buildTree();
            setTimeout(() => {
                const retryNode = this.findTreeNodeForElement(element);
                if (retryNode) {
                    this.expandParentsToNode(retryNode);
                } else {
                    console.error('DOM Inspector: Still cannot find element in tree after rebuild');
                }
            }, 100);
        }
    }

    /**
     * Preserve current tree state
     */
    preserveTreeState() {
        if (!this.treeContainer) return;
        
        // Save current expanded state
        const expandedNodes = this.treeContainer.querySelectorAll('.dom-inspector-node.expanded');
        this.treeState.expandedNodes.clear();
        
        expandedNodes.forEach(node => {
            const elementId = node.dataset.elementId;
            if (elementId) {
                this.treeState.expandedNodes.add(elementId);
            }
        });
        
        // Save scroll position
        this.treeState.scrollPosition = this.treeContainer.scrollTop;
        
        console.log('DOM Inspector: Preserved tree state:', {
            expanded: this.treeState.expandedNodes.size,
            scrollPosition: this.treeState.scrollPosition
        });
    }

    /**
     * Restore tree state
     */
    restoreTreeState() {
        if (!this.treeContainer) return;
        
        console.log('DOM Inspector: Restoring tree state with', this.treeState.expandedNodes.size, 'expanded nodes');
        
        // Restore expanded nodes
        this.treeState.expandedNodes.forEach(elementId => {
            const node = this.treeContainer.querySelector(`[data-element-id="${elementId}"]`);
            if (node && !node.classList.contains('expanded')) {
                console.log('DOM Inspector: Restoring expanded state for node:', node);
                this.toggleNode(node);
            }
        });
        
        // Restore scroll position
        if (this.treeState.scrollPosition) {
            this.treeContainer.scrollTop = this.treeState.scrollPosition;
        }
        
        console.log('DOM Inspector: Restored tree state');
    }

    /**
     * Ensure tree is expanded to show current selection
     */
    ensureTreeOpen() {
        const selectedElement = this.elementManager.getSelectedElement();
        if (selectedElement) {
            this.expandTreeToElement(selectedElement);
        }
    }

    /**
     * Update tree annotations without rebuilding
     */
    updateTreeAnnotations() {
        if (!this.treeContainer || !this.annotationManager) return;
        
        const allNodes = this.treeContainer.querySelectorAll('.dom-inspector-node');
        
        allNodes.forEach(node => {
            const elementId = node.dataset.elementId;
            const element = this.elementManager.getElementFromCache(elementId);
            
            if (element) {
                // Find existing annotation container or create one
                let annotationContainer = node.querySelector('.dom-inspector-node-annotations');
                const header = node.querySelector('.dom-inspector-node-header');
                
                // Get current annotations
                const annotations = this.annotationManager.getElementAnnotations(element);
                
                if (annotations.length > 0) {
                    if (!annotationContainer) {
                        annotationContainer = document.createElement('span');
                        annotationContainer.className = 'dom-inspector-node-annotations';
                        header.appendChild(annotationContainer);
                    }
                    annotationContainer.innerHTML = this.annotationManager.formatAnnotationsForDisplay(annotations);
                } else if (annotationContainer) {
                    // Remove annotation container if no annotations
                    annotationContainer.remove();
                }
            }
        });
        
        console.log('DOM Inspector: Updated tree annotations without rebuilding');
    }

    /**
     * Get tree state for persistence
     */
    getTreeState() {
        return {
            expandedNodes: Array.from(this.treeState.expandedNodes),
            selectedElementId: this.treeState.selectedElementId,
            scrollPosition: this.treeState.scrollPosition
        };
    }

    /**
     * Set tree state from persistence
     */
    setTreeState(state) {
        if (state) {
            this.treeState.expandedNodes = new Set(state.expandedNodes || []);
            this.treeState.selectedElementId = state.selectedElementId || null;
            this.treeState.scrollPosition = state.scrollPosition || 0;
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.treeContainer = null;
        this.treeState.expandedNodes.clear();
        this.treeState.selectedElementId = null;
        this.treeState.scrollPosition = 0;
    }
} 