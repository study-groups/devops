/**
 * NlpPanel.js - A vanilla JS component for interacting with the node-nlp backend.
 * REFACTORED to use the new PanelInterface.
 */
import { BasePanel } from '/client/panels/BasePanel.js';

export class NlpPanel extends BasePanel {
    constructor(options) {
        super(options);
    }

    render() {
        this.element = document.createElement('div');
        this.element.className = 'nlp-panel';
        this.element.innerHTML = `
            <div class="nlp-controls">
                <button data-command="train">Train Model</button>
                <button data-command="clear-docs">Clear Docs</button>
                <button data-command="stats">Get Stats</button>
            </div>
            <div class="nlp-log"></div>
            <div class="nlp-cli">
                <input type="text" class="nlp-input" placeholder="Enter command or query...">
                <button class="nlp-send">Send</button>
            </div>
        `;
        return this.element;
    }

    onMount(container) {
        super.onMount(container);
        this.attachEventListeners();
    }

    attachEventListeners() {
        const sendButton = this.element.querySelector('.nlp-send');
        const input = this.element.querySelector('.nlp-input');
        const controls = this.element.querySelector('.nlp-controls');

        sendButton.addEventListener('click', () => this.handleCommand());
        input.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                this.handleCommand();
            }
        });

        controls.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const command = e.target.dataset.command;
                this.handleControlCommand(command);
            }
        });
    }

    async handleCommand() {
        const input = this.element.querySelector('.nlp-input');
        const commandText = input.value.trim();
        if (!commandText) return;

        this.log(`> ${commandText}`);
        input.value = '';

        const [command, ...args] = commandText.match(/(?:[^\s"]+|"[^"]*")+/g).map(arg => arg.replace(/"/g, ''));
        
        try {
            let response;
            switch (command) {
                case 'train':
                    return this.handleControlCommand('train');
                case 'stats':
                    return this.handleControlCommand('stats');
                // Add other cases here...
                default:
                    this.log(`Unknown command: ${command}`);
                    return;
            }

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.log(JSON.stringify(data, null, 2));

        } catch (error) {
            this.log(`Error: ${error.message}`);
        }
    }

    async handleControlCommand(command) {
        this.log(`> ${command}`);
        try {
            let response;
            switch(command) {
                case 'train':
                    response = await fetch('/api/nlp/train', { method: 'POST' });
                    break;
                case 'clear-docs':
                    response = await fetch('/api/nlp/clear-docs', { method: 'POST' });
                    break;
                case 'stats':
                    response = await fetch('/api/nlp/stats');
                    break;
            }

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            this.log(JSON.stringify(data, null, 2));
        } catch (error) {
            this.log(`Error: ${error.message}`);
        }
    }

    log(message) {
        const logElement = this.element.querySelector('.nlp-log');
        const entry = document.createElement('pre');
        entry.textContent = message;
        logElement.appendChild(entry);
        logElement.scrollTop = logElement.scrollHeight;
    }
}
