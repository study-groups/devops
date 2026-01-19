// Caddy Panel - Refactored for new dashboard layout
const CONFIG = {
    refreshInterval: 10000,
    storageKey: 'caddy-active-tab'
};

// Scanner/bot detection patterns
const SCANNER_PATTERNS = [
    // WordPress probes
    /^\/wp-/i,
    /\/xmlrpc\.php/i,
    /\/wp-login/i,
    /\/wp-admin/i,
    /\/wp-content/i,
    /\/wp-includes/i,
    // Config file probes
    /\/\.env/i,
    /\/\.git/i,
    /\/\.aws/i,
    /\/\.ssh/i,
    /\/\.htaccess/i,
    /\/config\.(php|json|yml|yaml)/i,
    // PHP probes
    /\/phpinfo\.php/i,
    /\/phpmyadmin/i,
    /\/pma\//i,
    /\/myadmin/i,
    /\/adminer/i,
    // Backup/old file probes
    /\.(bak|backup|old|orig|save|swp|tmp)$/i,
    /\/backup/i,
    /\/bak\//i,
    /\/old\//i,
    /\/test\//i,
    // Shell/exploit probes
    /\/shell/i,
    /\/cmd/i,
    /\/eval/i,
    /\/cgi-bin/i,
    /\/\.well-known\/security/i
];

/**
 * Check if a URI is a scanner/bot probe
 */
function isScannerRequest(uri) {
    if (!uri) return false;
    return SCANNER_PATTERNS.some(pattern => pattern.test(uri));
}

const state = {
    org: new URLSearchParams(window.location.search).get('org') || 'tetra',
    env: new URLSearchParams(window.location.search).get('env') || 'local',
    activeTab: localStorage.getItem(CONFIG.storageKey) || 'overview',
    showRaw: false,
    showDebug: false,
    logFilter: '',
    lastLogData: null
};

// DOM elements cache
let els = {};

// =============================================================================
// HELPERS
// =============================================================================

function apiUrl(endpoint) {
    return `/api/caddy/${endpoint}?org=${encodeURIComponent(state.org)}&env=${encodeURIComponent(state.env)}`;
}

/**
 * Format timestamp for display
 * Shows time only for today, date+time for older entries
 */
function formatTime(ts) {
    if (!ts) return '-';

    const d = new Date(ts * 1000);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
        return d.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } else {
        // Show date for older entries
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        }) + ' ' + d.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

/**
 * Format full timestamp for copy/export
 */
function formatFullTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    return d.toISOString();
}

function formatDuration(d) {
    if (!d && d !== 0) return '-';
    if (d < 0.001) return '<1ms';
    if (d < 1) return Math.round(d * 1000) + 'ms';
    return d.toFixed(2) + 's';
}

function statusClass(code) {
    if (!code) return '';
    if (code >= 500) return 's5xx';
    if (code >= 400) return 's4xx';
    if (code >= 300) return 's3xx';
    if (code >= 200) return 's2xx';
    return '';
}

function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
}

function setStatus(status) {
    const dot = document.getElementById('status-dot');
    if (dot) {
        dot.className = 'status-dot ' + status;
    }
}

function setEnvBadge() {
    const badge = document.getElementById('env-badge');
    if (badge) {
        badge.textContent = state.env;
        badge.className = 'env-badge ' + (state.env === 'local' ? 'local' : state.env === 'prod' ? 'prod' : '');
    }
}

function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), duration);
    }
}

// =============================================================================
// TABS
// =============================================================================

function showTab(name) {
    // Update tab states
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === name);
    });

    // Update content visibility
    document.querySelectorAll('.content').forEach(c => {
        c.classList.toggle('hidden', c.id !== `tab-${name}`);
    });

    state.activeTab = name;
    localStorage.setItem(CONFIG.storageKey, name);

    // Load tab-specific data
    if (name === 'logs') loadLogs();
    if (name === 'stats') loadStats();
    if (name === 'ban') loadBan();
    if (name === 'help') loadLogFileInfo();
}

