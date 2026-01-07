/**
 * @file bootstrap.js
 * @description Phase-based Dashboard Bootstrap System
 * Initializes dashboard components in a controlled, dependency-aware sequence
 * 
 * Phases:
 * 1. Pre-Initialization: Verify environment and dependencies
 * 2. Core Initialization: Initialize core managers (theme, logging, events)
 * 3. Secondary Initialization: Initialize dashboard components and iframes
 * 4. Finalization: Signal readiness and complete initialization
 */

// Bootstrap state management
let log;
let lifecycleStages = [];
let services = {};
let componentRegistry = new Map();
let failedComponents = new Set();
let bootErrors = [];

// Add this near the top of the file, after the existing log variable
// Fallback logger to ensure logging always works
window.Logger = window.Logger || window.APP.log || {
    info: (from, message, data) => {
        console.log(`[${from}] ${message}`, data || '');
    },
    warn: (from, message, data) => {
        console.warn(`[${from}] ${message}`, data || '');
    },
    error: (from, message, data) => {
        console.error(`[${from}] ${message}`, data || '');
    },
    debug: (from, message, data) => {
        console.debug(`[${from}] ${message}`, data || '');
    }
};

// Component definitions for the dashboard
const dashboardComponents = [
    {
        name: 'themeManager',
        type: 'service',
        priority: 1,
        required: true,
        dependencies: ['coreServices'],
        description: 'Theme management system',
        factory: () => {
            if (!window.APP.theme.Manager) {
                throw new Error('Theme Manager class not found - initialization may have failed');
            }
            
            const manager = new window.APP.theme.Manager();
            manager.init();
            window.APP.theme.managerInstance = manager;
            return manager;
        }
    },
    {
        name: 'iframeManager',
        type: 'service',
        priority: 2,
        required: true,
        dependencies: ['coreServices'],
        description: 'Iframe management system',
        factory: () => {
            if (!window.APP.iframes || !window.APP.iframes.Manager) {
                throw new Error('DevWatchIframer (APP.iframes.Manager) not found');
            }
            const manager = new APP.iframes.Manager('dynamic-sections');
            APP.iframes.managerInstance = manager;
            return manager;
        }
    },
    {
        name: 'dashboardClient',
        type: 'service',
        priority: 3,
        required: true,
        dependencies: ['coreServices', 'themeManager', 'iframeManager'],
        description: 'Dashboard client initialization',
        factory: () => {
            // Dashboard client will initialize itself via event system
            return { initialized: true };
        }
    }
];

// =============================================================================
// INITIALIZATION PHASES
// =============================================================================

async function bootPreInit() {
    console.log('🚀 Bootstrap Phase 1: Pre-Initialization');
    lifecycleStages.push('boot:start');
    
    // Verify APP namespace exists
    if (!window.APP || !window.APP.bootloaderRan) {
        throw new Error('APP namespace not properly initialized');
    }
    
    // Initialize logger if available
    if (window.APP.log) {
        log = {
            info: (stage, message, data) => window.APP.log.info(`frontend.bootstrap.${stage}`, message, data),
            warn: (stage, message, data) => window.APP.log.warn(`frontend.bootstrap.${stage}`, message, data),
            error: (stage, message, data) => window.APP.log.error(`frontend.bootstrap.${stage}`, message, data)
        };
    } else {
        // Fallback logger
        log = {
            info: (stage, message) => console.log(`[BOOTSTRAP.${stage}] ${message}`),
            warn: (stage, message) => console.warn(`[BOOTSTRAP.${stage}] ${message}`),
            error: (stage, message) => console.error(`[BOOTSTRAP.${stage}] ${message}`)
        };
    }
    
    log.info('PHASE_1', '🚀 Phase 1: Pre-Initialization');
    
    // Verify core dependencies
    await verifyCoreDependencies();
    
    // Initialize services registry
    services.eventBus = window.APP.events;
    services.logger = window.APP.log;
    
    // This is no longer needed as components initialize synchronously
    // await initializeWaitingComponents(); 
    
    log.info('PRE_INIT_COMPLETE', '✅ Pre-initialization complete');
}

async function bootCore() {
    log.info('PHASE_2', '📦 Phase 2: Core Initialization');
    lifecycleStages.push('boot:coreServicesReady');
    
    // Wait for DOM to be ready
    await waitDOMReady();
    
    // Initialize core components
    const coreComponents = dashboardComponents.filter(c => c.priority <= 2);
    await initializeComponents(coreComponents);
    
    log.info('CORE_COMPLETE', '✅ Core initialization complete');
    return { services };
}

async function bootSecondary({ services }) {
    log.info('PHASE_3', '🔧 Phase 3: Secondary Initialization');
    lifecycleStages.push('boot:secondarySystemsReady');
    
    // Initialize remaining components
    const secondaryComponents = dashboardComponents.filter(c => c.priority > 2);
    await initializeComponents(secondaryComponents);
    
    // Create iframe sections
    await createIframeSections();
    
    log.info('SECONDARY_COMPLETE', '✅ Secondary initialization complete');
}

