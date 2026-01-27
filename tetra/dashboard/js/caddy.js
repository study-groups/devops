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

/**
 * Group scanner bursts - collapses rapid requests from same IP within time window
 * Returns array of logs with scanner bursts replaced by group objects
 */
function groupScannerBursts(logs, windowSecs = 60, minBurst = 5) {
    if (!logs || logs.length === 0) return [];

    const result = [];
    const ipBuckets = new Map(); // ip -> array of consecutive scanner logs

    function flushBucket(ip) {
        const bucket = ipBuckets.get(ip);
        if (!bucket || bucket.length === 0) return;

        if (bucket.length >= minBurst) {
            // Collapse into group
            const paths = [...new Set(bucket.map(l => {
                const uri = l.uri || l.request?.uri || '';
                return uri.split('?')[0];
            }))].slice(0, 3);

            result.push({
                type: 'scanner-group',
                ip: ip,
                count: bucket.length,
                paths: paths,
                tsStart: bucket[0].ts,
                tsEnd: bucket[bucket.length - 1].ts,
                statuses: [...new Set(bucket.map(l => l.status))].sort()
            });
        } else {
            // Not enough to group, add individually
            result.push(...bucket);
        }
        ipBuckets.set(ip, []);
    }

    for (const log of logs) {
        const entry = parseLogEntry(log);
        const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip || '';
        const isScanner = entry.type === 'request' && isScannerRequest(entry.uri);

        if (isScanner && ip) {
            const bucket = ipBuckets.get(ip) || [];

            // Check if this continues the current burst (within time window)
            if (bucket.length > 0) {
                const lastTs = bucket[bucket.length - 1].ts || 0;
                const currentTs = log.ts || 0;
                if (currentTs - lastTs > windowSecs) {
                    // Time gap too large, flush and start new bucket
                    flushBucket(ip);
                }
            }

            const newBucket = ipBuckets.get(ip) || [];
            newBucket.push(log);
            ipBuckets.set(ip, newBucket);
        } else {
            // Non-scanner request - flush any pending bucket for this IP and add the log
            if (ip && ipBuckets.has(ip)) {
                flushBucket(ip);
            }
            result.push(log);
        }
    }

    // Flush remaining buckets
    for (const ip of ipBuckets.keys()) {
        flushBucket(ip);
    }

    return result;
}

// Parse all URL params generically (for standalone usage)
const urlParams = new URLSearchParams(window.location.search);

const state = {
    org: urlParams.get('org') || 'tetra',
    env: urlParams.get('env') || 'local',
    activeTab: urlParams.get('tab') || localStorage.getItem(CONFIG.storageKey) || 'overview',
    showRaw: urlParams.get('raw') === 'true' || false,
    showDebug: urlParams.get('debug') === 'true' || false,
    logFilter: urlParams.get('filter') || '',
    timeFilter: urlParams.get('time') || 'all', // 'all', '1h', '24h', 'today'
    lastLogData: null,
    autoRefresh: urlParams.get('refresh') !== 'false',
    refreshIntervalId: null,
    followMode: urlParams.get('follow') === 'true' || false,
    followIntervalId: null,
    logDetailsMap: new Map(), // Maps row index to full log object
    selectedLogDetail: null,
    groupPaths: urlParams.get('group') === 'true' || false,
    lastStatsData: null,
    hideInternal: true // Hide INFO/NOP entries by default
};

// Attack detection patterns (path traversal, LFI, etc.)
const ATTACK_PATTERNS = [
    /\.\.\//,                    // Path traversal
    /\.\.%2f/i,                  // URL-encoded path traversal
    /\.\.%5c/i,                  // URL-encoded backslash traversal
    /%2e%2e/i,                   // Double-encoded dots
    /%c0%ae/i,                   // Overlong UTF-8 encoding
    /%252e/i,                    // Double URL encoding
    /etc\/passwd/i,              // passwd file access
    /etc\/shadow/i,              // shadow file access
    /\.ssh\/id_rsa/i,            // SSH key access
    /\.bash_history/i,           // bash history
    /win\.ini/i,                 // Windows ini
    /system32\/config/i,         // Windows SAM
    /proc\/self/i,               // Linux proc
];

