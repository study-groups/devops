/**
 * Centralized Icon System for DevPages
 * Provides a flexible, theme-aware icon management solution
 */
export const IconCategories = {
    dev: {
        name: 'Development',
        icon: 'wrench',
        color: '#ff6b6b'
    },
    settings: {
        name: 'Configuration',
        icon: 'cog',
        color: '#4ecdc4'
    },
    publish: {
        name: 'Deployment',
        icon: 'rocket',
        color: '#45b7d1'
    }
};

export const IconRegistry = {
    // Panel and System Icons
    system: {
        close: 'close',
        minimize: 'minus',
        maximize: 'expand',
        settings: 'cog',
        info: 'info-circle',
        help: 'question-circle',
        search: 'search',
        menu: 'bars'
    },
    
    // File and Folder Icons
    files: {
        folder: 'folder',
        folderOpen: 'folder-open',
        file: 'file',
        fileCode: 'file-code',
        fileImage: 'file-image'
    },
    
    // Action Icons
    actions: {
        add: 'plus',
        edit: 'pencil',
        delete: 'trash',
        copy: 'copy',
        move: 'arrows-alt',
        refresh: 'sync'
    }
};

/**
 * Generate an icon class based on theme and icon name
 * @param {string} iconName - Name of the icon
 * @param {string} [category] - Optional category for color theming
 * @returns {string} CSS class for the icon
 */
export function generateIconClass(iconName, category = null) {
    const baseClass = `icon icon-${iconName}`;
    
    if (category && IconCategories[category]) {
        return `${baseClass} icon-themed-${category}`;
    }
    
    return baseClass;
}

/**
 * Create an icon element
 * @param {string} iconName - Name of the icon
 * @param {Object} [options] - Additional icon options
 * @returns {HTMLElement} Icon element
 */
export function createIcon(iconName, options = {}) {
    const { 
        category = null, 
        title = null, 
        size = 'md', 
        className = '' 
    } = options;

    const iconElement = document.createElement('span');
    iconElement.className = `${generateIconClass(iconName, category)} icon-${size} ${className}`;
    
    if (title) {
        iconElement.title = title;
    }

    return iconElement;
}
