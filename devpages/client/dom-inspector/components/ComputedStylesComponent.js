/**
 * ComputedStylesComponent.js - Computed styles display with filtering
 * Handles the computed styles section with filter controls and table display
 */

import { appStore } from '/client/appState.js';
import { UIUtilities } from './UIUtilities.js';

export class ComputedStylesComponent {
    constructor() {
        this.styleGroups = {
            Layout: ['display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'flex', 'grid', 'float', 'clear', 'overflow', 'width', 'height', 'box-sizing'],
            Typography: ['font', 'color', 'text-align', 'text-decoration', 'letter-spacing', 'word-spacing', 'white-space', 'line-height'],
            Spacing: ['margin', 'padding', 'border'],
            Background: ['background', 'opacity'],
        };

        this.colorProperties = new Set([
            'border-image-source', 'border-inline', 'border-inline-color', 'border-inline-end-color', 'border-inline-start-color',
            'caret-color', 'color', 'column-rule-color',
            'outline-color', 'text-decoration-color', 'text-emphasis-color'
        ]);
    }

    /**
     * Create computed styles section with a working filter
     */
    createComputedStylesSection(element, createCollapsibleSection, detailsContainer) {
        const computedStyles = window.getComputedStyle(element);
        const sectionContent = document.createElement('div');
        
        const tableContainer = document.createElement('div');
        
        const updateTable = (filterGroup) => {
            tableContainer.innerHTML = '';
            const newTable = this.createStylesTable(computedStyles, filterGroup);
            tableContainer.appendChild(newTable);
        };

        const filterControls = this.createFilterControls(updateTable);
        sectionContent.appendChild(filterControls);
        sectionContent.appendChild(tableContainer);
        
        // Initial render with 'all'
        updateTable('all');

        const section = createCollapsibleSection('computed-styles', 'Computed Styles', sectionContent, true);
        detailsContainer.appendChild(section);
    }

    /**
     * Create filter controls for computed styles
     */
    createFilterControls(onFilterChange) {
        const controls = document.createElement('div');
        controls.className = 'dom-inspector-filter-controls';
        
        const select = document.createElement('select');
        select.innerHTML = `
            <option value="colors">Colors</option>
            <option value="all">All Properties</option>
            ${Object.keys(this.styleGroups).map(group => `<option value="${group}">${group}</option>`).join('')}
        `;
        
        select.addEventListener('change', (e) => onFilterChange(e.target.value));
        controls.appendChild(select);
        
        return controls;
    }

    /**
     * Create styles table with filtering
     */
    createStylesTable(computedStyles, filterGroup) {
        const table = document.createElement('table');
        table.className = 'dom-inspector-styles-table';
        const tbody = table.createTBody();

        const allProperties = Array.from(computedStyles);
        let propertiesToShow = allProperties;

        if (filterGroup && filterGroup !== 'all') {
            const groupProps = this.styleGroups[filterGroup];
            if (groupProps) {
                propertiesToShow = allProperties.filter(prop => 
                    groupProps.some(gp => prop === gp || prop.startsWith(gp + '-'))
                );
            }
        }
        
        propertiesToShow.forEach(property => {
            const value = computedStyles.getPropertyValue(property);
            if (value && value !== 'none' && value !== 'normal' && value !== 'auto' && value !== '0px') {
                const row = tbody.insertRow();
                row.insertCell().textContent = property;
                row.insertCell().textContent = value;
            }
        });

        if (tbody.rows.length === 0) {
            const row = tbody.insertRow();
            const cell = row.insertCell();
            cell.colSpan = 2;
            cell.textContent = 'No matching styles in this group.';
            cell.style.textAlign = 'center';
            cell.style.padding = '10px';
        }

        return table;
    }

    /**
     * Create computed styles content (just the content, not the full section)
     */
    createComputedStyles(element) {
        const computedStyles = window.getComputedStyle(element);
        const sectionContent = document.createElement('div');
        sectionContent.className = 'dom-inspector-computed-styles';

        const contentContainer = document.createElement('div');
        
        const updateView = (filter) => {
            contentContainer.innerHTML = '';
            if (filter === 'colors') {
                const colorList = this.createColorList(computedStyles);
                if (colorList.children.length > 0) {
                    contentContainer.appendChild(colorList);
                } else {
                    contentContainer.innerHTML = `<div class="dom-inspector-no-styles">No color properties found.</div>`;
                }
            } else {
                const table = this.createStylesTable(computedStyles, filter);
                contentContainer.appendChild(table);
            }
        };

        const filterControls = this.createFilterControls(updateView);
        sectionContent.appendChild(filterControls);
        sectionContent.appendChild(contentContainer);

        // Initial render with colors view
        updateView('colors');

        return sectionContent;
    }

    createColorList(computedStyles) {
        const list = document.createElement('div');
        list.className = 'dom-inspector-style-list';

        const allProperties = Array.from(computedStyles);
        
        allProperties.forEach(prop => {
            const value = computedStyles.getPropertyValue(prop);
            if (this.isColorProperty(prop, value)) {
                const row = this.createColorRow(prop, value);
                list.appendChild(row);
            }
        });

        return list;
    }
    
    isColorProperty(prop, value) {
        // Simple check for properties that are expected to have color values
        if (prop.toLowerCase().includes('color')) {
            return true;
        }
        // More robust check for values that look like colors
        if (value.startsWith('rgb') || value.startsWith('#') || value.startsWith('hsl')) {
             return true;
        }
        // Check for named colors (this is not exhaustive but covers common cases)
        const namedColors = ['transparent', 'currentcolor'];
        if (namedColors.includes(value.toLowerCase())) {
            return true;
        }
        
        return false;
    }

    createColorRow(property, value) {
        const row = document.createElement('div');
        row.className = 'dom-inspector-style-row';

        const propertyEl = document.createElement('span');
        propertyEl.className = 'dom-inspector-property-name';
        propertyEl.textContent = property;

        const valueEl = document.createElement('span');
        valueEl.className = 'dom-inspector-property-value';
        valueEl.textContent = value;
        
        const swatch = document.createElement('span');
        swatch.className = 'dom-inspector-color-swatch';
        swatch.style.backgroundColor = value;
        
        row.appendChild(propertyEl);
        row.appendChild(valueEl);
        row.appendChild(swatch);
        
        // Add click-to-copy functionality
        row.addEventListener('click', () => {
            navigator.clipboard.writeText(value).then(() => {
                UIUtilities.showTemporaryTooltip(row, 'Copied!');
            }, () => {
                UIUtilities.showTemporaryTooltip(row, 'Failed to copy', 'error');
            });
        });

        // Bonus: Add logic to show CSS variable if possible
        // This is a placeholder for a more complex future implementation
        const cssVar = this.findCssVariableForRow(property, value);
        if (cssVar) {
            const varEl = document.createElement('span');
            varEl.className = 'dom-inspector-css-variable';
            varEl.textContent = `(var(${cssVar}))`;
            row.appendChild(varEl);
        }

        return row;
    }
    
    findCssVariableForRow(property, value) {
        // This is a simplified placeholder. A real implementation would be
        // much more complex, involving parsing document.styleSheets.
        // For now, it serves as a demonstration.
        return null;
    }
} 