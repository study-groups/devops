// Caddy Panel - API calls & data loading
// Exports: loadStatus, loadRoutes, loadLogs, loadStats, loadBan, loadLogFileInfo, loadAll

async function loadStatus() {
    setStatus('loading');

    try {
        const res = await fetch(apiUrl('status'));
        const data = await res.json();

        const online = data.status === 'online';
        setStatus(online ? 'online' : 'offline');

        if (els.svcStatus) els.svcStatus.textContent = data.status || '--';
        if (els.svcStatus) els.svcStatus.className = 'value ' + (online ? 'good' : 'bad');
        if (els.svcListen) els.svcListen.textContent = data.listen || '--';
        if (els.svcVersion) els.svcVersion.textContent = data.version || '--';
        if (els.svcApi) {
            els.svcApi.textContent = data.adminApi ? 'OK' : '--';
            els.svcApi.className = 'value ' + (data.adminApi ? 'good' : '');
        }

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

async function loadBan() {
    try {
        const res = await fetch(apiUrl('fail2ban'));
        const data = await res.json();

        if (els.f2bStatus) {
            els.f2bStatus.textContent = data.status || (data.active ? 'active' : 'inactive');
            els.f2bStatus.className = 'value ' + (data.active ? 'good' : '');
        }

        if (els.f2bJails) els.f2bJails.textContent = data.jails?.length || 0;
        if (els.f2bTotal) els.f2bTotal.textContent = data.totalBanned || 0;

        const badge = document.getElementById('ban-count');
        if (badge) {
            badge.textContent = data.totalBanned || 0;
            badge.className = 'count ' + (data.totalBanned > 0 ? '' : 'zero');
        }

        if (els.banList) {
            if (data.banned && data.banned.length > 0) {
                els.banList.innerHTML = data.banned.map(b => `
                    <div class="ban-row">
                        <span class="ban-ip">${b.ip}</span>
                        <span class="ban-jail">${b.jail}</span>
                        <span class="ban-time">${b.time || ''}</span>
                        <button class="btn btn-sm ban-unban" data-ip="${b.ip}" data-jail="${b.jail}" title="Unban this IP">Unban</button>
                    </div>
                `).join('');

                // Unban click handlers
                els.banList.querySelectorAll('.ban-unban').forEach(btn => {
                    btn.addEventListener('click', () => {
                        unbanIP(btn.dataset.ip, btn.dataset.jail);
                    });
                });
            } else {
                els.banList.innerHTML = '<div class="empty">None</div>';
            }
        }

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

async function loadLogFileInfo() {
    try {
        const res = await fetch(apiUrl('metadata'));
        const data = await res.json();

        const sizeEl = document.getElementById('log-info-size');
        const entriesEl = document.getElementById('log-info-entries');
        const modifiedEl = document.getElementById('log-info-modified');

        if (data.logFile) {
            if (sizeEl) sizeEl.textContent = data.logFile.size || '--';
            if (entriesEl) entriesEl.textContent = data.logFile.lines ? formatNumber(data.logFile.lines) : '--';
            if (modifiedEl) modifiedEl.textContent = data.logFile.modified || '--';
        } else if (data.files && data.files.length > 0) {
            const file = data.files[0];
            if (sizeEl) sizeEl.textContent = file.size || '--';
            if (entriesEl) entriesEl.textContent = '--';
            if (modifiedEl) modifiedEl.textContent = file.age || '--';
        }
    } catch (err) {
        console.warn('[Caddy] Failed to load log file info:', err.message);
    }
}

function loadAll() {
    loadStatus();
    loadRoutes();
}

registerTab('help', { onActivate: loadLogFileInfo });
