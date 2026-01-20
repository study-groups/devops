/**
 * ConsoleInput.js - CLI Input with Tab Completion
 * Handles command input, history, and tab completion UI
 */

import { getCompletions, getCommandNames, CATEGORIES } from './ConsoleCommands.js';

export class ConsoleInput {
    constructor(options = {}) {
        this.onExecute = options.onExecute || (() => {});
        this.onTab = options.onTab || (() => {});
        this.onControlRequest = options.onControlRequest || (() => {});

        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 100;

        this.element = null;
        this.input = null;
        this.completions = null;
        this.prompt = null;

        this._completionIndex = -1;
        this._completionItems = [];
    }

    /**
     * Render the input component
     * @returns {HTMLElement}
     */
    render() {
        this.element = document.createElement('div');
        this.element.className = 'console-input-container';

        // Completions popup
        this.completions = document.createElement('div');
        this.completions.className = 'console-completions';

        // Input row
        const inputRow = document.createElement('div');
        inputRow.className = 'console-input-row';

        this.prompt = document.createElement('span');
        this.prompt.className = 'console-prompt';
        this.prompt.textContent = 'pbase>';

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.className = 'console-input';
        this.input.placeholder = 'Type command or press Tab for suggestions...';
        this.input.autocomplete = 'off';
        this.input.spellcheck = false;

        inputRow.appendChild(this.prompt);
        inputRow.appendChild(this.input);

        this.element.appendChild(this.completions);
        this.element.appendChild(inputRow);

        this._bindEvents();

        return this.element;
    }

    /**
     * Bind input events
     */
    _bindEvents() {
        this.input.addEventListener('keydown', (e) => this._handleKeyDown(e));
        this.input.addEventListener('input', () => this._handleInput());
        this.input.addEventListener('blur', () => {
            // Delay hide to allow click on completions
            setTimeout(() => this._hideCompletions(), 150);
        });
    }

    /**
     * Handle keydown events
     */
    _handleKeyDown(e) {
        switch (e.key) {
            case 'Enter':
                e.preventDefault();
                this._execute();
                break;

            case 'Tab':
                e.preventDefault();
                this._tabComplete();
                break;

            case 'ArrowUp':
                e.preventDefault();
                if (this._completionItems.length > 0) {
                    this._navigateCompletions(-1);
                } else {
                    this._historyBack();
                }
                break;

            case 'ArrowDown':
                e.preventDefault();
                if (this._completionItems.length > 0) {
                    this._navigateCompletions(1);
                } else {
                    this._historyForward();
                }
                break;

            case 'Escape':
                this._hideCompletions();
                break;
        }
    }

    /**
     * Handle input changes
     */
    _handleInput() {
        // Show completions as user types
        const value = this.input.value;
        if (value.length > 0) {
            this._showCompletions(value);
        } else {
            this._hideCompletions();
        }
    }

    /**
     * Execute current command
     */
    _execute() {
        const cmd = this.input.value.trim();
        if (!cmd) return;

        // Add to history
        if (this.history[this.history.length - 1] !== cmd) {
            this.history.push(cmd);
            if (this.history.length > this.maxHistory) {
                this.history.shift();
            }
        }
        this.historyIndex = -1;

        // Clear input
        this.input.value = '';
        this._hideCompletions();

        // Callback
        this.onExecute(cmd);
    }

    /**
     * Tab completion
     */
    _tabComplete() {
        const value = this.input.value;

        // If completions visible, select current
        if (this._completionItems.length > 0 && this._completionIndex >= 0) {
            const item = this._completionItems[this._completionIndex];
            this._applyCompletion(item);
            return;
        }

        // Show completions
        const items = getCompletions(value);
        if (items.length === 1) {
            // Single match - apply directly
            this._applyCompletion(items[0]);
        } else if (items.length > 1) {
            this._showCompletionList(items);
            this._completionIndex = 0;
            this._updateCompletionHighlight();
        } else if (!value) {
            // Empty - show categories
            this._showCompletionList(getCompletions(''));
        }

        this.onTab(value, items);
    }

    /**
     * Apply a completion
     */
    _applyCompletion(item) {
        const parts = this.input.value.trim().split(/\s+/);

        if (item.isCategory) {
            // Category - show commands for it
            this.input.value = item.text + ' ';
            this._showCompletions(item.text);
        } else if (parts.length <= 1) {
            // Completing command name
            this.input.value = item.text + ' ';
        } else {
            // Completing argument
            parts[parts.length - 1] = item.text;
            this.input.value = parts.join(' ') + ' ';
        }

        this._hideCompletions();
        this.input.focus();
    }

    /**
     * Show completions list
     */
    _showCompletions(partial) {
        const items = getCompletions(partial);
        if (items.length === 0) {
            this._hideCompletions();
            return;
        }
        this._showCompletionList(items);
    }

    /**
     * Render completion list
     */
    _showCompletionList(items) {
        this._completionItems = items;
        this._completionIndex = -1;

        this.completions.innerHTML = '';

        items.forEach((item, i) => {
            const el = document.createElement('div');
            el.className = 'console-completion-item';
            el.dataset.index = i;

            const cat = CATEGORIES[item.category];
            const color = cat?.color || '#888';

            el.innerHTML = `
                <span class="completion-text">${item.text}</span>
                <span class="completion-category" style="color: ${color}">${item.category}</span>
                <span class="completion-desc">${item.description}</span>
            `;

            el.addEventListener('click', () => {
                this._applyCompletion(item);
            });

            this.completions.appendChild(el);
        });

        this.completions.classList.add('visible');
    }

    /**
     * Hide completions
     */
    _hideCompletions() {
        this.completions.classList.remove('visible');
        this._completionItems = [];
        this._completionIndex = -1;
    }

    /**
     * Navigate completions with arrow keys
     */
    _navigateCompletions(delta) {
        if (this._completionItems.length === 0) return;

        this._completionIndex += delta;
        if (this._completionIndex < 0) {
            this._completionIndex = this._completionItems.length - 1;
        } else if (this._completionIndex >= this._completionItems.length) {
            this._completionIndex = 0;
        }

        this._updateCompletionHighlight();
    }

    /**
     * Update highlight on completion items
     */
    _updateCompletionHighlight() {
        const items = this.completions.querySelectorAll('.console-completion-item');
        items.forEach((el, i) => {
            el.classList.toggle('selected', i === this._completionIndex);
        });

        // Scroll into view
        const selected = items[this._completionIndex];
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * History navigation - back
     */
    _historyBack() {
        if (this.history.length === 0) return;

        if (this.historyIndex === -1) {
            this.historyIndex = this.history.length - 1;
        } else if (this.historyIndex > 0) {
            this.historyIndex--;
        }

        this.input.value = this.history[this.historyIndex] || '';
    }

    /**
     * History navigation - forward
     */
    _historyForward() {
        if (this.historyIndex === -1) return;

        this.historyIndex++;
        if (this.historyIndex >= this.history.length) {
            this.historyIndex = -1;
            this.input.value = '';
        } else {
            this.input.value = this.history[this.historyIndex];
        }
    }

    /**
     * Focus the input
     */
    focus() {
        this.input?.focus();
    }

    /**
     * Set the prompt text
     */
    setPrompt(text) {
        if (this.prompt) {
            this.prompt.textContent = text;
        }
    }

    /**
     * Get command history
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Clear history
     */
    clearHistory() {
        this.history = [];
        this.historyIndex = -1;
    }
}
