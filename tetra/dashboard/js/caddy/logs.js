// Caddy Panel - Logs Tab
// Depends on: state.js, formatters.js, helpers.js, geo.js, scanner.js, insights.js
// Exports: renderLogs, toggleRaw, toggleDebug, handleLogFilter, copyLogs, exportJSON,
//          filterAndShowLogs, getFilteredLogs

function getTimeCutoff(filter) {
    const now = Date.now() / 1000;
    switch (filter) {
        case '1h': return now - 3600;
        case '24h': return now - 86400;
        case 'today': {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return today.getTime() / 1000;
        }
        default: return 0;
    }
}

function getFilteredLogs() {
    const data = state.lastLogData;
    if (!data || !data.logs) return [];

    let logs = data.logs;

    // Filter out internal NOP entries if enabled
    if (state.hideInternal) {
        logs = logs.filter(log => {
            if (log.method || log.status || log.uri) return true;
            if (log.request?.method || log.request?.uri) return true;
            if (log.msg === 'NOP' || log.msg === 'handled request') return false;
            if (log.level === 'error') return true;
            return false;
        });
    }

    // Apply time filter
    if (state.timeFilter && state.timeFilter !== 'all') {
        const cutoff = getTimeCutoff(state.timeFilter);
        logs = logs.filter(log => (log.ts || 0) >= cutoff);
    }

    // Apply text filter
    if (state.logFilter) {
        const filter = state.logFilter.toLowerCase();
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
            if (isRegex && regex) return regex.test(text);
            return text.toLowerCase().includes(filter);
        });
    }
    return logs;
}

function sortLogs(logs) {
    const col = state.sort.column;
    const dir = state.sort.direction === 'asc' ? 1 : -1;

    return [...logs].sort((a, b) => {
        let va, vb;
        switch (col) {
            case 'time':
                va = a.ts || 0;
                vb = b.ts || 0;
                break;
            case 'status':
                va = a.status || 0;
                vb = b.status || 0;
                break;
            case 'method':
                va = (a.method || a.request?.method || '').toLowerCase();
                vb = (b.method || b.request?.method || '').toLowerCase();
                break;
            case 'ip':
                va = a.remote_ip || a.request?.remote_ip || a.request?.client_ip || '';
                vb = b.remote_ip || b.request?.remote_ip || b.request?.client_ip || '';
                break;
            case 'path':
                va = (a.uri || a.request?.uri || '').toLowerCase();
                vb = (b.uri || b.request?.uri || '').toLowerCase();
                break;
            case 'duration':
                va = a.duration || 0;
                vb = b.duration || 0;
                break;
            case 'geo':
                const ipA = a.remote_ip || a.request?.remote_ip || a.request?.client_ip || '';
                const ipB = b.remote_ip || b.request?.remote_ip || b.request?.client_ip || '';
                const geoA = getGeo(ipA);
                const geoB = getGeo(ipB);
                va = geoA ? `${geoA.country} ${geoA.city}` : '';
                vb = geoB ? `${geoB.country} ${geoB.city}` : '';
                break;
            default:
                va = a.ts || 0;
                vb = b.ts || 0;
        }
        if (va < vb) return -1 * dir;
        if (va > vb) return 1 * dir;
        return 0;
    });
}

