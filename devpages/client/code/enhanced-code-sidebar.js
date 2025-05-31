/**
 * Enhanced Code Sidebar - Three Panel Layout Controller
 * Manages file list, function overview, CLI, and context panels
 */

console.log('[CodeSidebar] Initializing enhanced code sidebar...');

import FileListComponent from '/client/code/file-list-component.js';

class EnhancedCodeSidebar {
    constructor() {
        this.sidebar = null;
        this.container = null;
        this.fileList = null;
        this.codeManager = null;
        this.functionOverview = null;
        this.currentPath = '';
        this.init();
    }
    
    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    async setup() {
        this.sidebar = document.getElementById('left-sidebar');
        this.container = document.getElementById('code-sidebar-content');
        
        if (!this.sidebar || !this.container) {
            console.warn('[CodeSidebar] Elements not found, retrying...');
            setTimeout(() => this.setup(), 500);
            return;
        }
        
        console.log('[CodeSidebar] Elements found, setting up three-panel components...');
        
        // Initialize CodeManager
        this.codeManager = new window.CodeManager();
        window.codeManager = this.codeManager;
        
        // Initialize FileListComponent
        this.fileList = new FileListComponent('code-sidebar-content');
        window.fileList = this.fileList;
        
        // Initialize FunctionOverviewComponent
        this.functionOverview = new window.FunctionOverviewComponent('function-list-content');
        window.functionOverview = this.functionOverview;
        
        this.setupViewModeListener();
        this.setupCodeAnalysisListeners();
        this.setupFloatingCLI();
        this.setupContextPanel();
        
        // Load initial file list
        await this.fileList.loadFiles();
    }
    
