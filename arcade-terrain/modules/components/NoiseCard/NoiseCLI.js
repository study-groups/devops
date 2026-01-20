/**
 * NoiseCLI - Refined command line interface
 *
 * Categories:
 *   type   → noise generator (random, perlin, cellular...)
 *   ca     → cellular automata (rule, cells)
 *   style  → visual (blend, speed, scale, color)
 *   preset → named presets
 *
 * Discovery:
 *   Tab         → show categories
 *   type + Tab  → show noise types
 *   ca + Tab    → show famous rules
 *   cmd?        → help for command
 *
 * Persistence:
 *   save        → save current settings
 *   load        → restore saved settings
 */

import { NoiseService } from '../../services/noise/index.js';
import { CellularAutomata } from '../../services/noise/cellular.js';
import { SliderManager } from './SliderManager.js';
import {
  CATEGORIES, NOISE_TYPES, CA_RULES, PRESET_GROUPS,
  SLIDERS, ALL_COMMANDS, getCompletions
} from './cli-commands.js';
import { saveConfig, loadConfig, loadLastConfig } from './cli-storage.js';

export class NoiseCLI {
  constructor(card) {
    this.card = card;
    this.history = [];
    this.historyIndex = -1;

    const output = card.element.querySelector('.noise-cli-output');
    this.sliderManager = new SliderManager(this, output);

    this._welcome();
    this._tryAutoLoad();
  }

  _welcome() {
    const output = this.card.element.querySelector('.noise-cli-output');
    this._logStyled(output, [
      { text: 'NoiseCard', color: 'var(--one)' },
      { text: ' — press ', color: 'var(--ink)' },
      { text: 'Tab', color: 'var(--three)' },
      { text: ' to explore', color: 'var(--ink)' }
    ]);
  }

  _tryAutoLoad() {
    const targetId = this.card.noiseTarget?.id || this.card.id;
    const saved = loadConfig(targetId);
    if (saved) {
      this.card.setNoise(saved);
      const output = this.card.element.querySelector('.noise-cli-output');
      this._log(output, 'info', `Restored saved settings`);
    }
  }

  executeFromInput() {
    const input = this.card.element.querySelector('.noise-cli-input');
    const cmd = input.value.trim();
    if (cmd) {
      this.execute(cmd);
      this.history.push(cmd);
      this.historyIndex = this.history.length;
      input.value = '';
    }
  }

  execute(cmdString) {
    const output = this.card.element.querySelector('.noise-cli-output');

    // Don't log slider value updates (too noisy)
    if (!cmdString.match(/^(blend|speed|scale|rule|cells)\s+[\d.]+$/)) {
      this._log(output, 'cmd', `> ${cmdString}`);
    }

    // Check for help suffix
    if (cmdString.endsWith('?')) {
      return this._showHelp(cmdString.slice(0, -1).trim(), output);
    }

    const [cmd, ...args] = this._tokenize(cmdString);
    const lcCmd = cmd.toLowerCase();

    try {
      const result = this._dispatch(lcCmd, args);
      if (result) {
        this._log(output, 'result', result);
      }
    } catch (err) {
      this._log(output, 'error', err.message);
    }
  }

  /**
   * Tab completion with contextual discovery
   */
  tabComplete(input) {
    const rawValue = input.value;
    const trimmed = rawValue.trim().toLowerCase();
    const output = this.card.element.querySelector('.noise-cli-output');
    const endsWithSpace = rawValue.endsWith(' ');

    // Check for slider command + space
    if (endsWithSpace && SLIDERS[trimmed]) {
      this._showSlider(trimmed, output);
      input.value = '';
      return;
    }

    // Get contextual completions
    const completions = getCompletions(trimmed);

    switch (completions.type) {
      case 'categories':
        this._showCategories(output, completions.items);
        break;

      case 'types':
        this._showTypes(output, completions.items);
        if (endsWithSpace) input.value = '';
        break;

      case 'rules':
        this._showRules(output, completions.items);
        if (endsWithSpace) input.value = '';
        break;

      case 'sliders':
        this._showStyleOptions(output, completions.items);
        if (endsWithSpace) input.value = '';
        break;

      case 'presets':
        this._showPresets(output, completions.groups);
        if (endsWithSpace) input.value = '';
        break;

      case 'matches':
        if (completions.items.length === 1) {
          input.value = completions.items[0].cmd + ' ';
        } else if (completions.items.length > 1) {
          this._log(output, 'info', completions.items.map(i => i.cmd).join('  '));
          const prefix = this._findCommonPrefix(completions.items.map(i => i.cmd));
          if (prefix.length > trimmed.length) {
            input.value = prefix;
          }
        }
        break;

      default:
        this._log(output, 'error', `Unknown: ${trimmed}`);
    }
  }

  _showCategories(output, items) {
    const line = items.map(item =>
      `<span style="color:${item.color}">${item.label}</span>`
    ).join('  ');
    this._logHTML(output, line);
    this._log(output, 'info', 'Type category + Tab to browse options');
  }

