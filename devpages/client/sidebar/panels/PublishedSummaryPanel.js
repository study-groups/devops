import { globalFetch } from '/client/globalFetch.js';
import { logMessage } from '/client/log/index.js';

// Helper to generate a color from a string.
function stringToHslColor(str, s = 70, l = 50) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, ${s}%, ${l}%)`;
}

export class PublishedSummaryPanel {
    constructor() {
        this.container = null;
        this.contexts = [];
    }

    async render() {
        await this.fetchContexts();

        if (this.contexts.length === 0) {
            return `<div class="published-summary-panel">
                        <div class="panel-info-text">No published contexts found.</div>
                    </div>`;
        }
        
        const contextsHtml = this.contexts.map(context => {
            return `
                <div class="context-container" data-context-name="${context}">
                    <div class="context-header">
                        <span class="context-name">${context}</span>
                    </div>
                    <div class="context-files-container collapsed">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            `;
        }).join('');

        return `<div class="published-summary-panel">${contextsHtml}</div>`;
    }

    async fetchContexts() {
        try {
            const response = await globalFetch('/api/publish/context/list');
            if (response.ok) {
                const data = await response.json();
                this.contexts = data.contexts || [];
            } else {
                logMessage('Failed to fetch published contexts', 'warn', 'PublishedSummaryPanel');
                this.contexts = [];
            }
        } catch (error) {
            logMessage(`Error fetching contexts: ${error.message}`, 'error', 'PublishedSummaryPanel');
            this.contexts = [];
        }
    }

    async fetchFilesForContext(contextName) {
        try {
            const response = await globalFetch(`/api/publish/context/${contextName}/files`);
            if (response.ok) {
                const data = await response.json();
                return data.files || [];
            } else {
                logMessage(`Failed to fetch files for context ${contextName}`, 'warn', 'PublishedSummaryPanel');
                return [];
            }
        } catch (error) {
            logMessage(`Error fetching files for ${contextName}: ${error.message}`, 'error', 'PublishedSummaryPanel');
            return [];
        }
    }
    
    attachEventListeners(panelElement) {
        this.container = panelElement;
        this.container.querySelectorAll('.context-header').forEach(header => {
            header.addEventListener('click', async (event) => {
                const contextContainer = event.currentTarget.closest('.context-container');
                const contextName = contextContainer.dataset.contextName;
                const filesContainer = contextContainer.querySelector('.context-files-container');
                const indicator = header.querySelector('.collapse-indicator');

                const isCollapsed = filesContainer.classList.toggle('collapsed');
                indicator.textContent = isCollapsed ? '►' : '▼';

                if (!isCollapsed && filesContainer.innerHTML.includes('loading-spinner')) {
                    const files = await this.fetchFilesForContext(contextName);
                    if (files.length > 0) {
                        filesContainer.innerHTML = files.map(file => `
                            <div class="context-file-item">
                                <span class="file-name">${file.name}</span>
                                <span class="file-size">(${(file.size / 1024).toFixed(2)} KB)</span>
                            </div>
                        `).join('');
                    } else {
                        filesContainer.innerHTML = `<div class="panel-info-text">No files in this context.</div>`;
                    }
                }
            });
        });
    }

    onActivate(panelElement) {
        this.attachEventListeners(panelElement);
    }
} 