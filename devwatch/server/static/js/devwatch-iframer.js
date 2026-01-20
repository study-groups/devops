/**
 * PJA Iframer Component - Complete section factory and iframe manager.
 * Can create entire sections from config or enhance existing iframes.
 */
class DevWatchIframer {
    /**
     * Configuration defaults and validation
     * @private
     */
    static #DEFAULT_CONFIG = {
        buttons: ['reload', 'edit', 'info', 'cli', 'launch'],
        customButtons: [],
        autoReload: true,
        logMessages: false,
        collapsed: true,  // Changed from false to true
        sectionClass: 'section',
        iframeClass: 'iframe-container'
    };

    /**
     * Merge and validate configuration
     * @param {Object} config - User-provided configuration
     * @returns {Object} Validated configuration
     * @private
     */
    static #validateConfig(config) {
        return {
            ...DevWatchIframer.#DEFAULT_CONFIG,
            ...config,
            buttons: config.buttons || DevWatchIframer.#DEFAULT_CONFIG.buttons,
            customButtons: config.customButtons || DevWatchIframer.#DEFAULT_CONFIG.customButtons
        };
    }

    /**
     * Constructor for DevWatchIframer
     * @param {HTMLIFrameElement|Object} configOrIframe - Iframe element or configuration object
     * @param {Object} options - Additional options
     */
    constructor(configOrIframe, options = {}) {
        // Determine mode and initialize accordingly
        if (typeof configOrIframe === 'object' && !configOrIframe.tagName) {
            this.mode = 'factory';
            this.config = DevWatchIframer.#validateConfig(configOrIframe);
            this.element = null;
            this.iframe = null;
        } else {
            if (!configOrIframe) {
                throw new Error('DevWatchIframer requires a valid iframe element or config object.');
            }
            this.mode = 'enhance';
            this.iframe = configOrIframe;
        }

        // Unified options handling, now with global settings
        const globalSettings = window.DevWatchDashboard ? window.DevWatchDashboard.Settings.draftSettings : {};
        const mergedConfig = { ...globalSettings.iframerDefaults, ...configOrIframe };
        
        if (typeof mergedConfig === 'object' && !mergedConfig.tagName) {
            this.mode = 'factory';
            this.config = DevWatchIframer.#validateConfig(mergedConfig);
            this.element = null;
            this.iframe = null;
        } else {
            if (!configOrIframe) {
                throw new Error('DevWatchIframer requires a valid iframe element or config object.');
            }
            this.mode = 'enhance';
            this.iframe = configOrIframe;
        }

        // Unified options handling
        this.options = {
            logMessages: this.config?.logMessages || options.logMessages || false
        };

        // Shared state initialization
        this.state = {
            ready: false,
            assets: { css: [], js: [] }
        };
        this.messageHandlers = new Map();
        this.cliState = this.#createInitialCliState();
        this.cliInitialized = false;

        // Auto-initialize in enhance mode
        if (this.mode === 'enhance') {
            this.init();
        }
    }

    /**
     * Create initial CLI state
     * @returns {Object} Initial CLI state
     * @private
     */
    #createInitialCliState() {
        return {
            visible: false,
            messageCount: 0,
            history: [],
            historyIndex: -1
        };
    }

    /**
     * Initialize iframe functionality
     */
    init() {
        this.setupMessageListener();
        this.registerDefaultHandlers();
        
        if (this.mode === 'enhance') {
            this.setupReloadButton();
        }
    }

    /**
     * Generate HTML for factory mode
     * @returns {string} Generated HTML string
     */
    generateHTML() {
        if (this.mode !== 'factory') {
            throw new Error('generateHTML() is only available in factory mode');
        }
        
        return `
            <div class="${this.config.sectionClass}" id="${this.config.id}-section">
                <div class="section-header" onclick="window.pjaIframes['${this.config.id}'].toggle()">
                    <h2>${this.config.title}</h2>
                    <div class="header-actions">
                        ${this.#generateButtons()}
                    </div>
                </div>
                <div id="${this.config.id}-content" class="section-content ${this.config.collapsed ? 'collapsed' : ''}" style="display: ${this.config.collapsed ? 'none' : 'block'}">
                    ${this.#generateCLIPanel()}
                    ${this.#generateEditPanel()}
                    ${this.#generateInfoPanel()}
                    <div class="devwatch-iframer">
                        <iframe 
                            src="${this.config.src}" 
                            class="${this.config.iframeClass}"
                            id="${this.config.id}-iframe"
                            ${this.config.autoReload ? 'data-pja-auto="true"' : ''}
                            ${this.config.logMessages ? 'data-pja-log-messages="true"' : ''}>
                        </iframe>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate buttons for the iframe section
     * @returns {string} Generated button HTML
     * @private
     */
    #generateButtons() {
        const buttonTemplates = {
            'info': `<button class="btn-mini info-toggle-btn" onclick="event.stopPropagation(); window.pjaIframes['${this.config.id}'].toggleInfo()" title="Debug info" id="info-btn-${this.config.id}">Info</button>`,
            'reload': `<button class="btn-mini iframe-reload-btn" onclick="event.stopPropagation(); window.pjaIframes['${this.config.id}'].reload()" title="Reload iframe">Reload</button>`,
            'launch': `<a href="${this.config.src}" onclick="event.stopPropagation();" target="_blank" class="btn-mini btn-link" title="Open in new tab">Launch ↗</a>`,
            'cli': `<button class="btn-mini cli-toggle-btn" onclick="event.stopPropagation(); window.pjaIframes['${this.config.id}'].toggleCLI()" title="Open iframe CLI" id="cli-btn-${this.config.id}">CLI</button>`,
            'edit': `<button class="btn-mini edit-toggle-btn" onclick="event.stopPropagation(); window.pjaIframes['${this.config.id}'].toggleEdit()" title="Edit iframe source" id="edit-btn-${this.config.id}">Edit</button>`
        };
        
        const buttonHTML = this.config.buttons
            .filter(buttonType => buttonTemplates[buttonType])
            .map(buttonType => buttonTemplates[buttonType]);
        
        // Add custom buttons
        this.config.customButtons.forEach(button => {
            buttonHTML.push(`<button class="btn-mini" onclick="event.stopPropagation(); ${button.onclick}" title="${button.tooltip || ''}">${button.text}</button>`);
        });
        
        return buttonHTML.join('\n                        ');
    }

    /**
     * Generate CLI panel HTML
     * @returns {string} Generated CLI panel HTML
     * @private
     */
    #generateCLIPanel() {
        return `
            <div id="${this.config.id}-cli" class="pja-cli-panel" style="display: none;">
                <div class="cli-header">
                    <h4>Iframe CLI</h4>
                    <div class="cli-status">
                        <span id="${this.config.id}-cli-status" class="status-indicator">Ready</span>
                    </div>
                </div>
                <div class="cli-content">
                    <div class="cli-output" id="${this.config.id}-cli-output">
                        <div class="cli-welcome">
                            <p>🎮 PJA Iframe CLI - Send messages to iframe</p>
                            <p>Type 'help' for available commands</p>
                        </div>
                    </div>
                    <div class="cli-input-container">
                        <span class="cli-prompt">$</span>
                        <input type="text" id="${this.config.id}-cli-input" class="cli-input" placeholder="Enter command..." autocomplete="off">
                        <button id="${this.config.id}-cli-send" class="cli-send-btn">Send</button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate Edit panel HTML
     * @returns {string} Generated Edit panel HTML
     * @private
     */
    #generateEditPanel() {
        return `
            <div id="${this.config.id}-edit" class="pja-edit-panel" style="display: none;">
                <div class="edit-panel-content">
                    <div class="edit-panel-left">
                        <div class="app-selection">
                            <div class="app-category">
                                <h4>Developer Tools</h4>
                                <select id="${this.config.id}-dev-select" class="app-select" size="4">
                                    <option value="system">System</option>
                                    <option value="api-helper">API Helper</option>
                                    <option value="pcb">Playwright Command Builder</option>
                                    <option value="command-runner">Command Runner</option>
                                    <option value="cron">Cron</option>
                                    <option value="tsm">Test Suite Manager</option>
                                    <option value="testing-matrix">Testing Matrix Dashboard</option>
                                </select>
                            </div>
                            <div class="app-category">
                                <h4>Games</h4>
                                <select id="${this.config.id}-game-select" class="app-select" size="4">
                                    <option value="quadrapong">Quadrapong</option>
                                </select>
                            </div>
                        </div>
                        <div class="edit-actions" style="margin-top: var(--devwatch-space-md); display: flex; gap: var(--devwatch-space-sm);">
                            <button onclick="window.DevWatchPanelIconPicker.show(icon => window.pjaIframes['${this.config.id}'].updateIframeIcon(icon))" class="devwatch-button devwatch-button--ghost" title="Change Icon">Icon</button>
                            <button onclick="window.DevWatchIframerLongPress.showLongPressPopup('${this.config.id}', event.clientX, event.clientY)" class="devwatch-button devwatch-button--ghost">More...</button>
                            <button onclick="window.deleteDevWatchIframe('${this.config.id}')" class="devwatch-button devwatch-button--ghost" title="Delete Panel">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate Info panel HTML
     * @returns {string} Generated Info panel HTML
     * @private
     */
    #generateInfoPanel() {
        return `
            <div id="${this.config.id}-info" class="pja-info-panel" style="display: none;">
                <div class="info-panel-content">
                    <h4>Debug Information</h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <strong>ID:</strong> ${this.config.id}
                        </div>
                        <div class="info-item">
                            <strong>Source:</strong> ${this.config.src}
                        </div>
                        <div class="info-item">
                            <strong>Title:</strong> ${this.config.title}
                        </div>
                        <div class="info-item">
                            <strong>Category:</strong> ${this.config.category || 'Unknown'}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Render into DOM
    render(container) {
        if (this.mode !== 'factory') {
            throw new Error('render() is only available in factory mode');
        }
        
        const htmlString = this.generateHTML();
        
        if (typeof container === 'string') {
            container = document.getElementById(container);
        }
        
        container.insertAdjacentHTML('beforeend', htmlString);
        
        // Store references
        this.element = document.getElementById(`${this.config.id}-section`);
        this.iframe = document.getElementById(`${this.config.id}-iframe`);
        
        // Initialize iframe functionality
        this.init();
        
        // Use a timeout to ensure the element is in the DOM before attaching the handler
        /*
        setTimeout(() => {
            window.DevWatchIframerLongPress.setupLongPressHandler(this.config.id);
        }, 0);
        */
        
        return this;
    }
    
    // Section controls for factory mode
    toggle() {
        const content = document.getElementById(`${this.config.id}-content`);
        if (content) {
            const isCollapsed = content.classList.toggle('collapsed');
            content.style.display = isCollapsed ? 'none' : 'block';
        }
    }
    
    showInfo() {
        window.toggleIframeInfoOverlay(`${this.config.id}-iframe`);
    }
    
    reload() {
        this.reloadIframe();
    }
    
    // CLI functionality
    toggleCLI() {
        const cliPanel = document.getElementById(`${this.config.id}-cli`);
        const cliBtn = document.getElementById(`cli-btn-${this.config.id}`);
        
        if (!cliPanel) return;
        
        const isVisible = cliPanel.style.display !== 'none';
        
        if (isVisible) {
            cliPanel.style.display = 'none';
            if (cliBtn) cliBtn.classList.remove('active');
            this.cliState = { ...this.cliState, visible: false };
        } else {
            this.closeAllPanels();
            cliPanel.style.display = 'block';
            if (cliBtn) cliBtn.classList.add('active');
            this.cliState = { ...this.cliState, visible: true };
            this.initializeCLI();
            
            // Focus the input
            setTimeout(() => {
                const input = document.getElementById(`${this.config.id}-cli-input`);
                if (input) input.focus();
            }, 100);
        }
    }

    // Panel management - close all panels
    closeAllPanels() {
        const panels = ['cli', 'edit', 'info'];
        const buttons = ['cli-btn', 'edit-btn', 'info-btn'];
        
        panels.forEach((panelType, index) => {
            const panel = document.getElementById(`${this.config.id}-${panelType}`);
            const btn = document.getElementById(`${buttons[index]}-${this.config.id}`);
            
            if (panel) panel.style.display = 'none';
            if (btn) btn.classList.remove('active');
        });
    }

    // Info functionality
    showInfo() {
        this.closeAllPanels();
        const infoPanel = document.getElementById(`${this.config.id}-info`);
        const infoBtn = document.getElementById(`info-btn-${this.config.id}`);
        
        if (infoPanel && infoBtn) {
            infoPanel.style.display = 'block';
            infoBtn.classList.add('active');
        }
    }

    toggleInfo() {
        const infoPanel = document.getElementById(`${this.config.id}-info`);
        const infoBtn = document.getElementById(`info-btn-${this.config.id}`);
        
        if (!infoPanel) return;
        
        const isVisible = infoPanel.style.display !== 'none';
        
        if (isVisible) {
            infoPanel.style.display = 'none';
            if (infoBtn) infoBtn.classList.remove('active');
        } else {
            this.closeAllPanels();
            infoPanel.style.display = 'block';
            if (infoBtn) infoBtn.classList.add('active');
        }
    }

    // Edit functionality
    toggleEdit() {
        const editPanel = document.getElementById(`${this.config.id}-edit`);
        const editBtn = document.getElementById(`edit-btn-${this.config.id}`);
        
        if (!editPanel) return;
        
        const isVisible = editPanel.style.display !== 'none';
        
        if (isVisible) {
            editPanel.style.display = 'none';
            if (editBtn) editBtn.classList.remove('active');
        } else {
            this.closeAllPanels();
            editPanel.style.display = 'block';
            if (editBtn) editBtn.classList.add('active');
            this.setupEditListeners();
        }
    }

    setupEditListeners() {
        // Add click listeners to dev and game selects
        const devSelect = document.getElementById(`${this.config.id}-dev-select`);
        const gameSelect = document.getElementById(`${this.config.id}-game-select`);
        
        const appSources = {
            'system': '/static/system.iframe.html',
            'docs': '/static/docs.iframe.html',
            'api-helper': '/static/api-helper.iframe.html',
            'pcb': '/static/pcb.iframe.html',
            'command-runner': '/static/command-runner.iframe.html',
            'cron': '/static/cron.iframe.html',
            'tsm': '/static/tsm-standalone.html?iframe=true',
            'testing-matrix': '/static/testing-matrix.iframe.html',
            'quadrapong': '/static/games/quadrapong/index.html'
        };

        [devSelect, gameSelect].forEach(select => {
            if (select) {
                select.addEventListener('change', (e) => {
                    const appId = e.target.value;
                    if (appSources[appId]) {
                        this.changeIframeSrc(appSources[appId]);
                        // Keep edit panel open
                    }
                });
            }
        });
    }

    applyEdit() {
        const idInput = document.getElementById(`${this.config.id}-app-id`);
        const titleInput = document.getElementById(`${this.config.id}-app-title`);
        const iconInput = document.getElementById(`${this.config.id}-app-icon`);
        const srcInput = document.getElementById(`${this.config.id}-app-src`);
        
        const src = srcInput?.value?.trim();
        if (src) {
            this.changeIframeSrc(src);
            // Clear the form after applying
            if (srcInput) srcInput.value = '';
            if (idInput) idInput.value = '';
            if (titleInput) titleInput.value = '';
            if (iconInput) iconInput.value = '🌐';
        }
    }

    cancelEdit() {
        this.toggleEdit(); // Just close the panel
    }

    changeIframeSrc(newSrc) {
        const iframe = document.getElementById(`${this.config.id}-iframe`);
        if (iframe) {
            iframe.src = newSrc;
            console.log(`[DevWatchIframer] Changed ${this.config.id} src to: ${newSrc}`);
        }
    }
    
    updateIframeIcon(iconFile) {
        const iconUrl = `/static/icons/${iconFile}`;
        const header = document.querySelector(`#${this.config.id}-section .section-header h2`);
        if (header) {
            this.config.icon = `<img src="${iconUrl}" alt="icon" style="width: 1em; height: 1em; vertical-align: middle;">`;
            header.innerHTML = `${this.config.title}`;
        }
    }
    
    initializeCLI() {
        if (this.cliInitialized) return;
        
        const input = document.getElementById(`${this.config.id}-cli-input`);
        const sendBtn = document.getElementById(`${this.config.id}-cli-send`);
        const statusIndicator = document.getElementById(`${this.config.id}-cli-status`);
        
        // Update status based on iframe ready state
        this.updateCLIStatus();
        
        // Input handlers
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.sendCLICommand();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.navigateHistory(-1);
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.navigateHistory(1);
                } else if (e.key === 'Tab') {
                    e.preventDefault();
                    this.autoComplete();
                }
            });
        }
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendCLICommand());
        }
        
        // Log welcome message
        this.logCLI('system', '🚀 CLI initialized - iframe communication ready');
        
        this.cliInitialized = true;
    }
    
    sendCLICommand() {
        const input = document.getElementById(`${this.config.id}-cli-input`);
        if (!input) return;
        
        const command = input.value.trim();
        if (!command) return;
        
        // Add to history
        this.cliState.history.unshift(command);
        if (this.cliState.history.length > 50) {
            this.cliState.history = this.cliState.history.slice(0, 50);
        }
        this.cliState.historyIndex = -1;
        
        // Log the command
        this.logCLI('command', `$ ${command}`);
        
        // Parse and execute command
        this.executeCLICommand(command);
        
        // Clear input
        input.value = '';
    }
    
    executeCLICommand(command) {
        const parts = command.split(' ');
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        
        let messageType, data = {};
        
        switch (cmd) {
            case 'ping':
                messageType = 'ping';
                data = { timestamp: Date.now(), source: 'cli', args };
                break;
                
            case 'test':
                messageType = 'pja-host-test';
                data = { testMessage: 'CLI test message', timestamp: Date.now(), args };
                break;
                
            case 'theme':
                if (args[0]) {
                    messageType = 'devwatch-set-theme';
                    data = { theme: args[0] };
                } else {
                    this.logCLI('error', 'Usage: theme <theme-name>');
                    return;
                }
                break;
                
            case 'status':
                this.logCLI('info', `Iframe ready: ${this.state.ready ? '✅' : '❌'}`);
                this.logCLI('info', `Messages sent: ${this.cliState.messageCount}`);
                this.logCLI('info', `Handlers: ${this.messageHandlers.size}`);
                return;
                
            case 'clear':
                this.clearCLI();
                return;
                
            case 'help':
                this.showCLIHelp();
                return;
                
            default:
                // Treat as custom message type
                messageType = cmd;
                if (args.length > 0) {
                    try {
                        // Try to parse args as JSON if they look like JSON
                        const argsStr = args.join(' ');
                        if (argsStr.startsWith('{') || argsStr.startsWith('[')) {
                            data = JSON.parse(argsStr);
                        } else {
                            data = { args, raw: argsStr };
                        }
                    } catch (e) {
                        data = { args, raw: args.join(' ') };
                    }
                } else {
                    data = { timestamp: Date.now(), source: 'cli' };
                }
        }
        
        // Send the message
        if (messageType) {
            try {
                this.sendToIframe(messageType, data);
                this.cliState.messageCount++;
                this.updateCLICounter();
                this.logCLI('sent', `→ ${messageType}`, data);
            } catch (error) {
                this.logCLI('error', `Failed to send: ${error.message}`);
            }
        }
    }
    
    logCLI(type, message, data = null) {
        const log = document.getElementById(`${this.config.id}-cli-log`);
        if (!log) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `pja-cli-entry pja-cli-${type}`;
        
        let content = `<span class="pja-cli-time">[${timestamp}]</span> `;
        
        switch (type) {
            case 'command':
                content += `<span class="pja-cli-command">${message}</span>`;
                break;
            case 'sent':
                content += `<span class="pja-cli-sent">${message}</span>`;
                break;
            case 'received':
                content += `<span class="pja-cli-received">← ${message}</span>`;
                break;
            case 'error':
                content += `<span class="pja-cli-error">❌ ${message}</span>`;
                break;
            case 'info':
                content += `<span class="pja-cli-info">ℹ️ ${message}</span>`;
                break;
            case 'system':
                content += `<span class="pja-cli-system">${message}</span>`;
                break;
            default:
                content += message;
        }
        
        if (data && Object.keys(data).length > 0) {
            content += `<div class="pja-cli-data">${JSON.stringify(data, null, 2)}</div>`;
        }
        
        entry.innerHTML = content;
        
        // Remove welcome message if it exists
        const welcome = log.querySelector('.devwatch-cli-welcome');
        if (welcome) welcome.remove();
        
        log.appendChild(entry);
        log.scrollTop = log.scrollHeight;
    }
    
    clearCLI() {
        const log = document.getElementById(`${this.config.id}-cli-log`);
        if (log) {
            log.innerHTML = '<div class="pja-cli-welcome">CLI cleared - ready for new commands</div>';
        }
        this.cliState.messageCount = 0;
        this.updateCLICounter();
    }
    
    updateCLIStatus() {
        const status = document.getElementById(`${this.config.id}-cli-status`);
        if (status) {
            if (this.state.ready) {
                status.textContent = '●';
                status.style.color = '#00ff88';
                status.title = 'Iframe ready';
            } else {
                status.textContent = '●';
                status.style.color = '#ff4444';
                status.title = 'Iframe not ready';
            }
        }
    }
    
    updateCLICounter() {
        const counter = document.getElementById(`${this.config.id}-cli-counter`);
        if (counter) {
            counter.textContent = `${this.cliState.messageCount} msg`;
        }
    }
    
    navigateHistory(direction) {
        const input = document.getElementById(`${this.config.id}-cli-input`);
        if (!input || this.cliState.history.length === 0) return;
        
        if (direction === -1) { // Up arrow
            if (this.cliState.historyIndex < this.cliState.history.length - 1) {
                this.cliState.historyIndex++;
                input.value = this.cliState.history[this.cliState.historyIndex];
            }
        } else if (direction === 1) { // Down arrow
            if (this.cliState.historyIndex > 0) {
                this.cliState.historyIndex--;
                input.value = this.cliState.history[this.cliState.historyIndex];
            } else if (this.cliState.historyIndex === 0) {
                this.cliState.historyIndex = -1;
                input.value = '';
            }
        }
    }
    
    autoComplete() {
        const input = document.getElementById(`${this.config.id}-cli-input`);
        if (!input) return;
        
        const value = input.value.trim();
        const commands = ['ping', 'test', 'theme', 'status', 'clear', 'help'];
        
        const matches = commands.filter(cmd => cmd.startsWith(value.toLowerCase()));
        if (matches.length === 1) {
            input.value = matches[0] + ' ';
        } else if (matches.length > 1) {
            this.logCLI('info', `Available: ${matches.join(', ')}`);
        }
    }
    
    showCLIHelp() {
        const help = [
            'Available commands:',
            '  ping [args...]         - Send ping to iframe',
            '  test [args...]         - Send test message',
            '  theme <name>           - Change iframe theme',
            '  status                 - Show connection status',
            '  clear                  - Clear CLI log',
            '  help                   - Show this help',
            '  <custom-type> [data]   - Send custom message type',
            '',
            'Tips:',
            '  • Use ↑/↓ arrows for command history',
            '  • Use Tab for auto-completion',
            '  • JSON data: custom-msg {"key": "value"}',
        ];
        
        help.forEach(line => this.logCLI('info', line));
    }

    setupMessageListener() {
        window.addEventListener('message', (event) => {
            // Basic security: ensure the message is from our iframe
            if (event.source !== this.iframe.contentWindow) {
                return;
            }
            if (!event.data || event.data.source !== 'devwatch-iframe') {
                return;
            }
            this.handleMessage(event.data);
        });
    }

    handleMessage(data) {
        if (this.options.logMessages) {
            console.log(`[PJA Iframer] Received from ${this.iframe.id}:`, data);
        }

        // Log to CLI if it's open
        if (this.cliState && this.cliState.visible) {
            this.logCLI('received', data.type, data.data || {});
        }

        if (data.type === 'devwatch-iframe-ready') {
            this.state.ready = true;
            this.onReady();
            // Update CLI status if CLI is initialized
            if (this.cliInitialized) {
                this.updateCLIStatus();
            }
        }

        const handler = this.messageHandlers.get(data.type);
        if (handler) {
            handler(data);
        }
    }

    sendToIframe(type, data = {}) {
        if (!this.state.ready) {
            console.warn(`[PJA Iframer] Iframe not ready. Message "${type}" not sent.`);
            return;
        }
        this.iframe.contentWindow.postMessage({
            source: 'devwatch-host',
            type,
            data,
        }, '*');
    }
    
    on(messageType, handler) {
        this.messageHandlers.set(messageType, handler);
        return this; // Allow chaining
    }

    off(messageType) {
        this.messageHandlers.delete(messageType);
        return this; // Allow chaining
    }

    // Lifecycle hook, to be overridden by the user if needed
    onReady() {
        if (this.options.logMessages) {
             console.log(`[PJA Iframer] Iframe ${this.iframe.id} is ready.`);
        }
        // Send the initial theme to the iframe now that it's ready
        if (window.DevWatchThemeManager) {
            window.DevWatchThemeManager.propagateTheme(this.iframe);
        }
    }

    // Setup reload button in the iframe container
    setupReloadButton() {
        // Find or create header actions container
        const iframeContainer = this.iframe.closest('.devwatch-iframer') || this.iframe.parentElement;
        if (!iframeContainer) return;

        // Look for existing header actions in the container
        let actionsContainer = iframeContainer.querySelector('.iframe-actions');
        
        if (!actionsContainer) {
            // Find the section header that contains this iframe
            const section = this.iframe.closest('.section-content');
            if (section) {
                const sectionHeader = section.previousElementSibling;
                if (sectionHeader && sectionHeader.classList.contains('section-header')) {
                    const headerActions = sectionHeader.querySelector('.header-actions');
                    if (headerActions) {
                        // Add reload button to existing header actions
                        this.addReloadButtonToActions(headerActions);
                        return;
                    }
                }
            }
        }

        // If no header actions found, create floating reload button
        this.createFloatingReloadButton(iframeContainer);
    }

    addReloadButtonToActions(actionsContainer) {
        // Check if reload button already exists
        if (actionsContainer.querySelector('.iframe-reload-btn')) return;

        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'btn-mini iframe-reload-btn';
        reloadBtn.innerHTML = 'Reload';
        reloadBtn.title = 'Reload iframe content';
        reloadBtn.style.order = '-1'; // Put it before other buttons
        
        reloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.reloadIframe();
        });

        // Insert as first button
        actionsContainer.insertBefore(reloadBtn, actionsContainer.firstChild);
    }

    createFloatingReloadButton(container) {
        // Check if reload button already exists
        if (container.querySelector('.iframe-reload-btn')) return;

        const reloadBtn = document.createElement('button');
        reloadBtn.className = 'iframe-reload-btn iframe-reload-floating';
        reloadBtn.innerHTML = '↻';
        reloadBtn.title = 'Reload iframe content';
        
        reloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.reloadIframe();
        });

        container.style.position = 'relative';
        container.appendChild(reloadBtn);
    }

    // Reload the iframe by resetting its src
    reloadIframe() {
        if (this.options.logMessages) {
            console.log(`[PJA Iframer] Reloading iframe ${this.iframe.id}`);
        }

        // Store current src and parse URL
        const currentSrc = this.iframe.src;
        const url = new URL(currentSrc);
        
        // Remove any existing _reload parameters
        url.searchParams.delete('_reload');
        
        // Add new timestamp
        url.searchParams.set('_reload', Date.now());
        
        // Reset state
        this.state.ready = false;
        
        // Reload iframe with cleaned URL
        this.iframe.src = url.toString();
        
        // Show loading state
        this.showReloadingState();
    }

    showReloadingState() {
        const reloadBtn = document.querySelector(`.iframe-reload-btn[data-iframe="${this.iframe.id}"]`) || 
                         document.querySelector('.iframe-reload-btn');
        
        if (reloadBtn) {
            const originalText = reloadBtn.innerHTML;
            reloadBtn.innerHTML = reloadBtn.classList.contains('iframe-reload-floating') ? '⟳' : 'Loading...';
            reloadBtn.disabled = true;
            
            // Reset after 2 seconds or when iframe is ready
            const resetButton = () => {
                reloadBtn.innerHTML = originalText;
                reloadBtn.disabled = false;
            };
            
            setTimeout(resetButton, 2000);
            
            // Also reset when iframe is ready
            const originalOnReady = this.onReady;
            this.onReady = () => {
                originalOnReady.call(this);
                resetButton();
                this.onReady = originalOnReady;
            };
        }
    }

    registerDefaultHandlers() {
        // Update host iframe title when iframe sends a title update
        this.on('devwatch-title-update', ({ title }) => {
            if (typeof title === 'string' && title.trim().length > 0) {
                this.iframe.title = title.trim();
                if (this.options.logMessages) {
                    console.log(`[PJA Iframer] (${this.iframe.id}) title ->`, title.trim());
                }
            }
        });

        // Receive scrollbar styles (from iframe) – store on dataset for themes/tooling
        // Note: True scrollbar styling cannot be applied to <iframe> from parent.
        this.on('devwatch-scrollbar-styles', ({ styles }) => {
            try {
                this.iframe.dataset.pjaScrollbarStyles = JSON.stringify(styles || {});
                if (this.options.logMessages) {
                    console.log(`[PJA Iframer] (${this.iframe.id}) scrollbar styles received`);
                }
            } catch {}
        });

        this.on('pja-asset-list', ({ css, js, error }) => {
            if (error) {
                this.state.assets = { css: ['Error fetching'], js: ['Error fetching'] };
            } else {
                this.state.assets = { css: css || [], js: js || [] };
            }
            if (this.options.logMessages) {
                console.log(`[PJA Iframer] (${this.iframe.id}) asset list received`, this.state.assets);
            }
        });

        // Bubble any custom messages for application consumers
        this.on('pja-custom-activity-update', (payload) => {
            const event = new CustomEvent('pja-custom-activity-update', { detail: { iframeId: this.iframe.id, payload } });
            window.dispatchEvent(event);
        });

        // Handle theme updates from iframes (especially system control panel)
        this.on('devwatch-theme-update', ({ theme }) => {
            if (window.DevWatchThemeManager && typeof theme === 'string') {
                window.DevWatchThemeManager.setTheme(theme);
                if (this.options.logMessages) {
                    console.log(`[PJA Iframer] (${this.iframe.id}) theme updated to: ${theme}`);
                }
            }
        });

        // Handle ping messages from iframes
        this.on('ping', (data) => {
            if (this.options.logMessages) {
                console.log(`[PJA Iframer] (${this.iframe.id}) received ping:`, data);
            }
            // Send pong response
            this.sendToIframe('pong', { 
                ...data, 
                response: 'pong', 
                timestamp: Date.now(),
                hostReceived: data.timestamp || Date.now()
            });
        });

        // Handle custom test messages
        this.on('pja-custom-test', (data) => {
            if (this.options.logMessages) {
                console.log(`[PJA Iframer] (${this.iframe.id}) custom test message:`, data);
            }
            // Echo back with host info
            this.sendToIframe('pja-custom-test-response', {
                originalData: data,
                hostResponse: 'Message received by host',
                timestamp: Date.now()
            });
        });
    }
}

