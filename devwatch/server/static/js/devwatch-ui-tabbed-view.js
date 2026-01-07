/**
 * PJA UI Tabbed View Component
 * Strict, attribute-driven tab management with a clear programmatic API.
 */
(function(global) {
    class DevWatchTabbedView {
        static SELECTORS = {
            CONTAINER: '[data-devwatch-tabbed-view]',
            TAB_LIST: '[data-devwatch-tab-list]',
            TAB: '[data-devwatch-tab]',
            TAB_CONTENT: '[data-devwatch-tab-content]',
            TAB_PANEL: '[data-devwatch-tab-panel]'
        };

        static CLASSES = {
            ACTIVE: 'devwatch-tab-active',
            HIDDEN: 'devwatch-tab-hidden'
        };

        constructor(container, options = {}) {
            this.container = typeof container === 'string' 
                ? document.querySelector(container) 
                : container;

            if (!this.container) {
                throw new Error('DevWatchTabbedView: Container element not found');
            }

            this.options = {
                defaultTab: null,
                onTabChange: null,
                ...options
            };

            this.tabs = [];
            this.tabPanels = [];
            this.init();
        }

        init() {
            this.container.classList.add('devwatch-tabbed-view');
            
            this.tabList = this.container.querySelector(DevWatchTabbedView.SELECTORS.TAB_LIST);
            if (!this.tabList) {
                this.tabList = document.createElement('ul');
                this.tabList.setAttribute('data-devwatch-tab-list', '');
                this.tabList.classList.add('devwatch-tab-list');
                this.container.appendChild(this.tabList);
            }

            this.tabContent = this.container.querySelector(DevWatchTabbedView.SELECTORS.TAB_CONTENT);
            if (!this.tabContent) {
                this.tabContent = document.createElement('div');
                this.tabContent.setAttribute('data-devwatch-tab-content', '');
                this.tabContent.classList.add('devwatch-tab-content');
                this.container.appendChild(this.tabContent);
            }

            this.attachEventListeners();
        }

        addTab(tabConfig) {
            const { id, label, content } = tabConfig;
            
            const tabButton = document.createElement('button');
            tabButton.setAttribute('data-devwatch-tab', id);
            tabButton.classList.add('devwatch-tab');
            tabButton.textContent = label;
            this.tabList.appendChild(tabButton);
            this.tabs.push(tabButton);

            const tabPanel = document.createElement('div');
            tabPanel.setAttribute('data-devwatch-tab-panel', id);
            tabPanel.classList.add('devwatch-tab-panel', DevWatchTabbedView.CLASSES.HIDDEN);
            if (typeof content === 'string') {
                tabPanel.innerHTML = content;
            } else if (content instanceof HTMLElement) {
                tabPanel.appendChild(content);
            }
            this.tabContent.appendChild(tabPanel);
            this.tabPanels.push(tabPanel);

            if (this.options.defaultTab === id || this.tabs.length === 1) {
                this.activateTab(id);
            }

            return this;
        }

        attachEventListeners() {
            this.tabList.addEventListener('click', (e) => {
                const tab = e.target.closest(DevWatchTabbedView.SELECTORS.TAB);
                if (tab) {
                    const tabId = tab.getAttribute('data-devwatch-tab');
                    this.activateTab(tabId);
                }
            });
        }

        activateTab(tabId) {
            this.tabs.forEach(tab => {
                const isSelected = tab.getAttribute('data-devwatch-tab') === tabId;
                tab.classList.toggle(DevWatchTabbedView.CLASSES.ACTIVE, isSelected);
                tab.setAttribute('aria-selected', isSelected);
            });

            this.tabPanels.forEach(panel => {
                const isSelected = panel.getAttribute('data-devwatch-tab-panel') === tabId;
                panel.classList.toggle(DevWatchTabbedView.CLASSES.HIDDEN, !isSelected);
                panel.classList.toggle(DevWatchTabbedView.CLASSES.ACTIVE, isSelected); // Ensure active class is set
                panel.setAttribute('aria-hidden', !isSelected);
            });

            if (this.options.onTabChange) {
                this.options.onTabChange(tabId);
            }
        }

        getActiveTabId() {
            const activeTab = this.tabs.find(tab => tab.classList.contains(DevWatchTabbedView.CLASSES.ACTIVE));
            return activeTab ? activeTab.getAttribute('data-devwatch-tab') : null;
        }
    }

    global.DevWatchTabbedView = DevWatchTabbedView;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = DevWatchTabbedView;
    }

})(typeof window !== 'undefined' ? window : this);
