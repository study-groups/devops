/**
import { appStore } from "/client/appState.js";
 * DomInspectorSettings.js - Settings panel for DOM Inspector configuration
 * 
 * Provides configuration options for:
 * - Z-index display and management
 * - DOM tree node annotations
 * - Stacking context visualization
 * - Visual debugging options
 */

import { appStore } from "/client/appState.js";
// REMOVED: messageQueue import (file deleted)
import { zIndexManager } from "/client/utils/ZIndexManager.js";

export class DomInspectorSettings {
    constructor(domInspector) {
        this.domInspector = domInspector;
        this.panel = null;
        this.isVisible = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        
        // Configuration state
        this.config = {
            showZIndex: true,
            showStackingContext: true,
            showComputedZIndex: false,
            showZIndexLayer: true,
            annotationMode: 'compact', // compact, detailed, minimal
            showBreadcrumbAnnotations: true,
            visualDebugging: false,
            highlightStackingContexts: false,
            showZIndexTooltips: true,
            groupByStackingContext: false,
            highlightColor: '#448AFF',
            highlightZIndex: 999999,
        };
        
        try {
            this.createPanel();
            this.setupEventHandlers();
            this.loadConfiguration();
            // Skip ZIndexManager registration in constructor - will register when panel is shown
        } catch (error) {
            console.error('[DomInspectorSettingsPanel] Error during initialization:', error);
            console.error('[DomInspectorSettingsPanel] Stack trace:', error.stack);
            // Ensure panel is null if initialization failed
            if (this.panel && this.panel.nodeType !== Node.ELEMENT_NODE) {
                this.panel = null;
            }
        }
    }

    registerWithZIndexManager() {
        // Register with Z-Index Manager for click-to-front behavior
        if (!zIndexManager) {
            console.log('[DomInspectorSettingsPanel] ZIndexManager not available, skipping registration');
            return;
        }
        
        // Validate panel before registration
        if (!this.panel) {
            console.warn('[DomInspectorSettingsPanel] Panel is null/undefined, skipping ZIndexManager registration');
            return;
        }
        
        if (typeof this.panel !== 'object' || this.panel.constructor === Object) {
            console.warn('[DomInspectorSettingsPanel] Panel is not a DOM element (appears to be plain object), skipping ZIndexManager registration. Panel:', this.panel);
            return;
        }
        
        if (!this.panel.nodeType || this.panel.nodeType !== Node.ELEMENT_NODE) {
            console.warn('[DomInspectorSettingsPanel] Panel does not have valid nodeType, skipping ZIndexManager registration. NodeType:', this.panel.nodeType);
            return;
        }
        
        try {
            zIndexManager.register(this.panel, {
                type: 'popup',
                name: 'DOM Inspector Settings',
                bringToFrontOnClick: true
            });
            console.log('[DomInspectorSettingsPanel] Successfully registered with ZIndexManager');
        } catch (error) {
            console.warn('[DomInspectorSettingsPanel] Failed to register with ZIndexManager:', error);
        }
    }

