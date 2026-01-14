/**
 * Tab navigation module
 */

import { loadGames } from './games.js';
import { loadS3 } from './s3-browser.js';
import { loadConfig } from './config.js';
import { loadUsers } from './admin.js';

function loadTabData(tab) {
    switch (tab) {
        case 'games':
            loadGames();
            break;
        case 's3':
            loadS3('');
            break;
        case 'config':
            loadConfig();
            break;
        case 'admin':
            loadUsers();
            break;
    }
}

export function init() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // Update buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');

            // Load tab data
            loadTabData(btn.dataset.tab);
        });
    });
}

export { loadTabData };