  _showTypes(output, items) {
    this._log(output, 'info', '── Noise Types ──');
    items.forEach(item => {
      this._logStyled(output, [
        { text: item.label.padEnd(14), color: 'var(--one)' },
        { text: item.description, color: 'var(--ink)' }
      ]);
    });
    this._log(output, 'info', 'Just type: perlin  or  type perlin');
  }

  _showRules(output, items) {
    this._log(output, 'info', '── Cellular Automata Rules ──');
    items.forEach(item => {
      this._logStyled(output, [
        { text: item.label.padEnd(18), color: 'var(--three)' },
        { text: item.description, color: 'var(--ink)' }
      ]);
    });
    this._log(output, 'info', 'Just type: rule 30  or  rule chaos');
  }

  _showStyleOptions(output, items) {
    this._log(output, 'info', '── Style Settings ──');
    items.forEach(item => {
      this._logStyled(output, [
        { text: item.cmd.padEnd(10), color: 'var(--four)' },
        { text: item.description, color: 'var(--ink)' }
      ]);
    });
    this._log(output, 'info', 'Just type: scale .02  or  blend + space + Tab for slider');
  }

  _showPresets(output, groups) {
    this._log(output, 'info', '── Presets ──');
    Object.entries(groups).forEach(([key, group]) => {
      this._logStyled(output, [
        { text: `${group.label}: `, color: 'var(--ink)' },
        { text: group.presets.join(', '), color: 'var(--two)' }
      ]);
    });
    this._log(output, 'info', 'Just type: preset lava  or  preset rule30');
  }

  _showSlider(command, output) {
    const config = this.card.getNoiseConfig();
    const currentValue = config[command] || null;
    const sliderData = this.sliderManager.show(command, currentValue);
    this.card.setHeaderSlider(command, sliderData);
  }

  _showHelp(topic, output) {
    topic = topic.toLowerCase();

    if (!topic || topic === 'help') {
      this._log(output, 'info', `
╭─ NoiseCard CLI ─────────────────────────╮
│                                         │
│  CATEGORIES (Tab to explore):           │
│    type   - noise generator type        │
│    ca     - cellular automata           │
│    style  - blend, speed, scale         │
│    preset - named presets               │
│                                         │
│  QUICK COMMANDS:                        │
│    save   - save current settings       │
│    load   - restore saved settings      │
│    config - show current config         │
│    clear  - clear output                │
│                                         │
│  TIPS:                                  │
│    • Tab with empty input = categories  │
│    • command + Tab = options            │
│    • command + space + Tab = slider     │
│    • command? = help for command        │
│                                         │
╰─────────────────────────────────────────╯
`.trim());
      return;
    }

    // Specific help
    if (SLIDERS[topic]) {
      const s = SLIDERS[topic];
      this._log(output, 'info', `${topic}: ${s.description}\nRange: ${s.min} - ${s.max} (step ${s.step})`);
      return;
    }

    if (NOISE_TYPES[topic]) {
      const t = NOISE_TYPES[topic];
      this._log(output, 'info', `${topic}: ${t.description}`);
      return;
    }

    this._log(output, 'error', `No help for: ${topic}`);
  }

