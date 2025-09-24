// Tetra Module Documentation Interactive Features

let allModules = [];
let currentFilter = 'all';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    allModules = Array.from(document.querySelectorAll('.module-card'));
    updateStats();

    // Set up keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case '1': filterByType('core'); e.preventDefault(); break;
                case '2': filterByType('extension'); e.preventDefault(); break;
                case '3': filterByType('plugin'); e.preventDefault(); break;
                case '4': filterByType('legacy'); e.preventDefault(); break;
                case '5': filterByType('experimental'); e.preventDefault(); break;
                case '0': filterByType('all'); e.preventDefault(); break;
                case 't': filterByTView(); e.preventDefault(); break;
            }
        }
    });
});

// Search functionality
function searchModules(query) {
    const searchTerm = query.toLowerCase().trim();

    allModules.forEach(card => {
        const content = card.textContent.toLowerCase();
        const isMatch = searchTerm === '' || content.includes(searchTerm);

        if (isMatch && (currentFilter === 'all' || card.classList.contains(currentFilter) ||
                       (currentFilter === 'tview' && card.querySelector('.tview-badge')))) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });

    updateStats();
}

// Filter by module type
function filterByType(type) {
    currentFilter = type;

    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeBtn = document.querySelector(`[onclick*="${type}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // Apply filter
    allModules.forEach(card => {
        let shouldShow = false;

        if (type === 'all') {
            shouldShow = true;
        } else {
            shouldShow = card.classList.contains(type);
        }

        if (shouldShow) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });

    // Re-apply search if there's text in search box
    const searchBox = document.querySelector('.search-box');
    if (searchBox.value.trim()) {
        searchModules(searchBox.value);
    }

    updateStats();
    animateCards();
}

// Filter to show only modules with TView integration
function filterByTView() {
    currentFilter = 'tview';

    // Update button states
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector('.tview-btn').classList.add('active');

    // Apply filter
    allModules.forEach(card => {
        const hasTView = card.querySelector('.tview-badge');
        if (hasTView) {
            card.classList.remove('hidden');
        } else {
            card.classList.add('hidden');
        }
    });

    updateStats();
    animateCards();
}

// Update statistics display
function updateStats() {
    const total = allModules.length;
    const visible = allModules.filter(card => !card.classList.contains('hidden')).length;

    document.getElementById('totalModules').textContent = total;
    document.getElementById('visibleModules').textContent = visible;

    // Update filter button counts
    const types = ['core', 'extension', 'plugin', 'legacy', 'experimental', 'deprecated'];
    types.forEach(type => {
        const count = allModules.filter(card => card.classList.contains(type)).length;
        const btn = document.querySelector(`[onclick*="${type}"]`);
        if (btn && count > 0) {
            const text = btn.textContent;
            const cleanText = text.replace(/\s*\(\d+\)/, '');
            btn.textContent = `${cleanText} (${count})`;
        }
    });

    // TView count
    const tviewCount = allModules.filter(card => card.querySelector('.tview-badge')).length;
    const tviewBtn = document.querySelector('.tview-btn');
    if (tviewBtn) {
        const text = tviewBtn.textContent;
        const cleanText = text.replace(/\s*\(\d+\)/, '');
        tviewBtn.textContent = `${cleanText} (${tviewCount})`;
    }
}

// Animate cards when filtering
function animateCards() {
    const visibleCards = allModules.filter(card => !card.classList.contains('hidden'));

    visibleCards.forEach((card, index) => {
        card.style.animation = 'none';
        card.offsetHeight; // Trigger reflow
        card.style.animation = `fadeIn 0.3s ease-in-out ${index * 0.05}s both`;
    });
}

// Enhanced search with categories
function enhancedSearch(query) {
    const searchTerm = query.toLowerCase().trim();

    if (searchTerm.startsWith('type:')) {
        const type = searchTerm.replace('type:', '').trim();
        filterByType(type);
        return;
    }

    if (searchTerm.startsWith('func:')) {
        const funcName = searchTerm.replace('func:', '').trim();
        searchByFunction(funcName);
        return;
    }

    searchModules(query);
}

// Search by function name
function searchByFunction(funcName) {
    allModules.forEach(card => {
        const functions = card.querySelectorAll('.function');
        let hasFunction = false;

        functions.forEach(func => {
            if (func.textContent.toLowerCase().includes(funcName.toLowerCase())) {
                hasFunction = true;
                func.style.backgroundColor = '#fff3cd';
                func.style.padding = '2px 4px';
                func.style.borderRadius = '3px';
            } else {
                func.style.backgroundColor = '';
                func.style.padding = '';
                func.style.borderRadius = '';
            }
        });

        if (hasFunction && (currentFilter === 'all' || card.classList.contains(currentFilter))) {
            card.classList.remove('hidden');
        } else if (funcName) {
            card.classList.add('hidden');
        }
    });

    updateStats();
}

// Quick filters with keyboard shortcuts info
function showKeyboardShortcuts() {
    const shortcuts = `
Keyboard Shortcuts:
• Ctrl/Cmd + 1: Core modules
• Ctrl/Cmd + 2: Extensions
• Ctrl/Cmd + 3: Plugins
• Ctrl/Cmd + 4: Legacy
• Ctrl/Cmd + 5: Experimental
• Ctrl/Cmd + 0: All modules
• Ctrl/Cmd + T: TView only

Search Tips:
• type:core - Filter by type
• func:tsm - Search functions
• Just type to search everywhere
    `;

    alert(shortcuts.trim());
}

// Add help button functionality
document.addEventListener('DOMContentLoaded', function() {
    const searchBox = document.querySelector('.search-box');
    if (searchBox) {
        searchBox.placeholder = 'Search modules or functions... (type:core, func:tsm, or ? for help)';

        searchBox.addEventListener('input', function(e) {
            if (e.target.value === '?') {
                showKeyboardShortcuts();
                e.target.value = '';
            } else {
                enhancedSearch(e.target.value);
            }
        });
    }
});