// =============================================================================
// OVERVIEW TAB
// =============================================================================

async function loadStatus() {
    setStatus('loading');

    try {
        const res = await fetch(apiUrl('status'));
        const data = await res.json();

        const online = data.status === 'online';
        setStatus(online ? 'online' : 'offline');

        // Service cards
        if (els.svcStatus) els.svcStatus.textContent = data.status || '--';
        if (els.svcStatus) els.svcStatus.className = 'value ' + (online ? 'good' : 'bad');

        if (els.svcListen) els.svcListen.textContent = data.listen || '--';
        if (els.svcVersion) els.svcVersion.textContent = data.version || '--';
        if (els.svcApi) {
            els.svcApi.textContent = data.adminApi ? 'OK' : '--';
            els.svcApi.className = 'value ' + (data.adminApi ? 'good' : '');
        }

        // Paths
        if (els.cfgFile) els.cfgFile.textContent = data.caddyfile || '--';
        if (els.cfgLog) els.cfgLog.textContent = data.logFile || '--';

    } catch (err) {
        setStatus('offline');
        if (els.svcStatus) {
            els.svcStatus.textContent = 'error';
            els.svcStatus.className = 'value bad';
        }
    }
}

async function loadRoutes() {
    try {
        const res = await fetch(apiUrl('routes'));
        const data = await res.json();

        if (!data.routes || data.routes.length === 0) {
            els.routes.innerHTML = '<div class="empty">(no routes)</div>';
            return;
        }

        els.routes.innerHTML = data.routes.map(route => `
            <div class="route">
                <span class="route-path">${route.path || route.match || '*'}</span>
                <span class="route-arrow">-></span>
                <span class="route-upstream">${route.upstream || route.handler || '-'}</span>
            </div>
        `).join('');
    } catch (err) {
        els.routes.innerHTML = '<div class="error">Failed to load routes</div>';
    }
}

// =============================================================================
// LOGS TAB
// =============================================================================

async function loadLogs() {
    try {
        const res = await fetch(apiUrl('logs') + '&lines=100');
        const data = await res.json();

        state.lastLogData = data;
        renderLogs();

    } catch (err) {
        els.logs.innerHTML = '<div class="error">Failed to load logs</div>';
    }
}

/**
 * Determine log entry type and extract display info
 */
function parseLogEntry(log) {
    // HTTP request entry
    if (log.method || log.uri || (log.status && log.request)) {
        return {
            type: 'request',
            ts: log.ts,
            status: log.status,
            method: log.method || log.request?.method,
            uri: log.uri || log.request?.uri,
            duration: log.duration,
            isError: log.status >= 500
        };
    }

    // Error entry
    if (log.level === 'error') {
        return {
            type: 'error',
            ts: log.ts,
            level: 'error',
            msg: log.msg || log.error || 'Unknown error',
            logger: log.logger
        };
    }

    // Info/debug entry (startup, config reload, etc)
    if (log.level || log.msg) {
        return {
            type: 'info',
            ts: log.ts,
            level: log.level || 'info',
            msg: log.msg || JSON.stringify(log),
            logger: log.logger
        };
    }

    // Raw/unknown
    return {
        type: 'raw',
        raw: log.raw || JSON.stringify(log)
    };
}

/**
 * Calculate insights from filtered logs
 */
