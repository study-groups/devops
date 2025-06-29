/**
 * client/dom-inspector/IframeDetailsManager.js
 * Manages the inspection of iframe elements.
 */

export class IframeDetailsManager {
    constructor(panel) {
        this.panel = panel;
    }

    /**
     * Creates a special section for iframe details.
     * @param {HTMLIFrameElement} iframe - The iframe element to inspect.
     * @returns {HTMLElement} - The details section.
     */
    createIframeDetailsSection(iframe) {
        const details = this.getIframeDetails(iframe);
        const content = this.createDetailsTable(details);
        return this.panel.createCollapsibleSection('iframe-details', 'Iframe Details', content);
    }

    /**
     * Gathers details about the iframe.
     * @param {HTMLIFrameElement} iframe - The iframe element.
     * @returns {Array} - An array of [key, value] pairs.
     */
    getIframeDetails(iframe) {
        const details = [
            ['src', iframe.src],
            ['name', iframe.name || 'Not set'],
            ['id', iframe.id || 'Not set'],
            ['width', iframe.width],
            ['height', iframe.height],
            ['sandbox', iframe.sandbox || 'Not set'],
            ['allow', iframe.allow || 'Not set'],
        ];

        // Check for cross-origin status by trying to access contentWindow
        try {
            const iframeDoc = iframe.contentWindow.document;
            details.push(['[Access]', 'Same-origin']);
            details.push(['contentDoc.title', iframeDoc.title || 'No title']);
            details.push(['contentDoc.readyState', iframeDoc.readyState]);
        } catch (e) {
            details.push(['[Access]', 'Cross-origin (restricted)']);
        }

        return details;
    }

    /**
     * Creates a simple table for the details.
     * @param {Array} details - An array of [key, value] pairs.
     * @returns {HTMLElement} - The table element.
     */
    createDetailsTable(details) {
        const table = document.createElement('table');
        table.className = 'dom-inspector-details-table';

        details.forEach(([key, value]) => {
            const row = table.insertRow();
            const keyCell = row.insertCell();
            const valueCell = row.insertCell();
            
            keyCell.textContent = key;
            valueCell.textContent = value;
        });

        return table;
    }
} 