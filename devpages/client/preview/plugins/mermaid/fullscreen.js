/**
 * Mermaid Fullscreen Module
 * 
 * Handles fullscreen functionality for mermaid diagrams
 */

export class MermaidFullscreen {
    constructor() {
        this.fullscreenElement = null;
        this.originalParent = null;
        this.originalStyles = {};
        this.isFullscreen = false;
    }

    async init() {
        // Setup escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isFullscreen) {
                this.exitFullscreen();
            }
        });
    }

    toggleFullscreen(mermaidContainer, svgElement) {
        if (this.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen(mermaidContainer, svgElement);
        }
    }

    enterFullscreen(mermaidContainer, svgElement) {
        if (this.isFullscreen) return;

        // Store original state
        this.originalParent = mermaidContainer.parentNode;
        this.originalStyles = {
            position: mermaidContainer.style.position,
            top: mermaidContainer.style.top,
            left: mermaidContainer.style.left,
            width: mermaidContainer.style.width,
            height: mermaidContainer.style.height,
            zIndex: mermaidContainer.style.zIndex,
            backgroundColor: mermaidContainer.style.backgroundColor,
            overflow: mermaidContainer.style.overflow
        };

        // Create fullscreen overlay
        const fullscreenOverlay = document.createElement('div');
        fullscreenOverlay.className = 'mermaid-fullscreen-overlay';
        fullscreenOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(2px);
        `;

        // Create close button
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.className = 'mermaid-fullscreen-close';
        closeButton.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.8);
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            font-size: 24px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            transition: background-color 0.3s ease;
        `;

        closeButton.addEventListener('click', () => {
            this.exitFullscreen();
        });

        closeButton.addEventListener('mouseenter', () => {
            closeButton.style.backgroundColor = 'rgba(255, 255, 255, 1)';
        });

        closeButton.addEventListener('mouseleave', () => {
            closeButton.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        });

        // Style the mermaid container for fullscreen
        mermaidContainer.style.cssText = `
            position: relative;
            max-width: 90vw;
            max-height: 90vh;
            background-color: white;
            border-radius: 8px;
            padding: 20px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            overflow: auto;
        `;

        // Update controls position
        const controls = mermaidContainer.querySelector('.mermaid-controls-container');
        if (controls) {
            controls.style.top = '8px';
            controls.style.right = '8px';
        }

        // Append to fullscreen overlay
        fullscreenOverlay.appendChild(closeButton);
        fullscreenOverlay.appendChild(mermaidContainer);
        document.body.appendChild(fullscreenOverlay);

        // Store references
        this.fullscreenElement = fullscreenOverlay;
        this.mermaidContainer = mermaidContainer;
        this.isFullscreen = true;

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        // Add fullscreen class for CSS targeting
        document.body.classList.add('mermaid-fullscreen-active');

        console.log('[MERMAID FULLSCREEN] Entered fullscreen mode');
    }

    exitFullscreen() {
        if (!this.isFullscreen || !this.fullscreenElement) return;

        // Restore original styles
        Object.assign(this.mermaidContainer.style, this.originalStyles);

        // Move back to original parent
        if (this.originalParent) {
            this.originalParent.appendChild(this.mermaidContainer);
        }

        // Remove fullscreen overlay
        if (this.fullscreenElement.parentNode) {
            this.fullscreenElement.parentNode.removeChild(this.fullscreenElement);
        }

        // Restore body scroll
        document.body.style.overflow = '';
        document.body.classList.remove('mermaid-fullscreen-active');

        // Clear references
        this.fullscreenElement = null;
        this.mermaidContainer = null;
        this.isFullscreen = false;

        console.log('[MERMAID FULLSCREEN] Exited fullscreen mode');
    }

    destroy() {
        if (this.isFullscreen) {
            this.exitFullscreen();
        }
    }
} 