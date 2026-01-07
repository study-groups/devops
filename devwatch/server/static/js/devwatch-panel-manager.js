class DevWatchPanelManager {
    constructor(options) {
        this.elements = {
            container: document.querySelector(options.container),
            tabs: document.querySelectorAll(options.tabs),
            tabPanels: document.querySelectorAll(options.tabPanels),
            coupledPanels: document.querySelectorAll(options.coupledPanels),
            resizer: document.querySelector(options.resizer),
            rightColumn: document.getElementById('right-column'), // Added for restructuring
        };

        this.state = {
            layout: 'wide',
            activeTab: options.initialTab || 'system',
            isResizing: false,
            // Load persisted width from localStorage, defaulting to null to let CSS handle initial state
            columnWidth: localStorage.getItem('devwatch-column-width') || null,
        };
        
        this.isInitialLoad = true; // Ensure the first render always happens

        this.breakpoint = options.breakpoint || 800;
        this.init();
    }

    init() {
        this.bindEvents();
        this.updateLayout(); // Initial check which will trigger the first render
    }

    bindEvents() {
        // Tab switching
        this.elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.setState({ activeTab: tab.dataset.tab });
            });
        });
        
        window.addEventListener('resize', () => this.updateLayout());
        if (this.elements.resizer) {
            this.elements.resizer.addEventListener('mousedown', (e) => this.startResizing(e));
        }
    }
    
    setState(newState) {
        Object.assign(this.state, newState);
        window.requestAnimationFrame(() => this.render());
    }
    
    updateLayout() {
        const newLayout = window.innerWidth <= this.breakpoint ? 'narrow' : 'wide';
        const layoutChanged = newLayout !== this.state.layout;

        if (layoutChanged || this.isInitialLoad) {
            this.setState({ layout: newLayout });
            this.isInitialLoad = false;
        }
    }

    restructureForNarrow() {
        this.elements.coupledPanels.forEach(coupledPanel => {
            const targetId = coupledPanel.id;
            const controllingTab = [...this.elements.tabs].find(tab => tab.dataset.targetPanel === targetId);
            if (controllingTab) {
                const tabId = controllingTab.dataset.tab;
                const targetTabPanel = [...this.elements.tabPanels].find(p => p.id === tabId);
                if (targetTabPanel) {
                    targetTabPanel.appendChild(coupledPanel);
                }
            }
        });
    }

    restructureForWide() {
        if (!this.elements.rightColumn) return;
        this.elements.coupledPanels.forEach(panel => {
            this.elements.rightColumn.appendChild(panel);
        });
    }
    
    startResizing(e) {
        if (this.state.layout === 'narrow' || !this.elements.resizer) return;
        
        this.setState({ isResizing: true });

        const handleMouseMove = (event) => {
            if (!this.state.isResizing) return;
            
            const container = this.elements.container;
            const containerRect = container.getBoundingClientRect();
            const prevWidth = event.clientX - containerRect.left;
            
            // Directly manipulate style for performance during drag
            const resizerWidth = this.elements.resizer.offsetWidth;
            container.style.gridTemplateColumns = `${prevWidth}px ${resizerWidth}px 1fr`;
        };

        const stopResizing = () => {
            const finalWidth = this.elements.container.style.gridTemplateColumns;
            localStorage.setItem('devwatch-column-width', finalWidth);
            // On mouse up, commit the final width to the state
            this.setState({ isResizing: false, columnWidth: finalWidth });

            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', stopResizing);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', stopResizing);
    }
    
    render() {
        // Render Layout based on state
        if (this.state.layout === 'narrow') {
            this.elements.container.classList.add('is-narrow');
            this.elements.container.style.gridTemplateColumns = '1fr';
        } else {
            this.elements.container.classList.remove('is-narrow');
            // Restore the saved column width from state
            if (this.state.columnWidth) {
                this.elements.container.style.gridTemplateColumns = this.state.columnWidth;
            } else {
                this.elements.container.style.gridTemplateColumns = ''; // Let CSS decide
            }
        }
        
        // Render Tabs and Panels
        this.elements.tabs.forEach(tab => {
            const isTabActive = tab.dataset.tab === this.state.activeTab;
            tab.classList.toggle('is-active', isTabActive);
        });

        this.elements.tabPanels.forEach(panel => {
            const isPanelActive = panel.id === this.state.activeTab;
            panel.classList.toggle('is-active', isPanelActive);
        });

        // In wide mode, manage the coupled panels in the right column
        if (this.state.layout === 'wide') {
            const activeTabEl = document.querySelector(`.devwatch-tab[data-tab='${this.state.activeTab}']`);
            const targetPanelId = activeTabEl ? activeTabEl.dataset.targetPanel : null;

            this.elements.coupledPanels.forEach(panel => {
                const isTargetPanel = panel.id === targetPanelId;
                panel.classList.toggle('is-active', isTargetPanel);
            });
        } else {
            // In narrow mode, the coupled panels are inside the tabPanels, 
            // so we just need to make sure they are visible.
            this.elements.coupledPanels.forEach(panel => {
                panel.classList.add('is-active');
            });
        }
    }
}
