// Caddy Panel - Log Detail Popover

function showLogDetail(logIndex) {
    const log = state.logDetailsMap.get(logIndex);
    if (!log) return;

    state.selectedLogDetail = log;

    const overlay = document.getElementById('log-detail');
    const summary = document.getElementById('log-detail-summary');
    const json = document.getElementById('log-detail-json');

    if (!overlay || !summary || !json) return;

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

        const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip;
        if (ip) summaryHtml += `<span class="label">IP</span><span class="value">${ip}</span>`;

        const host = log.request?.host || log.host;
        if (host) summaryHtml += `<span class="label">Host</span><span class="value">${host}</span>`;

        const ua = log.request?.headers?.['User-Agent']?.[0] || log.request?.headers?.['user-agent']?.[0];
        if (ua) summaryHtml += `<span class="label">User-Agent</span><span class="value">${ua}</span>`;
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
    if (overlay) overlay.classList.add('hidden');
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
