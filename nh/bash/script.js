/**
 * NH & Tetra Documentation - Interactive Features
 *
 * Design Token Aware JavaScript
 * Reads CSS custom properties for consistent behavior
 */

// =============================================================================
// CONFIGURATION - Read from CSS custom properties
// =============================================================================

const Config = {
    // Cache for computed styles
    _cache: {},

    // Get CSS custom property value
    getCSSVar(name) {
        if (this._cache[name]) return this._cache[name];

        const value = getComputedStyle(document.documentElement)
            .getPropertyValue(name)
            .trim();

        this._cache[name] = value;
        return value;
    },

    // Parse duration token (e.g., '200ms' -> 200)
    getDuration(name) {
        const value = this.getCSSVar(name);
        return parseInt(value, 10) || 200;
    },

    // Parse breakpoint token
    getBreakpoint(name) {
        const value = this.getCSSVar(name);
        return parseInt(value, 10) || 768;
    },

    // Clear cache (call on theme change)
    clearCache() {
        this._cache = {};
    },

    // Breakpoints
    get breakpointMd() {
        return this.getBreakpoint('--breakpoint-md');
    },

    // Durations
    get durationNormal() {
        return this.getDuration('--duration-normal');
    },

    get durationSlow() {
        return this.getDuration('--duration-slow');
    },

    // Storage keys
    storageKeys: {
        navStates: 'nh-tetra-nav-states',
        theme: 'nh-tetra-theme'
    }
};

// =============================================================================
// DOM SELECTORS
// =============================================================================

const Selectors = {
    sidebar: '.sidebar',
    sidebarHeader: '.sidebar-header',
    navGroup: '.nav-group',
    navGroupTitle: '.nav-group-title',
    navList: '.nav-list',
    navLink: '.nav-link',
    navItem: '.nav-item',
    topicSection: '.topic-section',
    content: '.content'
};

// =============================================================================
// STATE CLASSES
// =============================================================================

const StateClasses = {
    active: 'active',
    collapsed: 'collapsed',
    open: 'open',
    visible: 'visible',
    hidden: 'hidden'
};

// =============================================================================
// INITIALIZATION
// =============================================================================

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initScrollSpy();
    initMobileMenu();
    initCollapsibleGroups();
    initSmoothScroll();
    initKeyboardNav();
    initAccessibility();
});

// =============================================================================
// NAVIGATION
// =============================================================================

function initNavigation() {
    const navLinks = document.querySelectorAll(Selectors.navLink);

    navLinks.forEach(link => {
        link.addEventListener('click', handleNavClick);
    });
}

function handleNavClick(e) {
    const navLinks = document.querySelectorAll(Selectors.navLink);
    const sidebar = document.querySelector(Selectors.sidebar);

    // Update active state
    navLinks.forEach(l => l.classList.remove(StateClasses.active));
    e.currentTarget.classList.add(StateClasses.active);

    // Close mobile menu
    if (isMobile()) {
        sidebar.classList.remove(StateClasses.open);
    }
}

// =============================================================================
// SCROLL SPY
// =============================================================================

function initScrollSpy() {
    const sections = document.querySelectorAll(Selectors.topicSection);
    const navLinks = document.querySelectorAll(Selectors.navLink);

    if (!sections.length) return;

    const observerOptions = {
        root: null,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                updateActiveNavLink(entry.target.id, navLinks);
            }
        });
    }, observerOptions);

    sections.forEach(section => observer.observe(section));
}

function updateActiveNavLink(sectionId, navLinks) {
    const activeLink = document.querySelector(`${Selectors.navLink}[href="#${sectionId}"]`);

    if (!activeLink) return;

    // Update active class
    navLinks.forEach(link => link.classList.remove(StateClasses.active));
    activeLink.classList.add(StateClasses.active);

    // Expand parent group if collapsed
    const parentGroup = activeLink.closest(Selectors.navGroup);
    if (parentGroup?.classList.contains(StateClasses.collapsed)) {
        toggleNavGroup(parentGroup, false);
    }

    // Update ARIA
    activeLink.setAttribute('aria-current', 'true');
    navLinks.forEach(link => {
        if (link !== activeLink) {
            link.removeAttribute('aria-current');
        }
    });
}

// =============================================================================
// MOBILE MENU
// =============================================================================

function initMobileMenu() {
    const sidebar = document.querySelector(Selectors.sidebar);
    const sidebarHeader = document.querySelector(Selectors.sidebarHeader);

    if (!sidebar || !sidebarHeader) return;

    // Toggle on header click (mobile only)
    sidebarHeader.addEventListener('click', () => {
        if (isMobile()) {
            toggleMobileMenu(sidebar);
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (isMobile() && !sidebar.contains(e.target)) {
            sidebar.classList.remove(StateClasses.open);
        }
    });

    // Handle resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (!isMobile()) {
                sidebar.classList.remove(StateClasses.open);
            }
            Config.clearCache(); // Clear CSS var cache on resize
        }, 100);
    });
}

function toggleMobileMenu(sidebar) {
    const isOpen = sidebar.classList.toggle(StateClasses.open);

    // Update ARIA
    sidebar.setAttribute('aria-expanded', isOpen);
}

// =============================================================================
// COLLAPSIBLE GROUPS
// =============================================================================

