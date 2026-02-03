// Orgs Panel - HTML Templates
// All rendering templates for org list, config, infra, workspace

const html = {
    orgItem: (org, isEnabled, isSelected) => {
        const labelClass = org.active ? ' active' : '';
        const label = Terrain.Orgs.label(org.id);
        const aliasInfo = org.alias ? `<span class="org-alias">${esc(org.alias)}</span>` : '';

        const details = orgDetailsCache.get(org.id);
        let statsHtml = '';
        if (details) {
            const envCount = details.envCount || 0;
            const sectionCount = details.sections?.length || 0;
            statsHtml = `
                <div class="org-stats">
                    ${envCount > 0 ? `<div class="org-stat"><span class="org-stat-icon servers">&#9679;</span><span class="org-stat-value">${envCount}</span> envs</div>` : ''}
                    ${sectionCount > 0 ? `<div class="org-stat"><span class="org-stat-icon sections">&#9679;</span><span class="org-stat-value">${sectionCount}</span> sections</div>` : ''}
                </div>
            `;
        }

        const badges = [];
        if (org.hasInfra) badges.push('<span class="org-badge infra" title="Has infrastructure configuration">infra</span>');
        if (org.hasSections) badges.push('<span class="org-badge sections" title="Has sections/ directory with TOML partials">sections</span>');
        if (org.nhSource) badges.push('<span class="org-badge nh" title="NodeHolder: digocean.json imported from DigitalOcean">nh</span>');

        return `
            <div class="org-item${isSelected ? ' selected' : ''}" data-org="${esc(org.id)}">
                <div class="org-toggle${isEnabled ? ' enabled' : ''}" data-org="${esc(org.id)}" title="Toggle visibility in top bar"></div>
                <div class="org-info">
                    <div class="org-name-row">
                        <span class="org-name">${esc(org.id)}</span>
                        ${aliasInfo}
                    </div>
                    <div class="org-meta">${esc(org.description || org.type || '')}</div>
                    ${statsHtml}
                    <div class="org-badges">${badges.join('')}</div>
                </div>
                <span class="org-label${labelClass}" title="${org.active ? 'Active org' : 'Click to view'}">${esc(label)}</span>
            </div>`;
    },

    config: (org, details) => {
        if (!details) {
            return `<div class="config-empty">
                <div class="loading-spinner"><span></span><span></span><span></span><span></span></div>
                Loading configuration...
            </div>`;
        }

        const nhSource = details.nhSource;

        let sectionsHtml = '';
        if (details.sections && details.sections.length > 0) {
            const sectionItems = details.sections.map(s =>
                `<div class="config-section-file" data-section="${esc(s)}" title="Click to view/edit">${esc(s)}</div>`
            ).join('');
            sectionsHtml = `
                <div class="config-section">
                    <div class="config-section-title">TOML Sections</div>
                    <div class="config-sections-list">${sectionItems}</div>
                    <div class="config-hint">Click a section to view/edit. Build with <code>org build ${esc(org)}</code></div>
                </div>
            `;
        }

        let editorHtml = `
            <div class="config-section section-editor" id="section-editor" style="display: none;">
                <div class="config-section-title">
                    <span id="editor-title">Section Editor</span>
                    <span class="editor-close" data-action="close-editor">&times;</span>
                </div>
                <textarea id="section-content" class="section-textarea" spellcheck="false"></textarea>
                <div class="editor-actions">
                    <button class="config-btn primary" data-action="save-section">Save</button>
                    <button class="config-btn secondary" data-action="close-editor">Cancel</button>
                    <span class="editor-status" id="editor-status"></span>
                </div>
            </div>
        `;

        let commandsHtml = `
            <div class="config-section">
                <div class="config-section-title">Commands (click to copy)</div>
                <div class="cmd-list">
                    <div class="cmd-row" data-cmd="org switch ${esc(org)}">
                        <code class="cmd-text">org switch ${esc(org)}</code>
                        <span class="cmd-copied"></span>
                    </div>
                    <div class="cmd-row" data-cmd="org status">
                        <code class="cmd-text">org status</code>
                        <span class="cmd-copied"></span>
                    </div>
                    <div class="cmd-row" data-cmd="org build ${esc(org)}">
                        <code class="cmd-text">org build ${esc(org)}</code>
                        <span class="cmd-copied"></span>
                    </div>
                    <div class="cmd-row" data-cmd="doctl auth switch --context ${esc(org)}">
                        <code class="cmd-text">doctl auth switch --context ${esc(org)}</code>
                        <span class="cmd-copied"></span>
                    </div>
                    <div class="cmd-row" data-cmd="tmod load nh_bridge && nhb_import ~/nh/${esc(org)}/digocean.json ${esc(org)}">
                        <code class="cmd-text">tmod load nh_bridge && nhb_import ~/nh/${esc(org)}/digocean.json ${esc(org)}</code>
                        <span class="cmd-copied"></span>
                    </div>
                    <div class="cmd-row" data-cmd="doctl auth init --context ${esc(org)}">
                        <code class="cmd-text">doctl auth init --context ${esc(org)}</code>
                        <span class="cmd-copied"></span>
                    </div>
                </div>
                ${nhSource ? `<div class="config-nh-status ok" style="margin-top: 8px;">Last imported from: ${esc(nhSource)}</div>` : ''}
                <div class="config-actions" style="margin-top: 12px;">
                    <button class="config-btn primary" data-action="nh-import" data-org="${esc(org)}">
                        Import Infrastructure
                    </button>
                    <span class="nh-import-status" id="nh-import-status"></span>
                </div>
            </div>
        `;

        let pathsHtml = `
            <div class="config-section">
                <div class="config-section-title">Paths</div>
                <div class="config-paths">
                    <div class="config-path-row">
                        <span class="config-path-label">Org Dir:</span>
                        <span class="config-path-value">$TETRA_DIR/orgs/${esc(org)}/</span>
                    </div>
                    <div class="config-path-row">
                        <span class="config-path-label">Config:</span>
                        <span class="config-path-value">tetra.toml</span>
                    </div>
                    <div class="config-path-row">
                        <span class="config-path-label">NH Source:</span>
                        <span class="config-path-value">~/nh/${esc(org)}/digocean.json</span>
                    </div>
                </div>
            </div>
        `;

        return `
            <div class="config-header">
                <span class="config-title">${esc(org)}</span>
                <span class="config-type">${esc(details.type || 'org')}</span>
            </div>
            ${sectionsHtml}
            ${editorHtml}
            ${commandsHtml}
            ${pathsHtml}
        `;
    },

    infra: (org, details) => {
        if (!details || !details.environments) {
            return `<div class="config-empty">
                <div class="loading-spinner"><span></span><span></span><span></span><span></span></div>
                Loading infrastructure...
            </div>`;
        }

        const envs = details.environments || [];
        const volumes = details.volumes || [];
        const sshKeys = details.sshKeys || [];

        let summaryHtml = `
            <div class="infra-summary">
                <div class="infra-stat droplets">
                    <div class="infra-stat-value">${envs.length}</div>
                    <div class="infra-stat-label">Environments</div>
                </div>
                <div class="infra-stat volumes">
                    <div class="infra-stat-value">${volumes.length}</div>
                    <div class="infra-stat-label">Volumes</div>
                </div>
                <div class="infra-stat domains">
                    <div class="infra-stat-value">${details.domainCount || 0}</div>
                    <div class="infra-stat-label">Domains</div>
                </div>
                <div class="infra-stat keys">
                    <div class="infra-stat-value">${sshKeys.length}</div>
                    <div class="infra-stat-label">SSH Keys</div>
                </div>
            </div>
        `;

        let envsHtml = '';
        if (envs.length > 0) {
            const envCards = envs.map(env => `
                <div class="env-card">
                    <div class="env-card-header">
                        <span class="env-card-name">${esc(env.name)}</span>
                        ${env.region ? `<span class="env-card-region">${esc(env.region)}</span>` : ''}
                    </div>
                    <div class="env-card-ip">${esc(env.host || 'localhost')}</div>
                    <div class="env-card-desc">${esc(env.description || '')}</div>
                    ${env.domain ? `<div class="env-card-domain">${esc(env.domain)}</div>` : ''}
                </div>
            `).join('');

            envsHtml = `
                <div class="config-section">
                    <div class="config-section-title">Environments</div>
                    <div class="env-cards">${envCards}</div>
                </div>
            `;
        }

        let volumesHtml = '';
        if (volumes.length > 0) {
            const volumeCards = volumes.map(v => `
                <div class="env-card">
                    <div class="env-card-header">
                        <span class="env-card-name">${esc(v.name)}</span>
                        <span class="env-card-region">${esc(v.size_gb || v.size_gigabytes || '?')}GB</span>
                    </div>
                    <div class="env-card-desc">${esc(v.region || '')}</div>
                    ${v.attached_to ? `<div class="env-card-domain">Attached to: ${esc(v.attached_to)}</div>` : ''}
                </div>
            `).join('');

            volumesHtml = `
                <div class="config-section">
                    <div class="config-section-title">Volumes</div>
                    <div class="env-cards">${volumeCards}</div>
                </div>
            `;
        }

        return `
            <div class="config-header">
                <span class="config-title">${esc(org)} Infrastructure</span>
            </div>
            ${summaryHtml}
            ${envsHtml}
            ${volumesHtml}
        `;
    },

    workspace: (org, files) => {
        if (!files || files.length === 0) {
            return '<div class="workspace-empty">No workspace files found</div>';
        }

        const fileItems = files.map(f => `
            <div class="workspace-file" data-file="${esc(f.path)}">
                <span class="workspace-file-icon">&#128196;</span>
                <span class="workspace-file-name">${esc(f.name)}</span>
                <span class="workspace-file-action" data-action="open">open</span>
            </div>
        `).join('');

        return `
            <div class="workspace-header">
                <span class="workspace-title">${esc(org)} Files</span>
            </div>
            <div class="workspace-files">${fileItems}</div>`;
    },

    loading: () => `<div class="config-empty">
        <div class="loading-spinner"><span></span><span></span><span></span><span></span></div>
        Loading organizations...
    </div>`,

    workspaceLoading: () => '<div class="workspace-empty">Loading workspace...</div>'
};
