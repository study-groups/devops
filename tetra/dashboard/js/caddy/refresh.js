// Caddy Panel - Auto-refresh & Follow Mode
// Exports: toggleAutoRefresh, startAutoRefresh, stopAutoRefresh, toggleFollowMode, stopFollowMode, scrollLogsToBottom

function toggleAutoRefresh() {
    state.autoRefresh = !state.autoRefresh;
    const toggle = document.getElementById('refresh-toggle');
    const status = document.getElementById('refresh-status');

    if (state.autoRefresh) {
        toggle?.classList.remove('paused');
        if (status) status.textContent = `${CONFIG.refreshInterval / 1000}s`;
        startAutoRefresh();
        showToast('Auto-refresh enabled');
    } else {
        toggle?.classList.add('paused');
        if (status) status.textContent = 'paused';
        stopAutoRefresh();
        showToast('Auto-refresh paused');
    }
}

function startAutoRefresh() {
    stopAutoRefresh();
    if (state.autoRefresh) {
        state.refreshIntervalId = setInterval(loadAll, CONFIG.refreshInterval);
    }
}

function stopAutoRefresh() {
    if (state.refreshIntervalId) {
        clearInterval(state.refreshIntervalId);
        state.refreshIntervalId = null;
    }
}

function toggleFollowMode() {
    state.followMode = !state.followMode;
    const btn = document.getElementById('btn-follow');

    if (state.followMode) {
        btn?.classList.add('following');
        stopFollowMode();
        state.followIntervalId = setInterval(() => {
            if (state.activeTab === 'logs') {
                loadLogs();
                scrollLogsToBottom();
            }
        }, 2000);

        showToast('Following new entries...');
        if (state.activeTab !== 'logs') showTab('logs');
        scrollLogsToBottom();
    } else {
        btn?.classList.remove('following');
        stopFollowMode();
        showToast('Follow mode disabled');
    }
}

function stopFollowMode() {
    if (state.followIntervalId) {
        clearInterval(state.followIntervalId);
        state.followIntervalId = null;
    }
}

function scrollLogsToBottom() {
    const logsContainer = document.getElementById('logs');
    if (logsContainer) logsContainer.scrollTop = logsContainer.scrollHeight;
}
