/**
import { appStore } from "/client/appState.js";
 * ThemeSelectorPanel.js - Theme, Scheme, and Variant Selection Panel
 * REFACTORED to use the new PanelInterface.
 */
import { BasePanel } from '/client/panels/BasePanel.js';
import { appStore } from '/client/appState.js';
// REMOVED: messageQueue import (file deleted)
import { ActionTypes } from '/client/messaging/actionTypes.js';

export class ThemeSelectorPanel extends BasePanel {
  constructor(options) {
    super(options);
    
    this.availableThemes = [];
    this.currentTheme = null;
    this.mdDir = null;
    
    this.themeSettings = {
      colorScheme: 'system',
      themeVariant: 'light',
      spacingDensity: 'normal',
      currentTheme: null,
    };
  }

  render() {
    this.element = document.createElement('div');
    this.element.className = 'theme-selector-panel';
    this.element.innerHTML = this.renderConsolidatedInterface();
    return this.element;
  }

  async onMount(container) {
    super.onMount(container);
    this.loadCurrentSettings();
    await this.loadAvailableThemes();
    this.applyCurrentSettings();
    this.setupEventListeners();
  }
  
  onStateChange(state) {
      const designTokens = state.settings?.designTokens || {};
      const newSettings = {
          colorScheme: state.ui?.colorScheme || 'system',
          themeVariant: designTokens.themeVariant || 'light',
          spacingDensity: designTokens.spacingVariant || 'normal',
          currentTheme: designTokens.activeTheme || 'system'
      };
      
      const themeSettingsChanged = (
          this.themeSettings.colorScheme !== newSettings.colorScheme ||
          this.themeSettings.themeVariant !== newSettings.themeVariant ||
          this.themeSettings.spacingDensity !== newSettings.spacingDensity ||
          this.themeSettings.currentTheme !== newSettings.currentTheme
      );
      
      if (themeSettingsChanged) {
          this.themeSettings = newSettings;
          this.applyCurrentSettings();
          this.element.innerHTML = this.renderConsolidatedInterface();
      }
  }

  loadCurrentSettings() {
    const state = appStore.getState();
    const designTokens = state.settings?.designTokens || {};
    
    this.themeSettings.colorScheme = state.ui?.colorScheme || 'system';
    this.themeSettings.themeVariant = designTokens.themeVariant || 'light';
    this.themeSettings.spacingDensity = designTokens.spacingVariant || 'normal';
    this.themeSettings.currentTheme = designTokens.activeTheme || 'system';
  }

  async loadAvailableThemes() {
    try {
      const configResponse = await window.APP.services.globalFetch('/api/config');
      this.mdDir = 'unknown';
      if (configResponse.ok) {
        const config = await configResponse.json();
        this.mdDir = config.MD_DIR || 'unknown';
      }

      this.availableThemes = [...this.getDefaultThemes()];

      const response = await fetch(`/api/files/list?pathname=themes`, { credentials: 'include' });
      
      if (response.ok) {
        const data = await response.json();
        const themeOrder = ['basic', 'classic', 'arcade'];
        const userThemes = [];
        
        if (data.dirs) {
          for (const themeName of themeOrder) {
            if (data.dirs.includes(themeName)) {
              const themeInfo = await this.validateThemeDirectory(themeName);
              if (themeInfo) {
                themeInfo.type = 'user';
                userThemes.push(themeInfo);
              }
            }
          }
          
          for (const dirName of data.dirs) {
            if (!themeOrder.includes(dirName)) {
              const themeInfo = await this.validateThemeDirectory(dirName);
              if (themeInfo) {
                themeInfo.type = 'user';
                userThemes.push(themeInfo);
              }
            }
          }
          this.availableThemes.push(...userThemes);
        }
      }
    } catch (error) {
      console.warn('[ThemeSelector] Error loading themes:', error);
      this.availableThemes = this.getDefaultThemes();
    }
  }
  
  // ... (The rest of the methods from the original class, like renderConsolidatedInterface, setupEventListeners, etc.)
  // ... but without the init, constructor, and handleStoreUpdate methods.
}
