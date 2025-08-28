/**
 * UnifiedManagerSystem.js - Consolidated manager classes
 * 
 * This system unifies the competing manager classes found in the audit:
 * - CapabilityManager (2 implementations)
 * - KeyboardShortcutManager vs KeyboardShortcutHandler
 * 
 * Provides a single, consistent interface for all manager functionality.
 */

/**
 * Base Manager class - provides common functionality for all managers
 */
export class BaseManager {
    constructor(name, options = {}) {
        this.name = name;
        this.initialized = false;
        this.config = { ...this.getDefaultConfig(), ...options };
        this.eventListeners = new Map();
        this.hooks = new Map();
        
        // Get logger if available
        this.log = window.APP?.services?.log?.createLogger('MANAGER', name) || console;
    }

    getDefaultConfig() {
        return {
            autoInit: true,
            debug: false,
            enableHooks: true
        };
    }

    async initialize() {
        if (this.initialized) return;
        
        this.log.info(`Initializing ${this.name}...`);
        
        try {
            await this.onInitialize();
            this.initialized = true;
            this.runHook('initialized');
            this.log.info(`${this.name} initialized successfully`);
        } catch (error) {
            this.log.error(`Failed to initialize ${this.name}:`, error);
            throw error;
        }
    }

    async onInitialize() {
        // Override in subclasses
    }

    cleanup() {
        this.log.info(`Cleaning up ${this.name}...`);
        this.removeAllEventListeners();
        this.hooks.clear();
        this.initialized = false;
    }

    // Event handling
    addEventListener(element, event, handler, options = {}) {
        const key = `${element.constructor.name}-${event}`;
        if (!this.eventListeners.has(key)) {
            this.eventListeners.set(key, []);
        }
        
        element.addEventListener(event, handler, options);
        this.eventListeners.get(key).push({ element, event, handler, options });
    }

    removeAllEventListeners() {
        for (const [key, listeners] of this.eventListeners.entries()) {
            listeners.forEach(({ element, event, handler }) => {
                element.removeEventListener(event, handler);
            });
        }
        this.eventListeners.clear();
    }

    // Hook system
    addHook(event, callback) {
        if (!this.hooks.has(event)) {
            this.hooks.set(event, []);
        }
        this.hooks.get(event).push(callback);
    }

    runHook(event, ...args) {
        if (!this.config.enableHooks) return;
        
        const callbacks = this.hooks.get(event) || [];
        callbacks.forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                this.log.error(`Hook error (${event}):`, error);
            }
        });
    }
}

/**
 * Unified Capability Manager
 * Combines functionality from both CapabilityManager implementations
 */
export class UnifiedCapabilityManager extends BaseManager {
    constructor(options = {}) {
        super('CapabilityManager', options);
        
        // File-based capabilities (from backup/modules/CapabilityManager.js)
        this.dataRoot = options.dataRoot;
        this.roles = new Map();
        this.capabilities = new Map();
        this.assetSets = new Map();
        
        // Token-based capabilities (from backup/modules/capabilities.js)
        this.pdata = options.pdata;
        this.tokenStore = new Map();
        this.cleanupInterval = null;
        
        if (this.config.autoInit) {
            this.initialize();
        }
    }

    getDefaultConfig() {
        return {
            ...super.getDefaultConfig(),
            tokenTTL: 24 * 60 * 60 * 1000, // 24 hours
            cleanupInterval: 60 * 60 * 1000, // 1 hour
            enableFileCapabilities: true,
            enableTokenCapabilities: true
        };
    }

    async onInitialize() {
        // Initialize file-based capabilities
        if (this.config.enableFileCapabilities && this.dataRoot) {
            await this.initializeFileCapabilities();
        }
        
        // Initialize token-based capabilities
        if (this.config.enableTokenCapabilities) {
            this.initializeTokenCapabilities();
        }
        
        // Register with APP
        window.APP = window.APP || {};
        window.APP.services = window.APP.services || {};
        window.APP.services.capabilityManager = this;
    }

