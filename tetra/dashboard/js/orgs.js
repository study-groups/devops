// Organizations Panel Module
// Focus: org management, NodeHolder integration, tetra.toml workflow

const OrgsPanel = (function() {
    'use strict';

    let selectedOrg = null;
    let orgDetailsCache = new Map();
    let editingSection = null;

    const dom = {
        orgList: () => document.getElementById('org-list'),
        orgsCount: () => document.getElementById('orgs-count'),
        workspace: () => document.getElementById('org-workspace'),
        config: () => document.getElementById('org-config'),
        infra: () => document.getElementById('org-infra')
    };

    // Escape HTML
    function esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Templates
    const html = {
        orgItem: (org, isEnabled, isSelected) => {
            const typeClass = org.type === 'system' ? ' system' : (org.type === 'admin' ? ' admin' : '');
            const label = Terrain.Orgs.label(org.id);
            const aliasInfo = org.alias ? `<span class="org-alias">${esc(org.alias)}</span>` : '';

            // Stats (if available from details)
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

            // Status badges
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

            // Status cards
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

            // Sections list with click-to-edit
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

            // Section editor (hidden by default)
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

            // NodeHolder/doctl integration
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

            // doctl info
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

            // Quick actions
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

            // File paths
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

            // Summary stats
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

            // Environment cards
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

            // Volumes
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

    // Load orgs from API or Terrain.Orgs defaults
    async function loadOrgs() {
        const container = dom.orgList();
        if (!container) return;

        container.innerHTML = html.loading();

        Terrain.Orgs.init();
        const loaded = await Terrain.Orgs.loadFromApi();

        if (!loaded) {
            console.warn('[Orgs] API unavailable, using defaults');
        }

        // Update count
        const countEl = dom.orgsCount();
        if (countEl) {
            const orgs = Terrain.Orgs.all();
            countEl.textContent = `${orgs.length} available`;
        }

        renderOrgs();
    }

    // Render org list
    function renderOrgs() {
        const container = dom.orgList();
        if (!container) return;

        const orgs = Terrain.Orgs.all();
        container.innerHTML = orgs.map(org => {
            const isEnabled = Terrain.Orgs.isEnabled(org.id);
            const isSelected = selectedOrg === org.id;
            return html.orgItem(org, isEnabled, isSelected);
        }).join('');
    }

    // Load org details/config
    async function loadOrgConfig(orgId) {
        const container = dom.config();
        if (!container) return;

        container.innerHTML = html.config(orgId, null);

        try {
            const resp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}`);
            if (resp.ok) {
                const data = await resp.json();

                // Enhance with sections info
                const details = {
                    ...data,
                    hasSections: data.subdirectories && data.subdirectories.includes('sections'),
                    hasTetraToml: true,
                    nhSource: data.nh_source || null,
                    sections: [],
                    environments: [],
                    volumes: [],
                    sshKeys: [],
                    envCount: 0,
                    domainCount: 0
                };

                // Try to get sections list
                if (details.hasSections) {
                    try {
                        const sectResp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/file/sections`);
                        if (sectResp.ok) {
                            const sectData = await sectResp.json();
                            details.sections = sectData.files
                                .filter(f => f.name.endsWith('.toml'))
                                .map(f => f.name)
                                .sort();
                        }
                    } catch (e) {
                        // Ignore
                    }
                }

                // Try to parse tetra.toml for environments
                try {
                    const tomlResp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/file/tetra.toml`);
                    if (tomlResp.ok) {
                        const tomlData = await tomlResp.json();
                        if (tomlData.content) {
                            const envMatches = tomlData.content.match(/\[env\.(\w+)\]/g) || [];
                            details.envCount = envMatches.length;

                            // Parse environments
                            details.environments = parseEnvironments(tomlData.content);
                            details.volumes = parseVolumes(tomlData.content);
                            details.sshKeys = parseSSHKeys(tomlData.content);
                            details.domainCount = (tomlData.content.match(/domain\s*=/g) || []).length;
                        }
                    }
                } catch (e) {
                    // Ignore
                }

                orgDetailsCache.set(orgId, details);
                container.innerHTML = html.config(orgId, details);
                renderOrgs(); // Update org list with new details
            } else {
                container.innerHTML = '<div class="config-empty">Failed to load org config</div>';
            }
        } catch (e) {
            console.warn('[Orgs] Failed to fetch config:', e.message);
            container.innerHTML = '<div class="config-empty">Failed to load org config</div>';
        }
    }

    // Parse environments from TOML content
    function parseEnvironments(content) {
        const envs = [];
        const envRegex = /\[env\.(\w+)\]([\s\S]*?)(?=\[|\z)/g;
        let match;

        while ((match = envRegex.exec(content)) !== null) {
            const name = match[1];
            const block = match[2];

            const env = { name };

            // Extract common fields
            const hostMatch = block.match(/host\s*=\s*"([^"]+)"/);
            if (hostMatch) env.host = hostMatch[1];

            const descMatch = block.match(/description\s*=\s*"([^"]+)"/);
            if (descMatch) env.description = descMatch[1];

            const domainMatch = block.match(/domain\s*=\s*"([^"]+)"/);
            if (domainMatch) env.domain = domainMatch[1];

            const regionMatch = block.match(/region\s*=\s*"([^"]+)"/);
            if (regionMatch) env.region = regionMatch[1];

            envs.push(env);
        }

        return envs;
    }

    // Parse volumes from TOML content
    function parseVolumes(content) {
        const volumes = [];
        const volRegex = /\[storage\.volumes\.([^\]]+)\]([\s\S]*?)(?=\[|\z)/g;
        let match;

        while ((match = volRegex.exec(content)) !== null) {
            const name = match[1];
            const block = match[2];

            const vol = { name };

            const sizeMatch = block.match(/size_gb\s*=\s*(\d+)/);
            if (sizeMatch) vol.size_gb = parseInt(sizeMatch[1]);

            const regionMatch = block.match(/region\s*=\s*"([^"]+)"/);
            if (regionMatch) vol.region = regionMatch[1];

            const attachedMatch = block.match(/attached_to\s*=\s*"([^"]+)"/);
            if (attachedMatch) vol.attached_to = attachedMatch[1];

            volumes.push(vol);
        }

        return volumes;
    }

    // Parse SSH keys from TOML content
    function parseSSHKeys(content) {
        const keys = [];
        const keysMatch = content.match(/\[ssh_keys\]([\s\S]*?)(?=\[|\z)/);

        if (keysMatch) {
            const keyRegex = /"([^"]+)"\s*=\s*"([^"]+)"/g;
            let match;
            while ((match = keyRegex.exec(keysMatch[1])) !== null) {
                keys.push({ name: match[1], fingerprint: match[2] });
            }
        }

        return keys;
    }

    // Load infrastructure tab
    async function loadInfra(orgId) {
        const container = dom.infra();
        if (!container) return;

        const details = orgDetailsCache.get(orgId);
        container.innerHTML = html.infra(orgId, details);
    }

    // Load section content for editing
    async function loadSection(orgId, sectionName) {
        const editor = document.getElementById('section-editor');
        const title = document.getElementById('editor-title');
        const textarea = document.getElementById('section-content');
        const status = document.getElementById('editor-status');

        if (!editor || !textarea) return;

        editingSection = sectionName;
        title.textContent = `Editing: ${sectionName}`;
        textarea.value = 'Loading...';
        status.textContent = '';
        editor.style.display = 'block';

        try {
            const resp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/file/sections/${encodeURIComponent(sectionName)}`);
            if (resp.ok) {
                const data = await resp.json();
                textarea.value = data.content || '';
            } else {
                textarea.value = '# Failed to load section';
            }
        } catch (e) {
            textarea.value = '# Error loading section: ' + e.message;
        }
    }

    // Save section content
    async function saveSection(orgId) {
        const textarea = document.getElementById('section-content');
        const status = document.getElementById('editor-status');

        if (!textarea || !editingSection) return;

        status.textContent = 'Saving...';
        status.style.color = 'var(--three)';

        try {
            const resp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/file/sections/${encodeURIComponent(editingSection)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: textarea.value })
            });

            if (resp.ok) {
                status.textContent = 'Saved!';
                status.style.color = 'var(--three)';
                setTimeout(() => { status.textContent = ''; }, 2000);
            } else {
                status.textContent = 'Save failed';
                status.style.color = 'var(--one)';
            }
        } catch (e) {
            status.textContent = 'Error: ' + e.message;
            status.style.color = 'var(--one)';
        }
    }

    // Close section editor
    function closeEditor() {
        const editor = document.getElementById('section-editor');
        if (editor) {
            editor.style.display = 'none';
            editingSection = null;
        }
    }

    // Select org and show config
    function selectOrg(orgId) {
        selectedOrg = orgId;
        renderOrgs();

        const activeTab = document.querySelector('.infra-tab.active');
        const currentTab = activeTab ? activeTab.dataset.tab : 'list';

        if (currentTab === 'list') {
            document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelector('[data-tab="config"]').classList.add('active');
            document.getElementById('tab-config').classList.add('active');
            loadOrgConfig(orgId);
        } else if (currentTab === 'config') {
            loadOrgConfig(orgId);
        } else if (currentTab === 'infra') {
            loadOrgConfig(orgId).then(() => loadInfra(orgId));
        } else if (currentTab === 'workspace') {
            loadWorkspace(orgId);
        }
    }

    // Load workspace files
    async function loadWorkspace(orgId) {
        const container = dom.workspace();
        if (!container) return;

        container.innerHTML = html.workspaceLoading();

        try {
            const resp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/workspace`);
            if (resp.ok) {
                const data = await resp.json();
                container.innerHTML = html.workspace(orgId, data.files || []);
                return;
            }
        } catch (e) {
            console.warn('[Orgs] Failed to fetch workspace:', e.message);
        }

        container.innerHTML = html.workspace(orgId, []);
    }

    // Open workspace file in new tab
    function openWorkspaceFile(orgId, filePath) {
        const url = `/api/orgs/${encodeURIComponent(orgId)}/file/${encodeURIComponent(filePath)}`;
        window.open(url, '_blank');
    }

    // Copy command to clipboard
    function copyCmd(cmd) {
        navigator.clipboard.writeText(cmd).then(() => {
            const btn = document.querySelector(`[data-cmd="${CSS.escape(cmd)}"]`);
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = 'Copied!';
                setTimeout(() => btn.textContent = orig, 1000);
            }
        }).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    // Tab switching
    function initTabs() {
        document.querySelectorAll('.infra-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).classList.add('active');

                if (selectedOrg) {
                    if (tab.dataset.tab === 'config') {
                        loadOrgConfig(selectedOrg);
                    } else if (tab.dataset.tab === 'infra') {
                        loadOrgConfig(selectedOrg).then(() => loadInfra(selectedOrg));
                    } else if (tab.dataset.tab === 'workspace') {
                        loadWorkspace(selectedOrg);
                    }
                }
            });
        });
    }

    // Event delegation
    function initEvents() {
        const orgListEl = dom.orgList();
        if (orgListEl) {
            orgListEl.addEventListener('click', e => {
                const toggle = e.target.closest('.org-toggle');
                if (toggle) {
                    e.stopPropagation();
                    Terrain.Orgs.toggle(toggle.dataset.org);
                    renderOrgs();
                    return;
                }

                const item = e.target.closest('.org-item');
                if (item) {
                    selectOrg(item.dataset.org);
                }
            });
        }

        const workspaceEl = dom.workspace();
        if (workspaceEl) {
            workspaceEl.addEventListener('click', e => {
                const action = e.target.closest('[data-action="open"]');
                if (action) {
                    const fileEl = e.target.closest('.workspace-file');
                    if (fileEl && selectedOrg) {
                        openWorkspaceFile(selectedOrg, fileEl.dataset.file);
                    }
                }
            });
        }

        // Global click events
        document.addEventListener('click', e => {
            // Copy command buttons
            const copyBtn = e.target.closest('[data-action="copy-cmd"]');
            if (copyBtn && copyBtn.dataset.cmd) {
                copyCmd(copyBtn.dataset.cmd);
                return;
            }

            // Workflow command copy
            const workflowCmd = e.target.closest('.workflow-cmd');
            if (workflowCmd) {
                const cmd = workflowCmd.textContent.trim();
                navigator.clipboard.writeText(cmd);
                workflowCmd.style.borderColor = 'var(--three)';
                setTimeout(() => { workflowCmd.style.borderColor = ''; }, 500);
                return;
            }

            // Section file click - open editor
            const sectionFile = e.target.closest('.config-section-file');
            if (sectionFile && selectedOrg) {
                loadSection(selectedOrg, sectionFile.dataset.section);
                return;
            }

            // Save section
            const saveBtn = e.target.closest('[data-action="save-section"]');
            if (saveBtn && selectedOrg) {
                saveSection(selectedOrg);
                return;
            }

            // Close editor
            const closeBtn = e.target.closest('[data-action="close-editor"]');
            if (closeBtn) {
                closeEditor();
                return;
            }
        });

        const refreshBtn = document.querySelector('[data-action="refresh"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadOrgs);
        }
    }

    function init() {
        initTabs();
        initEvents();
        loadOrgs();
    }

    return { init, loadOrgs, renderOrgs, selectOrg };
})();

document.addEventListener('DOMContentLoaded', OrgsPanel.init);
