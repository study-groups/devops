/**
 * Console Module - Dashboard Integration
 * Handles console toggle and lifecycle in the workspace tab
 */

import { createConsole } from './console/index.js';

let consoleInstance = null;
let isActive = false;

/**
 * Initialize console module
 */
export function init() {
    const toggleBtn = document.getElementById('console-toggle');
    const consoleView = document.getElementById('console-view');
    const cardsView = document.getElementById('games-cards-view');
    const detailView = document.getElementById('game-detail-view');

    if (!toggleBtn || !consoleView) {
        console.warn('[Console] Required elements not found');
        return;
    }

    // Toggle button click
    toggleBtn.addEventListener('click', () => {
        toggle();
    });

    // Keyboard shortcut (Ctrl+`)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === '`') {
            e.preventDefault();
            toggle();
        }
    });
}

/**
 * Toggle console visibility
 */
export function toggle() {
    const toggleBtn = document.getElementById('console-toggle');
    const consoleView = document.getElementById('console-view');
    const cardsView = document.getElementById('games-cards-view');
    const detailView = document.getElementById('game-detail-view');

    isActive = !isActive;

    if (isActive) {
        // Show console
        consoleView.classList.add('active');
        toggleBtn.classList.add('active');

        // Hide other views
        cardsView.style.display = 'none';
        detailView.style.display = 'none';

        // Create console if not exists
        if (!consoleInstance) {
            consoleInstance = createConsole('#console-view', {
                layout: 'horizontal'
            });

            // Set available games if we have them
            updateGames();
        }

        consoleInstance.focus();
    } else {
        // Hide console
        consoleView.classList.remove('active');
        toggleBtn.classList.remove('active');

        // Check which view to restore
        // Detail view is shown if it doesn't have the 'hidden' class
        const detailHidden = detailView.classList.contains('hidden');

        if (detailHidden) {
            // Show cards view
            cardsView.style.display = '';
            detailView.style.display = 'none';
        } else {
            // Show detail view
            cardsView.style.display = 'none';
            detailView.style.display = '';
        }
    }
}

/**
 * Show console
 */
export function show() {
    if (!isActive) {
        toggle();
    }
}

/**
 * Hide console
 */
export function hide() {
    if (isActive) {
        toggle();
    }
}

/**
 * Check if console is active
 */
export function isConsoleActive() {
    return isActive;
}

/**
 * Update console with games list (for slug completion)
 */
export function updateGames() {
    if (!consoleInstance) return;

    // Get games from the workspace
    const gamesData = window.pbaseGames || [];
    consoleInstance.setGames(gamesData);
}

/**
 * Load a game in the console by slug
 */
export function loadGame(slug, url) {
    show();
    if (consoleInstance && consoleInstance.frame) {
        consoleInstance.frame.load(url || `/games/${slug}/index.html`);
    }
}

/**
 * Get console instance
 */
export function getConsole() {
    return consoleInstance;
}