function calculateInsights(logs) {
    const insights = {
        total: 0,
        legitimate: 0,
        scanner: 0,
        errors5xx: 0,
        errors502: 0,
        hotPath: null,
        hotPathCount: 0,
        rapidIP: null,
        rapidCount: 0
    };

    if (!logs || logs.length === 0) return insights;

    const pathCounts = {};
    const ipTimestamps = {};

    for (const log of logs) {
        const entry = parseLogEntry(log);
        if (entry.type !== 'request') continue;

        insights.total++;

        // Scanner vs legitimate
        if (isScannerRequest(entry.uri)) {
            insights.scanner++;
        } else {
            insights.legitimate++;

            // Track non-scanner paths for hot path
            const uri = entry.uri || '/';
            // Normalize path (remove query strings)
            const path = uri.split('?')[0];
            pathCounts[path] = (pathCounts[path] || 0) + 1;
            if (pathCounts[path] > insights.hotPathCount) {
                insights.hotPath = path;
                insights.hotPathCount = pathCounts[path];
            }
        }

        // Error counts
        if (entry.status >= 500) {
            insights.errors5xx++;
            if (entry.status === 502) insights.errors502++;
        }

        // Track IP timestamps for rapid request detection
        const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip;
        if (ip && entry.ts) {
            if (!ipTimestamps[ip]) ipTimestamps[ip] = [];
            ipTimestamps[ip].push(entry.ts);
        }
    }

    // Detect rapid requests (more than 10 requests within 5 seconds from same IP)
    for (const [ip, timestamps] of Object.entries(ipTimestamps)) {
        if (timestamps.length < 10) continue;
        timestamps.sort((a, b) => a - b);

        // Check for 10+ requests in any 5-second window
        for (let i = 0; i <= timestamps.length - 10; i++) {
            const windowStart = timestamps[i];
            const windowEnd = timestamps[i + 9];
            if (windowEnd - windowStart <= 5) {
                // Found rapid requests
                if (timestamps.length > insights.rapidCount) {
                    insights.rapidIP = ip;
                    insights.rapidCount = timestamps.length;
                }
                break;
            }
        }
    }

    return insights;
}

/**
 * Render insights bar
 */
function renderInsights(logs) {
    const insightsBar = document.getElementById('insights-bar');
    const trafficEl = document.getElementById('insight-traffic');
    const errorsEl = document.getElementById('insight-errors');
    const hotEl = document.getElementById('insight-hot');
    const alertContainer = document.getElementById('insight-alert-container');
    const alertEl = document.getElementById('insight-alert');

    if (!insightsBar) return;

    if (!logs || logs.length === 0) {
        insightsBar.classList.add('hidden');
        return;
    }

    const insights = calculateInsights(logs);
    insightsBar.classList.remove('hidden');

    // Traffic breakdown
    if (trafficEl) {
        trafficEl.textContent = `${insights.legitimate}/${insights.total}`;
        if (insights.scanner > insights.legitimate) {
            trafficEl.className = 'insight-value warn';
        } else {
            trafficEl.className = 'insight-value good';
        }
    }

    // Errors
    if (errorsEl) {
        errorsEl.textContent = insights.errors5xx.toString();
        if (insights.errors5xx > 0) {
            errorsEl.className = 'insight-value bad';
        } else {
            errorsEl.className = 'insight-value good';
        }
    }

    // Hot path
    if (hotEl) {
        if (insights.hotPath) {
            // Truncate long paths
            const displayPath = insights.hotPath.length > 20
                ? insights.hotPath.slice(0, 20) + '...'
                : insights.hotPath;
            hotEl.textContent = displayPath;
            hotEl.title = insights.hotPath;
        } else {
            hotEl.textContent = '-';
            hotEl.title = '';
        }
    }

    // Rapid request alert
    if (alertContainer && alertEl) {
        if (insights.rapidIP) {
            alertContainer.style.display = '';
            alertEl.textContent = `! ${insights.rapidIP} rapid (${insights.rapidCount})`;
        } else {
            alertContainer.style.display = 'none';
        }
    }
}

/**
 * Get filtered logs based on current filter
 */
function getFilteredLogs() {
    const data = state.lastLogData;
    if (!data || !data.logs) return [];

    let logs = data.logs;
    if (state.logFilter) {
        const filter = state.logFilter.toLowerCase();
        logs = logs.filter(log => {
            const text = (log.uri || '') + (log.method || '') + (log.status || '') +
                        (log.msg || '') + (log.raw || '');
            return text.toLowerCase().includes(filter);
        });
    }
    return logs;
}

/**
 * Update copy button badge
 */
function updateCopyBadge(count) {
    const badge = document.getElementById('copy-badge');
    if (badge) {
        badge.textContent = count;
        badge.className = count > 0 ? 'btn-badge' : 'btn-badge zero';
    }
}

