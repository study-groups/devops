import { SubPanel } from '/client/panels/core/SubPanel.js';

export class TokensPanel {
    render() {
        const container = document.createElement('div');
        container.className = 'design-tokens-container';

        const tokens = this.getTokens();

        Object.entries(tokens).forEach(([category, tokenList]) => {
            const isColorCategory = ['colors', 'semantic-colors'].includes(category);
            const isSpacingCategory = category === 'spacing';
            const isFontFamilyCategory = category === 'font-families';
            const isFontSizeCategory = category === 'font-sizes';
            const isFontWeightCategory = category === 'font-weights';

            const subPanel = new SubPanel(category, isColorCategory);

            let content;
            if (isColorCategory) {
                content = this.createColorContent(tokenList);
            } else if (isSpacingCategory) {
                content = this.createSpacingContent(tokenList);
            } else if (isFontFamilyCategory) {
                content = this.createFontFamilyContent(tokenList);
            } else if (isFontSizeCategory) {
                content = this.createTypographyTable('Font Sizes', tokenList, 'font-size');
            } else if (isFontWeightCategory) {
                content = this.createTypographyTable('Font Weights', tokenList, 'font-weight');
            } else {
                content = this.createGenericContent(tokenList);
            }

            const subPanelElement = subPanel.createElement(content);
            subPanel.attachEventListeners();

            container.appendChild(subPanelElement);
        });

        return container;
    }

    getTokens() {
        // Return sample design tokens data
        return {
            colors: [
                // Gray shades
                { name: '--color-gray-100', value: '#f5f5f5' },
                { name: '--color-gray-500', value: '#737373' },
                { name: '--color-gray-900', value: '#171717' },
                // Blue shades
                { name: '--color-blue-100', value: '#dbeafe' },
                { name: '--color-blue-300', value: '#93c5fd' },
                { name: '--color-blue-500', value: '#3b82f6' },
                { name: '--color-blue-900', value: '#1e3a8a' },
                // Green shades
                { name: '--color-green-100', value: '#dcfce7' },
                { name: '--color-green-500', value: '#2fb969' },
                { name: '--color-green-900', value: '#14532d' },
                // Red shades
                { name: '--color-red-100', value: '#fee2e2' },
                { name: '--color-red-500', value: '#ea5a5a' },
                { name: '--color-red-900', value: '#7f1d1d' },
                // Purple shades
                { name: '--color-purple-100', value: '#f3e8ff' },
                { name: '--color-purple-500', value: '#a855f7' },
                { name: '--color-purple-900', value: '#581c87' },
                // Yellow shades
                { name: '--color-yellow-100', value: '#fef3c7' },
                { name: '--color-yellow-500', value: '#f59e0b' },
                { name: '--color-yellow-900', value: '#78350f' },
            ],
            'font-families': [
                { name: '--font-family-heading', value: 'system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif' },
                { name: '--font-family-body', value: 'system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif' },
                { name: '--font-family-code', value: 'ui-monospace, \'SF Mono\', Monaco, \'Roboto Mono\', monospace' },
                { name: '--font-family-ui', value: 'system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif' },
            ],
            'font-sizes': [
                { name: '--font-size-xs', value: '0.75rem' },
                { name: '--font-size-sm', value: '0.875rem' },
                { name: '--font-size-base', value: '1rem' },
                { name: '--font-size-lg', value: '1.125rem' },
                { name: '--font-size-xl', value: '1.25rem' },
            ],
            'font-weights': [
                { name: '--font-weight-normal', value: '400' },
                { name: '--font-weight-medium', value: '500' },
                { name: '--font-weight-semibold', value: '600' },
                { name: '--font-weight-bold', value: '700' },
            ],
            spacing: [
                { name: '--space-1', value: '0.25rem' },
                { name: '--space-2', value: '0.5rem' },
                { name: '--space-3', value: '0.75rem' },
                { name: '--space-4', value: '1rem' },
                { name: '--space-5', value: '1.25rem' },
                { name: '--space-6', value: '1.5rem' },
                { name: '--space-8', value: '2rem' },
                { name: '--space-10', value: '2.5rem' },
                { name: '--space-12', value: '3rem' },
                { name: '--space-16', value: '4rem' },
            ],
        };
    }

    createColorContent(tokens) {
        const container = document.createElement('div');
        
        // Create all three views for color categories
        const matrixView = this.createColorMatrix(tokens);
        const gridView = this.createColorGrid(tokens);
        const listView = this.createColorList(tokens);

        container.appendChild(matrixView);
        container.appendChild(gridView);
        container.appendChild(listView);

        return container;
    }

