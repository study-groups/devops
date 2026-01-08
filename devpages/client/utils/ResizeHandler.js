/**
 * ResizeHandler.js - Reusable drag-to-resize utilities
 *
 * Provides height and column resize handling for panels and log displays.
 * Extracted from LogDisplay for reuse across components.
 */

/**
 * Create a height resize handler for a container
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.handle - The resize handle element
 * @param {HTMLElement} options.container - The container to resize
 * @param {number} [options.minHeight=100] - Minimum height in pixels
 * @param {number} [options.maxHeight] - Maximum height (defaults to window height - 100)
 * @param {Function} [options.onResize] - Callback when resize occurs (newHeight)
 * @param {Function} [options.onEnd] - Callback when resize ends (finalHeight)
 * @returns {Object} Cleanup function and current state
 */
export function createHeightResizeHandler(options) {
    const {
        handle,
        container,
        minHeight = 100,
        maxHeight = window.innerHeight - 100,
        onResize,
        onEnd
    } = options;

    if (!handle || !container) {
        console.warn('[ResizeHandler] Missing handle or container');
        return { cleanup: () => {}, state: null };
    }

    const state = {
        isResizing: false,
        startY: 0,
        startHeight: 0
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        state.isResizing = true;
        state.startY = e.clientY;
        state.startHeight = container.offsetHeight;
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e) => {
        if (!state.isResizing) return;

        const deltaY = e.clientY - state.startY;
        let newHeight = state.startHeight + deltaY;

        // Clamp to bounds
        newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

        container.style.height = `${newHeight}px`;

        if (onResize) {
            onResize(newHeight);
        }
    };

    const handleMouseUp = () => {
        if (!state.isResizing) return;

        state.isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        const finalHeight = container.offsetHeight;
        if (onEnd) {
            onEnd(finalHeight);
        }
    };

    // Attach listeners
    handle.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Return cleanup function
    return {
        cleanup: () => {
            handle.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        },
        state
    };
}

/**
 * Create a column resize handler for table-like layouts
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.headerRow - The header row containing columns
 * @param {string} [options.handleSelector='.resize-handle'] - Selector for resize handles
 * @param {number} [options.minWidth=50] - Minimum column width
 * @param {Function} [options.onResize] - Callback (columnName, newWidth)
 * @param {Function} [options.onEnd] - Callback (columnName, finalWidth)
 * @returns {Object} Cleanup function and methods
 */
export function createColumnResizeHandler(options) {
    const {
        headerRow,
        handleSelector = '.resize-handle',
        minWidth = 50,
        onResize,
        onEnd
    } = options;

    if (!headerRow) {
        console.warn('[ResizeHandler] Missing headerRow');
        return { cleanup: () => {}, state: null };
    }

    const state = {
        isResizing: false,
        currentColumn: null,
        startX: 0,
        startWidth: 0
    };

    const columnWidths = {};

    const handleMouseDown = (e) => {
        const handle = e.target.closest(handleSelector);
        if (!handle) return;

        e.preventDefault();

        const column = handle.dataset.column;
        if (!column) return;

        const columnElement = headerRow.querySelector(`[data-column="${column}"]`);
        if (!columnElement) return;

        state.isResizing = true;
        state.currentColumn = column;
        state.startX = e.clientX;
        state.startWidth = columnElement.offsetWidth;

        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e) => {
        if (!state.isResizing || !state.currentColumn) return;

        const deltaX = e.clientX - state.startX;
        let newWidth = state.startWidth + deltaX;

        // Enforce minimum width
        newWidth = Math.max(minWidth, newWidth);

        // Apply width
        const columnElement = headerRow.querySelector(`[data-column="${state.currentColumn}"]`);
        if (columnElement) {
            columnElement.style.width = `${newWidth}px`;
            columnElement.style.minWidth = `${newWidth}px`;
            columnWidths[state.currentColumn] = newWidth;

            if (onResize) {
                onResize(state.currentColumn, newWidth);
            }
        }
    };

    const handleMouseUp = () => {
        if (!state.isResizing) return;

        const column = state.currentColumn;
        const width = columnWidths[column];

        state.isResizing = false;
        state.currentColumn = null;

        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        if (onEnd && column && width) {
            onEnd(column, width);
        }
    };

    // Attach listeners
    headerRow.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return {
        cleanup: () => {
            headerRow.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        },
        state,
        getColumnWidths: () => ({ ...columnWidths }),
        setColumnWidth: (column, width) => {
            const columnElement = headerRow.querySelector(`[data-column="${column}"]`);
            if (columnElement) {
                columnElement.style.width = `${width}px`;
                columnElement.style.minWidth = `${width}px`;
                columnWidths[column] = width;
            }
        }
    };
}

/**
 * Create a panel/splitter resize handler for split views
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.splitter - The splitter/divider element
 * @param {HTMLElement} options.leftPanel - Left/top panel
 * @param {HTMLElement} options.rightPanel - Right/bottom panel
 * @param {string} [options.direction='horizontal'] - 'horizontal' or 'vertical'
 * @param {number} [options.minSize=100] - Minimum panel size
 * @param {Function} [options.onResize] - Callback (leftSize, rightSize)
 * @returns {Object} Cleanup function
 */
export function createSplitterResizeHandler(options) {
    const {
        splitter,
        leftPanel,
        rightPanel,
        direction = 'horizontal',
        minSize = 100,
        onResize
    } = options;

    if (!splitter || !leftPanel || !rightPanel) {
        console.warn('[ResizeHandler] Missing splitter or panels');
        return { cleanup: () => {} };
    }

    const isHorizontal = direction === 'horizontal';
    const state = {
        isResizing: false,
        startPos: 0,
        startLeftSize: 0,
        startRightSize: 0
    };

    const handleMouseDown = (e) => {
        e.preventDefault();
        state.isResizing = true;
        state.startPos = isHorizontal ? e.clientX : e.clientY;
        state.startLeftSize = isHorizontal ? leftPanel.offsetWidth : leftPanel.offsetHeight;
        state.startRightSize = isHorizontal ? rightPanel.offsetWidth : rightPanel.offsetHeight;

        document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';
    };

    const handleMouseMove = (e) => {
        if (!state.isResizing) return;

        const currentPos = isHorizontal ? e.clientX : e.clientY;
        const delta = currentPos - state.startPos;

        let newLeftSize = state.startLeftSize + delta;
        let newRightSize = state.startRightSize - delta;

        // Enforce minimums
        if (newLeftSize < minSize) {
            newLeftSize = minSize;
            newRightSize = state.startLeftSize + state.startRightSize - minSize;
        }
        if (newRightSize < minSize) {
            newRightSize = minSize;
            newLeftSize = state.startLeftSize + state.startRightSize - minSize;
        }

        const sizeProperty = isHorizontal ? 'width' : 'height';
        leftPanel.style[sizeProperty] = `${newLeftSize}px`;
        rightPanel.style[sizeProperty] = `${newRightSize}px`;

        if (onResize) {
            onResize(newLeftSize, newRightSize);
        }
    };

    const handleMouseUp = () => {
        if (!state.isResizing) return;
        state.isResizing = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    splitter.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return {
        cleanup: () => {
            splitter.removeEventListener('mousedown', handleMouseDown);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        }
    };
}