function renderLogs() {
    const data = state.lastLogData;
    if (!data) return;

    // Update debug box
    if (state.showDebug && els.debugData) {
        els.debugData.textContent = JSON.stringify(data, null, 2);
        els.debugBox.classList.add('show');
    } else if (els.debugBox) {
        els.debugBox.classList.remove('show');
    }

    if (data.message) {
        els.logs.innerHTML = `<div class="log-raw">${data.message}</div>`;
        if (data.source) {
            els.logs.innerHTML += `<div class="log-raw">Source: ${data.source}</div>`;
        }
    }

    if (!data.logs || data.logs.length === 0) {
        if (!data.message) {
            els.logs.innerHTML = '<div class="empty">(no logs)</div>';
        }
        renderInsights([]);
        updateCopyBadge(0);
        return;
    }

    // Get filtered logs
    const logs = getFilteredLogs();

    // Update insights bar and copy badge
    renderInsights(logs);
    updateCopyBadge(logs.length);

    if (state.showRaw) {
        // Raw mode - show JSON
        els.logs.innerHTML = logs.map(log =>
            `<div class="log-raw">${log.raw || JSON.stringify(log)}</div>`
        ).join('');
    } else {
        // Structured mode
        els.logs.innerHTML = logs.map(log => {
            const entry = parseLogEntry(log);

            if (entry.type === 'request') {
                const rowClass = entry.isError ? 'log-row log-error' : 'log-row';
                return `
                    <div class="${rowClass}">
                        <span class="log-time">${formatTime(entry.ts)}</span>
                        <span class="log-status ${statusClass(entry.status)}">${entry.status || '-'}</span>
                        <span class="log-method">${entry.method || '-'}</span>
                        <span class="log-uri" title="${entry.uri || ''}">${entry.uri || '-'}</span>
                        <span class="log-dur">${formatDuration(entry.duration)}</span>
                    </div>
                `;
            }

            if (entry.type === 'error') {
                return `
                    <div class="log-row log-error">
                        <span class="log-time">${formatTime(entry.ts)}</span>
                        <span class="log-status s5xx">ERR</span>
                        <span class="log-msg" title="${entry.msg}">${entry.msg}</span>
                    </div>
                `;
            }

            if (entry.type === 'info') {
                return `
                    <div class="log-row log-info">
                        <span class="log-time">${formatTime(entry.ts)}</span>
                        <span class="log-status">${entry.level?.toUpperCase()?.slice(0,3) || 'INF'}</span>
                        <span class="log-msg" title="${entry.msg}">${entry.msg}</span>
                    </div>
                `;
            }

            // Raw fallback
            return `<div class="log-raw">${entry.raw}</div>`;
        }).join('');
    }
}

function toggleRaw() {
    state.showRaw = !state.showRaw;
    const btn = document.getElementById('btn-raw');
    if (btn) btn.classList.toggle('active', state.showRaw);
    renderLogs();
}

function toggleDebug() {
    state.showDebug = !state.showDebug;
    const btn = document.getElementById('btn-debug');
    if (btn) btn.classList.toggle('active', state.showDebug);
    renderLogs();
}

function handleLogFilter(e) {
    state.logFilter = e.target.value;
    renderLogs();
}

/**
 * Copy logs to clipboard in a readable format
 * Only copies currently filtered/displayed logs
 */
function copyLogs() {
    const logs = getFilteredLogs();

    if (logs.length === 0) {
        showToast('No logs to copy');
        return;
    }

    // Format logs for clipboard
    const lines = logs.map(log => {
        const entry = parseLogEntry(log);

        if (entry.type === 'request') {
            return `${formatFullTime(entry.ts)}\t${entry.status || '-'}\t${entry.method || '-'}\t${entry.uri || '-'}\t${formatDuration(entry.duration)}`;
        }

        if (entry.type === 'error' || entry.type === 'info') {
            return `${formatFullTime(entry.ts)}\t${entry.level?.toUpperCase() || 'INFO'}\t${entry.msg}`;
        }

        return entry.raw || JSON.stringify(log);
    });

    // Add header
    const header = 'Timestamp\tStatus\tMethod\tPath\tDuration';
    const text = header + '\n' + lines.join('\n');

    navigator.clipboard.writeText(text).then(() => {
        const filterNote = state.logFilter ? ' (filtered)' : '';
        showToast(`Copied ${logs.length} log entries${filterNote}`);
    }).catch(err => {
        showToast('Failed to copy: ' + err.message);
    });
}

