/**
 * JsonViewer.js - A component to render JSON data with syntax highlighting.
 */
export class JsonViewer {
    constructor() {
        this.injectStyles();
    }

    render(data) {
        if (data === undefined || data === null) {
            return `<pre class="dp-slice-json"><span class="dp-json-null">${String(data)}</span></pre>`;
        }
        const jsonString = JSON.stringify(data, null, 2);
        return `<pre class="dp-slice-json">${this.syntaxHighlight(jsonString)}</pre>`;
    }

    syntaxHighlight(json) {
        if (typeof json !== 'string') {
            json = JSON.stringify(json, undefined, 2);
        }
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
            let cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return `<span class="dp-json-${cls}">${match}</span>`;
        });
    }

    injectStyles() {
        const styleId = 'json-viewer-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .dp-slice-json {
                font-family: var(--font-family-mono);
                font-size: 10px;
                line-height: 1.4;
                background: var(--color-bg-alt);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-sm);
                padding: var(--space-2);
                margin: 0;
                overflow-x: auto;
                max-height: 300px;
                overflow-y: auto;
            }
            .dp-json-key { color: var(--color-text, #111); }
            .dp-json-string { color: var(--color-success, #28a745); }
            .dp-json-number { color: var(--color-primary, #007bff); }
            .dp-json-boolean { color: var(--color-warning, #ffc107); }
            .dp-json-null { color: var(--color-text-secondary, #6c757d); font-style: italic; }
        `;
        document.head.appendChild(style);
    }
}
