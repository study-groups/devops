/**
 * PJA Dashboard Module
 * 
 * This module centralizes all the logic for the main dashboard UI, including
 * state management, settings, popups, and logging.
 */

// A single global object to encapsulate all dashboard functionality.
window.DevWatchDashboard = {
    init() {
        // This will be the single entry point called from index.html
        this.Apps.init();
        this.Settings.init();
        this.Manager.init();
        this.SettingsPanel.init();

        
        // Sync apps to layout if layout is empty
        if (this.Manager.draftLayout.length === 0) {
            this.Manager.draftLayout = [...this.Apps.draftApps];
        }
        
        this.Manager.renderDashboard();
        this.Log.action('initialized');
    },

    // Centralized logger for dashboard-specific actions
    Log: {
        action(name, data = {}) {
            if (window.Logger) {
                window.Logger.log({
                    type: 'UI',
                    from: `dashboard.${name}`,
                    message: `Dashboard action: ${name.replace(/_/g, ' ')}`,
                    data
                });
            }
        }
    },

    // Renamed from DevWatchAppsManager for clarity within the module
    Apps: {
        _committedApps: [],
        draftApps: [],
        
        init() {
            const defaultApps = [
                { id: 'system', title: 'System', src: '/static/system.iframe.html', category: 'dev' },
                { id: 'docs', title: 'Docs', src: '/static/docs.iframe.html', category: 'dev' },
                { id: 'api-helper', title: 'API Helper', src: '/static/api-helper.iframe.html', category: 'dev' },
                { id: 'pcb', title: 'Playwright Command Builder', src: '/static/pcb.iframe.html', category: 'dev' },
                { id: 'command-runner', title: 'Command Runner', src: '/static/command-runner.iframe.html', category: 'dev' },
                { id: 'cron', title: 'Cron', src: '/static/cron.iframe.html', category: 'dev' },
                { id: 'tsm', title: 'Test Suite Manager', src: '/static/tsm-standalone.html?iframe=true', category: 'dev' },
                { id: 'testing-matrix', title: 'Testing Matrix Dashboard', src: '/static/testing-matrix.iframe.html', category: 'dev' },
                { id: 'quadrapong', title: 'Quadrapong', src: '/static/games/quadrapong/index.html', category: 'games' }
            ];
            const stored = localStorage.getItem('pja-apps');
            if (stored) {
                try { this._committedApps = JSON.parse(stored); } catch (e) { this._committedApps = defaultApps; }
            } else { this._committedApps = defaultApps; }
            localStorage.setItem('pja-apps', JSON.stringify(this._committedApps));
            this.revert();
        },
        addApp(app) {
            const existingIndex = this.draftApps.findIndex(a => a.id === app.id);
            if (existingIndex > -1) this.draftApps[existingIndex] = app;
            else this.draftApps.push(app);
            DevWatchDashboard.Log.action('app_added_to_draft', app);
        },
        removeApp(appId) {
            this.draftApps = this.draftApps.filter(a => a.id !== appId);
            DevWatchDashboard.Log.action('app_removed_from_draft', { appId });
        },
        save() {
            this._committedApps = JSON.parse(JSON.stringify(this.draftApps));
            localStorage.setItem('pja-apps', JSON.stringify(this._committedApps));
            DevWatchDashboard.Log.action('apps_saved');
        },
        revert() {
            this.draftApps = JSON.parse(JSON.stringify(this._committedApps));
        }
    },

    // New manager for global dashboard settings like theme and defaults
    Settings: {
        _committedSettings: {},
        draftSettings: {},
        _defaultSettings: {
            theme: 'matrix',
            iframerDefaults: {
                collapsed: true
            }
        },
        // The logic for the new settings manager will be placed here.
        init() {
            const stored = localStorage.getItem('pja-dashboard-settings');
            const defaults = JSON.parse(JSON.stringify(this._defaultSettings));
            if (stored) {
                try {
                    // Deep merge to ensure new default properties are added
                    this._committedSettings = { ...defaults, ...JSON.parse(stored) };
                } catch (e) { this._committedSettings = defaults; }
            } else { this._committedSettings = defaults; }
            this.revert();
        },
        save() {
            this._committedSettings = JSON.parse(JSON.stringify(this.draftSettings));
            localStorage.setItem('pja-dashboard-settings', JSON.stringify(this._committedSettings));
            DevWatchDashboard.Log.action('settings_saved');
        },
        revert() {
            this.draftSettings = JSON.parse(JSON.stringify(this._committedSettings));
        }
    },

    // Renamed from DevWatchDashboardManager
    Manager: {
        _committedLayout: [],
        draftLayout: [],
        _defaultLayout: [
            { id: 'system', title: 'System', src: '/static/system.iframe.html', category: 'dev' },
            { id: 'docs', title: 'Docs', src: '/static/docs.iframe.html', category: 'dev' },
            { id: 'api-helper', title: 'API Helper', src: '/static/api-helper.iframe.html', category: 'dev' },
            { id: 'pcb', title: 'Playwright Command Builder', src: '/static/pcb.iframe.html', category: 'dev' },
            { id: 'command-runner', title: 'Command Runner', src: '/static/command-runner.iframe.html', category: 'dev' },
            { id: 'cron', title: 'Cron', src: '/static/cron.iframe.html', category: 'dev' }
        ],

        init() {
            const storedLayout = localStorage.getItem('pja-dashboard-layout');
            if (storedLayout) {
                try {
                    const parsedLayout = JSON.parse(storedLayout);
                    this._committedLayout = parsedLayout.length > 0 ? parsedLayout : this._defaultLayout;
                } catch (e) { this._committedLayout = this._defaultLayout; }
            } else { this._committedLayout = this._defaultLayout; }
            this.revertLayout(); // Corrected from this.revert()
        },
        saveLayout() {
            this._committedLayout = JSON.parse(JSON.stringify(this.draftLayout));
            localStorage.setItem('pja-dashboard-layout', JSON.stringify(this._committedLayout));
            DevWatchDashboard.Log.action('layout_saved');
        },
        revertLayout() {
            this.draftLayout = JSON.parse(JSON.stringify(this._committedLayout));
        },
        resetLayout() {
            this.draftLayout = JSON.parse(JSON.stringify(this._defaultLayout));
            this.renderDashboard();
            DevWatchDashboard.Log.action('layout_reset');
        },
        addIframe(appConfig) {
            const newIframe = { ...appConfig, id: `${appConfig.id}-${Date.now()}` };
            this.draftLayout.push(newIframe);
            this.renderDashboard();
        },
        removeIframe(iframeId) {
            this.draftLayout = this.draftLayout.filter(iframe => iframe.id !== iframeId);
            this.renderDashboard();
        },
        updateIframe(iframeId, newAppConfig) {
            const index = this.draftLayout.findIndex(iframe => iframe.id === iframeId);
            if (index !== -1) {
                this.draftLayout[index] = { ...newAppConfig, id: iframeId };
            }
            this.renderDashboard();
        },
        renderDashboard() {
            const container = document.getElementById('dynamic-sections');
            if (!container) {
                console.warn('[Dashboard] Container #dynamic-sections not found');
                return;
            }
            
            container.innerHTML = '';
            window.pjaIframes = {};
            
            let successCount = 0;
            let errorCount = 0;
            
            this.draftLayout.forEach(iframeConfig => {
                try {
                    if (!window.DevWatchIframer) {
                        throw new Error('DevWatchIframer not available');
                    }
                    
                    if (!iframeConfig || !iframeConfig.id || !iframeConfig.src) {
                        throw new Error('Invalid iframe config');
                    }
                    
                    const iframer = new DevWatchIframer(iframeConfig);
                    const element = iframer.render(container);
                    
                    if (element) {
                        window.pjaIframes[iframeConfig.id] = iframer;
                        successCount++;
                        console.log(`[Dashboard] ✅ Loaded: ${iframeConfig.title || iframeConfig.id}`);
                    } else {
                        throw new Error('Failed to render iframe element');
                    }
                } catch (error) {
                    errorCount++;
                    console.error(`[Dashboard] ❌ Failed to load: ${iframeConfig?.title || iframeConfig?.id || 'unknown'}`, error);
                    
                    // Create error placeholder instead of breaking entire dashboard
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'iframe-error-placeholder';
                    errorDiv.innerHTML = `
                        <div class="error-content">
                            <h3>⚠️ ${iframeConfig?.title || 'Unknown App'}</h3>
                            <p>Failed to load: ${error.message}</p>
                            <button onclick="location.reload()">Reload Dashboard</button>
                        </div>
                    `;
                    container.appendChild(errorDiv);
                }
            });
            
            console.log(`[Dashboard] 📊 Loaded ${successCount}/${this.draftLayout.length} apps (${errorCount} errors)`);
            
            if (errorCount > 0) {
                DevWatchDashboard.Log.action('render_dashboard_with_errors', { 
                    success: successCount, 
                    errors: errorCount, 
                    total: this.draftLayout.length 
                });
            }
        }
    },

    // Renamed from DevWatchDashboardPopup to SettingsPanel
    SettingsPanel: {
        init() {
            const header = document.getElementById('dashboard-header');
            const panel = document.getElementById('dashboard-settings-panel');
            if (!header || !panel) return;

            // Toggle panel on header click
            header.addEventListener('click', () => {
                panel.classList.toggle('is-open');
                if (panel.classList.contains('is-open')) {
                    this.renderAppPicker();
                }
            });

            // Close panel function
            const closePanel = () => panel.classList.remove('is-open');

            // Wire up buttons
            document.getElementById('reset-dashboard-btn').addEventListener('click', () => {
                if (confirm('Are you sure you want to reset your layout to the default developer tools?')) {
                    DevWatchDashboard.Manager.resetLayout();
                    closePanel();
                }
            });
            document.getElementById('save-apps-btn').addEventListener('click', () => {
                DevWatchDashboard.Apps.save();
                DevWatchDashboard.Manager.saveLayout();
                alert('Your dashboard configuration has been saved!');
                closePanel();
            });
            document.getElementById('revert-apps-btn').addEventListener('click', () => {
                if (confirm('Are you sure you want to discard all changes?')) {
                    DevWatchDashboard.Apps.revert();
                    DevWatchDashboard.Manager.revertLayout();
                    DevWatchDashboard.Manager.renderDashboard();
                    closePanel();
                }
            });

            // Initial render of app picker
            this.renderAppPicker();
        },

        renderAppPicker() {
            const container = document.getElementById('app-picker-list');
            if (!container) return;

            const apps = DevWatchDashboard.Apps.draftApps;

            // Group apps by category
            const categories = {};
            apps.forEach(app => {
                const cat = app.category || 'other';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(app);
            });

            // Category display order and labels
            const categoryOrder = ['dev', 'games', 'other'];
            const categoryLabels = {
                dev: 'Developer Tools',
                games: 'Games',
                other: 'Other'
            };

            let html = '';
            categoryOrder.forEach(cat => {
                if (!categories[cat] || categories[cat].length === 0) return;

                html += `<div class="app-picker-category">
                    <div class="app-picker-category-label">${categoryLabels[cat] || cat}</div>
                    <div class="app-picker-items">`;

                categories[cat].forEach(app => {
                    html += `<button class="app-picker-item" data-app-id="${app.id}" title="${app.title}">
                        <span class="app-picker-item-title">${app.title}</span>
                    </button>`;
                });

                html += `</div></div>`;
            });

            container.innerHTML = html;

            // Attach click handlers
            container.querySelectorAll('.app-picker-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    const appId = btn.dataset.appId;
                    const app = apps.find(a => a.id === appId);
                    if (app) {
                        DevWatchDashboard.Manager.addIframe(app);
                        DevWatchDashboard.Log.action('app_added_from_picker', { appId });
                    }
                });
            });
        }
    }
};
