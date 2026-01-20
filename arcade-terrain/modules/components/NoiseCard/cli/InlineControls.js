/**
 * InlineControls - Renders inline UI controls for CLI parameters
 *
 * Supports:
 *   - Slider: For numeric parameters with min/max
 *   - Select: For enum parameters with options
 *   - Toggle: For boolean parameters
 *   - Palette: For color palette selection with swatches
 *
 * Controls render in the dropdown area and update values in real-time.
 */

import { PALETTES, getPalette } from './ColorPalette.js';

// Preset options by CA type (for dynamic preset selection)
const PRESET_OPTIONS = {
  wolfram: ['chaos', 'sierpinski', 'turing', 'traffic', 'pascal', 'xor', 'nested', 'stripes'],
  life: ['conway', 'highlife', 'seeds', 'maze', 'coral', 'amoeba', 'daynight', 'morley'],
  cyclic: [],
  cymatics: []
};

export class InlineControls {
  constructor(cli, container) {
    this.cli = cli;
    this.container = container;
    this.activeControl = null;
    this.onDismiss = null;

    // Bind escape key handler
    this._onKeyDown = this._onKeyDown.bind(this);
    document.addEventListener('keydown', this._onKeyDown);
  }

  /**
   * Show appropriate control for parameter
   * @param {object} paramDef - Parameter definition from ParameterSchema
   * @param {*} currentValue - Current value of the parameter
   */
  show(paramDef, currentValue) {
    this.hide();

    switch (paramDef.type) {
      case 'slider':
        this._showSlider(paramDef, currentValue);
        break;
      case 'select':
        this._showSelect(paramDef, currentValue);
        break;
      case 'toggle':
        this._showToggle(paramDef, currentValue);
        break;
      case 'palette':
        this._showPalette(paramDef, currentValue);
        break;
      case 'oscillator':
        this._showOscillator(paramDef);
        break;
      default:
        console.warn(`[InlineControls] Unknown type: ${paramDef.type}`);
    }
  }

