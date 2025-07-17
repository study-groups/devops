import { globalFetch } from '/client/globalFetch.js';
import { logMessage } from '/client/log/index.js';
import { SubPanel } from '/client/panels/SubPanel.js';

// Helper to generate a color from a string.
function stringToHslColor(str, s = 70, l = 50) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = hash % 360;
    return `hsl(${h}, ${s}%, ${l}%)`;
}

export class PublishedSummaryPanel extends SubPanel {
    constructor() {
        this.container = null;
        this.contexts = [];
        this.doSpacesConfig = {};
    }

    render() {
        // Return a simple placeholder immediately. The onActivate method will populate it.
        return `<div class="published-summary-panel"><div class="loading-spinner"></div></div>`;
    }

    async populate() {
        // Fetch all data concurrently for efficiency
        await Promise.all([
            this.fetchContexts(),
            this.fetchDoSpacesConfig()
        ]);
        
        // Clear loading spinner
        if (this.container) {
            this.container.innerHTML = '';
        } else {
            console.error('[PublishedSummaryPanel] Container not available for population.');
            return;
        }

        // Create and append the DigitalOcean Spaces sub-panel
        const doSpacesSubPanel = new SubPanel('DigitalOcean Spaces');
        const doSpacesContent = this.createDoSpacesContent();
        const doSpacesElement = doSpacesSubPanel.createElement(doSpacesContent);
        doSpacesSubPanel.attachEventListeners();
        this.container.appendChild(doSpacesElement);

        if (this.contexts.length > 0) {
            this.contexts.forEach(context => {
                const subPanel = new SubPanel(context);
                const content = document.createElement('div');
                content.className = 'context-files-container';
                content.innerHTML = '<div class="loading-spinner"></div>';
                
                const subPanelElement = subPanel.createElement(content);

                subPanel.element.querySelector('.sub-panel-header').addEventListener('click', async () => {
                    // Check if the panel is being expanded and hasn't been loaded yet
                    if (subPanel.isCollapsed === false && content.innerHTML.includes('loading-spinner')) {
                        const files = await this.fetchFilesForContext(context);
                        if (files.length > 0) {
                            content.innerHTML = files.map(file => `
                                <div class="context-file-item">
                                    <span class="file-name">${file.name}</span>
                                    <span class="file-size">(${(file.size / 1024).toFixed(2)} KB)</span>
                                </div>
                            `).join('');
                        } else {
                            content.innerHTML = `<div class="panel-info-text">No files in this context.</div>`;
                        }
                    }
                });

                subPanel.attachEventListeners();
                this.container.appendChild(subPanelElement);
            });
        } else {
            const noContexts = document.createElement('div');
            noContexts.className = 'panel-info-text';
            noContexts.textContent = 'No published contexts found.';
            this.container.appendChild(noContexts);
        }
    }

    createDoSpacesContent() {
        const content = document.createElement('div');
        content.className = 'do-spaces-config-content';

        const configMap = {
            'Endpoint': this.doSpacesConfig.DO_SPACES_ENDPOINT,
            'Region': this.doSpacesConfig.DO_SPACES_REGION,
            'Bucket': this.doSpacesConfig.DO_SPACES_BUCKET,
            'Access Key': this.doSpacesConfig.DO_SPACES_KEY,
            'Base URL': this.doSpacesConfig.PUBLISH_BASE_URL,
        };

        const list = document.createElement('ul');
        list.className = 'config-list';

        for (const [key, value] of Object.entries(configMap)) {
            const listItem = document.createElement('li');
            const isConfigured = value && value !== 'Not set' && value !== undefined;

            listItem.innerHTML = `
                <span class="config-status-icon ${isConfigured ? 'configured' : ''}">✓</span>
                <span class="config-key">${key}:</span>
                <span class="config-value">${value || 'Not set'}</span>
            `;
            list.appendChild(listItem);
        }

        content.appendChild(list);
        return content;
    }

    async fetchDoSpacesConfig() {
        try {
            const response = await globalFetch('/api/config');
            if (response.ok) {
                this.doSpacesConfig = await response.json();
            } else {
                logMessage('Failed to fetch DO Spaces config', 'warn', 'PublishedSummaryPanel');
            }
        } catch (error) {
            logMessage(`Error fetching DO Spaces config: ${error.message}`, 'error', 'PublishedSummaryPanel');
        }
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
    
    onActivate(panelElement) {
        this.container = panelElement;
        this.populate();
    }
} 