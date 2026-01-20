/**
 * CLI - Simple layer-aware command interface
 *
 * Prompt shows current layer and type: 1:noise> 2:image> 3:wolfram>
 * Commands apply to selected layer, filtered by subtype for CA layer
 * Tab shows available commands or inline controls
 */

import { saveConfig, loadConfig } from '../cli-storage.js';
import { getParameter, getParameterNames } from './ParameterSchema.js';
import { InlineControls } from './InlineControls.js';
import { getPalette, getPaletteNames } from './ColorPalette.js';

// Commands for each layer type
const LAYER_COMMANDS = {
  noise: ['type', 'scale', 'blocksize', 'colors', 'palette', 'churn', 'fade', 'rate'],
  image: ['src', 'scale', 'invert', 'hue', 'particles', 'emit', 'dissolve', 'reform', 'gravity', 'bounce'],
  ca: ['ca', 'preset', 'rule', 'cells', 'depth', 'density', 'palette', 'direction', 'osc1', 'osc2', 'osc3', 'freq', 'wavespeed']
};

const CA_TYPES = ['wolfram', 'life', 'cyclic', 'cymatics'];
const WOLFRAM_PRESETS = ['chaos', 'sierpinski', 'turing', 'traffic', 'pascal', 'xor', 'nested', 'stripes'];
const LIFE_PRESETS = ['conway', 'highlife', 'seeds', 'maze', 'coral', 'amoeba', 'daynight', 'morley'];

// CA type-specific commands for filtered tab completion
const CA_TYPE_COMMANDS = {
  wolfram: ['ca', 'preset', 'rule', 'cells', 'depth', 'direction', 'palette'],
  life: ['ca', 'preset', 'density', 'cells', 'depth', 'palette'],
  cyclic: ['ca', 'density', 'cells', 'depth', 'palette'],
  cymatics: ['ca', 'osc1', 'osc2', 'osc3', 'freq', 'wavespeed', 'cells', 'depth', 'palette']
};

const NOISE_TYPES = ['random', 'perlin', 'simplex', 'worley', 'scanlines', 'grid'];
const CA_RULES = { 30: 'chaos', 90: 'sierpinski', 110: 'turing', 184: 'traffic' };
const GLOBAL_COMMANDS = ['blend', 'save', 'load', 'start', 'stop', 'help', 'clear', 'z'];
const LETTERS = ['A', 'R', 'I', 'COLON_TOP', 'COLON_BOT', 'C', 'A2', 'D', 'E'];

export class CLI {
  constructor(card, layerManager, outputElement) {
    this.card = card;
    this.layers = layerManager;
    this.output = outputElement;
    this.dropdown = card.element.querySelector('.noise-cli-dropdown');
    this.completions = card.element.querySelector('.noise-cli-completions');
    this.history = [];
    this.historyIndex = -1;
    this.controlHistory = []; // Recent parameter changes for header pills
    this.maxControlHistory = 8;
    this.historyPersistence = 30; // Seconds until fully faded

    // Inline controls for parameter editing
    this.inlineControls = new InlineControls(this, this.dropdown);

    this._welcome();
  }

  _welcome() {
    this._log('info', 'Tab = commands • Click layer button to switch');
  }

  execute(cmdString) {
    const [cmd, ...args] = cmdString.trim().split(/\s+/);
    const command = cmd.toLowerCase();

    try {
      const result = this._dispatch(command, args);
      if (result) this._log('result', result);
    } catch (err) {
      this._log('error', err.message);
    }
  }

