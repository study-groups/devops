// Orgs Panel - HTML Templates
// All rendering templates for org list, config, infra, workspace

const html = {
    // Header with add button and gear
    listHeader: () => `
        <div class="org-list-header">
            <span class="org-list-title">Organizations</span>
            <div class="org-list-actions">
                <button class="org-action-btn" data-action="add-org" title="Add org to registry">+</button>
                <button class="org-action-btn" data-action="edit-registry" title="Edit registry">&#9881;</button>
            </div>
        </div>
    `,

    orgItem: (org, isEnabled, isSelected) => {
        const labelClass = org.active ? ' active' : '';
        const label = Terrain.Orgs.label(org.id);
        const aliasInfo = org.alias ? `<span class="org-alias">${esc(org.alias)}</span>` : '';
        const isCloned = org.cloned !== false;

        // Clone status dot: solid = cloned, hollow = not cloned
        const statusDot = isCloned
            ? `<span class="org-status-dot cloned" title="Cloned">&#9679;</span>`
            : `<span class="org-status-dot uncloned" title="Not cloned">&#9675;</span>`;

        const details = orgDetailsCache.get(org.id);
        let statsHtml = '';
        if (details && isCloned) {
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
        if (!isCloned) {
            badges.push(`<button class="org-clone-btn" data-action="clone-org" data-org="${esc(org.id)}" title="Clone from ${esc(org.repo || 'registry')}">clone</button>`);
        } else {
            if (org.hasInfra) badges.push('<span class="org-badge infra" title="Has infrastructure configuration">infra</span>');
            if (org.hasSections) badges.push('<span class="org-badge sections" title="Has sections/ directory with TOML partials">sections</span>');
            if (org.nhSource) badges.push('<span class="org-badge nh" title="NodeHolder: digocean.json imported from DigitalOcean">nh</span>');
        }

        // Edit button for registry entry
        const editBtn = `<button class="org-edit-btn" data-action="edit-org" data-org="${esc(org.id)}" title="Edit registry entry">&#9998;</button>`;

        return `
            <div class="org-item${isSelected ? ' selected' : ''}${!isCloned ? ' uncloned' : ''}" data-org="${esc(org.id)}" data-cloned="${isCloned}">
                ${statusDot}
                <div class="org-toggle${isEnabled ? ' enabled' : ''}${!isCloned ? ' disabled' : ''}" data-org="${esc(org.id)}" title="${isCloned ? 'Toggle visibility in top bar' : 'Clone first to enable'}"></div>
                <div class="org-info">
                    <div class="org-name-row">
                        <span class="org-name">${esc(org.id)}</span>
                        ${aliasInfo}
                        <span class="org-badges">${badges.join('')}</span>
                    </div>
                    <div class="org-meta">${esc(org.description || (isCloned ? org.type : 'Not cloned') || '')}</div>
                    ${statsHtml}
                </div>
                <div class="org-item-actions">
                    ${editBtn}
                    <span class="org-label${labelClass}" title="${org.active ? 'Active org' : 'Click to view'}">${esc(label)}</span>
                </div>
            </div>`;
    },

    // Add org form
    addOrgForm: () => `
        <div class="org-form-overlay" id="org-form-overlay">
            <div class="org-form">
                <div class="org-form-header">
                    <span>Add Organization</span>
                    <button class="org-form-close" data-action="close-form">&times;</button>
                </div>
                <div class="org-form-body">
                    <label>
                        <span>Name</span>
                        <input type="text" id="org-form-name" placeholder="my-org" pattern="[a-zA-Z0-9_-]+" required>
                    </label>
                    <label>
                        <span>Repo URL</span>
                        <input type="text" id="org-form-repo" placeholder="git@github.com:user/repo.git" required>
                    </label>
                    <label>
                        <span>Description</span>
                        <input type="text" id="org-form-desc" placeholder="Optional description">
                    </label>
                    <label>
                        <span>Alias</span>
                        <input type="text" id="org-form-alias" placeholder="Short name (optional)">
                    </label>
                    <label>
                        <span>NH Source</span>
                        <input type="text" id="org-form-nh" placeholder="NodeHolder org name (optional)">
                    </label>
                </div>
                <div class="org-form-footer">
                    <button class="config-btn secondary" data-action="close-form">Cancel</button>
                    <button class="config-btn primary" data-action="save-org">Add to Registry</button>
                </div>
                <div class="org-form-status" id="org-form-status"></div>
            </div>
        </div>
    `,

    // Edit org form (similar but pre-filled)
    editOrgForm: (org) => `
        <div class="org-form-overlay" id="org-form-overlay">
            <div class="org-form">
                <div class="org-form-header">
                    <span>Edit: ${esc(org.id)}</span>
                    <button class="org-form-close" data-action="close-form">&times;</button>
                </div>
                <div class="org-form-body">
                    <input type="hidden" id="org-form-name" value="${esc(org.id)}">
                    <label>
                        <span>Repo URL</span>
                        <input type="text" id="org-form-repo" value="${esc(org.repo || '')}" placeholder="git@github.com:user/repo.git">
                    </label>
                    <label>
                        <span>Description</span>
                        <input type="text" id="org-form-desc" value="${esc(org.description || '')}" placeholder="Optional description">
                    </label>
                    <label>
                        <span>Alias</span>
                        <input type="text" id="org-form-alias" value="${esc(org.alias || '')}" placeholder="Short name (optional)">
                    </label>
                    <label>
                        <span>NH Source</span>
                        <input type="text" id="org-form-nh" value="${esc(org.nhSource || '')}" placeholder="NodeHolder org name (optional)">
                    </label>
                </div>
                <div class="org-form-footer">
                    <button class="config-btn danger" data-action="delete-org" data-org="${esc(org.id)}">Remove</button>
                    <span style="flex:1"></span>
                    <button class="config-btn secondary" data-action="close-form">Cancel</button>
                    <button class="config-btn primary" data-action="update-org" data-org="${esc(org.id)}">Save</button>
                </div>
                <div class="org-form-status" id="org-form-status"></div>
            </div>
        </div>
    `,

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
                    <div class="cmd-row" data-cmd="doctl auth init --context ${esc(org)}">
                        <code class="cmd-text">doctl auth init --context ${esc(org)}</code>
                        <span class="cmd-copied"></span>
                    </div>
                    <div class="cmd-row cmd-action" data-action="nh-import" data-org="${esc(org)}" data-cmd="nhb_import ~/nh/${esc(org)}/digocean.json ${esc(org)}">
                        <code class="cmd-text">nhb_import ~/nh/${esc(org)}/digocean.json ${esc(org)}</code>
                        <span class="cmd-status" id="nh-import-status">${nhSource ? 'imported' : 'run'}</span>
                    </div>
                </div>
            </div>
        `;

        const storage = details.storage || {};
        let storageHtml = `
            <div class="config-section">
                <div class="config-section-title">Storage (S3/Spaces)</div>
                <div class="config-paths">
                    <div class="config-path-row">
                        <span class="config-path-label">Status:</span>
                        <span class="config-path-value ${storage.configured ? 'ok' : 'muted'}">${storage.configured ? 'Configured' : 'Not configured'}</span>
                    </div>
                    ${storage.bucket ? `
                    <div class="config-path-row">
                        <span class="config-path-label">Bucket:</span>
                        <span class="config-path-value">${esc(storage.bucket)}</span>
                    </div>
                    <div class="config-path-row">
                        <span class="config-path-label">Endpoint:</span>
                        <span class="config-path-value">${esc(storage.endpoint)}</span>
                    </div>
                    <div class="config-path-row">
                        <span class="config-path-label">Region:</span>
                        <span class="config-path-value">${esc(storage.region)}</span>
                    </div>
                    <div class="config-path-row">
                        <span class="config-path-label">Prefix:</span>
                        <span class="config-path-value">${esc(storage.prefix)}</span>
                    </div>
                    <div class="config-path-row">
                        <span class="config-path-label">Source:</span>
                        <span class="config-path-value muted">${esc(storage.source)}</span>
                    </div>
                    ` : `
                    <div class="config-hint">Add [storage.s3] section to sections/30-storage.toml</div>
                    `}
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
            ${storageHtml}
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

        let commandsHtml = `
            <div class="config-section">
                <div class="config-section-title">Commands (click to copy)</div>
                <div class="cmd-list">
                    <div class="cmd-row" data-cmd="org storage status ${esc(org)}">
                        <code class="cmd-text">org storage status ${esc(org)}</code>
                        <span class="cmd-copied"></span>
                    </div>
                    <div class="cmd-row" data-cmd="org storage test ${esc(org)}">
                        <code class="cmd-text">org storage test ${esc(org)}</code>
                        <span class="cmd-copied"></span>
                    </div>
                    <div class="cmd-row" data-cmd="tsm logs export all">
                        <code class="cmd-text">tsm logs export all</code>
                        <span class="cmd-copied"></span>
                    </div>
                    <div class="cmd-row" data-cmd="TETRA_ORG=${esc(org)} ~/tetra/browser/collect-inventory.sh">
                        <code class="cmd-text">TETRA_ORG=${esc(org)} ~/tetra/browser/collect-inventory.sh</code>
                        <span class="cmd-copied"></span>
                    </div>
                </div>
            </div>
        `;

        let archHtml = `
            <div class="config-section">
                <div class="config-section-title">Directory Structure</div>
                <div class="config-paths" style="font-size: 9px; line-height: 1.6;">
                    <code style="color: var(--ink-muted); white-space: pre;">~/tetra/orgs/${esc(org)}/
├── sections/        # TOML source files
├── tetra.toml       # Built config
├── tsm/             # Service definitions
└── workspace/       # Content files</code>
                </div>
            </div>
        `;

        return `
            <div class="config-header">
                <span class="config-title">${esc(org)} Infrastructure</span>
            </div>
            ${summaryHtml}
            ${envsHtml}
            ${volumesHtml}
            ${commandsHtml}
            ${archHtml}
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
