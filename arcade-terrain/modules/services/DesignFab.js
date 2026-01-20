/**
 * PixelJam Design FAB
 * Floating action button for editing design tokens
 * Uses original PixelJam semantics: --ink, --one, --two, --paper-*, etc.
 *
 * Integrates with DesignInspector for element-level editing
 */

import { DesignInspector } from './design-inspector/index.js';

const PIXELJAM_TOKENS = {
  colors: {
    title: 'Colors',
    tokens: [
      { name: '--ink', label: '--ink', type: 'color' },
      { name: '--one', label: '--one', type: 'color' },
      { name: '--two', label: '--two', type: 'color' },
      { name: '--three', label: '--three', type: 'color' },
      { name: '--four', label: '--four', type: 'color' },
      { name: '--shade', label: '--shade', type: 'color' },
    ]
  },
  surfaces: {
    title: 'Surfaces',
    tokens: [
      { name: '--paper-light', label: '--paper-light', type: 'color' },
      { name: '--paper-mid', label: '--paper-mid', type: 'color' },
      { name: '--paper-dark', label: '--paper-dark', type: 'color' },
      { name: '--color-background', label: '--color-background', type: 'color' },
    ]
  },
  navigation: {
    title: 'Header Nav',
    collapsed: true,
    tokens: [
      { name: '--nav-font-size', label: '--nav-font-size', type: 'text', placeholder: '2rem' },
      { name: '--nav-line-height', label: '--nav-line-height', type: 'text', placeholder: '1' },
      { name: '--nav-letter-spacing', label: '--nav-letter-spacing', type: 'text', placeholder: '0.05em' },
      { name: '--nav-item-spacing', label: '--nav-item-spacing', type: 'text', placeholder: '0.5rem' },
      { name: '--nav-top', label: '--nav-top', type: 'text', placeholder: '1.5rem' },
      { name: '--nav-active-bg', label: '--nav-active-bg', type: 'color' },
    ]
  },
  logo: {
    title: 'Logo Container',
    collapsed: true,
    tokens: [
      { name: '--logo-width', label: '--logo-width', type: 'text', placeholder: '17rem' },
      { name: '--logo-height', label: '--logo-height', type: 'text', placeholder: 'auto' },
      { name: '--logo-padding-top', label: '--logo-padding-top', type: 'text', placeholder: '0.75rem' },
      { name: '--logo-padding-bottom', label: '--logo-padding-bottom', type: 'text', placeholder: '0.75rem' },
      { name: '--logo-padding-left', label: '--logo-padding-left', type: 'text', placeholder: '1rem' },
      { name: '--logo-padding-right', label: '--logo-padding-right', type: 'text', placeholder: '1rem' },
    ]
  },
  secondaryNav: {
    title: 'Secondary Nav',
    collapsed: true,
    tokens: [
      { name: '--secondary-nav-width', label: '--secondary-nav-width', type: 'text', placeholder: '15rem' },
      { name: '--secondary-nav-height', label: '--secondary-nav-height', type: 'text', placeholder: '6.75em' },
      { name: '--secondary-nav-padding', label: '--secondary-nav-padding', type: 'text', placeholder: '1rem' },
    ]
  },
  gamesPage: {
    title: 'Games Page',
    collapsed: true,
    tokens: [
      { name: '--games-card-width', label: '--games-card-width', type: 'text', placeholder: '384px' },
      { name: '--games-card-gap', label: '--games-card-gap', type: 'text', placeholder: '64px' },
      { name: '--games-columns', label: '--games-columns', type: 'text', placeholder: '1' },
    ]
  },
  gameContainer: {
    title: 'Game Container',
    collapsed: true,
    tokens: [
      { name: '--game-top-gap', label: '--game-top-gap', type: 'text', placeholder: '120px' },
      { name: '--game-bottom-gap', label: '--game-bottom-gap', type: 'text', placeholder: '140px' },
      { name: '--game-max-width', label: '--game-max-width', type: 'text', placeholder: '900px' },
      { name: '--game-max-height', label: '--game-max-height', type: 'text', placeholder: '65vh' },
      { name: '--game-border-radius', label: '--game-border-radius', type: 'text', placeholder: '8px' },
      { name: '--game-box-shadow', label: '--game-box-shadow', type: 'text', placeholder: '0 4px 24px rgba(0,0,0,0.4)' },
      { name: '--game-aspect-ratio', label: '--game-aspect-ratio', type: 'text', placeholder: 'auto' },
    ]
  },
  ads: {
    title: 'Ads / Layout',
    collapsed: true,
    tokens: [
      { name: '--sidebar-width', label: '--sidebar-width', type: 'text', placeholder: '160px' },
      { name: '--ads-header-height', label: '--ads-header-height', type: 'text', placeholder: '90px' },
      { name: '--ads-footer-height', label: '--ads-footer-height', type: 'text', placeholder: '90px' },
    ]
  },
  layout: {
    title: 'Layout',
    collapsed: true,
    tokens: [
      { name: '--page-margin', label: '--page-margin', type: 'text', placeholder: '8rem' },
      { name: '--header-height', label: '--header-height', type: 'text', placeholder: '5rem' },
    ]
  },
  zindex: {
    title: 'Z-Index Layers',
    collapsed: true,
    tokens: [
      { name: '--z-layer-1-base', label: 'Layer 1 (Noise)', type: 'text', placeholder: '100' },
      { name: '--z-layer-2-base', label: 'Layer 2 (Image)', type: 'text', placeholder: '200' },
      { name: '--z-layer-3-base', label: 'Layer 3 (CA)', type: 'text', placeholder: '300' },
      { name: '--z-cabinet-card', label: 'Cabinet Card', type: 'text', placeholder: '500' },
      { name: '--z-noise-card', label: 'NoiseCard Panel', type: 'text', placeholder: '1000' },
    ]
  },
  letterZ: {
    title: 'Letter Z-Index',
    collapsed: true,
    tokens: [
      { name: '--z-letter-A', label: 'A', type: 'text', placeholder: '210' },
      { name: '--z-letter-R', label: 'R', type: 'text', placeholder: '220' },
      { name: '--z-letter-C', label: 'C', type: 'text', placeholder: '230' },
      { name: '--z-letter-A2', label: 'A2', type: 'text', placeholder: '240' },
      { name: '--z-letter-D', label: 'D', type: 'text', placeholder: '250' },
      { name: '--z-letter-E', label: 'E', type: 'text', placeholder: '260' },
    ]
  }
};

