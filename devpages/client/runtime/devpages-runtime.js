/**
 * DevPages Runtime - Smart published page capabilities
 *
 * This script is injected into published pages to provide:
 * - Collection detection and shared CSS loading
 * - Theme switching (light/dark)
 * - Metadata display via FAB/popup
 * - DevPages integration ("Edit in DevPages" link)
 *
 * Requires: window.DevPages metadata object
 */

(function() {
  'use strict';

  // Check if DevPages metadata exists
  if (typeof window.DevPages === 'undefined') {
    console.warn('[DevPages Runtime] No metadata found. Runtime features disabled.');
    return;
  }

  const metadata = window.DevPages;
  let collectionData = null;
  let currentTheme = 'light'; // default

  /**
   * Initialize the DevPages runtime
   */
  async function init() {
    console.log('[DevPages Runtime] Initializing...', metadata);

    // Detect collection context
    await detectCollection();

    // Initialize theme system
    initThemeSystem();

    // Create FAB and popup
    createFAB();
    createPopup();

    // Attach event listeners
    attachEventListeners();

    console.log('[DevPages Runtime] Initialized successfully');
  }

  /**
   * Detect if page is part of a collection
   * Checks for collection.json at various paths
   */
  async function detectCollection() {
    const pathsToCheck = [
      './collection.json',
      '../collection.json',
      '/collection.json'
    ];

    for (const path of pathsToCheck) {
      try {
        const response = await fetch(path);
        if (response.ok) {
          collectionData = await response.json();
          metadata.collection = collectionData;

          console.log('[DevPages Runtime] Collection detected:', collectionData);

          // Load collection CSS if specified
          if (collectionData.css && Array.isArray(collectionData.css)) {
            await loadCollectionCSS(collectionData.css);
          }

          break;
        }
      } catch (error) {
        // Silent fail - collection not found at this path
      }
    }

    if (!collectionData) {
      console.log('[DevPages Runtime] No collection found (standalone page)');
    }
  }

  /**
   * Load collection CSS files
   */
  async function loadCollectionCSS(cssPaths) {
    console.log('[DevPages Runtime] Loading collection CSS:', cssPaths);

    for (const cssPath of cssPaths) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssPath;
      link.dataset.source = 'collection';
      document.head.appendChild(link);
    }
  }

  /**
   * Initialize theme system
   */
  function initThemeSystem() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('devpages-theme');
    if (savedTheme) {
      currentTheme = savedTheme;
    } else if (collectionData && collectionData.theme) {
      // Use collection default theme
      currentTheme = collectionData.theme;
    }

    applyTheme(currentTheme);
  }

  /**
   * Apply theme to document
   */
  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add(`theme-${theme}`);

    // Save preference
    localStorage.setItem('devpages-theme', theme);

    console.log('[DevPages Runtime] Theme applied:', theme);
  }

  /**
   * Toggle between light and dark themes
   */
  function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);

    // Update UI
    updatePopupThemeButton();
  }

  /**
   * Create Floating Action Button (FAB)
   */
  function createFAB() {
    const fab = document.createElement('button');
    fab.id = 'devpages-fab';
    fab.className = 'devpages-fab';
    fab.setAttribute('aria-label', 'DevPages Menu');
    fab.innerHTML = 'DP';

    document.body.appendChild(fab);
  }

  /**
   * Create popup interface
   */
  function createPopup() {
    const popup = document.createElement('div');
    popup.id = 'devpages-popup';
    popup.className = 'devpages-popup';
    popup.hidden = true;

    popup.innerHTML = `
      <div class="devpages-popup-header">
        <h3>DevPages</h3>
        <button class="devpages-popup-close" aria-label="Close">&times;</button>
      </div>

      <div class="devpages-popup-content">
        <!-- Metadata Section -->
        <div class="devpages-section">
          <h4>Metadata</h4>
          <div class="devpages-metadata">
            <div class="devpages-meta-item">
              <span class="devpages-meta-label">Published:</span>
              <span class="devpages-meta-value">${formatDate(metadata.publishedAt)}</span>
            </div>
            ${metadata.collection ? `
              <div class="devpages-meta-item">
                <span class="devpages-meta-label">Collection:</span>
                <span class="devpages-meta-value">${metadata.collection.name}</span>
              </div>
            ` : ''}
            <div class="devpages-meta-item">
              <span class="devpages-meta-label">Source:</span>
              <span class="devpages-meta-value devpages-source-file">${metadata.sourceFile}</span>
            </div>
            ${metadata.version ? `
              <div class="devpages-meta-item">
                <span class="devpages-meta-label">Version:</span>
                <span class="devpages-meta-value">${metadata.version}</span>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Actions Section -->
        <div class="devpages-section">
          <h4>Actions</h4>
          <div class="devpages-actions">
            <button class="devpages-btn devpages-theme-btn" id="devpages-theme-toggle">
              <span class="devpages-icon">🎨</span>
              <span>Theme: <span id="devpages-current-theme">${capitalize(currentTheme)}</span></span>
            </button>
            <button class="devpages-btn devpages-edit-btn" id="devpages-edit-btn">
              <span class="devpages-icon">✏️</span>
              <span>Edit in DevPages</span>
            </button>
            <button class="devpages-btn devpages-copy-btn" id="devpages-copy-source">
              <span class="devpages-icon">📋</span>
              <span>Copy Source Path</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(popup);
  }

  /**
   * Attach event listeners
   */
  function attachEventListeners() {
    const fab = document.getElementById('devpages-fab');
    const popup = document.getElementById('devpages-popup');
    const closeBtn = popup.querySelector('.devpages-popup-close');
    const themeBtn = document.getElementById('devpages-theme-toggle');
    const editBtn = document.getElementById('devpages-edit-btn');
    const copyBtn = document.getElementById('devpages-copy-source');

    // FAB click - toggle popup
    fab.addEventListener('click', () => {
      const isHidden = popup.hidden;
      popup.hidden = !isHidden;

      if (!isHidden) {
        fab.classList.remove('devpages-fab-active');
      } else {
        fab.classList.add('devpages-fab-active');
      }
    });

    // Close button
    closeBtn.addEventListener('click', () => {
      popup.hidden = true;
      fab.classList.remove('devpages-fab-active');
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!popup.contains(e.target) && !fab.contains(e.target) && !popup.hidden) {
        popup.hidden = true;
        fab.classList.remove('devpages-fab-active');
      }
    });

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !popup.hidden) {
        popup.hidden = true;
        fab.classList.remove('devpages-fab-active');
      }
    });

    // Theme toggle
    themeBtn.addEventListener('click', () => {
      toggleTheme();
    });

    // Edit in DevPages
    editBtn.addEventListener('click', () => {
      if (metadata.sourceUrl) {
        window.location.href = metadata.sourceUrl;
      } else {
        alert('Source URL not available');
      }
    });

    // Copy source path
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(metadata.sourceFile);
        copyBtn.innerHTML = '<span class="devpages-icon">✓</span><span>Copied!</span>';
        setTimeout(() => {
          copyBtn.innerHTML = '<span class="devpages-icon">📋</span><span>Copy Source Path</span>';
        }, 2000);
      } catch (error) {
        console.error('Failed to copy:', error);
      }
    });
  }

  /**
   * Update popup theme button text
   */
  function updatePopupThemeButton() {
    const themeSpan = document.getElementById('devpages-current-theme');
    if (themeSpan) {
      themeSpan.textContent = capitalize(currentTheme);
    }
  }

  /**
   * Utility: Format date
   */
  function formatDate(isoString) {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Utility: Capitalize string
   */
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