// =============================================================================
// STATS TAB
// =============================================================================

async function loadStats() {
    try {
        const res = await fetch(apiUrl('stats'));
        const data = await res.json();

        if (data.message) {
            if (els.statTotal) els.statTotal.textContent = '--';
            return;
        }

        const s = data.summary || {};

        // Summary cards
        if (els.statTotal) els.statTotal.textContent = formatNumber(s.totalRequests || 0);

        if (els.statErrors) {
            els.statErrors.textContent = s.errorCount || 0;
            const errorRate = s.totalRequests > 0 ? (s.errorCount / s.totalRequests) * 100 : 0;
            els.statErrors.className = 'value ' + (errorRate > 5 ? 'bad' : errorRate > 1 ? 'warn' : 'good');
        }

        if (els.statLatency) els.statLatency.textContent = s.avgDuration ? s.avgDuration + 's' : '--';
        if (els.statIps) els.statIps.textContent = s.uniqueIPs || 0;

        // Top paths
        renderTopList(els.topPaths, data.topPaths, 'path');

        // Status codes
        renderTopList(els.topCodes, data.statusCodes, 'code', (item) =>
            `<span class="log-status ${statusClass(parseInt(item.code))}">${item.code}</span>`
        );

        // Top IPs
        renderTopList(els.topIps, data.topIPs, 'ip');

    } catch (err) {
        if (els.statTotal) els.statTotal.textContent = 'err';
    }
}

function renderTopList(container, items, valueKey, customRender) {
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="empty">(no data)</div>';
        return;
    }

    container.innerHTML = items.map(item => `
        <div class="top-row">
            <span class="top-count">${item.count}</span>
            ${customRender ? customRender(item) : `<span class="top-value">${item[valueKey]}</span>`}
            <div class="top-bar"><div class="top-bar-fill" style="width: ${item.percent || 0}%"></div></div>
        </div>
    `).join('');
}

// =============================================================================
// HELP TAB - Log file info
// =============================================================================

async function loadLogFileInfo() {
    try {
        const res = await fetch(apiUrl('metadata'));
        const data = await res.json();

        // Update log file info in Help tab
        const sizeEl = document.getElementById('log-info-size');
        const entriesEl = document.getElementById('log-info-entries');
        const modifiedEl = document.getElementById('log-info-modified');

        if (data.logFile) {
            if (sizeEl) sizeEl.textContent = data.logFile.size || '--';
            if (entriesEl) entriesEl.textContent = data.logFile.lines ? formatNumber(data.logFile.lines) : '--';
            if (modifiedEl) modifiedEl.textContent = data.logFile.modified || '--';
        } else if (data.files && data.files.length > 0) {
            // Remote environment - show first file info
            const file = data.files[0];
            if (sizeEl) sizeEl.textContent = file.size || '--';
            if (entriesEl) entriesEl.textContent = '--';
            if (modifiedEl) modifiedEl.textContent = file.age || '--';
        }
    } catch (err) {
        console.warn('[Caddy] Failed to load log file info:', err.message);
    }
}

// =============================================================================
// BAN TAB
// =============================================================================