// Auto-initialize for iframes with data-pja-auto attribute
document.addEventListener('DOMContentLoaded', () => {
    // Expose the class to the window for manual instantiation
    window.DevWatchIframer = DevWatchIframer;
    
    window.pjaIframes = {};

    const autoIframes = document.querySelectorAll('iframe[data-pja-auto]');
    autoIframes.forEach(iframe => {
        const options = {
            logMessages: iframe.dataset.pjaLogMessages === 'true',
        };
        if (iframe.id) {
            window.pjaIframes[iframe.id] = new DevWatchIframer(iframe, options);
        } else {
            console.warn('PJA Iframer: An iframe with data-pja-auto is missing an ID. It will not be globally accessible.');
            new DevWatchIframer(iframe, options);
        }
    });
});

// --- Host-side Iframe Info Overlay ---
// Creates or toggles an overlay over a specific iframe to display
// iframe-specific details and system environment info.
window.toggleIframeInfoOverlay = async function toggleIframeInfoOverlay(iframeId) {
    const iframe = document.getElementById(iframeId);
    if (!iframe) return;

    // Ensure container exists
    const parent = iframe.parentElement || document.body;
    let overlay = parent.querySelector(`.iframe-info-overlay[data-target="${iframeId}"]`);

    // Load environment if not cached
    if (!window.APP) window.APP = {};
    if (!window.APP.env) {
        try {
            const res = await fetch('/api/environment');
            window.APP.env = await res.json();
        } catch (e) {
            window.APP.env = {};
        }
    }

    const renderKvGrid = (items) => {
        const gridItems = Object.entries(items).map(([key, value]) => {
            const [val, ...classes] = Array.isArray(value) ? value : [value];
            return `<div class="kv"><span class="k">${key}</span><span class="v ${classes.join(' ')}">${val}</span></div>`;
        }).join('');
        return `<div class="kv-grid">${gridItems}</div>`;
    };

    const renderFileList = (files, title) => {
        if (!files || files.length === 0) {
            return `<div class="file-list-empty">No ${title} files found.</div>`;
        }
        
        // Split files into two columns
        const mid = Math.ceil(files.length / 2);
        const col1 = files.slice(0, mid);
        const col2 = files.slice(mid);
        
        return `
            <div class="file-list-grid">
                <ul class="file-list">
                    ${col1.map(file => `<li><span class="file-icon">📄</span>${file}</li>`).join('')}
                </ul>
                <ul class="file-list">
                    ${col2.map(file => `<li><span class="file-icon">📄</span>${file}</li>`).join('')}
                </ul>
            </div>`;
    };

    const buildContentHtml = () => {
        const env = window.APP.env || {};
        const ifr = window.pjaIframes ? window.pjaIframes[iframeId] : null;
        
        // Try to get assets from iframe state, or fallback to checking iframe window directly
        let assets = ifr ? ifr.state.assets : { css: [], js: [] };
        let ready = !!(ifr && ifr.state && ifr.state.ready);
        
        // If no assets and iframe is accessible, try to get them directly
        if ((!assets.css || assets.css.length === 0) && (!assets.js || assets.js.length === 0)) {
            try {
                const iframeWindow = iframe.contentWindow;
                if (iframeWindow && iframeWindow.DevWatchAssets) {
                    assets = {
                        css: iframeWindow.DevWatchAssets.css || [],
                        js: iframeWindow.DevWatchAssets.js || []
                    };
                    // If we got assets from standalone mode, consider it "ready"
                    if (iframeWindow.DevWatchAssets.isStandalone) {
                        ready = true;
                    }
                }
            } catch (e) {
                // Cross-origin or other access issues - keep defaults
            }
        }
        
        const size = `${iframe.clientWidth} × ${iframe.clientHeight}`;

        // Collect host CSS/JS files
        const hostCssFiles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(link => link.href.split('/').pop());
        const hostJsFiles = Array.from(document.querySelectorAll('script[src]')).map(script => script.src.split('/').pop());
        
        const iframeSrc = iframe.getAttribute('src') || '';
        const srcFile = iframeSrc.split('/').pop() || iframeSrc;

        // --- PJA Apps Categorization and Rendering ---
        const pjaApps = window.DevWatchDashboard.Apps.draftApps; // Use draftApps
        const devApps = pjaApps.filter(app => app.category === 'dev');
        const gameApps = pjaApps.filter(app => app.category === 'games');

        const renderAppList = (apps, categoryTitle) => {
            if (apps.length === 0) return '';
            return `
                <h5 class="app-category-title">${categoryTitle}</h5>
                <div class="pja-apps-list">
                    ${apps.map(app => `
                        <div class="pja-app-item" data-app-id="${app.id}">
                            <span class="app-icon">${app.icon}</span>
                            <span class="app-title">${app.title}</span>
                            <button class="app-select-btn" onclick="window.changeIframeSource('${iframeId}', '${app.id}')">Select</button>
                        </div>
                    `).join('')}
                </div>
            `;
        };

        const pjaAppsHtml = `
            <div class="devwatch-card info-section">
                <h4><span class="icon">🚀</span> PJA Apps</h4>
                ${renderAppList(devApps, 'Developer Tools')}
                ${renderAppList(gameApps, 'Games')}
                <div class="pja-app-add">
                    <button id="add-new-app-btn" onclick="window.promptForNewApp(() => { window.toggleIframeInfoOverlay('${iframeId}'); window.toggleIframeInfoOverlay('${iframeId}'); })">+ Add New App</button>
                </div>
            </div>
        `;
        // --- End of PJA Apps Section ---

        return `
            <div class="devwatch-card overlay-panel pja-info-panel">
                <div class="overlay-header">
                    <h3 class="overlay-title">
                        <span class="icon">🔍</span>
                        Iframe Debug Info
                    </h3>
                    <button class="ghost-btn overlay-close" aria-label="Close" title="Close">✕</button>
                </div>
                <div class="overlay-content">
                    
                    <div class="devwatch-card info-section">
                        <h4><span class="icon">🖥️</span> Server Environment</h4>
                        ${renderKvGrid({
                            'Node.js': env.SERVER_INFO || 'N/A',
                            'Environment': env.NODE_ENV || 'development',
                            'PW_DIR': env.PW_DIR || 'N/A',
                            'PD_DIR': env.PD_DIR || 'N/A',
                            'PW_SRC': [env.PW_SRC || 'N/A', 'break-all']
                        })}
                    </div>

                    ${pjaAppsHtml}

                    <div class="devwatch-card info-section">
                        <h4><span class="icon">🏠</span> Host (devwatch-iframer)</h4>
                        ${renderKvGrid({
                            'Container ID': iframeId,
                            'Host URL': window.location.pathname,
                            'Msg Handlers': `${ifr ? ifr.messageHandlers.size : 0} registered`,
                            'Auto-enabled': iframe.dataset.pjaAuto === 'true' ? '✅' : '❌',
                            'Log Messages': iframe.dataset.pjaLogMessages === 'true' ? '✅' : '❌'
                        })}
                        <h5>Host CSS Files</h5>
                        ${renderFileList(hostCssFiles, 'CSS')}
                        <h5>Host JS Files</h5>
                        ${renderFileList(hostJsFiles, 'JS')}
                    </div>

                    <div class="devwatch-card info-section">
                        <h4><span class="icon">🎯</span> Client (devwatch-iframe)</h4>
                        ${renderKvGrid({
                            'Iframe Src': srcFile,
                            'Full Path': [iframeSrc, 'break-all'],
                            'Size (w×h)': size,
                            'Ready State': [ready ? '✅ Ready' : '❌ Not Ready', ready ? 'pja-success' : 'pja-error'],
                            'Title': iframe.title || ifr?.state?.title || 'N/A'
                        })}
                        <h5>Client CSS Files</h5>
                        ${renderFileList(assets.css, 'CSS')}
                        <h5>Client JS Files</h5>
                        ${renderFileList(assets.js, 'JS')}
                    </div>
                    
                    <div class="devwatch-card info-section">
                        <h4><span class="icon">💬</span> Message Testing</h4>
                        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem;">
                            <button id="ping-iframe-btn-${iframeId}" class="ghost-btn" style="flex: 1;">Ping Iframe</button>
                            <button id="test-message-btn-${iframeId}" class="ghost-btn" style="flex: 1;">Test Message</button>
                        </div>
                        <div style="margin-bottom: 0.75rem;">
                            <label style="display: block; font-size: 10px; color: var(--devwatch-text-muted); margin-bottom: 0.25rem;">Custom Message:</label>
                            <div style="display: flex; gap: 0.25rem;">
                                <input id="custom-msg-type-${iframeId}" placeholder="message-type" style="flex: 1; font-size: 11px; padding: 4px; border: 1px solid var(--devwatch-border-primary); background: var(--devwatch-input-bg); color: var(--devwatch-text-primary);">
                                <button id="send-custom-btn-${iframeId}" class="ghost-btn" style="padding: 4px 8px;">Send</button>
                            </div>
                        </div>
                        <div id="message-log-${iframeId}" style="max-height: 150px; overflow-y: auto; background: var(--devwatch-bg-primary); border: 1px solid var(--devwatch-border-primary); padding: 0.5rem; border-radius: 4px; font-family: monospace; font-size: 10px;">
                            <div style="color: var(--devwatch-text-muted); font-style: italic;">Click a button to test messaging...</div>
                        </div>
                    </div>
                    
                </div>
            </div>`;
    };

    // Inject required styles if not already present
    if (!document.getElementById('pja-info-overlay-styles')) {
        const styles = document.createElement('style');
        styles.id = 'pja-info-overlay-styles';
        styles.textContent = `
            .file-list-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: var(--devwatch-space-md, 0.75rem);
                margin-top: var(--devwatch-space-sm, 0.5rem);
            }
            .file-list {
                margin: 0;
                padding: 0;
                list-style: none;
                font-size: 0.85em;
            }
            .file-list li {
                display: flex;
                align-items: center;
                padding: 0.25rem 0;
                color: var(--devwatch-text-secondary, #888);
            }
            .file-list .file-icon {
                margin-right: 0.5rem;
                opacity: 0.7;
            }
            .file-list-empty {
                color: var(--devwatch-text-muted, #666);
                font-style: italic;
                font-size: 0.85em;
                padding: 0.5rem 0;
            }
            
            /* PJA Apps Styles */
            .devwatch-apps-list {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
                max-height: 300px;
                overflow-y: auto;
            }
            .devwatch-app-item {
                display: flex;
                align-items: center;
                padding: 0.5rem;
                background-color: var(--devwatch-bg-secondary, #f4f4f4);
                border-radius: 4px;
                transition: background-color 0.2s;
            }
            .devwatch-app-item:hover {
                background-color: var(--devwatch-bg-hover, #e0e0e0);
            }
            .devwatch-app-item .app-icon {
                margin-right: 0.5rem;
                font-size: 1.2em;
            }
            .devwatch-app-item .app-title {
                flex-grow: 1;
                font-size: 0.9em;
            }
            .devwatch-app-item .app-select-btn {
                background-color: var(--devwatch-primary, #007bff);
                color: white;
                border: none;
                padding: 0.25rem 0.5rem;
                border-radius: 3px;
                font-size: 0.8em;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .devwatch-app-item .app-select-btn:hover {
                background-color: var(--devwatch-primary-dark, #0056b3);
            }
            .devwatch-app-add {
                grid-column: span 2;
                text-align: center;
                margin-top: 0.5rem;
            }
            .devwatch-app-add button {
                background-color: var(--devwatch-success, #28a745);
                color: white;
                border: none;
                padding: 0.5rem;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .devwatch-app-add button:hover {
                background-color: var(--devwatch-success-dark, #218838);
            }
        `;
        document.head.appendChild(styles);
    }

    // Create overlay if needed
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'iframe-info-overlay';
        overlay.dataset.target = iframeId;
        overlay.innerHTML = buildContentHtml();
        parent.appendChild(overlay);

        // Close handlers
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('visible');
        });
        overlay.querySelector('.overlay-close')?.addEventListener('click', () => overlay.classList.remove('visible'));
        
        // Setup message testing functionality
        setupMessageTesting();
    } else {
        // Refresh content on every open
        overlay.innerHTML = buildContentHtml();
        overlay.querySelector('.overlay-close')?.addEventListener('click', () => overlay.classList.remove('visible'));
        
        // Setup message testing functionality
        setupMessageTesting();
    }

    // Position overlay to cover the iframe
    const parentRect = parent.getBoundingClientRect();
    const iframeRect = iframe.getBoundingClientRect();
    overlay.style.position = 'absolute';
    overlay.style.top = `${iframe.offsetTop}px`;
    overlay.style.left = `${iframe.offsetLeft}px`;
    overlay.style.width = `${iframe.clientWidth}px`;
    overlay.style.height = `${iframe.clientHeight}px`;

    overlay.classList.toggle('visible');
    
    // Local function to setup message testing for this overlay
    function setupMessageTesting() {
        const messageLog = overlay.querySelector(`#message-log-${iframeId}`);
        const pingBtn = overlay.querySelector(`#ping-iframe-btn-${iframeId}`);
        const testBtn = overlay.querySelector(`#test-message-btn-${iframeId}`);
        const customInput = overlay.querySelector(`#custom-msg-type-${iframeId}`);
        const sendCustomBtn = overlay.querySelector(`#send-custom-btn-${iframeId}`);
        
        // Get the iframer instance
        const iframer = window.pjaIframes ? window.pjaIframes[iframeId] : null;
        
        // Message log functionality
        function logMessage(direction, type, data, success = true) {
            if (!messageLog) return;
            
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.style.marginBottom = '0.25rem';
            logEntry.style.color = success ? 'var(--devwatch-text-primary)' : 'var(--devwatch-error)';
            
            const arrow = direction === 'out' ? '→' : '←';
            const prefix = direction === 'out' ? 'HOST→IFRAME' : 'IFRAME→HOST';
            logEntry.innerHTML = `<span style="color: var(--devwatch-text-muted)">[${timestamp}]</span> ${arrow} ${prefix}: <strong>${type}</strong>`;
            
            if (data && Object.keys(data).length > 0) {
                const dataStr = JSON.stringify(data);
                if (dataStr.length > 100) {
                    logEntry.innerHTML += `<br><span style="color: var(--devwatch-text-secondary); margin-left: 1rem;">${dataStr.substring(0, 100)}...</span>`;
                } else {
                    logEntry.innerHTML += `<br><span style="color: var(--devwatch-text-secondary); margin-left: 1rem;">${dataStr}</span>`;
                }
            }
            
            // Remove placeholder if it exists
            const placeholder = messageLog.querySelector('[style*="font-style: italic"]');
            if (placeholder) {
                placeholder.remove();
            }
            
            messageLog.appendChild(logEntry);
            messageLog.scrollTop = messageLog.scrollHeight;
        }
        
        // Ping button
        if (pingBtn && iframer) {
            pingBtn.addEventListener('click', () => {
                const data = { timestamp: Date.now(), source: 'host-debug-panel' };
                iframer.sendToIframe('ping', data);
                logMessage('out', 'ping', data);
            });
        }
        
        // Test message button
        if (testBtn && iframer) {
            testBtn.addEventListener('click', () => {
                const data = { testMessage: 'Hello from host!', timestamp: Date.now() };
                iframer.sendToIframe('pja-host-test', data);
                logMessage('out', 'pja-host-test', data);
            });
        }
        
        // Custom message sender
        if (sendCustomBtn && customInput && iframer) {
            const sendCustomMessage = () => {
                const messageType = customInput.value.trim();
                if (!messageType) return;
                
                const data = { customMessage: true, timestamp: Date.now() };
                iframer.sendToIframe(messageType, data);
                logMessage('out', messageType, data);
                customInput.value = '';
            };
            
            sendCustomBtn.addEventListener('click', sendCustomMessage);
            customInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendCustomMessage();
            });
        }
        
        // Listen for messages from iframe to log them
        if (iframer) {
            // Create a temporary handler to capture all messages for this session
            const originalHandleMessage = iframer.handleMessage.bind(iframer);
            iframer.handleMessage = function(data) {
                // Log the message
                logMessage('in', data.type, data.data || {});
                
                // Call original handler
                originalHandleMessage(data);
            };
        }
        
        // Initial status message
        if (iframer && iframer.state.ready) {
            logMessage('out', 'STATUS', { status: 'Iframe is ready for messaging' }, true);
        } else {
            logMessage('out', 'STATUS', { status: 'Iframe not ready - messages may not be received' }, false);
        }
    }
}

