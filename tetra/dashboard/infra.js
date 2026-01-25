// Infrastructure Browser Module

const Infra = (function() {
    'use strict';

    // State
    let orgData = { servers: {}, inventory: {} };

    // DOM references
    const dom = {
        grid: () => document.getElementById('server-grid'),
        panel: () => document.getElementById('detail-panel'),
        detailBody: () => document.getElementById('detail-body'),
        backupStatus: () => document.getElementById('backup-status')
    };

    // Template helpers
    const html = {
        userItem: (name, size) =>
            `<div class="user-item">
                <span class="user-name">${esc(name)}</span>
                <span class="user-size">${esc(size)}</span>
            </div>`,

        userOverflow: (count) =>
            `<div class="user-item" style="color:var(--ink-muted)">+${count} more</div>`,

        dirItem: (name, size, excluded) =>
            `<div class="dir-item ${excluded ? 'excluded' : ''}">
                <span class="dir-name">${esc(name)}/</span>
                <span class="dir-size">${esc(size)}</span>
            </div>`,

        serverCard: (name, cfg, inv) => {
            const status = cfg.status || 'unknown';
            const homeUsers = inv.home ? Object.keys(inv.home) : [];
            const usersHtml = buildUserList(homeUsers, inv.home);

            return `
                <span class="server-badge ${status}">${status}</span>
                <div class="server-name">${esc(name)}</div>
                <div class="server-ip">${esc(cfg.ip)}</div>
                <div class="server-desc">${esc(cfg.description || '')}</div>
                <div class="server-stats">
                    <span>${homeUsers.length} users</span>
                    ${inv.system ? `<span>${esc(inv.system.disk_used)} disk</span>` : ''}
                </div>
                ${usersHtml}
            `;
        },

        detailPanel: (name, cfg, inv) => {
            let content = `
                <div class="detail-title">${esc(name)}</div>
                <div style="font-size:10px;color:var(--ink-muted);margin-bottom:8px;">${esc(cfg.ip)}</div>
                <p style="font-size:10px;">${esc(cfg.description || '')}</p>
            `;

            if (inv.system) {
                content += `
                    <div class="detail-section">
                        <div class="detail-section-title">System</div>
                        <div style="font-size:9px;">
                            OS: ${esc(inv.system.os)}<br>
                            Disk: ${esc(inv.system.disk_used)} (${esc(inv.system.disk_avail)} free)<br>
                            Uptime: ${esc(inv.system.uptime)}
                        </div>
                    </div>
                `;
            }

            if (inv.home && Object.keys(inv.home).length > 0) {
                content += `<div class="detail-section"><div class="detail-section-title">/home</div>`;
                for (const [user, data] of Object.entries(inv.home)) {
                    content += `<div style="margin:8px 0;">
                        <strong style="color:var(--three)">${esc(user)}</strong>
                        <span style="color:var(--ink-muted)">${esc(data.size)}</span>
                    </div>`;
                    if (data.dirs && data.dirs.length > 0) {
                        data.dirs.forEach(d => {
                            const excluded = cfg.exclude && cfg.exclude.includes(d.name);
                            content += html.dirItem(d.name, d.size, excluded);
                        });
                    }
                }
                content += '</div>';
            }

            if (inv.www && Object.keys(inv.www).length > 0) {
                content += `<div class="detail-section"><div class="detail-section-title">/var/www</div>`;
                for (const [site, data] of Object.entries(inv.www)) {
                    content += html.dirItem(site, data.size, false);
                }
                content += '</div>';
            }

            content += `
                <div class="detail-section">
                    <div class="detail-section-title">Actions</div>
                    <button class="btn" data-copy="ssh root@${esc(cfg.ip)}">SSH</button>
                    <button class="btn" data-copy="./backup-${esc(name)}.sh --dry-run">Dry Run</button>
                    <button class="btn primary" data-copy="./backup-${esc(name)}.sh">Backup</button>
                    <div class="cmd">ssh root@${esc(cfg.ip)}</div>
                </div>
            `;

            return content;
        },

        loading: () => '<div class="loading">Loading infrastructure data...</div>',
        error: (msg) => `<div class="error">${esc(msg)}</div>`
    };

    // Escape HTML to prevent XSS
    function esc(str) {
        if (str == null) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // Build user list HTML for card
    function buildUserList(users, homeData) {
        if (users.length === 0) return '';

        let content = '<div class="user-list">';
        users.slice(0, 3).forEach(u => {
            content += html.userItem(u, homeData[u].size || '?');
        });
        if (users.length > 3) {
            content += html.userOverflow(users.length - 3);
        }
        content += '</div>';
        return content;
    }

    // Get fallback data from embedded JSON
    function getFallbackData() {
        const el = document.getElementById('fallback-data');
        if (el) {
            try {
                return JSON.parse(el.textContent);
            } catch (e) {
                console.error('Failed to parse fallback data:', e);
            }
        }
        return { org: 'unknown', servers: {}, inventory: {} };
    }

    // Load data from API or fallback
    async function loadData() {
        const grid = dom.grid();
        grid.innerHTML = html.loading();

        try {
            const resp = await fetch('/api/infra/data');
            if (resp.ok) {
                orgData = await resp.json();
            } else {
                console.warn('API returned', resp.status, '- using fallback data');
                orgData = getFallbackData();
            }
        } catch (e) {
            console.warn('Failed to fetch infra data:', e.message, '- using fallback');
            orgData = getFallbackData();
        }

        renderServers();
    }

    // Render server cards
    function renderServers() {
        const grid = dom.grid();
        grid.innerHTML = '';

        const servers = Object.entries(orgData.servers)
            .sort((a, b) => (a[1].priority || 99) - (b[1].priority || 99));

        if (servers.length === 0) {
            grid.innerHTML = html.error('No servers configured');
            return;
        }

        servers.forEach(([name, cfg]) => {
            const inv = orgData.inventory[name] || {};
            const status = cfg.status || 'unknown';

            const card = document.createElement('div');
            card.className = 'server-card ' + status;
            card.dataset.server = name;
            card.innerHTML = html.serverCard(name, cfg, inv);
            grid.appendChild(card);
        });
    }

    // Show detail panel for a server
    function showDetail(name) {
        const cfg = orgData.servers[name];
        if (!cfg) return;

        const inv = orgData.inventory[name] || {};
        const panel = dom.panel();
        const body = dom.detailBody();

        body.innerHTML = html.detailPanel(name, cfg, inv);
        panel.classList.add('open');
    }

    // Close detail panel
    function closeDetail() {
        dom.panel().classList.remove('open');
    }

    // Copy text to clipboard
    function copyText(text) {
        navigator.clipboard.writeText(text).catch(err => {
            console.error('Failed to copy:', err);
        });
    }

    // Initialize tab switching
    function initTabs() {
        document.querySelectorAll('.infra-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.infra-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                tab.classList.add('active');
                document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
            });
        });
    }

    // Initialize event delegation
    function initEvents() {
        // Server card clicks (event delegation)
        dom.grid().addEventListener('click', e => {
            const card = e.target.closest('.server-card');
            if (card && card.dataset.server) {
                showDetail(card.dataset.server);
            }
        });

        // Detail panel close
        document.querySelector('.detail-close').addEventListener('click', closeDetail);

        // Detail panel copy buttons (event delegation)
        dom.panel().addEventListener('click', e => {
            const btn = e.target.closest('[data-copy]');
            if (btn) {
                copyText(btn.dataset.copy);
            }
        });

        // Refresh button
        const refreshBtn = document.querySelector('[data-action="refresh"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadData);
        }
    }

    // Initialize module
    function init() {
        initTabs();
        initEvents();
        loadData();
    }

    // Public API
    return {
        init,
        loadData,
        closeDetail
    };
})();

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', Infra.init);
