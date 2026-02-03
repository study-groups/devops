// Caddy Panel - Formatters
// Shared formatting functions

function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts * 1000);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
        return d.toLocaleTimeString('en-US', {
            hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    } else {
        return d.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric'
        }) + ' ' + d.toLocaleTimeString('en-US', {
            hour12: false, hour: '2-digit', minute: '2-digit'
        });
    }
}

function formatFullTime(ts) {
    if (!ts) return '-';
    return new Date(ts * 1000).toISOString();
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
