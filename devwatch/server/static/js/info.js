// Playwright Testing System - Info Page JavaScript
// Handles interactive filesystem API flow and data display

// Global variable to store raw data
let currentFilesystemData = null;

// Filesystem API Query Function (triggered by first flow step)
async function queryFilesystemAPI() {
    const apiTrigger = document.getElementById('apiTrigger');
    const loading = document.getElementById('loadingIndicator');
    const error = document.getElementById('errorMessage');
    const results = document.getElementById('filesystemResults');
    const curlCommand = document.getElementById('curlCommand');

    // Show loading, hide others
    apiTrigger.style.opacity = '0.6';
    loading.style.display = 'block';
    error.style.display = 'none';
    curlCommand.style.display = 'none';
    hideAllOutputs();
    
    try {
        const apiUrl = `${window.location.origin}/api/filesystem`;
        curlCommand.textContent = `curl -X GET "${apiUrl}"`;
        curlCommand.style.display = 'block';

        const response = await fetch('/api/filesystem');
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        currentFilesystemData = data;
        
        // Populate tables with data
        populateEnvironmentTable(data.environment || {});
        populateSystemHealthTable(data.systemHealth || {});
        
        // Update timestamp
        document.getElementById('lastUpdated').textContent = new Date().toLocaleString();
        
        // Show results container
        results.style.display = 'block';
        
        // Highlight the triggered step
        highlightFlowStep('apiTrigger');
        
    } catch (err) {
        error.textContent = `Failed to fetch filesystem data: ${err.message}`;
        error.style.display = 'block';
        console.error('Filesystem API Error:', err);
    } finally {
        // Reset trigger state
        apiTrigger.style.opacity = '1';
        loading.style.display = 'none';
    }
}

// Show Environment Variables (triggered by second flow step)
function showEnvironmentData() {
    if (!currentFilesystemData) {
        alert('Please run the API query first by clicking the first step.');
        return;
    }
    
    hideAllOutputs();
    document.getElementById('envOutput').style.display = 'block';
    highlightFlowStep('envStep');
}

// Show System Health (triggered by third flow step)
function showSystemHealth() {
    if (!currentFilesystemData) {
        alert('Please run the API query first by clicking the first step.');
        return;
    }
    
    hideAllOutputs();
    document.getElementById('healthOutput').style.display = 'block';
    highlightFlowStep('healthStep');
}

// Toggle Raw JSON Output (triggered by fourth flow step)
function toggleRawOutput() {
    if (!currentFilesystemData) {
        alert('Please run the API query first by clicking the first step.');
        return;
    }

    const rawOutput = document.getElementById('rawOutput');
    const jsonViewer = document.getElementById('jsonViewer');

    if (rawOutput.style.display === 'block') {
        hideAllOutputs();
        clearFlowHighlights();
    } else {
        hideAllOutputs();
        rawOutput.style.display = 'block';
        
        // Create the JSON viewer
        createJsonViewer('rawJson', 'Raw API Response', currentFilesystemData, jsonViewer);
        
        highlightFlowStep('jsonStep');
    }
}

function createJsonViewer(id, title, data, container) {
    const viewerId = `json-viewer-${id}`;
    const contentId = `json-content-${id}`;
    const indicatorId = `json-indicator-${id}`;
    const dataSize = JSON.stringify(data).length;

    const viewerHTML = `
        <div class="json-viewer" id="${viewerId}">
            <div class="json-viewer-header" onclick="toggleJsonViewer('${viewerId}')">
                <div class="json-viewer-title">
                    <span class="json-viewer-toggle">▶</span>
                    <span>${title}</span>
                    <span class="json-collapsed-indicator" id="${indicatorId}">JSON data (${formatBytes(dataSize)})</span>
                </div>
                <div class="json-viewer-actions">
                    <button class="json-viewer-btn" onclick="copyJsonData('${contentId}', event)" title="Copy JSON">Copy</button>
                    <button class="json-viewer-btn" onclick="closeJsonViewer('${viewerId}', event)" title="Close viewer">Close</button>
                </div>
            </div>
            <div class="json-viewer-content" id="${contentId}" style="display: none;">
                <!-- JSON will be populated here -->
            </div>
        </div>
    `;

    container.innerHTML = viewerHTML;

    const formattedJson = JSON.stringify(data, null, 2);
    const jsonContent = document.getElementById(contentId);

    if (typeof highlightJson === 'function') {
        const highlightedJson = highlightJson(formattedJson);
        jsonContent.innerHTML = `<pre>${highlightedJson}</pre>`;
    } else {
        jsonContent.innerHTML = `<pre>${formattedJson}</pre>`;
    }
}

function toggleJsonViewer(viewerId) {
    const viewer = document.getElementById(viewerId);
    const content = viewer.querySelector('.json-viewer-content');
    const toggle = viewer.querySelector('.json-viewer-toggle');

    if (content.style.display === 'none') {
        content.style.display = 'block';
        toggle.textContent = '▼';
    } else {
        content.style.display = 'none';
        toggle.textContent = '▶';
    }
}