function isAttackRequest(uri) {
    if (!uri) return false;
    return ATTACK_PATTERNS.some(pattern => pattern.test(uri));
}

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

        // Normalize: API may return {error: "..."} instead of {message: "..."}
        if (data.error && !data.message) {
            data.message = data.error;
        }

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
 * Render time histogram showing request distribution
 */
function renderHistogram(logs) {
    const histogram = document.getElementById('time-histogram');
    const barsContainer = document.getElementById('histogram-bars');
    const startLabel = document.getElementById('histogram-start');
    const endLabel = document.getElementById('histogram-end');

    if (!histogram || !barsContainer) return;

    if (!logs || logs.length === 0) {
        histogram.classList.add('hidden');
        return;
    }

    // Get timestamps from logs
    const timestamps = logs
        .map(log => log.ts)
        .filter(ts => ts && ts > 0)
        .sort((a, b) => a - b);

    if (timestamps.length < 2) {
        histogram.classList.add('hidden');
        return;
    }

    histogram.classList.remove('hidden');

    const minTs = timestamps[0];
    const maxTs = timestamps[timestamps.length - 1];
    const range = maxTs - minTs;

    // Create 20 buckets
    const numBuckets = 20;
    const buckets = new Array(numBuckets).fill(0);
    const errorBuckets = new Array(numBuckets).fill(0);
    const bucketSize = range / numBuckets;

    for (const log of logs) {
        if (!log.ts) continue;
        const bucketIndex = Math.min(Math.floor((log.ts - minTs) / bucketSize), numBuckets - 1);
        buckets[bucketIndex]++;

        // Track errors
        const status = log.status || 0;
        if (status >= 500) {
            errorBuckets[bucketIndex]++;
        }
    }

    const maxCount = Math.max(...buckets, 1);

    // Render bars
    barsContainer.innerHTML = buckets.map((count, i) => {
        const height = Math.max(2, (count / maxCount) * 100);
        const hasError = errorBuckets[i] > 0;
        const errorClass = hasError ? ' has-error' : '';
        const bucketStart = new Date((minTs + i * bucketSize) * 1000);
        const title = `${count} requests${hasError ? ` (${errorBuckets[i]} errors)` : ''} at ${bucketStart.toLocaleTimeString()}`;
        return `<div class="histogram-bar${errorClass}" style="height: ${height}%" title="${title}"></div>`;
    }).join('');

    // Update labels
    if (startLabel) startLabel.textContent = formatTime(minTs);
    if (endLabel) endLabel.textContent = formatTime(maxTs);
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
 * Get time cutoff timestamp based on filter setting
 */
function getTimeCutoff(filter) {
    const now = Date.now() / 1000; // Unix timestamp in seconds
    switch (filter) {
        case '1h':
            return now - 3600;
        case '24h':
            return now - 86400;
        case 'today': {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today.getTime() / 1000;
        }
        default:
            return 0;
    }
}

/**
 * Get filtered logs based on current filters (text + time + internal)
 */
function getFilteredLogs() {
    const data = state.lastLogData;
    if (!data || !data.logs) return [];

    let logs = data.logs;

    // Filter out internal NOP entries if enabled
    if (state.hideInternal) {
        logs = logs.filter(log => {
            // Keep anything with request data (top-level or nested)
            if (log.method || log.status || log.uri) return true;
            if (log.request?.method || log.request?.uri) return true;
            // Filter out NOP/internal messages that have no request context
            if (log.msg === 'NOP' || log.msg === 'handled request') return false;
            // Keep errors
            if (log.level === 'error') return true;
            // Filter other info messages
            return false;
        });
    }

    // Apply time filter
    if (state.timeFilter && state.timeFilter !== 'all') {
        const cutoff = getTimeCutoff(state.timeFilter);
        logs = logs.filter(log => {
            const ts = log.ts || 0;
            return ts >= cutoff;
        });
    }

    // Apply text filter
    if (state.logFilter) {
        const filter = state.logFilter.toLowerCase();
        // Check if it's a regex pattern (for LFI filter)
        let isRegex = false;
        let regex = null;
        try {
            if (filter.includes('\\') || filter.includes('|') || filter.includes('.')) {
                regex = new RegExp(filter, 'i');
                isRegex = true;
            }
        } catch (e) { /* not a valid regex */ }

        logs = logs.filter(log => {
            const text = (log.uri || '') + (log.method || '') + (log.status || '') +
                        (log.msg || '') + (log.raw || '');
            if (isRegex && regex) {
                return regex.test(text);
            }
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

    // Update insights bar, histogram, and copy badge
    renderInsights(logs);
    renderHistogram(logs);
    updateCopyBadge(logs.length);

    // Clear log details map
    state.logDetailsMap.clear();

    if (state.showRaw) {
        // Raw mode - show JSON
        els.logs.innerHTML = logs.map(log =>
            `<div class="log-raw">${log.raw || JSON.stringify(log)}</div>`
        ).join('');
    } else {
        // Structured mode with scanner grouping
        const groupedLogs = groupScannerBursts(logs);
        let rowIndex = 0;

        els.logs.innerHTML = groupedLogs.map(log => {
            // Scanner group row (not clickable for details)
            if (log.type === 'scanner-group') {
                const pathsDisplay = log.paths.join(', ') + (log.paths.length < log.count ? '...' : '');
                const statusDisplay = log.statuses.map(s => `<span class="log-status ${statusClass(s)}">${s}</span>`).join(' ');
                return `
                    <div class="log-row scanner-group" title="Scanner burst from ${log.ip}">
                        <span class="log-time">${formatTime(log.tsStart)}</span>
                        <span class="scanner-count">${log.count}×</span>
                        <span class="scanner-info">
                            <span class="scanner-ip">${log.ip}</span>
                            <span class="scanner-paths">${pathsDisplay}</span>
                            ${statusDisplay}
                        </span>
                    </div>
                `;
            }

            // Store log for detail view
            const currentIndex = rowIndex++;
            state.logDetailsMap.set(currentIndex, log);

            const entry = parseLogEntry(log);
            const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip || '';

            if (entry.type === 'request') {
                // Determine row classes based on error/attack status
                const isAttack = isAttackRequest(entry.uri);
                let rowClass = 'log-row';
                if (isAttack) {
                    rowClass += ' attack';
                } else if (entry.isError) {
                    rowClass += ' log-error';
                }

                return `
                    <div class="${rowClass}" data-log-index="${currentIndex}">
                        <span class="log-time">${formatTime(entry.ts)}</span>
                        <span class="log-status ${statusClass(entry.status)}">${entry.status || '-'}</span>
                        <span class="log-method">${entry.method || '-'}</span>
                        <span class="log-ip" title="${ip}">${ip || '-'}</span>
                        <span class="log-uri" title="${entry.uri || ''}">${entry.uri || '-'}</span>
                        <span class="log-dur">${formatDuration(entry.duration)}</span>
                    </div>
                `;
            }

            if (entry.type === 'error') {
                return `
                    <div class="log-row log-error" data-log-index="${currentIndex}">
                        <span class="log-time">${formatTime(entry.ts)}</span>
                        <span class="log-status s5xx">ERR</span>
                        <span class="log-msg" title="${entry.msg}">${entry.msg}</span>
                    </div>
                `;
            }

            if (entry.type === 'info') {
                return `
                    <div class="log-row log-info" data-log-index="${currentIndex}">
                        <span class="log-time">${formatTime(entry.ts)}</span>
                        <span class="log-status">${entry.level?.toUpperCase()?.slice(0,3) || 'INF'}</span>
                        <span class="log-msg" title="${entry.msg}">${entry.msg}</span>
                    </div>
                `;
            }

            // Raw fallback
            return `<div class="log-raw">${entry.raw}</div>`;
        }).join('');

        // Add click handlers for log rows
        els.logs.querySelectorAll('[data-log-index]').forEach(row => {
            row.addEventListener('click', () => {
                const index = parseInt(row.dataset.logIndex, 10);
                showLogDetail(index);
            });
        });
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
    // Clear preset active state when typing
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
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

    // Count attacks for summary
    let attackCount = 0;

    // Format logs for clipboard
    const lines = logs.map(log => {
        const entry = parseLogEntry(log);
        const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip || '-';

        if (entry.type === 'request') {
            const isAttack = isAttackRequest(entry.uri);
            if (isAttack) attackCount++;
            const marker = isAttack ? '[ATTACK] ' : '';
            return `${marker}${formatFullTime(entry.ts)}\t${entry.status || '-'}\t${entry.method || '-'}\t${ip}\t${entry.uri || '-'}\t${formatDuration(entry.duration)}`;
        }

        if (entry.type === 'error' || entry.type === 'info') {
            return `${formatFullTime(entry.ts)}\t${entry.level?.toUpperCase() || 'INFO'}\t-\t${entry.msg}`;
        }

        return entry.raw || JSON.stringify(log);
    });

    // Add header with summary
    let text = `Caddy Logs - ${state.org}/${state.env}\n`;
    text += `Exported: ${new Date().toISOString()}\n`;
    text += `Entries: ${logs.length}`;
    if (attackCount > 0) {
        text += ` (${attackCount} attacks detected)`;
    }
    text += '\n\n';
    text += 'Timestamp\tStatus\tMethod\tIP\tPath\tDuration\n';
    text += lines.join('\n');

    navigator.clipboard.writeText(text).then(() => {
        const filterNote = state.logFilter ? ' (filtered)' : '';
        showToast(`Copied ${logs.length} log entries${filterNote}`);
    }).catch(err => {
        showToast('Failed to copy: ' + err.message);
    });
}

/**
 * Export logs as JSON to clipboard
 */
function exportJSON() {
    const logs = getFilteredLogs();

    if (logs.length === 0) {
        showToast('No logs to export');
        return;
    }

    const json = JSON.stringify(logs, null, 2);

    navigator.clipboard.writeText(json).then(() => {
        const filterNote = state.logFilter || state.timeFilter !== 'all' ? ' (filtered)' : '';
        showToast(`Exported ${logs.length} entries as JSON${filterNote}`);
    }).catch(err => {
        showToast('Failed to export: ' + err.message);
    });
}

// =============================================================================
// STATS TAB
// =============================================================================

async function loadStats() {
    try {
        const res = await fetch(apiUrl('stats'));
        const data = await res.json();

        state.lastStatsData = data;

        if (data.message) {
            if (els.statTotal) els.statTotal.textContent = '--';
            return;
        }

        renderStats(data);

    } catch (err) {
        if (els.statTotal) els.statTotal.textContent = 'err';
    }
}

function renderStats(data) {
    if (!data) data = state.lastStatsData;
    if (!data) return;

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

    // Top paths - optionally grouped
    let pathsToRender = data.topPaths;
    if (state.groupPaths && pathsToRender) {
        pathsToRender = groupPathsByPattern(pathsToRender);
    }

    renderTopList(els.topPaths, pathsToRender, 'path', state.groupPaths ? (item) => {
        const groupedClass = item.isGrouped ? ' grouped' : '';
        const title = item.examples ? item.examples.slice(0, 5).join('\n') : item.path;
        return `<span class="top-value clickable${groupedClass}" data-filter="${item.examples?.[0] || item.path}" title="${title}">${item.path}</span>`;
    } : null);

    // Update group button state
    const groupBtn = document.getElementById('btn-group-paths');
    if (groupBtn) {
        groupBtn.classList.toggle('active', state.groupPaths);
    }

    // Status codes
    renderTopList(els.topCodes, data.statusCodes, 'code', (item) =>
        `<span class="top-value clickable log-status ${statusClass(parseInt(item.code))}" data-filter="${item.code}">${item.code}</span>`
    );

    // Top IPs
    renderTopList(els.topIps, data.topIPs, 'ip');
}

/**
 * Copy stats to clipboard in readable format
 */
function copyStats() {
    const data = state.lastStatsData;
    if (!data) {
        showToast('No stats data to copy');
        return;
    }

    const s = data.summary || {};
    let text = `Caddy Stats (${state.org}/${state.env})\n`;
    text += `${'='.repeat(40)}\n\n`;

    text += `SUMMARY\n`;
    text += `  Requests: ${s.totalRequests || 0}\n`;
    text += `  Errors: ${s.errorCount || 0}\n`;
    text += `  Avg Latency: ${s.avgDuration || '--'}s\n`;
    text += `  Unique IPs: ${s.uniqueIPs || 0}\n\n`;

    if (data.topPaths?.length) {
        text += `TOP PATHS\n`;
        for (const p of data.topPaths.slice(0, 10)) {
            text += `  ${p.count.toString().padStart(6)} ${p.path}\n`;
        }
        text += '\n';
    }

    if (data.statusCodes?.length) {
        text += `STATUS CODES\n`;
        for (const c of data.statusCodes) {
            text += `  ${c.count.toString().padStart(6)} ${c.code} (${c.percent}%)\n`;
        }
        text += '\n';
    }

    if (data.topIPs?.length) {
        text += `TOP IPS\n`;
        for (const ip of data.topIPs.slice(0, 10)) {
            text += `  ${ip.count.toString().padStart(6)} ${ip.ip}\n`;
        }
    }

    navigator.clipboard.writeText(text).then(() => {
        showToast('Stats copied to clipboard');
    }).catch(err => {
        showToast('Failed to copy: ' + err.message);
    });
}

/**
 * Normalize path for grouping similar paths together
 * Example: api/game-files/gamma-bros/index.html becomes api/game-files/STAR/index.html
 */
function normalizePath(path) {
    if (!path) return '/';

    // Remove query string
    path = path.split('?')[0];

    // Common patterns to normalize
    const patterns = [
        // API paths with IDs: /api/game-files/{game}/file.ext -> /api/game-files/*/file.ext
        { regex: /^(\/api\/[^/]+\/)[^/]+(\/[^/]+\.[^/]+)$/, replace: '$1*$2' },

        // Generic resource IDs: /resource/abc123 -> /resource/*
        { regex: /^(\/[^/]+\/)([a-f0-9]{8,}|[0-9]+)(\/|$)/, replace: '$1*$3' },

        // _app/immutable paths: /_app/immutable/chunks/*.js -> /_app/immutable/chunks/*.js
        { regex: /^\/_app\/immutable\/([^/]+)\/[^/]+\.(js|css)$/, replace: '/_app/immutable/$1/*.$2' },

        // Static asset hashes: /file.abc123.js -> /file.*.js
        { regex: /^(.+)\.[a-f0-9]{6,}\.(js|css|woff2?)$/, replace: '$1.*.$2' },

        // UUIDs anywhere: {uuid} -> *
        { regex: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, replace: '*' },
    ];

    let normalized = path;
    for (const { regex, replace } of patterns) {
        normalized = normalized.replace(regex, replace);
    }

    return normalized;
}

/**
 * Group paths by normalized pattern
 */
function groupPathsByPattern(topPaths) {
    const groups = new Map();

    for (const item of topPaths) {
        const normalized = normalizePath(item.path);
        const existing = groups.get(normalized);

        if (existing) {
            existing.count += item.count;
            existing.examples.push(item.path);
        } else {
            groups.set(normalized, {
                path: normalized,
                count: item.count,
                examples: [item.path]
            });
        }
    }

    // Sort by count and calculate percentages
    const sorted = Array.from(groups.values()).sort((a, b) => b.count - a.count);
    const maxCount = sorted[0]?.count || 1;

    return sorted.map(item => ({
        ...item,
        percent: Math.round((item.count / maxCount) * 100),
        isGrouped: item.examples.length > 1
    }));
}

/**
 * Filter logs and switch to logs tab
 */
function filterAndShowLogs(filterValue) {
    state.logFilter = filterValue;
    const filterInput = document.getElementById('log-filter');
    if (filterInput) {
        filterInput.value = filterValue;
    }
    showTab('logs');
}

function renderTopList(container, items, valueKey, customRender) {
    if (!container) return;

    if (!items || items.length === 0) {
        container.innerHTML = '<div class="empty">(no data)</div>';
        return;
    }

    container.innerHTML = items.map(item => {
        const value = item[valueKey];
        const displayValue = customRender ? customRender(item) : `<span class="top-value clickable" data-filter="${value}">${value}</span>`;
        return `
            <div class="top-row">
                <span class="top-count">${item.count}</span>
                ${displayValue}
                <div class="top-bar"><div class="top-bar-fill" style="width: ${item.percent || 0}%"></div></div>
            </div>
        `;
    }).join('');

    // Add click handlers for filtering
    container.querySelectorAll('.top-value.clickable').forEach(el => {
        el.addEventListener('click', () => {
            filterAndShowLogs(el.dataset.filter);
        });
    });
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
    document.getElementById('btn-json')?.addEventListener('click', exportJSON);
    document.getElementById('btn-follow')?.addEventListener('click', toggleFollowMode);
    document.getElementById('btn-raw')?.addEventListener('click', toggleRaw);
    document.getElementById('btn-debug')?.addEventListener('click', toggleDebug);
    document.getElementById('log-filter')?.addEventListener('input', handleLogFilter);

    // Time filter buttons
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.timeFilter = btn.dataset.time;
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLogs();
        });
    });

    // Filter preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            state.logFilter = preset;
            const filterInput = document.getElementById('log-filter');
            if (filterInput) filterInput.value = preset;

            // Update active state
            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            renderLogs();
        });
    });

    // Hide internal/NOP toggle
    document.getElementById('chk-hide-internal')?.addEventListener('change', (e) => {
        state.hideInternal = e.target.checked;
        renderLogs();
    });

    // Log detail popover
    document.getElementById('log-detail-close')?.addEventListener('click', hideLogDetail);
    document.getElementById('log-detail-copy')?.addEventListener('click', copyLogDetail);
    document.getElementById('log-detail')?.addEventListener('click', (e) => {
        // Close on overlay click (not popover content)
        if (e.target.id === 'log-detail') {
            hideLogDetail();
        }
    });

    // Refresh toggle
    document.getElementById('refresh-toggle')?.addEventListener('click', toggleAutoRefresh);

    // Stats path grouping toggle
    document.getElementById('btn-group-paths')?.addEventListener('click', () => {
        state.groupPaths = !state.groupPaths;
        renderStats();
    });

    // Copy stats button
    document.getElementById('btn-copy-stats')?.addEventListener('click', copyStats);

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

    // Start auto-refresh
    startAutoRefresh();
}

