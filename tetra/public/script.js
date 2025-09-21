console.log('SCRIPT LOADING...');
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM LOADED - SCRIPT RUNNING');
    const term = new Terminal({
        cursorBlink: true,
        fontSize: 20,
        fontFamily: 'JetBrains Mono, SF Mono, Monaco, Inconsolata, monospace',
        theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
        }
    });
    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    // Connection state variables (declare first)
    let currentConnection = null;
    let connectionMode = 'local';
    let isConnected = false;
    let connectionStatus = 'idle'; // idle, connecting, connected, error

    // Load environment defaults (commented out for now)
    // loadEnvironmentDefaults();

    // Add welcome message to terminal
    term.writeln('\r\n\x1b[36m🚀 Tetra Console initialized\x1b[0m');
    term.writeln('\x1b[33mLocal Server: Direct shell on Tetra server | Remote SSH: Connect to external hosts\x1b[0m');
    term.writeln('\x1b[32mCurrent context: TKM (Tetra Key Manager)\x1b[0m\r\n');

    // WebSocket connections
    let sshWs = null;
    let localSocket = null;

    // --- State Machine ---
    const states = {
        IDLE: { next: 'MERGING', button: 'btn-merge' },
        MERGING: { next: 'READY_TO_BUILD', button: 'btn-prep' },
        READY_TO_BUILD: { next: 'BUILT', button: 'btn-build' },
        BUILT: { next: 'RUNNING', button: 'btn-restart' },
        RUNNING: { next: 'STOPPED', button: 'btn-stop' },
        STOPPED: { next: 'IDLE', button: 'btn-merge' },
    };
    let currentState = 'IDLE';

    // --- DOM Elements ---
    const stateDisplay = document.getElementById('current-state');
    const connectionModeSelect = document.getElementById('connection-mode');
    const sshFields = document.getElementById('ssh-fields');
    const contextPanel = document.getElementById('context-panel');
    const actionPanel = document.getElementById('action-panel');
    const terminalContainer = document.getElementById('terminal-container');
    const outputLog = document.getElementById('output-log');
    const outputContent = document.getElementById('output-content');
    const tetraContainer = document.getElementById('tetra-container');
    const actionsTitle = document.getElementById('actions-title');

    // Toggle buttons
    const toggleConnection = document.getElementById('toggle-connection');
    const toggleActions = document.getElementById('toggle-actions');
    const toggleTerminal = document.getElementById('toggle-terminal');
    const toggleOutput = document.getElementById('toggle-output');
    const descriptionText = document.getElementById('tetra-description');

    // Context badges
    const contextBadges = document.querySelectorAll('.context-badge');

    // SSH key management buttons
    const saveKeyBtn = document.getElementById('save-ssh-key');
    const loadKeyBtn = document.getElementById('load-ssh-key');
    const clearKeyBtn = document.getElementById('clear-ssh-key');

    // Current context
    let currentContext = 'TKM';

    // Initialize everything after DOM elements are defined
    setTimeout(() => {
        setConnectionStatus('idle');
        updateLayout();
        setContext('TKM');
        updateKeyButtonStates();
    }, 100);

    const buttons = {
        statusConnect: document.getElementById('status-connect-btn'),
        merge: document.getElementById('btn-merge'),
        prep: document.getElementById('btn-prep'),
        build: document.getElementById('btn-build'),
        restart: document.getElementById('btn-restart'),
        stop: document.getElementById('btn-stop'),
    };

    // --- Context Management ---
    const contextConfigs = {
        TKM: {
            title: 'Actions for TKM',
            fullName: 'Tetra Key Management',
            description: 'Secure key generation, storage, and rotation for DevOps infrastructure',
            actions: ['Generate', 'Import', 'Export', 'Rotate', 'Verify', 'Backup', 'Audit']
        },
        TSM: {
            title: 'Actions for TSM',
            fullName: 'Tetra Service Manager',
            description: 'Service orchestration, monitoring, and lifecycle management',
            actions: ['Start', 'Stop', 'Restart', 'Status', 'Logs', 'Scale', 'Monitor']
        },
        DEPLOY: {
            title: 'Actions for DEPLOY',
            fullName: 'CI/CD for code and games',
            description: 'Continuous integration and deployment pipeline management',
            actions: ['Deploy', 'Build', 'Test', 'Rollback', 'Status', 'Pipeline', 'Artifacts']
        },
        PBASE: {
            title: 'Actions for PBASE',
            fullName: 'Multiplayer game server and asset manager',
            description: 'Game server management and digital asset pipeline',
            actions: ['Deploy', 'Assets', 'Players', 'Backup', 'Monitor', 'Scaling', 'Analytics']
        }
    };

    // --- Panel Toggle Handling ---
    toggleConnection.addEventListener('click', () => togglePanel('connection'));
    toggleActions.addEventListener('click', () => togglePanel('actions'));
    toggleTerminal.addEventListener('click', () => togglePanel('terminal'));
    toggleOutput.addEventListener('click', () => togglePanel('output'));

    // --- Context Badge Handling ---
    contextBadges.forEach(badge => {
        badge.addEventListener('click', () => {
            const context = badge.dataset.context;
            if (context && context !== 'OUTPUT' && context !== 'PLACEHOLDER1' && context !== 'PLACEHOLDER2') {
                setContext(context);
            } else if (context === 'OUTPUT') {
                toggleOutputLog();
            }
        });
    });

    // --- SSH Key Management ---
    if (saveKeyBtn) {
        saveKeyBtn.addEventListener('click', saveSSHKey);
    }
    if (loadKeyBtn) {
        loadKeyBtn.addEventListener('click', loadSSHKey);
    }
    if (clearKeyBtn) {
        clearKeyBtn.addEventListener('click', clearSSHKey);
    }

    // --- Connection Mode Handling ---
    connectionModeSelect.addEventListener('change', (e) => {
        connectionMode = e.target.value;

        // Visual test - change title to show it's working
        document.querySelector('h1').textContent = `Tetra Console (${connectionMode.toUpperCase()})`;

        if (connectionMode === 'ssh') {
            sshFields.style.display = 'block';
        } else {
            sshFields.style.display = 'none';
        }

        if (isConnected) {
            disconnect();
        }
    });

    // --- Connection Management ---
    function connect() {
        if (isConnected) {
            term.writeln('\r\n\x1b[33m⚠️ Already connected\x1b[0m');
            return;
        }

        setConnectionStatus('connecting');

        if (connectionMode === 'local') {
            connectLocal();
        } else {
            connectSSH();
        }
    }

    function connectLocal() {
        term.writeln('\r\n\x1b[36m🔗 Connecting to local Tetra server shell...\x1b[0m');

        try {
            localSocket = io();

            localSocket.on('connect', () => {
                term.writeln('\r\n\x1b[32m✅ Connected to local Tetra server\x1b[0m');
                currentConnection = 'local';
                setConnectionStatus('connected');
            });

            localSocket.on('output', (data) => {
                term.write(data);
            });

            localSocket.on('disconnect', () => {
                term.writeln('\r\n\x1b[33m🔌 Direct shell disconnected\x1b[0m');
                currentConnection = null;
                setConnectionStatus('idle');
            });

        } catch (error) {
            term.writeln('\r\n\x1b[31m❌ Failed to connect to local terminal\x1b[0m');
            console.error('Local connection error:', error);
            setConnectionStatus('error');
        }
    }

    function connectSSH() {
        const context = getSSHContext();
        const token = localStorage.getItem('ssh_token');
        const expires = localStorage.getItem('ssh_token_expires');
        const hasValidToken = token && expires && Date.now() < parseInt(expires);

        // Check if we have either a token or direct key input
        const hasKey = context.privateKey && context.privateKey !== '[Key loaded from token]';
        if (!context.host || !context.username || (!hasKey && !hasValidToken)) {
            term.writeln('\r\n\x1b[31m❌ SSH host, username, and private key (or saved token) are required\x1b[0m');
            return;
        }

        term.writeln('\r\n\x1b[36m🔗 Connecting to SSH...\x1b[0m');

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/admin/tetra/ssh-bridge`;
            sshWs = new WebSocket(wsUrl);

            sshWs.onopen = () => {
                term.writeln('\r\n\x1b[32m✅ WebSocket connected\x1b[0m');

                // Send auth message with token if available, otherwise use direct key
                if (hasValidToken) {
                    // When using token, only send token - no private key data
                    const tokenMessage = {
                        type: 'auth',
                        token: token,
                        port: context.port
                    };
                    console.log('Sending token auth message:', tokenMessage);
                    sshWs.send(JSON.stringify(tokenMessage));
                    term.writeln('\r\n\x1b[33m🔐 Using saved SSH key...\x1b[0m');
                } else {
                    // When using direct key, send all key data
                    const keyMessage = {
                        type: 'auth',
                        host: context.host,
                        username: context.username,
                        privateKey: context.privateKey,
                        passphrase: context.passphrase || undefined,
                        port: context.port
                    };
                    console.log('Sending direct key auth message:', { ...keyMessage, privateKey: '[REDACTED]' });
                    sshWs.send(JSON.stringify(keyMessage));
                    term.writeln('\r\n\x1b[33m🔐 Using direct SSH key...\x1b[0m');
                }
            };

            sshWs.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    handleSSHMessage(message);
                } catch (err) {
                    console.error('Error parsing SSH message:', err);
                }
            };

            sshWs.onclose = () => {
                term.writeln('\r\n\x1b[33m🔌 SSH connection closed\x1b[0m');
                currentConnection = null;
                setConnectionStatus('idle');
            };

            sshWs.onerror = (error) => {
                term.writeln('\r\n\x1b[31m❌ SSH connection error\x1b[0m');
                console.error('SSH WebSocket error:', error);
                setConnectionStatus('error');
            };

        } catch (error) {
            term.writeln('\r\n\x1b[31m❌ Failed to create SSH connection\x1b[0m');
            console.error('SSH connection error:', error);
            setConnectionStatus('error');
        }
    }

    function disconnect() {
        if (currentConnection === 'local' && localSocket) {
            localSocket.disconnect();
            localSocket = null;
        } else if (currentConnection === 'ssh' && sshWs) {
            sshWs.send(JSON.stringify({ type: 'disconnect' }));
            sshWs.close();
            sshWs = null;
        }

        currentConnection = null;
        setConnectionStatus('idle');
        term.writeln('\r\n\x1b[33m🔌 Disconnected\x1b[0m');
    }

    // --- Message Handlers ---
    function handleSSHMessage(message) {
        switch (message.type) {
            case 'ready':
                term.writeln('\r\n\x1b[32m🚀 SSH Bridge ready\x1b[0m');
                break;
            case 'connected':
                term.writeln(`\r\n\x1b[32m✅ ${message.message}\x1b[0m`);
                currentConnection = 'ssh';
                setConnectionStatus('connected');
                break;
            case 'output':
                term.write(message.data);
                break;
            case 'error':
                term.writeln(`\r\n\x1b[31m❌ ${message.message}\x1b[0m`);
                setConnectionStatus('error');
                break;
            case 'disconnected':
                term.writeln(`\r\n\x1b[33m🔌 ${message.message}\x1b[0m`);
                currentConnection = null;
                setConnectionStatus('idle');
                break;
        }
    }

    // --- Panel Management Functions ---
    function togglePanel(panelType) {
        const toggleButton = document.getElementById(`toggle-${panelType}`);
        let panel;

        if (panelType === 'connection') {
            panel = contextPanel;
        } else if (panelType === 'actions') {
            panel = actionPanel;
        } else if (panelType === 'terminal') {
            panel = terminalContainer;
        } else if (panelType === 'output') {
            panel = outputLog;
        }

        if (panel.classList.contains('panel-visible')) {
            panel.classList.remove('panel-visible');
            panel.classList.add('panel-hidden');
            toggleButton.classList.remove('active');
        } else {
            panel.classList.remove('panel-hidden');
            panel.classList.add('panel-visible');
            toggleButton.classList.add('active');
        }

        updateLayout();
        updateDescriptionVisibility();
    }

    function updateDescriptionVisibility() {
        const allPanelsHidden = contextPanel.classList.contains('panel-hidden') &&
                               actionPanel.classList.contains('panel-hidden') &&
                               terminalContainer.classList.contains('panel-hidden') &&
                               outputLog.classList.contains('panel-hidden');

        descriptionText.style.display = allPanelsHidden ? 'block' : 'none';
    }

    function updateLayout() {
        const connectionVisible = contextPanel.classList.contains('panel-visible');
        const actionsVisible = actionPanel.classList.contains('panel-visible');
        const terminalVisible = terminalContainer.classList.contains('panel-visible');

        // Remove all layout classes
        tetraContainer.classList.remove('layout-terminal-only', 'layout-one-panel', 'layout-two-panels');

        // Count visible panels
        const visiblePanels = [connectionVisible, actionsVisible].filter(Boolean).length;

        if (!terminalVisible) {
            // Terminal hidden - panels can span full width
            if (visiblePanels === 0) {
                // No panels visible
                tetraContainer.style.gridTemplateAreas = '"header header" "output output"';
            } else if (visiblePanels === 1) {
                // One panel visible, spans full width
                tetraContainer.style.gridTemplateAreas = '"header header" "panel panel" "output output"';
                // Assign the visible panel to "panel" area
                if (connectionVisible) contextPanel.style.gridArea = 'panel';
                if (actionsVisible) actionPanel.style.gridArea = 'panel';
            } else {
                // Two panels visible
                tetraContainer.style.gridTemplateAreas = '"header header" "context actions" "output output"';
                // Reset to normal grid areas
                contextPanel.style.gridArea = 'context';
                actionPanel.style.gridArea = 'actions';
            }
        } else {
            // Terminal visible
            if (visiblePanels === 0) {
                // Only terminal visible
                tetraContainer.style.gridTemplateAreas = '"header header" "terminal terminal" "output output"';
            } else if (visiblePanels === 1) {
                // One panel + terminal
                tetraContainer.style.gridTemplateAreas = '"header header" "panel panel" "terminal terminal" "output output"';
                // Assign the visible panel to "panel" area
                if (connectionVisible) contextPanel.style.gridArea = 'panel';
                if (actionsVisible) actionPanel.style.gridArea = 'panel';
            } else {
                // Two panels + terminal (normal layout)
                tetraContainer.style.gridTemplateAreas = '"header header" "context actions" "terminal terminal" "output output"';
                // Reset to normal grid areas
                contextPanel.style.gridArea = 'context';
                actionPanel.style.gridArea = 'actions';
            }
        }

        // Resize terminal to fit new layout
        setTimeout(() => {
            if (typeof fitAddon !== 'undefined') {
                fitAddon.fit();
            }
        }, 300);
    }

    function setContext(context) {
        const previousContext = currentContext;
        currentContext = context;

        // Update active badge
        contextBadges.forEach(badge => {
            badge.classList.remove('active');
            if (badge.dataset.context === context) {
                badge.classList.add('active');
            }
        });

        // Update actions title and buttons
        const config = contextConfigs[context];
        if (config) {
            actionsTitle.textContent = config.title;
            const actionsInfo = document.getElementById('actions-info');
            if (actionsInfo) {
                actionsInfo.textContent = `${context} - ${config.fullName}: ${config.description}`;
            }
            updateActionButtons(config.actions);
        }

        // Add terminal message for context switch (except initial load)
        if (previousContext !== context && previousContext !== undefined) {
            term.writeln(`\r\n\x1b[36m📋 Context switched to ${context} (${config.fullName})\x1b[0m`);
            term.writeln(`\x1b[32m${config.description}\x1b[0m`);
        }

        // Add log entry
        addLogEntry(`Context switched to ${context}`, 'info');
    }

    function updateActionButtons(actions) {
        const actionButtons = document.getElementById('action-buttons');
        actionButtons.innerHTML = '';

        actions.forEach((action, index) => {
            const button = document.createElement('button');
            button.id = `btn-${action.toLowerCase()}`;
            button.textContent = action;

            if (action === 'Connect') {
                button.classList.add('primary');
                button.addEventListener('click', connect);
            } else if (action === 'Disconnect') {
                button.disabled = true;
                button.classList.add('danger');
                button.addEventListener('click', disconnect);
            } else {
                button.disabled = !isConnected;
                button.addEventListener('click', () => executeContextAction(action));
            }

            actionButtons.appendChild(button);
        });

        // Update button references for updateUI function
        updateButtonReferences();
    }

    function updateButtonReferences() {
        buttons.statusConnect = document.getElementById('status-connect-btn');
        buttons.merge = document.getElementById('btn-merge');
        buttons.prep = document.getElementById('btn-prep');
        buttons.build = document.getElementById('btn-build');
        buttons.restart = document.getElementById('btn-restart') || document.getElementById('btn-start');
        buttons.stop = document.getElementById('btn-stop');
    }

    function executeContextAction(action) {
        const workContext = getWorkContext();
        const message = `Executing ${currentContext} action: ${action}`;

        addLogEntry(message, 'info');

        // Send command to terminal based on connection type
        if (isConnected) {
            const command = `echo "Executing ${action} for ${currentContext}..."\n`;
            sendCommand(command);
        }
    }

    function addLogEntry(message, type = 'info') {
        const entry = document.createElement('p');
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        outputContent.appendChild(entry);
        outputContent.scrollTop = outputContent.scrollHeight;
    }

    function toggleOutputLog() {
        if (outputLog.classList.contains('panel-visible')) {
            outputLog.classList.remove('panel-visible');
            outputLog.classList.add('panel-hidden');
        } else {
            outputLog.classList.remove('panel-hidden');
            outputLog.classList.add('panel-visible');
        }
    }

    function sendCommand(command) {
        if (currentConnection === 'local' && localSocket) {
            localSocket.emit('input', command);
        } else if (currentConnection === 'ssh' && sshWs) {
            sshWs.send(JSON.stringify({
                type: 'input',
                data: command
            }));
        }
    }

    // --- SSH Key Management Functions ---
    async function saveSSHKey() {
        const context = getSSHContext();

        if (!context.host || !context.username || !context.privateKey) {
            addLogEntry('Please fill in Host, User, and Key before saving', 'warning');
            return;
        }

        try {
            const response = await fetch('/admin/tetra/api/auth/ssh-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(context)
            });

            if (response.ok) {
                const result = await response.json();
                localStorage.setItem('ssh_token', result.token);
                localStorage.setItem('ssh_token_expires', Date.now() + (30 * 60 * 1000)); // 30 minutes
                addLogEntry('SSH key saved for 30 minutes', 'success');
                updateKeyButtonStates();
            } else {
                throw new Error('Failed to save SSH key');
            }
        } catch (error) {
            addLogEntry('Error saving SSH key: ' + error.message, 'error');
        }
    }

    async function loadSSHKey() {
        const token = localStorage.getItem('ssh_token');
        const expires = localStorage.getItem('ssh_token_expires');

        if (!token || !expires || Date.now() > parseInt(expires)) {
            addLogEntry('No saved SSH key or token expired', 'warning');
            localStorage.removeItem('ssh_token');
            localStorage.removeItem('ssh_token_expires');
            updateKeyButtonStates();
            return;
        }

        try {
            const response = await fetch('/admin/tetra/api/auth/validate-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ token })
            });

            if (response.ok) {
                const result = await response.json();
                document.getElementById('ssh-host').value = result.host;
                document.getElementById('ssh-username').value = result.username;
                // Note: Private key is not returned for security, but will be used via token
                document.getElementById('ssh-private-key').value = '[Key loaded from token]';
                addLogEntry('SSH key loaded successfully', 'success');
                updateKeyButtonStates();
            } else {
                throw new Error('Token validation failed');
            }
        } catch (error) {
            addLogEntry('Error loading SSH key: ' + error.message, 'error');
            localStorage.removeItem('ssh_token');
            localStorage.removeItem('ssh_token_expires');
            updateKeyButtonStates();
        }
    }

    function clearSSHKey() {
        document.getElementById('ssh-host').value = 'dev.pixeljamarcade.com';
        document.getElementById('ssh-username').value = 'dev';
        document.getElementById('ssh-port').value = '22';
        document.getElementById('ssh-private-key').value = '';
        document.getElementById('ssh-passphrase').value = '';
        localStorage.removeItem('ssh_token');
        localStorage.removeItem('ssh_token_expires');
        addLogEntry('SSH key fields cleared', 'info');
        updateKeyButtonStates();
    }

    function updateKeyButtonStates() {
        const token = localStorage.getItem('ssh_token');
        const expires = localStorage.getItem('ssh_token_expires');
        const hasValidToken = token && expires && Date.now() < parseInt(expires);

        if (loadKeyBtn) {
            loadKeyBtn.disabled = !hasValidToken;
            loadKeyBtn.textContent = hasValidToken ? 'Load Saved' : 'No Saved Key';
        }

        if (hasValidToken) {
            const timeLeft = Math.ceil((parseInt(expires) - Date.now()) / 60000);
            if (saveKeyBtn) {
                saveKeyBtn.textContent = `Update (${timeLeft}min left)`;
            }
        } else {
            if (saveKeyBtn) {
                saveKeyBtn.textContent = 'Save Key (30min)';
            }
        }
    }

    // --- Utility Functions ---
    async function loadEnvironmentDefaults() {
        try {
            const response = await fetch('/api/env');
            if (response.ok) {
                const env = await response.json();

                // Update project directory for local mode to use $HOME/src/pixeljam
                const projectDirInput = document.getElementById('project-dir');
                if (projectDirInput.value === '/home/dev/src/pixeljam') {
                    projectDirInput.value = env.defaultProjectDir;
                }
            }
        } catch (error) {
            console.warn('Could not load environment defaults:', error);
        }
    }

    function getSSHContext() {
        // Clean and validate SSH host input
        const rawHost = document.getElementById('ssh-host').value.trim();
        let cleanHost = rawHost;

        // Remove protocol prefixes
        cleanHost = cleanHost.replace(/^https?:\/\//, '');
        cleanHost = cleanHost.replace(/^ssh:\/\//, '');

        // Remove trailing slashes and paths
        cleanHost = cleanHost.split('/')[0];

        return {
            host: cleanHost,
            username: document.getElementById('ssh-username').value,
            port: parseInt(document.getElementById('ssh-port').value) || 22,
            privateKey: document.getElementById('ssh-private-key').value,
            passphrase: document.getElementById('ssh-passphrase').value
        };
    }

    function getWorkContext() {
        return {
            REPO_DIR: document.getElementById('repo-dir').value,
            PROJECT_DIR: document.getElementById('project-dir').value,
            MERGE_BRANCH: document.getElementById('merge-branch').value
        };
    }

    function updateConnectionStatus() {
        let statusText = '';
        let statusColor = '';

        switch (connectionStatus) {
            case 'idle':
                statusText = 'Idle';
                statusColor = '#c586c0'; // Purple
                break;
            case 'connecting':
                statusText = 'Connecting...';
                statusColor = '#f1c21b'; // Yellow
                break;
            case 'connected':
                const connectionType = currentConnection === 'local' ? 'Server' : 'SSH';
                statusText = `Connected (${connectionType})`;
                statusColor = '#42be65'; // Green
                break;
            case 'error':
                statusText = 'Connection Error';
                statusColor = '#fa4d56'; // Red
                break;
        }

        stateDisplay.textContent = statusText;
        stateDisplay.style.color = statusColor;
    }

    function setConnectionStatus(status) {
        connectionStatus = status;
        updateConnectionStatus();

        // Update connection flag
        isConnected = (status === 'connected');

        // Update UI
        updateUI();

        // Log status change
        const logType = status === 'connected' ? 'success' :
                       status === 'error' ? 'error' : 'info';
        addLogEntry(`Connection status: ${status}`, logType);
    }

    function updateUI() {
        // Status button (handles both connect and disconnect)
        if (buttons.statusConnect) {
            buttons.statusConnect.disabled = connectionStatus === 'connecting';
        }

        // Workflow buttons - only enabled when connected
        const workflowButtons = [buttons.merge, buttons.prep, buttons.build, buttons.restart, buttons.stop];

        if (!isConnected) {
            workflowButtons.forEach(btn => {
                if (btn) btn.disabled = true;
            });
            return;
        }

        // Enable workflow buttons based on current state
        workflowButtons.forEach(btn => {
            if (btn) btn.disabled = true;
        });

        if (currentState === 'RUNNING') {
            buttons.stop.disabled = false;
        } else if (currentState === 'STOPPED') {
            buttons.merge.disabled = false;
        } else if (states[currentState]) {
            const nextAction = states[currentState].button;
            const buttonElement = document.getElementById(nextAction);
            if (buttonElement) buttonElement.disabled = false;
        }
    }

    function runAction(action, scriptName) {
        if (!isConnected) {
            term.writeln('\r\n\x1b[31m❌ Not connected. Please connect first.\x1b[0m');
            return;
        }

        if (states[currentState]?.button !== `btn-${action}`) {
            term.writeln(`\r\n\x1b[31mError: Cannot run '${action}' from state '${currentState}'.\x1b[0m`);
            return;
        }

        const workContext = getWorkContext();
        const envExports = Object.entries(workContext)
            .map(([key, value]) => `export ${key}='${value}';`)
            .join(' ');

        const command = `${envExports} ./scripts/${scriptName}\\n`;

        currentState = states[currentState].next;
        updateUI();

        // Send command based on connection type
        if (currentConnection === 'local' && localSocket) {
            localSocket.emit('input', command);
        } else if (currentConnection === 'ssh' && sshWs && sshWs.readyState === WebSocket.OPEN) {
            sshWs.send(JSON.stringify({
                type: 'input',
                data: command
            }));
        }
    }

    // --- Terminal Event Handlers ---
    term.onData((data) => {
        if (!isConnected) return;

        if (currentConnection === 'local' && localSocket) {
            localSocket.emit('input', data);
        } else if (currentConnection === 'ssh' && sshWs && sshWs.readyState === WebSocket.OPEN) {
            sshWs.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
    });

    // Handle terminal resize
    window.addEventListener('resize', () => {
        fitAddon.fit();
        if (currentConnection === 'ssh' && sshWs && sshWs.readyState === WebSocket.OPEN && isConnected) {
            sshWs.send(JSON.stringify({
                type: 'resize',
                rows: term.rows,
                cols: term.cols
            }));
        }
    });

    // --- Status Button Handler ---
    function handleStatusButtonClick() {
        if (connectionStatus === 'idle' || connectionStatus === 'error') {
            connect();
        } else if (connectionStatus === 'connected') {
            disconnect();
        }
        // Do nothing if connecting (prevent double-clicks)
    }

    // --- Button Event Listeners ---
    buttons.statusConnect.addEventListener('click', handleStatusButtonClick);
    buttons.merge.addEventListener('click', () => runAction('merge', 'merge.sh'));
    buttons.prep.addEventListener('click', () => runAction('prep', 'prep.sh'));
    buttons.build.addEventListener('click', () => runAction('build', 'build.sh'));
    buttons.restart.addEventListener('click', () => runAction('restart', 'restart.sh'));
    buttons.stop.addEventListener('click', () => runAction('stop', 'stop.sh'));

    // --- Initialize ---
    term.writeln('🚀 Tetra Dual-Mode Console');
    term.writeln('Select Local Shell or SSH Remote, then click "Connect Terminal"');
    updateUI();
    updateConnectionStatus();
});