/**
 * ConsoleControls.js - Inline Sticky Controls
 * Manages sliders for continuous values and selectors for categorical values
 */

import { CATEGORIES } from './ConsoleCommands.js';

// Parameter definitions with control types
export const PARAMETERS = {
    // Continuous (slider) parameters
    volume: {
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        default: 1,
        category: 'rt',
        label: 'Volume'
    },
    paddle: {
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.01,
        default: 0.5,
        category: 'game',
        label: 'Paddle',
        args: ['player']  // Requires player argument
    },
    blend: {
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        default: 0.5,
        category: 'theme',
        label: 'Blend'
    },
    scale: {
        type: 'slider',
        min: 0.1,
        max: 2,
        step: 0.1,
        default: 1,
        category: 'frame',
        label: 'Scale'
    },

    // Categorical (select) parameters
    player: {
        type: 'select',
        options: [
            { value: '0', label: 'Player 1' },
            { value: '1', label: 'Player 2' },
            { value: '2', label: 'Player 3' },
            { value: '3', label: 'Player 4' }
        ],
        default: '0',
        category: 'game',
        label: 'Player'
    },
    mute: {
        type: 'toggle',
        default: false,
        category: 'rt',
        label: 'Mute'
    },
    axis: {
        type: 'select',
        options: [
            { value: 'left-x', label: 'Left X' },
            { value: 'left-y', label: 'Left Y' },
            { value: 'right-x', label: 'Right X' },
            { value: 'right-y', label: 'Right Y' }
        ],
        default: 'left-x',
        category: 'deck',
        label: 'Axis'
    },
    state: {
        type: 'select',
        options: [
            { value: 'idle', label: 'Idle' },
            { value: 'playing', label: 'Playing' },
            { value: 'paused', label: 'Paused' },
            { value: 'ended', label: 'Ended' }
        ],
        default: 'idle',
        category: 'game',
        label: 'State'
    }
};

/**
 * Get parameter definition
 */
export function getParameter(name) {
    return PARAMETERS[name] || null;
}

/**
 * Check if parameter is continuous (slider)
 */
export function isContinuous(name) {
    const param = PARAMETERS[name];
    return param?.type === 'slider';
}

/**
 * Check if parameter is categorical (select)
 */
export function isCategorical(name) {
    const param = PARAMETERS[name];
    return param?.type === 'select' || param?.type === 'toggle';
}

/**
 * ConsoleControls - Manages sticky inline controls
 */
export class ConsoleControls {
    constructor(options = {}) {
        this.onChange = options.onChange || (() => {});
        this.element = null;
        this.controls = new Map(); // id -> { param, element, value }
        this.nextId = 1;
    }

    /**
     * Render the controls container
     */
    render() {
        this.element = document.createElement('div');
        this.element.className = 'console-controls-sticky';
        return this.element;
    }

    /**
     * Add a control
     * @param {string} paramName - Parameter name
     * @param {object} context - Additional context (e.g., player number)
     * @returns {string} Control ID
     */
    addControl(paramName, context = {}) {
        const param = PARAMETERS[paramName];
        if (!param) return null;

        const id = `ctrl-${this.nextId++}`;
        const controlEl = this._createControl(id, paramName, param, context);

        this.controls.set(id, {
            param: paramName,
            paramDef: param,
            context,
            element: controlEl,
            value: param.default
        });

        this.element.appendChild(controlEl);
        return id;
    }

