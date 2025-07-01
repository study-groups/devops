/**
 * ContextManagerPanel.js
 * Manages collections of files as named contexts
 */
import { appStore } from '/client/appState.js';
import { globalFetch } from '/client/globalFetch.js';

class ContextManager {
  constructor() {
    this.currentContext = null;
    this.availableContexts = [];
    this.baseDir = 'notepads/topic';
    this.contextConfigPath = `${this.baseDir}/contexts.json`;
    
    this.loadContexts();
  }
  
  async loadContexts() {
    try {
      // Use the files API directly to read the config file
      const response = await globalFetch('/api/files/content', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: this.contextConfigPath })
      });
      
      if (response.ok) {
        const content = await response.text();
        if (content) {
          const config = JSON.parse(content);
          this.availableContexts = config.contexts || [];
          this.currentContext = config.currentContext || null;
        } else {
          // Create default config if none exists
          await this.saveContexts();
        }
      } else if (response.status === 404) {
        // Create default config if file doesn't exist
        await this.saveContexts();
      }
    } catch (error) {
      console.error('Failed to load contexts:', error);
      // Create default config on error
      await this.saveContexts();
    }
    
    return {
      currentContext: this.currentContext,
      availableContexts: this.availableContexts
    };
  }
  
  async saveContexts() {
    try {
      const configData = {
        currentContext: this.currentContext,
        contexts: this.availableContexts,
        lastUpdated: new Date().toISOString()
      };
      
      // Use the files API directly to write the config file
      const response = await globalFetch('/api/files/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathname: this.contextConfigPath,
          content: JSON.stringify(configData, null, 2)
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Failed to save contexts:', error);
      return false;
    }
  }
  
  async setCurrentContext(contextName) {
    const context = this.availableContexts.find(c => c.name === contextName);
    if (!context) return false;
    
    this.currentContext = contextName;
    await this.saveContexts();
    
    // Update app state
    appStore.dispatch({ 
      type: 'SET_CURRENT_CONTEXT', 
      payload: { 
        name: contextName,
        files: context.files
      }
    });
    
    return true;
  }
  
  async createContext(contextName, files) {
    if (!contextName || !files || !Array.isArray(files)) {
      return false;
    }
    
    // Check if context already exists
    if (this.availableContexts.some(c => c.name === contextName)) {
      return false;
    }
    
    const newContext = {
      name: contextName,
      files: files,
      created: new Date().toISOString()
    };
    
    this.availableContexts.push(newContext);
    await this.saveContexts();
    
    return true;
  }
  
  async updateContext(contextName, files) {
    const contextIndex = this.availableContexts.findIndex(c => c.name === contextName);
    if (contextIndex === -1) return false;
    
    this.availableContexts[contextIndex].files = files;
    this.availableContexts[contextIndex].updated = new Date().toISOString();
    
    await this.saveContexts();
    return true;
  }
  
  async deleteContext(contextName) {
    const initialLength = this.availableContexts.length;
    this.availableContexts = this.availableContexts.filter(c => c.name !== contextName);
    
    if (this.availableContexts.length < initialLength) {
      // If we deleted the current context, reset it
      if (this.currentContext === contextName) {
        this.currentContext = this.availableContexts.length > 0 ? 
          this.availableContexts[0].name : null;
      }
      
      await this.saveContexts();
      return true;
    }
    
    return false;
  }
  
  // List files in a directory using PData's listDirectory
  async listFiles(directory) {
    try {
      const response = await globalFetch('/api/files/list', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: directory })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.files || [];
      }
      return [];
    } catch (error) {
      console.error(`Failed to list files in ${directory}:`, error);
      return [];
    }
  }
  
  // Read file content using PData's readFile
  async readFile(filePath) {
    try {
      const response = await globalFetch('/api/files/content', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pathname: filePath })
      });
      
      if (response.ok) {
        return await response.text();
      }
      return null;
    } catch (error) {
      console.error(`Failed to read file ${filePath}:`, error);
      return null;
    }
  }
  
  // Write file content using PData's writeFile
  async writeFile(filePath, content) {
    try {
      const response = await globalFetch('/api/files/save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pathname: filePath,
          content: content
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error(`Failed to write file ${filePath}:`, error);
      return false;
    }
  }
}

