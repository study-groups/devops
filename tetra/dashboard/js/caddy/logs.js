// Caddy Panel - Logs Tab

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

    const logs = getFilteredLogs();
    renderInsights(logs);
    renderHistogram(logs);
    updateCopyBadge(logs.length);
    state.logDetailsMap.clear();

    if (state.showRaw) {
        els.logs.innerHTML = logs.map(log =>
            `<div class="log-raw">${log.raw || JSON.stringify(log)}</div>`
        ).join('');
    } else {
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

            return `<div class="log-raw">${entry.raw}</div>`;
        }).join('');

        // Click handlers for log rows
        els.logs.querySelectorAll('[data-log-index]').forEach(row => {
            row.addEventListener('click', () => {
                showLogDetail(parseInt(row.dataset.logIndex, 10));
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