async function bootFinalize() {
    log.info('PHASE_4', '🎯 Phase 4: Finalization');
    lifecycleStages.push('boot:complete');
    
    const successfulComponents = dashboardComponents.length - failedComponents.size;
    log.info('SUMMARY', `📊 Boot Summary: ${successfulComponents}/${dashboardComponents.length} components successful`);
    
    // Mark system as ready
    window.APP.initialized = true;
    if (!window.APP.bootloader) window.APP.bootloader = {};
    window.APP.bootloader.phase = 'ready';
    
    // Emit app:ready event - this is the key fix!
    if (window.APP.events) {
        log.info('APP_READY_EVENT', '🎉 Emitting app:ready event');
        window.APP.events.emit('app:ready');
    }
    
    log.info('APP_READY', '🎉 Dashboard application ready for use');
}

// =============================================================================
// COMPONENT MANAGEMENT
// =============================================================================

async function initializeComponents(components) {
    log.info('INIT_COMPONENTS', `🧩 Initializing ${components.length} components...`);
    
    // Sort by priority
    const sortedComponents = [...components].sort((a, b) => a.priority - b.priority);
    
    for (const component of sortedComponents) {
        if (failedComponents.has(component.name)) continue;
        
        try {
            await mountComponent(component);
        } catch (error) {
            log.error('COMPONENT_FAILED', `❌ Failed to initialize ${component.name}: ${error.message}`);
            failedComponents.add(component.name);
            
            if (component.required) {
                throw error;
            }
        }
    }
}

async function mountComponent(componentDef) {
    log.info('MOUNTING', `🔧 Mounting ${componentDef.name}...`);
    
    // Debug: Log current services state
    log.info('DEBUG_SERVICES', `Services available: ${Object.keys(services).join(', ')}`);
    log.info('DEBUG_DEPS', `Checking dependencies for ${componentDef.name}: ${(componentDef.dependencies || []).join(', ')}`);
    
    // Check dependencies
    if (!checkDependencies(componentDef.dependencies)) {
        throw new Error(`Dependencies not met for ${componentDef.name}`);
    }
    
    // Initialize component
    const component = await componentDef.factory();
    
    // Register component
    componentRegistry.set(componentDef.name, {
        definition: componentDef,
        instance: component,
        mounted: true
    });
    
    // Store in services if it's a service
    if (componentDef.type === 'service') {
        services[componentDef.name] = component;
        window.APP.services = window.APP.services || {};
        window.APP.services[componentDef.name] = component;
    }
    
    log.info('MOUNTED', `✅ Successfully mounted ${componentDef.name}`);
    return component;
}

function checkDependencies(dependencies = []) {
    for (const dep of dependencies) {
        if (dep === 'coreServices') {
            // Check that core services are available
            const hasEventBus = services.eventBus || window.APP.events;
            const hasLogger = services.logger || window.APP.log;
            
            if (!hasEventBus || !hasLogger) {
                // Use console.error as fallback if log isn't available
                const errorMsg = `Core services missing: eventBus=${!!hasEventBus}, logger=${!!hasLogger}`;
                if (log && log.error) {
                    log.error('DEPENDENCY_CHECK', errorMsg);
                } else {
                    console.error('[BOOTSTRAP.DEPENDENCY_CHECK]', errorMsg);
                }
                return false;
            }
            continue;
        }
        
        // Check for other component dependencies
        if (!componentRegistry.has(dep) && !services[dep]) {
            const errorMsg = `Dependency '${dep}' not found in registry or services`;
            if (log && log.error) {
                log.error('DEPENDENCY_CHECK', errorMsg);
            } else {
                console.error('[BOOTSTRAP.DEPENDENCY_CHECK]', errorMsg);
            }
            return false;
        }
    }
    return true;
}

// =============================================================================
// IFRAME SECTIONS CREATION
// =============================================================================

