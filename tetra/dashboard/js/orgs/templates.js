// Orgs Panel - HTML Templates
// All rendering templates for org list, config, infra, workspace

const html = {
    orgItem: (org, isEnabled, isSelected) => {
        const typeClass = org.type === 'system' ? ' system' : (org.type === 'admin' ? ' admin' : '');
        const label = Terrain.Orgs.label(org.id);
        const aliasInfo = org.alias ? `<span class="org-alias">${esc(org.alias)}</span>` : '';

        const details = state.orgDetailsCache.get(org.id);
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
        if (org.hasInfra) badges.push('<span class="org-badge infra">infra</span>');
        if (org.hasSections) badges.push('<span class="org-badge sections">sections</span>');
        if (org.nhSource) badges.push('<span class="org-badge nh">nh</span>');

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
                <span class="org-label${typeClass}">${esc(label)}</span>
            </div>`;
    },

    config: (org, details) => {
        if (!details) {
            return `<div class="config-empty">
                <div class="loading-spinner"><span></span><span></span><span></span><span></span></div>
                Loading configuration...
            </div>`;
        }

        const hasSections = details.hasSections;
        const hasTetraToml = details.hasTetraToml;
        const nhSource = details.nhSource;

        let statusHtml = `
            <div class="config-status-cards">
                <div class="status-card ${hasTetraToml ? 'ok' : 'missing'}">
                    <div class="status-card-icon">${hasTetraToml ? '&#10003;' : '&#10007;'}</div>
                    <div class="status-card-label">tetra.toml</div>
                </div>
                <div class="status-card ${hasSections ? 'ok' : 'missing'}">
                    <div class="status-card-icon">${hasSections ? '&#10003;' : '&#10007;'}</div>
                    <div class="status-card-label">sections/</div>
                </div>
                <div class="status-card ${nhSource ? 'ok' : 'na'}">
                    <div class="status-card-icon">${nhSource ? '&#10003;' : '-'}</div>
                    <div class="status-card-label">NodeHolder</div>
                </div>
            </div>
        `;

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

        let nhHtml = `
            <div class="config-section">
                <div class="config-section-title">DigitalOcean Integration</div>
                <p class="config-desc">
                    Infrastructure is fetched via <code>doctl</code> and stored in <code>digocean.json</code>.
                    The <code>nh_bridge</code> module imports this into tetra sections.
                </p>
                <div class="config-workflow">
                    <div class="workflow-step">
                        <div class="workflow-num">1</div>
                        <div class="workflow-content">
                            <div class="workflow-title">Fetch from DigitalOcean</div>
                            <div class="workflow-cmd" data-copy="doctl auth switch --context ${esc(org)} && nh fetch ${esc(org)}">doctl auth switch --context ${esc(org)}</div>
                            <div class="workflow-hint">Switch doctl context, then fetch infrastructure</div>
                        </div>
                    </div>
                    <div class="workflow-step">
                        <div class="workflow-num">2</div>
                        <div class="workflow-content">
                            <div class="workflow-title">Import to Tetra</div>
                            <div class="workflow-cmd" data-copy="nhb_import ~/nh/${esc(org)}/digocean.json ${esc(org)}">nhb_import ~/nh/${esc(org)}/digocean.json ${esc(org)}</div>
                            <div class="workflow-hint">Creates/updates sections/10-infrastructure.toml</div>
                        </div>
                    </div>
                    <div class="workflow-step">
                        <div class="workflow-num">3</div>
                        <div class="workflow-content">
                            <div class="workflow-title">Build Config</div>
                            <div class="workflow-cmd" data-copy="org build ${esc(org)}">org build ${esc(org)}</div>
                            <div class="workflow-hint">Assembles sections/*.toml into tetra.toml</div>
                        </div>
                    </div>
                </div>
                ${nhSource ? `<div class="config-nh-status ok">Last imported from: ${esc(nhSource)}</div>` : ''}
            </div>
        `;

        let doctlHtml = `
            <div class="config-section">
                <div class="config-section-title">doctl Configuration</div>
                <div class="config-paths">
                    <div class="config-path-row">
                        <span class="config-path-label">Config:</span>
                        <span class="config-path-value">~/Library/Application Support/doctl/config.yaml</span>
                    </div>
                    <div class="config-path-row">
                        <span class="config-path-label">Context:</span>
                        <span class="config-path-value">${esc(org)}</span>
                    </div>
                    <div class="config-path-row">
                        <span class="config-path-label">Token Key:</span>
                        <span class="config-path-value">auth-contexts.${esc(org)}</span>
                    </div>
                </div>
                <div class="config-hint" style="margin-top: 8px;">
                    Token stored in <code>auth-contexts</code> section of config.yaml.
                    Use <code>doctl auth init --context ${esc(org)}</code> to add/update.
                </div>
            </div>
        `;

        let actionsHtml = `
            <div class="config-section">
                <div class="config-section-title">Quick Actions</div>
                <div class="config-actions">
                    <button class="config-btn primary" data-action="copy-cmd" data-cmd="org switch ${esc(org)}">
                        Switch to ${esc(org)}
                    </button>
                    <button class="config-btn" data-action="copy-cmd" data-cmd="org status">
                        Show Status
                    </button>
                    <button class="config-btn secondary" data-action="copy-cmd" data-cmd="org build ${esc(org)}">
                        Rebuild tetra.toml
                    </button>
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
            ${statusHtml}
            ${sectionsHtml}
            ${editorHtml}
            ${nhHtml}
            ${doctlHtml}
            ${actionsHtml}
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
