/**
 * client/settings/JavaScriptPanel.js
 * Provides information and potentially settings for JavaScript usage in previews.
 */

// Helper for logging specific to this panel
function logJSPanel(message, level = 'info') {
  const type = 'JS_SETTINGS_PANEL';
  if (typeof window.logMessage === 'function') {
    window.logMessage(message, level, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}

export class JavaScriptPanel {
  constructor(parentElement) {
    this.containerElement = null; // The main element for this panel's content

    if (!parentElement) {
      logJSPanel('JavaScriptPanel requires a parent element to attach its content.', 'error');
      return;
    }

    this.createPanelContent(parentElement);
    logJSPanel('JavaScriptPanel instance created.');
  }

  createPanelContent(parentElement) {
    this.containerElement = document.createElement('div');
    this.containerElement.classList.add('settings-section', 'javascript-settings');
    this.containerElement.innerHTML = `
      <div class="settings-description">
        Manage how JavaScript executes within the Markdown preview.
      </div>
      
      <h4>Using Front Matter</h4>
      <p>
        You can include external JavaScript and CSS files located in the same directory 
        (or subdirectories) as your Markdown file using front matter keys:
      </p>
      <pre><code>---
css_includes:
  - ./local-styles.css
js_includes:
  - ./my-script.js
  - ./libs/another-module.js 
---

# Your Markdown...
</code></pre>
      <p>
        Use <code>js_includes</code> for JavaScript files (loaded as ES6 modules, allowing imports). 
        Use <code>css_includes</code> for CSS files.
        Paths are relative to the Markdown file.
      </p>

      <h4>Inline Scripts & Styles</h4>
      <p>
          You can embed JavaScript directly using <code>&lt;script&gt;</code> tags within your Markdown. 
          For ES6 module features (like top-level <code>await</code> or <code>import</code>), use <code>&lt;script type="module"&gt;</code>. 
          <strong>Note:</strong> Imports within inline modules still rely on the server configuration for loading other local files.
      </p>
      <p> 
          Similarly, use <code>&lt;style&gt;</code> tags for inline CSS.
      </p>
      
      <h4>Inline Front Matter Scripts/CSS (Block Scalars)</h4>
      <p>
          You can also embed multiline CSS or JavaScript directly in the front matter using YAML block scalars (<code>|</code> or <code>&gt;</code>):
      </p>
      <pre><code>---
css: |
  .my-button {
    background-color: blue;
    color: white;
  }
script: |
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('my-button');
    if (btn) {
      btn.addEventListener('click', () => alert('Clicked!'));
    }
  });
---

&lt;!-- Markdown content... --&gt;
&lt;button id="my-button"&gt;Click Again&lt;/button&gt;</code></pre>
      <p>
          The <code>css</code> block is injected into the <code>&lt;head&gt;</code>, and the <code>script</code> block is injected at the end of the <code>&lt;body&gt;</code> (wrapped in an IIFE).
      </p>

      <h4>Event Handling</h4>
      <p>
        Attach event listeners using standard JavaScript within your included or inline scripts 
        (e.g., <code>document.getElementById('my-button').addEventListener('click', ...)</code>).
        Make sure your script runs after the relevant DOM elements exist (e.g., use <code>DOMContentLoaded</code> listener or place scripts at the end).
      </p>
      
      <h4>Security Considerations</h4>
      <p>
        Loading local files introduces security considerations. The server attempts to restrict file access 
        to only <code>.js</code> and <code>.css</code> files within the same directory structure as your markdown file.
        Avoid exposing sensitive information or performing dangerous operations in preview scripts.
      </p>
    `;
    
    parentElement.appendChild(this.containerElement);

    // Trigger highlighting for the code examples if highlight plugin is active
    setTimeout(() => {
        if (window.hljs) {
             this.containerElement.querySelectorAll('pre code').forEach((block) => {
                 window.hljs.highlightElement(block);
             });
        } else if (typeof Prism !== 'undefined') {
            this.containerElement.querySelectorAll('pre code[class*="language-"]').forEach((block) => {
                 Prism.highlightElement(block);
             });
        }
    }, 100); // Short delay to ensure elements are in DOM
  }

  // Method to clean up if needed
  destroy() {
    logJSPanel('Destroying JavaScriptPanel...');
    if (this.containerElement && this.containerElement.parentNode) {
      this.containerElement.parentNode.removeChild(this.containerElement);
    }
    this.containerElement = null;
    logJSPanel('JavaScriptPanel destroyed.');
  }
} 