// Caddy Panel - Stats Tab
// Exports: renderStats, copyStats, renderTopList, groupPathsByPattern, normalizePath

function renderStats(data) {
    if (!data) data = state.lastStatsData;
    if (!data) return;

    const s = data.summary || {};

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

    const groupBtn = document.getElementById('btn-group-paths');
    if (groupBtn) groupBtn.classList.toggle('active', state.groupPaths);

    renderTopList(els.topCodes, data.statusCodes, 'code', (item) =>
        `<span class="top-value clickable log-status ${statusClass(parseInt(item.code))}" data-filter="${item.code}">${item.code}</span>`
    );

    renderTopList(els.topIps, data.topIPs, 'ip');
}

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

function normalizePath(path) {
    if (!path) return '/';
    path = path.split('?')[0];

    const patterns = [
        { regex: /^(\/api\/[^/]+\/)[^/]+(\/[^/]+\.[^/]+)$/, replace: '$1*$2' },
        { regex: /^(\/[^/]+\/)([a-f0-9]{8,}|[0-9]+)(\/|$)/, replace: '$1*$3' },
        { regex: /^\/_app\/immutable\/([^/]+)\/[^/]+\.(js|css)$/, replace: '/_app/immutable/$1/*.$2' },
        { regex: /^(.+)\.[a-f0-9]{6,}\.(js|css|woff2?)$/, replace: '$1.*.$2' },
        { regex: /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, replace: '*' },
    ];

    let normalized = path;
    for (const { regex, replace } of patterns) {
        normalized = normalized.replace(regex, replace);
    }
    return normalized;
}

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

    const sorted = Array.from(groups.values()).sort((a, b) => b.count - a.count);
    const maxCount = sorted[0]?.count || 1;

    return sorted.map(item => ({
        ...item,
        percent: Math.round((item.count / maxCount) * 100),
        isGrouped: item.examples.length > 1
    }));
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

    container.querySelectorAll('.top-value.clickable').forEach(el => {
        el.addEventListener('click', () => {
            filterAndShowLogs(el.dataset.filter);
        });
    });
}

function initStats() {
    document.getElementById('btn-group-paths')?.addEventListener('click', () => {
        state.groupPaths = !state.groupPaths;
        renderStats();
    });
    document.getElementById('btn-copy-stats')?.addEventListener('click', copyStats);
}

// Registration deferred to api.js where loadStats is defined