    createPanel() {
        try {
            this.panel = document.createElement('div');
            // Verify panel was created correctly
            if (!this.panel || this.panel.nodeType !== Node.ELEMENT_NODE) {
                throw new Error('Failed to create panel DOM element');
            }
        this.panel.className = 'dom-inspector-settings-panel base-popup';
        this.panel.style.cssText = `
            top: 100px;
            right: 50px;
            width: 320px;
            height: auto;
            max-height: 80vh;
            display: none;
            font-size: 13px;
            overflow: hidden;
        `;

        // Header
        const header = document.createElement('div');
        header.className = 'settings-header';
        header.style.cssText = `
            padding: 12px 16px;
            background: var(--color-background-secondary, #f8fafc);
            border-bottom: 1px solid var(--color-border, #e2e8f0);
            font-weight: 600;
            cursor: grab;
            user-select: none;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <span style="color: var(--color-foreground-primary, #1e293b);">DOM Inspector Settings</span>
            <button class="close-btn" style="
                background: none;
                border: none;
                font-size: 16px;
                cursor: pointer;
                padding: 0;
                width: 20px;
                height: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                color: var(--color-foreground-muted, #64748b);
            ">×</button>
        `;

        // Content container
        const content = document.createElement('div');
        content.className = 'settings-content';
        content.style.cssText = `
            padding: 16px;
            max-height: calc(80vh - 60px);
            overflow-y: auto;
            background: var(--color-background-primary, #ffffff);
            color: var(--color-foreground, #1e293b);
        `;

        // Z-Index Display Section
        const zIndexSection = this.createSection('Z-Index Display', [
            this.createCheckbox('showZIndex', 'Show Z-Index Values', 'Display z-index values on DOM tree nodes'),
            this.createCheckbox('showComputedZIndex', 'Show Computed Z-Index', 'Show effective z-index values (resolving auto)'),
            this.createCheckbox('showZIndexLayer', 'Show Z-Index Layer', 'Display which layer the element belongs to (UI, POPUP, etc.)'),
            this.createCheckbox('showZIndexTooltips', 'Z-Index Tooltips', 'Show detailed z-index info on hover')
        ]);

        // Stacking Context Section
        const stackingSection = this.createSection('Stacking Context', [
            this.createCheckbox('showStackingContext', 'Show Stacking Context', 'Highlight elements that create stacking contexts'),
            this.createCheckbox('highlightStackingContexts', 'Visual Highlighting', 'Add visual indicators for stacking contexts'),
            this.createCheckbox('groupByStackingContext', 'Group by Context', 'Group DOM tree nodes by their stacking context parent')
        ]);

        // Annotation Mode Section
        const annotationSection = this.createSection('Tree Annotations', [
            this.createRadioGroup('annotationMode', 'Annotation Detail Level', [
                { value: 'minimal', label: 'Minimal', description: 'Show only essential info' },
                { value: 'compact', label: 'Compact', description: 'Balanced view with key details' },
                { value: 'detailed', label: 'Detailed', description: 'Show all available information' }
            ]),
            this.createCheckbox('showBreadcrumbAnnotations', 'Show Breadcrumb Annotations', 'Display element details in the breadcrumb trail')
        ]);

        // Visual Cursor Section
        const visualCursorSection = this.createSection('Visual Cursor', [
            this.createColorInput('highlightColor', 'Highlight Color', 'Set the color of the element highlight overlay.'),
            this.createNumberInput('highlightZIndex', 'Highlight Z-Index', 'Set the z-index of the element highlight overlay.'),
        ]);

        // Visual Debugging Section
        const debugSection = this.createSection('Visual Debugging', [
            this.createCheckbox('visualDebugging', 'Enable Visual Debug Mode', 'Show visual overlays for all z-index managed elements'),
            this.createButton('Export Z-Index Config', 'Export current z-index configuration', () => this.exportZIndexConfig()),
            this.createButton('Analyze Stacking Issues', 'Detect potential z-index conflicts', () => this.analyzeStackingIssues()),
            this.createButton('Reset Z-Index Manager', 'Clear all managed elements', () => this.resetZIndexManager())
        ]);

        // Statistics Section
        const statsSection = this.createSection('Statistics', [
            this.createStatsDisplay()
        ]);

        content.appendChild(zIndexSection);
        content.appendChild(visualCursorSection);
        content.appendChild(stackingSection);
        content.appendChild(annotationSection);
        content.appendChild(debugSection);
        content.appendChild(statsSection);

        this.panel.appendChild(header);
        this.panel.appendChild(content);
        document.body.appendChild(this.panel);

        // Store references
        this.header = header;
        this.content = content;
        this.closeBtn = header.querySelector('.close-btn');
        
        // Final verification that panel is still valid
        if (!this.panel || this.panel.nodeType !== Node.ELEMENT_NODE) {
            throw new Error('Panel was corrupted during creation process');
        }
        } catch (error) {
            console.error('[DomInspectorSettingsPanel] Error during panel creation:', error);
            // Set panel to null so we know it failed
            this.panel = null;
            throw error;
        }
    }

