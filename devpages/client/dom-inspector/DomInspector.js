/**
 * @file DomInspector.js
 * @description The core logic for the DOM Inspector.
 */
import { appStore } from '/client/appState.js';
import { DomInspectorSettingsPanel } from './DomInspectorSettingsPanel.js';

export class DomInspector {
  constructor(options = {}) {
    this.options = options;
    this.container = options.container;
    this.id = 'dom-inspector';
    this.label = 'DOM';
    this.inspector = null;
    this.settingsPanel = null;
    // The original init() call is removed. The new wrapper will handle initialization.
  }

  init() {
    this.createElement();
    this.createInspector();
    this.createSettingsPanel();
    this.setupEventHandlers();
    this.hide();
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.id = 'dom-inspector-panel';
    this.element.className = 'panel';
    // The container is now passed in during mount, not construction.
  }

  createInspector() {
    // This logic will be moved to onMount to ensure the element exists.
  }
  
  createSettingsPanel() {
    // This logic will also be moved to onMount.
  }

  setupEventHandlers() {
    // any event handlers for the panel itself
  }

  show() {
    this.element.dataset.visible = 'true';
    if(this.inspector) {
      this.inspector.show();
    }
  }

  hide() {
    this.element.dataset.visible = 'false';
    if(this.inspector) {
      this.inspector.hide();
    }
  }

  destroy() {
    if (this.inspector) {
      this.inspector.destroy();
    }
    if (this.settingsPanel) {
      this.settingsPanel.destroy();
    }
    if (this.element) {
        this.element.remove();
    }
  }
}