// Global function to reload a specific iframe
window.reloadIframe = function(iframeId) {
    const iframe = document.getElementById(iframeId);
    if (!iframe) {
        console.warn(`[PJA Iframer] Iframe with ID "${iframeId}" not found`);
        return;
    }
    
    const iframer = window.pjaIframes && window.pjaIframes[iframeId];
    if (iframer) {
        iframer.reloadIframe();
    } else {
        // Fallback reload method
        const currentSrc = iframe.src;
        const separator = currentSrc.includes('?') ? '&' : '?';
        iframe.src = `${currentSrc}${separator}_reload=${Date.now()}`;
        console.log(`[PJA Iframer] Reloaded iframe ${iframeId} (fallback method)`);
    }
}

// Global function to reload all iframes
window.reloadAllIframes = function() {
    if (window.pjaIframes) {
        Object.keys(window.pjaIframes).forEach(iframeId => {
            window.pjaIframes[iframeId].reloadIframe();
        });
        console.log(`[PJA Iframer] Reloaded ${Object.keys(window.pjaIframes).length} iframes`);
    } else {
        console.warn('[PJA Iframer] No PJA iframes found to reload');
    }
}

// --- Minimal Theme Manager for Host -> Iframe propagation ---
window.DevWatchThemeManager = {
    getTheme: () => document.documentElement.getAttribute('data-theme') || 'matrix',

    propagateTheme: (iframe) => {
        const iframer = window.pjaIframes[iframe.id];
        if (iframer && iframer.state.ready) {
            iframer.sendToIframe('devwatch-set-theme', { theme: DevWatchThemeManager.getTheme() });
        }
    },

    propagateThemeToAll: () => {
        if (window.pjaIframes) {
            Object.values(window.pjaIframes).forEach(iframer => DevWatchThemeManager.propagateTheme(iframer.iframe));
        }
    },

    observe: () => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    // Theme propagation is handled by the main DevWatchThemeManager
                    // No additional action needed here
                }
            });
        });
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
};