function copyJsonData(contentId, event) {
    event.stopPropagation();
    const content = document.getElementById(contentId).textContent;
    navigator.clipboard.writeText(content).then(() => {
        alert('JSON data copied to clipboard!');
    }, () => {
        alert('Failed to copy JSON data.');
    });
}

function closeJsonViewer(viewerId, event) {
    event.stopPropagation();
    document.getElementById(viewerId).style.display = 'none';
    if (viewerId.includes('rawJson')) {
        hideAllOutputs();
        clearFlowHighlights();
    }
}

function highlightJson(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
        let cls = 'json-number';
        if (/^"/.test(match)) {
            if (/:$/.test(match)) {
                cls = 'json-key';
            } else {
                cls = 'json-string';
            }
        } else if (/true|false/.test(match)) {
            cls = 'json-boolean';
        } else if (/null/.test(match)) {
            cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
    });
}

// Toggle System Variables Section
function toggleSystemVars() {
    const systemSection = document.getElementById('systemVarsSection');
    const toggleBtn = document.getElementById('systemVarsToggle');
    
    if (systemSection.style.display === 'none' || systemSection.style.display === '') {
        systemSection.style.display = 'block';
        toggleBtn.textContent = '▼ Hide System Variables';
    } else {
        systemSection.style.display = 'none';
        toggleBtn.textContent = '▶ Show System Variables';
    }
}

// Helper function to hide all output sections
function hideAllOutputs() {
    document.getElementById('rawOutput').style.display = 'none';
    document.getElementById('envOutput').style.display = 'none';
    document.getElementById('healthOutput').style.display = 'none';
}

// Helper function to highlight a flow step
function highlightFlowStep(stepId) {
    clearFlowHighlights();
    const step = document.getElementById(stepId);
    step.style.backgroundColor = '#004400';
    step.style.color = '#00ff00';
}

// Helper function to clear all flow step highlights
function clearFlowHighlights() {
    const steps = ['apiTrigger', 'envStep', 'healthStep', 'jsonStep'];
    steps.forEach(stepId => {
        const step = document.getElementById(stepId);
        step.style.backgroundColor = '';
        step.style.color = '';
    });
}

// Check if variable is PW/PD related
function isPWRelated(key) {
    const pwKeys = [
        'PD_DIR', 'PW_DIR', 'LOG_DIR', 'NODE_ENV', 'PORT', 'HOST', 'APP_VERSION',
        'DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_BUCKET', 'AUDIT_BUCKET',
        'PLAYWRIGHT_USE_LOCAL_SERVER', 'PLAYWRIGHT_TARGET_ENV', 'PLAYWRIGHT_TARGET_URL',
        'PLAYWRIGHT_ADDITIONAL_PATHS', 'PLAYWRIGHT_MEASURE_PERFORMANCE', 'PLAYWRIGHT_LOG_METRICS',
        'PLAYWRIGHT_HEADLESS', 'PLAYWRIGHT_LOG_DIR', 'PLAYWRIGHT_SCREENSHOT_DIR', 'PLAYWRIGHT_MAX_DISK_USAGE'
    ];
    return pwKeys.includes(key) || key.startsWith('PLAYWRIGHT_') || key.startsWith('PW_') || key.startsWith('PD_');
}

// Populate Environment Variables Table with two sections
function populateEnvironmentTable(environment) {
    const pwTableBody = document.getElementById('pwEnvTableBody');
    const systemTableBody = document.getElementById('systemEnvTableBody');
    
    pwTableBody.innerHTML = '';
    systemTableBody.innerHTML = '';
    
    // Separate PW-related and system variables
    const pwVars = [];
    const systemVars = [];
    
    Object.entries(environment).forEach(([key, data]) => {
        if (isPWRelated(key) || data.isKey) {
            pwVars.push([key, data]);
        } else {
            systemVars.push([key, data]);
        }
    });
    
    // Sort both groups
    pwVars.sort(([keyA, dataA], [keyB, dataB]) => {
        if (dataA.isKey && !dataB.isKey) return -1;
        if (!dataA.isKey && dataB.isKey) return 1;
        return keyA.localeCompare(keyB);
    });
    
    systemVars.sort(([keyA], [keyB]) => keyA.localeCompare(keyB));
    
    // Populate PW Variables table
    pwVars.forEach(([key, data]) => {
        const row = pwTableBody.insertRow();
        populateEnvRow(row, key, data);
    });
    
    // Populate System Variables table
    systemVars.forEach(([key, data]) => {
        const row = systemTableBody.insertRow();
        populateEnvRow(row, key, data);
    });
    
    // Update counts
    document.getElementById('pwVarCount').textContent = pwVars.length;
    document.getElementById('systemVarCount').textContent = systemVars.length;
}

