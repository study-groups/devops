/**
 * BoxModelComponent.js - Simple box model facts display
 * Shows margin, padding, border, and content dimensions in a clean table
 */

export class BoxModelComponent {
    constructor() {
        // No initialization needed
    }

    /**
     * Create a simple box model facts table
     */
    createBoxModel(computedStyles) {
        const container = document.createElement('div');
        container.className = 'dom-inspector-box-model';

        // Parse values
        const width = computedStyles.width;
        const height = computedStyles.height;
        
        const marginTop = computedStyles.marginTop;
        const marginRight = computedStyles.marginRight;
        const marginBottom = computedStyles.marginBottom;
        const marginLeft = computedStyles.marginLeft;
        
        const paddingTop = computedStyles.paddingTop;
        const paddingRight = computedStyles.paddingRight;
        const paddingBottom = computedStyles.paddingBottom;
        const paddingLeft = computedStyles.paddingLeft;
        
        const borderTopWidth = computedStyles.borderTopWidth;
        const borderRightWidth = computedStyles.borderRightWidth;
        const borderBottomWidth = computedStyles.borderBottomWidth;
        const borderLeftWidth = computedStyles.borderLeftWidth;

        // Create facts table
        const facts = [
            ['Content', `${width} × ${height}`],
            ['Margin', `${marginTop} ${marginRight} ${marginBottom} ${marginLeft}`],
            ['Padding', `${paddingTop} ${paddingRight} ${paddingBottom} ${paddingLeft}`],
            ['Border', `${borderTopWidth} ${borderRightWidth} ${borderBottomWidth} ${borderLeftWidth}`],
        ];

        const table = document.createElement('table');
        table.className = 'dom-inspector-box-model-table';
        table.style.cssText = `
            width: 100%;
            border-collapse: collapse;
            font-family: monospace;
            font-size: 12px;
        `;

        facts.forEach(([label, value]) => {
            const row = table.insertRow();
            row.style.cssText = `border-bottom: 1px solid #e1e4e8;`;
            
            const labelCell = row.insertCell();
            labelCell.textContent = label;
            labelCell.style.cssText = `
                padding: 6px 8px;
                font-weight: 600;
                background: #f8f9fa;
                width: 30%;
            `;
            
            const valueCell = row.insertCell();
            valueCell.textContent = value;
            valueCell.style.cssText = `
                padding: 6px 8px;
                color: #6c757d;
            `;
        });

        container.appendChild(table);
        return container;
    }

    /**
     * Create box model section for DOM Inspector
     */
    createBoxModelSection(element, createCollapsibleSection, detailsContainer) {
        const computedStyles = window.getComputedStyle(element);
        const content = this.createBoxModel(computedStyles);
        
        const section = createCollapsibleSection('box-model', 'Box Model', content);
        detailsContainer.appendChild(section);
    }
} 