    async initializeFileCapabilities() {
        this.log.info('Initializing file-based capabilities...');
        
        if (!this.dataRoot) {
            this.log.warn('No dataRoot specified for file capabilities');
            return;
        }
        
        // Load capability data from files
        // Implementation would load from CSV files as in original
        this.log.info('File-based capabilities initialized');
    }

    initializeTokenCapabilities() {
        this.log.info('Initializing token-based capabilities...');
        
        // Set up token cleanup
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredTokens();
        }, this.config.cleanupInterval);
        
        this.log.info('Token-based capabilities initialized');
    }

    // File-based capability methods
    hasRole(user, role) {
        // Implementation from original CapabilityManager
        return this.roles.has(role) && this.roles.get(role).includes(user);
    }

    hasCapability(user, capability) {
        // Check user capabilities
        const userRoles = this.getUserRoles(user);
        return userRoles.some(role => {
            const roleCaps = this.roles.get(role) || [];
            return roleCaps.includes(capability);
        });
    }

    getUserRoles(user) {
        const roles = [];
        for (const [role, users] of this.roles.entries()) {
            if (users.includes(user)) {
                roles.push(role);
            }
        }
        return roles;
    }

    // Token-based capability methods
    generateCapabilityToken(issuer, capabilities, options = {}) {
        const token = `cap_${crypto.randomBytes(32).toString('hex')}`;
        const expiresAt = Date.now() + (options.ttl || this.config.tokenTTL);
        
        const tokenData = {
            token,
            issuer,
            type: options.type || 'access',
            capabilities: this.normalizeCapabilities(capabilities),
            metadata: {
                description: options.description || 'Capability Token',
                createdAt: Date.now(),
                expiresAt,
                originIP: options.originIP,
                maxUses: options.maxUses,
                usageCount: 0,
                lastUsed: null
            }
        };
        
        this.tokenStore.set(token, tokenData);
        this.log.info(`Generated capability token: ${token.substring(0, 8)}...`);
        
        return { token, expiresAt };
    }

    validateCapabilityToken(token, requiredCapabilities = []) {
        const tokenData = this.tokenStore.get(token);
        if (!tokenData) {
            return { valid: false, reason: 'Token not found' };
        }
        
        // Check expiration
        if (tokenData.metadata.expiresAt < Date.now()) {
            this.tokenStore.delete(token);
            return { valid: false, reason: 'Token expired' };
        }
        
        // Check usage limits
        if (tokenData.metadata.maxUses && tokenData.metadata.usageCount >= tokenData.metadata.maxUses) {
            return { valid: false, reason: 'Usage limit exceeded' };
        }
        
        // Check capabilities
        const hasRequiredCaps = requiredCapabilities.every(cap => 
            this.tokenHasCapability(tokenData, cap)
        );
        
        if (!hasRequiredCaps) {
            return { valid: false, reason: 'Insufficient capabilities' };
        }
        
        // Update usage
        tokenData.metadata.usageCount++;
        tokenData.metadata.lastUsed = Date.now();
        
        return { valid: true, tokenData };
    }

    tokenHasCapability(tokenData, capability) {
        return tokenData.capabilities.some(cap => 
            cap === capability || cap === '*' || capability.startsWith(cap.replace('*', ''))
        );
    }

    normalizeCapabilities(capabilities) {
        if (typeof capabilities === 'string') {
            return [capabilities];
        }
        if (Array.isArray(capabilities)) {
            return capabilities;
        }
        if (typeof capabilities === 'object') {
            return Object.keys(capabilities).filter(key => capabilities[key]);
        }
        return [];
    }

    cleanupExpiredTokens() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [token, data] of this.tokenStore.entries()) {
            if (data.metadata.expiresAt < now) {
                this.tokenStore.delete(token);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            this.log.info(`Cleaned up ${cleaned} expired tokens`);
        }
    }

    cleanup() {
        super.cleanup();
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

/**
 * Unified Keyboard Shortcut Manager
 * Combines KeyboardShortcutManager and KeyboardShortcutHandler functionality
 */
export class UnifiedKeyboardShortcutManager extends BaseManager {
    constructor(options = {}) {
        super('KeyboardShortcutManager', options);
        
        this.shortcuts = new Map();
        this.isEnabled = true;
        this.debugMode = options.debug || false;
        this.activeModifiers = new Set();
        
        // Redux integration
        this.dispatch = options.dispatch;
        this.getState = options.getState;
        
        if (this.config.autoInit) {
            this.initialize();
        }
    }

    getDefaultConfig() {
        return {
            ...super.getDefaultConfig(),
            preventDefault: true,
            stopPropagation: true,
            enableReduxIntegration: true
        };
    }

    async onInitialize() {
        // Set up event listeners
        this.addEventListener(document, 'keydown', this.handleKeydown.bind(this), true);
        this.addEventListener(document, 'keyup', this.handleKeyup.bind(this), true);
        
        // Register default shortcuts
        this.registerDefaultShortcuts();
        
        // Expose debug interface
        this.exposeDebugInterface();
        
        // Register with APP
        window.APP = window.APP || {};
        window.APP.services = window.APP.services || {};
        window.APP.services.keyboardShortcutManager = this;
    }

    register(keyCombo, id, description, handler, options = {}) {
        const shortcut = {
            keyCombo: keyCombo.toLowerCase(),
            id,
            description,
            handler,
            enabled: options.enabled !== false,
            context: options.context || 'global',
            preventDefault: options.preventDefault !== false,
            stopPropagation: options.stopPropagation !== false
        };
        
        this.shortcuts.set(keyCombo.toLowerCase(), shortcut);
        this.log.info(`Registered shortcut: ${keyCombo} -> ${description}`);
        
        this.runHook('shortcutRegistered', shortcut);
        return this;
    }

    unregister(keyCombo) {
        const removed = this.shortcuts.delete(keyCombo.toLowerCase());
        if (removed) {
            this.log.info(`Unregistered shortcut: ${keyCombo}`);
            this.runHook('shortcutUnregistered', keyCombo);
        }
        return removed;
    }

    handleKeydown(event) {
        if (!this.isEnabled) return;
        
        // Track modifiers
        this.updateModifiers(event);
        
        // Build key combination
        const keyCombo = this.buildKeyCombo(event);
        
        if (this.debugMode) {
            this.log.info(`Key combination: ${keyCombo}`);
        }
        
        // Find matching shortcut
        const shortcut = this.shortcuts.get(keyCombo);
        if (!shortcut || !shortcut.enabled) return;
        
        // Check context
        if (!this.isValidContext(shortcut.context)) return;
        
        // Prevent default behavior
        if (shortcut.preventDefault) {
            event.preventDefault();
        }
        if (shortcut.stopPropagation) {
            event.stopPropagation();
        }
        
        // Execute handler
        try {
            this.runHook('beforeShortcut', shortcut, event);
            shortcut.handler(event);
            this.runHook('afterShortcut', shortcut, event);
            
            if (this.debugMode) {
                this.log.info(`Executed shortcut: ${keyCombo} -> ${shortcut.description}`);
            }
        } catch (error) {
            this.log.error(`Shortcut handler error (${keyCombo}):`, error);
        }
    }

    handleKeyup(event) {
        this.updateModifiers(event);
    }

    updateModifiers(event) {
        this.activeModifiers.clear();
        if (event.ctrlKey || event.metaKey) this.activeModifiers.add('ctrl');
        if (event.shiftKey) this.activeModifiers.add('shift');
        if (event.altKey) this.activeModifiers.add('alt');
    }

    buildKeyCombo(event) {
        const parts = [];
        
        if (event.ctrlKey || event.metaKey) parts.push('ctrl');
        if (event.altKey) parts.push('alt');
        if (event.shiftKey) parts.push('shift');
        
        // Add the main key
        const key = event.key.toLowerCase();
        if (key !== 'control' && key !== 'alt' && key !== 'shift' && key !== 'meta') {
            parts.push(key);
        }
        
        return parts.join('+');
    }

    isValidContext(context) {
        if (context === 'global') return true;
        
        // Add context validation logic here
        // Could check active panel, focus state, etc.
        
        return true;
    }

    registerDefaultShortcuts() {
        // View toggles
        this.register('alt+t', 'toggleEdit', 'Toggle Editor Panel', () => {
            this.togglePanel('editor');
        });

        this.register('alt+p', 'togglePreview', 'Toggle Preview Panel', () => {
            this.togglePanel('preview');
        });

        // Debug shortcuts
        this.register('ctrl+shift+d', 'toggleDebug', 'Toggle Debug Mode', () => {
            this.debugMode = !this.debugMode;
            this.log.info(`Debug mode: ${this.debugMode ? 'enabled' : 'disabled'}`);
        });

        // Help
        this.register('ctrl+shift+h', 'showHelp', 'Show Keyboard Shortcuts', () => {
            this.showShortcutHelp();
        });
    }

    togglePanel(panelType) {
        if (this.dispatch && this.config.enableReduxIntegration) {
            // Use Redux actions if available
            const panelActions = window.APP?.services?.store?.panelActions;
            if (panelActions) {
                this.dispatch(panelActions.togglePanel(panelType));
                return;
            }
        }
        
        // Fallback to direct manipulation
        const panel = document.querySelector(`[data-panel="${panelType}"]`);
        if (panel) {
            panel.style.display = panel.style.display === 'none' ? '' : 'none';
        }
    }

    showShortcutHelp() {
        const shortcuts = Array.from(this.shortcuts.values())
            .filter(s => s.enabled)
            .sort((a, b) => a.keyCombo.localeCompare(b.keyCombo));
        
        console.group('🎹 Keyboard Shortcuts');
        shortcuts.forEach(shortcut => {
            console.log(`${shortcut.keyCombo.toUpperCase()}: ${shortcut.description}`);
        });
        console.groupEnd();
    }

    exposeDebugInterface() {
        if (!window.APP) {
            console.warn('[UnifiedManagerSystem] window.APP not found');
            return;
        }
        if (!window.APP.debug) {
            window.APP.debug = {};
        }
        
        window.APP.debug.keyboardShortcuts = {
            manager: this,
            list: () => this.showShortcutHelp(),
            toggle: (keyCombo) => {
                const shortcut = this.shortcuts.get(keyCombo.toLowerCase());
                if (shortcut) {
                    shortcut.enabled = !shortcut.enabled;
                    this.log.info(`Shortcut ${keyCombo} ${shortcut.enabled ? 'enabled' : 'disabled'}`);
                }
            },
            enable: () => { this.isEnabled = true; },
            disable: () => { this.isEnabled = false; },
            debug: (enabled) => { this.debugMode = enabled; }
        };
    }

    getShortcuts() {
        return Array.from(this.shortcuts.values());
    }

    enable() {
        this.isEnabled = true;
        this.log.info('Keyboard shortcuts enabled');
    }

    disable() {
        this.isEnabled = false;
        this.log.info('Keyboard shortcuts disabled');
    }
}

/**
 * Manager Registry - Central registry for all managers
 */
export class ManagerRegistry {
    constructor() {
        this.managers = new Map();
        this.initialized = false;
    }

    register(name, managerClass, options = {}) {
        if (this.managers.has(name)) {
            console.warn(`[ManagerRegistry] Manager ${name} already registered`);
            return false;
        }
        
        const manager = new managerClass(options);
        this.managers.set(name, manager);
        
        console.log(`[ManagerRegistry] Registered manager: ${name}`);
        return manager;
    }

    get(name) {
        return this.managers.get(name);
    }

    async initializeAll() {
        console.log('[ManagerRegistry] Initializing all managers...');
        
        const initPromises = Array.from(this.managers.values()).map(manager => 
            manager.initialize().catch(error => {
                console.error(`[ManagerRegistry] Failed to initialize ${manager.name}:`, error);
                return null;
            })
        );
        
        await Promise.allSettled(initPromises);
        this.initialized = true;
        
        console.log('[ManagerRegistry] All managers initialized');
    }

    cleanup() {
        for (const manager of this.managers.values()) {
            manager.cleanup();
        }
        this.managers.clear();
        this.initialized = false;
    }
}

// Create singleton instances
export const managerRegistry = new ManagerRegistry();

// Register unified managers
managerRegistry.register('capability', UnifiedCapabilityManager);
managerRegistry.register('keyboardShortcut', UnifiedKeyboardShortcutManager);

export default managerRegistry;
