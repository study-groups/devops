// Tetra Dashboard JavaScript
// Module semantics and data management

class TetraDashboard {
    constructor() {
        this.moduleData = null;
        this.currentView = 'summary';
        this.init();
    }

    async init() {
        // Set generated time
        document.getElementById('generatedTime').textContent = new Date().toLocaleTimeString();

        // Load module data
        await this.loadModuleData();

        // Update UI
        this.updateStats();
        this.updateModuleTypes();

        // Set up event listeners
        this.setupEventListeners();

        console.log('Tetra Dashboard initialized');
    }

    async loadModuleData() {
        try {
            // Fetch real module data from generated JSON endpoint
            const response = await fetch('./api/modules.json');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.moduleData = await response.json();
            console.log('Loaded real module data:', Object.keys(this.moduleData.modules).length, 'modules');
        } catch (error) {
            console.warn('Failed to load real module data, using fallback:', error);
            this.moduleData = this.getFallbackData();
        }
    }

    // Mock data functions removed - now using real discovery data

    generateFunctions(count, moduleName) {
        const functionTemplates = {
            demo: ['main', 'render_ui_components', 'execute_current_action', 'clear_content', 'show_gamepad_display', 'handle_input', 'init_terminal', 'cleanup_terminal', 'get_actions', 'render_header', 'render_environment_line', 'render_mode_line', 'render_action_line', 'render_footer', 'run_standalone_repl'],
            input: ['handle_input', 'init_terminal', 'cleanup_terminal', 'read_input', 'process_key', 'gamepad_mode', 'repl_mode', 'switch_input_mode', 'validate_input', 'handle_navigation', 'handle_selection', 'handle_action', 'update_state', 'refresh_display', 'handle_escape', 'handle_enter', 'handle_arrow_keys', 'toggle_content_mode', 'cycle_environment', 'cycle_mode', 'cycle_action', 'get_input_mode', 'set_input_mode'],
            output: ['render_display', 'show_gamepad_display', 'render_dynamic_footer', 'format_footer_combined', 'show_action_catalog', 'show_action_info', 'generate_section_separator', 'ui_env_label', 'ui_env_selected', 'ui_env_other', 'ui_mode_label', 'ui_mode_selected', 'ui_mode_other', 'ui_action_label', 'render_equation', 'render_action_verb_noun', 'render_response_type', 'reset_color'],
            repl: ['run_repl_loop', 'get_repl_prompt', 'handle_repl_input', 'process_repl_command', 'repl_help', 'repl_status', 'repl_exit', 'repl_env', 'repl_mode', 'repl_fire', 'repl_list'],
            nouns_verbs: ['get_mode_verbs', 'get_env_nouns', 'get_action_description', 'refresh_color_state', 'init_noun_verb_system', 'validate_verb', 'validate_noun', 'get_verb_list', 'get_noun_list', 'map_verb_to_function', 'execute_verb_noun_action'],
            top_status: ['render_top_status', 'format_status_line', 'get_system_info', 'get_time_info', 'render_status_bar', 'update_status', 'show_connection_status', 'format_breadcrumb'],
            enhanced_signatures: ['get_function_signature'],
            tetra_framework: ['tetra_init', 'tetra_subscribe', 'tetra_publish', 'tetra_set_state', 'tetra_get_state', 'tetra_register_component', 'tetra_render_component', 'tetra_render_data', '_render_terminal', '_render_html', '_render_json', '_render_terminal_table', '_render_terminal_list', '_render_terminal_card', '_render_html_table', '_render_html_list', '_render_html_card', 'log_tetra', 'module_card_component', 'tetra_demo', '_demo_state_handler'],
            local_ast: ['generate_local_ast', 'determine_local_type', 'has_local_tview_integration', 'extract_local_functions', 'is_local_function_exported', 'extract_local_dependencies', 'show_local_modules', 'show_local_web']
        };

        const templates = functionTemplates[moduleName] || ['init', 'process', 'render', 'update', 'validate', 'handle', 'execute', 'format'];
        const functions = [];

        for (let i = 0; i < count; i++) {
            const template = templates[i % templates.length];
            const suffix = i >= templates.length ? `_${Math.floor(i / templates.length) + 1}` : '';
            functions.push({
                name: `${template}${suffix}`,
                line: Math.floor(Math.random() * 500) + 1,
                exported: Math.random() > 0.7,
                signature: this.generateFunctionSignature(`${template}${suffix}`)
            });
        }
        return functions;
    }

    generateFunctionSignature(functionName) {
        const signatures = {
            'main': 'main()',
            'init': 'init(config)',
            'render': 'render(data, target)',
            'process': 'process(input)',
            'handle': 'handle(event, context)',
            'execute': 'execute(action, params)',
            'validate': 'validate(input) -> boolean',
            'format': 'format(data, options)',
            'update': 'update(state, changes)',
            'get': 'get(key) -> value',
            'set': 'set(key, value)',
            'show': 'show(element, options)',
            'hide': 'hide(element)',
            'toggle': 'toggle(element)',
            'cycle': 'cycle(array, index)'
        };

        for (const [pattern, sig] of Object.entries(signatures)) {
            if (functionName.includes(pattern)) {
                return sig.replace(pattern, functionName);
            }
        }

        return `${functionName}(...)`;
    }

    generateVariables(count) {
        const variables = [];
        const types = ['string', 'array', 'integer', 'boolean'];
        for (let i = 0; i < count; i++) {
            variables.push({
                name: `VAR_${i + 1}`,
                type: types[Math.floor(Math.random() * types.length)],
                scope: Math.random() > 0.5 ? 'global' : 'local'
            });
        }
        return variables;
    }