    /**
     * Create control element based on type
     */
    _createControl(id, paramName, param, context) {
        const wrapper = document.createElement('div');
        wrapper.className = 'control-item';
        wrapper.dataset.controlId = id;

        const cat = CATEGORIES[param.category];
        const color = cat?.color || '#888';

        // Label with context
        let label = param.label;
        if (context.player !== undefined) {
            label = `${param.label} P${parseInt(context.player) + 1}`;
        }

        // Header with label and close button
        const header = document.createElement('div');
        header.className = 'control-header';
        header.innerHTML = `
            <span class="control-label" style="color: ${color}">${label}</span>
            <button class="control-close" title="Remove">×</button>
        `;

        header.querySelector('.control-close').addEventListener('click', () => {
            this.removeControl(id);
        });

        wrapper.appendChild(header);

        // Control body based on type
        const body = document.createElement('div');
        body.className = 'control-body';

        if (param.type === 'slider') {
            body.appendChild(this._createSlider(id, paramName, param, context));
        } else if (param.type === 'select') {
            body.appendChild(this._createSelect(id, paramName, param, context));
        } else if (param.type === 'toggle') {
            body.appendChild(this._createToggle(id, paramName, param, context));
        }

        wrapper.appendChild(body);
        return wrapper;
    }

    /**
     * Create slider control
     */
    _createSlider(id, paramName, param, context) {
        const container = document.createElement('div');
        container.className = 'control-slider';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = param.min;
        slider.max = param.max;
        slider.step = param.step;
        slider.value = param.default;

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'control-value';
        valueDisplay.textContent = param.default.toFixed(2);

        slider.addEventListener('input', () => {
            const value = parseFloat(slider.value);
            valueDisplay.textContent = value.toFixed(2);
            this._updateValue(id, value);
            this.onChange(paramName, value, context);
        });

        container.appendChild(slider);
        container.appendChild(valueDisplay);
        return container;
    }

    /**
     * Create select control
     */
    _createSelect(id, paramName, param, context) {
        const container = document.createElement('div');
        container.className = 'control-select';

        param.options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'select-option';
            btn.textContent = opt.label;
            btn.dataset.value = opt.value;

            if (opt.value === param.default) {
                btn.classList.add('active');
            }

            btn.addEventListener('click', () => {
                container.querySelectorAll('.select-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._updateValue(id, opt.value);
                this.onChange(paramName, opt.value, context);
            });

            container.appendChild(btn);
        });

        return container;
    }

    /**
     * Create toggle control
     */
    _createToggle(id, paramName, param, context) {
        const container = document.createElement('div');
        container.className = 'control-toggle';

        const toggle = document.createElement('button');
        toggle.className = 'toggle-btn';
        toggle.textContent = param.default ? 'ON' : 'OFF';
        toggle.classList.toggle('active', param.default);

        toggle.addEventListener('click', () => {
            const newValue = !toggle.classList.contains('active');
            toggle.classList.toggle('active', newValue);
            toggle.textContent = newValue ? 'ON' : 'OFF';
            this._updateValue(id, newValue);
            this.onChange(paramName, newValue, context);
        });

        container.appendChild(toggle);
        return container;
    }

    /**
     * Update stored value
     */
    _updateValue(id, value) {
        const ctrl = this.controls.get(id);
        if (ctrl) {
            ctrl.value = value;
        }
    }

    /**
     * Remove a control
     */
    removeControl(id) {
        const ctrl = this.controls.get(id);
        if (ctrl) {
            ctrl.element.remove();
            this.controls.delete(id);
        }
    }

    /**
     * Remove all controls
     */
    clear() {
        this.controls.forEach((ctrl, id) => {
            ctrl.element.remove();
        });
        this.controls.clear();
    }

    /**
     * Check if control exists for parameter
     */
    hasControl(paramName, context = {}) {
        for (const [id, ctrl] of this.controls) {
            if (ctrl.param === paramName) {
                // Check context match
                if (context.player !== undefined && ctrl.context.player !== context.player) {
                    continue;
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Get control value
     */
    getValue(paramName, context = {}) {
        for (const [id, ctrl] of this.controls) {
            if (ctrl.param === paramName) {
                if (context.player !== undefined && ctrl.context.player !== context.player) {
                    continue;
                }
                return ctrl.value;
            }
        }
        return null;
    }
}
