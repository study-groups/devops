/**
 * JsonViewer.js - A component to render JSON data with syntax highlighting.
 */
export class JsonViewer {
    constructor() {
        this.injectStyles();
    }

    render(data) {
        if (data === undefined || data === null) {
            return `<pre class="devpages-slice-json"><span class="devpages-json-null">${String(data)}</span></pre>`;
        }
        const jsonString = JSON.stringify(data, null, 2);
        return `<pre class="devpages-slice-json">${this.syntaxHighlight(jsonString)}</pre>`;
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
            return `<span class="devpages-json-${cls}">${match}</span>`;
        });
    }

    injectStyles() {
        const styleId = 'json-viewer-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .devpages-slice-json {
                font-family: var(--devpages-panel-font-mono);
                font-size: var(--devpages-panel-font-size-micro);
                line-height: var(--devpages-panel-line-height-tight);
                background: var(--devpages-panel-bg-alt);
                border: 1px solid var(--devpages-panel-border);
                border-radius: var(--radius-sm);
                padding: var(--space-2);
                margin: 0;
                overflow-x: auto;
                max-height: 300px;
                overflow-y: auto;
            }
            .devpages-json-key { color: var(--color-text, #111); }
            .devpages-json-string { color: var(--color-success, #28a745); }
            .devpages-json-number { color: var(--color-primary, #007bff); }
            .devpages-json-boolean { color: var(--color-warning, #ffc107); }
            .devpages-json-null { color: var(--color-text-secondary, #6c757d); font-style: italic; }
        `;
        document.head.appendChild(style);
    }
}
