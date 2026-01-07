/* pja-ui-ast-viewer.js */

class AstViewer {
    constructor(container, filePath, lineNum, astData = null) {
        this.container = container;
        this.filePath = filePath;
        this.lineNum = lineNum;
        this.astData = astData;
    }

    async render() {
        if (this.astData) {
            this.renderContent(this.astData);
        } else {
            this.container.innerHTML = '<div class="pja-text-muted">Loading AST...</div>';
            try {
                const astResponse = await fetch(`/api/ast?file=${encodeURIComponent(this.filePath)}&line=${this.lineNum}`);
                const astData = await astResponse.json();
                this.renderContent(astData);
            } catch (err) {
                this.container.innerHTML = `<div class="pja-error-bg">Failed to fetch AST: ${this.escapeHtml(err.message)}</div>`;
                console.error('Failed to fetch AST:', err);
            }
        }
    }

    renderContent(astData) {
        this.container.innerHTML = '';

        if (astData.success) {
            const astContainerContent = document.createElement('div');
            astContainerContent.classList.add('pja-ast-container');

            const jsonViewerEl = this.createJsonViewer(astData.astObject, 'AST');
            astContainerContent.appendChild(jsonViewerEl);

            const processHtml = `
                <div class="finding-process collapsible-section">
                    <h5 class="collapsible-header"><span class="collapsible-toggle"></span>Finding Process</h5>
                    <div class="collapsible-content">
                        <ol>${astData.findingProcess.map(p => `<li>Node: <strong>${p.type}</strong> (lines ${p.start}-${p.end})</li>`).join('')}</ol>
                    </div>
                </div>`;
            astContainerContent.insertAdjacentHTML('beforeend', processHtml);

            if (astData.chainOfThought && astData.chainOfThought.length) {
                const chainOfThoughtHtml = `
                    <div class="chain-of-thought collapsible-section">
                        <h5 class="collapsible-header"><span class="collapsible-toggle"></span>Chain of Thought</h5>
                        <div class="collapsible-content">
                            <ol>${astData.chainOfThought.map(thought => `<li>${this.escapeHtml(thought)}</li>`).join('')}</ol>
                        </div>
                    </div>`;
                astContainerContent.insertAdjacentHTML('beforeend', chainOfThoughtHtml);
            }

            if (astData.fileDetails) {
                const fileDetailsHtml = `
                    <div class="file-details collapsible-section">
                        <h5 class="collapsible-header"><span class="collapsible-toggle"></span>File Details</h5>
                        <div class="collapsible-content">
                            <p>Original File: <code>${this.escapeHtml(astData.fileDetails.originalFile)}</code></p>
                            <p>Resolved Path: <code>${this.escapeHtml(astData.fileDetails.resolvedPath)}</code></p>
                        </div>
                    </div>`;
                astContainerContent.insertAdjacentHTML('beforeend', fileDetailsHtml);
            }

            this.container.appendChild(astContainerContent);
            this.container.setAttribute('data-loaded', 'true');
        } else {
            this.container.innerHTML = `<div class="pja-error-bg">${this.escapeHtml(astData.error || 'Unknown error')}</div>`;
        }
    }

    createJsonViewer(obj, rootName = 'JSON') {
        const container = document.createElement('div');
        container.className = 'pja-json-viewer';
        container.appendChild(this._buildJsonNode(obj, rootName));

        container.addEventListener('click', e => {
            const toggle = e.target.closest('.devwatch-json-toggle');
            if (toggle) {
                const entry = toggle.closest('.devwatch-json-entry');
                if (entry.classList.contains('expandable')) {
                    const nested = entry.querySelector('.devwatch-json-nested');
                    const isExpanded = nested.style.display !== 'none';
                    nested.style.display = isExpanded ? 'none' : 'block';
                    toggle.classList.toggle('expanded', !isExpanded);
                }
            }
        });

        return container;
    }

    _buildJsonNode(value, key = null, depth = 0) {
        const entry = document.createElement('div');
        entry.className = 'pja-json-entry';
        entry.style.paddingLeft = `${depth * 12}px`;

        const row = document.createElement('div');
        row.className = 'pja-json-row';

        if (key !== null) {
            const keyEl = document.createElement('span');
            keyEl.className = 'pja-json-key';
            keyEl.textContent = `${key}: `;
            row.appendChild(keyEl);
        }

        const type = typeof value;
        if (type !== 'object' || value === null) {
            const valueEl = document.createElement('span');
            let typeClass = `pja-json-${type}`;
            if (value === null) typeClass = 'pja-json-null';
            valueEl.className = `pja-json-value ${typeClass}`;
            valueEl.textContent = JSON.stringify(value);
            row.appendChild(valueEl);
            entry.appendChild(row);
            return entry;
        }

        const isArray = Array.isArray(value);
        const keys = Object.keys(value);
        const toggle = document.createElement('span');
        toggle.className = 'pja-json-toggle';
        row.appendChild(toggle);

        const openBracket = document.createElement('span');
        openBracket.className = 'pja-json-bracket';
        openBracket.textContent = isArray ? '[' : '{';
        row.appendChild(openBracket);

        const summary = document.createElement('span');
        summary.className = 'pja-json-summary';
        summary.textContent = ` ${keys.length} ${isArray ? 'items' : 'properties'}`;
        row.appendChild(summary);

        entry.appendChild(row);
        entry.classList.add('expandable');

        const nested = document.createElement('div');
        nested.className = 'pja-json-nested';
        nested.style.display = 'none';

        keys.forEach((k, index) => {
            const childNode = this._buildJsonNode(value[k], isArray ? null : k, depth + 1);
            if (index < keys.length - 1) {
                const comma = document.createElement('span');
                comma.className = 'pja-json-comma';
                comma.textContent = ',';
                childNode.querySelector('.devwatch-json-row').appendChild(comma);
            }
            nested.appendChild(childNode);
        });

        const closingRow = document.createElement('div');
        closingRow.className = 'pja-json-row';
        closingRow.style.paddingLeft = `${depth * 12}px`;
        const closeBracket = document.createElement('span');
        closeBracket.className = 'pja-json-bracket';
        closeBracket.textContent = isArray ? ']' : '}';
        closingRow.appendChild(closeBracket);
        nested.appendChild(closingRow);

        entry.appendChild(nested);
        return entry;
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