document.addEventListener('DOMContentLoaded', () => window.DevWatchThemeManager.observe());

// Global PJA Apps Management
window.DevWatchAppsManager = {
    _committedApps: [], // The true state saved to localStorage
    draftApps: [],      // The working copy for UI changes

    addApp(app) {
        // Modify the draft state
        const existingIndex = this.draftApps.findIndex(existing => existing.id === app.id);
        if (existingIndex !== -1) {
            this.draftApps[existingIndex] = app;
        } else {
            this.draftApps.push(app);
        }
    },

    removeApp(appId) {
        // Modify the draft state
        const index = this.draftApps.findIndex(app => app.id === appId);
        if (index !== -1) {
            this.draftApps.splice(index, 1);
        }
    },

    saveApps() {
        // Commit the draft state to localStorage and the committed state
        this._committedApps = JSON.parse(JSON.stringify(this.draftApps));
        localStorage.setItem('pja-apps', JSON.stringify(this._committedApps));
        console.log('[DevWatchAppsManager] App configuration saved.');
        // Optionally, add a user notification here
    },

    revertApps() {
        // Discard changes by reverting the draft state from the committed state
        this.draftApps = JSON.parse(JSON.stringify(this._committedApps));
        console.log('[DevWatchAppsManager] App changes reverted.');
    },

    init() {
        // Default apps if nothing is in storage
        const defaultApps = [
            { 
                id: 'system', 
                title: 'System', 
                icon: '📁', 
                src: '/static/system.iframe.html',
                category: 'dev'
            },
            { 
                id: 'api-helper', 
                title: 'API Helper', 
                icon: '🔌', 
                src: '/static/api-helper.iframe.html',
                category: 'dev'
            },
            { 
                id: 'pcb', 
                title: 'Playwright Command Builder', 
                icon: '⚡', 
                src: '/static/pcb.iframe.html',
                category: 'dev'
            },
            { 
                id: 'command-runner', 
                title: 'Command Runner', 
                icon: '🎮', 
                src: '/static/command-runner.iframe.html',
                category: 'dev'
            },
            { 
                id: 'cron', 
                title: 'Cron', 
                icon: '⏰', 
                src: '/static/cron.iframe.html',
                category: 'dev' 
            },
            { 
                id: 'tsm', 
                title: 'Test Suite Manager', 
                icon: '🧪', 
                src: '/static/tsm-standalone.html?iframe=true',
                category: 'dev'
            },
            { 
                id: 'testing-matrix', 
                title: 'Testing Matrix Dashboard', 
                icon: '🧩', 
                src: '/static/testing-matrix.iframe.html',
                category: 'dev'
            }
        ];

        // Load from localStorage on first initialization
        const storedApps = localStorage.getItem('pja-apps');
        if (storedApps) {
            try {
                this._committedApps = JSON.parse(storedApps);
            } catch (e) {
                console.error('Failed to parse stored PJA Apps', e);
                this._committedApps = defaultApps;
            }
        } else {
            this._committedApps = defaultApps;
        }
        localStorage.setItem('pja-apps', JSON.stringify(this._committedApps)); // Ensure it's always set
        this.revertApps();
    }
};