// Helper function to populate a single environment variable row
function populateEnvRow(row, key, data) {
    // Variable name (highlight key variables)
    const nameColor = data.isKey ? '#ffaa00' : '#ccc';
    const nameWeight = data.isKey ? 'bold' : 'normal';
    row.insertCell(0).innerHTML = `<span style="color: ${nameColor}; font-weight: ${nameWeight};">${key}</span>`;
    
    // Value (truncate if too long)
    const value = data.value || 'Not Set';
    const displayValue = value.length > 50 ? value.substring(0, 47) + '...' : value;
    row.insertCell(1).innerHTML = `<code style="background: #1a1a1a; padding: 2px 4px; border-radius: 2px; font-size: 11px;">${displayValue}</code>`;
    
    // Key variable indicator
    row.insertCell(2).innerHTML = data.isKey ? '<span style="color: #00ff00;">Yes</span>' : '<span style="color: #666;">No</span>';
    
    // Path status
    let pathStatus = 'N/A';
    if (data.resolved) {
        if (data.resolved.exists) {
            pathStatus = data.resolved.isDirectory ? 
                '<span style="color: #00ff00;">Directory Exists</span>' : 
                '<span style="color: #00ff00;">File Exists</span>';
        } else {
            pathStatus = '<span style="color: #ff4444;">Not Found</span>';
        }
    }
    row.insertCell(3).innerHTML = pathStatus;
    
    // Description
    const description = data.description || 'No description';
    row.insertCell(4).innerHTML = `<span style="color: #ccc; font-size: 11px;">${description}</span>`;
}

// Populate System Health Table
function populateSystemHealthTable(systemHealth) {
    const tbody = document.getElementById('healthTableBody');
    tbody.innerHTML = '';
    
    // Memory metrics
    if (systemHealth.memory) {
        const mem = systemHealth.memory;
        const memRow = tbody.insertRow();
        memRow.insertCell(0).innerHTML = '<strong style="color: #00ff00;">Memory</strong>';
        memRow.insertCell(1).innerHTML = `<span style="color: #ffaa00;">${mem.usagePercent.toFixed(1)}%</span>`;
        memRow.insertCell(2).innerHTML = `Total: ${formatBytes(mem.total)} | Free: ${formatBytes(mem.free)} | Used: ${formatBytes(mem.used)}`;
        
        const memStatus = mem.usagePercent > 90 ? 
            '<span style="color: #ff4444;">High</span>' : 
            mem.usagePercent > 70 ? 
            '<span style="color: #ffaa00;">Medium</span>' : 
            '<span style="color: #00ff00;">Good</span>';
        memRow.insertCell(3).innerHTML = memStatus;
    }
    
    // Disk metrics
    if (systemHealth.disk) {
        const disk = systemHealth.disk;
        const diskRow = tbody.insertRow();
        diskRow.insertCell(0).innerHTML = '<strong style="color: #00ff00;">Disk</strong>';
        diskRow.insertCell(1).innerHTML = `<span style="color: #ffaa00;">${disk.usePercent}</span>`;
        diskRow.insertCell(2).innerHTML = `Size: ${disk.size} | Used: ${disk.used} | Available: ${disk.available}`;
        
        const usage = parseInt(disk.usePercent);
        const diskStatus = usage > 90 ? 
            '<span style="color: #ff4444;">Full</span>' : 
            usage > 70 ? 
            '<span style="color: #ffaa00;">High</span>' : 
            '<span style="color: #00ff00;">Good</span>';
        diskRow.insertCell(3).innerHTML = diskStatus;
    }
    
    // CPU/Load metrics
    if (systemHealth.loadAverage) {
        const loadRow = tbody.insertRow();
        loadRow.insertCell(0).innerHTML = '<strong style="color: #00ff00;">CPU Load</strong>';
        loadRow.insertCell(1).innerHTML = `<span style="color: #ffaa00;">${systemHealth.loadAverage[0].toFixed(2)}</span>`;
        loadRow.insertCell(2).innerHTML = `1min: ${systemHealth.loadAverage[0].toFixed(2)} | 5min: ${systemHealth.loadAverage[1].toFixed(2)} | 15min: ${systemHealth.loadAverage[2].toFixed(2)}`;
        
        const loadStatus = systemHealth.loadAverage[0] > 4 ? 
            '<span style="color: #ff4444;">High</span>' : 
            systemHealth.loadAverage[0] > 2 ? 
            '<span style="color: #ffaa00;">Medium</span>' : 
            '<span style="color: #00ff00;">Good</span>';
        loadRow.insertCell(3).innerHTML = loadStatus;
    }
    
    // Uptime
    if (systemHealth.uptime) {
        const uptimeRow = tbody.insertRow();
        uptimeRow.insertCell(0).innerHTML = '<strong style="color: #00ff00;">Uptime</strong>';
        uptimeRow.insertCell(1).innerHTML = `<span style="color: #ffaa00;">${formatUptime(systemHealth.uptime)}</span>`;
        uptimeRow.insertCell(2).innerHTML = `System has been running for ${formatUptime(systemHealth.uptime)}`;
        uptimeRow.insertCell(3).innerHTML = '<span style="color: #00ff00;">Running</span>';
    }
}

// Helper function to format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Helper function to format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
}

// Test Suite Manager has been removed.