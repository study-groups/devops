// API Helper - Displays all available API endpoints with module locations
window.addEventListener('DOMContentLoaded', () => {
    console.log('API Helper loaded');
    
    // Check if running in standalone mode
    const isIframe = window.self !== window.top;
    const standaloneTitle = document.getElementById('standalone-title');
    if (!isIframe && standaloneTitle) {
        standaloneTitle.style.display = 'block';
    }

    // DOM elements
    const endpointsTable = document.getElementById('endpoints-table');
    const methodFilter = document.getElementById('method-filter');
    const moduleFilter = document.getElementById('module-filter');
    const searchFilter = document.getElementById('search-filter');
    
    // Summary elements
    const totalEndpoints = document.getElementById('total-endpoints');
    const totalModules = document.getElementById('total-modules');
    const getCount = document.getElementById('get-count');
    const postCount = document.getElementById('post-count');

    // API endpoints data
    let allEndpoints = [];
    let filteredEndpoints = [];

    // Initialize the interface
    initialize();

    async function initialize() {
        try {
            await loadApiEndpoints();
            setupFilters();
            renderEndpoints();
            updateSummary();
        } catch (error) {
            console.error('Failed to initialize API Helper:', error);
            showError('Failed to load API endpoints');
        }
    }

    async function loadApiEndpoints() {
        try {
            // For now, we'll use a hardcoded list based on the codebase analysis
            // Later this could be enhanced to dynamically discover endpoints
            allEndpoints = generateEndpointsList();
            filteredEndpoints = [...allEndpoints];
        } catch (error) {
            console.error('Error loading API endpoints:', error);
            throw error;
        }
    }

    function generateEndpointsList() {
        return [
            // API Routes (api.js)
            { method: 'GET', path: '/api/named-tests', module: 'api', file: 'routes/api.js', line: 31, description: 'Get all named test configurations' },
            { method: 'POST', path: '/api/named-tests', module: 'api', file: 'routes/api.js', line: 42, description: 'Create new named test configuration' },
            { method: 'DELETE', path: '/api/named-tests/:id', module: 'api', file: 'routes/api.js', line: 96, description: 'Delete named test configuration' },
            { method: 'GET', path: '/api/stats', module: 'api', file: 'routes/api.js', line: 117, description: 'Get system and directory statistics' },
            { method: 'GET', path: '/api/environment', module: 'api', file: 'routes/api.js', line: 138, description: 'Get environment variables (legacy)' },
            { method: 'GET', path: '/api/system/environment', module: 'api', file: 'routes/api.js', line: 138, description: 'Get environment variables' },
            { method: 'GET', path: '/api/filesystem', module: 'api', file: 'routes/api.js', line: 153, description: 'Get comprehensive filesystem and environment data' },
            { method: 'POST', path: '/api/test/custom/:env', module: 'api', file: 'routes/api.js', line: 507, description: 'Run custom test selection' },
            { method: 'POST', path: '/api/test/quick/:env', module: 'api', file: 'routes/api.js', line: 571, description: 'Run quick test' },
            { method: 'GET', path: '/api/tests', module: 'api', file: 'routes/api.js', line: 628, description: 'Get available tests and test suites' },
            { method: 'GET', path: '/api/tests/:filename/source', module: 'api', file: 'routes/api.js', line: 678, description: 'Get test source code' },
            { method: 'POST', path: '/api/command/run', module: 'api', file: 'routes/api.js', line: 701, description: 'Execute commands (preferred endpoint)' },
            { method: 'POST', path: '/api/playwright/run', module: 'api', file: 'routes/api.js', line: 701, description: 'Execute Playwright command (legacy)' },
            { method: 'POST', path: '/api/command/run', module: 'api', file: 'routes/api.js', line: 804, description: 'Execute generic command' },
            { method: 'GET', path: '/api/playwright/progress', module: 'api', file: 'routes/api.js', line: 864, description: 'Get Playwright test progress' },
            { method: 'GET', path: '/api/playwright/admin-results', module: 'api', file: 'routes/api.js', line: 880, description: 'Get Playwright admin results' },
            { method: 'GET', path: '/api/config', module: 'api', file: 'routes/api.js', line: 907, description: 'Get Playwright configuration' },
            { method: 'POST', path: '/api/test-results/save', module: 'api', file: 'routes/api.js', line: 950, description: 'Save test results' },
            { method: 'GET', path: '/api/test-results/central', module: 'api', file: 'routes/api.js', line: 974, description: 'Get central test results' },
            { method: 'POST', path: '/api/monitoring/start-all', module: 'api', file: 'routes/api.js', line: 994, description: 'Start monitoring for all environments' },
            { method: 'POST', path: '/api/monitoring/start/:env', module: 'api', file: 'routes/api.js', line: 1105, description: 'Start monitoring for specific environment' },
            { method: 'POST', path: '/api/monitoring/stop-all', module: 'api', file: 'routes/api.js', line: 1168, description: 'Stop all monitoring' },
            { method: 'POST', path: '/api/monitoring/stop/:env', module: 'api', file: 'routes/api.js', line: 1214, description: 'Stop monitoring for specific environment' },
            { method: 'GET', path: '/api/logs/aggregated', module: 'api', file: 'routes/api.js', line: 1272, description: 'Get aggregated logs (deprecated)' },
            { method: 'POST', path: '/api/logs/ping', module: 'api', file: 'routes/api.js', line: 1282, description: 'Create ping log entry' },
            { method: 'POST', path: '/api/logs/perform-load-test/:env', module: 'api', file: 'routes/api.js', line: 1318, description: 'Perform load test' },
            { method: 'POST', path: '/api/logs/generate-ping/:env', module: 'api', file: 'routes/api.js', line: 1385, description: 'Generate ping test' },
            { method: 'GET', path: '/api/monitoring/status', module: 'api', file: 'routes/api.js', line: 1498, description: 'Get monitoring status' },
            { method: 'GET', path: '/api/testing-matrix', module: 'api', file: 'routes/api.js', line: 1533, description: 'Get testing matrix configuration' },
            { method: 'POST', path: '/api/testing-matrix/run', module: 'api', file: 'routes/api.js', line: 1686, description: 'Run testing matrix' },
            { method: 'GET', path: '/api/system/info', module: 'api', file: 'routes/api.js', line: 1738, description: 'Get system information' },
            { method: 'POST', path: '/api/system-logs', module: 'api', file: 'routes/api.js', line: 1767, description: 'Create system log entry' },
            { method: 'POST', path: '/api/testing-matrix/log-run', module: 'api', file: 'routes/api.js', line: 1788, description: 'Log testing matrix run' },
            { method: 'GET', path: '/api/testing-matrix/status/:runId', module: 'api', file: 'routes/api.js', line: 1818, description: 'Get testing matrix run status' },
            { method: 'POST', path: '/api/testing-matrix/stop', module: 'api', file: 'routes/api.js', line: 1892, description: 'Stop testing matrix run' },
            { method: 'GET', path: '/api/testing-matrix/results', module: 'api', file: 'routes/api.js', line: 1913, description: 'Get testing matrix results' },
            { method: 'GET', path: '/api/system/processes', module: 'api', file: 'routes/api.js', line: 1999, description: 'Get system processes' },
            { method: 'POST', path: '/api/monitoring/log', module: 'api', file: 'routes/api.js', line: 2063, description: 'Create monitoring log entry' },
            { method: 'GET', path: '/api/monitoring/test-probes', module: 'api', file: 'routes/api.js', line: 2084, description: 'Get test probes' },

            { method: 'GET', path: '/api/directory-stats/:env', module: 'api', file: 'routes/api.js', line: 2272, description: 'Get directory statistics for environment' },
            { method: 'POST', path: '/api/main-log', module: 'api', file: 'routes/api.js', line: 2488, description: 'Create main log entry (deprecated)' },
            { method: 'GET', path: '/api/logs', module: 'api', file: 'routes/api.js', line: 2568, description: 'Get log files' },

            // Pages Routes (pages.js)
            { method: 'GET', path: '/pages/command-runner', module: 'pages', file: 'routes/pages.js', line: 15, description: 'Serve Command Runner interface' },
            { method: 'GET', path: '/pages/playwright', module: 'pages', file: 'routes/pages.js', line: 38, description: 'Redirect to Command Runner (legacy)' },
            { method: 'GET', path: '/pages/system', module: 'pages', file: 'routes/pages.js', line: 43, description: 'Serve System Control Panel' },
            { method: 'GET', path: '/pages/pcb', module: 'pages', file: 'routes/pages.js', line: 66, description: 'Serve Playwright Command Builder' },
            { method: 'GET', path: '/pages/tsv', module: 'pages', file: 'routes/pages.js', line: 89, description: 'Serve Test Suite Viewer' },
            { method: 'GET', path: '/pages/theme-demo', module: 'pages', file: 'routes/pages.js', line: 112, description: 'Serve Theme Demo' },
            { method: 'GET', path: '/pages/filesystem', module: 'pages', file: 'routes/pages.js', line: 135, description: 'Serve Filesystem Monitor' },
            { method: 'GET', path: '/pages/reports', module: 'pages', file: 'routes/pages.js', line: 153, description: 'Serve Reports interface' },
            { method: 'GET', path: '/pages/info', module: 'pages', file: 'routes/pages.js', line: 164, description: 'Serve Info page' },
            { method: 'GET', path: '/pages/', module: 'pages', file: 'routes/pages.js', line: 182, description: 'List available pages' },

            // Reports Routes (reports.js)
            { method: 'GET', path: '/reports/', module: 'reports', file: 'routes/reports.js', line: 18, description: 'Serve reports listing' },

            // Admin Routes (admin.js)
            { method: 'GET', path: '/admin/', module: 'admin', file: 'routes/admin.js', line: 9, description: 'Serve admin interface' },

            // Root Routes (index.js)
            { method: 'GET', path: '/', module: 'index', file: 'routes/index.js', line: 14, description: 'Serve main dashboard' },
            { method: 'GET', path: '/health', module: 'index', file: 'routes/index.js', line: 37, description: 'Health check endpoint' },
            { method: 'GET', path: '/admin', module: 'index', file: 'routes/index.js', line: 53, description: 'Redirect to admin interface' }
        ];
    }

    function setupFilters() {
        // Populate module filter
        const modules = [...new Set(allEndpoints.map(ep => ep.module))].sort();
        modules.forEach(module => {
            const option = document.createElement('option');
            option.value = module;
            option.textContent = module;
            moduleFilter.appendChild(option);
        });

        // Add event listeners
        methodFilter.addEventListener('change', applyFilters);
        moduleFilter.addEventListener('change', applyFilters);
        searchFilter.addEventListener('input', applyFilters);
    }

    function applyFilters() {
        const methodValue = methodFilter.value;
        const moduleValue = moduleFilter.value;
        const searchValue = searchFilter.value.toLowerCase();

        filteredEndpoints = allEndpoints.filter(endpoint => {
            const matchesMethod = !methodValue || endpoint.method === methodValue;
            const matchesModule = !moduleValue || endpoint.module === moduleValue;
            const matchesSearch = !searchValue || 
                endpoint.path.toLowerCase().includes(searchValue) ||
                endpoint.description.toLowerCase().includes(searchValue) ||
                endpoint.module.toLowerCase().includes(searchValue);

            return matchesMethod && matchesModule && matchesSearch;
        });

        renderEndpoints();
        updateSummary();
    }

    function renderEndpoints() {
        if (filteredEndpoints.length === 0) {
            endpointsTable.innerHTML = '<tr><td colspan="6" class="loading">No endpoints match the current filters</td></tr>';
            return;
        }

        endpointsTable.innerHTML = filteredEndpoints.map(endpoint => `
            <tr>
                <td>
                    <span class="method-badge method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
                </td>
                <td>
                    <span class="endpoint-path">${endpoint.path}</span>
                </td>
                <td>
                    <span class="module-file">${endpoint.module}</span>
                </td>
                <td>
                    <span class="module-location">${endpoint.file}:${endpoint.line}</span>
                </td>
                <td>
                    <span class="description">${endpoint.description}</span>
                </td>
                <td>
                    ${endpoint.method === 'GET' ? 
                        `<button class="test-button" onclick="testEndpoint('${endpoint.path}', '${endpoint.method}')">Test</button>` : 
                        '<span class="description">-</span>'
                    }
                </td>
            </tr>
        `).join('');
    }

    function updateSummary() {
        const methodCounts = filteredEndpoints.reduce((acc, ep) => {
            acc[ep.method] = (acc[ep.method] || 0) + 1;
            return acc;
        }, {});

        const modules = new Set(filteredEndpoints.map(ep => ep.module));

        totalEndpoints.textContent = filteredEndpoints.length;
        totalModules.textContent = modules.size;
        getCount.textContent = methodCounts.GET || 0;
        postCount.textContent = methodCounts.POST || 0;
    }

    function showError(message) {
        endpointsTable.innerHTML = `<tr><td colspan="6" class="loading" style="color: var(--devwatch-error);">Error: ${message}</td></tr>`;
    }

    // Global function for testing endpoints
    window.testEndpoint = function(path, method) {
        if (method === 'GET') {
            // Open in new tab for GET requests
            const fullUrl = `${window.location.origin}${path}`;
            window.open(fullUrl, '_blank');
        }
    };

    // Send ready message if in iframe
    if (window.DevWatch && typeof window.DevWatch.sendMessage === 'function') {
        window.DevWatch.sendMessage('devwatch-iframe-ready', { url: window.location.href });
    }
});
