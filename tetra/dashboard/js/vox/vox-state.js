/**
 * vox-state.js - Shared state and DOM refs for Vox panel
 */
window.Vox = window.Vox || {};

Vox.state = {
    voxData: null,
    lastId: null,
    filter: null,
    refreshInterval: null,
    expandedId: null,
    dbPath: '~/tetra/vox/db/',
    count: 0,
    cache: {}
};

Vox.dom = {
    providerSelect: document.getElementById('vox-provider'),
    modelSelect: document.getElementById('vox-model'),
    voiceSelect: document.getElementById('vox-voice'),
    saveDefaultBtn: document.getElementById('save-default-btn'),
    testText: document.getElementById('test-text'),
    testBtn: document.getElementById('test-btn'),
    playBtn: document.getElementById('play-btn'),
    metricsEl: document.getElementById('test-metrics'),
    logBody: document.getElementById('log-body'),
    statsBar: document.getElementById('stats-bar'),
    autoRefreshCb: document.getElementById('auto-refresh'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    storageLine: document.getElementById('storage-line'),
    sharedAudio: document.getElementById('shared-audio')
};
