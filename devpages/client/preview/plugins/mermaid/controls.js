/**
 * Mermaid Controls Module
 * 
 * Handles zoom controls, hamburger menu, and interactive controls
 */

export class MermaidControls {
    constructor() {
        this.activeListeners = [];
        this._globalPanHandlersSetup = false;
        this.resizeEnabled = false;   // Tracks if resize is enabled after first hamburger click
        this.firstHamburgerClick = false; // Tracks if hamburger has been clicked once
    }

    async init() {
        this._setupGlobalPanHandlers();
    }

    setupZoomControls(mermaidContainer, svgElement) {
        // Ensure container is styled for positioning and overflow
        mermaidContainer.style.position = 'relative';
        mermaidContainer.style.overflow = 'hidden';
        mermaidContainer.style.minWidth = '300px';
        mermaidContainer.style.minHeight = '200px';
        
        // Set explicit initial dimensions so resize will work
        if (!mermaidContainer.style.width) {
            const rect = mermaidContainer.getBoundingClientRect();
            mermaidContainer.style.width = Math.max(rect.width, 800) + 'px';
            mermaidContainer.style.height = Math.max(rect.height, 400) + 'px';
            mermaidContainer.style.boxSizing = 'border-box';
            mermaidContainer.style.display = 'block';
            console.log('[MERMAID CONTROLS DEBUG] Set initial container size:', 
                mermaidContainer.style.width, 'x', mermaidContainer.style.height);
        }
        
        // Ensure SVG is styled for transformation
        svgElement.style.display = 'block'; 
        svgElement.style.transformOrigin = 'center center';
        svgElement.style.cursor = 'grab';

        // Initialize transform state for this SVG
        const svgState = {
            scale: 1,
            panX: 0,
            panY: 0
        };
        
        // Store the state on the SVG for global handlers
        svgElement._mermaidState = svgState;
        
        // Apply transform function
        const applyTransform = () => {
            const transformString = `translate(${svgState.panX}px, ${svgState.panY}px) scale(${svgState.scale})`;
            svgElement.style.transform = transformString;
            console.log('[MERMAID CONTROLS DEBUG] Transform applied:', transformString);
        };
        
        // Store apply transform function for external access
        svgElement._applyTransform = applyTransform;
        
        // Setup wheel zoom
        this._setupWheelZoom(mermaidContainer, svgElement, svgState, applyTransform);
        
        // Setup mouse pan
        this._setupMousePan(svgElement, svgState, applyTransform);
        
        // Setup resize handles (initially disabled)
        this._setupResizeHandles(mermaidContainer, svgElement);
    }