// Singleton instance
let contextManagerInstance = null;

export function getContextManager() {
  if (!contextManagerInstance) {
    contextManagerInstance = new ContextManager();
  }
  return contextManagerInstance;
}

export class ContextManagerPanel {
  constructor(container) {
    this.container = container;
    this.contextManager = getContextManager();
    
    this.render();
    this.attachEventListeners();
  }
  
  async render() {
    const { currentContext, availableContexts } = await this.contextManager.loadContexts();
    
    this.container.innerHTML = `
      <div class="settings-section-container">
        <div class="settings-section">
          <h3>Current Context</h3>
          <div class="settings-row">
            <input type="text" id="current-context-input" class="settings-input" 
              value="${currentContext || ''}" placeholder="No context selected" readonly>
            <button id="select-context-btn" class="settings-button settings-button--primary">
              Select
            </button>
          </div>
        </div>
        
        <div class="settings-section">
          <h3>Available Contexts</h3>
          <div class="contexts-list">
            ${this.renderContextsList(availableContexts, currentContext)}
          </div>
          <div class="settings-actions">
            <button id="create-context-btn" class="settings-button">
              Create New Context
            </button>
          </div>
        </div>
      </div>
    `;
  }
  
  renderContextsList(contexts, currentContext) {
    if (!contexts || contexts.length === 0) {
      return `<div class="empty-contexts">No contexts available. Create one to get started.</div>`;
    }
    
    return contexts.map(context => `
      <div class="context-item ${context.name === currentContext ? 'active' : ''}">
        <div class="context-info">
          <div class="context-name">${context.name}</div>
          <div class="context-path">${this.contextManager.baseDir}</div>
        </div>
        <div class="context-actions">
          ${context.name === currentContext ? 
            `<button class="context-action-btn" disabled>Current</button>` :
            `<button class="context-action-btn use-context-btn" data-context="${context.name}">Use</button>`
          }
          <button class="context-action-btn" data-context="${context.name}">Edit</button>
          <button class="context-action-btn delete-context-btn" data-context="${context.name}">Delete</button>
        </div>
      </div>
    `).join('');
  }
  
  attachEventListeners() {
    // Select context button
    const selectContextBtn = this.container.querySelector('#select-context-btn');
    if (selectContextBtn) {
      selectContextBtn.addEventListener('click', () => this.showContextSelector());
    }
    
    // Create context button
    const createContextBtn = this.container.querySelector('#create-context-btn');
    if (createContextBtn) {
      createContextBtn.addEventListener('click', () => this.showCreateContextModal());
    }
    
    // Use context buttons
    const useContextBtns = this.container.querySelectorAll('.use-context-btn');
    useContextBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const contextName = btn.getAttribute('data-context');
        this.useContext(contextName);
      });
    });
    
    // Delete context buttons
    const deleteContextBtns = this.container.querySelectorAll('.delete-context-btn');
    deleteContextBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const contextName = btn.getAttribute('data-context');
        this.deleteContext(contextName);
      });
    });
  }
  
  async useContext(contextName) {
    const success = await this.contextManager.setCurrentContext(contextName);
    if (success) {
      this.render();
    } else {
      console.error('Failed to set context:', contextName);
    }
  }
  
  async deleteContext(contextName) {
    if (confirm(`Are you sure you want to delete the context "${contextName}"?`)) {
      const success = await this.contextManager.deleteContext(contextName);
      if (success) {
        this.render();
      } else {
        console.error('Failed to delete context:', contextName);
      }
    }
  }
  
  showContextSelector() {
    // TODO: Implement context selector modal
    console.log('Context selector not yet implemented');
  }
  
  showCreateContextModal() {
    // TODO: Implement create context modal
    console.log('Create context modal not yet implemented');
    
    // For now, create a simple prompt-based version
    const contextName = prompt('Enter a name for the new context:');
    if (contextName) {
      this.createContext(contextName, []);
    }
  }
  
  async createContext(name, files) {
    const success = await this.contextManager.createContext(name, files);
    if (success) {
      this.render();
    } else {
      console.error('Failed to create context:', name);
    }
  }
}

// Export a function to initialize the panel
export function initContextManagerPanel(container) {
  return new ContextManagerPanel(container);
} 