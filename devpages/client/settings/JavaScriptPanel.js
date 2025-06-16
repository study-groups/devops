/**
 * client/settings/JavaScriptPanel.js
 * Provides information and potentially settings for JavaScript usage in previews.
 */

import { panelRegistry } from './panelRegistry.js';

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
    this.containerElement.style.padding = '10px'; // Add overall padding to the section content

    // Helper to create a sub-section
    const createSubSection = (title, contentHtml) => {
      const subSectionDiv = document.createElement('div');
      subSectionDiv.style.marginBottom = '20px'; // Space between subsections

      if (title) {
        const header = document.createElement('h4');
        header.textContent = title;
        header.style.marginTop = '0';
        header.style.marginBottom = '8px';
        subSectionDiv.appendChild(header);
      }
      
      const contentP = document.createElement('div'); // Use div for more flexible content
      contentP.innerHTML = contentHtml;
      subSectionDiv.appendChild(contentP);
      
      // Style paragraphs and pre within the content
      contentP.querySelectorAll('p').forEach(p => {
        p.style.marginBottom = '8px';
        p.style.lineHeight = '1.6';
      });
      contentP.querySelectorAll('pre').forEach(pre => {
        pre.style.marginBottom = '10px';
        pre.style.padding = '10px';
        pre.style.border = '1px solid #ddd';
        pre.style.borderRadius = '4px';
        pre.style.backgroundColor = '#f9f9f9';
        pre.style.overflowX = 'auto';
      });
      contentP.querySelectorAll('code').forEach(code => {
        code.style.fontFamily = 'monospace';
      });


      return subSectionDiv;
    };
    
    const introDescription = document.createElement('p');
    introDescription.classList.add('settings-description');
    introDescription.textContent = 'Manage how JavaScript executes within the Markdown preview. Scripts and styles can be included via front matter or inline.';
    introDescription.style.marginBottom = '15px';
    this.containerElement.appendChild(introDescription);

    this.containerElement.appendChild(createSubSection(
      'Using Front Matter (js_includes, css_includes)',
      `<p>
        Include external JavaScript and CSS files from the same directory 
        (or subdirectories) as your Markdown file:
      </p>
      <pre><code>---
css_includes:
  - ./local-styles.css
js_includes:
  - ./my-script.js
  - ./libs/another-module.js 
---

# Your Markdown...</code></pre>
      <p>
        <code>js_includes</code> are for JavaScript (loaded as ES6 modules). 
        <code>css_includes</code> are for CSS. Paths are relative to the Markdown file.
      </p>`
    ));

    this.containerElement.appendChild(createSubSection(
      'Inline Scripts & Styles (<script>, <style>)',
      `<p>
          Embed JavaScript directly using <code>&lt;script&gt;</code> tags. 
          For ES6 module features (like top-level <code>await</code> or <code>import</code>), use <code>&lt;script type="module"&gt;</code>.
      </p>
      <p> 
          Similarly, use <code>&lt;style&gt;</code> tags for inline CSS.
      </p>`
    ));

    this.containerElement.appendChild(createSubSection(
      'Inline Front Matter (script:, css:)',
      `<p>
          Embed multiline CSS or JavaScript directly in front matter using YAML block scalars (<code>|</code> or <code>&gt;</code>):
      </p>
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
      <p>
          The <code>css</code> block is injected into <code>&lt;head&gt;</code>. The <code>script</code> block is injected at the end of <code>&lt;body&gt;</code> (wrapped in an IIFE).
      </p>`
    ));
    
    this.containerElement.appendChild(createSubSection(
      'Event Handling',
      `<p>
        Attach event listeners using standard JavaScript (e.g., <code>document.getElementById('my-button').addEventListener('click', ...)</code>).
        Ensure scripts run after relevant DOM elements exist (use <code>DOMContentLoaded</code> or place scripts at the end).
      </p>`
    ));

    this.containerElement.appendChild(createSubSection(
      'Security Considerations',
      `<p>
        Loading local files has security implications. The server restricts file access to <code>.js</code> and <code>.css</code> files within your markdown's directory structure.
        Avoid exposing sensitive data or performing dangerous operations in preview scripts.
      </p>`
    ));
    
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

// Register this panel with the registry
panelRegistry.register({
  id: 'js-settings-container',
  title: 'Preview JavaScript',
  component: JavaScriptPanel,
  order: 50,
  defaultCollapsed: true
}); 