    createColorMatrix(tokens) {
        const matrixContainer = document.createElement('div');
        matrixContainer.className = 'color-matrix-container';

        // Organize colors by family and shade for matrix view
        const colorFamilies = ['gray', 'blue', 'green', 'red', 'purple', 'yellow'];
        const shades = ['100', '300', '500', '900'];
        
        const colorMatrix = {};
        tokens.forEach(token => {
            const match = token.name.match(/--color-(\w+)-(\d+)/);
            if (match) {
                const [, family, shade] = match;
                if (!colorMatrix[family]) colorMatrix[family] = {};
                colorMatrix[family][shade] = token;
            }
        });

        // Create matrix table
        const table = document.createElement('div');
        table.className = 'color-matrix-table';

        // Create header row
        const headerRow = document.createElement('div');
        headerRow.className = 'color-matrix-row color-matrix-header';
        
        // Empty cell for top-left
        const emptyCell = document.createElement('div');
        emptyCell.className = 'color-matrix-cell color-matrix-empty';
        headerRow.appendChild(emptyCell);

        // Column headers (color families)
        colorFamilies.forEach(family => {
            const headerCell = document.createElement('div');
            headerCell.className = 'color-matrix-cell color-matrix-column-header';
            headerCell.textContent = family.charAt(0).toUpperCase() + family.slice(1);
            headerRow.appendChild(headerCell);
        });
        
        table.appendChild(headerRow);

        // Create data rows
        shades.forEach(shade => {
            const row = document.createElement('div');
            row.className = 'color-matrix-row';

            // Row header (shade)
            const rowHeader = document.createElement('div');
            rowHeader.className = 'color-matrix-cell color-matrix-row-header';
            rowHeader.textContent = shade;
            row.appendChild(rowHeader);

            // Color cells
            colorFamilies.forEach(family => {
                const cell = document.createElement('div');
                cell.className = 'color-matrix-cell color-matrix-swatch';
                
                const token = colorMatrix[family] && colorMatrix[family][shade];
                if (token) {
                    cell.style.backgroundColor = token.value;
                    cell.title = `${token.name}: ${token.value}`;
                    cell.dataset.tokenName = token.name;
                    cell.dataset.tokenValue = token.value;
                } else {
                    cell.classList.add('color-matrix-empty');
                }
                
                row.appendChild(cell);
            });

            table.appendChild(row);
        });

        matrixContainer.appendChild(table);
        return matrixContainer;
    }

    createColorGrid(tokens) {
        const gridContainer = document.createElement('div');
        gridContainer.className = 'color-grid-container';

        tokens.forEach(token => {
            const colorItem = document.createElement('div');
            colorItem.className = 'color-item';
            colorItem.style.backgroundColor = token.value;
            colorItem.title = `${token.name}: ${token.value}`;

            const colorLabel = document.createElement('div');
            colorLabel.className = 'color-label';
            colorLabel.textContent = token.name;

            colorItem.appendChild(colorLabel);
            gridContainer.appendChild(colorItem);
        });

        return gridContainer;
    }

    createColorList(tokens) {
        const listContainer = document.createElement('div');
        listContainer.className = 'token-grid';

        tokens.forEach(token => {
            const tokenItem = document.createElement('div');
            tokenItem.className = 'token-item';
            tokenItem.innerHTML = `
                <div class="token-preview" style="background-color: ${token.value}"></div>
                <div class="token-info">
                    <div class="token-name">${token.name}</div>
                    <div class="token-value">${token.value}</div>
                </div>
            `;
            listContainer.appendChild(tokenItem);
        });

        return listContainer;
    }

    createFontFamilyContent(tokens) {
        const container = document.createElement('div');
        container.className = 'token-grid';

        tokens.forEach(token => {
            const tokenItem = this.createGenericTokenItem(token);
            const preview = tokenItem.querySelector('.token-preview');
            if (preview) {
                preview.style.fontFamily = token.value;
                preview.textContent = 'Aa';
            }
            container.appendChild(tokenItem);
        });

        return container;
    }

    createTypographyTable(title, tokens, styleProperty) {
        const tableContainer = document.createElement('div');
        tableContainer.className = 'typography-table-container';

        const header = document.createElement('div');
        header.className = 'typography-table-header';
        header.textContent = title;
        tableContainer.appendChild(header);

        const table = document.createElement('div');
        table.className = 'typography-table';

        tokens.forEach(token => {
            const row = document.createElement('div');
            row.className = 'typography-table-row';
            row.innerHTML = `
                <div class="typography-table-token">${token.name}</div>
                <div class="typography-table-value">${token.value}</div>
                <div class="typography-table-sample" style="${styleProperty}: ${token.value};">Sample</div>
            `;
            table.appendChild(row);
        });

        tableContainer.appendChild(table);
        return tableContainer;
    }

    createSpacingContent(tokens) {
        const container = document.createElement('div');
        container.className = 'token-grid';
        container.appendChild(this.createSpacingTable('Spacing', tokens));
        return container;
    }

    createSpacingTable(title, tokens) {
        const tableContainer = document.createElement('div');
        tableContainer.className = 'spacing-table-container';

        const header = document.createElement('div');
        header.className = 'spacing-table-header';
        header.textContent = title;
        tableContainer.appendChild(header);

        const table = document.createElement('div');
        table.className = 'spacing-table';

        tokens.forEach(token => {
            const row = document.createElement('div');
            row.className = 'spacing-table-row';
            row.innerHTML = `
                <div class="spacing-table-token">${token.name}</div>
                <div class="spacing-table-value">${token.value}</div>
                <div class="spacing-table-sample-container">
                    <div class="spacing-table-sample" style="width: ${token.value};"></div>
                </div>
            `;
            table.appendChild(row);
        });

        tableContainer.appendChild(table);
        return tableContainer;
    }

    createGenericContent(tokens) {
        const container = document.createElement('div');
        container.className = 'token-grid';

        tokens.forEach(token => {
            container.appendChild(this.createGenericTokenItem(token));
        });

        return container;
    }

    createGenericTokenItem(token) {
        const tokenItem = document.createElement('div');
        tokenItem.className = 'token-item';
        tokenItem.innerHTML = `
            <div class="token-preview"></div>
            <div class="token-info">
                <div class="token-name">${token.name}</div>
                <div class="token-value">${token.value}</div>
            </div>
        `;
        return tokenItem;
    }
} 