// Initialize on load
window.DevWatchAppsManager.init();

/**
 * Changes the source of an iframe and updates its title, icon, and configuration.
 * @param {string} iframeId - The ID of the iframe to change.
 * @param {string} appId - The ID of the app to load from DevWatchDashboard.Apps.
 */
window.changeIframeSource = function(iframeId, appId) {
    if (window.DevWatchDashboard) {
        const appConfig = window.DevWatchDashboard.Apps.draftApps.find(app => app.id === appId);
        if (appConfig) {
            DevWatchDashboard.Manager.updateIframe(iframeId, appConfig);
        } else {
            console.error(`[PJA] Could not find app with ID: ${appId}`);
        }
    }
};

// This function is now deprecated and will be removed. Use changeIframeSource instead.
window.toggleIframeSource = function(iframeId, newSrc) {
    console.warn('toggleIframeSource is deprecated. Use changeIframeSource instead.');
    const app = window.DevWatchDashboard.Apps.draftApps.find(app => app.src === newSrc);
    if (app) {
        window.changeIframeSource(iframeId, app.id);
    } else {
        console.error(`Could not find an app with source: ${newSrc}`);
    }
};

window.addNewDevWatchApp = function(iframeId) {
    // This function is now deprecated in favor of promptForNewApp.
    // It is kept for backward compatibility but should be updated.
    promptForNewApp(() => {
        // Re-toggle the info overlay to refresh its content
        window.toggleIframeInfoOverlay(iframeId);
        window.toggleIframeInfoOverlay(iframeId);
    });
};

