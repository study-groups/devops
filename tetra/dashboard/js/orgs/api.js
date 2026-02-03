// Orgs Panel - API Functions
// Load orgs, configs, infrastructure, and workspace files

async function loadOrgs() {
    const container = dom.orgList();
    if (!container) return;

    container.innerHTML = html.loading();

    Terrain.Orgs.init();
    const loaded = await Terrain.Orgs.loadFromApi();

    if (!loaded) {
        console.warn('[Orgs] API unavailable, using defaults');
    }

    const countEl = dom.orgsCount();
    if (countEl) {
        const orgs = Terrain.Orgs.all();
        countEl.textContent = `${orgs.length} available`;
    }

    renderOrgs();
}

function renderOrgs() {
    const container = dom.orgList();
    if (!container) return;

    const orgs = Terrain.Orgs.all();
    container.innerHTML = orgs.map(org => {
        const isEnabled = Terrain.Orgs.isEnabled(org.id);
        const isSelected = getSelectedOrg() === org.id;
        return html.orgItem(org, isEnabled, isSelected);
    }).join('');
}

async function loadOrgConfig(orgId) {
    const container = dom.config();
    if (!container) return;

    container.innerHTML = html.config(orgId, null);

    try {
        const resp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}`);
        if (resp.ok) {
            const data = await resp.json();

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

            // Fetch sections list
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

            // Parse tetra.toml for environments
            try {
                const tomlResp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/file/tetra.toml`);
                if (tomlResp.ok) {
                    // Handle both JSON and raw TOML responses
                    const contentType = tomlResp.headers.get('content-type');
                    let tomlContent;
                    if (contentType?.includes('application/json')) {
                        const tomlData = await tomlResp.json();
                        tomlContent = tomlData.content;
                    } else {
                        tomlContent = await tomlResp.text();
                    }

                    if (tomlContent) {
                        const envMatches = tomlContent.match(/\[env\.(\w+)\]/g) || [];
                        details.envCount = envMatches.length;

                        details.environments = parseEnvironments(tomlContent);
                        details.volumes = parseVolumes(tomlContent);
                        details.sshKeys = parseSSHKeys(tomlContent);
                        details.domainCount = (tomlContent.match(/domain\s*=/g) || []).length;
                    }
                }
            } catch (e) {
                // Ignore
            }

            orgDetailsCache.set(orgId, details);
            container.innerHTML = html.config(orgId, details);
            renderOrgs();
        } else {
            container.innerHTML = '<div class="config-empty">Failed to load org config</div>';
        }
    } catch (e) {
        console.warn('[Orgs] Failed to fetch config:', e.message);
        container.innerHTML = '<div class="config-empty">Failed to load org config</div>';
    }
}

async function loadInfra(orgId) {
    const container = dom.infra();
    if (!container) return;

    const details = orgDetailsCache.get(orgId);
    container.innerHTML = html.infra(orgId, details);
}

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

function openWorkspaceFile(orgId, filePath) {
    const url = `/api/orgs/${encodeURIComponent(orgId)}/file/${encodeURIComponent(filePath)}`;
    window.open(url, '_blank');
}

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

async function importNhInfra(orgId) {
    const status = document.getElementById('nh-import-status');
    const btn = document.querySelector('[data-action="nh-import"]');

    if (status) {
        status.textContent = 'Importing...';
        status.style.color = 'var(--three)';
    }
    if (btn) btn.disabled = true;

    try {
        const resp = await fetch(`/api/nh/${encodeURIComponent(orgId)}/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: true })
        });

        const data = await resp.json();

        if (data.success) {
            if (status) {
                status.textContent = `Imported ${data.environments?.length || 0} environments`;
                status.style.color = 'var(--three)';
            }
            // Refresh the config view
            setTimeout(() => loadOrgConfig(orgId), 1500);
        } else {
            if (status) {
                status.textContent = data.error || 'Import failed';
                status.style.color = 'var(--one)';
            }
        }
    } catch (e) {
        if (status) {
            status.textContent = 'Error: ' + e.message;
            status.style.color = 'var(--one)';
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}
