class FilterManager {
    constructor(options) {
        this.callbacks = {
            onFilterChange: options.onFilterChange || (() => {})
        };

        this.activeLevels = new Set(['error', 'warn', 'info']);
        this.activeTypes = new Set();
        this.activeModules = new Set();
        this.searchTerm = '';
        this.isShowingAll = false;

        this.elements = {
            searchInput: document.getElementById('search-input'),
            showAllBtn: document.getElementById('show-all-btn'),
            levelFilters: document.querySelectorAll('.level-filter'),
            typeFilters: document.getElementById('type-filters'),
            moduleFilters: document.getElementById('module-filters')
        };

        this.attachEventListeners();
    }

    attachEventListeners() {
        this.elements.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.callbacks.onFilterChange();
        });

        this.elements.showAllBtn.addEventListener('click', () => {
            this.toggleShowAll();
        });

        this.elements.levelFilters.forEach(btn => {
            btn.addEventListener('click', () => {
                this.toggleLevelFilter(btn);
            });
        });
    }

    toggleShowAll() {
        this.isShowingAll = !this.isShowingAll;
        this.elements.showAllBtn.textContent = this.isShowingAll ? 'Apply Filters' : 'Show All';
        this.elements.showAllBtn.classList.toggle('active', this.isShowingAll);
        this.callbacks.onFilterChange();
    }

    toggleLevelFilter(button) {
        const level = button.dataset.level;
        this.toggleFilter(this.activeLevels, level, button);
    }
    
    toggleFilter(set, value, button) {
        if (button.classList.contains('active')) {
            set.delete(value);
            button.classList.remove('active');
        } else {
            set.add(value);
            button.classList.add('active');
        }
        this.callbacks.onFilterChange();
    }

    populateFilters(logs) {
        const types = new Set();
        const modules = new Set();

        logs.forEach(log => {
            // Get the original log data
            const originalLog = log._original || log;
            
            // Extract TYPE from the original log
            const type = originalLog.type || log.type || null;
            if(type) types.add(type.toUpperCase());

            // Extract MODULE from the original log
            const module = originalLog.module || null;
            if(module) modules.add(module.toLowerCase());
        });

        // Sort types and modules for better organization
        const sortedTypes = Array.from(types).sort((a, b) => {
            // Prioritize common types: UI, SERVER, API, REDUX
            const priority = { 'UI': 1, 'SERVER': 2, 'API': 3, 'REDUX': 4 };
            const aPriority = priority[a] || 999;
            const bPriority = priority[b] || 999;
            
            if (aPriority !== bPriority) {
                return aPriority - bPriority;
            }
            return a.localeCompare(b);
        });

        const sortedModules = Array.from(modules).sort();

        this.updateFilterButtons(this.elements.typeFilters, sortedTypes, this.activeTypes, this.toggleFilter.bind(this, this.activeTypes));
        this.updateFilterButtons(this.elements.moduleFilters, sortedModules, this.activeModules, this.toggleFilter.bind(this, this.activeModules));
    }

    updateFilterButtons(container, items, activeSet, clickHandler) {
        container.innerHTML = '';
        items.forEach(item => {
            const button = document.createElement('button');
            button.className = 'level-filter'; // Default to inactive
            button.textContent = item;
            
            // Activate button if item is in the active set
            if (activeSet.has(item)) {
                button.classList.add('active');
            }

            button.addEventListener('click', () => clickHandler(item, button));
            container.appendChild(button);
        });
    }

    filter(logs) {
        if (this.isShowingAll) {
            return logs;
        }

        return logs.filter(log => {
            // Get the original log data
            const originalLog = log._original || log;
            
            const level = ((originalLog.level || log.level) || 'info').toLowerCase();
            if (!this.activeLevels.has(level)) {
                return false;
            }

            const type = (originalLog.type || log.type || '').toUpperCase();
            const module = (originalLog.module || '').toLowerCase();

            if (this.activeTypes.size > 0 && (type === '' || !this.activeTypes.has(type))) {
                return false;
            }

            if (this.activeModules.size > 0 && (module === '' || !this.activeModules.has(module))) {
                return false;
            }
            
            if (this.searchTerm) {
                const searchableText = [
                    originalLog.message || log.msg || '',
                    originalLog.type || log.type || '',
                    originalLog.module || '',
                    originalLog.action || '',
                    JSON.stringify(originalLog.details || originalLog.data || {})
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(this.searchTerm)) return false;
            }
            
            return true;
        });
    }
}
