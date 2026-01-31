// Caddy Panel - Ban Actions
// Exports: banIP, unbanIP, showBanDialog, hideBanDialog, submitBan, getTopOffenders, renderOffenders

async function banIP(ip, jail, duration) {
    if (!ip) return;

    jail = jail || 'caddy-noscript';
    duration = duration || '';

    try {
        const res = await fetch(apiUrl('ban'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, jail, duration })
        });
        const data = await res.json();

        if (data.error) {
            showToast(`Ban failed: ${data.error}`);
        } else {
            showToast(`Banned ${ip}`);
            loadBan(); // Refresh ban list
        }
    } catch (err) {
        showToast(`Ban failed: ${err.message}`);
    }
}

async function unbanIP(ip, jail) {
    if (!ip) return;
    jail = jail || 'caddy-noscript';

    try {
        const res = await fetch(apiUrl('unban'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ip, jail })
        });
        const data = await res.json();

        if (data.error) {
            showToast(`Unban failed: ${data.error}`);
        } else {
            showToast(`Unbanned ${ip}`);
            loadBan();
        }
    } catch (err) {
        showToast(`Unban failed: ${err.message}`);
    }
}

function showBanDialog(ip) {
    const dialog = document.getElementById('ban-dialog');
    const ipInput = document.getElementById('ban-ip-input');
    if (!dialog || !ipInput) return;

    ipInput.value = ip || '';
    dialog.classList.remove('hidden');
}

function hideBanDialog() {
    const dialog = document.getElementById('ban-dialog');
    if (dialog) dialog.classList.add('hidden');
}

function submitBan() {
    const ip = document.getElementById('ban-ip-input')?.value?.trim();
    const jail = document.getElementById('ban-jail-select')?.value || 'caddy-noscript';
    const duration = document.getElementById('ban-duration-select')?.value || '';

    if (!ip) {
        showToast('Enter an IP address');
        return;
    }

    hideBanDialog();
    banIP(ip, jail, duration);
}

/**
 * Get top offenders from current log data
 * Returns IPs with most scanner/attack requests
 */
function getTopOffenders() {
    const data = state.lastLogData;
    if (!data || !data.logs) return [];

    const ipCounts = {};

    for (const log of data.logs) {
        const entry = parseLogEntry(log);
        if (entry.type !== 'request') continue;

        const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip;
        if (!ip) continue;

        const isScanner = isScannerRequest(entry.uri);
        const isAttack = isAttackRequest(entry.uri);

        if (isScanner || isAttack) {
            if (!ipCounts[ip]) {
                ipCounts[ip] = { ip, scanner: 0, attack: 0, total: 0 };
            }
            if (isAttack) ipCounts[ip].attack++;
            if (isScanner) ipCounts[ip].scanner++;
            ipCounts[ip].total++;
        }
    }

    return Object.values(ipCounts)
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
}

function renderOffenders() {
    const container = document.getElementById('top-offenders');
    if (!container) return;

    const offenders = getTopOffenders();

    if (offenders.length === 0) {
        container.innerHTML = '<div class="empty">No offenders detected</div>';
        return;
    }

    container.innerHTML = offenders.map(o => {
        const label = o.attack > 0
            ? `${o.total} hits (${o.attack} attacks)`
            : `${o.total} scans`;
        return `
            <div class="ban-row">
                <span class="ban-ip">${o.ip}</span>
                <span class="ban-jail offender-stats">${label}</span>
                <button class="btn btn-sm ban-action" data-ip="${o.ip}" title="Ban ${o.ip}">Ban</button>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.ban-action').forEach(btn => {
        btn.addEventListener('click', () => {
            showBanDialog(btn.dataset.ip);
        });
    });
}

function initBan() {
    document.getElementById('btn-ban-ip')?.addEventListener('click', () => showBanDialog(''));
    document.getElementById('ban-dialog-close')?.addEventListener('click', hideBanDialog);
    document.getElementById('ban-dialog-submit')?.addEventListener('click', submitBan);
    document.getElementById('ban-dialog')?.addEventListener('click', (e) => {
        if (e.target.id === 'ban-dialog') hideBanDialog();
    });
}

// Registration deferred to api.js where loadBan is defined