  _dispatch(cmd, args) {
    // === NOISE TYPES ===
    if (NOISE_TYPES[cmd]) {
      this.card.setNoise({ type: cmd });
      return `Type: ${cmd} — ${NOISE_TYPES[cmd].description}`;
    }

    // === PRESETS ===
    if (cmd === 'preset') {
      const name = args[0];
      if (!name) return 'Usage: preset <name> (Tab to see list)';
      if (!NoiseService.presets[name]) return `Unknown preset: ${name}`;
      this.card.setPreset(name);
      return `Preset: ${name}`;
    }

    // === CA RULE ===
    if (cmd === 'rule') {
      let ruleNum = parseInt(args[0]);
      // Check for named rule
      if (isNaN(ruleNum)) {
        const named = Object.entries(CA_RULES).find(([n, r]) => r.name === args[0]);
        if (named) ruleNum = parseInt(named[0]);
      }
      if (isNaN(ruleNum) || ruleNum < 0 || ruleNum > 255) {
        return 'Usage: rule <0-255> or rule <name>\nNames: chaos, sierpinski, turing, traffic';
      }
      this.card.setNoise({ type: 'cellular', rule: ruleNum });
      const info = CA_RULES[ruleNum];
      return `Rule ${ruleNum}${info ? ` (${info.name})` : ''}: ${info?.description || 'Custom rule'}`;
    }

    // === SLIDERS ===
    if (SLIDERS[cmd]) {
      const value = parseFloat(args[0]);
      if (isNaN(value)) return `Usage: ${cmd} <value> (or ${cmd} + space + Tab for slider)`;
      const s = SLIDERS[cmd];
      const clamped = Math.max(s.min, Math.min(s.max, value));
      this.card.setNoise({ [cmd]: clamped });
      // Update slider if visible
      if (this.sliderManager.hasSlider(cmd)) {
        this.sliderManager.setValue(cmd, clamped);
      }
      return null; // Silent for slider updates
    }

    // === CELLS ===
    if (cmd === 'cells') {
      const size = parseInt(args[0]);
      if (isNaN(size) || size < 1) return 'Usage: cells <size>';
      this.card.setNoise({ cellSize: size });
      return `Cell size: ${size}px`;
    }

    // === COLOR ===
    if (cmd === 'color') {
      if (args.length === 0) return 'Usage: color <hex> [hex...]\nExample: color #000 #0ff #fff';
      const colors = args.map(c => c.startsWith('#') ? c : `#${c}`);
      this.card.setNoise({ colors });
      return `Colors: ${colors.join(' ')}`;
    }

    // === ANIMATION ===
    if (cmd === 'start') {
      this.card.noiseInstance?.start();
      return 'Animation started';
    }
    if (cmd === 'stop') {
      this.card.noiseInstance?.stop();
      return 'Animation stopped';
    }

    // === PERSISTENCE ===
    if (cmd === 'save') {
      const config = this.card.getNoiseConfig();
      const targetId = this.card.noiseTarget?.id || this.card.id;
      if (saveConfig(targetId, config)) {
        return `Saved settings for ${targetId}`;
      }
      return 'Failed to save';
    }
    if (cmd === 'load') {
      const targetId = args[0] || this.card.noiseTarget?.id || this.card.id;
      const saved = loadConfig(targetId);
      if (saved) {
        this.card.setNoise(saved);
        return `Loaded settings for ${targetId}`;
      }
      return 'No saved settings found';
    }

    // === UTILITY ===
    if (cmd === 'config') {
      const config = this.card.getNoiseConfig();
      let result = '── Current Config ──\n';
      for (const [key, value] of Object.entries(config)) {
        if (Array.isArray(value)) {
          result += `  ${key}: ${value.join(' ')}\n`;
        } else {
          result += `  ${key}: ${value}\n`;
        }
      }
      return result.trim();
    }

    if (cmd === 'clear') {
      this.card.element.querySelector('.noise-cli-output').innerHTML = '';
      return null;
    }

    if (cmd === 'help') {
      this._showHelp(args[0] || '', this.card.element.querySelector('.noise-cli-output'));
      return null;
    }

    if (cmd === 'exit') {
      this.card.destroy();
      return null;
    }

    // === CATEGORY WITH SUBCOMMAND ===
    // Allow "style scale .4" or "ca rule 30" syntax
    if (cmd === 'style' && args.length > 0) {
      return this._dispatch(args[0], args.slice(1));
    }
    if (cmd === 'ca' && args.length > 0) {
      return this._dispatch(args[0], args.slice(1));
    }
    if (cmd === 'type' && args.length > 0) {
      // "type perlin" → set type to perlin
      if (NOISE_TYPES[args[0]]) {
        this.card.setNoise({ type: args[0] });
        return `Type: ${args[0]}`;
      }
      return `Unknown type: ${args[0]}`;
    }

    // Category alone - show hint
    if (cmd === 'type' || cmd === 'ca' || cmd === 'style' || cmd === 'preset') {
      return `Type "${cmd}" then Tab to browse, or "${cmd} <option>" directly`;
    }

    return `Unknown: ${cmd} (Tab for commands, help for info)`;
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

  _tokenize(str) {
    const tokens = [];
    let current = '';
    let inQuotes = false;
    for (const char of str) {
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ' ' && !inQuotes) {
        if (current) tokens.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current) tokens.push(current);
    return tokens;
  }

  _findCommonPrefix(strings) {
    if (strings.length === 0) return '';
    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (strings[i].indexOf(prefix) !== 0) {
        prefix = prefix.substring(0, prefix.length - 1);
        if (prefix === '') return '';
      }
    }
    return prefix;
  }

  _log(output, type, message) {
    const entry = document.createElement('div');
    entry.className = `noise-cli-entry noise-cli-${type}`;
    entry.textContent = message;
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
    this._trimOutput(output);
  }

  _logHTML(output, html) {
    const entry = document.createElement('div');
    entry.className = 'noise-cli-entry';
    entry.innerHTML = html;
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
    this._trimOutput(output);
  }

  _logStyled(output, parts) {
    const entry = document.createElement('div');
    entry.className = 'noise-cli-entry';
    parts.forEach(p => {
      const span = document.createElement('span');
      span.style.color = p.color;
      span.textContent = p.text;
      entry.appendChild(span);
    });
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
    this._trimOutput(output);
  }

  _trimOutput(output) {
    while (output.children.length > 100) {
      output.removeChild(output.firstChild);
    }
  }

  destroy() {
    if (this.sliderManager) {
      this.sliderManager.destroy();
    }
  }
}

export default NoiseCLI;
