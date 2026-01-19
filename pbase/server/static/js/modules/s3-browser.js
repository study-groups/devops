/**
 * S3 Browser tab module
 */

import { store } from './store.js';
import { api, formatBytes } from './api.js';

let currentSelectedFile = null;

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function showFileContent(key, name) {
    const contentPane = document.getElementById('s3-content');
    const contentHeader = document.getElementById('s3-content-header');
    const contentBody = document.getElementById('s3-content-body');

    // Update selection state
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

    // Add close handler
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

    // Hide content pane when navigating
    if (contentPane) {
        contentPane.classList.remove('visible');
    }
    currentSelectedFile = null;

    // Update breadcrumb
    const parts = prefix.split('/').filter(Boolean);
    breadcrumb.innerHTML = '<button class="crumb" data-prefix="">root</button>';
    let path = '';
    parts.forEach(part => {
        path += part + '/';
        breadcrumb.innerHTML += `<button class="crumb" data-prefix="${path}">${part}</button>`;
    });

    // Add click handlers to breadcrumbs
    breadcrumb.querySelectorAll('.crumb').forEach(crumb => {
        crumb.addEventListener('click', () => loadS3(crumb.dataset.prefix));
    });

    s3List.innerHTML = '<div class="file-item">Loading...</div>';

    try {
        const result = await api(`/s3/list?prefix=${encodeURIComponent(prefix)}&delimiter=true`);

        s3List.innerHTML = '';

        // Add folders (prefixes)
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

        // Add files
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

export function init() {
    // S3 tab loads on demand via tabs
}
