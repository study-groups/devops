// Fix Design Tokens panel to use proper CSS classes - paste in browser console

console.log('🎨 FIXING DESIGN TOKENS WITH PROPER CSS CLASSES');
console.log('==============================================');

(async () => {
    try {
        // Load the Design Tokens panel class
        const DesignTokensModule = await import('/client/settings/panels/css-design/DesignTokensPanel.js');
        const DesignTokensPanel = DesignTokensModule.DesignTokensPanel;
        
        if (!DesignTokensPanel) {
            console.error('❌ Could not load DesignTokensPanel class');
            return;
        }
        
        console.log('✅ DesignTokensPanel class loaded');
        
        // Find the sidebar
        const sidebar = document.getElementById('workspace-sidebar');
        if (!sidebar) {
            console.error('❌ Sidebar not found');
            return;
        }
        
        console.log('✅ Sidebar found');
        
        // Remove any existing design tokens panel
        const existingPanel = sidebar.querySelector('#settings-panel, [id*="design-token"], [class*="design-token"]');
        if (existingPanel) {
            existingPanel.remove();
            console.log('🧹 Removed existing panel');
        }
        
        // ===== CREATE PROPER SIDEBAR PANEL USING DESIGN SYSTEM CLASSES =====
        
        // Main panel container using proper classes
        const panelWrapper = document.createElement('div');
        panelWrapper.id = 'settings-panel';
        panelWrapper.className = 'sidebar-panel'; // ← PROPER CLASS FROM panels.css
        
        // Create proper sidebar panel header 
        const header = document.createElement('div');
        header.className = 'sidebar-panel-header'; // ← PROPER CLASS FROM panels.css
        
        // Header left section (icon + title)
        const headerLeft = document.createElement('div');
        headerLeft.className = 'sidebar-panel-header-left'; // ← PROPER CLASS
        headerLeft.innerHTML = `
            <div class="panel-icon">🎨</div>
            <h3 class="panel-title">Design Tokens</h3>
        `;
        
        // Header controls
        const headerControls = document.createElement('div');
        headerControls.className = 'panel-controls'; // ← PROPER CLASS
        headerControls.innerHTML = `
            <button class="panel-control-btn collapse-btn" title="Collapse">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" fill="none"/>
                </svg>
            </button>
        `;
        
        header.appendChild(headerLeft);
        header.appendChild(headerControls);
        
        // Create proper panel content container
        const contentContainer = document.createElement('div');
        contentContainer.className = 'panel-content'; // ← PROPER CLASS FROM panels.css
        
        // Create the actual Design Tokens panel with FIXED classes
        const designTokensPanel = new DesignTokensPanel({
            id: 'design-tokens-sidebar',
            title: 'Design Tokens'
        });
        
        // Render the panel content
        const panelElement = designTokensPanel.render();
        
        // ===== FIX THE PANEL ELEMENT TO USE PROPER CLASSES =====
        
        // Remove the custom theme-editor-panel class
        panelElement.className = 'design-tokens-content'; // Clean class name
        
        // Fix the header inside the panel content
        const customHeader = panelElement.querySelector('.theme-editor-header');
        if (customHeader) {
            // Replace with proper design system content styling
            customHeader.className = 'token-overview';
            customHeader.style.cssText = `
                padding: 0;
                background: transparent;
                border: none;
                margin-bottom: var(--space-3);
            `;
            
            // Style the inner content properly
            const title = customHeader.querySelector('h3');
            if (title) {
                title.style.cssText = `
                    font-size: var(--font-size-lg);
                    font-weight: var(--font-weight-semibold);
                    color: var(--color-fg);
                    margin: 0 0 var(--space-2) 0;
                `;
            }
            
            const description = customHeader.querySelector('p');
            if (description) {
                description.style.cssText = `
                    color: var(--color-fg-alt);
                    font-size: var(--font-size-sm);
                    margin: 0 0 var(--space-3) 0;
                `;
            }
        }
        
        // Add the fixed content to the panel content container
        contentContainer.appendChild(panelElement);
        
        // Assemble the complete panel
        panelWrapper.appendChild(header);
        panelWrapper.appendChild(contentContainer);
        
        // Add to sidebar at the top (after panel manager if it exists)
        const panelManager = sidebar.querySelector('.panel-manager-container');
        if (panelManager) {
            sidebar.insertBefore(panelWrapper, panelManager.nextSibling);
        } else {
            sidebar.insertBefore(panelWrapper, sidebar.firstChild);
        }
        
        // Mount the panel to load functionality
        if (designTokensPanel.onMount) {
            await designTokensPanel.onMount(contentContainer);
        }
        
        // ===== ADD COLLAPSE/EXPAND FUNCTIONALITY =====
        let isCollapsed = false;
        const collapseBtn = header.querySelector('.collapse-btn');
        
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            
            if (isCollapsed) {
                panelWrapper.classList.add('collapsed');
                contentContainer.style.display = 'none';
                collapseBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    </svg>
                `;
                collapseBtn.title = 'Expand';
            } else {
                panelWrapper.classList.remove('collapsed');
                contentContainer.style.display = 'block';
                collapseBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="1.5" fill="none"/>
                    </svg>
                `;
                collapseBtn.title = 'Collapse';
            }
            
            console.log(`🔄 Panel ${isCollapsed ? 'collapsed' : 'expanded'}`);
        });
        
        // Make header clickable for collapse/expand
        header.addEventListener('click', (e) => {
            if (!e.target.closest('.panel-controls')) {
                collapseBtn.click();
            }
        });
        
        console.log('✅ Design Tokens panel added with PROPER CSS classes!');
        console.log('🎨 Now using design system classes:');
        console.log('   • .sidebar-panel (main container)');
        console.log('   • .sidebar-panel-header (header)');
        console.log('   • .panel-content (content area)');
        console.log('   • .panel-title, .panel-controls (proper elements)');
        console.log('👀 Look in the sidebar - it should look MUCH better now!');
        
        // Add highlight animation
        panelWrapper.style.animation = 'highlight-proper 3s ease-in-out';
        const style = document.createElement('style');
        style.textContent = `
            @keyframes highlight-proper {
                0%, 100% { 
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                    transform: scale(1);
                }
                50% { 
                    box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.3), 0 8px 25px rgba(0, 0, 0, 0.2);
                    transform: scale(1.02);
                }
            }
        `;
        document.head.appendChild(style);
        
        // Clean up animation
        setTimeout(() => {
            panelWrapper.style.animation = '';
        }, 3000);
        
    } catch (error) {
        console.error('❌ Failed to fix Design Tokens panel:', error);
    }
})();

console.log('🎯 RESULT: Design Tokens should now look like a PROPER panel!');
console.log('💡 Using the beautiful design system classes instead of custom CSS');
console.log('🔧 Click the header or arrow to collapse/expand');