    setupHamburgerMenu(mermaidContainer, svgElement, callbacks = {}) {
        console.log('[MERMAID CONTROLS DEBUG] Setting up hamburger menu');
        // Remove any pre-existing controls
        const oldControls = mermaidContainer.querySelector('.mermaid-controls-container');
        if (oldControls) {
            oldControls.remove();
        }

        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'mermaid-controls-container'; 

        const hamburgerButton = document.createElement('button');
        hamburgerButton.innerHTML = '☰'; 
        hamburgerButton.title = 'Menu';
        hamburgerButton.className = 'mermaid-hamburger-button';
        hamburgerButton.style.opacity = '0';
        hamburgerButton.style.transition = 'opacity 0.2s ease';

        const dropdownMenu = document.createElement('div');
        dropdownMenu.className = 'mermaid-dropdown-menu';
        dropdownMenu.style.display = 'none';

        // Fullscreen menu item (first option)
        const fullscreenButton = document.createElement('button');
        fullscreenButton.textContent = 'Fullscreen';
        fullscreenButton.className = 'mermaid-dropdown-item';
        fullscreenButton.addEventListener('click', () => {
            if (callbacks.onFullscreen) {
                callbacks.onFullscreen();
            }
            this._hideDropdown(dropdownMenu);
        });

        // Reset Zoom menu item
        const resetButton = document.createElement('button');
        resetButton.textContent = 'Reset Zoom';
        resetButton.className = 'mermaid-dropdown-item';
        resetButton.addEventListener('click', () => {
            this._resetZoom(svgElement);
            this._hideDropdown(dropdownMenu);
        });

        // Export menu item
        const exportButton = document.createElement('button');
        exportButton.textContent = 'Export SVG';
        exportButton.className = 'mermaid-dropdown-item';
        exportButton.addEventListener('click', () => {
            this._exportSVG(svgElement);
            this._hideDropdown(dropdownMenu);
        });

        // Build dropdown
        dropdownMenu.appendChild(fullscreenButton);
        dropdownMenu.appendChild(resetButton);
        dropdownMenu.appendChild(exportButton);
        
        controlsContainer.appendChild(hamburgerButton);
        controlsContainer.appendChild(dropdownMenu);
        
        // Setup hamburger button click handler
        hamburgerButton.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Enable resize mode after first hamburger click
            if (!this.firstHamburgerClick) {
                console.log('[MERMAID CONTROLS DEBUG] First hamburger click - enabling resize mode');
                this.firstHamburgerClick = true;
                this.resizeEnabled = true;
                this._showResizeHandles(mermaidContainer, true);
            }
            
            this._toggleDropdown(dropdownMenu);
        });

        // Show hamburger on container hover
        mermaidContainer.addEventListener('mouseenter', () => {
            hamburgerButton.style.opacity = '1';
        });
        
        mermaidContainer.addEventListener('mouseleave', () => {
            if (dropdownMenu.style.display !== 'block') {
                hamburgerButton.style.opacity = '0';
            }
        });

        // Hide dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!controlsContainer.contains(e.target)) {
                this._hideDropdown(dropdownMenu);
                // Also hide hamburger if not hovering
                if (!mermaidContainer.matches(':hover')) {
                    hamburgerButton.style.opacity = '0';
                }
            }
        });
        
        mermaidContainer.appendChild(controlsContainer);
        console.log('[MERMAID CONTROLS DEBUG] Hamburger menu added to container:', controlsContainer);
    }

    _toggleDropdown(dropdownMenu) {
        const isVisible = dropdownMenu.style.display === 'block';
        dropdownMenu.style.display = isVisible ? 'none' : 'block';
    }

    _hideDropdown(dropdownMenu) {
        dropdownMenu.style.display = 'none';
    }



    _resetZoom(svgElement) {
        if (svgElement._mermaidState) {
            svgElement._mermaidState.scale = 1;
            svgElement._mermaidState.panX = 0;
            svgElement._mermaidState.panY = 0;
            
            if (svgElement._applyTransform) {
                svgElement._applyTransform();
            }
        }
    }

    _exportSVG(svgElement) {
        const svgData = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'mermaid-diagram.svg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    _setupWheelZoom(mermaidContainer, svgElement, svgState, applyTransform) {
        const wheelListener = (event) => {
            if (!event.ctrlKey && !event.metaKey) return;
            
            event.preventDefault();
            event.stopPropagation();
            
            const rect = mermaidContainer.getBoundingClientRect();
            const mouseXInContainer = event.clientX - rect.left;
            const mouseYInContainer = event.clientY - rect.top;
            
            const oldScale = svgState.scale;
            const dir = event.deltaY < 0 ? 1 : -1;
            svgState.scale += dir * 0.1 * svgState.scale;
            svgState.scale = Math.max(0.2, Math.min(svgState.scale, 5));
            
            // Zoom toward mouse position
            const mouseRelToSVGCenterX = mouseXInContainer - (mermaidContainer.clientWidth / 2) - svgState.panX;
            const mouseRelToSVGCenterY = mouseYInContainer - (mermaidContainer.clientHeight / 2) - svgState.panY;
            
            svgState.panX -= mouseRelToSVGCenterX * (svgState.scale / oldScale - 1);
            svgState.panY -= mouseRelToSVGCenterY * (svgState.scale / oldScale - 1);
            
            applyTransform();
        };

        mermaidContainer.addEventListener('wheel', wheelListener, { passive: false, capture: true });
        mermaidContainer._mermaidWheelListener = wheelListener;
    }

    _setupMousePan(svgElement, svgState, applyTransform) {
        const mouseDownListener = (event) => {
            // Don't pan if clicking on a resize handle or if resize is in progress
            if (event.target.classList.contains('mermaid-resize-handle') || 
                window._mermaidResizeInProgress) {
                console.log('[MERMAID CONTROLS DEBUG] Skipping pan - resize handle or resize in progress');
                return;
            }
            
            console.log('[MERMAID CONTROLS DEBUG] Mouse down on SVG - starting pan');
            if (event.button !== 0) return; // Only left click
            
            event.preventDefault();
            event.stopPropagation();
            
            // Set global pan tracking state using window variables
            window._mermaidActivePanSvg = svgElement;
            window._mermaidPanData = {
                lastX: event.clientX,
                lastY: event.clientY,
                currentPanX: svgState.panX,
                currentPanY: svgState.panY,
                currentScale: svgState.scale
            };
            
            svgElement.style.cursor = 'grabbing';
            console.log('[MERMAID CONTROLS DEBUG] Pan state initialized:', { 
                panX: svgState.panX, 
                panY: svgState.panY,
                scale: svgState.scale 
            });
            console.log('[MERMAID CONTROLS DEBUG] Active pan SVG set to:', window._mermaidActivePanSvg);
            console.log('[MERMAID CONTROLS DEBUG] Mouse position:', { x: event.clientX, y: event.clientY });
        };

        // Try multiple event attachment strategies
        svgElement.addEventListener('mousedown', mouseDownListener, { capture: true });
        svgElement.addEventListener('mousedown', mouseDownListener, { passive: false });
        
        // Also try on the container
        const container = svgElement.closest('.mermaid');
        if (container) {
            container.addEventListener('mousedown', mouseDownListener, { capture: true });
        }
        
        svgElement._mermaidMouseDownListener = mouseDownListener;
        // Add a test click listener to see if ANY events reach the SVG
        const testClickListener = (event) => {
            console.log('[MERMAID CONTROLS DEBUG] *** TEST: Click detected on SVG! ***', event);
        };
        svgElement.addEventListener('click', testClickListener, { capture: true });
        
        console.log('[MERMAID CONTROLS DEBUG] Mouse pan setup for SVG:', svgElement);
        console.log('[MERMAID CONTROLS DEBUG] Container for pan:', container);
    }

    _setupGlobalPanHandlers() {
        // Use a static class variable to ensure only one global handler is set up
        if (MermaidControls._globalHandlersSetup) {
            console.log('[MERMAID CONTROLS DEBUG] Global pan handlers already setup (static)');
            return;
        }
        
        console.log('[MERMAID CONTROLS DEBUG] Setting up global pan handlers (static)');
        
        // Create a global registry for active panning
        if (!window._mermaidActivePanSvg) {
            window._mermaidActivePanSvg = null;
            window._mermaidPanData = {};
        }
        
        const globalMouseMoveHandler = (event) => {
            if (!window._mermaidActivePanSvg) return;
            
            console.log('[MERMAID CONTROLS DEBUG] *** GLOBAL MOUSEMOVE WORKING ***');
            
            const panData = window._mermaidPanData;
            const deltaX = event.clientX - panData.lastX;
            const deltaY = event.clientY - panData.lastY;
            
            const svgState = window._mermaidActivePanSvg._mermaidState;
            if (svgState) {
                svgState.panX = panData.currentPanX + deltaX;
                svgState.panY = panData.currentPanY + deltaY;
                
                console.log('[MERMAID CONTROLS DEBUG] Panning - new position:', { 
                    panX: svgState.panX, 
                    panY: svgState.panY,
                    deltaX, deltaY 
                });
                
                if (window._mermaidActivePanSvg._applyTransform) {
                    window._mermaidActivePanSvg._applyTransform();
                    console.log('[MERMAID CONTROLS DEBUG] Applied transform');
                }
            }
        };

        const globalMouseUpHandler = () => {
            if (window._mermaidActivePanSvg) {
                console.log('[MERMAID CONTROLS DEBUG] Global mouse up - ending pan');
                window._mermaidActivePanSvg.style.cursor = 'grab';
                window._mermaidActivePanSvg = null;
                window._mermaidPanData = {};
            }
        };
        
        window.addEventListener('mousemove', globalMouseMoveHandler, { passive: false });
        window.addEventListener('mouseup', globalMouseUpHandler);
        
        MermaidControls._globalHandlersSetup = true;
        console.log('[MERMAID CONTROLS DEBUG] Global pan handlers setup complete (static)');
    }

    _setupResizeHandles(mermaidContainer, svgElement) {
        console.log('[MERMAID CONTROLS DEBUG] Setting up resize handles');
        
        // Remove existing resize handles if any
        const existingHandles = mermaidContainer.querySelectorAll('.mermaid-resize-handle');
        existingHandles.forEach(handle => handle.remove());
        
        // Create resize handles for corners and edges
        const handles = [
            { position: 'se', cursor: 'se-resize' }, // bottom-right corner
            { position: 's', cursor: 's-resize' },   // bottom edge
            { position: 'e', cursor: 'e-resize' },   // right edge
            { position: 'sw', cursor: 'sw-resize' }, // bottom-left corner
            { position: 'ne', cursor: 'ne-resize' }, // top-right corner
            { position: 'n', cursor: 'n-resize' },   // top edge
            { position: 'w', cursor: 'w-resize' },   // left edge
            { position: 'nw', cursor: 'nw-resize' }  // top-left corner
        ];
        
        handles.forEach(handleConfig => {
            const handle = document.createElement('div');
            handle.className = `mermaid-resize-handle mermaid-resize-${handleConfig.position}`;
            handle.style.cssText = this._getResizeHandleStyles(handleConfig.position);
            handle.style.cursor = handleConfig.cursor;
            
            // Add resize event listeners
            this._addResizeListeners(handle, mermaidContainer, handleConfig.position, svgElement);
            
            mermaidContainer.appendChild(handle);
        });
        
        console.log('[MERMAID CONTROLS DEBUG] All 8 resize handles added to container');
    }
    
    _getResizeHandleStyles(position) {
        const baseStyles = `
            position: absolute;
            background: #007acc;
            opacity: 0;
            transition: opacity 0.2s ease;
            z-index: 1001;
            pointer-events: none;
        `;
        
        const cornerSize = '12px';
        const edgeSize = '6px';
        
        switch (position) {
            case 'se': // bottom-right
                return baseStyles + `
                    bottom: -6px; right: -6px;
                    width: ${cornerSize}; height: ${cornerSize};
                    border-radius: 0 0 8px 0;
                `;
            case 's': // bottom
                return baseStyles + `
                    bottom: -3px; left: 20px; right: 20px;
                    height: ${edgeSize};
                `;
            case 'e': // right
                return baseStyles + `
                    right: -3px; top: 20px; bottom: 20px;
                    width: ${edgeSize};
                `;
            case 'sw': // bottom-left
                return baseStyles + `
                    bottom: -6px; left: -6px;
                    width: ${cornerSize}; height: ${cornerSize};
                    border-radius: 0 0 0 8px;
                `;
            case 'ne': // top-right
                return baseStyles + `
                    top: -6px; right: -6px;
                    width: ${cornerSize}; height: ${cornerSize};
                    border-radius: 0 8px 0 0;
                `;
            case 'n': // top
                return baseStyles + `
                    top: -3px; left: 20px; right: 20px;
                    height: ${edgeSize};
                `;
            case 'w': // left
                return baseStyles + `
                    left: -3px; top: 20px; bottom: 20px;
                    width: ${edgeSize};
                `;
            case 'nw': // top-left
                return baseStyles + `
                    top: -6px; left: -6px;
                    width: ${cornerSize}; height: ${cornerSize};
                    border-radius: 8px 0 0 0;
                `;
            default:
                return baseStyles;
        }
    }
    
    _addResizeListeners(handle, container, position, svgElement) {
        // Note: Handle visibility is now controlled by _showResizeHandles method
        
        // Handle resize drag with high priority event capture
        handle.addEventListener('mousedown', (e) => {
            // Only allow resize if interactive mode is enabled
            if (!this.resizeEnabled) {
                return;
            }
            
            console.log('[MERMAID CONTROLS DEBUG] Starting resize:', position);
            
            // Set global flag to prevent panning during resize
            window._mermaidResizeInProgress = true;
            
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Prevent any other mousedown handlers
            
            const startX = e.clientX;
            const startY = e.clientY;
            const startWidth = container.offsetWidth;
            const startHeight = container.offsetHeight;
            const containerRect = container.getBoundingClientRect();
            
            const resizeData = {
                startX, startY, startWidth, startHeight,
                containerRect, position
            };
            
            // Global resize handlers
            const globalResizeMove = (moveEvent) => {
                this._handleResize(moveEvent, container, resizeData, svgElement);
            };
            
            const globalResizeEnd = () => {
                console.log('[MERMAID CONTROLS DEBUG] Resize ended');
                
                // Clear global resize flag
                window._mermaidResizeInProgress = false;
                
                document.removeEventListener('mousemove', globalResizeMove);
                document.removeEventListener('mouseup', globalResizeEnd);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };
            
            document.addEventListener('mousemove', globalResizeMove);
            document.addEventListener('mouseup', globalResizeEnd);
            document.body.style.cursor = handle.style.cursor;
            document.body.style.userSelect = 'none';
        });
    }
    
    _handleResize(event, container, resizeData, svgElement) {
        const { startX, startY, startWidth, startHeight, position } = resizeData;
        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        
        // Calculate new dimensions based on resize direction
        if (position.includes('e')) { // east (right)
            newWidth = Math.max(300, startWidth + deltaX);
        }
        if (position.includes('w')) { // west (left)
            newWidth = Math.max(300, startWidth - deltaX);
        }
        if (position.includes('s')) { // south (bottom)
            newHeight = Math.max(200, startHeight + deltaY);
        }
        if (position.includes('n')) { // north (top)
            newHeight = Math.max(200, startHeight - deltaY);
        }
        
        // Apply new dimensions with !important to override any CSS
        container.style.setProperty('width', newWidth + 'px', 'important');
        container.style.setProperty('height', newHeight + 'px', 'important');
        
        // Debug: Check if the styles were applied
        const actualRect = container.getBoundingClientRect();
        console.log('[MERMAID CONTROLS DEBUG] Resize applied:', 
            { 
                requested: { width: newWidth, height: newHeight },
                styleSet: { width: container.style.width, height: container.style.height },
                actualSize: { width: actualRect.width, height: actualRect.height }
            });
        
        // Trigger SVG reflow if needed
        if (svgElement && svgElement._applyTransform) {
            // Small delay to allow container resize to complete
            setTimeout(() => {
                svgElement._applyTransform();
            }, 0);
        }
    }

    _showResizeHandles(container, show) {
        const handles = container.querySelectorAll('.mermaid-resize-handle');
        
        handles.forEach(handle => {
            if (show && this.resizeEnabled) {
                handle.style.opacity = '0.6'; // Subtle but visible
                handle.style.pointerEvents = 'auto';
                handle.style.background = '#007acc'; // Professional blue
            } else {
                handle.style.opacity = '0';
                handle.style.pointerEvents = 'none';
            }
        });
    }

    destroy() {
        // Clean up global event listeners
        this.activeListeners.forEach(al => {
            al.target.removeEventListener(al.type, al.listener);
        });
        this.activeListeners = [];
        
        // Clean up individual element listeners
        document.querySelectorAll('.mermaid').forEach(mermaidContainer => {
            if (mermaidContainer._mermaidWheelListener) {
                mermaidContainer.removeEventListener('wheel', mermaidContainer._mermaidWheelListener);
                delete mermaidContainer._mermaidWheelListener;
            }
            
            const svg = mermaidContainer.querySelector('svg');
            if (svg && svg._mermaidMouseDownListener) {
                svg.removeEventListener('mousedown', svg._mermaidMouseDownListener);
                delete svg._mermaidMouseDownListener;
            }
            
            const controls = mermaidContainer.querySelector('.mermaid-controls-container');
            if (controls) {
                controls.remove();
            }
            
            // Clean up resize handles
            const resizeHandles = mermaidContainer.querySelectorAll('.mermaid-resize-handle');
            resizeHandles.forEach(handle => handle.remove());
        });
    }
} 