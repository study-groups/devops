/**
 * TUT Reference Documentation - Interactive Features
 * Scroll spy, collapsible nav, smooth scrolling, keyboard navigation
 */

// =============================================================================
// CONFIGURATION
// =============================================================================

const Config = {
    _cache: {},
    getCSSVar(name) {
        if (this._cache[name]) return this._cache[name];
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue(name).trim();
        this._cache[name] = value;
        return value;
    },
    getDuration(name) {
        return parseInt(this.getCSSVar(name), 10) || 200;
    },
    clearCache() {
        this._cache = {};
    },
    get breakpointMd() {
        return parseInt(this.getCSSVar('--breakpoint-md'), 10) || 768;
    },
    storageKeys: {
        navStates: 'tut-ref-nav-states'
    }
};

const Selectors = {
    sidebar: '.sidebar',
    sidebarHeader: '.sidebar-header',
    navGroup: '.nav-group',
    navGroupTitle: '.nav-group-title',
    navList: '.nav-list',
    navLink: '.nav-link',
    topicSection: '.topic-section',
    content: '.content'
};

const StateClasses = {
    active: 'active',
    collapsed: 'collapsed',
    open: 'open'
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
});

// =============================================================================
// NAVIGATION
// =============================================================================

function initNavigation() {
    document.querySelectorAll(Selectors.navLink).forEach(link => {
        link.addEventListener('click', handleNavClick);
    });
}

function handleNavClick(e) {
    const navLinks = document.querySelectorAll(Selectors.navLink);
    const sidebar = document.querySelector(Selectors.sidebar);

    navLinks.forEach(l => l.classList.remove(StateClasses.active));
    e.currentTarget.classList.add(StateClasses.active);

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

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                updateActiveNavLink(entry.target.id, navLinks);
            }
        });
    }, {
        root: null,
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0
    });

    sections.forEach(section => observer.observe(section));
}

function updateActiveNavLink(sectionId, navLinks) {
    const activeLink = document.querySelector(`${Selectors.navLink}[href="#${sectionId}"]`);
    if (!activeLink) return;

    navLinks.forEach(link => link.classList.remove(StateClasses.active));
    activeLink.classList.add(StateClasses.active);

    // Expand parent group if collapsed
    const parentGroup = activeLink.closest(Selectors.navGroup);
    if (parentGroup?.classList.contains(StateClasses.collapsed)) {
        toggleNavGroup(parentGroup, false);
    }

    activeLink.setAttribute('aria-current', 'true');
    navLinks.forEach(link => {
        if (link !== activeLink) link.removeAttribute('aria-current');
    });
}

// =============================================================================
// MOBILE MENU
// =============================================================================

function initMobileMenu() {
    const sidebar = document.querySelector(Selectors.sidebar);
    const sidebarHeader = document.querySelector(Selectors.sidebarHeader);

    if (!sidebar || !sidebarHeader) return;

    sidebarHeader.addEventListener('click', () => {
        if (isMobile()) {
            sidebar.classList.toggle(StateClasses.open);
        }
    });

    document.addEventListener('click', (e) => {
        if (isMobile() && !sidebar.contains(e.target)) {
            sidebar.classList.remove(StateClasses.open);
        }
    });

    window.addEventListener('resize', () => {
        if (!isMobile()) {
            sidebar.classList.remove(StateClasses.open);
        }
        Config.clearCache();
    });
}

// =============================================================================
// COLLAPSIBLE GROUPS
// =============================================================================

function initCollapsibleGroups() {
    document.querySelectorAll(Selectors.navGroupTitle).forEach(title => {
        title.addEventListener('click', handleGroupTitleClick);
    });
    restoreGroupStates();
}

function handleGroupTitleClick(e) {
    if (isMobile()) return;

    const group = e.currentTarget.closest(Selectors.navGroup);
    if (!group) return;

    toggleNavGroup(group, !group.classList.contains(StateClasses.collapsed));
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
    const states = {};
    document.querySelectorAll(Selectors.navGroup).forEach(group => {
        const name = group.dataset.group;
        if (name) states[name] = group.classList.contains(StateClasses.collapsed);
    });
    try {
        localStorage.setItem(Config.storageKeys.navStates, JSON.stringify(states));
    } catch (e) {}
}

function restoreGroupStates() {
    try {
        const saved = localStorage.getItem(Config.storageKeys.navStates);
        if (!saved) return;
        const states = JSON.parse(saved);
        Object.entries(states).forEach(([name, collapsed]) => {
            if (collapsed) {
                const group = document.querySelector(`${Selectors.navGroup}[data-group="${name}"]`);
                if (group) toggleNavGroup(group, true);
            }
        });
    } catch (e) {}
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

    const target = document.getElementById(href.slice(1));
    if (!target) return;

    const scrollPadding = parseInt(
        getComputedStyle(document.documentElement).scrollPaddingTop, 10
    ) || 20;

    window.scrollTo({
        top: target.getBoundingClientRect().top + window.pageYOffset - scrollPadding,
        behavior: 'smooth'
    });

    history.pushState(null, null, href);
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
            if (sidebar?.classList.contains(StateClasses.open)) {
                sidebar.classList.remove(StateClasses.open);
                e.preventDefault();
            }
            break;
        case 'j':
        case 'k':
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
// UTILITIES
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

// Export for external use
window.TUTReferenceDocs = {
    Config,
    toggleNavGroup,
    navigateSections
};
