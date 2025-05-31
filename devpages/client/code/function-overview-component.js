/**
 * FunctionOverviewComponent - Displays parsed functions and objects in the left sidebar
 */

class FunctionOverviewComponent {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.currentData = null;
        this.init();
    }
    
    init() {
        if (!this.container) {
            console.warn('[FunctionOverview] Container not found:', containerId);
            return;
        }
        
        // Listen for AST analysis results
        if (window.eventBus) {
            window.eventBus.on('ast:analysis-complete', (data) => {
                this.updateDisplay(data);
            });
        }
        
        console.log('[FunctionOverview] Initialized');
    }
    
    updateDisplay(analysisData) {
        this.currentData = analysisData;
        
        if (!analysisData || (!analysisData.functions?.length && !analysisData.objects?.length)) {
            this.showEmpty();
            return;
        }
        
        this.render();
    }
    
    showEmpty() {
        this.container.innerHTML = `
            <div style="color: #6c757d; font-size: 11px; font-style: italic; text-align: center; padding: 20px;">
                Select a JavaScript file to see functions and objects
            </div>
        `;
    }
    
    render() {
        const { functions = [], objects = [] } = this.currentData;
        
        let html = '';
        
        // Functions section
        if (functions.length > 0) {
            html += `<div style="margin-bottom: 16px;">`;
            html += `<div style="font-size: 10px; color: #495057; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Functions (${functions.length})</div>`;
            
            functions.forEach((func, index) => {
                const icon = this.getFunctionIcon(func.type);
                const params = func.params ? ` (${func.params})` : '';
                
                html += `
                    <div class="function-item" 
                         data-type="function" 
                         data-name="${func.name}" 
                         data-index="${index}"
                         style="padding: 4px 6px; margin-bottom: 2px; border: 1px solid #e9ecef; border-radius: 3px; cursor: pointer; font-size: 11px; display: flex; align-items: center; background: #fff;">
                        <span style="width: 16px; font-size: 10px; color: #007bff; margin-right: 6px;">${icon}</span>
                        <span style="flex: 1; color: #495057; font-weight: 500;">${func.name}</span>
                        <span style="color: #6c757d; font-size: 9px;">${this.getTypeShort(func.type)}</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        // Objects section
        if (objects.length > 0) {
            html += `<div style="margin-bottom: 16px;">`;
            html += `<div style="font-size: 10px; color: #495057; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Objects (${objects.length})</div>`;
            
            objects.forEach((obj, index) => {
                html += `
                    <div class="object-item" 
                         data-type="object" 
                         data-name="${obj.name}" 
                         data-index="${index}"
                         style="padding: 4px 6px; margin-bottom: 2px; border: 1px solid #e9ecef; border-radius: 3px; cursor: pointer; font-size: 11px; display: flex; align-items: center; background: #fff;">
                        <span style="width: 16px; font-size: 10px; color: #28a745; margin-right: 6px;">○</span>
                        <span style="flex: 1; color: #495057; font-weight: 500;">${obj.name}</span>
                        <span style="color: #6c757d; font-size: 9px;">${obj.propertyCount}p</span>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        this.container.innerHTML = html;
        this.attachEventListeners();
    }
    
    getFunctionIcon(type) {
        switch (type) {
            case 'FunctionDeclaration': return 'ƒ';
            case 'ArrowFunctionExpression': return '→';
            case 'FunctionExpression': return 'λ';
            case 'MethodDefinition': return 'm';
            default: return 'ƒ';
        }
    }
    
    getTypeShort(type) {
        switch (type) {
            case 'FunctionDeclaration': return 'FUNC';
            case 'ArrowFunctionExpression': return 'ARROW';
            case 'FunctionExpression': return 'EXPR';
            case 'MethodDefinition': return 'METHOD';
            default: return 'FUNC';
        }
    }
    
    attachEventListeners() {
        // Click handler for function/object items
        this.container.addEventListener('click', (e) => {
            const item = e.target.closest('.function-item, .object-item');
            if (!item) return;
            
            const type = item.dataset.type;
            const name = item.dataset.name;
            const index = parseInt(item.dataset.index);
            
            // Highlight selected item
            this.container.querySelectorAll('.function-item, .object-item').forEach(el => {
                el.style.background = '#fff';
                el.style.borderColor = '#e9ecef';
            });
            
            item.style.background = '#e3f2fd';
            item.style.borderColor = '#2196f3';
            
            // Add to context
            if (window.eventBus) {
                window.eventBus.emit('context:select', {
                    type: type,
                    name: name,
                    source: 'function-overview',
                    data: type === 'function' ? this.currentData.functions[index] : this.currentData.objects[index]
                });
            }
            
            console.log(`[FunctionOverview] Selected ${type}: ${name}`);
        });
    }
    
    clear() {
        this.currentData = null;
        this.showEmpty();
    }
}

// Export for module use
window.FunctionOverviewComponent = FunctionOverviewComponent; 