    setupViewModeListener() {
        // Listen for clicks on view mode buttons
        document.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'setView') {
                const viewMode = e.target.dataset.viewMode;
                console.log('[CodeSidebar] View button clicked:', viewMode);
                
                // Handle Code mode toggle
                if (viewMode === 'editor') {
                    this.toggleCodeSidebars();
                }
            }
        });
    }
    
    toggleCodeSidebars() {
        const leftSidebar = document.getElementById('left-sidebar');
        const centerPanel = document.getElementById('center-panel');
        const rightSidebar = document.getElementById('right-sidebar');
        
        if (leftSidebar && centerPanel && rightSidebar) {
            leftSidebar.style.display = 'flex';
            centerPanel.style.display = 'flex';
            rightSidebar.style.display = 'none';
            console.log('[CodeSidebar] Set view for "editor" mode: Left & Center visible, Right hidden');
        }
    }
    
    setupCodeAnalysisListeners() {
        if (window.eventBus) {
            window.eventBus.on('code:analysis-complete', (data) => {
                console.log('[CodeSidebar] Code analysis complete:', data);
                this.updateFileAnalysisStatus(data.filename, data);
            });
            
            window.eventBus.on('file:open', (data) => {
                console.log('[CodeSidebar] File opened:', data.filename);
            });
        }
    }
    
    updateFileAnalysisStatus(filename, analysisData) {
        // Update the file card to show analysis results
        const fileCards = this.container.querySelectorAll('.file-card');
        fileCards.forEach(card => {
            if (card.dataset.name === filename.split('/').pop()) {
                const statsContainer = card.querySelector('.file-card-stats');
                if (statsContainer) {
                    // Add function count
                    const funcCount = analysisData.functions.length;
                    if (funcCount > 0) {
                        const funcBadge = document.createElement('span');
                        funcBadge.className = 'stat-item';
                        funcBadge.textContent = `${funcCount} fn`;
                        funcBadge.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
                        funcBadge.style.color = '#28a745';
                        statsContainer.appendChild(funcBadge);
                    }
                    
                    // Add dependency count
                    const depCount = analysisData.dependencies?.imports?.length + 
                                   analysisData.dependencies?.requires?.length || 0;
                    if (depCount > 0) {
                        const depBadge = document.createElement('span');
                        depBadge.className = 'stat-item';
                        depBadge.textContent = `${depCount} deps`;
                        depBadge.style.backgroundColor = 'rgba(0, 123, 255, 0.1)';
                        depBadge.style.color = '#007bff';
                        statsContainer.appendChild(depBadge);
                    }
                }
            }
        });
    }
    
    setupFloatingCLI() {
        const cliInput = document.getElementById('cli-input');
        const cliSubmit = document.getElementById('cli-submit');
        const cliClose = document.getElementById('cli-close');
        const floatingCLI = document.getElementById('floating-cli');
        
        // Show CLI with Ctrl+K
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                this.showFloatingCLI();
            }
            if (e.key === 'Escape' && floatingCLI && floatingCLI.style.display === 'block') {
                this.hideFloatingCLI();
            }
        });
        
        // CLI submit
        if (cliSubmit) {
            cliSubmit.addEventListener('click', () => this.handleCLICommand());
        }
        
        // CLI close
        if (cliClose) {
            cliClose.addEventListener('click', () => this.hideFloatingCLI());
        }
        
        // CLI input enter
        if (cliInput) {
            cliInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.handleCLICommand();
                }
            });
        }
    }
    
    setupContextPanel() {
        // Setup context summary and CLI output
        const sendToLLM = document.getElementById('context-send-to-llm');
        if (sendToLLM) {
            sendToLLM.addEventListener('click', () => this.sendContextToLLM());
        }
        
        // Listen for context events
        if (window.eventBus) {
            window.eventBus.on('context:select', (data) => {
                this.addToContext(data);
            });
            
            window.eventBus.on('context:clear', () => {
                this.clearContext();
            });
        }
    }
    
    showFloatingCLI() {
        const floatingCLI = document.getElementById('floating-cli');
        const cliInput = document.getElementById('cli-input');
        if (floatingCLI) {
            floatingCLI.style.display = 'block';
            if (cliInput) {
                cliInput.focus();
            }
        }
    }
    
    hideFloatingCLI() {
        const floatingCLI = document.getElementById('floating-cli');
        const cliInput = document.getElementById('cli-input');
        if (floatingCLI) {
            floatingCLI.style.display = 'none';
            if (cliInput) {
                cliInput.value = '';
            }
        }
    }
    
    handleCLICommand() {
        const cliInput = document.getElementById('cli-input');
        if (!cliInput) return;
        
        const command = cliInput.value.trim();
        if (!command) return;
        
        console.log('[CLI] Processing command:', command);
        
        // Basic $var parsing for now
        const vars = command.match(/\$[\w\.\/\-]+/g) || [];
        
        this.outputToCLI(`> ${command}`);
        this.outputToCLI(`Parsed variables: ${vars.join(', ') || 'none'}`);
        this.outputToCLI(`Command execution not yet implemented.`);
        
        cliInput.value = '';
        this.hideFloatingCLI();
    }
    
    outputToCLI(message) {
        const output = document.getElementById('cli-output-content');
        if (!output) return;
        
        const line = document.createElement('div');
        line.style.marginBottom = '4px';
        line.textContent = message;
        
        // Clear placeholder if first real message
        if (output.children.length === 1 && output.children[0].style.fontStyle === 'italic') {
            output.innerHTML = '';
        }
        
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }
    
    addToContext(item) {
        const contextItems = document.getElementById('context-items');
        if (!contextItems) return;
        
        // Clear placeholder if first item
        if (contextItems.children.length === 1 && contextItems.children[0].style.fontStyle === 'italic') {
            contextItems.innerHTML = '';
        }
        
        const itemDiv = document.createElement('div');
        itemDiv.style.cssText = 'padding: 4px 6px; background: #e9ecef; border: 1px solid #ced4da; border-radius: 3px; font-size: 11px; display: flex; justify-content: space-between; align-items: center;';
        
        const label = document.createElement('span');
        label.textContent = `${item.type}: ${item.name}`;
        
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '×';
        removeBtn.style.cssText = 'background: none; border: none; color: #6c757d; cursor: pointer; padding: 0; margin-left: 8px;';
        removeBtn.addEventListener('click', () => itemDiv.remove());
        
        itemDiv.appendChild(label);
        itemDiv.appendChild(removeBtn);
        contextItems.appendChild(itemDiv);
    }
    
    clearContext() {
        const contextItems = document.getElementById('context-items');
        if (!contextItems) return;
        
        contextItems.innerHTML = '<div style="font-size: 11px; color: #6c757d; font-style: italic;">No items selected for context</div>';
    }
    
    sendContextToLLM() {
        const contextItems = document.getElementById('context-items');
        if (!contextItems) return;
        
        const items = Array.from(contextItems.children)
            .filter(child => !child.style.fontStyle)
            .map(child => child.querySelector('span').textContent);
        
        this.outputToCLI(`Context ready for LLM:`);
        items.forEach(item => this.outputToCLI(`  - ${item}`));
        this.outputToCLI(`Total items: ${items.length}`);
    }
    
    // Public API
    getCodeManager() {
        return this.codeManager;
    }
    
    getFileList() {
        return this.fileList;
    }
    
    async analyzeCurrentProject() {
        if (!this.codeManager) return;
        
        console.log('[CodeSidebar] Analyzing current project...');
        const summary = this.codeManager.getProjectSummary();
        console.log('[CodeSidebar] Project summary:', summary);
        
        return summary;
    }
}

// Initialize enhanced sidebar
window.enhancedCodeSidebar = new EnhancedCodeSidebar();

console.log('[CodeSidebar] Enhanced initialization complete'); 