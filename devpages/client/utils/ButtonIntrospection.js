/**
 * Button Introspection System
 * Provides comprehensive debugging info when shift-clicking buttons
 * Logs Redux actions, event handlers, CSS info for designers and engineers
 * Cache bust: 2024-12-19-v2
 */

import { logMessage } from '/client/log/index.js';

class ButtonIntrospectionSystem {
    constructor() {
        this.isEnabled = true;
        this.introspectedButtons = new Map();
        this.init();
    }

    init() {
        // Add global shift-click listener with capture
        document.addEventListener('click', this.handleShiftClick.bind(this), true);
        
        // Also prevent context menu on shift+right-click
        document.addEventListener('contextmenu', this.handleContextMenu.bind(this), true);
        
        // Log system initialization
        logMessage('Button Introspection System initialized - Shift+Click any button for debug info', 'info', 'INTROSPECTION');
        logMessage('🔧 Debug interface: Type APP.debug.help() in console for system commands', 'info', 'INTROSPECTION');
    }

    handleShiftClick(event) {
        // Only handle Shift+Click (not Ctrl+Shift+Click)
        if (!event.shiftKey || event.ctrlKey || event.metaKey) return;
        
        const button = event.target.closest('button, .btn, [role="button"]');
        if (!button) return;
        
        // Prevent ALL default actions and system popups
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        this.introspectButton(button);
    }

