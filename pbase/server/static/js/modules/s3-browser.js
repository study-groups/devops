/**
 * S3 Browser tab module
 * Includes manifest manager with summary, game editor, and aggregate tools
 */

import { store } from './store.js';
import { api, formatBytes } from './api.js';

let currentSelectedFile = null;
let currentGames = [];
let currentSelectedGame = null;
let pendingManifest = null;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// File Browser Functions
// ============================================

async function showFileContent(key, name) {
    const contentPane = document.getElementById('s3-content');
    const contentHeader = document.getElementById('s3-content-header');
    const contentBody = document.getElementById('s3-content-body');

    document.querySelectorAll('#s3-list .file-item.selected').forEach(el => {
        el.classList.remove('selected');
    });
    if (currentSelectedFile) {
        currentSelectedFile.classList.add('selected');
    }

    contentPane.classList.add('visible');
    contentHeader.innerHTML = `
        <span class="filename">${escapeHtml(name)}</span>
        <button class="close-btn" title="Close">×</button>
    `;
    contentBody.innerHTML = '<pre><code>Loading...</code></pre>';

    contentHeader.querySelector('.close-btn').addEventListener('click', () => {
        contentPane.classList.remove('visible');
        document.querySelectorAll('#s3-list .file-item.selected').forEach(el => {
            el.classList.remove('selected');
        });
        currentSelectedFile = null;
    });

    try {
        const response = await fetch(`/api/s3/get?key=${encodeURIComponent(key)}`);
        const text = await response.text();
        contentBody.innerHTML = `<pre><code>${escapeHtml(text)}</code></pre>`;
    } catch (err) {
        contentBody.innerHTML = `<pre><code>Error loading file: ${err.message}</code></pre>`;
    }
}

