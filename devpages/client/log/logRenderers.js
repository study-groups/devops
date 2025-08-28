/**
 * @file logRenderers.js
 * @description A middleware-style rendering pipeline for different log types.
 * Each renderer is responsible for creating the DOM for a specific log entry type.
 */

/**
 * Default Renderer: Handles standard log entries.
 */
export const defaultRenderer = {
    type: 'DEFAULT',
    render: (entry) => {
        const fragment = document.createDocumentFragment();

        const moduleSpan = document.createElement('span');
        moduleSpan.className = 'log-entry-module';
        moduleSpan.textContent = entry.module || '';
        fragment.appendChild(moduleSpan);

        const fromSpan = document.createElement('span');
        fromSpan.className = 'log-entry-from';
        fromSpan.textContent = entry.source || '';
        fragment.appendChild(fromSpan);

        const actionSpan = document.createElement('span');
        actionSpan.className = 'log-entry-action';
        actionSpan.textContent = entry.action || '';
        fragment.appendChild(actionSpan);
        
        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-entry-message';
        messageSpan.textContent = entry.message || '';
        fragment.appendChild(messageSpan);

        return fragment;
    }
};

/**
 * Redux Renderer: Handles Redux action logs with a collapsible payload.
 */
export const reduxRenderer = {
    type: 'REDUX',
    render: (entry) => {
        const fragment = document.createDocumentFragment();

        const messageSpan = document.createElement('span');
        messageSpan.className = 'log-entry-message';
        
        // entry.message should be the full action type, e.g., "settings/setTheme"
        // We will display this in the message span.
        messageSpan.textContent = entry.message || (entry.details ? entry.details.type : '');
        
        fragment.appendChild(messageSpan);
        
        // The details container will be built on expansion, not here.
        // This keeps the initial render clean and fast.
        
        return fragment;
    }
};

// --- Renderer Registry ---
// This allows us to easily add new renderers for different log types.
export const logRenderers = {
    REDUX: reduxRenderer,
    DEFAULT: defaultRenderer,
};

/**
 * Gets the appropriate renderer for a given log entry type.
 * @param {string} type - The log entry type (e.g., 'REDUX', 'BOOT').
 * @returns {object} The renderer object.
 */
export function getRenderer(type) {
    return logRenderers[type] || logRenderers.DEFAULT;
}
