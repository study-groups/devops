window.addEventListener('DOMContentLoaded', () => {
    const listContainer = document.getElementById('docs');
    const contentContainer = document.getElementById('docs-panel');
    
    // State management with additional metadata
    const state = {
        docList: [],
        currentDoc: null,
        view: 'empty',
        currentView: 'default',
        isLoading: false,
        filters: {
            tags: [],
            minRating: 0
        },
        userId: null, // Will be loaded from server
        isAuthenticated: false
    };

    // Star rating component
    function createStarRating(rating, onRateChange) {
        const container = document.createElement('div');
        container.className = 'star-rating';
        
        for (let i = 1; i <= 3; i++) {
            const star = document.createElement('span');
            star.innerHTML = '★';
            star.className = i <= rating ? 'star active' : 'star';
            star.addEventListener('click', () => {
                onRateChange(i);
            });
            container.appendChild(star);
        }
        
        return container;
    }

    // Tag management
    function createTagInput(tags = []) {
        const container = document.createElement('div');
        container.className = 'tag-input-container';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Add tags (comma-separated)';
        input.className = 'tag-input';
        
        const tagList = document.createElement('div');
        tagList.className = 'tag-list';
        
        // Render existing tags
        function renderTags() {
            tagList.innerHTML = '';
            tags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = 'tag';
                tagEl.textContent = tag;
                
                const removeBtn = document.createElement('button');
                removeBtn.textContent = '×';
                removeBtn.addEventListener('click', () => {
                    tags = tags.filter(t => t !== tag);
                    renderTags();
                });
                
                tagEl.appendChild(removeBtn);
                tagList.appendChild(tagEl);
            });
        }
        
        // Add new tags
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const newTag = input.value.trim().toLowerCase();
                if (newTag && !tags.includes(newTag)) {
                    tags.push(newTag);
                    input.value = '';
                    renderTags();
                }
            }
        });
        
        container.appendChild(input);
        container.appendChild(tagList);
        
        return {
            element: container,
            getTags: () => tags
        };
    }

    // Tag filter component
    function createTagFilter(allTags, onFilterChange) {
        const container = document.createElement('div');
        container.className = 'tag-filter';
        
        // Show All button
        const showAllBtn = document.createElement('button');
        showAllBtn.textContent = 'Show All';
        showAllBtn.className = 'devwatch-button devwatch-button--ghost devwatch-button--small tag-filter-btn tag-filter-show-all';
        
        // Set initial state based on current filters
        if (state.filters.tags.length === 0) {
            showAllBtn.classList.add('is-active');
        }
        
        showAllBtn.addEventListener('click', () => {
            // Deactivate all other tag buttons
            container.querySelectorAll('.tag-filter-btn:not(.tag-filter-show-all)')
                .forEach(btn => btn.classList.remove('active'));
            
            // Toggle Show All button
            showAllBtn.classList.toggle('is-active');
            
            // If Show All is active, clear filters
            if (showAllBtn.classList.contains('is-active')) {
                state.filters.tags = [];
                saveUserPreferences();
                onFilterChange([]);
            }
        });
        container.appendChild(showAllBtn);
        
        // Remove 'untagged' from unique tags list for display
        const uniqueTags = [...new Set(allTags.flat())]
            .filter(tag => tag !== 'untagged');
        
        // Add Untagged button
        const untaggedBtn = document.createElement('button');
        untaggedBtn.textContent = 'Untagged';
        untaggedBtn.className = 'devwatch-button devwatch-button--ghost devwatch-button--small tag-filter-btn';
        
        // Set initial state
        if (state.filters.tags.includes('untagged')) {
            untaggedBtn.classList.add('active');
        }
        
        untaggedBtn.addEventListener('click', () => {
            // Deactivate Show All button
            showAllBtn.classList.remove('is-active');
            
            // Toggle Untagged button
            untaggedBtn.classList.toggle('active');
            
            // Get active tags and update state
            const activeTags = Array.from(container.querySelectorAll('.tag-filter-btn.active'))
                .map(btn => btn.textContent.toLowerCase());
            
            state.filters.tags = activeTags;
            saveUserPreferences();
            onFilterChange(activeTags);
        });
        container.appendChild(untaggedBtn);
        
        // Add other tag buttons
        uniqueTags.forEach(tag => {
            const tagBtn = document.createElement('button');
            tagBtn.textContent = tag;
            tagBtn.className = 'devwatch-button devwatch-button--ghost devwatch-button--small tag-filter-btn';
            
            // Set initial state
            if (state.filters.tags.includes(tag.toLowerCase())) {
                tagBtn.classList.add('active');
            }
            
            tagBtn.addEventListener('click', () => {
                // Deactivate Show All button
                showAllBtn.classList.remove('is-active');
                
                // Toggle this tag button
                tagBtn.classList.toggle('active');
                
                // Get active tags and update state
                const activeTags = Array.from(container.querySelectorAll('.tag-filter-btn.active'))
                    .map(btn => btn.textContent.toLowerCase());
                
                state.filters.tags = activeTags;
                saveUserPreferences();
                onFilterChange(activeTags);
            });
            
            container.appendChild(tagBtn);
        });
        
        return container;
    }

    const rankedList = new DevWatchRankedList('pja-docs-ranking');
    let confirmButton = null;

    function setState(newState) {
        Object.assign(state, newState);
        render();
    }

    // Load current user info from server
    async function loadCurrentUser() {
        try {
            const response = await fetch('/api/docs/whoami');
            if (response.ok) {
                const userInfo = await response.json();
                state.userId = userInfo.user;
                state.isAuthenticated = userInfo.isAuthenticated;
                console.log('[DOCS] Current user:', userInfo);
                
                // Show user info in UI
                showUserInfo(userInfo);
            }
        } catch (error) {
            console.warn('[DOCS] Could not load user info:', error);
            state.userId = 'anonymous';
            state.isAuthenticated = false;
        }
    }

    // Show user info in the UI
    function showUserInfo(userInfo) {
        const userDisplay = document.createElement('div');
        userDisplay.className = 'user-info';
        userDisplay.innerHTML = `
            <span class="user-badge ${userInfo.isAuthenticated ? 'authenticated' : 'anonymous'}">
                ${userInfo.isAuthenticated ? `👤 ${userInfo.user}` : '👤 anonymous'}
            </span>
        `;
        
        // Add to the docs list header
        const header = listContainer.querySelector('.devwatch-docs-list-header');
        if (header && !header.querySelector('.user-info')) {
            header.appendChild(userDisplay);
        }
    }

    // Load user preferences from server
    async function loadUserPreferences() {
        if (!state.userId) return;
        
        try {
            const response = await fetch(`/api/docs/preferences/${state.userId}`);
            if (response.ok) {
                const prefs = await response.json();
                state.filters.tags = prefs.tagFilters || [];
                state.filters.minRating = prefs.minRating || 0;
                state.currentView = prefs.currentView || 'default';
                console.log('[DOCS] Loaded user preferences:', prefs);
            }
        } catch (error) {
            console.warn('[DOCS] Could not load user preferences:', error);
        }
    }

    // Save user preferences to server
    async function saveUserPreferences() {
        try {
            const prefs = {
                tagFilters: state.filters.tags,
                minRating: state.filters.minRating,
                currentView: state.currentView
            };
            
            const response = await fetch(`/api/docs/preferences/${state.userId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prefs)
            });
            
            if (response.ok) {
                console.log('[DOCS] Saved user preferences:', prefs);
            }
        } catch (error) {
            console.warn('[DOCS] Could not save user preferences:', error);
        }
    }

    // Show order save prompt
    function showOrderSavePrompt(newOrder) {
        // Remove any existing prompt
        const existingPrompt = listContainer.querySelector('.order-save-prompt');
        if (existingPrompt) {
            existingPrompt.remove();
        }

        // Create save prompt
        const promptDiv = document.createElement('div');
        promptDiv.className = 'order-save-prompt';
        const userDisplay = state.isAuthenticated ? state.userId : 'anonymous user';
        promptDiv.innerHTML = `
            <div class="order-save-content">
                <p><strong>Document order changed by ${userDisplay}</strong></p>
                <p>Save this order for all users?</p>
                <div class="order-save-actions">
                    <button class="devwatch-button devwatch-button--primary devwatch-button--small" data-action="save-global-order">Save for Everyone</button>
                    <button class="devwatch-button devwatch-button--ghost devwatch-button--small" data-action="revert-order">Revert</button>
                </div>
            </div>
        `;

        // Store the new order for later use
        promptDiv.dataset.newOrder = JSON.stringify(newOrder);

        // Insert after the header
        const header = listContainer.querySelector('.devwatch-docs-list-header');
        header.insertAdjacentElement('afterend', promptDiv);

        // Add event listeners
        promptDiv.querySelector('[data-action="save-global-order"]').addEventListener('click', () => {
            saveGlobalOrder(newOrder);
            promptDiv.remove();
        });

        promptDiv.querySelector('[data-action="revert-order"]').addEventListener('click', () => {
            loadDocs(); // Reload to revert changes
            promptDiv.remove();
        });
    }

    // Save global document order
    async function saveGlobalOrder(newOrder) {
        try {
            const response = await fetch('/api/docs/order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    view: state.currentView, 
                    order: newOrder,
                    timestamp: new Date().toISOString()
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('[DOCS] Global order saved successfully by:', result.savedBy);
                // Show success message briefly
                showOrderSaveSuccess(result.savedBy);
            } else {
                throw new Error('Failed to save order');
            }
        } catch (error) {
            console.error('Failed to save global document order:', error);
            alert('Could not save document order for everyone. Please try again.');
            loadDocs(); // Reload to revert changes
        }
    }

    // Show success message
    function showOrderSaveSuccess(savedBy) {
        const successDiv = document.createElement('div');
        successDiv.className = 'order-save-success';
        successDiv.innerHTML = `
            <div class="order-save-content">
                <p><strong>✓ Order saved for all users by ${savedBy}</strong></p>
            </div>
        `;

        const header = listContainer.querySelector('.devwatch-docs-list-header');
        header.insertAdjacentElement('afterend', successDiv);

        // Remove after 3 seconds
        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    async function initializeDocs() {
        listContainer.addEventListener('click', handleActionDelegation);
        contentContainer.addEventListener('click', handleActionDelegation);
        listContainer.addEventListener('click', handleViewChange);
        
        // Load user info first, then preferences, then docs
        await loadCurrentUser();
        await loadUserPreferences();
        loadDocs();
    }

    async function loadDocs() {
        setState({ isLoading: true });
        try {
            console.log(`[DOCS] Attempting to load documents for view: ${state.currentView}`);
            const response = await fetch(`/api/docs?view=${state.currentView}`);
            console.log('[DOCS] Fetch response:', {
                status: response.status,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[DOCS] Fetch error:', {
                    status: response.status,
                    statusText: response.statusText,
                    errorText
                });
                throw new Error(`Failed to fetch docs. Status: ${response.status}`);
            }
            
            const docList = await response.json();
            console.log('[DOCS] Loaded documents:', {
                count: docList.length,
                documents: docList
            });
            
            // Debug: Check if any documents have undefined properties
            docList.forEach((doc, index) => {
                if (!doc || !doc.name || !doc.title) {
                    console.error(`[DOCS] Document at index ${index} has undefined properties:`, doc);
                }
            });
            
            if (docList.length === 0) {
                console.warn('[DOCS] No documents found');
            }
            
            setState({ 
                docList, 
                isLoading: false, 
                view: docList.length > 0 ? 'empty' : 'empty', 
                currentDoc: null 
            });
            
            // Force render to show documents or empty state
            render();
        } catch (error) {
            console.error('[DOCS] Error loading docs:', {
                message: error.message,
                stack: error.stack
            });
            setState({ 
                docList: [], 
                isLoading: false, 
                view: 'empty' 
            });
        }
    }

    async function loadDocContent(filename) {
        if (!filename) {
            console.error('No filename provided');
            return;
        }

        setState({ isLoading: true });
        try {
            const response = await fetch(`/api/docs/${filename}`);
            if (!response.ok) throw new Error(`Failed to fetch ${filename}. Status: ${response.status}`);
            
            const doc = await response.json();
            setState({ 
                currentDoc: doc, 
                view: 'doc', 
                isLoading: false 
            });
        } catch (error) {
            console.error('Error loading doc:', error);
            alert('Failed to load document. See the console for more details.');
            setState({ isLoading: false, view: 'empty' });
        }
    }

    async function handleSaveDoc({ filename, content, tags, rating, title }) {
        if (!filename) {
            alert('Filename is required.');
            return;
        }

        setState({ isLoading: true });
        try {
            const response = await fetch('/api/docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, content, tags, rating, title }),
            });

            if (!response.ok) throw new Error('Failed to save document');
            
            await loadDocs();
            loadDocContent(filename);
        } catch (error) {
            console.error('Error saving doc:', error);
            alert('Error saving document: ' + error.message);
            setState({ isLoading: false });
        }
    }

    async function handleDeleteDoc() {
        if (!state.currentDoc) return;
        const { name } = state.currentDoc;

        setState({ isLoading: true });
        try {
            const response = await fetch(`/api/docs/${name}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete document');
            
            await loadDocs(); // Reload list and reset view
        } catch (error) {
            console.error('Error deleting doc:', error);
            alert('Error deleting document.');
            setState({ isLoading: false });
        }
    }

    function handleViewChange(e) {
        const viewButton = e.target.closest('.devwatch-docs-views > .devwatch-button');
        if (!viewButton) return;

        const viewName = viewButton.textContent.toLowerCase();
        
        // Remove active class from all view buttons
        const allViewButtons = listContainer.querySelectorAll('.devwatch-docs-views > .devwatch-button');
        allViewButtons.forEach(btn => btn.classList.remove('is-active'));

        // Add active class to the clicked button
        viewButton.classList.add('is-active');

        setState({ currentView: viewName });
        
        // Save the view preference
        saveUserPreferences();
        
        loadDocs();
    }
    
    function handleActionDelegation(e) {
        const actionTarget = e.target.closest('[data-action]');
        if (!actionTarget) return;

        e.preventDefault();
        const { action, filename } = actionTarget.dataset;

        switch (action) {
            case 'view-doc':
                if (filename) {
                    loadDocContent(filename);
                } else {
                    console.error('view-doc action triggered with no filename.');
                }
                break;
            case 'rank-up':
                rankedList.increaseRank(filename);
                render();
                break;
            case 'rank-down':
                rankedList.decreaseRank(filename);
                render();
                break;
            case 'new-doc':
                setState({ view: 'edit', currentDoc: { name: '', content: '', tags: [], rating: 0 } });
                break;
            case 'edit-doc':
                setState({ view: 'edit' });
                break;
            case 'save-doc':
                handleSaveDoc({ filename: state.currentDoc.name, content: state.currentDoc.content, tags: state.currentDoc.tags, rating: state.currentDoc.rating });
                break;
            case 'cancel-edit':
                setState({ view: state.currentDoc && state.currentDoc.name ? 'doc' : 'empty' });
                break;
        }
    }
    
    function renderListView() {
        console.log('[DOCS] Rendering list view. Documents:', state.docList);
        
        let listContent = `
            <div class="pja-docs-list-header">
                <div class="pja-docs-views">
                    <button class="devwatch-button devwatch-button--ghost devwatch-button--small ${state.currentView === 'default' ? 'is-active' : ''}">Default</button>
                    <button class="devwatch-button devwatch-button--ghost devwatch-button--small ${state.currentView === 'executive' ? 'is-active' : ''}">Executive</button>
                </div>
                <div class="docs-list-controls">
                    <button class="devwatch-button devwatch-button--secondary devwatch-button--small" data-action="new-doc">New</button>
                </div>
            </div>
            <div class="tag-filter-container"></div>
            <ul class="pja-ranked-list" id="docs-sortable">`;

        if (state.docList.length > 0) {
            listContent += state.docList.map(doc => {
                const isActive = state.currentDoc && state.currentDoc.name === doc.name;
                
                return `
                    <li class="pja-ranked-list-item ${isActive ? 'is-active' : ''}" data-filename="${doc.name}">
                        <a href="#" class="pja-ranked-list-item-link" data-action="view-doc" data-filename="${doc.name}">
                            <span class="icon icon-document"></span>
                            ${doc.title}
                        </a>
                    </li>`;
            }).join('');
        } else {
            listContent += `<li class="pja-ranked-list-empty">No documents found. Click "New" to create one.</li>`;
        }
        listContent += `</ul>`;

        console.log('[DOCS] List content:', listContent);
        listContainer.innerHTML = listContent;

        // Enable drag and drop reordering
        if (window.Sortable) {
            Sortable.create(document.getElementById('docs-sortable'), {
                animation: 150,
                onEnd: async (evt) => {
                    const newOrder = Array.from(evt.to.children)
                        .map(li => li.dataset.filename);
                    
                    // Update local state immediately for responsive UI
                    state.docList.sort((a, b) => 
                        newOrder.indexOf(a.name) - newOrder.indexOf(b.name)
                    );

                    // Show save order button instead of auto-saving
                    showOrderSavePrompt(newOrder);
                }
            });
        }
    }

    function renderEmptyView() {
        contentContainer.innerHTML = `
            <div class="devwatch-section is-open">
                <div class="devwatch-section-header">
                    <h4 class="devwatch-section-title">Documentation Viewer</h4>
                </div>
                <div class="devwatch-section-content">
                    <p class="pja-text-muted">Select a document from the list to view its contents.</p>
                </div>
            </div>`;
    }

    function renderDocView() {
        const { name, content } = state.currentDoc;
        contentContainer.innerHTML = `
            <div class="devwatch-section is-open">
                <div class="devwatch-section-header">
                    <h4 class="devwatch-section-title">${name}</h4>
                    <div class="devwatch-section-actions">
                        <button class="devwatch-button devwatch-button--ghost" data-action="edit-doc">Edit</button>
                    </div>
                </div>
                <div class="devwatch-section-content pja-docs-viewer">
                    ${marked.parse(content)}
                </div>
            </div>`;
            
        // After rendering, find and render any Mermaid diagrams
        try {
            const isDarkMode = !document.body.dataset.theme || !document.body.dataset.theme.includes('minimal');
            
            const pjaTheme = {
                theme: 'base',
                themeVariables: {
                    background: getComputedStyle(document.body).getPropertyValue('--devwatch-bg-secondary'),
                    primaryColor: getComputedStyle(document.body).getPropertyValue('--devwatch-bg-tertiary'),
                    primaryTextColor: getComputedStyle(document.body).getPropertyValue('--devwatch-text-primary'),
                    primaryBorderColor: getComputedStyle(document.body).getPropertyValue('--devwatch-border-accent'),
                    lineColor: getComputedStyle(document.body).getPropertyValue('--devwatch-text-secondary'),
                    secondaryColor: getComputedStyle(document.body).getPropertyValue('--devwatch-accent-secondary'),
                    tertiaryColor: getComputedStyle(document.body).getPropertyValue('--devwatch-bg-elevated'),
                    textColor: getComputedStyle(document.body).getPropertyValue('--devwatch-text-primary'),
                    nodeTextColor: getComputedStyle(document.body).getPropertyValue('--devwatch-text-primary'),
                }
            };

            mermaid.initialize({ 
                startOnLoad: false, 
                theme: isDarkMode ? 'base' : 'default',
                themeVariables: isDarkMode ? pjaTheme.themeVariables : {}
            });

            mermaid.run({
                nodes: contentContainer.querySelectorAll('pre.mermaid, .language-mermaid')
            });

            // Add magnifier functionality for Mermaid diagrams
            const mermaidDiagrams = contentContainer.querySelectorAll('pre.mermaid, .language-mermaid');
            mermaidDiagrams.forEach(diagram => {
                // Create magnifier container
                const magnifierContainer = document.createElement('div');
                magnifierContainer.classList.add('pja-mermaid-magnifier');
                
                // Create magnifier button
                const magnifyButton = document.createElement('button');
                magnifyButton.classList.add('devwatch-button', 'devwatch-button--ghost', 'pja-mermaid-magnify-btn');
                magnifyButton.innerHTML = '<span class="icon icon-zoom-in"></span>';
                
                // Create modal for enlarged view
                const magnifyModal = document.createElement('div');
                magnifyModal.classList.add('pja-mermaid-magnify-modal');
                
                // Clone the diagram for the modal
                const enlargedDiagram = diagram.cloneNode(true);
                magnifyModal.appendChild(enlargedDiagram);
                
                // Close button for modal
                const closeButton = document.createElement('button');
                closeButton.classList.add('devwatch-button', 'devwatch-button--ghost', 'pja-mermaid-magnify-close');
                closeButton.innerHTML = '<span class="icon icon-close"></span>';
                magnifyModal.appendChild(closeButton);
                
                // Wrap original diagram
                const diagramWrapper = document.createElement('div');
                diagramWrapper.classList.add('pja-mermaid-diagram-wrapper');
                diagram.parentNode.insertBefore(diagramWrapper, diagram);
                diagramWrapper.appendChild(diagram);
                
                // Add magnifier elements
                diagramWrapper.appendChild(magnifierContainer);
                magnifierContainer.appendChild(magnifyButton);
                document.body.appendChild(magnifyModal);
                
                // Event listeners
                magnifyButton.addEventListener('click', () => {
                    magnifyModal.classList.add('is-open');
                });
                
                closeButton.addEventListener('click', () => {
                    magnifyModal.classList.remove('is-open');
                });
            });
        } catch (error) {
            console.error('Mermaid rendering or magnifier setup failed:', error);
        }
    }

    function renderEditView() {
        const { name, content, tags = [], rating = 0, title = '' } = state.currentDoc || {};
        
        // Create tag input
        const tagInput = createTagInput(tags);
        
        // Create star rating
        const starRating = createStarRating(rating, (newRating) => {
            if (state.currentDoc) {
                state.currentDoc.rating = newRating;
            }
        });
        
        contentContainer.innerHTML = `
            <div class="devwatch-section is-open">
                 <div class="devwatch-section-header">
                    <h4 class="devwatch-section-title">${name ? name : 'New Document'}</h4>
                    <div class="devwatch-section-actions">
                        <button id="delete-doc-btn" class="devwatch-button devwatch-button--danger-ghost devwatch-button--small" title="Delete document"><span class="icon icon-delete"></span></button>
                        <button class="devwatch-button devwatch-button--ghost devwatch-button--small" data-action="cancel-edit">Cancel</button>
                        <button class="devwatch-button devwatch-button--primary devwatch-button--small" data-action="save-doc">Save</button>
                    </div>
                </div>
                <div class="devwatch-section-content pja-docs-editor">
                    <div class="doc-edit-header">
                        <input type="text" id="doc-title" class="devwatch-input" placeholder="Document Title" value="${title}" />
                        <div class="doc-edit-meta">
                           <input type="text" id="doc-filename" class="devwatch-input" placeholder="Enter filename.md" value="${name || ''}" />
                           <div class="doc-rating-container"></div>
                           <div class="doc-tags-container"></div>
                        </div>
                    </div>
                    <textarea id="doc-content" class="pja-textarea">${content || ''}</textarea>
                </div>
            </div>
        `;
        
        // Append star rating and tag input
        const ratingContainer = contentContainer.querySelector('.doc-rating-container');
        const tagsContainer = contentContainer.querySelector('.doc-tags-container');
        
        ratingContainer.appendChild(starRating);
        tagsContainer.appendChild(tagInput.element);
        
        const deleteBtn = contentContainer.querySelector('#delete-doc-btn');
        if (deleteBtn) {
            confirmButton = new DevWatchConfirmButton(deleteBtn, {
                onConfirm: handleDeleteDoc
            });
        }
        
        // Override save to include tags, rating, and title
        const saveBtn = contentContainer.querySelector('[data-action="save-doc"]');
        saveBtn.addEventListener('click', () => {
            const filenameInput = contentContainer.querySelector('#doc-filename');
            const titleInput = contentContainer.querySelector('#doc-title');
            const contentInput = contentContainer.querySelector('#doc-content');
            
            const filename = filenameInput.value.trim();
            const title = titleInput.value.trim();
            const content = contentInput.value;
            
            handleSaveDoc({
                filename, 
                content, 
                tags: tagInput.getTags(),
                rating: state.currentDoc?.rating || 0,
                title
            });
        });
    }

    function render() {
        if (state.isLoading) {
            listContainer.classList.add('is-loading');
            contentContainer.classList.add('is-loading');
        } else {
            listContainer.classList.remove('is-loading');
            contentContainer.classList.remove('is-loading');
        }

        renderListView();

        switch (state.view) {
            case 'doc':
                renderDocView();
                break;
            case 'edit':
                renderEditView();
                break;
            case 'empty':
            default:
                renderEmptyView();
                break;
        }
    }

    initializeDocs();
});