    createSection(title, controls) {
        const section = document.createElement('div');
        section.className = 'settings-section';
        section.style.cssText = `
            margin-bottom: 20px;
            border: 1px solid var(--color-border, #e2e8f0);
            border-radius: 6px;
            overflow: hidden;
        `;

        const header = document.createElement('div');
        header.className = 'section-header';
        header.style.cssText = `
            padding: 8px 12px;
            background: var(--color-background-secondary, #f8fafc);
            border-bottom: 1px solid var(--color-border, #e2e8f0);
            font-weight: 500;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--color-foreground-secondary, #475569);
        `;
        header.textContent = title;

        const content = document.createElement('div');
        content.className = 'section-content';
        content.style.cssText = `
            padding: 12px;
            background: var(--color-background-primary, #ffffff);
            color: var(--color-foreground, #1e293b);
        `;

        controls.forEach(control => {
            if (control) content.appendChild(control);
        });

        section.appendChild(header);
        section.appendChild(content);
        return section;
    }

    createCheckbox(key, label, description) {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: flex-start;
            margin-bottom: 12px;
            gap: 8px;
        `;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `setting-${key}`;
        checkbox.checked = this.config[key];
        checkbox.style.cssText = `
            margin-top: 2px;
            flex-shrink: 0;
        `;

        const labelContainer = document.createElement('div');
        labelContainer.style.cssText = `
            flex: 1;
            cursor: pointer;
        `;

        const labelEl = document.createElement('label');
        labelEl.htmlFor = `setting-${key}`;
        labelEl.textContent = label;
        labelEl.style.cssText = `
            display: block;
            font-weight: 500;
            cursor: pointer;
            margin-bottom: 2px;
            color: var(--color-foreground, #1e293b);
        `;

        const descEl = document.createElement('div');
        descEl.textContent = description;
        descEl.style.cssText = `
            font-size: 11px;
            color: var(--color-foreground-muted, #64748b);
            line-height: 1.4;
        `;

        labelContainer.appendChild(labelEl);
        labelContainer.appendChild(descEl);
        container.appendChild(checkbox);
        container.appendChild(labelContainer);

        // Event handler
        checkbox.addEventListener('change', (e) => {
            this.config[key] = e.target.checked;
            this.applyConfiguration();
            this.saveConfiguration();
        });

        labelContainer.addEventListener('click', () => {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change'));
        });

        return container;
    }

    createRadioGroup(key, label, options) {
        const container = document.createElement('div');
        container.style.cssText = `
            margin-bottom: 12px;
        `;

        const labelEl = document.createElement('div');
        labelEl.textContent = label;
        labelEl.style.cssText = `
            font-weight: 500;
            margin-bottom: 8px;
        `;

        const optionsContainer = document.createElement('div');
        optionsContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 6px;
        `;

        options.forEach(option => {
            const optionContainer = document.createElement('div');
            optionContainer.style.cssText = `
                display: flex;
                align-items: flex-start;
                gap: 8px;
            `;

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = `setting-${key}`;
            radio.value = option.value;
            radio.checked = this.config[key] === option.value;
            radio.style.cssText = `
                margin-top: 2px;
                flex-shrink: 0;
            `;

            const optionLabel = document.createElement('div');
            optionLabel.style.cssText = `
                flex: 1;
                cursor: pointer;
            `;

            const optionTitle = document.createElement('div');
            optionTitle.textContent = option.label;
            optionTitle.style.cssText = `
                font-weight: 500;
                margin-bottom: 2px;
            `;

            const optionDesc = document.createElement('div');
            optionDesc.textContent = option.description;
            optionDesc.style.cssText = `
                font-size: 11px;
                color: var(--color-foreground-muted, #64748b);
                line-height: 1.4;
            `;

            optionLabel.appendChild(optionTitle);
            optionLabel.appendChild(optionDesc);
            optionContainer.appendChild(radio);
            optionContainer.appendChild(optionLabel);
            optionsContainer.appendChild(optionContainer);

            // Event handlers
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.config[key] = option.value;
                    this.applyConfiguration();
                    this.saveConfiguration();
                }
            });

            optionLabel.addEventListener('click', () => {
                radio.checked = true;
                radio.dispatchEvent(new Event('change'));
            });
        });

