/**
 * Preview System Fix
 * Properly integrates with existing preview modules and plugins
 */

document.addEventListener('DOMContentLoaded', function() {
  // Wait for other scripts to initialize
  setTimeout(async function() {
    console.log('[PREVIEW FIX] Initializing preview system with plugins');
    
    // Elements
    const editor = document.querySelector('#md-editor textarea');
    const previewContainer = document.getElementById('md-preview');
    
    // Check if elements exist
    if (!editor || !previewContainer) {
      console.error('[PREVIEW FIX] Required elements missing');
      return;
    }
    
    // Try to use the main initPreview function from your module directly
    try {
      console.log('[PREVIEW FIX] Attempting to use existing initPreview function');
      
      const previewModule = await import('./preview/index.js');
      
      if (previewModule && typeof previewModule.initPreview === 'function') {
        // Initialize with all available plugins
        const result = await previewModule.initPreview({
          container: '#md-preview',
          plugins: ['highlight', 'mermaid', 'katex', 'audio-md', 'github-md'],
          theme: 'light',
          autoInit: true,
          debug: true
        });
        
        console.log('[PREVIEW FIX] Preview system initialization result:', result);
        
        // Set up update function to use module's updatePreview
        if (typeof previewModule.updatePreview === 'function') {
          // Create a wrapper that ensures proper content is passed
          const updatePreview = async () => {
            const content = editor?.value || '';
            console.log('[PREVIEW FIX] Updating preview with content length:', content.length);
            
            try {
              await previewModule.updatePreview(content);
              console.log('[PREVIEW FIX] Preview updated successfully');
            } catch (error) {
              console.error('[PREVIEW FIX] Error updating preview:', error);
            }
          };
          
          // Connect to editor input with debounce
          editor.addEventListener('input', function() {
            if (window.previewUpdateTimer) clearTimeout(window.previewUpdateTimer);
            window.previewUpdateTimer = setTimeout(updatePreview, 300);
          });
          
          // Connect to view changes
          document.addEventListener('view:changed', function(e) {
            const mode = e.detail?.mode;
            console.log(`[PREVIEW FIX] View changed to ${mode}`);
            
            if (mode === 'preview' || mode === 'split') {
              setTimeout(updatePreview, 100);
            }
          });
          
          // Connect refresh button
          const refreshBtn = document.getElementById('refresh-btn');
          if (refreshBtn) {
            refreshBtn.addEventListener('click', updatePreview);
            console.log('[PREVIEW FIX] Connected refresh button');
          }
          
          // Make the update function globally available
          window.updateMarkdownPreview = updatePreview;
          
          // Force initial update
          updatePreview();
          
          console.log('[PREVIEW FIX] Preview update function connected');
          return;
        }
      }
    } catch (error) {
      console.error('[PREVIEW FIX] Error with main preview initialization:', error);
    }
    
    // If we get here, the first method failed, try manual initialization
    console.log('[PREVIEW FIX] Falling back to manual plugin initialization');
    
    try {
      // Initialize mermaid explicitly
      if (window.mermaid) {
        console.log('[PREVIEW FIX] Initializing mermaid');
        window.mermaid.initialize({ 
          startOnLoad: true,
          theme: 'default',
          securityLevel: 'loose'
        });
      } else {
        console.warn('[PREVIEW FIX] Mermaid not found on window object');
        
        // Try to load mermaid from CDN if not available
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js';
        script.onload = function() {
          console.log('[PREVIEW FIX] Mermaid loaded from CDN');
          window.mermaid.initialize({ 
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose' 
          });
        };
        document.head.appendChild(script);
      }
      
      // Try to use the renderer module directly
      const rendererModule = await import('./preview/renderer.js');
      
      if (rendererModule && typeof rendererModule.renderMarkdown === 'function') {
        // Create a function that uses the renderer directly
        const updatePreview = async () => {
          const content = editor?.value || '';
          console.log('[PREVIEW FIX] Updating preview with direct renderer, content length:', content.length);
          
          try {
            // Pre-process for mermaid if needed
            let processedContent = content;
            
            // Render the markdown
            await rendererModule.renderMarkdown(processedContent, previewContainer);
            console.log('[PREVIEW FIX] Preview updated via direct renderer');
            
            // Post-process for mermaid if needed
            if (window.mermaid) {
              try {
                window.mermaid.init(undefined, document.querySelectorAll('.mermaid'));
                console.log('[PREVIEW FIX] Mermaid diagrams initialized');
              } catch (mermaidError) {
                console.warn('[PREVIEW FIX] Mermaid initialization error:', mermaidError);
              }
            }
          } catch (error) {
            console.error('[PREVIEW FIX] Error with direct rendering:', error);
          }
        };
        
        // Connect the same event handlers as above
        editor.addEventListener('input', function() {
          if (window.previewUpdateTimer) clearTimeout(window.previewUpdateTimer);
          window.previewUpdateTimer = setTimeout(updatePreview, 300);
        });
        
        document.addEventListener('view:changed', function(e) {
          if (e.detail?.mode === 'preview' || e.detail?.mode === 'split') {
            setTimeout(updatePreview, 100);
          }
        });
        
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', updatePreview);
        }
        
        window.updateMarkdownPreview = updatePreview;
        updatePreview();
        
        console.log('[PREVIEW FIX] Direct renderer connected');
      }
    } catch (error) {
      console.error('[PREVIEW FIX] Error in fallback initialization:', error);
    }
  }, 600);
}); 