async function loadBan() {
    try {
        const res = await fetch(apiUrl('fail2ban'));
        const data = await res.json();

        // Status cards
        if (els.f2bStatus) {
            els.f2bStatus.textContent = data.status || (data.active ? 'active' : 'inactive');
            els.f2bStatus.className = 'value ' + (data.active ? 'good' : '');
        }

        if (els.f2bJails) els.f2bJails.textContent = data.jails?.length || 0;
        if (els.f2bTotal) els.f2bTotal.textContent = data.totalBanned || 0;

        // Tab badge
        const badge = document.getElementById('ban-count');
        if (badge) {
            badge.textContent = data.totalBanned || 0;
            badge.className = 'count ' + (data.totalBanned > 0 ? '' : 'zero');
        }

        // Banned IPs
        if (els.banList) {
            if (data.banned && data.banned.length > 0) {
                els.banList.innerHTML = data.banned.map(b => `
                    <div class="ban-row">
                        <span class="ban-ip">${b.ip}</span>
                        <span class="ban-jail">${b.jail}</span>
                        <span class="ban-time">${b.time || ''}</span>
                    </div>
                `).join('');
            } else {
                els.banList.innerHTML = '<div class="empty">None</div>';
            }
        }

        // Recent activity
        if (els.banRecent) {
            if (data.recent && data.recent.length > 0) {
                els.banRecent.innerHTML = data.recent.map(r => `
                    <div class="top-row">
                        <span class="top-count">${r.time || ''}</span>
                        <span class="top-value">${r.action || ''} ${r.ip || r.raw || ''}</span>
                        <span></span>
                    </div>
                `).join('');
            } else {
                els.banRecent.innerHTML = '<div class="empty">No activity</div>';
            }
        }

    } catch (err) {
        if (els.f2bStatus) {
            els.f2bStatus.textContent = 'error';
            els.f2bStatus.className = 'value bad';
        }
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function loadAll() {
    loadStatus();
    loadRoutes();
}

function handleMessage(msg) {
    if (msg.type === 'env-change') {
        state.org = msg.org || state.org;
        state.env = msg.env || state.env;
        setEnvBadge();
        loadAll();
        showTab(state.activeTab);
    }
}

function init() {
    // Cache DOM elements
    els = {
        // Overview
        svcStatus: document.getElementById('svc-status'),
        svcListen: document.getElementById('svc-listen'),
        svcVersion: document.getElementById('svc-version'),
        svcApi: document.getElementById('svc-api'),
        routes: document.getElementById('routes'),
        cfgFile: document.getElementById('cfg-file'),
        cfgLog: document.getElementById('cfg-log'),

        // Logs
        logs: document.getElementById('logs'),
        logFilter: document.getElementById('log-filter'),
        debugBox: document.getElementById('debug-box'),
        debugData: document.getElementById('debug-data'),

        // Stats
        statTotal: document.getElementById('stat-total'),
        statErrors: document.getElementById('stat-errors'),
        statLatency: document.getElementById('stat-latency'),
        statIps: document.getElementById('stat-ips'),
        topPaths: document.getElementById('top-paths'),
        topCodes: document.getElementById('top-codes'),
        topIps: document.getElementById('top-ips'),

        // Ban
        f2bStatus: document.getElementById('f2b-status'),
        f2bJails: document.getElementById('f2b-jails'),
        f2bTotal: document.getElementById('f2b-total'),
        banList: document.getElementById('ban-list'),
        banRecent: document.getElementById('ban-recent')
    };

    // Tab clicks
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => showTab(tab.dataset.tab));
    });

    // Refresh button
    document.querySelector('[data-action="refresh"]')?.addEventListener('click', () => {
        loadAll();
        showTab(state.activeTab);
    });

    // Log toolbar
    document.getElementById('btn-copy')?.addEventListener('click', copyLogs);
    document.getElementById('btn-raw')?.addEventListener('click', toggleRaw);
    document.getElementById('btn-debug')?.addEventListener('click', toggleDebug);
    document.getElementById('log-filter')?.addEventListener('input', handleLogFilter);

    // Set initial env badge
    setEnvBadge();

    // Initialize Terrain.Iframe if available
    if (window.Terrain?.Iframe) {
        Terrain.Iframe.init({
            name: 'caddy',
            onMessage: handleMessage
        });
    }

    // Load initial data
    loadAll();
    showTab(state.activeTab);

    // Auto-refresh
    setInterval(loadAll, CONFIG.refreshInterval);
}

// Start when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
