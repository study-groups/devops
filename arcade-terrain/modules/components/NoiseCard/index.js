/**
 * NoiseCard Component - 3-Layer Compositing System
 *
 * Layers:
 *   1: Noise (perlin, random, etc)
 *   2: Image (Pixeljam SVG logo)
 *   3: CA (cellular automata)
 *
 * Blend slider crossfades between layers:
 *   0.0 = Layer 1, 0.5 = Layer 2, 1.0 = Layer 3
 */

import { LayerManager } from './layers/LayerManager.js';
import { CLI } from './cli/CLI.js';

const cards = new Map();
let nextId = 1;

export const NoiseCard = {
  create(config = {}) {
    const id = `noise-card-${nextId++}`;
    const instance = new NoiseCardInstance(id, config);
    cards.set(id, instance);
    return instance;
  },

  attachTo(element, config = {}) {
    const id = element.id || `noise-card-${nextId++}`;
    const instance = new NoiseCardInstance(id, {
      ...config,
      attachTo: element
    });
    cards.set(id, instance);
    return instance;
  },

  get(id) { return cards.get(id); },
  remove(id) {
    const card = cards.get(id);
    if (card) { card.destroy(); cards.delete(id); }
  },
  removeAll() {
    for (const card of cards.values()) card.destroy();
    cards.clear();
  }
};

class NoiseCardInstance {
  constructor(id, config) {
    this.id = id;
    this.config = {
      title: 'Layer Mixer',
      width: 420,
      height: 280,
      position: { x: 100, y: 100 },
      draggable: true,
      attachTo: null,
      ...config
    };

    this.element = null;
    this.canvas = null;
    this.layers = null;
    this.cli = null;

    this._create();
  }

  _create() {
    this.element = document.createElement('div');
    this.element.id = this.id;
    this.element.className = 'noise-card' + (this.config.attachTo ? ' noise-card-attached' : '');

    // Target element for noise display
    this.target = this.config.attachTo || null;

    if (this.config.attachTo) {
      const rect = this.config.attachTo.getBoundingClientRect();
      this.element.style.cssText = `
        left: ${rect.left}px;
        top: ${rect.bottom + 8}px;
        width: ${Math.max(rect.width, 380)}px;
      `;
    } else {
      this.element.style.cssText = `
        left: ${this.config.position.x}px;
        top: ${this.config.position.y}px;
        width: ${this.config.width}px;
      `;
    }

    this.element.innerHTML = this._template();
    document.body.appendChild(this.element);

    // Setup canvas ON THE TARGET ELEMENT (not in the card)
    this._initTargetCanvas();

    this.layers = new LayerManager(this.canvas);
    this.layers.resize(this.canvas.width, this.canvas.height);

    // Setup CLI
    const output = this.element.querySelector('.noise-cli-output');
    this.cli = new CLI(this, this.layers, output);

    // Bind events
    this._bindEvents();

    // Initial render and start
    this.layers.render();
    this.layers.start();

    // Update header state
    this._updateLayerButtons();
    this._updateBlendSlider();
    this._updatePrompt();
  }