/**
 * Toggle auto-refresh on/off
 */
function toggleAutoRefresh() {
    state.autoRefresh = !state.autoRefresh;
    const toggle = document.getElementById('refresh-toggle');
    const status = document.getElementById('refresh-status');

    if (state.autoRefresh) {
        toggle?.classList.remove('paused');
        if (status) status.textContent = `${CONFIG.refreshInterval / 1000}s`;
        startAutoRefresh();
        showToast('Auto-refresh enabled');
    } else {
        toggle?.classList.add('paused');
        if (status) status.textContent = 'paused';
        stopAutoRefresh();
        showToast('Auto-refresh paused');
    }
}

function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing interval
    if (state.autoRefresh) {
        state.refreshIntervalId = setInterval(loadAll, CONFIG.refreshInterval);
    }
}

function stopAutoRefresh() {
    if (state.refreshIntervalId) {
        clearInterval(state.refreshIntervalId);
        state.refreshIntervalId = null;
    }
}

/**
 * Toggle follow mode - faster refresh for logs tab
 */
function toggleFollowMode() {
    state.followMode = !state.followMode;
    const btn = document.getElementById('btn-follow');

    if (state.followMode) {
        btn?.classList.add('following');

        // Start fast polling for logs
        stopFollowMode();
        state.followIntervalId = setInterval(() => {
            if (state.activeTab === 'logs') {
                loadLogs();
                scrollLogsToBottom();
            }
        }, 2000); // 2 second refresh when following

        showToast('Following new entries...');

        // Switch to logs tab if not already there
        if (state.activeTab !== 'logs') {
            showTab('logs');
        }

        // Scroll to bottom
        scrollLogsToBottom();
    } else {
        btn?.classList.remove('following');
        stopFollowMode();
        showToast('Follow mode disabled');
    }
}

