/**
 * WorkspaceLayoutManager.js
 * A headless service for managing the three-panel workspace layout.
 */
import { panelStateService } from '../panels/PanelStateManager.js';

class WorkspaceLayoutService {
    constructor() {
        this.leftZone = null;
        this.mainZone = null;
        this.rightZone = null;
        this.resizerLeft = null;
        this.resizerRight = null;
    }

    initialize() {
        this.leftZone = document.getElementById('workspace-zone-left');
        this.mainZone = document.getElementById('workspace-zone-main');
        this.rightZone = document.getElementById('workspace-zone-right');
        this.resizerLeft = document.getElementById('resizer-left');
        this.resizerRight = document.getElementById('resizer-right');

        if (!this.leftZone || !this.mainZone || !this.rightZone || !this.resizerLeft || !this.resizerRight) {
            console.warn('[WorkspaceLayoutService] Required workspace elements not found in DOM.');
            return;
        }

        this.initResizers();
    }

    initResizers() {
        this.initResizer(this.resizerLeft, this.leftZone, this.mainZone);
        this.initResizer(this.resizerRight, this.mainZone, this.rightZone);
    }

    initResizer(resizer, leftPanel, rightPanel) {
        let isResizing = false;

        resizer.addEventListener('mousedown', (e) => {
            isResizing = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;

            const totalWidth = this.leftZone.offsetWidth + this.mainZone.offsetWidth + this.rightZone.offsetWidth;
            const newLeftWidth = e.clientX - this.leftZone.getBoundingClientRect().left;
            const newRightWidth = totalWidth - e.clientX - resizer.offsetWidth;
            
            if (resizer === this.resizerLeft) {
                const mainWidth = totalWidth - newLeftWidth - this.rightZone.offsetWidth - (this.resizerLeft.offsetWidth * 2);
                this.leftZone.style.flexBasis = `${newLeftWidth}px`;
                this.mainZone.style.flexBasis = `${mainWidth}px`;
            } else { // resizerRight
                const mainWidth = totalWidth - this.leftZone.offsetWidth - newRightWidth - (this.resizerLeft.offsetWidth * 2);
                this.rightZone.style.flexBasis = `${newRightWidth}px`;
                this.mainZone.style.flexBasis = `${mainWidth}px`;
            }
        });

        document.addEventListener('mouseup', (e) => {
            isResizing = false;
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        });
    }

    toggleLeftSidebar() {
        if (!this.leftZone) return;

        const isVisible = this.leftZone.style.display !== 'none';
        if (isVisible) {
            this.leftZone.style.display = 'none';
            this.resizerLeft.style.display = 'none';
        } else {
            this.leftZone.style.display = 'flex';
            this.resizerLeft.style.display = 'block';
        }
    }
}

export const workspaceLayoutService = new WorkspaceLayoutService(); 