  _initTargetCanvas() {
    // Create canvas on the TARGET element, not in the card
    if (this.target) {
      // Hide ALL original content - NoiseCard canvas takes over rendering
      // Store original styles and hide everything except our canvas
      Array.from(this.target.children).forEach(el => {
        if (!el.classList.contains('noise-layer-canvas')) {
          console.log('[NoiseCard] Hiding element:', el.tagName);
          el.dataset.noiseCardDisplay = el.style.cssText || '';
          el.style.cssText = 'display: none !important';
        }
      });
      console.log('[NoiseCard] Target children after hiding:', this.target.children.length);

      // Check if canvas already exists
      this.canvas = this.target.querySelector('.noise-layer-canvas');
      if (!this.canvas) {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'noise-layer-canvas';
        this.canvas.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          image-rendering: pixelated;
          image-rendering: crisp-edges;
          background: #0a0a0a;
          z-index: 10;
        `;
        // Ensure target has position for absolute canvas
        const targetStyle = getComputedStyle(this.target);
        if (targetStyle.position === 'static') {
          this.target.style.position = 'relative';
        }
        this.target.appendChild(this.canvas);
      }

      // Size canvas to target
      const rect = this.target.getBoundingClientRect();
      this.canvas.width = Math.floor(rect.width * 0.5); // Lower res for perf
      this.canvas.height = Math.floor(rect.height * 0.5);
    } else {
      // Floating card - use internal canvas
      this.canvas = this.element.querySelector('.noise-card-canvas');
      this.canvas.width = 200;
      this.canvas.height = 100;
    }
  }

  _template() {
    const hasTarget = !!this.config.attachTo;
    return `
      <div class="noise-card-header">
        <span class="noise-card-title">${this.config.title}</span>
        <div class="noise-card-layer-controls">
          <button class="layer-btn" data-layer="1" title="Layer 1: Noise">
            <span class="layer-icon">◐</span>
            <span class="layer-num">1</span>
          </button>
          <button class="layer-btn layer-btn-logo" data-layer="2" title="Layer 2: Logo">
            <svg viewBox="0 0 24 24" class="pj-logo-mini">
              <use href="#svg_arcade_logo"/>
            </svg>
          </button>
          <button class="layer-btn" data-layer="3" title="Layer 3: CA">
            <span class="layer-icon">▦</span>
            <span class="layer-num">3</span>
          </button>
        </div>
        <div class="noise-card-blend-control">
          <input type="range" class="blend-slider" min="0" max="1" step="0.01" value="0">
          <span class="blend-value">0%</span>
        </div>
        <div class="noise-card-last-control"></div>
        <div class="noise-card-actions">
          <button class="noise-card-btn noise-card-btn-close" data-action="close" title="Close">&times;</button>
        </div>
      </div>
      <div class="noise-card-body">
        ${hasTarget ? '' : '<div class="noise-card-canvas-wrap"><canvas class="noise-card-canvas"></canvas></div>'}
        <div class="noise-card-cli">
          <div class="noise-cli-status-row">
            <div class="noise-cli-output"></div>
            <div class="noise-cli-history"></div>
          </div>
          <div class="noise-cli-input-row">
            <span class="noise-cli-prompt">1&gt;</span>
            <input type="text" class="noise-cli-input" placeholder="Tab for commands" spellcheck="false" autocomplete="off">
          </div>
          <div class="noise-cli-completions"></div>
          <div class="noise-cli-dropdown"></div>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    // Close button
    this.element.addEventListener('click', (e) => {
      if (e.target.dataset.action === 'close') this.destroy();
      if (e.target.dataset.action === 'execute') {
        const input = this.element.querySelector('.noise-cli-input');
        this.cli.executeFromInput(input);
      }

      // Layer buttons
      const layerBtn = e.target.closest('.layer-btn');
      if (layerBtn) {
        const num = parseInt(layerBtn.dataset.layer);
        this.layers.selectLayer(num);
        this._updateLayerButtons();
        this._updatePrompt();
      }
    });

    // Blend slider
    const blendSlider = this.element.querySelector('.blend-slider');
    blendSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      this.layers.setBlend(value);
      this.layers.render();
      this._updateBlendSlider();
    });

    // CLI input
    const input = this.element.querySelector('.noise-cli-input');
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.cli.executeFromInput(input);
        this.cli._hideDropdown();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.cli.historyUp(input);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.cli.historyDown(input);
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.cli.tabComplete(input);
      } else if (e.key === 'Escape') {
        this.cli._hideDropdown();
        this.cli._hideCompletions();
      }
    });

    // Hide dropdown and completions when typing
    input.addEventListener('input', () => {
      this.cli._hideDropdown();
      this.cli._hideCompletions();
    });

    // Dragging
    if (this.config.draggable && !this.config.attachTo) {
      this._initDrag();
    }
  }

  _initDrag() {
    const header = this.element.querySelector('.noise-card-header');
    let dragging = false;
    let offset = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      dragging = true;
      offset.x = e.clientX - this.element.offsetLeft;
      offset.y = e.clientY - this.element.offsetTop;
      this.element.classList.add('dragging');
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const x = Math.max(0, e.clientX - offset.x);
      const y = Math.max(0, e.clientY - offset.y);
      this.element.style.left = x + 'px';
      this.element.style.top = y + 'px';
    });

    document.addEventListener('mouseup', () => {
      dragging = false;
      this.element.classList.remove('dragging');
    });
  }

  _updateLayerButtons() {
    const selected = this.layers.getSelectedLayerNum();
    this.element.querySelectorAll('.layer-btn').forEach(btn => {
      const num = parseInt(btn.dataset.layer);
      btn.classList.toggle('active', num === selected);
    });
  }

  _updatePrompt() {
    const selected = this.layers.getSelectedLayerNum();
    const layer = this.layers.getSelectedLayer();
    const prompt = this.element.querySelector('.noise-cli-prompt');
    if (!prompt) return;

    // Show layer:type> format (e.g., "1:noise>", "3:cymatics>")
    let subtype = layer.type; // 'noise', 'image', 'ca'
    if (layer.type === 'ca' && layer.config?.caType) {
      subtype = layer.config.caType; // wolfram, life, cyclic, cymatics
    }
    prompt.textContent = `${selected}:${subtype}>`;
  }

  _updateBlendSlider() {
    const slider = this.element.querySelector('.blend-slider');
    const valueEl = this.element.querySelector('.blend-value');
    const blend = this.layers.blend;

    slider.value = blend;

    // Show which layers are visible
    let label;
    if (blend <= 0.25) {
      label = blend === 0 ? 'L1' : `L1↔L2`;
    } else if (blend <= 0.75) {
      label = blend === 0.5 ? 'L2' : (blend < 0.5 ? 'L1↔L2' : 'L2↔L3');
    } else {
      label = blend === 1 ? 'L3' : 'L2↔L3';
    }
    valueEl.textContent = label;
  }

  _updateControlHistory() {
    const headerContainer = this.element.querySelector('.noise-card-last-control');
    const historyRow = this.element.querySelector('.noise-cli-history');
    const history = this.cli?.controlHistory || [];
    const now = Date.now();
    const persistence = (this.cli?.historyPersistence || 30) * 1000; // ms

    // Calculate opacity based on age (1.0 = new, 0.2 = old)
    const getOpacity = (time) => {
      const age = now - (time || now);
      const fade = Math.max(0.2, 1 - (age / persistence));
      return fade;
    };

    // Header: last 2 pills (full format)
    if (headerContainer) {
      const recent = history.slice(-2);
      if (recent.length === 0) {
        headerContainer.innerHTML = '';
      } else {
        headerContainer.innerHTML = recent.map(({ param, value, time }) => {
          const opacity = getOpacity(time);
          return `<span class="control-history-pill" data-param="${param}" style="opacity:${opacity.toFixed(2)}">${param}=${value}</span>`;
        }).join('');
      }
    }

    // Inline history: older pills (abbreviated)
    if (historyRow) {
      const older = history.slice(0, -2);
      if (older.length === 0) {
        historyRow.innerHTML = '';
      } else {
        historyRow.innerHTML = older.map(({ param, value, time }) => {
          const abbr = param.slice(0, 3);
          const shortVal = String(value).slice(0, 5);
          const opacity = getOpacity(time);
          return `<span class="history-pill-mini" data-param="${param}" title="${param}=${value}" style="opacity:${opacity.toFixed(2)}">${abbr}:${shortVal}</span>`;
        }).join('');
      }
    }

    // Click handlers for all pills
    this.element.querySelectorAll('.control-history-pill, .history-pill-mini').forEach(pill => {
      pill.onclick = () => {
        const input = this.element.querySelector('.noise-cli-input');
        input.value = pill.dataset.param;
        this.cli.tabComplete(input);
      };
    });

    // Schedule fade update
    this._scheduleFadeUpdate();
  }

  _scheduleFadeUpdate() {
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    const history = this.cli?.controlHistory || [];
    if (history.length > 0) {
      this._fadeTimer = setTimeout(() => this._updateControlHistory(), 1000);
    }
  }

  // Public API for CLI
  setNoise(config) {
    // Legacy support - apply to layer 1
    const layer = this.layers.getLayer(1);
    if (layer && config) {
      layer.setConfig(config);
      this.layers.render();
    }
  }

  getNoiseConfig() {
    return this.layers.getConfig();
  }

  destroy() {
    if (this._fadeTimer) clearTimeout(this._fadeTimer);
    if (this.layers) this.layers.destroy();
    if (this.cli) this.cli.destroy();
    // Remove canvas and restore original content
    if (this.target) {
      if (this.canvas) this.canvas.remove();
      // Restore hidden content
      const hiddenContent = this.target.querySelectorAll('[data-noise-card-display]');
      hiddenContent.forEach(el => {
        el.style.cssText = el.dataset.noiseCardDisplay || '';
        delete el.dataset.noiseCardDisplay;
      });
    }
    this.element?.remove();
    cards.delete(this.id);
  }
}

export default NoiseCard;
