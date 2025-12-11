console.log('SCRIPT LOADING...');
document.addEventListener('DOMContentLoaded', function () {
    console.log('DOM LOADED - SCRIPT RUNNING');

    // =================================================================
    // TERMINAL IFRAME SETUP
    // =================================================================
    const terminal = new TetraTerminal('terminal-iframe');

    // Connection state variables
    let currentConnection = null;
    let connectionMode = 'local';
    let isConnected = false;
    let connectionStatus = 'idle';

    // Terminal event handlers
    terminal.on('ready', () => {
        console.log('Terminal iframe ready');
        terminal.writeln('\r\n\x1b[36mTetra Console initialized\x1b[0m');
        terminal.writeln('\x1b[33mLocal Server: Direct shell on Tetra server | Remote SSH: Connect to external hosts\x1b[0m');
        terminal.writeln('\x1b[32mCurrent context: TKM (Tetra Key Manager)\x1b[0m\r\n');
    });

    terminal.on('connected', (data) => {
        console.log('Terminal connected:', data);
        currentConnection = data.mode;
        setConnectionStatus('connected');
    });

    terminal.on('disconnected', () => {
        console.log('Terminal disconnected');
        currentConnection = null;
        setConnectionStatus('idle');
    });

    terminal.on('error', (data) => {
        console.error('Terminal error:', data.message);
        setConnectionStatus('error');
    });

    terminal.on('output', (data) => {
        // Optional: log terminal output
    });

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
            terminal.writeln('\r\n\x1b[33mAlready connected\x1b[0m');
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
        terminal.writeln('\r\n\x1b[36mConnecting to local Tetra server shell...\x1b[0m');
        terminal.connectLocal();
    }

    function connectSSH() {
        const context = getSSHContext();
        const token = localStorage.getItem('ssh_token');
        const expires = localStorage.getItem('ssh_token_expires');
        const hasValidToken = token && expires && Date.now() < parseInt(expires);

        const hasKey = context.privateKey && context.privateKey !== '[Key loaded from token]';
        if (!context.host || !context.username || (!hasKey && !hasValidToken)) {
            terminal.writeln('\r\n\x1b[31mSSH host, username, and private key (or saved token) are required\x1b[0m');
            setConnectionStatus('error');
            return;
        }

        terminal.writeln('\r\n\x1b[36mConnecting to SSH...\x1b[0m');

        terminal.connectSSH({
            host: context.host,
            user: context.username,
            token: hasValidToken ? token : undefined
        });
    }

    function disconnect() {
        terminal.disconnect();
        currentConnection = null;
        setConnectionStatus('idle');
        terminal.writeln('\r\n\x1b[33mDisconnected\x1b[0m');
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

        // Resize terminal iframe when toggling
        if (panelType === 'terminal') {
            setTimeout(() => terminal.fit(), 300);
        }
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

        tetraContainer.classList.remove('layout-terminal-only', 'layout-one-panel', 'layout-two-panels');

        const visiblePanels = [connectionVisible, actionsVisible].filter(Boolean).length;

        if (!terminalVisible) {
            if (visiblePanels === 0) {
                tetraContainer.style.gridTemplateAreas = '"header header" "output output"';
            } else if (visiblePanels === 1) {
                tetraContainer.style.gridTemplateAreas = '"header header" "panel panel" "output output"';
                if (connectionVisible) contextPanel.style.gridArea = 'panel';
                if (actionsVisible) actionPanel.style.gridArea = 'panel';
            } else {
                tetraContainer.style.gridTemplateAreas = '"header header" "context actions" "output output"';
                contextPanel.style.gridArea = 'context';
                actionPanel.style.gridArea = 'actions';
            }
        } else {
            if (visiblePanels === 0) {
                tetraContainer.style.gridTemplateAreas = '"header header" "terminal terminal" "output output"';
            } else if (visiblePanels === 1) {
                tetraContainer.style.gridTemplateAreas = '"header header" "panel panel" "terminal terminal" "output output"';
                if (connectionVisible) contextPanel.style.gridArea = 'panel';
                if (actionsVisible) actionPanel.style.gridArea = 'panel';
            } else {
                tetraContainer.style.gridTemplateAreas = '"header header" "context actions" "terminal terminal" "output output"';
                contextPanel.style.gridArea = 'context';
                actionPanel.style.gridArea = 'actions';
            }
        }

        // Resize terminal iframe to fit new layout
        setTimeout(() => terminal.fit(), 300);
    }

    function setContext(context) {
        const previousContext = currentContext;
        currentContext = context;

        contextBadges.forEach(badge => {
            badge.classList.remove('active');
            if (badge.dataset.context === context) {
                badge.classList.add('active');
            }
        });

        const config = contextConfigs[context];
        if (config) {
            actionsTitle.textContent = config.title;
            const actionsInfo = document.getElementById('actions-info');
            if (actionsInfo) {
                actionsInfo.textContent = `${context} - ${config.fullName}: ${config.description}`;
            }
            updateActionButtons(config.actions);
        }

        if (previousContext !== context && previousContext !== undefined) {
            terminal.writeln(`\r\n\x1b[36mContext switched to ${context} (${config.fullName})\x1b[0m`);
            terminal.writeln(`\x1b[32m${config.description}\x1b[0m`);
        }

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

        if (isConnected) {
            const command = `echo "Executing ${action} for ${currentContext}..."`;
            terminal.execute(command);
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
                localStorage.setItem('ssh_token_expires', Date.now() + (30 * 60 * 1000));
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
    function getSSHContext() {
        const rawHost = document.getElementById('ssh-host').value.trim();
        let cleanHost = rawHost;

        cleanHost = cleanHost.replace(/^https?:\/\//, '');
        cleanHost = cleanHost.replace(/^ssh:\/\//, '');
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
                statusColor = '#c586c0';
                break;
            case 'connecting':
                statusText = 'Connecting...';
                statusColor = '#f1c21b';
                break;
            case 'connected':
                const connectionType = currentConnection === 'local' ? 'Server' : 'SSH';
                statusText = `Connected (${connectionType})`;
                statusColor = '#42be65';
                break;
            case 'error':
                statusText = 'Connection Error';
                statusColor = '#fa4d56';
                break;
        }

        stateDisplay.textContent = statusText;
        stateDisplay.style.color = statusColor;
    }

    function setConnectionStatus(status) {
        connectionStatus = status;
        updateConnectionStatus();

        isConnected = (status === 'connected');

        updateUI();

        const logType = status === 'connected' ? 'success' :
                       status === 'error' ? 'error' : 'info';
        addLogEntry(`Connection status: ${status}`, logType);
    }

    function updateUI() {
        if (buttons.statusConnect) {
            buttons.statusConnect.disabled = connectionStatus === 'connecting';
        }

        const workflowButtons = [buttons.merge, buttons.prep, buttons.build, buttons.restart, buttons.stop];

        if (!isConnected) {
            workflowButtons.forEach(btn => {
                if (btn) btn.disabled = true;
            });
            return;
        }

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
            terminal.writeln('\r\n\x1b[31mNot connected. Please connect first.\x1b[0m');
            return;
        }

        if (states[currentState]?.button !== `btn-${action}`) {
            terminal.writeln(`\r\n\x1b[31mError: Cannot run '${action}' from state '${currentState}'.\x1b[0m`);
            return;
        }

        const workContext = getWorkContext();
        const envExports = Object.entries(workContext)
            .map(([key, value]) => `export ${key}='${value}';`)
            .join(' ');

        const command = `${envExports} ./scripts/${scriptName}`;

        currentState = states[currentState].next;
        updateUI();

        terminal.execute(command);
    }

    // --- Status Button Handler ---
    function handleStatusButtonClick() {
        if (connectionStatus === 'idle' || connectionStatus === 'error') {
            connect();
        } else if (connectionStatus === 'connected') {
            disconnect();
        }
    }

    // --- Button Event Listeners ---
    buttons.statusConnect.addEventListener('click', handleStatusButtonClick);
    buttons.merge.addEventListener('click', () => runAction('merge', 'merge.sh'));
    buttons.prep.addEventListener('click', () => runAction('prep', 'prep.sh'));
    buttons.build.addEventListener('click', () => runAction('build', 'build.sh'));
    buttons.restart.addEventListener('click', () => runAction('restart', 'restart.sh'));
    buttons.stop.addEventListener('click', () => runAction('stop', 'stop.sh'));

    // --- Handle window resize ---
    window.addEventListener('resize', () => {
        terminal.fit();
    });

    // --- Initialize ---
    terminal.writeln('Tetra Dual-Mode Console');
    terminal.writeln('Select Local Shell or SSH Remote, then click "Connect Terminal"');
    updateUI();
    updateConnectionStatus();
});
