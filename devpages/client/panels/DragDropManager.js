import { appStore } from '/client/appState.js';
import { setDraggedPanel, handleDrop } from '/client/store/slices/panelSlice.js';

class DragDropManager {
    constructor(container, group) {
        this.container = container;
        this.group = group;
    }

    start() {
        this.container.addEventListener('dragstart', this.handleDragStart.bind(this));
        this.container.addEventListener('dragend', this.handleDragEnd.bind(this));
        this.container.addEventListener('dragover', this.handleDragOver.bind(this));
        this.container.addEventListener('drop', this.handleDrop.bind(this));
    }

    stop() {
        this.container.removeEventListener('dragstart', this.handleDragStart.bind(this));
        this.container.removeEventListener('dragend', this.handleDragEnd.bind(this));
        this.container.removeEventListener('dragover', this.handleDragOver.bind(this));
        this.container.removeEventListener('drop', this.handleDrop.bind(this));
    }

    handleDragStart(e) {
        if (e.target.classList.contains('sidebar-panel')) {
            appStore.dispatch(setDraggedPanel(e.target.id));
            e.target.classList.add('dragging');
        }
    }

    handleDragEnd(e) {
        appStore.dispatch(setDraggedPanel(null));
        e.target.classList.remove('dragging');
        document.querySelectorAll('.drop-zone').forEach(el => el.remove());
    }

    handleDragOver(e) {
        e.preventDefault();
        const afterElement = this.getDragAfterElement(e.clientY);
        document.querySelectorAll('.drop-zone').forEach(el => el.remove());
        const dropZone = document.createElement('div');
        dropZone.className = 'drop-zone';
        if (afterElement == null) {
            const lastPanel = this.container.querySelector('.sidebar-panel:last-of-type');
            if (lastPanel) {
                lastPanel.after(dropZone);
            }
        } else {
            this.container.insertBefore(dropZone, afterElement);
        }
    }

    handleDrop(e) {
        e.preventDefault();
        const draggedId = appStore.getState().panels.draggedPanel;
        if (!draggedId) return;

        const afterElement = this.getDragAfterElement(e.clientY);
        const afterId = afterElement ? afterElement.id : null;
        appStore.dispatch(handleDrop(this.group, draggedId, afterId));
    }

    getDragAfterElement(y) {
        const draggableElements = [...this.container.querySelectorAll('.sidebar-panel:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

const dragDropManager = new DragDropManager(document.getElementById('workspace-zone-left'), 'sidebar');
dragDropManager.start();

export { DragDropManager }; 