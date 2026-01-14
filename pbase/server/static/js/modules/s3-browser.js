/**
 * S3 Browser tab module
 */

import { store } from './store.js';
import { api, formatBytes } from './api.js';

export async function loadS3(prefix) {
    store.set('currentS3Prefix', prefix);
    const s3List = document.getElementById('s3-list');
    const breadcrumb = document.getElementById('s3-breadcrumb');

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
                window.open(`/api/s3/get?key=${encodeURIComponent(obj.key)}`, '_blank');
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
