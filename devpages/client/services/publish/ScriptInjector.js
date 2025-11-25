/**
 * ScriptInjector - Handles plugin script injection for preview/publish
 */

const log = window.APP?.services?.log?.createLogger('ScriptInjector') || console;

export class ScriptInjector {
  /**
   * Build all plugin scripts for the document
   * @param {Object} options - Script options
   * @param {Object} options.pluginsState - Plugin enabled states
   * @param {boolean} options.isPreview - Whether this is preview mode
   * @param {Object} options.theme - Current theme
   * @returns {string} Combined script tags and content
   */
  buildPluginScripts(options) {
    const { pluginsState, isPreview, theme } = options;
    const scripts = [];

    const katexEnabled = pluginsState?.katex?.enabled;
    const mermaidEnabled = pluginsState?.mermaid?.enabled;

    // KaTeX scripts (preview only)
    if (katexEnabled && isPreview) {
      scripts.push(this.buildKatexScript());
    }

    // Mermaid scripts (preview only)
    if (mermaidEnabled && isPreview) {
      scripts.push(this.buildMermaidScript(theme));
    }

    // Ready signal script (preview only)
    if (isPreview) {
      scripts.push(this.buildReadySignalScript());
      scripts.push(this.buildMarkdownUtilityScript());
    }

    return scripts.join('\n');
  }

  /**
   * Build KaTeX script tags
   * @returns {string} KaTeX script HTML
   */
  buildKatexScript() {
    return `
    <!-- KaTeX Scripts -->
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js" crossorigin="anonymous"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js" crossorigin="anonymous" onload="renderMath()"></script>
    <script>
      function renderMath() {
        renderMathInElement(document.body, {
          delimiters: [
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false},
            {left: '\\\\[', right: '\\\\]', display: true},
            {left: '\\\\(', right: '\\\\)', display: false}
          ],
          throwOnError: false
        });
      }
    </script>`;
  }

  /**
   * Build Mermaid script and styles
   * @param {Object} theme - Current theme
   * @returns {string} Mermaid script HTML
   */
  buildMermaidScript(theme) {
    const themeMode = theme?.mode === 'dark' ? 'dark' : 'default';

    return `
    <!-- Mermaid Script -->
    <script src="/client/vendor/scripts/mermaid.min.js"></script>
    <script>
      // Initialize and render mermaid diagrams
      (function() {
        if (typeof mermaid === 'undefined') {
          console.error('[PLUGIN] Mermaid library not loaded');
          return;
        }

        mermaid.initialize({
          startOnLoad: true,
          theme: '${themeMode}',
          securityLevel: 'loose',
          flowchart: {
            useMaxWidth: true,
            htmlLabels: true
          }
        });

        // Force init after load
        window.addEventListener('load', function() {
          try {
            if (mermaid.run) {
              mermaid.run();
            } else if (mermaid.init) {
              mermaid.init(undefined, document.querySelectorAll('.mermaid'));
            }
          } catch(e) {
            console.error('[PLUGIN] Mermaid rendering error:', e.message);
          }
        });
      })();
    </script>
    <style>
      /* Mermaid diagram styling */
      .mermaid {
        background: transparent !important;
        text-align: center;
        margin: 1em 0;
        color: var(--color-fg, #e5e5e5);
      }
      pre.mermaid {
        background: transparent !important;
        border: none !important;
        padding: 0 !important;
      }
      /* Fix dark theme text visibility */
      .mermaid svg {
        max-width: 100%;
      }
      /* Better text visibility */
      .mermaid .nodeLabel,
      .mermaid .edgeLabel,
      .mermaid .label {
        color: inherit !important;
      }
    </style>`;
  }

  /**
   * Build ready signal script for preview synchronization
   * @returns {string} Ready signal script HTML
   */
  buildReadySignalScript() {
    return `
    <script>
      // Wait for all async plugins (Mermaid, KaTeX, Graphviz, etc.) to finish rendering
      // then notify parent that preview is ready
      (function() {
        function notifyReady() {
          window.parent.postMessage('preview-ready', '*');
        }

        // Track which plugins need to finish
        const pluginChecks = [];

        // Check for Mermaid diagrams
        const mermaidElements = document.querySelectorAll('.mermaid');
        if (mermaidElements.length > 0) {
          pluginChecks.push(() => {
            // Wait for Mermaid library to load AND render
            if (!window.mermaid) return false;

            // Check if all mermaid elements have SVG children with content
            return Array.from(mermaidElements).every(el => {
              const svg = el.querySelector('svg');
              if (!svg) return false;

              // Ensure SVG has actual content (not empty)
              const hasElements = svg.children.length > 0;

              // Check if SVG has rendered dimensions
              try {
                const bbox = svg.getBBox();
                return hasElements && bbox.width > 0 && bbox.height > 0;
              } catch (e) {
                // getBBox can fail if SVG isn't ready
                return false;
              }
            });
          });
        }

        // Check for KaTeX math (waits for fonts/layout)
        const katexElements = document.querySelectorAll('.katex');
        if (katexElements.length > 0) {
          pluginChecks.push(() => {
            // KaTeX is sync but fonts may load async
            // Check if any katex elements have zero dimensions (not rendered yet)
            return Array.from(katexElements).every(el => el.offsetHeight > 0);
          });
        }

        // Check for Graphviz diagrams
        const graphvizElements = document.querySelectorAll('.graphviz, [data-graphviz]');
        if (graphvizElements.length > 0) {
          pluginChecks.push(() => {
            // Check if SVG has been inserted
            return Array.from(graphvizElements).every(el => el.querySelector('svg'));
          });
        }

        // Generic check: wait for all images to load
        const images = document.querySelectorAll('img');
        if (images.length > 0) {
          let imagesLoaded = 0;
          const totalImages = images.length;

          pluginChecks.push(() => imagesLoaded >= totalImages);

          images.forEach(img => {
            if (img.complete) {
              imagesLoaded++;
            } else {
              img.addEventListener('load', () => imagesLoaded++);
              img.addEventListener('error', () => imagesLoaded++);
            }
          });
        }

        // If no async content detected, still wait a bit for DOM to settle
        if (pluginChecks.length === 0) {
          setTimeout(notifyReady, 100);
          return;
        }

        // Poll all checks until complete
        let pollCount = 0;
        const maxPolls = 40; // 40 * 50ms = 2 seconds max

        const checkAll = setInterval(() => {
          pollCount++;

          const allReady = pluginChecks.every(check => check());

          if (allReady || pollCount >= maxPolls) {
            clearInterval(checkAll);
            // Extra delay to ensure layout is completely stable after plugins render
            setTimeout(notifyReady, 150);
          }
        }, 50);
      })();
    </script>`;
  }