function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

function getToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setToken(name, value) {
  document.documentElement.style.setProperty(name, value);
}

export const DesignFab = {
  _panel: null,
  _fab: null,
  _visible: false,
  _isDragging: false,
  _dragOffset: { x: 0, y: 0 },

  init() {
    this._createFab();
    this._createPanel();
    DesignInspector.init();
    console.log('[DesignFab] Initialized with Inspector');
  },

  destroy() {
    if (this._fab) this._fab.remove();
    if (this._panel) this._panel.remove();
    this._fab = null;
    this._panel = null;
    DesignInspector.destroy();
  },

  toggle() {
    this._visible = !this._visible;
    if (this._panel) {
      this._panel.classList.toggle('visible', this._visible);
    }
  },

  _createFab() {
    const fab = document.createElement('button');
    fab.id = 'design-fab';
    fab.className = 'design-fab';
    fab.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/>
    </svg>`;
    fab.title = 'Design Tokens';
    fab.addEventListener('click', () => this.toggle());
    document.body.appendChild(fab);
    this._fab = fab;
  },

  _createPanel() {
    const panel = document.createElement('div');
    panel.id = 'design-panel';
    panel.className = 'design-panel';
    panel.innerHTML = this._buildPanelHTML();
    document.body.appendChild(panel);
    this._panel = panel;

    // Bind click events
    panel.addEventListener('click', (e) => {
      if (e.target.matches('[data-action="close"]')) {
        this.toggle();
      }
      if (e.target.matches('[data-action="reset"]')) {
        this._resetTokens();
      }
      if (e.target.matches('[data-action="export"]')) {
        this._exportCSS();
      }
      if (e.target.matches('[data-action="inspect"]')) {
        this.toggle(); // Close token panel
        DesignInspector.enterInspectMode();
      }
      // Section toggle - handle click on header or its children
      const sectionHeader = e.target.closest('.section-header');
      if (sectionHeader) {
        const section = sectionHeader.closest('.token-section');
        if (section) {
          section.classList.toggle('collapsed');
          const icon = sectionHeader.querySelector('.toggle-icon');
          if (icon) {
            icon.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
          }
        }
      }
    });

    panel.addEventListener('input', (e) => {
      if (e.target.matches('[data-token]')) {
        const token = e.target.dataset.token;
        setToken(token, e.target.value);
        // Update display
        const display = panel.querySelector(`[data-display="${token}"]`);
        if (display) display.textContent = e.target.value;
      }
    });

    // Drag functionality
    this._initDrag(panel);

    // Initialize values
    this._initValues();
  },

  _initDrag(panel) {
    const header = panel.querySelector('.panel-header');
    if (!header) return;

    header.style.cursor = 'move';

    const onMouseDown = (e) => {
      if (e.target.matches('[data-action]')) return; // Don't drag on buttons
      this._isDragging = true;
      const rect = panel.getBoundingClientRect();
      this._dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      panel.style.transition = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
      if (!this._isDragging) return;
      const x = e.clientX - this._dragOffset.x;
      const y = e.clientY - this._dragOffset.y;
      // Constrain to viewport
      const maxX = window.innerWidth - panel.offsetWidth;
      const maxY = window.innerHeight - panel.offsetHeight;
      panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
      panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
      panel.style.right = 'auto';
    };

    const onMouseUp = () => {
      this._isDragging = false;
      panel.style.transition = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    header.addEventListener('mousedown', onMouseDown);
  },

  _buildPanelHTML() {
    let html = `
      <div class="panel-header">
        <span class="panel-title">Design Tokens</span>
        <button class="panel-close" data-action="close">&times;</button>
      </div>
      <div class="panel-body">
    `;

    for (const [key, group] of Object.entries(PIXELJAM_TOKENS)) {
      const collapsed = group.collapsed ? 'collapsed' : '';
      html += `
        <div class="token-section ${collapsed}" data-section="${key}">
          <div class="section-header">
            <span>${group.title}</span>
            <span class="toggle-icon">${group.collapsed ? '▶' : '▼'}</span>
          </div>
          <div class="section-content">
      `;

      for (const token of group.tokens) {
        const value = getToken(token.name);
        if (token.type === 'color') {
          const hex = rgbToHex(value);
          html += `
            <div class="token-row">
              <input type="color" data-token="${token.name}" value="${hex}">
              <div class="token-info">
                <span class="token-label">${token.label}</span>
                <span class="token-value" data-display="${token.name}">${hex}</span>
              </div>
            </div>
          `;
        } else {
          html += `
            <div class="token-row">
              <input type="text" data-token="${token.name}" value="${value}" placeholder="${token.placeholder || ''}">
              <div class="token-info">
                <span class="token-label">${token.label}</span>
              </div>
            </div>
          `;
        }
      }

      html += `
          </div>
        </div>
      `;
    }

    html += `
      </div>
      <div class="panel-footer">
        <button class="panel-btn panel-btn-primary" data-action="inspect">Inspect Element</button>
        <button class="panel-btn" data-action="export">Export CSS</button>
        <button class="panel-btn panel-btn-danger" data-action="reset">Reset</button>
      </div>
    `;

    return html;
  },

  _initValues() {
    if (!this._panel) return;
    for (const group of Object.values(PIXELJAM_TOKENS)) {
      for (const token of group.tokens) {
        const value = getToken(token.name);
        const input = this._panel.querySelector(`[data-token="${token.name}"]`);
        if (input) {
          if (token.type === 'color') {
            input.value = rgbToHex(value);
          } else {
            input.value = value;
          }
        }
        const display = this._panel.querySelector(`[data-display="${token.name}"]`);
        if (display) display.textContent = token.type === 'color' ? rgbToHex(value) : value;
      }
    }
  },

  _resetTokens() {
    // Remove inline styles to revert to CSS defaults
    for (const group of Object.values(PIXELJAM_TOKENS)) {
      for (const token of group.tokens) {
        document.documentElement.style.removeProperty(token.name);
      }
    }
    this._initValues();
  },

  _exportCSS() {
    let css = '/* PixelJam Design Tokens */\n:root {\n';
    for (const group of Object.values(PIXELJAM_TOKENS)) {
      css += `  /* ${group.title} */\n`;
      for (const token of group.tokens) {
        const value = getToken(token.name);
        css += `  ${token.name}: ${value};\n`;
      }
      css += '\n';
    }
    css += '}\n';

    navigator.clipboard.writeText(css).then(() => {
      console.log('[DesignFab] CSS copied to clipboard');
      alert('CSS copied to clipboard!');
    });
  }
};

export default DesignFab;
