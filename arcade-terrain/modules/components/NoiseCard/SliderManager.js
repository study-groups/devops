/**
 * SliderManager - Manages inline parameter sliders for CLI
 *
 * Slider Lifecycle (from Vecterm pattern):
 * - ACTIVE: Currently being edited, full interactivity
 * - HISTORY: Previous slider, dimmed but clickable to reactivate
 * - ARCHIVED: Swiped away, hidden but in history
 */

import { SLIDERS, CATEGORIES } from './cli-commands.js';
import { SliderGestures } from './SliderGestures.js';

// Helper functions
function getSliderConfig(cmd) {
  return SLIDERS[cmd.toLowerCase()] || null;
}

function getCategoryColor(cmd) {
  const slider = SLIDERS[cmd.toLowerCase()];
  if (!slider) return 'var(--one, #ff9900)';
  const cat = CATEGORIES[slider.category];
  return cat ? cat.color : 'var(--one, #ff9900)';
}

export const SLIDER_STATES = {
  ACTIVE: 'active',
  HISTORY: 'history',
  ARCHIVED: 'archived'
};

export class SliderManager {
  constructor(cli, outputElement) {
    this.cli = cli;
    this.outputElement = outputElement;
    this.sliders = new Map(); // command -> slider data
    this.activeSlider = null;
    this.sliderHistory = [];
    this.gestures = new SliderGestures(this);
  }

  /**
   * Show inline slider for a command
   */
  show(command, initialValue = null) {
    const config = getSliderConfig(command);
    if (!config) return null;

    // Archive current active slider if any
    if (this.activeSlider) {
      this._setState(this.activeSlider, SLIDER_STATES.HISTORY);
    }

    // Check if slider already exists for this command
    let sliderData = this.sliders.get(command);

    if (sliderData) {
      // Reactivate existing slider
      this._setState(command, SLIDER_STATES.ACTIVE);
    } else {
      // Create new slider
      sliderData = this._createSlider(command, config, initialValue);
      this.sliders.set(command, sliderData);
    }

    this.activeSlider = command;
    this.sliderHistory.push(command);

    // Scroll to slider
    sliderData.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    return sliderData;
  }

  /**
   * Create slider DOM element
   */
  _createSlider(command, config, initialValue) {
    const value = initialValue !== null ? initialValue : config.default;
    const color = getCategoryColor(command);

    // Calculate fill percentage
    const range = config.max - config.min;
    const fillPercent = ((value - config.min) / range) * 100;

    const container = document.createElement('div');
    container.className = 'cli-slider-container';
    container.dataset.state = SLIDER_STATES.ACTIVE;
    container.dataset.command = command;

    container.innerHTML = `
      <div class="slider-header">
        <span class="slider-label" style="color: ${color}">${command}</span>
        <span class="slider-value">${this._formatValue(value, config)}</span>
      </div>
      <div class="slider-track">
        <div class="slider-fill" style="width: ${fillPercent}%; background: ${color}"></div>
        <input type="range"
               class="slider-input"
               min="${config.min}"
               max="${config.max}"
               step="${config.step}"
               value="${value}">
      </div>
      <div class="slider-description">${config.description}</div>
    `;

    // Add event listeners
    const input = container.querySelector('.slider-input');
    const valueDisplay = container.querySelector('.slider-value');
    const fill = container.querySelector('.slider-fill');

    input.addEventListener('input', (e) => {
      const newValue = parseFloat(e.target.value);
      valueDisplay.textContent = this._formatValue(newValue, config);
      fill.style.width = `${((newValue - config.min) / range) * 100}%`;

      // Execute command with new value
      this.cli.execute(`${command} ${newValue}`);
    });

    // Click on container reactivates if in history state
    container.addEventListener('click', (e) => {
      if (container.dataset.state === SLIDER_STATES.HISTORY) {
        this._setState(command, SLIDER_STATES.ACTIVE);
        if (this.activeSlider && this.activeSlider !== command) {
          this._setState(this.activeSlider, SLIDER_STATES.HISTORY);
        }
        this.activeSlider = command;
        input.focus();
      }
    });

    // Insert into output area
    this.outputElement.appendChild(container);

    // Attach gesture handlers
    this.gestures.attach(container);

    return {
      element: container,
      input,
      config,
      value
    };
  }

  /**
   * Format value with unit
   */
  _formatValue(value, config) {
    // Handle decimal precision based on step
    const decimals = config.step < 1 ? Math.max(2, -Math.floor(Math.log10(config.step))) : 0;
    const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value);
    return `${formatted}${config.unit}`;
  }

  /**
   * Set slider state
   */
  _setState(command, state) {
    const sliderData = this.sliders.get(command);
    if (!sliderData) return;

    sliderData.element.dataset.state = state;

    if (state === SLIDER_STATES.ARCHIVED) {
      sliderData.element.style.display = 'none';
    } else {
      sliderData.element.style.display = '';
    }

    if (state === SLIDER_STATES.ACTIVE) {
      this.activeSlider = command;
    }
  }

  /**
   * Archive (hide) a slider
   */
  archive(command) {
    this._setState(command, SLIDER_STATES.ARCHIVED);
    if (this.activeSlider === command) {
      this.activeSlider = null;
    }
  }

  /**
   * Archive all sliders
   */
  archiveAll() {
    for (const command of this.sliders.keys()) {
      this.archive(command);
    }
  }

  /**
   * Get current value of a slider
   */
  getValue(command) {
    const sliderData = this.sliders.get(command);
    if (!sliderData) return null;
    return parseFloat(sliderData.input.value);
  }

  /**
   * Update slider value programmatically
   */
  setValue(command, value) {
    const sliderData = this.sliders.get(command);
    if (!sliderData) return;

    const config = sliderData.config;
    const clamped = Math.max(config.min, Math.min(config.max, value));

    sliderData.input.value = clamped;
    sliderData.element.querySelector('.slider-value').textContent =
      this._formatValue(clamped, config);

    const range = config.max - config.min;
    sliderData.element.querySelector('.slider-fill').style.width =
      `${((clamped - config.min) / range) * 100}%`;
  }

  /**
   * Check if a slider exists for command
   */
  hasSlider(command) {
    return this.sliders.has(command);
  }

  /**
   * Destroy all sliders
   */
  destroy() {
    for (const sliderData of this.sliders.values()) {
      sliderData.element.remove();
    }
    this.sliders.clear();
    this.activeSlider = null;
    this.sliderHistory = [];
  }
}

export default SliderManager;