/**
 * Prompts the user for new app details and adds it to the DevWatchAppsManager.
 * @param {function} callback - A function to call after the app has been successfully added.
 */
window.promptForNewApp = function(callback) {
    const newAppDetails = {
        id: prompt('Enter a unique ID for the app (e.g., cheap-golf):'),
        title: prompt('Enter the app title (e.g., Cheap Golf):'),
        icon: prompt('Enter an emoji icon for the app:', '🌐'),
        src: prompt('Enter the full URL/path for the app:'),
        category: prompt('Enter a category (dev or games):', 'games')
    };
    
    if (!newAppDetails.id || !newAppDetails.title || !newAppDetails.src || !newAppDetails.category) {
        alert('A unique ID, title, URL, and category are required. Please try again.');
        return;
    }
    
    // Add to PJA Apps Manager
    window.DevWatchAppsManager.addApp(newAppDetails);
    
    // Execute the callback to refresh the UI
    if (typeof callback === 'function') {
        callback();
    }
};

// Long-press popup management
window.DevWatchIframerLongPress = {
    longPressTimer: null,
    longPressDuration: 500, // 500ms long press
    
    setupLongPressHandler(iframeId) {
        const header = document.querySelector(`#${iframeId}-section .section-header`);
        if (!header) return;
        
        // Track touch/mouse events for long press
        let startX, startY;
        
        const startLongPress = (e) => {
            // Stop the event from bubbling up to the main dashboard header immediately
            e.stopPropagation();

            // Prevent default to stop text selection, etc.
            e.preventDefault();
            
            // Store initial touch/click coordinates
            startX = e.clientX || (e.touches && e.touches[0].clientX);
            startY = e.clientY || (e.touches && e.touches[0].clientY);
            
            // Clear any existing timer
            this.cancelLongPress();
            
            // Set new timer
            this.longPressTimer = setTimeout(() => {
                this.showLongPressPopup(iframeId, startX, startY);
            }, this.longPressDuration);
        };
        
        const cancelLongPress = (e) => {
            this.cancelLongPress();
        };
        
        const checkMovement = (e) => {
            // If touch/mouse moves too far, cancel long press
            const currentX = e.clientX || (e.touches && e.touches[0].clientX);
            const currentY = e.clientY || (e.touches && e.touches[0].clientY);
            
            if (Math.abs(currentX - startX) > 10 || Math.abs(currentY - startY) > 10) {
                this.cancelLongPress();
            }
        };
        
        // Add event listeners
        header.addEventListener('mousedown', startLongPress);
        header.addEventListener('touchstart', startLongPress, { passive: false });
        
        header.addEventListener('mouseup', cancelLongPress);
        header.addEventListener('mouseleave', cancelLongPress);
        header.addEventListener('touchend', cancelLongPress);
        header.addEventListener('touchmove', checkMovement, { passive: false });
    },
    
    cancelLongPress() {
        if (this.longPressTimer) {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }
    },
    
    showLongPressPopup(iframeId, x, y) {
        // Remove any existing popups
        this.removeLongPressPopup();
        
        const iframe = document.getElementById(`${iframeId}-iframe`);
        const iframer = window.pjaIframes[iframeId];
        
        if (!iframe || !iframer) return;
        
        // Get apps - try multiple sources
        let allApps = [];
        
        // Try DevWatchDashboard first
        if (window.DevWatchDashboard?.Apps?.draftApps?.length > 0) {
            allApps = window.DevWatchDashboard.Apps.draftApps;
            console.log('[DevWatchIframer] ✅ Using DevWatchDashboard.Apps.draftApps:', allApps.length, 'apps');
        } 
        // Try localStorage directly
        else {
            try {
                const stored = localStorage.getItem('pja-apps');
                if (stored) {
                    allApps = JSON.parse(stored);
                    console.log('[DevWatchIframer] ✅ Using localStorage pja-apps:', allApps.length, 'apps');
                }
            } catch (e) {
                console.warn('[DevWatchIframer] Failed to parse localStorage pja-apps:', e);
            }
        }
        
        // Final fallback
        if (!allApps || allApps.length === 0) {
            console.warn('[DevWatchIframer] ⚠️ Using hardcoded fallback apps');
            allApps = [
                { id: 'system', title: 'System', icon: '📁', src: '/static/system.iframe.html', category: 'dev' },
                { id: 'docs', title: 'Docs', icon: '📄', src: '/static/docs.iframe.html', category: 'dev' },
                { id: 'api-helper', title: 'API Helper', icon: '🔌', src: '/static/api-helper.iframe.html', category: 'dev' },
                { id: 'pcb', title: 'Playwright Command Builder', icon: '⚡', src: '/static/pcb.iframe.html', category: 'dev' },
                { id: 'command-runner', title: 'Command Runner', icon: '🎮', src: '/static/command-runner.iframe.html', category: 'dev' },
                { id: 'cron', title: 'Cron', icon: '⏰', src: '/static/cron.iframe.html', category: 'dev' },
                { id: 'tsm', title: 'Test Suite Manager', icon: '🧪', src: '/static/tsm-standalone.html?iframe=true', category: 'dev' },
                { id: 'testing-matrix', title: 'Testing Matrix Dashboard', icon: '🧩', src: '/static/testing-matrix.iframe.html', category: 'dev' },
                { id: 'quadrapong', title: 'Quadrapong', icon: '🕹️', src: '/static/games/quadrapong/index.html', category: 'games' }
            ];
        }
        
        const devApps = allApps.filter(app => app.category === 'dev');
        const gameApps = allApps.filter(app => app.category === 'games');
        
        console.log('[DevWatchIframer] Dev apps:', devApps.length, 'Game apps:', gameApps.length);
        
        const renderOptions = (apps) => {
            return apps.map(app => `
                <option value="${app.id}" ${app.src === iframe.src ? 'selected' : ''}>
                    ${app.icon} ${app.title}
                </option>
            `).join('');
        };
        
        // Create popup element
        const popup = document.createElement('div');
        popup.id = 'pja-long-press-popup';
        popup.className = 'pja-long-press-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <h3>Panel Options: ${iframer.config.icon} ${iframer.config.title}</h3>
                <p class="popup-description">Select a new source for this panel or remove it from the dashboard. Your layout changes can be saved from the main Dashboard Settings.</p>
                
                <div class="url-selection">
                    <div class="app-list-container">
                        <h4>Developer Tools</h4>
                        <select id="dev-app-select" class="app-listbox" size="6">
                            <option value="system">📁 System</option>
                            <option value="api-helper">🔌 API Helper</option>
                            <option value="pcb">⚡ Playwright Command Builder</option>
                            <option value="command-runner">🎮 Command Runner</option>
                            <option value="cron">⏰ Cron</option>
                            <option value="tsm">🧪 Test Suite Manager</option>
                            <option value="testing-matrix">🧩 Testing Matrix Dashboard</option>
                        </select>
                    </div>
                    <div class="app-list-container">
                        <h4>Games</h4>
                        <select id="game-app-select" class="app-listbox" size="6">
                            <option value="quadrapong">🕹️ Quadrapong</option>
                        </select>
                    </div>
                </div>

                <div id="add-app-form-section" class="url-add-section" style="display: none;">
                    <h4>Add New App</h4>
                    <div class="form-grid">
                        <input type="text" id="new-app-id" placeholder="ID (e.g., cheap-golf)" required>
                        <input type="text" id="new-app-title" placeholder="Title (e.g., Cheap Golf)" required>
                        <input type="text" id="new-app-icon" placeholder="Icon (e.g., ⛳️)" value="🌐">
                        <select id="new-app-category">
                            <option value="games" selected>Games</option>
                            <option value="dev">Developer</option>
                        </select>
                        <input type="url" id="new-app-src" placeholder="Source URL" required class="full-width">
                    </div>
                    <div class="form-actions">
                        <button id="save-new-app-btn">Save App</button>
                        <button id="cancel-add-app-btn" type="button" class="close-btn">Cancel</button>
                    </div>
                </div>

                <div class="popup-actions">
                    <button id="toggle-add-form-btn">➕ Add New App to List</button>
                    <button id="delete-iframer-btn" class="close-btn">🗑️ Remove Panel</button>
                </div>
                
                <div class="popup-actions">
                    <button class="close-btn full-width" onclick="window.DevWatchIframerLongPress.removeLongPressPopup()">Close</button>
                </div>
            </div>
        `;
        
        // Add to body
        document.body.appendChild(popup);

        // Adjust position to stay within viewport
        const popupRect = popup.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let newX = x;
        let newY = y;

        // Adjust horizontal position
        if (x + popupRect.width / 2 > viewportWidth) {
            newX = viewportWidth - popupRect.width / 2 - 10; // 10px padding
        }
        if (x - popupRect.width / 2 < 0) {
            newX = popupRect.width / 2 + 10;
        }

        // Adjust vertical position
        if (y + popupRect.height / 2 > viewportHeight) {
            newY = viewportHeight - popupRect.height / 2 - 10;
        }
        if (y - popupRect.height / 2 < 0) {
            newY = popupRect.height / 2 + 10;
        }
        
        // Position the popup
        popup.style.position = 'fixed';
        popup.style.left = `${newX}px`;
        popup.style.top = `${newY}px`;
        
        // Add styles
        const style = document.createElement('style');
        style.id = 'pja-long-press-popup-styles';
        style.textContent = `
            .devwatch-long-press-popup {
                position: fixed;
                z-index: 1000;
                background-color: var(--devwatch-bg-primary);
                border: 1px solid var(--devwatch-border-primary);
                border-radius: var(--devwatch-border-radius-lg);
                box-shadow: var(--devwatch-shadow-lg);
                padding: var(--devwatch-space-lg);
                transform: translate(-50%, -50%);
                max-width: 400px;
                width: 100%;
                text-align: center;
                color: var(--devwatch-text-primary);
            }
            .devwatch-long-press-popup .popup-content h3 {
                margin-top: 0;
                margin-bottom: var(--devwatch-space-md);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: var(--devwatch-space-sm);
                font-size: 1.2em;
                color: var(--devwatch-text-headings);
            }
            .devwatch-long-press-popup .url-selection,
            .devwatch-long-press-popup .url-add-section {
                margin-bottom: var(--devwatch-space-md);
            }
            .devwatch-long-press-popup .url-selection button {
                 margin-top: var(--devwatch-space-sm);
            }
            .devwatch-long-press-popup .form-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--devwatch-space-sm);
                margin-bottom: var(--devwatch-space-md);
            }
            .devwatch-long-press-popup .form-grid .full-width {
                grid-column: 1 / -1;
            }
            .devwatch-long-press-popup .form-grid input,
            .devwatch-long-press-popup .form-grid select {
                width: 100%;
                padding: var(--devwatch-space-sm);
                border: 1px solid var(--devwatch-border-primary);
                border-radius: var(--devwatch-border-radius-sm);
                background-color: var(--devwatch-input-bg);
                color: var(--devwatch-text-primary);
                box-sizing: border-box;
            }
            .devwatch-long-press-popup .form-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--devwatch-space-sm);
            }
            .devwatch-long-press-popup .form-actions button {
                width: 100%;
            }
            .devwatch-long-press-popup .popup-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--devwatch-space-sm);
                margin-top: var(--devwatch-space-md);
            }
            .devwatch-long-press-popup .popup-actions button {
                padding: var(--devwatch-space-sm);
                background-color: var(--devwatch-primary);
                color: var(--devwatch-text-on-primary);
                border: none;
                border-radius: var(--devwatch-border-radius-sm);
                cursor: pointer;
                transition: background-color 0.2s;
            }
            .devwatch-long-press-popup .popup-actions button:hover {
                background-color: var(--devwatch-primary-dark);
            }
            .devwatch-long-press-popup .popup-actions button.full-width {
                 grid-column: 1 / -1;
            }
            .devwatch-long-press-popup .popup-actions button.close-btn {
                background-color: var(--devwatch-bg-secondary);
                color: var(--devwatch-text-secondary);
            }
            .devwatch-long-press-popup .popup-actions button.close-btn:hover {
                background-color: var(--devwatch-bg-hover);
            }
            .devwatch-long-press-popup .url-selection {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: var(--devwatch-space-md);
            }
            .devwatch-long-press-popup .app-listbox {
                width: 100%;
                border: 1px solid var(--devwatch-border-primary);
                border-radius: var(--devwatch-border-radius-sm);
                background-color: var(--devwatch-input-bg);
                color: var(--devwatch-text-primary);
            }
            .devwatch-long-press-popup .app-listbox option {
                padding: var(--devwatch-space-xs);
            }
            .devwatch-long-press-popup .app-listbox option:hover {
                background-color: var(--devwatch-primary-light);
            }
            .devwatch-long-press-popup .app-listbox-container h4,
            .devwatch-long-press-popup .url-add-section h4, 
            .devwatch-long-press-popup .url-selection h4 {
                 margin-top: 0;
                 margin-bottom: var(--devwatch-space-xs);
                 color: var(--devwatch-text-muted);
                 text-align: left;
                 font-size: 0.8em;
                 text-transform: uppercase;
            }
        `;
        document.head.appendChild(style);
        
        // Event Listeners
        const devAppSelect = document.getElementById('dev-app-select');
        const gameAppSelect = document.getElementById('game-app-select');
        const toggleAddFormBtn = document.getElementById('toggle-add-form-btn');
        const deleteIframerBtn = document.getElementById('delete-iframer-btn');
        const addAppFormSection = document.getElementById('add-app-form-section');
        
        devAppSelect.addEventListener('change', () => {
            const selectedAppId = devAppSelect.value;
            if (selectedAppId) {
                window.changeIframeSource(iframeId, selectedAppId);
                gameAppSelect.selectedIndex = -1; // Deselect other list
            }
        });

        gameAppSelect.addEventListener('change', () => {
            const selectedAppId = gameAppSelect.value;
            if (selectedAppId) {
                window.changeIframeSource(iframeId, selectedAppId);
                devAppSelect.selectedIndex = -1; // Deselect other list
            }
        });
        
        deleteIframerBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this iframe section? This action cannot be undone.')) {
                window.deleteDevWatchIframe(iframeId);
            }
        });
        
        // Toggle the "Add New App" form
        toggleAddFormBtn.addEventListener('click', () => {
            const isVisible = addAppFormSection.style.display !== 'none';
            addAppFormSection.style.display = isVisible ? 'none' : 'block';
        });

        const saveNewAppBtn = document.getElementById('save-new-app-btn');
        const cancelAddAppBtn = document.getElementById('cancel-add-app-btn');

        cancelAddAppBtn.addEventListener('click', () => {
            addAppFormSection.style.display = 'none';
        });

        saveNewAppBtn.addEventListener('click', () => {
            const newApp = {
                id: document.getElementById('new-app-id').value.trim(),
                title: document.getElementById('new-app-title').value.trim(),
                icon: document.getElementById('new-app-icon').value.trim() || '🌐',
                src: document.getElementById('new-app-src').value.trim(),
                category: document.getElementById('new-app-category').value,
            };

            if (!newApp.id || !newApp.title || !newApp.src) {
                alert('ID, Title, and Source URL are required.');
                return;
            }

            window.DevWatchAppsManager.addApp(newApp);
            
            // Refresh the popup
            this.removeLongPressPopup();
            this.showLongPressPopup(iframeId, x, y);
        });
    },
    
    removeLongPressPopup() {
        const popup = document.getElementById('pja-long-press-popup');
        const popupStyles = document.getElementById('pja-long-press-popup-styles');
        
        if (popup) popup.remove();
        if (popupStyles) popupStyles.remove();
    }
};

/**
 * Deletes an iframer instance and its corresponding DOM element.
 * @param {string} iframeId - The ID of the iframer to delete.
 */
window.deleteDevWatchIframe = function(iframeId) {
    if (window.DevWatchDashboard) DevWatchDashboard.Manager.removeIframe(iframeId);
};

// Global method to close all iframes and panels
window.closeAllDevWatchIframes = function() {
    // Close iframes in the dashboard
    if (window.DevWatchDashboard && window.DevWatchDashboard.Manager) {
        const iframeIds = Object.keys(window.DevWatchDashboard.Manager.iframes || {});
        iframeIds.forEach(iframeId => {
            window.deleteDevWatchIframe(iframeId);
        });
    }

    // Close iframes in the iframe manager
    if (window.APP && window.APP.iframes && window.APP.iframes.managerInstance) {
        const iframeManager = window.APP.iframes.managerInstance;
        Object.keys(iframeManager.iframes || {}).forEach(iframeId => {
            const iframe = iframeManager.iframes[iframeId];
            if (iframe && iframe.destroy) {
                iframe.destroy();
            }
        });
        
        // Clear the container
        if (iframeManager.container) {
            iframeManager.container.innerHTML = '';
        }
    }

    // Close all panels in existing iframes
    const iframerInstances = Object.values(window.pjaIframes || {});
    iframerInstances.forEach(iframer => {
        if (iframer && typeof iframer.closeAllPanels === 'function') {
            iframer.closeAllPanels();
        }
    });

    // Close any additional panel types
    const panelTypes = [
        '.devwatch-tab-panel', 
        '.devwatch-column-panel', 
        '.devwatch-section'
    ];
    
    panelTypes.forEach(selector => {
        const panels = document.querySelectorAll(selector);
        panels.forEach(panel => {
            panel.style.display = 'none';
            panel.classList.remove('active');
        });
    });

    // Reset global iframe storage
    window.pjaIframes = {};
    if (window.APP && window.APP.iframes) {
        window.APP.iframes.instances = {};
    }

    console.log('🔒 All PJA iframes, panels, and sections have been closed.');
};