  /**
   * Build markdown utility handler script for interactive buttons
   * @returns {string} Utility handler script HTML
   */
  buildMarkdownUtilityScript() {
    return `
    <!-- Markdown Utility Handler -->
    <script>
      (function() {
        const utilityActions = {
          async 'delete-image'(button, params) {
            const imageName = params.imageName || params['image-name'];
            if (!imageName) {
              showFeedback(button, 'Error: No image specified', 'error');
              return;
            }

            // Use modal confirmation instead of native confirm
            const confirmed = await window.parent.APP.services.confirmModal.show({
              title: 'Delete Image?',
              message: \`Are you sure you want to delete "\${decodeURIComponent(imageName)}"? This action cannot be undone.\`,
              confirmText: 'Delete',
              cancelText: 'Cancel',
              type: 'danger'
            });

            if (!confirmed) {
              return;
            }
            try {
              const originalText = button.textContent;
              button.disabled = true;
              button.textContent = 'Deleting...';
              const response = await fetch('/api/images/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ url: \`/uploads/\${decodeURIComponent(imageName)}\` })
              });
              if (!response.ok) throw new Error(\`Failed to delete image: \${response.status}\`);
              showFeedback(button, 'Image deleted successfully!', 'success');
              setTimeout(() => {
                if (window.parent && window.parent.APP) {
                  window.parent.postMessage({ type: 'reload-current-file' }, '*');
                } else {
                  window.location.reload();
                }
              }, 1000);
            } catch (error) {
              console.error('Error deleting image:', error);
              showFeedback(button, \`Error: \${error.message}\`, 'error');
              button.disabled = false;
              button.textContent = originalText;
            }
          }
        };

        function showFeedback(button, message, type = 'info') {
          const existingFeedback = button.parentElement.querySelector('.utility-feedback');
          if (existingFeedback) existingFeedback.remove();
          const feedback = document.createElement('div');
          feedback.className = \`utility-feedback utility-feedback-\${type}\`;
          feedback.textContent = message;
          feedback.style.cssText = \`
            display: inline-block; margin-left: 1rem; padding: 0.5rem 1rem;
            border-radius: 4px; font-size: 0.875rem; animation: fadeIn 0.3s ease-in;
            \${type === 'success' ? 'background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7;' : ''}
            \${type === 'error' ? 'background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;' : ''}
            \${type === 'info' ? 'background: #dbeafe; color: #1e40af; border: 1px solid #93c5fd;' : ''}
          \`;
          button.parentElement.insertBefore(feedback, button.nextSibling);
          setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transition = 'opacity 0.3s';
            setTimeout(() => feedback.remove(), 300);
          }, 5000);
        }

        function extractDataParams(element) {
          const params = {};
          for (const attr of element.attributes) {
            if (attr.name.startsWith('data-')) {
              const key = attr.name.slice(5).replace(/-([a-z])/g, (g) => g[1].toUpperCase());
              params[key] = attr.value;
            }
          }
          return params;
        }

        const style = document.createElement('style');
        style.textContent = \`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
          button[data-action] { cursor: pointer; transition: opacity 0.2s; }
          button[data-action]:disabled { opacity: 0.6; cursor: not-allowed; }
        \`;
        document.head.appendChild(style);

        document.addEventListener('click', async (e) => {
          const button = e.target.closest('[data-action]');
          if (!button) return;

          console.log('[MarkdownUtility] Button clicked:', button.dataset.action);

          // Prevent event from bubbling anywhere
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          e.alreadyHandled = true;

          const action = button.dataset.action;
          const handler = utilityActions[action];
          if (!handler) {
            console.warn(\`[MarkdownUtility] No handler for action: \${action}\`);
            showFeedback(button, \`Unknown action: \${action}\`, 'error');
            return;
          }
          const params = extractDataParams(button);
          console.log(\`[MarkdownUtility] Executing: \${action}\`, params);
          try {
            await handler(button, params);
          } catch (error) {
            console.error(\`[MarkdownUtility] Error:\`, error);
            showFeedback(button, \`Error: \${error.message}\`, 'error');
          }
        }, true);

        console.log('[MarkdownUtility] Handler initialized');
      })();
    </script>`;
  }

  /**
   * Get KaTeX stylesheet link
   * @returns {string} KaTeX CSS link tag
   */
  getKatexStylesheet() {
    return '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" crossorigin="anonymous">';
  }
}

export const scriptInjector = new ScriptInjector();