    getFallbackData() {
        return {
            modules: {
                demo: { type: 'core', functions: [], variables: [], lines: 0, complexity: 'unknown' }
            }
        };
    }

    updateStats() {
        if (!this.moduleData) return;

        const modules = this.moduleData.modules;
        const moduleEntries = Object.entries(modules);

        // Calculate totals
        const totalModules = moduleEntries.length;
        const totalFunctions = moduleEntries.reduce((sum, [, module]) => sum + module.functions.length, 0);
        const coreModules = moduleEntries.filter(([, module]) => module.type === 'core').length;
        const testModules = moduleEntries.filter(([, module]) => module.type === 'test').length;

        // Update DOM
        document.getElementById('totalModules').textContent = totalModules;
        document.getElementById('totalFunctions').textContent = totalFunctions;
        document.getElementById('coreModules').textContent = coreModules;
        document.getElementById('testModules').textContent = testModules;

        // Update header stats
        document.getElementById('headerStats').innerHTML = `
            <span class="stat-item">${totalModules} Modules</span>
            <span class="stat-item">${totalFunctions} Functions</span>
            <span class="stat-item">${coreModules} Core Components</span>
        `;
    }

    updateModuleTypes() {
        if (!this.moduleData) return;

        const modules = this.moduleData.modules;
        const typeCounts = {};

        // Count modules by type
        Object.values(modules).forEach(module => {
            typeCounts[module.type] = (typeCounts[module.type] || 0) + 1;
        });

        // Update DOM
        const container = document.getElementById('moduleTypes');
        container.innerHTML = Object.entries(typeCounts)
            .sort(([,a], [,b]) => b - a)
            .map(([type, count]) => `
                <div class="module-type-item ${type}">
                    <span class="module-type-name">${type}</span>
                    <span class="module-type-count">${count}</span>
                </div>
            `).join('');
    }

    setupEventListeners() {
        // Navigation buttons are handled by onclick attributes in HTML
        // This method can be extended for more complex interactions

        // Add keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.altKey) {
                switch(e.key) {
                    case '1': this.switchView('summary'); e.preventDefault(); break;
                    case '2': this.switchView('modules'); e.preventDefault(); break;
                    case '3': this.switchView('tests'); e.preventDefault(); break;
                    case '4': this.switchView('architecture'); e.preventDefault(); break;
                }
            }
        });

        // Window message listener for iframe communication
        window.addEventListener('message', (event) => {
            this.handleIframeMessage(event);
        });
    }

    switchView(viewName) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

        // Update iframe source
        const iframe = document.getElementById('contentFrame');
        const newSrc = this.getIframeSrc(viewName);

        if (iframe.src !== newSrc) {
            iframe.classList.add('loading');
            iframe.src = newSrc;

            iframe.onload = () => {
                iframe.classList.remove('loading');
                this.postDataToIframe();
            };
        }

        this.currentView = viewName;
        console.log(`Switched to view: ${viewName}`);
    }

    getIframeSrc(viewName) {
        const baseUrl = 'iframes/';
        switch(viewName) {
            case 'summary': return `${baseUrl}summary.iframe.html`;
            case 'modules': return `${baseUrl}modules.iframe.html`;
            case 'tests': return `${baseUrl}tests.iframe.html`;
            case 'architecture': return `${baseUrl}architecture.iframe.html`;
            default: return `${baseUrl}summary.iframe.html`;
        }
    }

    postDataToIframe() {
        const iframe = document.getElementById('contentFrame');
        if (iframe.contentWindow && this.moduleData) {
            iframe.contentWindow.postMessage({
                type: 'MODULE_DATA',
                data: this.moduleData,
                view: this.currentView
            }, '*');
        }
    }

    handleIframeMessage(event) {
        const { type, data } = event.data;

        switch(type) {
            case 'REQUEST_DATA':
                this.postDataToIframe();
                break;
            case 'MODULE_SELECTED':
                this.handleModuleSelection(data);
                break;
            case 'VIEW_CHANGE_REQUEST':
                this.switchView(data.view);
                break;
            default:
                console.log('Unknown message type:', type);
        }
    }

    handleModuleSelection(moduleData) {
        console.log('Module selected:', moduleData);
        // Could update sidebar with module-specific information
        // Could highlight related modules
        // Could show detailed metrics
    }

    // Public API for console debugging
    getModuleData() {
        return this.moduleData;
    }

    getStats() {
        if (!this.moduleData) return null;

        const modules = Object.values(this.moduleData.modules);
        return {
            totalModules: modules.length,
            totalFunctions: modules.reduce((sum, m) => sum + m.functions.length, 0),
            totalVariables: modules.reduce((sum, m) => sum + m.variables.length, 0),
            totalLines: modules.reduce((sum, m) => sum + m.lines, 0),
            avgComplexity: this.calculateAvgComplexity(modules),
            typeDistribution: this.getTypeDistribution(modules)
        };
    }

    calculateAvgComplexity(modules) {
        const complexityMap = { low: 1, medium: 2, high: 3 };
        const total = modules.reduce((sum, m) => sum + (complexityMap[m.complexity] || 1), 0);
        const avg = total / modules.length;

        if (avg <= 1.3) return 'low';
        if (avg <= 2.3) return 'medium';
        return 'high';
    }

    getTypeDistribution(modules) {
        const distribution = {};
        modules.forEach(module => {
            distribution[module.type] = (distribution[module.type] || 0) + 1;
        });
        return distribution;
    }
}

// Global functions for HTML onclick handlers
function switchView(viewName) {
    if (window.dashboard) {
        window.dashboard.switchView(viewName);
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new TetraDashboard();

    // Make dashboard available in console for debugging
    window.tetra = window.dashboard;

    console.log('Dashboard loaded. Use window.tetra for debugging.');
});