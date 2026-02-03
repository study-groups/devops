// Caddy Panel - Log Detail Popover
// Depends on: state.js, formatters.js, helpers.js, geo.js
// Exports: showLogDetail, hideLogDetail, copyLogDetail, copyCurl

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

        // Update curl preview and IP info
        updateCurlPreview(log);
        updateIPInfo(log);
    } else {
        summaryHtml = `
            <span class="label">Time</span><span class="value">${formatFullTime(entry.ts)}</span>
            <span class="label">Level</span><span class="value">${entry.level || '-'}</span>
            <span class="label">Message</span><span class="value">${entry.msg || '-'}</span>
        `;
        updateCurlPreview(null);
        updateIPInfo(null);
    }

    summary.innerHTML = summaryHtml;
    json.textContent = JSON.stringify(log, null, 2);
    overlay.classList.remove('hidden');
}

function buildCurlCommand(log) {
    if (!log || !log.request) return null;

    const req = log.request;
    const method = req.method || 'GET';
    const host = req.host || '';
    const uri = req.uri || '/';
    const proto = req.proto?.includes('HTTPS') || host.includes(':443') ? 'https' : 'https'; // default https

    // Build URL
    const url = `${proto}://${host}${uri}`;

    // Start building curl
    const parts = ['curl'];

    // Method (skip for GET)
    if (method !== 'GET') {
        parts.push(`-X ${method}`);
    }

    // Headers
    const headers = req.headers || {};
    const skipHeaders = ['host', 'content-length', 'transfer-encoding', 'connection'];

    for (const [name, values] of Object.entries(headers)) {
        if (skipHeaders.includes(name.toLowerCase())) continue;
        const value = Array.isArray(values) ? values[0] : values;
        if (value) {
            // Escape single quotes in header value
            const escaped = value.replace(/'/g, "'\\''");
            parts.push(`-H '${name}: ${escaped}'`);
        }
    }

    // Add URL (quoted)
    parts.push(`'${url}'`);

    // Add common useful flags
    parts.push('-v'); // verbose
    parts.push('-s'); // silent (no progress)
    parts.push('-o /dev/null'); // discard body
    parts.push('-w "\\nStatus: %{http_code}\\nTime: %{time_total}s\\nDNS: %{time_namelookup}s\\nConnect: %{time_connect}s\\nTLS: %{time_appconnect}s\\nTTFB: %{time_starttransfer}s\\n"');

    return parts.join(' \\\n  ');
}

function updateCurlPreview(log) {
    const curlPre = document.getElementById('curl-preview');
    const curlSection = document.getElementById('curl-section');

    if (!curlPre || !curlSection) return;

    if (!log || !log.request) {
        curlSection.style.display = 'none';
        return;
    }

    const curl = buildCurlCommand(log);
    if (curl) {
        curlPre.textContent = curl;
        curlSection.style.display = 'block';
    } else {
        curlSection.style.display = 'none';
    }
}

function copyCurl() {
    if (!state.selectedLogDetail) return;

    const curl = buildCurlCommand(state.selectedLogDetail);
    if (!curl) {
        showToast('No request data available');
        return;
    }

    navigator.clipboard.writeText(curl).then(() => {
        showToast('Copied curl command');
    }).catch(err => {
        showToast('Failed to copy: ' + err.message);
    });
}

function copyCurlSimple() {
    if (!state.selectedLogDetail) return;

    const log = state.selectedLogDetail;
    const req = log.request;
    if (!req) {
        showToast('No request data');
        return;
    }

    const method = req.method || 'GET';
    const host = req.host || '';
    const uri = req.uri || '/';
    const url = `https://${host}${uri}`;

    // Simple curl without all headers
    let curl = 'curl';
    if (method !== 'GET') curl += ` -X ${method}`;
    curl += ` '${url}'`;

    navigator.clipboard.writeText(curl).then(() => {
        showToast('Copied simple curl');
    }).catch(err => {
        showToast('Failed to copy: ' + err.message);
    });
}

function updateIPInfo(log) {
    const ipEl = document.getElementById('detail-ip');
    const locEl = document.getElementById('detail-location');
    const metaEl = document.getElementById('detail-ip-meta');
    const section = document.getElementById('ip-info-section');

    if (!ipEl || !locEl || !metaEl) return;

    const ip = log?.remote_ip || log?.request?.remote_ip || log?.request?.client_ip;

    if (!ip) {
        if (section) section.style.display = 'none';
        return;
    }

    if (section) section.style.display = 'block';
    ipEl.textContent = ip;
    locEl.textContent = 'Looking up...';
    metaEl.innerHTML = '';

    // Use lookupIP from geo.js
    lookupIP(ip).then(geo => {
        if (!geo) {
            locEl.textContent = 'Unknown';
            return;
        }

        locEl.textContent = `${geo.city}, ${geo.country}`;
        metaEl.innerHTML = `
            <span>${geo.isp}</span>
            <span>${geo.as}</span>
        `;
    });
}

function filterByCurrentIP() {
    if (!state.selectedLogDetail) return;
    const ip = state.selectedLogDetail.remote_ip ||
               state.selectedLogDetail.request?.remote_ip ||
               state.selectedLogDetail.request?.client_ip;
    if (!ip) {
        showToast('No IP in this log entry');
        return;
    }
    hideLogDetail();
    state.logFilter = ip;
    const filterInput = document.getElementById('log-filter');
    if (filterInput) filterInput.value = ip;
    renderLogs();
    showToast(`Filtered by IP: ${ip}`);
}

function filterByCurrentPath() {
    if (!state.selectedLogDetail) return;
    const path = state.selectedLogDetail.uri || state.selectedLogDetail.request?.uri;
    if (!path) {
        showToast('No path in this log entry');
        return;
    }
    hideLogDetail();
    state.logFilter = path;
    const filterInput = document.getElementById('log-filter');
    if (filterInput) filterInput.value = path;
    renderLogs();
    showToast(`Filtered by path`);
}

function banCurrentIP() {
    if (!state.selectedLogDetail) return;
    const ip = state.selectedLogDetail.remote_ip ||
               state.selectedLogDetail.request?.remote_ip ||
               state.selectedLogDetail.request?.client_ip;
    if (!ip) {
        showToast('No IP in this log entry');
        return;
    }

    // Open ban dialog with IP pre-filled
    const dialog = document.getElementById('ban-dialog');
    const input = document.getElementById('ban-ip-input');
    if (dialog && input) {
        input.value = ip;
        dialog.classList.remove('hidden');
        hideLogDetail();
    }
}

// Bind action buttons and close handlers
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-copy-curl')?.addEventListener('click', copyCurl);
    document.getElementById('btn-filter-ip')?.addEventListener('click', filterByCurrentIP);
    document.getElementById('btn-filter-path')?.addEventListener('click', filterByCurrentPath);
    document.getElementById('btn-ban-this-ip')?.addEventListener('click', banCurrentIP);
    document.getElementById('log-detail-close')?.addEventListener('click', hideLogDetail);

    // Close on overlay click (outside popover)
    document.getElementById('log-detail')?.addEventListener('click', (e) => {
        if (e.target.id === 'log-detail') hideLogDetail();
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideLogDetail();
    });
});

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