  _dispatch(command, args) {
    const layerNum = this.layers.getSelectedLayerNum();
    const layer = this.layers.getSelectedLayer();
    const layerType = layer.type;

    // Track control history for header pills
    const setResult = (param, value) => {
      // Remove if already in history, then add to end with timestamp
      this.controlHistory = this.controlHistory.filter(c => c.param !== param);
      this.controlHistory.push({ param, value, time: Date.now() });
      // Keep only the most recent N
      if (this.controlHistory.length > this.maxControlHistory) {
        this.controlHistory.shift();
      }
      this.card._updateControlHistory?.();
      return `${param} = ${value}`;
    };

    // === GLOBAL COMMANDS ===
    if (command === 'blend') {
      const val = parseFloat(args[0]);
      if (isNaN(val)) return `blend = ${this.layers.blend.toFixed(2)}`;
      this.layers.setBlend(val);
      this.layers.render();
      this.card._updateBlendSlider();
      return setResult('blend', val);
    }

    if (command === 'rate') {
      if (layerType !== 'noise') {
        return `rate: use layer 1`;
      }
      const val = parseFloat(args[0]);
      if (isNaN(val)) {
        const r = layer.config.rate || 30;
        return `rate = ${r < 1 ? r.toFixed(2) : r.toFixed(1)} updates/sec`;
      }
      // Accept direct rate value (0.01 to 60)
      const clamped = Math.max(0.01, Math.min(60, val));
      layer.setConfig({ rate: clamped });
      const display = clamped < 1 ? clamped.toFixed(2) : clamped.toFixed(1);
      return setResult('rate', `${display}/s`);
    }

    if (command === 'help' || command === '?') {
      return this._help();
    }

    if (command === 'save') {
      const config = this.layers.getConfig();
      if (saveConfig(this.card.id, config)) return 'saved';
      return 'save failed';
    }

    if (command === 'load') {
      const config = loadConfig(this.card.id);
      if (config) {
        this.layers.setConfig(config);
        return 'loaded';
      }
      return 'no saved config';
    }

    if (command === 'start') { this.layers.start(); return 'started'; }
    if (command === 'stop') { this.layers.stop(); return 'stopped'; }
    if (command === 'clear') { this.output.innerHTML = ''; return null; }

    // === LAYER 1: NOISE ===
    if (command === 'type') {
      if (layerType !== 'noise') {
        return `type: use layer 1`;
      }
      const val = args[0];
      if (!val) return `type = ${layer.config.noiseType}`;
      if (!NOISE_TYPES.includes(val)) return `unknown: ${val}`;
      layer.setConfig({ noiseType: val });
      this.layers.render();
      return setResult('type', val);
    }

    if (command === 'blocksize') {
      if (layerType !== 'noise') {
        return `blocksize: use layer 1`;
      }
      const val = parseInt(args[0]);
      if (isNaN(val)) return `blocksize = ${layer.config.blockSize || 1}`;
      layer.setConfig({ blockSize: Math.max(1, Math.min(100, val)) });
      this.layers.render();
      return setResult('blocksize', val);
    }

    if (command === 'churn') {
      if (layerType !== 'noise') {
        return `churn: use layer 1`;
      }
      const val = parseFloat(args[0]);
      if (isNaN(val)) return `churn = ${layer.config.churn} (1=all update, 0.1=10% update)`;
      layer.setConfig({ churn: Math.max(0, Math.min(1, val)) });
      this.layers.render();
      return setResult('churn', val.toFixed(2));
    }

    if (command === 'fade') {
      if (layerType !== 'noise') {
        return `fade: use layer 1`;
      }
      const val = parseFloat(args[0]);
      if (isNaN(val)) return `fade = ${layer.config.fade} (0=instant, 0.9=heavy trail)`;
      layer.setConfig({ fade: Math.max(0, Math.min(1, val)) });
      this.layers.render();
      return setResult('fade', val.toFixed(2));
    }

    // === LAYER 3: CA ===
    if (command === 'rule') {
      if (layerType !== 'ca') {
        return `rule: use layer 3`;
      }
      let val = parseInt(args[0]);
      // Check for named rule
      if (isNaN(val) && args[0]) {
        const named = Object.entries(CA_RULES).find(([n, name]) => name === args[0]);
        if (named) val = parseInt(named[0]);
      }
      if (isNaN(val)) return `rule = ${layer.config.rule}`;
      layer.setConfig({ rule: Math.max(0, Math.min(255, val)) });
      this.layers.render();
      const name = CA_RULES[val] || '';
      return setResult('rule', name ? `${val} (${name})` : val);
    }

    if (command === 'cells') {
      if (layerType !== 'ca') {
        return `cells: use layer 3`;
      }
      const val = parseInt(args[0]);
      if (isNaN(val)) return `cells = ${layer.config.cellSize}`;
      layer.setConfig({ cellSize: Math.max(1, Math.min(32, val)) });
      this.layers.render();
      return setResult('cells', val);
    }

    if (command === 'direction') {
      if (layerType !== 'ca') {
        return `direction: use layer 3`;
      }
      const opts = ['up', 'down', 'left', 'right', 'none'];
      const val = args[0];
      if (!val || !opts.includes(val)) return `direction = ${layer.config.direction}`;
      layer.setConfig({ direction: val });
      return setResult('direction', val);
    }

    // === CA TYPE AND PRESETS ===
    if (command === 'ca') {
      if (layerType !== 'ca') {
        return `ca: use layer 3`;
      }
      const val = args[0];
      if (!val) return `ca = ${layer.config.caType} (wolfram, life, cyclic, cymatics)`;
      if (!CA_TYPES.includes(val)) return `unknown: ${val}. Options: wolfram, life, cyclic, cymatics`;
      layer.setConfig({ caType: val });
      this.layers.render();
      this.card._updatePrompt(); // Update prompt to show new CA type
      return setResult('ca', val);
    }

    if (command === 'preset') {
      if (layerType !== 'ca') {
        return `preset: use layer 3`;
      }
      const val = args[0];
      const caType = layer.config.caType;
      const presets = caType === 'wolfram' ? WOLFRAM_PRESETS :
                      caType === 'life' ? LIFE_PRESETS : [];
      if (!val) return `presets (${caType}): ${presets.join(', ')}`;
      if (!presets.includes(val)) return `unknown: ${val}`;
      layer.setConfig({ preset: val });
      this.layers.render();
      return setResult('preset', val);
    }

    if (command === 'density') {
      if (layerType !== 'ca') {
        return `density: use layer 3`;
      }
      const val = parseFloat(args[0]);
      if (isNaN(val)) return `density = ${layer.config.density} (0-1)`;
      layer.setConfig({ density: Math.max(0, Math.min(1, val)) });
      return setResult('density', val);
    }

    if (command === 'depth') {
      if (layerType !== 'ca') {
        return `depth: use layer 3`;
      }
      const val = parseInt(args[0]);
      if (isNaN(val)) return `depth = ${layer.config.depth} (2=mono, 8=full)`;
      layer.setConfig({ depth: Math.max(2, Math.min(8, val)) });
      this.layers.render();
      return setResult('depth', val);
    }

    // === CYMATICS OSCILLATOR COMMANDS ===
    if (command === 'osc1' || command === 'osc2' || command === 'osc3') {
      if (layerType !== 'ca' || layer.config.caType !== 'cymatics') {
        return `${command}: use ca cymatics mode`;
      }
      const idx = parseInt(command.slice(-1)) - 1;
      const [xArg, yArg] = args;
      if (!xArg || !yArg) {
        const osc = layer.config.osc[idx];
        return `${command} = ${osc.x.toFixed(2)} ${osc.y.toFixed(2)} (x y position 0-1)`;
      }
      const x = parseFloat(xArg);
      const y = parseFloat(yArg);
      if (isNaN(x) || isNaN(y)) return `usage: ${command} <x> <y> (0-1)`;
      const osc = [...layer.config.osc];
      osc[idx] = { ...osc[idx], x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
      layer.setConfig({ osc });
      return setResult(command, `${x.toFixed(2)} ${y.toFixed(2)}`);
    }

    if (command === 'freq') {
      if (layerType !== 'ca' || layer.config.caType !== 'cymatics') {
        return `freq: use ca cymatics mode`;
      }
      const val = parseFloat(args[0]);
      if (isNaN(val)) {
        return `freq = ${layer.config.osc[0].freq} (all oscillators)`;
      }
      const osc = layer.config.osc.map(o => ({ ...o, freq: Math.max(0.01, Math.min(0.2, val)) }));
      layer.setConfig({ osc });
      return setResult('freq', val);
    }

    if (command === 'wavespeed') {
      if (layerType !== 'ca' || layer.config.caType !== 'cymatics') {
        return `wavespeed: use ca cymatics mode`;
      }
      const val = parseFloat(args[0]);
      if (isNaN(val)) return `wavespeed = ${layer.config.waveSpeed}`;
      layer.setConfig({ waveSpeed: Math.max(0, Math.min(1, val)) });
      if (layer._cymatics) layer._cymatics.speed = val;
      return setResult('wavespeed', val);
    }

    // === SHARED: scale, colors ===
    if (command === 'scale') {
      if (layerType === 'image') {
        const val = parseFloat(args[0]);
        if (isNaN(val)) return `scale = ${layer.config.scale}`;
        layer.setConfig({ scale: Math.max(0.1, Math.min(2, val)) });
        this.layers.render();
        return setResult('scale', val);
      }
      if (layerType === 'noise') {
        const val = parseFloat(args[0]);
        if (isNaN(val)) return `scale = ${layer.config.scale}`;
        layer.setConfig({ scale: Math.max(0.005, Math.min(0.2, val)) });
        this.layers.render();
        return setResult('scale', val);
      }
      return `scale: use layer 1 or 2`;
    }

    if (command === 'colors') {
      if (layerType !== 'noise' && layerType !== 'ca') {
        return `colors: use layer 1 or 3`;
      }
      if (!args.length) {
        return `colors = ${layer.config.colors?.join(' ') || 'none'}`;
      }
      // Accept hex colors (with or without #)
      const colors = args.map(c => c.startsWith('#') ? c : `#${c}`);
      layer.setConfig({ colors });
      this.layers.render();
      return setResult('colors', colors.join(' '));
    }

    if (command === 'palette') {
      if (layerType !== 'noise' && layerType !== 'ca') {
        return `palette: use layer 1 or 3`;
      }
      const name = args[0];
      if (!name) {
        return `palettes: ${getPaletteNames().join(', ')}`;
      }
      const palette = getPalette(name);
      if (!palette) {
        return `unknown palette: ${name}`;
      }
      layer.setConfig({ colors: palette.colors });
      this.layers.render();
      return setResult('palette', name);
    }

    // === LAYER 2: IMAGE ===
    if (command === 'src') {
      if (layerType !== 'image') {
        return `src: use layer 2`;
      }
      if (!args[0]) return `src = ${layer.config.src}`;
      layer.setConfig({ src: args[0] });
      return setResult('src', args[0]);
    }

    if (command === 'invert') {
      if (layerType !== 'image') {
        return `invert: use layer 2`;
      }
      layer.setConfig({ invert: !layer.config.invert });
      this.layers.render();
      return setResult('invert', layer.config.invert);
    }

    if (command === 'hue') {
      if (layerType !== 'image') {
        return `hue: use layer 2`;
      }
      const val = parseInt(args[0]);
      if (isNaN(val)) return `hue = ${layer.config.hue || 0}`;
      layer.setConfig({ hue: val % 360 });
      this.layers.render();
      return setResult('hue', val);
    }

    // === LAYER 2: PARTICLE COMMANDS ===
    if (command === 'particles') {
      if (layerType !== 'image') {
        return `particles: use layer 2`;
      }
      const val = args[0]?.toLowerCase();
      if (val === 'on') {
        layer.enableParticles(true);
        return setResult('particles', 'on');
      }
      if (val === 'off') {
        layer.enableParticles(false);
        return setResult('particles', 'off');
      }
      return `particles = ${layer.particlesEnabled ? 'on' : 'off'}`;
    }

    if (command === 'emit') {
      if (layerType !== 'image') {
        return `emit: use layer 2`;
      }
      if (!layer.particlesEnabled) {
        layer.enableParticles(true);
      }
      const count = parseInt(args[0]) || 100;
      layer.emitParticles(count);
      return setResult('emit', count);
    }

    if (command === 'dissolve') {
      if (layerType !== 'image') {
        return `dissolve: use layer 2`;
      }
      layer.dissolve();
      return setResult('dissolve', 'active');
    }

    if (command === 'reform') {
      if (layerType !== 'image') {
        return `reform: use layer 2`;
      }
      layer.reform();
      return setResult('reform', 'active');
    }

    if (command === 'gravity') {
      if (layerType !== 'image') {
        return `gravity: use layer 2`;
      }
      const val = parseFloat(args[0]);
      if (isNaN(val)) return `gravity = ${layer.particles.config.gravity}`;
      layer.particles.config.gravity = val;
      return setResult('gravity', val);
    }

    if (command === 'bounce') {
      if (layerType !== 'image') {
        return `bounce: use layer 2`;
      }
      const val = parseFloat(args[0]);
      if (isNaN(val)) return `bounce = ${layer.particles.config.bounce}`;
      layer.particles.config.bounce = Math.max(0, Math.min(1, val));
      return setResult('bounce', val);
    }

    // === Z-INDEX COMMANDS ===
    // Syntax: z layer:element value  OR  layer:element:z value
    if (command === 'z') {
      return this._handleZCommand(args);
    }

    // Handle colon syntax: 2:A:z 5
    if (command.includes(':')) {
      return this._handleColonSyntax(command, args);
    }

    return `Unknown command: ${command}. Tab for options.`;
  }

  /**
   * Handle z-index command
   */
  _handleZCommand(args) {
    if (!args.length) {
      return `z-index syntax:\n  z 1 50      (set layer 1 z to 50)\n  z 2:A 5     (set letter A z to base+5)\n  z reset     (reset all)`;
    }

    if (args[0] === 'reset') {
      this.layers.getZManager().reset();
      return 'Z-index reset to defaults';
    }

    // z 1 50 - set layer z
    if (args.length === 2 && !args[0].includes(':')) {
      const layerNum = parseInt(args[0]);
      const value = parseInt(args[1]);
      if (!isNaN(layerNum) && !isNaN(value)) {
        this.layers.setLayerZ(layerNum, value);
        return `Layer ${layerNum} z-index = ${value}`;
      }
    }

    // z 2:A 5 - set element z
    if (args.length === 2 && args[0].includes(':')) {
      const [layerStr, element] = args[0].split(':');
      const layerNum = parseInt(layerStr);
      const value = parseInt(args[1]);
      if (!isNaN(layerNum) && element && !isNaN(value)) {
        this.layers.setElementZ(layerNum, element.toUpperCase(), value);
        return `${element.toUpperCase()} z-index = ${this.layers.getZ(layerNum, element.toUpperCase())}`;
      }
    }

    return `Invalid z syntax. Try: z 2:A 5`;
  }

  /**
   * Handle colon syntax: 2:A:z 5
   */
  _handleColonSyntax(command, args) {
    const parts = command.split(':');

    // 2:A:z with value in args
    if (parts.length === 3 && parts[2] === 'z') {
      const layerNum = parseInt(parts[0]);
      const element = parts[1].toUpperCase();
      const value = parseInt(args[0]);

      if (!isNaN(layerNum) && element && !isNaN(value)) {
        this.layers.setElementZ(layerNum, element, value);
        return `${element} z-index = ${this.layers.getZ(layerNum, element)}`;
      }
    }

    // 1:z with value in args (layer z)
    if (parts.length === 2 && parts[1] === 'z') {
      const layerNum = parseInt(parts[0]);
      const value = parseInt(args[0]);

      if (!isNaN(layerNum) && !isNaN(value)) {
        this.layers.setLayerZ(layerNum, value);
        return `Layer ${layerNum} z-index = ${value}`;
      }
    }

    return `Invalid syntax: ${command}`;
  }

  tabComplete(input) {
    const val = input.value.trim().toLowerCase();
    const layerNum = this.layers.getSelectedLayerNum();
    const layer = this.layers.getSelectedLayer();
    const layerType = layer.type;

    // Get layer commands - for CA, filter by CA subtype
    let layerCmds;
    if (layerType === 'ca' && layer.config?.caType) {
      layerCmds = CA_TYPE_COMMANDS[layer.config.caType] || LAYER_COMMANDS.ca;
    } else {
      layerCmds = LAYER_COMMANDS[layerType] || [];
    }
    const allCmds = [...layerCmds, ...GLOBAL_COMMANDS];

    // Check if input is a valid parameter - show inline control
    if (val) {
      const paramDef = getParameter(val, layerType);
      if (paramDef) {
        const currentValue = this._getCurrentValue(val, layerType, layer);
        this._hideCompletions();
        this.inlineControls.show(paramDef, currentValue);
        return;
      }
    }

    // Hide any active inline control when showing completions
    this.inlineControls.hide();

    // Show completions pills
    if (!val) {
      // Show all commands as pills
      this._showCompletions([...layerCmds, ...GLOBAL_COMMANDS]);
      return;
    }

    // Partial match
    const matches = allCmds.filter(c => c.startsWith(val));

    if (matches.length === 1) {
      input.value = matches[0] + ' ';
      this._hideCompletions();
    } else if (matches.length > 1) {
      this._showCompletions(matches);
    } else {
      this._hideCompletions();
    }
  }

  _showCompletions(items) {
    if (!this.completions) return;

    const pills = items.map(item => {
      // Color based on category
      let colorClass = 'pill-global';
      if (LAYER_COMMANDS.noise?.includes(item)) colorClass = 'pill-noise';
      else if (LAYER_COMMANDS.image?.includes(item)) colorClass = 'pill-image';
      else if (LAYER_COMMANDS.ca?.includes(item)) colorClass = 'pill-ca';
      return `<button class="completion-pill ${colorClass}" data-cmd="${item}">${item}</button>`;
    }).join('');

    this.completions.innerHTML = pills;
    this.completions.classList.add('active');

    // Click to insert command
    this.completions.querySelectorAll('.completion-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = this.card.element.querySelector('.noise-cli-input');
        input.value = btn.dataset.cmd + ' ';
        input.focus();
        // Trigger tabComplete again to show parameter control
        this.tabComplete(input);
      });
    });
  }

  _hideCompletions() {
    if (this.completions) {
      this.completions.innerHTML = '';
      this.completions.classList.remove('active');
    }
  }

  /**
   * Get current value of a parameter from layer config
   */
  _getCurrentValue(paramName, layerType, layer) {
    // Map parameter names to config properties
    const configMap = {
      // Global
      blend: () => this.layers.blend,

      // Noise layer
      type: () => layer.config?.noiseType,
      scale: () => layer.config?.scale,
      blocksize: () => layer.config?.blockSize || 1,
      colors: () => layer.config?.colors?.join(' '),
      churn: () => layer.config?.churn ?? 1,
      fade: () => layer.config?.fade ?? 0,
      rate: () => layer.config?.rate ?? 30,

      // Image layer
      invert: () => layer.config?.invert,
      hue: () => layer.config?.hue || 0,
      particles: () => layer.particlesEnabled,
      gravity: () => layer.particles?.config?.gravity,
      bounce: () => layer.particles?.config?.bounce,

      // CA layer
      rule: () => layer.config?.rule,
      cells: () => layer.config?.cellSize,
      direction: () => layer.config?.direction,
      ca: () => layer.config?.caType,
      preset: () => layer.config?.preset,
      density: () => layer.config?.density,
      depth: () => layer.config?.depth,
      freq: () => layer.config?.osc?.[0]?.freq,
      wavespeed: () => layer.config?.waveSpeed
    };

    const getter = configMap[paramName];
    if (getter) {
      try {
        return getter();
      } catch (e) {
        return null;
      }
    }

    return null;
  }

  _showDropdown(groups) {
    if (!this.dropdown) return;

    let html = '';
    groups.forEach(g => {
      html += `<div class="dropdown-group">`;
      html += `<span class="dropdown-label">${g.label}:</span> `;
      html += g.items.map(i => `<span class="dropdown-item">${i}</span>`).join(' ');
      html += `</div>`;
    });

    this.dropdown.innerHTML = html;
    this.dropdown.style.display = 'block';

    // Click to insert command
    this.dropdown.querySelectorAll('.dropdown-item').forEach(el => {
      el.addEventListener('click', () => {
        const input = this.card.element.querySelector('.noise-cli-input');
        input.value = el.textContent + ' ';
        input.focus();
        this._hideDropdown();
      });
    });
  }

  _hideDropdown() {
    if (this.dropdown) {
      this.dropdown.style.display = 'none';
    }
  }

  _help() {
    return `
LAYER 1 (noise): type, scale, palette, churn, fade, rate
  churn 0.1   - 10% of pixels update per step (organic)
  fade 0.8    - heavy trails when updating
  rate 0.5    - slow simulation (0.5 updates/sec)

LAYER 2 (image): scale, invert, hue, particles, dissolve
LAYER 3 (ca): ca, preset, rule, cells, density, depth, palette

CA TYPES: wolfram, life, cyclic, cymatics
CYMATICS: osc1, osc2, osc3, freq, wavespeed

GLOBAL: blend, save, load, start, stop
`.trim();
  }

  historyUp(input) {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      input.value = this.history[this.historyIndex];
    }
  }

  historyDown(input) {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      input.value = this.history[this.historyIndex];
    } else {
      this.historyIndex = this.history.length;
      input.value = '';
    }
  }

  executeFromInput(input) {
    const cmd = input.value.trim();
    if (cmd) {
      this.execute(cmd);
      this.history.push(cmd);
      this.historyIndex = this.history.length;
      input.value = '';
    }
  }

  _log(type, msg) {
    const el = document.createElement('div');
    el.className = `noise-cli-entry noise-cli-${type}`;
    el.textContent = msg;
    this.output.appendChild(el);
    this.output.scrollTop = this.output.scrollHeight;
    while (this.output.children.length > 100) {
      this.output.removeChild(this.output.firstChild);
    }
  }

  destroy() {
    if (this.inlineControls) {
      this.inlineControls.destroy();
    }
  }
}

export default CLI;