  /**
   * Hide and remove active control
   */
  hide() {
    if (this.activeControl) {
      this.activeControl.remove();
      this.activeControl = null;
    }
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Check if control is currently visible
   */
  isVisible() {
    return this.activeControl !== null;
  }

  /**
   * Handle escape key to dismiss
   */
  _onKeyDown(e) {
    if (e.key === 'Escape' && this.activeControl) {
      this.hide();
      if (this.onDismiss) this.onDismiss();
    }
  }

  /**
   * Render slider control
   */
  _showSlider(def, value) {
    const isLog = def.logarithmic && def.logMin && def.logMax;

    // For logarithmic sliders, convert actual value to slider position
    let sliderVal;
    if (isLog) {
      const actualVal = parseFloat(value) || def.logMin;
      // slider = log(val/logMin) / log(logMax/logMin)
      sliderVal = Math.log(actualVal / def.logMin) / Math.log(def.logMax / def.logMin);
      sliderVal = Math.max(0, Math.min(1, sliderVal));
    } else {
      sliderVal = parseFloat(value) || def.default || def.min;
    }

    const el = document.createElement('div');
    el.className = 'cli-slider-container';
    el.dataset.state = 'active';

    // Build presets display if available
    let presetsHtml = '';
    if (def.presets) {
      const presetItems = Object.entries(def.presets)
        .map(([v, name]) => `<span class="slider-preset" data-value="${v}">${name}</span>`)
        .join('');
      presetsHtml = `<div class="slider-presets">${presetItems}</div>`;
    }

    const displayVal = isLog ? this._logToValue(sliderVal, def) : sliderVal;

    el.innerHTML = `
      <div class="slider-header">
        <span class="slider-label">${def.name}</span>
        <span class="slider-value">${this._formatValue(displayVal, def)}</span>
      </div>
      <div class="slider-track">
        <div class="slider-fill" style="width: ${sliderVal * 100}%"></div>
        <input type="range" class="slider-input"
          min="${def.min}" max="${def.max}" step="${def.step}" value="${sliderVal}">
      </div>
      ${presetsHtml}
      ${def.description ? `<div class="slider-description">${def.description}</div>` : ''}
    `;

    const input = el.querySelector('.slider-input');
    const valueEl = el.querySelector('.slider-value');
    const fill = el.querySelector('.slider-fill');

    // Update on drag
    input.addEventListener('input', (e) => {
      const sliderPos = parseFloat(e.target.value);
      let actualVal;

      if (isLog) {
        // Convert slider position to actual value: val = logMin * (logMax/logMin)^slider
        actualVal = this._logToValue(sliderPos, def);
      } else {
        actualVal = sliderPos;
      }

      valueEl.textContent = this._formatValue(actualVal, def);
      fill.style.width = (sliderPos / def.max) * 100 + '%';
      this.cli.execute(`${def.name} ${actualVal}`);
    });

    // Preset clicks
    el.querySelectorAll('.slider-preset').forEach(preset => {
      preset.addEventListener('click', () => {
        const presetVal = parseFloat(preset.dataset.value);
        if (isLog) {
          // Convert preset value to slider position
          const sliderPos = Math.log(presetVal / def.logMin) / Math.log(def.logMax / def.logMin);
          input.value = sliderPos;
          fill.style.width = sliderPos * 100 + '%';
        } else {
          input.value = presetVal;
          fill.style.width = this._percent(presetVal, def) + '%';
        }
        valueEl.textContent = this._formatValue(presetVal, def);
        this.cli.execute(`${def.name} ${presetVal}`);
      });
    });

    this._mount(el);
    input.focus();
  }

  /**
   * Convert logarithmic slider position (0-1) to actual value
   */
  _logToValue(sliderPos, def) {
    // val = logMin * (logMax/logMin)^slider
    return def.logMin * Math.pow(def.logMax / def.logMin, sliderPos);
  }

  /**
   * Render select control (button grid)
   */
  _showSelect(def, value) {
    const currentVal = value || def.default;

    // Handle dynamic options (e.g., preset depends on CA type)
    let options = def.options;
    if (def.dynamic && def.name === 'preset') {
      const layer = this.cli.layers.getSelectedLayer();
      const caType = layer.config?.caType || 'wolfram';
      options = PRESET_OPTIONS[caType] || [];

      // If no presets for this CA type, don't show the control
      if (options.length === 0) {
        this.hide();
        return;
      }
    }

    const el = document.createElement('div');
    el.className = 'cli-select-container';
    el.dataset.state = 'active';

    const optionsHtml = options.map(opt => `
      <button class="select-option ${opt === currentVal ? 'active' : ''}" data-value="${opt}">
        ${opt}
      </button>
    `).join('');

    el.innerHTML = `
      <div class="select-header">
        <span class="select-label">${def.name}</span>
      </div>
      <div class="select-options">
        ${optionsHtml}
      </div>
      ${def.description ? `<div class="select-description">${def.description}</div>` : ''}
    `;

    // Option clicks
    el.querySelectorAll('.select-option').forEach(btn => {
      btn.addEventListener('click', () => {
        // Update active state
        el.querySelectorAll('.select-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Execute command
        this.cli.execute(`${def.name} ${btn.dataset.value}`);
      });
    });

    this._mount(el);
  }

  /**
   * Render toggle control (ON/OFF button)
   */
  _showToggle(def, value) {
    const isOn = value === true || value === 'on' || value === 'true';

    const el = document.createElement('div');
    el.className = 'cli-toggle-container';
    el.dataset.state = 'active';

    el.innerHTML = `
      <div class="toggle-header">
        <span class="toggle-label">${def.name}</span>
        <button class="toggle-btn ${isOn ? 'active' : ''}">${isOn ? 'ON' : 'OFF'}</button>
      </div>
      ${def.description ? `<div class="toggle-description">${def.description}</div>` : ''}
    `;

    const btn = el.querySelector('.toggle-btn');
    btn.addEventListener('click', () => {
      const newState = btn.classList.toggle('active');
      btn.textContent = newState ? 'ON' : 'OFF';
      this.cli.execute(`${def.name} ${newState ? 'on' : 'off'}`);
    });

    this._mount(el);
  }

  /**
   * Render palette control with 8 color chips per palette
   */
  _showPalette(def, currentValue) {
    const el = document.createElement('div');
    el.className = 'cli-palette-container';
    el.dataset.state = 'active';

    const palettesHtml = def.options.map(name => {
      const palette = getPalette(name);
      if (!palette) return '';

      const isActive = currentValue === name;

      // Create 8 color chips
      const chipsHtml = palette.colors.map(color =>
        `<span class="palette-chip" style="background: ${color}"></span>`
      ).join('');

      return `
        <button class="palette-option ${isActive ? 'active' : ''}" data-palette="${name}">
          <div class="palette-chips">${chipsHtml}</div>
          <span class="palette-name">${palette.label}</span>
        </button>
      `;
    }).join('');

    el.innerHTML = `
      <div class="palette-header">
        <span class="palette-label">${def.name}</span>
      </div>
      <div class="palette-options">
        ${palettesHtml}
      </div>
    `;

    // Option clicks
    el.querySelectorAll('.palette-option').forEach(btn => {
      btn.addEventListener('click', () => {
        el.querySelectorAll('.palette-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.cli.execute(`palette ${btn.dataset.palette}`);
      });
    });

    this._mount(el);
  }

  /**
   * Render oscillator control panel with x, y, freq, amp sliders
   */
  _showOscillator(def) {
    const layer = this.cli.layers.getSelectedLayer();
    const caType = layer.config?.caType;

    // Only show for cymatics mode
    if (caType !== 'cymatics') {
      this.hide();
      return;
    }

    const idx = def.index;
    const osc = layer.config.osc[idx];
    const oscName = def.name; // osc1, osc2, osc3

    const el = document.createElement('div');
    el.className = 'cli-oscillator-container';
    el.dataset.state = 'active';

    // Define the sub-parameters for each oscillator
    const params = [
      { key: 'x', label: 'X', min: 0, max: 1, step: 0.01, value: osc.x },
      { key: 'y', label: 'Y', min: 0, max: 1, step: 0.01, value: osc.y },
      { key: 'freq', label: 'Freq', min: 0.01, max: 0.2, step: 0.005, value: osc.freq },
      { key: 'amp', label: 'Amp', min: 0, max: 1, step: 0.05, value: osc.amp }
    ];

    const slidersHtml = params.map(p => `
      <div class="osc-param">
        <span class="osc-param-label">${p.label}</span>
        <input type="range" class="osc-slider" data-key="${p.key}"
          min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}">
        <span class="osc-param-value">${p.value.toFixed(2)}</span>
      </div>
    `).join('');

    el.innerHTML = `
      <div class="osc-header">
        <span class="osc-title">${oscName.toUpperCase()}</span>
      </div>
      <div class="osc-params">
        ${slidersHtml}
      </div>
    `;

    // Bind slider events
    el.querySelectorAll('.osc-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const key = e.target.dataset.key;
        const val = parseFloat(e.target.value);
        const valueEl = e.target.nextElementSibling;
        valueEl.textContent = val.toFixed(2);

        // Update the oscillator config
        const newOsc = [...layer.config.osc];
        newOsc[idx] = { ...newOsc[idx], [key]: val };
        layer.setConfig({ osc: newOsc });

        // Update cymatics engine directly if available
        if (layer._cymatics) {
          layer._cymatics.setOscillator(idx, newOsc[idx]);
        }
      });
    });

    this._mount(el);
  }

  /**
   * Mount control element in container
   */
  _mount(el) {
    this.container.innerHTML = '';
    this.container.appendChild(el);
    this.container.style.display = 'block';
    this.activeControl = el;
  }

  /**
   * Calculate percentage for slider fill
   */
  _percent(val, def) {
    return ((val - def.min) / (def.max - def.min)) * 100;
  }

  /**
   * Format value for display (handle small decimals)
   */
  _formatValue(val, def) {
    // Determine decimal places from step
    if (def.step < 0.001) return val.toFixed(5);
    if (def.step < 0.01) return val.toFixed(4);
    if (def.step < 0.1) return val.toFixed(2);
    if (def.step < 1) return val.toFixed(2);
    return val.toString();
  }

  /**
   * Cleanup
   */
  destroy() {
    document.removeEventListener('keydown', this._onKeyDown);
    this.hide();
  }
}

export default InlineControls;
