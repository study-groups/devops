/**
 * JavaScriptInfoPanel.js
 * Provides information and potentially settings for JavaScript usage in previews.
 */

import { BasePanel } from '/client/panels/BasePanel.js';

// Get a dedicated logger for this module
const log = window.APP.services.log.createLogger('JavaScriptInfoPanel');

export class JavaScriptInfoPanel extends BasePanel {
    constructor(options) {
        super({
            id: 'javascript-info-panel',
            title: 'JavaScript Info',
            ...options
        });
        
        log.info('JS_PANEL', 'INSTANCE_CREATED', 'JavaScriptInfoPanel instance created.');
    }

    renderContent() {
        return `
            <div class="settings-section javascript-settings" style="padding: 10px;">
                <p class="settings-description" style="margin-bottom: 15px; line-height: 1.6;">
                    Manage how JavaScript executes within the Markdown preview. Scripts and styles can be included via front matter or inline.
                </p>
                
                ${this.createSubSection(
                    'Using Front Matter (js_includes, css_includes)',
                    `<p>Include external JavaScript and CSS files from the same directory (or subdirectories) as your Markdown file:</p>
                    <pre><code>---
css_includes:
  - ./local-styles.css
js_includes:
  - ./my-script.js
  - ./libs/another-module.js 
---

# Your Markdown...</code></pre>
                    <p><code>js_includes</code> are for JavaScript (loaded as ES6 modules). <code>css_includes</code> are for CSS. Paths are relative to the Markdown file.</p>`
                )}
                
                ${this.createSubSection(
                    'Inline Scripts & Styles (<script>, <style>)',
                    `<p>Embed JavaScript directly using <code>&lt;script&gt;</code> tags. For ES6 module features (like top-level <code>await</code> or <code>import</code>), use <code>&lt;script type="module"&gt;</code>.</p>
                    <p>Similarly, use <code>&lt;style&gt;</code> tags for inline CSS.</p>`
                )}
                
                ${this.createSubSection(
                    'Inline Front Matter (script:, css:)',
                    `<p>Embed multiline CSS or JavaScript directly in front matter using YAML block scalars (<code>|</code> or <code>&gt;</code>):</p>
                    <pre><code>---
css: |
  .my-button { background-color: blue; color: white; }
script: |
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('my-button');
    if (btn) btn.addEventListener('click', () => alert('Clicked!'));
  });
---

&lt;button id="my-button"&gt;Click Me&lt;/button&gt;</code></pre>
                    <p>The <code>css</code> block is injected into <code>&lt;head&gt;</code>. The <code>script</code> block is injected at the end of <code>&lt;body&gt;</code> (wrapped in an IIFE).</p>`
                )}
                
                ${this.createSubSection(
                    'Event Handling',
                    `<p>Attach event listeners using standard JavaScript (e.g., <code>document.getElementById('my-button').addEventListener('click', ...)</code>). Ensure scripts run after relevant DOM elements exist (use <code>DOMContentLoaded</code> or place scripts at the end).</p>`
                )}
                
                ${this.createSubSection(
                    'Security Considerations',
                    `<p>Loading local files has security implications. The server restricts file access to <code>.js</code> and <code>.css</code> files within your markdown's directory structure. Avoid exposing sensitive data or performing dangerous operations in preview scripts.</p>`
                )}
            </div>
        `;
    }

    createSubSection(title, contentHtml) {
        return `
            <div style="margin-bottom: 20px;">
                ${title ? `<h4 style="margin-top: 0; margin-bottom: 8px;">${title}</h4>` : ''}
                <div>
                    ${contentHtml}
                </div>
            </div>
        `;
    }

    onMount(container) {
        super.onMount(container);
        
        // Trigger highlighting for the code examples if highlight plugin is active
        setTimeout(() => {
            // Only highlight if the panel is visible in the DOM
            if (!this.element || this.element.offsetParent === null) return;

            if (window.hljs) {
                const codeBlocks = this.element.querySelectorAll('pre code');
                if (codeBlocks.length === 0) return;
                codeBlocks.forEach((block) => {
                    if (block.textContent && block.textContent.trim() !== '') {
                        try {
                            window.hljs.highlightElement(block);
                        } catch (e) {
                            log.error('JS_PANEL', 'HIGHLIGHT_JS_ERROR', 'Highlight.js error: ' + e.message, e);
                        }
                    }
                });
            } else if (typeof Prism !== 'undefined') {
                const codeBlocks = this.element.querySelectorAll('pre code[class*="language-"]');
                if (codeBlocks.length === 0) return;
                codeBlocks.forEach((block) => {
                    if (block.textContent && block.textContent.trim() !== '') {
                        try {
                            Prism.highlightElement(block);
                        } catch (e) {
                            log.error('JS_PANEL', 'PRISM_ERROR', 'Prism error: ' + e.message, e);
                        }
                    }
                });
            }
        }, 100); // Short delay to ensure elements are in DOM
    }

    destroy() {
        log.info('JS_PANEL', 'DESTROYED', 'JavaScriptInfoPanel destroyed.');
        super.destroy();
    }
}