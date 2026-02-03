// Orgs Panel - Section Editor
// Load, edit, and save TOML section files

async function loadSection(orgId, sectionName) {
    const editor = document.getElementById('section-editor');
    const title = document.getElementById('editor-title');
    const textarea = document.getElementById('section-content');
    const status = document.getElementById('editor-status');

    if (!editor || !textarea) return;

    state.dispatch('editSection', sectionName);
    title.textContent = `Editing: ${sectionName}`;
    textarea.value = 'Loading...';
    status.textContent = '';
    editor.style.display = 'block';

    try {
        const resp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/file/sections/${encodeURIComponent(sectionName)}`);
        if (resp.ok) {
            // Handle both JSON and raw TOML responses
            const contentType = resp.headers.get('content-type');
            if (contentType?.includes('application/json')) {
                const data = await resp.json();
                textarea.value = data.content || '';
            } else {
                // Raw TOML content
                textarea.value = await resp.text();
            }
        } else {
            textarea.value = '# Failed to load section';
        }
    } catch (e) {
        textarea.value = '# Error loading section: ' + e.message;
    }
}

async function saveSection(orgId) {
    const textarea = document.getElementById('section-content');
    const status = document.getElementById('editor-status');

    const editingSection = getEditingSection();
    if (!textarea || !editingSection) return;

    status.textContent = 'Saving...';
    status.style.color = 'var(--three)';

    try {
        const resp = await fetch(`/api/orgs/${encodeURIComponent(orgId)}/file/sections/${encodeURIComponent(editingSection)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'text/plain' },
            body: textarea.value
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

function closeEditor() {
    const editor = document.getElementById('section-editor');
    if (editor) {
        editor.style.display = 'none';
        state.dispatch('closeEditor');
    }
}

// Load repos.toml registry for editing
async function loadRegistry() {
    const editor = document.getElementById('section-editor');
    const title = document.getElementById('editor-title');
    const textarea = document.getElementById('section-content');
    const status = document.getElementById('editor-status');

    if (!editor || !textarea) return;

    state.dispatch('editSection', '__registry__');
    title.textContent = 'repos.toml';
    textarea.value = 'Loading...';
    status.textContent = '';
    editor.style.display = 'block';

    try {
        const resp = await fetch('/api/orgs/registry/raw');
        if (resp.ok) {
            const data = await resp.json();
            textarea.value = data.content || '';
        } else {
            textarea.value = '# Failed to load registry';
        }
    } catch (e) {
        textarea.value = '# Error: ' + e.message;
    }
}

async function saveRegistry() {
    const textarea = document.getElementById('section-content');
    const status = document.getElementById('editor-status');

    if (!textarea) return;

    status.textContent = 'Saving...';
    status.style.color = 'var(--three)';

    try {
        const resp = await fetch('/api/orgs/registry/raw', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: textarea.value })
        });

        if (resp.ok) {
            status.textContent = 'Saved!';
            status.style.color = 'var(--three)';
            setTimeout(() => {
                status.textContent = '';
                renderOrgs(); // Refresh org list
            }, 1000);
        } else {
            status.textContent = 'Save failed';
            status.style.color = 'var(--one)';
        }
    } catch (e) {
        status.textContent = 'Error: ' + e.message;
        status.style.color = 'var(--one)';
    }
}