function aggregateLogs(logs, by) {
    const map = new Map();

    for (const log of logs) {
        let key;
        if (by === 'ip') {
            key = log.remote_ip || log.request?.remote_ip || log.request?.client_ip || 'unknown';
        } else if (by === 'path') {
            key = log.uri || log.request?.uri || 'unknown';
        } else {
            continue;
        }

        if (!map.has(key)) {
            map.set(key, {
                key,
                count: 0,
                logs: [],
                statuses: new Set(),
                methods: new Set(),
                firstTs: log.ts,
                lastTs: log.ts,
                totalDuration: 0
            });
        }

        const agg = map.get(key);
        agg.count++;
        agg.logs.push(log);
        if (log.status) agg.statuses.add(log.status);
        if (log.method || log.request?.method) agg.methods.add(log.method || log.request?.method);
        if (log.ts < agg.firstTs) agg.firstTs = log.ts;
        if (log.ts > agg.lastTs) agg.lastTs = log.ts;
        if (log.duration) agg.totalDuration += log.duration;
    }

    // Sort by count descending
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function setSort(column) {
    // If clicking on an aggregatable column, toggle aggregation
    if (column === 'ip' || column === 'path') {
        if (state.sort.aggregateBy === column) {
            // Turn off aggregation
            state.sort.aggregateBy = null;
        } else {
            // Turn on aggregation for this column
            state.sort.aggregateBy = column;
        }
    } else {
        // Regular sort column
        state.sort.aggregateBy = null;
        if (state.sort.column === column) {
            state.sort.direction = state.sort.direction === 'asc' ? 'desc' : 'asc';
        } else {
            state.sort.column = column;
            state.sort.direction = column === 'time' ? 'desc' : 'asc';
        }
    }
    updateHeaderState();
    renderLogs();
}

function updateHeaderState() {
    document.querySelectorAll('.log-col-header').forEach(h => {
        const col = h.dataset.col;
        h.classList.remove('active', 'aggregated');

        const indicator = h.querySelector('.sort-indicator');
        if (indicator) indicator.textContent = '';

        if (state.sort.aggregateBy === col) {
            h.classList.add('aggregated');
        } else if (state.sort.column === col && !state.sort.aggregateBy) {
            h.classList.add('active');
            if (indicator) {
                indicator.textContent = state.sort.direction === 'asc' ? '▲' : '▼';
            }
        }
    });
}

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

    let logs = getFilteredLogs();
    renderInsights(logs);
    renderHistogram(logs);
    updateCopyBadge(logs.length);
    state.logDetailsMap.clear();

    if (state.showRaw) {
        els.logs.innerHTML = logs.map(log =>
            `<div class="log-raw">${log.raw || JSON.stringify(log)}</div>`
        ).join('');
        return;
    }

    // Handle aggregation mode
    if (state.sort.aggregateBy) {
        const aggregated = aggregateLogs(logs, state.sort.aggregateBy);
        const isIP = state.sort.aggregateBy === 'ip';

        els.logs.innerHTML = aggregated.map(agg => {
            const statuses = Array.from(agg.statuses).sort().map(s =>
                `<span class="log-status ${statusClass(s)}">${s}</span>`
            ).join(' ');
            const methods = Array.from(agg.methods).join(', ');
            const avgDur = agg.count > 0 ? formatDuration(agg.totalDuration / agg.count) : '-';

            return `
                <div class="log-row aggregated-row" data-agg-key="${agg.key}" data-agg-by="${state.sort.aggregateBy}">
                    <span class="log-time">${formatTime(agg.lastTs)}</span>
                    <span class="agg-count">${agg.count}x</span>
                    <span class="log-method">${methods || '-'}</span>
                    <span class="${isIP ? 'agg-value' : 'log-ip'}">${isIP ? agg.key : '-'}</span>
                    <span class="${!isIP ? 'agg-value' : 'log-uri'}" title="${!isIP ? agg.key : ''}">${!isIP ? agg.key : '-'}</span>
                    <span class="log-dur">${avgDur}</span>
                </div>
            `;
        }).join('');

        // Click to filter by this value
        els.logs.querySelectorAll('.aggregated-row').forEach(row => {
            row.addEventListener('click', () => {
                const key = row.dataset.aggKey;
                state.logFilter = key;
                const filterInput = document.getElementById('log-filter');
                if (filterInput) filterInput.value = key;
                state.sort.aggregateBy = null;
                updateHeaderState();
                renderLogs();
            });
        });
        return;
    }

    // Normal sorted view
    logs = sortLogs(logs);
    const groupedLogs = groupScannerBursts(logs);
    let rowIndex = 0;

    els.logs.innerHTML = groupedLogs.map(log => {
        if (log.type === 'scanner-group') {
            const pathsDisplay = log.paths.join(', ') + (log.paths.length < log.count ? '...' : '');
            const statusDisplay = log.statuses.map(s => `<span class="log-status ${statusClass(s)}">${s}</span>`).join(' ');
            return `
                <div class="log-row scanner-group" title="Scanner burst from ${log.ip}">
                    <span class="log-time">${formatTime(log.tsStart)}</span>
                    <span class="scanner-count">${log.count}x</span>
                    <span class="scanner-info">
                        <span class="scanner-ip">${log.ip}</span>
                        <span class="scanner-paths">${pathsDisplay}</span>
                        ${statusDisplay}
                    </span>
                </div>
            `;
        }

        const currentIndex = rowIndex++;
        state.logDetailsMap.set(currentIndex, log);
        const entry = parseLogEntry(log);
        const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip || '';

        if (entry.type === 'request') {
            const isAttack = isAttackRequest(entry.uri);
            let rowClass = 'log-row';
            if (isAttack) {
                rowClass += ' attack';
            } else if (entry.isError) {
                rowClass += ' log-error';
            }

            const geo = ip ? getGeo(ip) : null;
            const geoText = geo ? `${geo.city}, ${geo.country}`.substring(0, 12) : '-';
            const geoClass = geo ? 'log-geo found' : 'log-geo';

            return `
                <div class="${rowClass}" data-log-index="${currentIndex}">
                    <span class="log-time">${formatTime(entry.ts)}</span>
                    <span class="log-status ${statusClass(entry.status)}">${entry.status || '-'}</span>
                    <span class="log-method">${entry.method || '-'}</span>
                    <span class="log-ip" title="${ip}">${ip || '-'}</span>
                    <span class="log-uri" title="${entry.uri || ''}">${entry.uri || '-'}</span>
                    <span class="${geoClass}" title="${geo ? `${geo.city}, ${geo.country}` : ''}">${geoText}</span>
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

        return `<div class="log-raw">${entry.raw}</div>`;
    }).join('');

    // Click handlers for log rows
    els.logs.querySelectorAll('[data-log-index]').forEach(row => {
        row.addEventListener('click', () => {
            showLogDetail(parseInt(row.dataset.logIndex, 10));
        });
    });
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
    document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
    renderLogs();
}

function copyLogs() {
    const logs = getFilteredLogs();

    if (logs.length === 0) {
        showToast('No logs to copy');
        return;
    }

    let attackCount = 0;
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

    let text = `Caddy Logs - ${state.org}/${state.env}\n`;
    text += `Exported: ${new Date().toISOString()}\n`;
    text += `Entries: ${logs.length}`;
    if (attackCount > 0) text += ` (${attackCount} attacks detected)`;
    text += '\n\nTimestamp\tStatus\tMethod\tIP\tPath\tDuration\n';
    text += lines.join('\n');

    navigator.clipboard.writeText(text).then(() => {
        const filterNote = state.logFilter ? ' (filtered)' : '';
        showToast(`Copied ${logs.length} log entries${filterNote}`);
    }).catch(err => {
        showToast('Failed to copy: ' + err.message);
    });
}

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

function filterAndShowLogs(filterValue) {
    state.logFilter = filterValue;
    const filterInput = document.getElementById('log-filter');
    if (filterInput) filterInput.value = filterValue;
    showTab('logs');
}

async function loadGeoForAllIPs() {
    const btn = document.getElementById('btn-geo');
    if (!btn || geoState.loading) return;

    const logs = getFilteredLogs();
    const ips = extractIPsFromLogs(logs);

    if (ips.length === 0) {
        showToast('No IPs to lookup');
        return;
    }

    btn.classList.add('active');

    const count = await batchLookupIPs(ips, (done, total) => {
        btn.textContent = `Geo (${done}/${total})`;
    });

    btn.textContent = 'Geo';
    btn.classList.remove('active');

    if (count > 0) {
        showToast(`Loaded geo for ${count} IPs`);
        renderLogs();
    } else {
        showToast('All IPs already cached');
    }
}

function initLogs() {
    document.getElementById('btn-copy')?.addEventListener('click', copyLogs);
    document.getElementById('btn-json')?.addEventListener('click', exportJSON);
    document.getElementById('btn-follow')?.addEventListener('click', toggleFollowMode);
    document.getElementById('btn-raw')?.addEventListener('click', toggleRaw);
    document.getElementById('btn-debug')?.addEventListener('click', toggleDebug);
    document.getElementById('log-filter')?.addEventListener('input', handleLogFilter);
    document.getElementById('btn-geo')?.addEventListener('click', loadGeoForAllIPs);

    // Column header click handlers for sort/aggregate
    document.querySelectorAll('.log-col-header').forEach(h => {
        h.addEventListener('click', () => setSort(h.dataset.col));
    });
    updateHeaderState();

    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            state.timeFilter = btn.dataset.time;
            document.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLogs();
        });
    });

    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            state.logFilter = preset;
            const filterInput = document.getElementById('log-filter');
            if (filterInput) filterInput.value = preset;

            document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderLogs();
        });
    });

    document.getElementById('btn-hide-nop')?.addEventListener('click', (e) => {
        state.hideInternal = !state.hideInternal;
        e.target.classList.toggle('active', state.hideInternal);
        renderLogs();
    });

    // Log detail popover
    document.getElementById('log-detail-close')?.addEventListener('click', hideLogDetail);
    document.getElementById('log-detail-copy')?.addEventListener('click', copyLogDetail);
    document.getElementById('log-detail')?.addEventListener('click', (e) => {
        if (e.target.id === 'log-detail') hideLogDetail();
    });
}

// Registration deferred to api.js where loadLogs is defined
