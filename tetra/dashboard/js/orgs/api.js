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
    const orgItems = orgs.map(org => {
        const isEnabled = Terrain.Orgs.isEnabled(org.id);
        const isSelected = getSelectedOrg() === org.id;
        return html.orgItem(org, isEnabled, isSelected);
    }).join('');

    container.innerHTML = html.listHeader() + orgItems;
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

            // Fetch storage config
            try {
                const storageResp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/storage`);
                if (storageResp.ok) {
                    const storageData = await storageResp.json();
                    details.storage = storageData;
                }
            } catch (e) {
                // Ignore
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
    const row = document.querySelector('.cmd-row.cmd-action[data-action="nh-import"]');

    if (status) {
        status.textContent = 'running...';
        status.style.background = 'var(--three)';
        status.style.color = 'var(--paper-dark)';
    }

    try {
        const resp = await fetch(`/api/nh/${encodeURIComponent(orgId)}/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirm: true })
        });

        const data = await resp.json();

        if (data.success) {
            if (status) {
                status.textContent = `${data.environments?.length || 0} envs`;
                status.style.background = 'var(--two)';
            }
            // Refresh the config view
            setTimeout(() => loadOrgConfig(orgId), 1500);
        } else {
            if (status) {
                status.textContent = 'failed';
                status.style.background = 'var(--one)';
            }
        }
    } catch (e) {
        if (status) {
            status.textContent = 'error';
            status.style.background = 'var(--one)';
        }
    }
}

// Registry management functions

async function cloneOrg(orgId) {
    const btn = document.querySelector(`[data-action="clone-org"][data-org="${orgId}"]`);
    const originalText = btn?.textContent;

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'cloning...';
    }

    try {
        const resp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/clone`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await resp.json();

        if (data.success) {
            if (btn) btn.textContent = 'done!';
            // Refresh the org list
            setTimeout(() => loadOrgs(), 1000);
        } else {
            if (btn) {
                btn.textContent = 'failed';
                btn.style.background = 'var(--one)';
            }
            console.error('[Orgs] Clone failed:', data.error);
            setTimeout(() => {
                if (btn) {
                    btn.textContent = originalText;
                    btn.style.background = '';
                    btn.disabled = false;
                }
            }, 2000);
        }
    } catch (e) {
        console.error('[Orgs] Clone error:', e);
        if (btn) {
            btn.textContent = 'error';
            btn.style.background = 'var(--one)';
            btn.disabled = false;
        }
    }
}

async function addOrgToRegistry(orgData) {
    const status = document.getElementById('org-form-status');

    try {
        const resp = await fetch('/api/orgs/registry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orgData)
        });

        const data = await resp.json();

        if (data.success) {
            if (status) {
                status.textContent = 'Added successfully!';
                status.style.color = 'var(--two)';
            }
            setTimeout(() => {
                closeForm();
                loadOrgs();
            }, 1000);
            return true;
        } else {
            if (status) {
                status.textContent = data.error || 'Failed to add';
                status.style.color = 'var(--one)';
            }
            return false;
        }
    } catch (e) {
        if (status) {
            status.textContent = 'Error: ' + e.message;
            status.style.color = 'var(--one)';
        }
        return false;
    }
}

async function updateOrgInRegistry(orgId, orgData) {
    const status = document.getElementById('org-form-status');

    try {
        const resp = await fetch(`/api/orgs/registry/${encodeURIComponent(orgId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orgData)
        });

        const data = await resp.json();

        if (data.success) {
            if (status) {
                status.textContent = 'Updated successfully!';
                status.style.color = 'var(--two)';
            }
            setTimeout(() => {
                closeForm();
                loadOrgs();
            }, 1000);
            return true;
        } else {
            if (status) {
                status.textContent = data.error || 'Failed to update';
                status.style.color = 'var(--one)';
            }
            return false;
        }
    } catch (e) {
        if (status) {
            status.textContent = 'Error: ' + e.message;
            status.style.color = 'var(--one)';
        }
        return false;
    }
}

async function removeOrgFromRegistry(orgId) {
    if (!confirm(`Remove "${orgId}" from registry?\n\nThis only removes the registry entry. The cloned directory (if any) will remain.`)) {
        return false;
    }

    const status = document.getElementById('org-form-status');

    try {
        const resp = await fetch(`/api/orgs/registry/${encodeURIComponent(orgId)}`, {
            method: 'DELETE'
        });

        const data = await resp.json();

        if (data.success) {
            if (status) {
                status.textContent = 'Removed from registry';
                status.style.color = 'var(--two)';
            }
            setTimeout(() => {
                closeForm();
                loadOrgs();
            }, 1000);
            return true;
        } else {
            if (status) {
                status.textContent = data.error || 'Failed to remove';
                status.style.color = 'var(--one)';
            }
            return false;
        }
    } catch (e) {
        if (status) {
            status.textContent = 'Error: ' + e.message;
            status.style.color = 'var(--one)';
        }
        return false;
    }
}

function showAddOrgForm() {
    const existing = document.getElementById('org-form-overlay');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', html.addOrgForm());
}

function showEditOrgForm(orgId) {
    const orgs = Terrain.Orgs.all();
    const org = orgs.find(o => o.id === orgId);
    if (!org) return;

    const existing = document.getElementById('org-form-overlay');
    if (existing) existing.remove();

    document.body.insertAdjacentHTML('beforeend', html.editOrgForm(org));
}

function closeForm() {
    const overlay = document.getElementById('org-form-overlay');
    if (overlay) overlay.remove();
}

function getFormData() {
    return {
        id: document.getElementById('org-form-name')?.value?.trim(),
        repo: document.getElementById('org-form-repo')?.value?.trim(),
        description: document.getElementById('org-form-desc')?.value?.trim() || undefined,
        alias: document.getElementById('org-form-alias')?.value?.trim() || undefined,
        nh_source: document.getElementById('org-form-nh')?.value?.trim() || undefined
    };
}