function stopFollowMode() {
    if (state.followIntervalId) {
        clearInterval(state.followIntervalId);
        state.followIntervalId = null;
    }
}

function scrollLogsToBottom() {
    const logsContainer = document.getElementById('logs');
    if (logsContainer) {
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }
}

/**
 * Show log detail popover
 */
function showLogDetail(logIndex) {
    const log = state.logDetailsMap.get(logIndex);
    if (!log) return;

    state.selectedLogDetail = log;

    const overlay = document.getElementById('log-detail');
    const summary = document.getElementById('log-detail-summary');
    const json = document.getElementById('log-detail-json');

    if (!overlay || !summary || !json) return;

    // Build summary
    const entry = parseLogEntry(log);
    let summaryHtml = '';

    if (entry.type === 'request') {
        summaryHtml = `
            <span class="label">Time</span><span class="value">${formatFullTime(entry.ts)}</span>
            <span class="label">Status</span><span class="value">${entry.status || '-'}</span>
            <span class="label">Method</span><span class="value">${entry.method || '-'}</span>
            <span class="label">URI</span><span class="value">${entry.uri || '-'}</span>
            <span class="label">Duration</span><span class="value">${formatDuration(entry.duration)}</span>
        `;

        // Add IP if available
        const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip;
        if (ip) {
            summaryHtml += `<span class="label">IP</span><span class="value">${ip}</span>`;
        }

        // Add host if available
        const host = log.request?.host || log.host;
        if (host) {
            summaryHtml += `<span class="label">Host</span><span class="value">${host}</span>`;
        }

        // Add user agent if available
        const ua = log.request?.headers?.['User-Agent']?.[0] || log.request?.headers?.['user-agent']?.[0];
        if (ua) {
            summaryHtml += `<span class="label">User-Agent</span><span class="value">${ua}</span>`;
        }
    } else {
        summaryHtml = `
            <span class="label">Time</span><span class="value">${formatFullTime(entry.ts)}</span>
            <span class="label">Level</span><span class="value">${entry.level || '-'}</span>
            <span class="label">Message</span><span class="value">${entry.msg || '-'}</span>
        `;
    }

    summary.innerHTML = summaryHtml;
    json.textContent = JSON.stringify(log, null, 2);

    overlay.classList.remove('hidden');
}

function hideLogDetail() {
    const overlay = document.getElementById('log-detail');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    state.selectedLogDetail = null;
}

function copyLogDetail() {
    if (!state.selectedLogDetail) return;

    const json = JSON.stringify(state.selectedLogDetail, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        showToast('Copied to clipboard');
    }).catch(err => {
        showToast('Failed to copy: ' + err.message);
    });
}

// Start when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