    handleContextMenu(event) {
        // Prevent context menu when shift is held (for any click type)
        if (event.shiftKey) {
            const button = event.target.closest('button, .btn, [role="button"]');
            if (button) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                return false;
            }
        }
    }

    introspectButton(button) {
        // Get clean text without HTML entities
        const cleanText = button.textContent?.trim() || 'no-text';
        const buttonId = button.id || 'no-id';
        const buttonClasses = button.className || 'no-class';
        const action = button.dataset.action || 'no-action';
        
        // Build single comprehensive log message
        let logInfo = `🔍 BUTTON DEBUG:\n`;
        logInfo += `   Element: ${button.tagName}#${buttonId}\n`;
        logInfo += `   Classes: ${buttonClasses}\n`;
        logInfo += `   Text: ${cleanText}\n`;
        logInfo += `   Action: ${action}\n`;
        logInfo += `   Disabled: ${button.disabled}`;
        
        // Add DOM information
        const domInfo = this.getDOMInfo(button);
        if (domInfo.parent) {
            logInfo += `\n   Parent: ${domInfo.parent}`;
        }
        if (domInfo.position) {
            logInfo += `\n   Position: ${domInfo.position}`;
        }
        if (domInfo.size) {
            logInfo += `\n   Size: ${domInfo.size}`;
        }
        if (domInfo.visibility) {
            logInfo += `\n   Visibility: ${domInfo.visibility}`;
        }
        if (domInfo.zIndex && domInfo.zIndex !== 'auto') {
            logInfo += `\n   Z-Index: ${domInfo.zIndex}`;
        }
        if (domInfo.title) {
            logInfo += `\n   Title: ${domInfo.title}`;
        }
        if (domInfo.tabIndex) {
            logInfo += `\n   Tab Index: ${domInfo.tabIndex}`;
        }
        if (domInfo.hasListeners) {
            logInfo += `\n   Events: ${domInfo.hasListeners}`;
        }
        
        // Add source location if available
        const sourceInfo = this.getSourceLocation(button);
        if (sourceInfo) {
            logInfo += `\n   Source: ${sourceInfo}`;
        }
        
        // Add Redux associations if available
        try {
            const state = this.getReduxState();
            if (state && action !== 'no-action') {
                // Show Redux action mapping
                const reduxAction = this.getReduxActionMapping(action);
                if (reduxAction) {
                    logInfo += `\n   Redux Action: ${reduxAction}`;
                }
                
                // Show state slice info
                const sliceInfo = this.getStateSliceInfo(state, action);
                if (sliceInfo) {
                    logInfo += `\n   State Slice: ${sliceInfo.slice}.${sliceInfo.key} = ${sliceInfo.value}`;
                }
                
                // Show current relevant state
                const relevantState = this.getRelevantState(state, action);
                if (relevantState !== null && typeof relevantState !== 'object') {
                    logInfo += `\n   Current Value: ${relevantState}`;
                } else if (relevantState && typeof relevantState === 'object') {
                    logInfo += `\n   Related State: ${JSON.stringify(relevantState, null, 2)}`;
                }
            } else if (state) {
                logInfo += `\n   Redux: Store available, no action mapping`;
            } else {
                logInfo += `\n   Redux: No store found`;
            }
        } catch (error) {
            logInfo += `\n   Redux: Error accessing store`;
        }
        
        // Log everything as one entry
        logMessage(logInfo, 'info', 'INTROSPECTION');
        
        // Store for later reference
        const introspectionId = `introspection-${Date.now()}`;
        this.introspectedButtons.set(introspectionId, {
            button,
            timestamp: new Date().toISOString(),
            buttonId,
            cleanText,
            action
        });
    }

    getReduxState() {
        if (window.APP?.store?.getState) {
            return window.APP.store.getState();
        } else if (window.__REDUX_STORE__?.getState) {
            return window.__REDUX_STORE__.getState();
        } else if (window.store?.getState) {
            return window.store.getState();
        }
        return null;
    }

    getEventSummary(button) {
        const handlers = [];
        
        // Check for inline handlers
        if (button.onclick) handlers.push('onclick');
        if (button.onmousedown) handlers.push('onmousedown');
        if (button.onmouseup) handlers.push('onmouseup');
        
        // Check for data-action
        if (button.dataset.action) handlers.push(`data-action="${button.dataset.action}"`);
        
        return handlers.length > 0 ? handlers.join(', ') : 'none';
    }

    getRelevantState(state, action) {
        // Map common actions to relevant state
        const stateMap = {
            'toggleEdit': state.ui?.editorVisible,
            'togglePreview': state.ui?.previewVisible,
            'toggleLogVisibility': state.ui?.logVisible,
            'saveFile': { 
                currentFile: state.file?.currentFile?.pathname,
                isModified: state.file?.currentFile?.isModified 
            },
            'publish': state.auth?.isAuthenticated,
            'refreshPreview': state.file?.currentFile?.pathname,
            'toggleLeftSidebar': state.ui?.leftSidebarVisible,
            'toggleContextManager': state.ui?.contextManagerVisible
        };
        
        return stateMap[action] || null;
    }

    getReduxActionMapping(action) {
        // Map button actions to their Redux counterparts
        const actionMap = {
            'toggleEdit': 'uiActions.toggleEditorVisibility()',
            'togglePreview': 'uiActions.togglePreviewVisibility()',
            'toggleLogVisibility': 'uiActions.toggleLogVisibility()',
            'saveFile': 'fileThunks.saveFile()',
            'refreshPreview': 'previewActions.refresh()',
            'publish': 'publishActions.openModal()',
            'toggleLeftSidebar': 'uiActions.toggleLeftSidebar()',
            'toggleContextManager': 'uiActions.toggleContextManager()'
        };
        
        return actionMap[action] || null;
    }

    getStateSliceInfo(state, action) {
        // Determine which Redux slice this action affects
        const sliceMap = {
            'toggleEdit': { slice: 'ui', key: 'editorVisible' },
            'togglePreview': { slice: 'ui', key: 'previewVisible' },
            'toggleLogVisibility': { slice: 'ui', key: 'logVisible' },
            'saveFile': { slice: 'file', key: 'currentFile' },
            'refreshPreview': { slice: 'file', key: 'currentFile' },
            'publish': { slice: 'auth', key: 'isAuthenticated' },
            'toggleLeftSidebar': { slice: 'ui', key: 'leftSidebarVisible' },
            'toggleContextManager': { slice: 'ui', key: 'contextManagerVisible' }
        };
        
        const sliceInfo = sliceMap[action];
        if (sliceInfo && state[sliceInfo.slice]) {
            return {
                slice: sliceInfo.slice,
                key: sliceInfo.key,
                value: state[sliceInfo.slice][sliceInfo.key]
            };
        }
        
        return null;
    }

    getDOMInfo(button) {
        const info = {};
        
        try {
            // Parent information
            const parent = button.parentElement;
            if (parent) {
                const parentId = parent.id ? `#${parent.id}` : '';
                const parentClass = parent.className ? `.${parent.className.split(' ')[0]}` : '';
                info.parent = `${parent.tagName}${parentId}${parentClass}`;
            }
            
            // Position and size
            const rect = button.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(button);
            
            info.position = `${Math.round(rect.left)}, ${Math.round(rect.top)}`;
            info.size = `${Math.round(rect.width)}×${Math.round(rect.height)}`;
            
            // Visibility info
            const isVisible = rect.width > 0 && rect.height > 0 && computedStyle.visibility !== 'hidden' && computedStyle.display !== 'none';
            const isInViewport = rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
            
            info.visibility = `visible: ${isVisible}, in-viewport: ${isInViewport}`;
            
            // Z-index
            info.zIndex = computedStyle.zIndex;
            
            // Additional useful DOM properties
            if (button.tabIndex !== 0) {
                info.tabIndex = button.tabIndex;
            }
            
            if (button.title) {
                info.title = button.title;
            }
            
            // Check for event listeners (basic detection)
            const hasClickListener = button.onclick || button.addEventListener;
            if (hasClickListener) {
                info.hasListeners = 'click events detected';
            }
            
        } catch (error) {
            info.error = 'Could not get DOM info';
        }
        
        return info;
    }

    getSourceLocation(button) {
        try {
            // Try to get source location from various methods
            
            // Method 1: Check for data attributes that might indicate source
            if (button.dataset.source) {
                return button.dataset.source;
            }
            
            // Method 2: Look for component markers in classes or IDs
            const componentHints = this.getComponentHints(button);
            if (componentHints) {
                return componentHints;
            }
            
            // Method 3: Try to trace through DOM to find script tags or component roots
            const domTrace = this.traceDOMSource(button);
            if (domTrace) {
                return domTrace;
            }
            
            // Method 4: Check for React/framework component info
            const frameworkInfo = this.getFrameworkSource(button);
            if (frameworkInfo) {
                return frameworkInfo;
            }
            
            return null;
        } catch (error) {
            return null;
        }
    }

    getComponentHints(button) {
        // Look for common component naming patterns
        const id = button.id;
        const classes = button.className;
        
        // Check for component-like naming
        if (id) {
            if (id.includes('topbar') || id.includes('top-bar')) {
                return 'likely: client/components/topBar.js';
            }
            if (id.includes('sidebar') || id.includes('side-bar')) {
                return 'likely: client/components/sidebar.js';
            }
            if (id.includes('editor')) {
                return 'likely: client/components/editor.js';
            }
            if (id.includes('preview')) {
                return 'likely: client/components/topBar.js or preview.js';
            }
            if (id.includes('settings')) {
                return 'likely: client/settings/ or client/panels/';
            }
        }
        
        // Check parent containers for hints
        let parent = button.parentElement;
        let depth = 0;
        while (parent && depth < 5) {
            if (parent.id) {
                if (parent.id.includes('workspace')) {
                    return 'likely: client/layout/workspace.js';
                }
                if (parent.id.includes('panel')) {
                    return 'likely: client/panels/';
                }
            }
            parent = parent.parentElement;
            depth++;
        }
        
        return null;
    }

    traceDOMSource(button) {
        // Look for nearby script tags or comments that might indicate source
        const scripts = document.querySelectorAll('script[src]');
        
        // Check if button is in a container that might be dynamically created
        let parent = button.parentElement;
        while (parent) {
            // Look for data attributes that might indicate the creating script
            if (parent.dataset.component) {
                return `component: ${parent.dataset.component}`;
            }
            if (parent.dataset.module) {
                return `module: ${parent.dataset.module}`;
            }
            parent = parent.parentElement;
        }
        
        return null;
    }

    getFrameworkSource(button) {
        // Check for React fiber or other framework markers
        const reactKey = Object.keys(button).find(key => 
            key.startsWith('__reactInternalInstance') || 
            key.startsWith('_reactInternalFiber')
        );
        
        if (reactKey) {
            try {
                const fiber = button[reactKey];
                if (fiber && fiber._debugSource) {
                    const source = fiber._debugSource;
                    return `${source.fileName}:${source.lineNumber}`;
                }
                if (fiber && fiber.type && fiber.type.name) {
                    return `React component: ${fiber.type.name}`;
                }
            } catch (e) {
                // Ignore errors accessing React internals
            }
            return 'React component (source unavailable)';
        }
        
        // Check for Vue
        if (button.__vue__ || button._vnode) {
            return 'Vue component (source unavailable)';
        }
        
        return null;
    }

    getBasicButtonInfo(button) {
        return {
            id: button.id || 'no-id',
            className: button.className || 'no-classes',
            tagName: button.tagName,
            textContent: button.textContent?.trim() || 'no-text',
            title: button.title || 'no-title',
            disabled: button.disabled,
            type: button.type || 'button',
            dataAction: button.dataset.action || 'no-data-action',
            innerHTML: button.innerHTML.substring(0, 100) + (button.innerHTML.length > 100 ? '...' : '')
        };
    }

    getReduxInfo(button) {
        const dataAction = button.dataset.action;
        
        // Try to get Redux state from various possible store locations
        let state = null;
        let storeLocation = 'None';
        
        if (window.APP?.store?.getState) {
            state = window.APP.store.getState();
            storeLocation = 'window.APP.store';
        } else if (window.__REDUX_STORE__?.getState) {
            state = window.__REDUX_STORE__.getState();
            storeLocation = 'window.__REDUX_STORE__';
        } else if (window.store?.getState) {
            state = window.store.getState();
            storeLocation = 'window.store';
        }
        
        const info = {
            storeLocation: storeLocation,
            stateAvailable: !!state,
            currentState: state ? {
                ui: state.ui || {},
                auth: state.auth || {},
                file: state.file || {},
                path: state.path || {}
            } : 'No Redux state available',
            dataAction: dataAction,
            possibleActions: [],
            relatedThunks: []
        };
        
        // Map common data-actions to Redux actions
        const actionMappings = {
            'toggleEdit': 'uiActions.toggleEditorVisibility()',
            'togglePreview': 'uiActions.togglePreviewVisibility()',
            'toggleLogVisibility': 'uiActions.toggleLogVisibility()',
            'saveFile': 'fileThunks.saveFile()',
            'refreshPreview': 'topBarController.refreshPreview()',
            'publish': 'publishModal.open()'
        };
        
        if (dataAction && actionMappings[dataAction]) {
            info.possibleActions.push(actionMappings[dataAction]);
        }
        
        // Check for TopBarController actions
        if (window.topBarController?.actionHandlers) {
            const handlers = Array.from(window.topBarController.actionHandlers.keys());
            info.topBarActions = handlers;
            
            if (dataAction && handlers.includes(dataAction)) {
                info.handlerFound = true;
                info.handlerType = 'TopBarController';
            }
        }
        
        return info;
    }

    getEventHandlerInfo(button) {
        const info = {
            eventListeners: [],
            inlineHandlers: {},
            dataAttributes: {}
        };
        
        // Check for inline event handlers
        ['onclick', 'onmousedown', 'onmouseup', 'onkeydown', 'onkeyup'].forEach(handler => {
            if (button[handler]) {
                info.inlineHandlers[handler] = button[handler].toString().substring(0, 200) + '...';
            }
        });
        
        // Check data attributes
        Array.from(button.attributes).forEach(attr => {
            if (attr.name.startsWith('data-')) {
                info.dataAttributes[attr.name] = attr.value;
            }
        });
        
        // Try to detect event listeners (limited by browser security)
        try {
            const listeners = getEventListeners ? getEventListeners(button) : {};
            info.eventListeners = Object.keys(listeners);
        } catch (e) {
            info.eventListeners = ['Cannot access - use DevTools Console'];
        }
        
        return info;
    }

    getCSSInfo(button) {
        const computed = getComputedStyle(button);
        const info = {
            classes: Array.from(button.classList),
            computedStyles: {
                display: computed.display,
                position: computed.position,
                backgroundColor: computed.backgroundColor,
                borderColor: computed.borderColor,
                border: computed.border,
                color: computed.color,
                fontSize: computed.fontSize,
                padding: computed.padding,
                margin: computed.margin,
                zIndex: computed.zIndex,
                cursor: computed.cursor,
                transition: computed.transition,
                transform: computed.transform
            },
            cssVariables: {},
            matchingSelectors: []
        };
        
        // Check CSS variables
        const cssVars = [
            '--color-bg-alt', '--color-border-hover', '--color-primary',
            '--color-success', '--color-warning', '--color-error'
        ];
        
        cssVars.forEach(varName => {
            const value = computed.getPropertyValue(varName);
            if (value) {
                info.cssVariables[varName] = value.trim();
            }
        });
        
        // Try to find matching CSS selectors
        try {
            const sheets = Array.from(document.styleSheets);
            sheets.forEach(sheet => {
                try {
                    const rules = sheet.cssRules || sheet.rules;
                    if (rules) {
                        Array.from(rules).forEach(rule => {
                            if (rule.selectorText && button.matches && button.matches(rule.selectorText)) {
                                info.matchingSelectors.push({
                                    selector: rule.selectorText,
                                    stylesheet: sheet.href?.split('/').pop() || 'inline'
                                });
                            }
                        });
                    }
                } catch (e) {
                    // CORS issues with external stylesheets
                }
            });
        } catch (e) {
            info.matchingSelectors = ['Cannot access - CORS restrictions'];
        }
        
        return info;
    }

    getAccessibilityInfo(button) {
        return {
            role: button.getAttribute('role') || 'button',
            ariaLabel: button.getAttribute('aria-label') || 'none',
            ariaDescribedBy: button.getAttribute('aria-describedby') || 'none',
            ariaPressed: button.getAttribute('aria-pressed') || 'none',
            ariaExpanded: button.getAttribute('aria-expanded') || 'none',
            tabIndex: button.tabIndex,
            focusable: button.tabIndex >= 0 && !button.disabled,
            keyboardAccessible: !button.disabled
        };
    }

    getPerformanceInfo(button) {
        const rect = button.getBoundingClientRect();
        return {
            boundingBox: {
                width: rect.width,
                height: rect.height,
                top: rect.top,
                left: rect.left
            },
            isVisible: rect.width > 0 && rect.height > 0,
            isInViewport: rect.top >= 0 && rect.left >= 0 && 
                         rect.bottom <= window.innerHeight && 
                         rect.right <= window.innerWidth,
            renderingCost: this.estimateRenderingCost(button)
        };
    }

    estimateRenderingCost(button) {
        const computed = getComputedStyle(button);
        let cost = 'low';
        
        // Factors that increase rendering cost
        if (computed.boxShadow !== 'none') cost = 'medium';
        if (computed.borderRadius !== '0px') cost = 'medium';
        if (computed.transform !== 'none') cost = 'high';
        if (computed.filter !== 'none') cost = 'high';
        if (computed.backdropFilter !== 'none') cost = 'very-high';
        
        return cost;
    }

    logSection(title, data) {
        logMessage(title, 'info', 'INTROSPECTION');
        logMessage(JSON.stringify(data, null, 2), 'info', 'INTROSPECTION');
        logMessage('', 'info', 'INTROSPECTION'); // Empty line for readability
    }

    // Public API for manual introspection
    introspectById(buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
            this.introspectButton(button);
        } else {
            logMessage(`Button with ID '${buttonId}' not found`, 'error', 'INTROSPECTION');
        }
    }

    getIntrospectionHistory() {
        return Array.from(this.introspectedButtons.entries());
    }

    enable() {
        this.isEnabled = true;
        logMessage('Button Introspection System enabled', 'info', 'INTROSPECTION');
    }

    disable() {
        this.isEnabled = false;
        logMessage('Button Introspection System disabled', 'info', 'INTROSPECTION');
    }

    getEnhancedDebugInfo(button) {
        const info = {};
        
        // Deep DOM analysis
        info['DOM Hierarchy'] = this.getDOMHierarchy(button);
        
        // React/Framework detection
        info['Framework Info'] = this.getFrameworkInfo(button);
        
        // State management connections
        info['State Connections'] = this.getStateConnections(button);
        
        // Memory usage
        info['Memory Info'] = this.getMemoryInfo(button);
        
        // Network activity
        info['Network Activity'] = this.getNetworkActivity(button);
        
        return info;
    }

    getDOMHierarchy(button) {
        const hierarchy = [];
        let current = button;
        let depth = 0;
        
        while (current && depth < 10) {
            hierarchy.push({
                tagName: current.tagName,
                id: current.id || 'none',
                className: current.className || 'none',
                depth: depth
            });
            current = current.parentElement;
            depth++;
        }
        
        return hierarchy;
    }

    getFrameworkInfo(button) {
        const info = {};
        
        // React detection
        const reactKey = Object.keys(button).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('_reactInternalFiber'));
        info['React Detected'] = !!reactKey;
        
        // Vue detection
        info['Vue Detected'] = !!(button.__vue__ || button._vnode);
        
        // Angular detection
        info['Angular Detected'] = !!(button.ng || button.__ngContext__);
        
        return info;
    }

    getStateConnections(button) {
        const connections = {};
        
        // Check for Redux connections
        if (window.__REDUX_DEVTOOLS_EXTENSION__) {
            connections['Redux DevTools'] = 'Available';
        }
        
        // Check for data attributes that might indicate state
        const dataAttrs = Array.from(button.attributes)
            .filter(attr => attr.name.startsWith('data-'))
            .map(attr => `${attr.name}="${attr.value}"`);
        
        connections['Data Attributes'] = dataAttrs.length > 0 ? dataAttrs : 'None';
        
        return connections;
    }

    getMemoryInfo(button) {
        const info = {};
        
        if (performance && performance.memory) {
            info['Used JS Heap Size'] = `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)} MB`;
            info['Total JS Heap Size'] = `${Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)} MB`;
            info['JS Heap Size Limit'] = `${Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)} MB`;
        } else {
            info['Memory Info'] = 'Not available in this browser';
        }
        
        return info;
    }

    getNetworkActivity(button) {
        const info = {};
        
        // Check for recent network activity
        if (performance && performance.getEntriesByType) {
            const recentRequests = performance.getEntriesByType('resource')
                .filter(entry => Date.now() - entry.startTime < 5000) // Last 5 seconds
                .length;
            
            info['Recent Network Requests'] = recentRequests;
        }
        
        // Check for fetch/XHR listeners
        const hasNetworkListeners = !!(button.onclick && button.onclick.toString().includes('fetch')) ||
                                   !!(button.onclick && button.onclick.toString().includes('XMLHttpRequest'));
        
        info['Network Listeners Detected'] = hasNetworkListeners;
        
        return info;
    }
}

// Create global instance
const buttonIntrospection = new ButtonIntrospectionSystem();

// Export for use in other modules
export { buttonIntrospection };

// Make available globally for console access
window.buttonIntrospection = buttonIntrospection;

logMessage('🔍 Button Introspection System loaded - Shift+Click (standard) or Ctrl+Shift+Click (enhanced) any button for debug info', 'info', 'INTROSPECTION');