        container.appendChild(labelEl);
        container.appendChild(optionsContainer);
        return container;
    }

    createButton(text, description, onClick) {
        const container = document.createElement('div');
        container.style.cssText = `
            margin-bottom: 12px;
        `;

        const button = document.createElement('button');
        button.textContent = text;
        button.style.cssText = `
            width: 100%;
            padding: 8px 12px;
            background: var(--color-primary, #3b82f6);
            color: var(--color-primary-foreground, #ffffff);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
            transition: background-color 0.2s;
        `;

        const descEl = document.createElement('div');
        descEl.textContent = description;
        descEl.style.cssText = `
            font-size: 11px;
            color: var(--color-foreground-muted, #64748b);
            margin-top: 4px;
            line-height: 1.4;
        `;

        button.addEventListener('click', onClick);
        button.addEventListener('mouseenter', () => {
            button.style.backgroundColor = 'var(--color-primary-hover, #2563eb)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.backgroundColor = 'var(--color-primary, #3b82f6)';
        });

        container.appendChild(button);
        container.appendChild(descEl);
        return container;
    }

    createStatsDisplay() {
        const container = document.createElement('div');
        container.className = 'stats-display';
        container.style.cssText = `
            font-family: var(--font-family-mono, 'Monaco', 'Menlo', monospace);
            font-size: 11px;
            background: var(--color-background-secondary, #f8fafc);
            padding: 12px;
            border-radius: 4px;
            border: 1px solid var(--color-border, #e2e8f0);
        `;

        this.updateStats();
        return container;
    }

    updateStats() {
        const statsContainer = this.panel.querySelector('.stats-display');
        if (!statsContainer) return;

        const stats = zIndexManager ? zIndexManager.getStats() : {
            managedElements: 0,
            activePopups: 0,
            stackingContexts: 0,
            layers: {},
            highestZIndex: 0
        };

        statsContainer.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px; color: var(--color-foreground-primary, #1e293b);">
                Z-Index Manager Statistics
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                <div>Managed Elements: <strong>${stats.managedElements}</strong></div>
                <div>Active Popups: <strong>${stats.activePopups}</strong></div>
                <div>Stacking Contexts: <strong>${stats.stackingContexts}</strong></div>
                <div>Highest Z-Index: <strong>${stats.highestZIndex}</strong></div>
            </div>
            <div style="margin-bottom: 8px; font-weight: 500;">Layer Distribution:</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 10px;">
                ${Object.entries(stats.layers).map(([layer, count]) => 
                    `<div>${layer}: <strong>${count}</strong></div>`
                ).join('')}
            </div>
        `;
    }

    setupEventHandlers() {
        // Close button
        this.closeBtn.addEventListener('click', () => this.hide());

        // Dragging
        this.header.addEventListener('mousedown', (e) => this.startDrag(e));
        document.addEventListener('mousemove', (e) => this.doDrag(e));
        document.addEventListener('mouseup', () => this.endDrag());

        // Update stats periodically
        setInterval(() => {
            if (this.isVisible) {
                this.updateStats();
            }
        }, 2000);

        // Listen for z-index changes
        document.addEventListener('zIndexChange', () => {
            if (this.isVisible) {
                this.updateStats();
            }
        });
    }

    startDrag(e) {
        if (e.target.tagName === 'BUTTON') return;
        this.isDragging = true;
        const rect = this.panel.getBoundingClientRect();
        this.dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        this.header.style.cursor = 'grabbing';
    }

    doDrag(e) {
        if (!this.isDragging) return;
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        this.panel.style.left = `${x}px`;
        this.panel.style.top = `${y}px`;
    }

    endDrag() {
        if (!this.isDragging) return;
        this.isDragging = false;
        this.header.style.cursor = 'grab';
    }

    show() {
        this.isVisible = true;
        this.panel.style.display = 'block';
        this.updateStats();
        
        // Register with Z-Index Manager
        if (zIndexManager) {
            zIndexManager.registerPopup(this.panel, {
                name: 'DOM Inspector Settings',
                priority: 10
            });
        }
    }

    hide() {
        this.isVisible = false;
        this.panel.style.display = 'none';
        
        // Unregister from Z-Index Manager
        if (zIndexManager) {
            zIndexManager.unregister(this.panel);
        }
    }

    toggle() {
        this.isVisible ? this.hide() : this.show();
    }

    applyConfiguration() {
        console.log('DOM Inspector Settings: Applying configuration', this.config);
        
        // Apply visual debugging
        if (zIndexManager) {
            zIndexManager.setVisualDebugging(this.config.visualDebugging);
        }

        // Update DOM Inspector annotations
        if (this.domInspector) {
            this.domInspector.updateAnnotationSettings(this.config);

            const highlightSettings = this.domInspector.stateManager.getState().highlight;
            this.domInspector.stateManager.setHighlight({
                ...highlightSettings,
                color: this.config.highlightColor,
                zIndex: this.config.highlightZIndex,
            });
        }

        // Note: Tree rebuild is now handled by updateAnnotationSettings with state preservation
        // No need to call buildTree() here anymore
        
        console.log('DOM Inspector Settings: Configuration applied');
    }

    saveConfiguration() {
        // Skip localStorage saving - only use deep links or session state
    }

    loadConfiguration() {
        // Skip localStorage loading - only honor deep links or use defaults
        
        // Load highlight settings from state manager if available
        if (this.domInspector) {
            const highlightSettings = this.domInspector.stateManager.getState().highlight;
            this.config.highlightColor = highlightSettings.color || '#448AFF';
            this.config.highlightZIndex = highlightSettings.zIndex || 999999;
        }

        this.updateFormValues();
        this.applyConfiguration();
    }

    updateFormValues() {
        // Update checkboxes
        Object.keys(this.config).forEach(key => {
            const checkbox = this.panel.querySelector(`#setting-${key}`);
            if (checkbox && checkbox.type === 'checkbox') {
                checkbox.checked = this.config[key];
            }
        });

        // Update custom inputs (color, number)
        const colorInput = this.panel.querySelector(`#setting-highlightColor`);
        if(colorInput) colorInput.value = this.config.highlightColor;
        const numberInput = this.panel.querySelector(`#setting-highlightZIndex`);
        if(numberInput) numberInput.value = this.config.highlightZIndex;

        // Update radio buttons
        const radioGroups = ['annotationMode'];
        radioGroups.forEach(group => {
            const radios = this.panel.querySelectorAll(`input[name="setting-${group}"]`);
            radios.forEach(radio => {
                radio.checked = radio.value === this.config[group];
            });
        });
    }

    exportZIndexConfig() {
        if (!zIndexManager) {
            alert('Z-Index Manager not available');
            return;
        }

        const config = zIndexManager.exportConfiguration();
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `z-index-config-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    analyzeStackingIssues() {
        if (!zIndexManager) {
            alert('Z-Index Manager not available');
            return;
        }

        const issues = [];
        const stats = zIndexManager.getStats();
        
        // Check for potential conflicts
        if (stats.highestZIndex > 100000) {
            issues.push('Extremely high z-index values detected (>100000)');
        }
        
        if (stats.managedElements > 50) {
            issues.push('Large number of managed elements may impact performance');
        }

        // Check for layer violations
        Object.entries(stats.layers).forEach(([layer, count]) => {
            if (count > 20) {
                issues.push(`High element count in ${layer} layer (${count} elements)`);
            }
        });

        const message = issues.length > 0 
            ? `Potential Issues Found:\n\n${issues.join('\n')}\n\nConsider reviewing z-index usage and layer organization.`
            : 'No obvious stacking issues detected. Z-index usage appears well-organized.';
            
        alert(message);
    }

    resetZIndexManager() {
        if (!zIndexManager) {
            alert('Z-Index Manager not available');
            return;
        }

        const confirmed = confirm(
            'This will reset the Z-Index Manager and remove all managed elements. ' +
            'Original z-index values will be restored where possible. Continue?'
        );
        
        if (confirmed) {
            // Get all managed elements and unregister them
            const managedElements = Array.from(zIndexManager.managedElements.keys());
            managedElements.forEach(element => {
                zIndexManager.unregister(element);
            });
            
            this.updateStats();
            alert('Z-Index Manager has been reset.');
        }
    }

    destroy() {
        // Unregister from Z-Index Manager
        if (zIndexManager && this.panel) {
            zIndexManager.unregister(this.panel);
        }
        
        if (this.panel) {
            this.panel.remove();
            this.panel = null;
        }
    }

    createColorInput(key, label, description) {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        `;
    
        const labelContainer = document.createElement('div');
        labelContainer.style.flex = '1';
    
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = `
            font-weight: 500;
            color: var(--color-foreground, #1e293b);
        `;
    
        const descEl = document.createElement('div');
        descEl.textContent = description;
        descEl.style.cssText = `
            font-size: 11px;
            color: var(--color-foreground-muted, #64748b);
            line-height: 1.4;
        `;
    
        labelContainer.appendChild(labelEl);
        labelContainer.appendChild(descEl);
    
        const colorInput = document.createElement('input');
        colorInput.type = 'color';
        colorInput.id = `setting-${key}`;
        colorInput.value = this.config[key];
        colorInput.style.cssText = `
            width: 40px;
            height: 24px;
            border: 1px solid var(--color-border, #e2e8f0);
            border-radius: 4px;
            cursor: pointer;
            padding: 2px;
        `;
    
        colorInput.addEventListener('input', (e) => {
            this.config[key] = e.target.value;
            this.applyConfiguration();
            this.saveConfiguration();
        });
    
        container.appendChild(labelContainer);
        container.appendChild(colorInput);
        return container;
    }

    createNumberInput(key, label, description) {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 12px;
        `;
    
        const labelContainer = document.createElement('div');
        labelContainer.style.flex = '1';
    
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = `
            font-weight: 500;
            color: var(--color-foreground, #1e293b);
        `;
    
        const descEl = document.createElement('div');
        descEl.textContent = description;
        descEl.style.cssText = `
            font-size: 11px;
            color: var(--color-foreground-muted, #64748b);
            line-height: 1.4;
        `;
    
        labelContainer.appendChild(labelEl);
        labelContainer.appendChild(descEl);
    
        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.id = `setting-${key}`;
        numberInput.value = this.config[key];
        numberInput.style.cssText = `
            width: 80px;
            padding: 4px 8px;
            border: 1px solid var(--color-border, #e2e8f0);
            border-radius: 4px;
            font-size: 12px;
        `;
    
        numberInput.addEventListener('change', (e) => {
            this.config[key] = parseInt(e.target.value, 10);
            this.applyConfiguration();
            this.saveConfiguration();
        });
    
        container.appendChild(labelContainer);
        container.appendChild(numberInput);
        return container;
    }
} 