async function createIframeSections() {
    log.info('IFRAME_SECTIONS', '🖼️ Creating iframe sections...');
    
    const iframeManager = services.iframeManager;
    if (!iframeManager) {
        throw new Error('Iframe manager not available');
    }

    // Define iframe sections configuration
    const iframeSections = [
        {
            key: 'env-config',
            config: {
                id: 'env-config',
                title: 'System',
                icon: '📁',
                src: '/static/system.iframe.html',
                buttons: ['reload', 'edit', 'info', 'cli', 'launch']
            }
        },
        {
            key: 'api-helper',
            config: {
                id: 'api-helper',
                title: 'API Helper',
                icon: '🔌',
                src: '/static/api-helper.iframe.html',
                buttons: ['reload', 'edit', 'info', 'cli', 'launch']
            }
        },
        {
            key: 'tsv',
            config: {
                id: 'tsv',
                title: 'Playwright Command Builder',
                icon: '⚡',
                src: '/static/pcb.iframe.html',
                buttons: ['reload', 'edit', 'info', 'cli', 'launch'],
                iframeClass: 'iframe-container iframe-container-small'
            }
        },
        {
            key: 'command-runner',
            config: {
                id: 'command-runner',
                title: 'Command Runner',
                icon: '🎮',
                src: '/static/command-runner.iframe.html',
                buttons: ['reload', 'edit', 'info', 'cli', 'launch']
            }
        },
        {
            key: 'cron',
            config: {
                id: 'cron',
                title: 'Cron',
                icon: '⏰',
                src: '/static/cron.iframe.html',
                buttons: ['reload', 'edit', 'info', 'cli', 'launch']
            }
        },
        {
            key: 'tsm',
            config: {
                id: 'tsm',
                title: 'Test Suite Manager',
                icon: '🧪',
                src: '/static/tsm-standalone.html?iframe=true',
                buttons: ['reload', 'edit', 'info', 'cli', 'launch']
            }
        },
        {
            key: 'testing-matrix',
            config: {
                id: 'testing-matrix',
                title: 'Testing Matrix Dashboard',
                icon: '🧩',
                src: '/static/testing-matrix.iframe.html',
                buttons: ['reload', 'edit', 'info', 'cli', 'launch'],
                autoHeight: true
            }
        }
    ];
    
    // Create iframe sections using the manager
    let successCount = 0;
    let errorCount = 0;
    
    for (const { key, config } of iframeSections) {
        try {
            log.info('CREATE_IFRAME', `🔧 Creating iframe section: ${config.title}`);
            const instance = iframeManager.createIframe(config);
            if (instance) {
                successCount++;
                log.info('IFRAME_CREATED', `✅ Created: ${config.title}`);
            } else {
                throw new Error('IframeManager.createIframe returned null or undefined');
            }
        } catch (error) {
            errorCount++;
            log.error('IFRAME_FAILED', `❌ Failed to create iframe section: ${config.title}`, { error: error.message });
            // Don't fail the entire boot process for iframe creation failures
        }
    }
    
    log.info('IFRAME_SUMMARY', `📊 Iframe Summary: ${successCount}/${iframeSections.length} sections created`);
    
    // Emit dashboard-specific initialization event
    if (window.APP.events) {
        window.APP.events.emit('dashboard:initialized', {
            successCount,
            errorCount,
            totalSections: iframeSections.length,
            migrationErrors: window.APP.migrationHelper?.originalErrors?.length || 0
        });
    }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function waitDOMReady() {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        return Promise.resolve();
    }
    return new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve, { once: true });
    });
}

async function verifyCoreDependencies() {
    const requiredServices = [
        { name: 'APP.events', path: 'window.APP.events' },
        { name: 'APP.log', path: 'window.APP.log' }
    ];
    
    const missing = [];
    
    for (const service of requiredServices) {
        const exists = service.path.split('.').reduce((obj, prop) => obj && obj[prop], window);
        if (!exists) {
            missing.push(service.name);
        }
    }
    
    if (missing.length > 0) {
        throw new Error(`Missing required services: ${missing.join(', ')}`);
    }
}

// Error handling
function fail(error) {
    bootErrors.push(error);
    
    console.error('💥 Bootstrap failed:', error);
    
    // Create error display
    document.body.classList.add('boot-failed');
    let errorDiv = document.querySelector('.boot-error');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.className = 'boot-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            right: 20px;
            background: #1a1a1a;
            color: #ff4d4d;
            padding: 20px;
            border-radius: 8px;
            border: 2px solid #ff4d4d;
            z-index: 10000;
            font-family: monospace;
        `;
        document.body.appendChild(errorDiv);
    }
    
    const completedStages = lifecycleStages.join(' → ');
    const failedComponentsList = Array.from(failedComponents).join(', ') || 'None';
    
    errorDiv.innerHTML = `
        <h2 style="margin: 0 0 10px 0;">Dashboard Bootstrap Failed</h2>
        <p><strong>Error:</strong> ${error.message}</p>
        <p><strong>Completed stages:</strong> ${completedStages}</p>
        <p><strong>Failed components:</strong> ${failedComponentsList}</p>
        <details style="margin-top: 10px;">
            <summary style="cursor: pointer;">Stack Trace</summary>
            <pre style="margin-top: 10px; white-space: pre-wrap;">${error.stack || 'No stack trace available'}</pre>
        </details>
    `;
    
    // Emit failure event
    if (window.APP.events) {
        window.APP.events.emit('boot:failed', { 
            errors: bootErrors.map(e => e.message), 
            stages: lifecycleStages 
        });
    }
}

// =============================================================================
// MAIN BOOTSTRAP ORCHESTRATION
// =============================================================================

let initializationPromise = null;

async function initializeDashboard() {
    if (initializationPromise) return initializationPromise;
    
    initializationPromise = (async () => {
        try {
            await bootPreInit();
            const coreAPIs = await bootCore();
            await bootSecondary(coreAPIs);
            await bootFinalize();
            
            return { success: true, services };
        } catch (error) {
            fail(error);
            throw error;
        }
    })();
    
    return initializationPromise;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
} else {
    initializeDashboard();
}

console.log('📋 Phase-based Dashboard Bootstrap loaded');