export async function loadS3(prefix) {
    store.set('currentS3Prefix', prefix);
    const s3List = document.getElementById('s3-list');
    const breadcrumb = document.getElementById('s3-breadcrumb');
    const contentPane = document.getElementById('s3-content');

    if (contentPane) {
        contentPane.classList.remove('visible');
    }
    currentSelectedFile = null;

    const parts = prefix.split('/').filter(Boolean);
    breadcrumb.innerHTML = '<button class="crumb" data-prefix="">root</button>';
    let path = '';
    parts.forEach(part => {
        path += part + '/';
        breadcrumb.innerHTML += `<button class="crumb" data-prefix="${path}">${part}</button>`;
    });

    breadcrumb.querySelectorAll('.crumb').forEach(crumb => {
        crumb.addEventListener('click', () => loadS3(crumb.dataset.prefix));
    });

    s3List.innerHTML = '<div class="file-item">Loading...</div>';

    try {
        const result = await api(`/s3/list?prefix=${encodeURIComponent(prefix)}&delimiter=true`);

        s3List.innerHTML = '';

        result.prefixes.forEach(p => {
            const name = p.replace(prefix, '').replace(/\/$/, '');
            const item = document.createElement('div');
            item.className = 'file-item folder';
            item.innerHTML = `
                <span class="icon"></span>
                <span class="name">${name}</span>
            `;
            item.addEventListener('click', () => loadS3(p));
            s3List.appendChild(item);
        });

        result.objects.forEach(obj => {
            if (obj.key === prefix) return;
            const name = obj.key.replace(prefix, '');
            if (!name || name.includes('/')) return;

            const item = document.createElement('div');
            item.className = 'file-item file';
            item.innerHTML = `
                <span class="icon"></span>
                <span class="name">${name}</span>
                <span class="size">${formatBytes(obj.size)}</span>
            `;
            item.addEventListener('click', () => {
                currentSelectedFile = item;
                showFileContent(obj.key, name);
            });
            s3List.appendChild(item);
        });

        if (s3List.children.length === 0) {
            s3List.innerHTML = '<div class="empty-state">Empty folder</div>';
        }
    } catch (err) {
        s3List.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
}

// ============================================
// Manifest Summary Functions
// ============================================

async function loadManifestSummary() {
    const summaryDiv = document.getElementById('manifest-summary');
    summaryDiv.innerHTML = '<div class="summary-loading">Loading...</div>';

    try {
        // Get games from API
        const manifest = await api('/games?refresh=true');
        currentGames = manifest.games || [];

        // Get diff to see sync status
        let diffData = { hasChanges: false, games: { added: [], removed: [], modified: [], unchanged: [] } };
        try {
            diffData = await api('/s3/manifest/diff');
        } catch (e) {
            console.warn('Could not fetch diff:', e);
        }

        const withToml = currentGames.filter(g => g.version !== '1.0.0' || g.author !== 'Unknown').length;
        const withoutToml = currentGames.length - withToml;

        summaryDiv.innerHTML = `
            <div class="summary-stats">
                <div class="stat">
                    <span class="stat-value">${manifest.count}</span>
                    <span class="stat-label">Total Games</span>
                </div>
                <div class="stat">
                    <span class="stat-value">${withToml}</span>
                    <span class="stat-label">With game.toml</span>
                </div>
                <div class="stat ${diffData.hasChanges ? 'warning' : 'success'}">
                    <span class="stat-value">${diffData.hasChanges ? 'Out of Sync' : 'In Sync'}</span>
                    <span class="stat-label">Manifest Status</span>
                </div>
            </div>
            ${diffData.hasChanges ? `
            <div class="sync-details">
                ${diffData.games.modified?.length ? `<span class="diff-badge modified">~${diffData.games.modified.length} modified</span>` : ''}
                ${diffData.games.added?.length ? `<span class="diff-badge added">+${diffData.games.added.length} new</span>` : ''}
                ${diffData.games.removed?.length ? `<span class="diff-badge removed">-${diffData.games.removed.length} removed</span>` : ''}
            </div>` : ''}
            <div class="summary-meta">
                <small>Generated: ${new Date(manifest.generated).toLocaleString()}</small>
            </div>
        `;

        // Populate game selector
        populateGameSelector();
    } catch (err) {
        summaryDiv.innerHTML = `<div class="summary-error">Error: ${err.message}</div>`;
    }
}

function populateGameSelector() {
    const select = document.getElementById('game-toml-select');
    select.innerHTML = '<option value="">Select a game...</option>';

    currentGames.forEach(game => {
        const option = document.createElement('option');
        option.value = game.slug;
        option.textContent = `${game.name} (${game.slug})`;
        select.appendChild(option);
    });
}

// ============================================
// Game Editor Functions
// ============================================

async function loadGameToForm(slug) {
    const form = document.getElementById('game-toml-form');
    const saveBtn = document.getElementById('save-game-toml-btn');

    if (!slug) {
        form.reset();
        saveBtn.disabled = true;
        currentSelectedGame = null;
        return;
    }

    currentSelectedGame = slug;
    saveBtn.disabled = false;

    // Find game in current games
    const game = currentGames.find(g => g.slug === slug);
    if (!game) return;

    // Populate form
    form.name.value = game.name || '';
    form.id.value = game.id || game.slug || '';
    form.summary.value = game.summary || '';
    form.author.value = game.author || '';
    form.version.value = game.version || '1.0.0';
    form.entry.value = game.entry || 'index.html';
    form.thumbnail.value = game.thumbnail ? game.thumbnail.split('/').pop() : '';
    form.tags.value = (game.tags || []).join(', ');
    form.requires_auth.checked = game.requires_auth || false;
    form.min_role.value = game.min_role || 'guest';
}

async function saveGameToml() {
    if (!currentSelectedGame) return;

    const form = document.getElementById('game-toml-form');
    const saveBtn = document.getElementById('save-game-toml-btn');

    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    // Build TOML content
    const tagsArray = form.tags.value
        .split(',')
        .map(t => t.trim())
        .filter(t => t);

    const tomlContent = `[game]
id = "${form.id.value || currentSelectedGame}"
name = "${form.name.value}"
summary = "${form.summary.value}"
author = "${form.author.value || 'Unknown'}"

[version]
current = "${form.version.value || '1.0.0'}"
auto_increment = "patch"

[files]
entry = "${form.entry.value || 'index.html'}"
thumbnail = "${form.thumbnail.value || 'thumb.png'}"

[metadata]
tags = [${tagsArray.map(t => `"${t}"`).join(', ')}]
created = "${new Date().toISOString().split('T')[0]}"
updated = "${new Date().toISOString().split('T')[0]}"

[permissions]
requires_auth = ${form.requires_auth.checked}
min_role = "${form.min_role.value}"
`;

    try {
        await api('/s3/upload', {
            method: 'POST',
            body: {
                key: `games/${currentSelectedGame}/game.toml`,
                content: tomlContent,
                contentType: 'application/toml'
            }
        });

        saveBtn.textContent = 'Saved!';
        setTimeout(() => {
            saveBtn.textContent = 'Save game.toml';
            saveBtn.disabled = false;
        }, 2000);

        // Refresh summary
        loadManifestSummary();
    } catch (err) {
        saveBtn.textContent = 'Error!';
        console.error('Save error:', err);
        setTimeout(() => {
            saveBtn.textContent = 'Save game.toml';
            saveBtn.disabled = false;
        }, 2000);
    }
}

// ============================================
// Aggregate/Preview Functions
// ============================================

async function previewManifest() {
    const previewDiv = document.getElementById('manifest-preview');
    const commitBtn = document.getElementById('commit-manifest-btn');

    previewDiv.innerHTML = '<div class="preview-loading">Generating preview...</div>';
    commitBtn.disabled = true;

    try {
        const result = await api('/s3/manifest/build?dryRun=true', { method: 'POST' });

        if (!result.success) {
            previewDiv.innerHTML = `<div class="preview-error">Error: ${result.errors?.map(e => e.error).join(', ')}</div>`;
            return;
        }

        pendingManifest = result.manifest;
        commitBtn.disabled = false;

        previewDiv.innerHTML = `
            <div class="preview-header">
                <strong>Preview: ${result.manifest.count} games</strong>
                <small>Generated: ${new Date(result.manifest.generated).toLocaleString()}</small>
            </div>
            <div class="preview-games">
                ${result.manifest.games.map(g => `
                    <div class="preview-game">
                        <span class="game-name">${escapeHtml(g.name)}</span>
                        <span class="game-meta">${g.slug} v${g.version}</span>
                    </div>
                `).join('')}
            </div>
        `;
    } catch (err) {
        previewDiv.innerHTML = `<div class="preview-error">Error: ${err.message}</div>`;
    }
}

async function commitManifest() {
    const commitBtn = document.getElementById('commit-manifest-btn');
    const previewDiv = document.getElementById('manifest-preview');

    commitBtn.textContent = 'Committing...';
    commitBtn.disabled = true;

    try {
        const result = await api('/s3/manifest/build?dryRun=false', { method: 'POST' });

        if (result.success) {
            previewDiv.innerHTML = `
                <div class="preview-success">
                    games.json committed to S3 with ${result.manifest.count} games
                </div>
            `;
            pendingManifest = null;

            // Refresh summary
            loadManifestSummary();
        } else {
            previewDiv.innerHTML = `<div class="preview-error">Error: ${result.errors?.map(e => e.error).join(', ')}</div>`;
        }
    } catch (err) {
        previewDiv.innerHTML = `<div class="preview-error">Error: ${err.message}</div>`;
    }

    commitBtn.textContent = 'Commit to S3';
    commitBtn.disabled = true;
}

// ============================================
// Initialization
// ============================================

export function init() {
    // Game selector change handler
    document.getElementById('game-toml-select')?.addEventListener('change', (e) => {
        loadGameToForm(e.target.value);
    });

    // Save game.toml button
    document.getElementById('save-game-toml-btn')?.addEventListener('click', saveGameToml);

    // Refresh manifest button
    document.getElementById('refresh-manifest-btn')?.addEventListener('click', loadManifestSummary);

    // Preview manifest button
    document.getElementById('preview-manifest-btn')?.addEventListener('click', previewManifest);

    // Commit manifest button
    document.getElementById('commit-manifest-btn')?.addEventListener('click', commitManifest);

    // Load initial data when S3 tab is shown
    // This will be called from tabs.js when S3 tab is activated
}

// Export for tabs.js to call when S3 tab is activated
export function onTabActivate() {
    loadManifestSummary();
    loadS3('games/');
}
