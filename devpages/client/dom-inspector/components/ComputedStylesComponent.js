/**
 * ComputedStylesComponent.js - Computed styles display with filtering
 * Handles the computed styles section with filter controls and table display
 */

export class ComputedStylesComponent {
    constructor() {
        this.styleGroups = {
            Layout: ['display', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'flex', 'grid', 'float', 'clear', 'overflow', 'width', 'height', 'box-sizing'],
            Typography: ['font', 'color', 'text-align', 'text-decoration', 'letter-spacing', 'word-spacing', 'white-space', 'line-height'],
            Spacing: ['margin', 'padding', 'border'],
            Background: ['background', 'opacity'],
        };
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

        return sectionContent;
    }
} 