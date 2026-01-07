/**
 * PJA SDK - Canonical Pixeljam Arcade Web Platform Game SDK
 * 
 * This is the standard SDK that all PJA games should use.
 * It installs itself on window.DevWatch and provides a modular API
 * for communication between games (iframes) and the host platform.
 * 
 * Usage in game HTML:
 * <script src="/static/js/DevWatchSdk.js"></script>
 * 
 * Then in your game code:
 * PJA.game.init({
 *   onReady: () => console.log('Game connected to PJA host'),
 *   onTheme: (theme) => applyTheme(theme)
 * });
 * 
 * PJA.iframe.on('custom-message', (data) => handleMessage(data));
 * PJA.game.on('score-update', (score) => updateScore(score));
 */

(function() {
    'use strict';

    // Prevent double initialization
    if (window.DevWatch) {
        console.warn('[PJA SDK] Already initialized');
        return;
    }

    /**
     * Core PJA SDK Class - Internal implementation
     */
    class DevWatchSdkCore {
        constructor() {
            this.isIframe = window.self !== window.top;
            this.isReady = false;
            this.config = {
                enableSecurity: true,
                allowedDomains: [
                    'pixeljamarcade.com',
                    'dev.pixeljamarcade.com', 
                    'staging.pixeljamarcade.com',
                    'localhost'
                ],
                autoSendTitle: true,
                hideTitle: true
            };
            this.hooks = {
                onReady: null,
                onTheme: null,
                onMessage: null,
                onUnload: null
            };
            this.messageQueue = [];
            this.currentTheme = null;
            this.eventHandlers = {
                iframe: new Map(),
                game: new Map()
            };
            
            console.log('[PJA SDK] Core initializing...', {
                isIframe: this.isIframe,
                pathname: window.location.pathname
            });
        }

        /**
         * Initialize the SDK with configuration and hooks
         */
        init(options = {}) {
            // Merge configuration
            Object.assign(this.config, options);
            Object.assign(this.hooks, options);

            if (!this.isIframe) {
                console.log('[PJA SDK] Running in standalone mode');
                this._initStandalone();
                return this;
            }

            // Security check for iframe context
            if (this.config.enableSecurity && !this._validateDomain()) {
                return this;
            }

            this._setupMessageHandling();
            this._setupLifecycleHandlers();
            
            // Send ready signal to host (compatible with devwatch-iframer)
            this._sendMessage('devwatch-iframe-ready', {
                url: window.location.href,
                timestamp: Date.now()
            });

            console.log('[PJA SDK] Initialized in iframe mode');
            return this;
        }

        /**
         * Send a message to the host platform
         */
        sendMessage(type, data = {}) {
            this._sendMessage(type, data);
        }

        /**
         * Send the current page title to the host
         */
        sendTitle(customTitle = null) {
            const title = customTitle || this._getTitle();
            this._sendMessage('devwatch-title-update', { title });
        }

        /**
         * Request the current theme from the host
         */
        requestTheme() {
            this._sendMessage('pja-get-theme');
        }

        /**
         * Apply a theme to the game
         */
        setTheme(theme) {
            this.currentTheme = theme;
            document.documentElement.setAttribute('data-theme', theme);
            
            // Update CSS custom properties if available
            const computedStyle = getComputedStyle(document.documentElement);
            const primary = computedStyle.getPropertyValue('--devwatch-primary');
            if (primary) {
                document.documentElement.style.setProperty('--game-accent', primary);
            }

            if (this.hooks.onTheme) {
                this.hooks.onTheme(theme);
            }

            // Emit theme event to game handlers
            this._emitEvent('game', 'theme-changed', { theme });
        }

        /**
         * Get current theme
         */
        getTheme() {
            return this.currentTheme;
        }

        /**
         * Check if user is authenticated
         */
        async checkAuth() {
            return new Promise((resolve) => {
                if (!this.isIframe) {
                    resolve(null);
                    return;
                }

                const timeoutId = setTimeout(() => {
                    window.removeEventListener('message', authHandler);
                    resolve(null);
                }, 5000);

                const authHandler = (event) => {
                    if (event.data?.source === 'devwatch-host' && event.data?.type === 'pja-auth-response') {
                        clearTimeout(timeoutId);
                        window.removeEventListener('message', authHandler);
                        resolve(event.data.data?.user || null);
                    }
                };

                window.addEventListener('message', authHandler);
                this._sendMessage('pja-auth-check');
            });
        }

        /**
         * Log activity for debugging and analytics
         */
        log(message, level = 'info', data = {}) {
            console[level](`[PJA Game] ${message}`, data);
            
            this._sendMessage('pja-game-log', {
                message,
                level,
                data,
                timestamp: Date.now(),
                url: window.location.href
            });
        }

        /**
         * Register event handler for iframe or game events
         */
        on(module, eventType, handler) {
            if (!this.eventHandlers[module]) {
                this.eventHandlers[module] = new Map();
            }
            
            if (!this.eventHandlers[module].has(eventType)) {
                this.eventHandlers[module].set(eventType, new Set());
            }
            
            this.eventHandlers[module].get(eventType).add(handler);
            
            return () => this.off(module, eventType, handler);
        }

        /**
         * Remove event handler
         */
        off(module, eventType, handler) {
            if (this.eventHandlers[module]?.has(eventType)) {
                this.eventHandlers[module].get(eventType).delete(handler);
            }
        }

        /**
         * Emit event to handlers
         */
        _emitEvent(module, eventType, data) {
            if (this.eventHandlers[module]?.has(eventType)) {
                const handlers = this.eventHandlers[module].get(eventType);
                handlers.forEach(handler => {
                    try {
                        handler(data);
                    } catch (error) {
                        console.error(`[PJA SDK] Error in ${module}.${eventType} handler:`, error);
                    }
                });
            }
        }

        // --- Private Methods ---

        _initStandalone() {
            this.isReady = true;
            this.currentTheme = 'matrix';
            this.setTheme(this.currentTheme);
            
            if (this.hooks.onReady) {
                setTimeout(() => this.hooks.onReady(), 100);
            }

            console.log('[PJA SDK] Standalone mode initialized');
        }

        _setupMessageHandling() {
            window.addEventListener('message', (event) => {
                if (event.source !== window.parent) return;
                
                const { source, type, data } = event.data;
                if (source !== 'devwatch-host') return;

                this._handleHostMessage(type, data);
            });
        }

        _setupLifecycleHandlers() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this._onDOMReady());
            } else {
                this._onDOMReady();
            }

            window.addEventListener('beforeunload', () => {
                if (this.hooks.onUnload) {
                    this.hooks.onUnload();
                }
                this._sendMessage('pja-game-unload');
            });
        }

        _onDOMReady() {
            this.isReady = true;

            if (this.config.autoSendTitle) {
                this.sendTitle();
            }

            if (this.config.hideTitle) {
                this._hideTitle();
            }

            this._sendAssetInfo();
            this.requestTheme();

            if (this.hooks.onReady) {
                this.hooks.onReady();
            }

            // Emit ready event to game handlers
            this._emitEvent('game', 'ready', { timestamp: Date.now() });

            // Process queued messages
            this.messageQueue.forEach(msg => this._sendMessage(msg.type, msg.data));
            this.messageQueue = [];
        }

        _handleHostMessage(type, data) {
            // Emit to iframe handlers first
            this._emitEvent('iframe', type, data);

            switch (type) {
                case 'devwatch-set-theme':
                    this.setTheme(data.theme);
                    break;
                
                case 'pja-ping':
                    this._sendMessage('pja-pong', {
                        ...data,
                        timestamp: Date.now()
                    });
                    break;
                
                case 'pja-show-infopanel':
                    this.showInfoPanel(data);
                    break;
                
                case 'pja-hide-infopanel':
                    this.hideInfoPanel();
                    break;
                
                case 'pja-set-credits':
                    this.setInfoPanelCredits(data.credits);
                    break;
                
                default:
                    // Pass custom messages to game handlers and legacy hook
                    this._emitEvent('game', type, data);
                    if (this.hooks.onMessage) {
                        this.hooks.onMessage(type, data);
                    }
                    break;
            }
        }

        _sendMessage(type, data = {}) {
            if (!this.isIframe) return;

            if (!this.isReady && type !== 'devwatch-iframe-ready') {
                this.messageQueue.push({ type, data });
                return;
            }

            window.parent.postMessage({
                source: 'pja-game',
                type,
                data,
                timestamp: Date.now()
            }, '*');
        }

        _getTitle() {
            const titleElement = document.querySelector('h1, .devwatch-title, [data-pja-title]');
            if (titleElement) {
                return titleElement.textContent.trim();
            }
            return document.title || 'PJA Game';
        }

        _hideTitle() {
            const selectors = [
                'h1:first-of-type',
                '.devwatch-title',
                '[data-pja-title]',
                '.game-title'
            ];

            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    el.style.display = 'none';
                    el.setAttribute('data-pja-hidden', 'true');
                });
            });
        }

        _sendAssetInfo() {
            try {
                const cssFiles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
                    .map(link => link.href.split('/').pop());
                const jsFiles = Array.from(document.querySelectorAll('script[src]'))
                    .map(script => script.src.split('/').pop());
                
                this._sendMessage('pja-asset-info', {
                    css: cssFiles,
                    js: jsFiles,
                    url: window.location.href
                });
            } catch (error) {
                this._sendMessage('pja-asset-info', { error: error.message });
            }
        }

        _validateDomain() {
            try {
                const referrer = document.referrer;
                if (!referrer) {
                    return window.location.hostname === 'localhost';
                }

                const isValid = this.config.allowedDomains.some(domain => 
                    referrer.includes(domain)
                );

                if (!isValid) {
                    this._showSecurityWarning();
                    return false;
                }

                return true;
            } catch (error) {
                console.error('[PJA SDK] Security validation failed:', error);
                this._showSecurityWarning();
                return false;
            }
        }

        _showSecurityWarning() {
            document.body.innerHTML = `
                <div style="
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    height: 100vh; 
                    font-family: Arial, sans-serif; 
                    background: #000; 
                    color: #fff;
                    text-align: center;
                    padding: 20px;
                ">
                    <div>
                        <h2>🎮 Pixeljam Arcade</h2>
                        <p>This game must be accessed through the official arcade platform.</p>
                        <a href="https://pixeljamarcade.com" 
                           style="color: #4CAF50; text-decoration: none; font-weight: bold;">
                            Visit Pixeljam Arcade
                        </a>
                    </div>
                </div>
            `;
        }

        /**
         * InfoPanel - Host-controlled modal for runtime info and developer credits
         */
        _createInfoPanel() {
            if (document.getElementById('pja-infopanel')) return;

            const panel = document.createElement('div');
            panel.id = 'pja-infopanel';
            panel.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: none;
                z-index: 10000;
                font-family: 'Courier New', monospace;
                color: #00ff00;
            `;

            panel.innerHTML = `
                <div style="
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: #000;
                    border: 2px solid #00ff00;
                    border-radius: 8px;
                    padding: 20px;
                    max-width: 500px;
                    width: 90%;
                    max-height: 80vh;
                    overflow-y: auto;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                        <h3 style="margin: 0; color: #00ff00;">🎮 Game Info</h3>
                        <button id="pja-infopanel-close" style="
                            background: none;
                            border: 1px solid #00ff00;
                            color: #00ff00;
                            cursor: pointer;
                            padding: 5px 10px;
                            border-radius: 3px;
                        ">✕</button>
                    </div>
                    
                    <div id="pja-infopanel-content">
                        <div style="margin-bottom: 15px;">
                            <h4 style="color: #ffff00; margin: 0 0 5px 0;">Runtime Info</h4>
                            <div id="pja-runtime-info" style="font-size: 12px; line-height: 1.4;">
                                <div>URL: <span id="pja-game-url">${window.location.href}</span></div>
                                <div>Theme: <span id="pja-current-theme">${this.currentTheme || 'none'}</span></div>
                                <div>Mode: <span id="pja-game-mode">${this.isIframe ? 'iframe' : 'standalone'}</span></div>
                                <div>Ready: <span id="pja-ready-state">${this.isReady}</span></div>
                                <div>Timestamp: <span id="pja-timestamp">${new Date().toISOString()}</span></div>
                            </div>
                        </div>
                        
                        <div id="pja-credits-section" style="margin-bottom: 15px;">
                            <h4 style="color: #ffff00; margin: 0 0 5px 0;">Credits</h4>
                            <div id="pja-credits-content" style="font-size: 12px; line-height: 1.4;">
                                <div>Powered by Pixeljam Arcade SDK</div>
                                <div id="pja-game-credits"></div>
                            </div>
                        </div>
                        
                        <div id="pja-custom-info" style="font-size: 12px; line-height: 1.4;"></div>
                    </div>
                </div>
            `;

            document.body.appendChild(panel);

            // Close button handler
            panel.querySelector('#pja-infopanel-close').addEventListener('click', () => {
                this.hideInfoPanel();
            });

            // Close on backdrop click
            panel.addEventListener('click', (e) => {
                if (e.target === panel) {
                    this.hideInfoPanel();
                }
            });

            // Close on escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && panel.style.display === 'block') {
                    this.hideInfoPanel();
                }
            });
        }

        showInfoPanel(customInfo = {}) {
            this._createInfoPanel();
            const panel = document.getElementById('pja-infopanel');
            
            // Update runtime info
            const urlEl = document.getElementById('pja-game-url');
            const themeEl = document.getElementById('pja-current-theme');
            const modeEl = document.getElementById('pja-game-mode');
            const readyEl = document.getElementById('pja-ready-state');
            const timestampEl = document.getElementById('pja-timestamp');
            
            if (urlEl) urlEl.textContent = window.location.href;
            if (themeEl) themeEl.textContent = this.currentTheme || 'none';
            if (modeEl) modeEl.textContent = this.isIframe ? 'iframe' : 'standalone';
            if (readyEl) readyEl.textContent = this.isReady;
            if (timestampEl) timestampEl.textContent = new Date().toISOString();

            // Update credits if provided
            if (customInfo.credits) {
                const creditsEl = document.getElementById('pja-game-credits');
                if (creditsEl) {
                    creditsEl.innerHTML = Array.isArray(customInfo.credits) 
                        ? customInfo.credits.map(credit => `<div>${credit}</div>`).join('')
                        : `<div>${customInfo.credits}</div>`;
                }
            }

            // Update custom info if provided
            if (customInfo.info) {
                const customEl = document.getElementById('pja-custom-info');
                if (customEl) {
                    customEl.innerHTML = Array.isArray(customInfo.info)
                        ? customInfo.info.map(info => `<div>${info}</div>`).join('')
                        : `<div>${customInfo.info}</div>`;
                }
            }

            panel.style.display = 'block';
            this._emitEvent('game', 'infopanel-shown', customInfo);
        }

        hideInfoPanel() {
            const panel = document.getElementById('pja-infopanel');
            if (panel) {
                panel.style.display = 'none';
                this._emitEvent('game', 'infopanel-hidden', {});
            }
        }

        setInfoPanelCredits(credits) {
            this.infoPanelCredits = credits;
            const creditsEl = document.getElementById('pja-game-credits');
            if (creditsEl) {
                creditsEl.innerHTML = Array.isArray(credits) 
                    ? credits.map(credit => `<div>${credit}</div>`).join('')
                    : `<div>${credits}</div>`;
            }
        }
    }

    // --- Modular PJA SDK Interface ---
    
    const core = new DevWatchSdkCore();

    /**
     * PJA Iframe Module - Handle iframe-specific events and communication
     */
    const IframeModule = {
        /**
         * Register handler for iframe messages from host
         * @param {string} eventType - Message type from host (e.g., 'devwatch-set-theme', 'custom-message')
         * @param {Function} handler - Handler function (data) => {}
         * @returns {Function} Unsubscribe function
         */
        on(eventType, handler) {
            return core.on('iframe', eventType, handler);
        },

        /**
         * Remove handler for iframe messages
         * @param {string} eventType - Message type
         * @param {Function} handler - Handler function to remove
         */
        off(eventType, handler) {
            core.off('iframe', eventType, handler);
        },

        /**
         * Send message to host
         * @param {string} type - Message type
         * @param {Object} data - Message data
         */
        send(type, data = {}) {
            core.sendMessage(type, data);
        },

        /**
         * Get iframe ready state
         * @returns {boolean} True if iframe is ready
         */
        isReady() {
            return core.isReady;
        },

        /**
         * Get current theme
         * @returns {string|null} Current theme name
         */
        getTheme() {
            return core.getTheme();
        }
    };

    /**
     * PJA Game Module - Handle game-specific events and state
     */
    const GameModule = {
        /**
         * Initialize the game with PJA host
         * @param {Object} options - Configuration options
         * @param {Function} options.onReady - Called when connected to host
         * @param {Function} options.onTheme - Called when theme changes
         * @param {Function} options.onMessage - Called for custom messages (legacy)
         * @param {Function} options.onUnload - Called before page unloads
         * @returns {Object} Game module for chaining
         */
        init(options = {}) {
            core.init(options);
            return this;
        },

        /**
         * Register handler for game events
         * @param {string} eventType - Event type (e.g., 'ready', 'theme-changed', 'score-update')
         * @param {Function} handler - Handler function (data) => {}
         * @returns {Function} Unsubscribe function
         */
        on(eventType, handler) {
            return core.on('game', eventType, handler);
        },

        /**
         * Remove handler for game events
         * @param {string} eventType - Event type
         * @param {Function} handler - Handler function to remove
         */
        off(eventType, handler) {
            core.off('game', eventType, handler);
        },

        /**
         * Emit custom game event
         * @param {string} eventType - Event type
         * @param {Object} data - Event data
         */
        emit(eventType, data = {}) {
            core._emitEvent('game', eventType, data);
        },

        /**
         * Send game title to host
         * @param {string} title - Game title
         */
        setTitle(title) {
            core.sendTitle(title);
        },

        /**
         * Log game activity
         * @param {string} message - Log message
         * @param {string} level - Log level (info, warn, error)
         * @param {Object} data - Additional data
         */
        log(message, level = 'info', data = {}) {
            core.log(message, level, data);
        },

        /**
         * Check if user is authenticated
         * @returns {Promise<Object|null>} User object or null
         */
        checkAuth() {
            return core.checkAuth();
        },

        /**
         * Apply theme to game
         * @param {string} theme - Theme name
         */
        setTheme(theme) {
            core.setTheme(theme);
        },

        /**
         * Get current theme
         * @returns {string|null} Current theme name
         */
        getTheme() {
            return core.getTheme();
        },

        /**
         * Show InfoPanel with optional custom info and credits
         * @param {Object} options - Panel options
         * @param {string|Array} options.credits - Developer credits
         * @param {string|Array} options.info - Custom information
         */
        showInfoPanel(options = {}) {
            core.showInfoPanel(options);
        },

        /**
         * Hide InfoPanel
         */
        hideInfoPanel() {
            core.hideInfoPanel();
        },

        /**
         * Set developer credits for InfoPanel
         * @param {string|Array} credits - Developer credits
         */
        setCredits(credits) {
            core.setInfoPanelCredits(credits);
        }
    };

    // --- Global Installation ---
    
    window.DevWatch = {
        iframe: IframeModule,
        game: GameModule
    };

    console.log('[PJA SDK] Modular SDK installed on window.DevWatch');
    console.log('[PJA SDK] Available modules: PJA.iframe, PJA.game');

})();