function initCollapsibleGroups() {
    const groupTitles = document.querySelectorAll(Selectors.navGroupTitle);

    groupTitles.forEach(title => {
        title.addEventListener('click', handleGroupTitleClick);
    });

    // Restore saved states
    restoreGroupStates();
}

function handleGroupTitleClick(e) {
    // Skip on mobile
    if (isMobile()) return;

    const group = e.currentTarget.closest(Selectors.navGroup);
    if (!group) return;

    const isCollapsed = group.classList.contains(StateClasses.collapsed);
    toggleNavGroup(group, !isCollapsed);

    // Save state
    saveGroupStates();
}

function toggleNavGroup(group, collapse) {
    const title = group.querySelector(Selectors.navGroupTitle);
    const list = group.querySelector(Selectors.navList);

    if (collapse) {
        group.classList.add(StateClasses.collapsed);
        title?.setAttribute('aria-expanded', 'false');
        list?.setAttribute('aria-hidden', 'true');
    } else {
        group.classList.remove(StateClasses.collapsed);
        title?.setAttribute('aria-expanded', 'true');
        list?.setAttribute('aria-hidden', 'false');
    }
}

function saveGroupStates() {
    const groups = document.querySelectorAll(Selectors.navGroup);
    const states = {};

    groups.forEach(group => {
        const groupName = group.dataset.group;
        if (groupName) {
            states[groupName] = group.classList.contains(StateClasses.collapsed);
        }
    });

    try {
        localStorage.setItem(Config.storageKeys.navStates, JSON.stringify(states));
    } catch (e) {
        console.warn('Failed to save nav states:', e);
    }
}

function restoreGroupStates() {
    try {
        const saved = localStorage.getItem(Config.storageKeys.navStates);
        if (!saved) return;

        const states = JSON.parse(saved);

        Object.entries(states).forEach(([groupName, isCollapsed]) => {
            if (isCollapsed) {
                const group = document.querySelector(`${Selectors.navGroup}[data-group="${groupName}"]`);
                if (group) {
                    toggleNavGroup(group, true);
                }
            }
        });
    } catch (e) {
        console.warn('Failed to restore nav states:', e);
    }
}

// =============================================================================
// SMOOTH SCROLL
// =============================================================================

function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', handleSmoothScroll);
    });
}

function handleSmoothScroll(e) {
    e.preventDefault();

    const href = e.currentTarget.getAttribute('href');
    if (!href || href === '#') return;

    const targetId = href.slice(1);
    const target = document.getElementById(targetId);

    if (!target) return;

    // Get scroll offset from CSS or use default
    const scrollPadding = parseInt(
        getComputedStyle(document.documentElement).scrollPaddingTop,
        10
    ) || 20;

    const targetPosition = target.getBoundingClientRect().top
        + window.pageYOffset
        - scrollPadding;

    window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
    });

    // Update URL without jumping
    history.pushState(null, null, `#${targetId}`);

    // Set focus for accessibility
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
}

// =============================================================================
// KEYBOARD NAVIGATION
// =============================================================================

function initKeyboardNav() {
    document.addEventListener('keydown', handleKeydown);
}

function handleKeydown(e) {
    const sidebar = document.querySelector(Selectors.sidebar);

    switch (e.key) {
        case 'Escape':
            // Close mobile menu
            if (sidebar?.classList.contains(StateClasses.open)) {
                sidebar.classList.remove(StateClasses.open);
                e.preventDefault();
            }
            break;

        case '/':
            // Future: Focus search
            if (!isInputFocused()) {
                // e.preventDefault();
                // focusSearch();
            }
            break;

        case 'j':
        case 'k':
            // Vim-style navigation (when not in input)
            if (!isInputFocused() && !isMobile()) {
                navigateSections(e.key === 'j' ? 1 : -1);
                e.preventDefault();
            }
            break;
    }
}

function navigateSections(direction) {
    const sections = Array.from(document.querySelectorAll(Selectors.topicSection));
    const activeLink = document.querySelector(`${Selectors.navLink}.${StateClasses.active}`);

    if (!activeLink) {
        // Navigate to first/last section
        const target = direction > 0 ? sections[0] : sections[sections.length - 1];
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
    }

    const currentId = activeLink.getAttribute('href')?.slice(1);
    const currentIndex = sections.findIndex(s => s.id === currentId);
    const nextIndex = Math.max(0, Math.min(sections.length - 1, currentIndex + direction));

    if (nextIndex !== currentIndex) {
        sections[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// =============================================================================
// ACCESSIBILITY
// =============================================================================

function initAccessibility() {
    // Set initial ARIA states
    const groups = document.querySelectorAll(Selectors.navGroup);

    groups.forEach(group => {
        const title = group.querySelector(Selectors.navGroupTitle);
        const list = group.querySelector(Selectors.navList);
        const isCollapsed = group.classList.contains(StateClasses.collapsed);

        title?.setAttribute('aria-expanded', !isCollapsed);
        list?.setAttribute('aria-hidden', isCollapsed);
    });

    // Mark first visible section as current
    const firstLink = document.querySelector(Selectors.navLink);
    firstLink?.setAttribute('aria-current', 'true');
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function isMobile() {
    return window.innerWidth <= Config.breakpointMd;
}

function isInputFocused() {
    const active = document.activeElement;
    return active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable
    );
}

// =============================================================================
// EXPORTS (for potential module use)
// =============================================================================

window.NHTetraDocs = {
    Config,
    Selectors,
    StateClasses,
    toggleNavGroup,
    navigateSections
};
