// Caddy Panel - Insights & Histogram
// Exports: calculateInsights, renderHistogram, renderInsights

function calculateInsights(logs) {
    const insights = {
        total: 0, legitimate: 0, scanner: 0,
        errors5xx: 0, errors502: 0,
        hotPath: null, hotPathCount: 0,
        rapidIP: null, rapidCount: 0
    };

    if (!logs || logs.length === 0) return insights;

    const pathCounts = {};
    const ipTimestamps = {};

    for (const log of logs) {
        const entry = parseLogEntry(log);
        if (entry.type !== 'request') continue;

        insights.total++;

        if (isScannerRequest(entry.uri)) {
            insights.scanner++;
        } else {
            insights.legitimate++;
            const path = (entry.uri || '/').split('?')[0];
            pathCounts[path] = (pathCounts[path] || 0) + 1;
            if (pathCounts[path] > insights.hotPathCount) {
                insights.hotPath = path;
                insights.hotPathCount = pathCounts[path];
            }
        }

        if (entry.status >= 500) {
            insights.errors5xx++;
            if (entry.status === 502) insights.errors502++;
        }

        const ip = log.remote_ip || log.request?.remote_ip || log.request?.client_ip;
        if (ip && entry.ts) {
            if (!ipTimestamps[ip]) ipTimestamps[ip] = [];
            ipTimestamps[ip].push(entry.ts);
        }
    }

    for (const [ip, timestamps] of Object.entries(ipTimestamps)) {
        if (timestamps.length < 10) continue;
        timestamps.sort((a, b) => a - b);
        for (let i = 0; i <= timestamps.length - 10; i++) {
            if (timestamps[i + 9] - timestamps[i] <= 5) {
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

    const timestamps = logs.map(log => log.ts).filter(ts => ts && ts > 0).sort((a, b) => a - b);

    if (timestamps.length < 2) {
        histogram.classList.add('hidden');
        return;
    }

    histogram.classList.remove('hidden');

    const minTs = timestamps[0];
    const maxTs = timestamps[timestamps.length - 1];
    const range = maxTs - minTs;
    const numBuckets = 20;
    const buckets = new Array(numBuckets).fill(0);
    const errorBuckets = new Array(numBuckets).fill(0);
    const bucketSize = range / numBuckets;

    for (const log of logs) {
        if (!log.ts) continue;
        const bucketIndex = Math.min(Math.floor((log.ts - minTs) / bucketSize), numBuckets - 1);
        buckets[bucketIndex]++;
        if ((log.status || 0) >= 500) errorBuckets[bucketIndex]++;
    }

    const maxCount = Math.max(...buckets, 1);

    barsContainer.innerHTML = buckets.map((count, i) => {
        const height = Math.max(2, (count / maxCount) * 100);
        const hasError = errorBuckets[i] > 0;
        const errorClass = hasError ? ' has-error' : '';
        const bucketStart = new Date((minTs + i * bucketSize) * 1000);
        const title = `${count} requests${hasError ? ` (${errorBuckets[i]} errors)` : ''} at ${bucketStart.toLocaleTimeString()}`;
        return `<div class="histogram-bar${errorClass}" style="height: ${height}%" title="${title}"></div>`;
    }).join('');

    if (startLabel) startLabel.textContent = formatTime(minTs);
    if (endLabel) endLabel.textContent = formatTime(maxTs);
}

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

    if (trafficEl) {
        trafficEl.textContent = `${insights.legitimate}/${insights.total}`;
        trafficEl.className = insights.scanner > insights.legitimate
            ? 'insight-value warn' : 'insight-value good';
    }

    if (errorsEl) {
        errorsEl.textContent = insights.errors5xx.toString();
        errorsEl.className = insights.errors5xx > 0 ? 'insight-value bad' : 'insight-value good';
    }

    if (hotEl) {
        if (insights.hotPath) {
            const displayPath = insights.hotPath.length > 20
                ? insights.hotPath.slice(0, 20) + '...' : insights.hotPath;
            hotEl.textContent = displayPath;
            hotEl.title = insights.hotPath;
        } else {
            hotEl.textContent = '-';
            hotEl.title = '';
        }
    }

    if (alertContainer && alertEl) {
        if (insights.rapidIP) {
            alertContainer.style.display = '';
            alertEl.textContent = `! ${insights.rapidIP} rapid (${insights.rapidCount})`;
        } else {
            alertContainer.style.display = 'none';
        }
    }
}
