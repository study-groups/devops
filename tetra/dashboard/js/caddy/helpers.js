// Caddy Panel - Helpers & Utilities
// Depends on: state.js, formatters.js
// Exports: setStatus, setEnvBadge, showToast, parseLogEntry, tabs, registerTab

function setStatus(status) {
    const dot = document.getElementById('status-dot');
    if (dot) dot.className = 'status-dot ' + status;
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

function parseLogEntry(log) {
    // HTTP request entry (fields may be top-level or nested in .request)
    if (log.method || log.uri || log.request?.method || log.request?.uri || (log.status && log.request)) {
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

    if (log.level === 'error') {
        return {
            type: 'error', ts: log.ts, level: 'error',
            msg: log.msg || log.error || 'Unknown error',
            logger: log.logger
        };
    }

    if (log.level || log.msg) {
        return {
            type: 'info', ts: log.ts,
            level: log.level || 'info',
            msg: log.msg || JSON.stringify(log),
            logger: log.logger
        };
    }

    return { type: 'raw', raw: log.raw || JSON.stringify(log) };
}

// Tab registry - modules register themselves via registerTab()
const tabs = {};
function registerTab(name, { onActivate, onInit }) {
    tabs[name] = { onActivate, onInit };
}
