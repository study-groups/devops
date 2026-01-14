/**
 * API helper module
 */

import { store } from './store.js';

export async function api(endpoint, options = {}) {
    const headers = { ...options.headers };

    const jwtToken = store.get('jwtToken');
    const authCredentials = store.get('authCredentials');

    if (jwtToken) {
        headers['Authorization'] = `Bearer ${jwtToken}`;
    } else if (authCredentials) {
        const basic = btoa(`${authCredentials.username}:${authCredentials.password}`);
        headers['Authorization'] = `Basic ${basic}`;
    }

    if (options.body && typeof options.body === 'object') {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    const response = await fetch(`/api${endpoint}`, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || data.error || 'Request failed');
    }

    return data;
}

export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
