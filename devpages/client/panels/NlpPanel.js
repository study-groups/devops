/**
 * NlpPanel.js - A vanilla JS component for interacting with the node-nlp backend.
 */
export class NlpPanel {
    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'nlp-panel';
        this.render();
        this.attachEventListeners();
    }

    render() {
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
        
        let path, lang, utterance, intent, text;

        try {
            let response;
            switch (command) {
                // Training
                case 'add-doc':
                    [lang, utterance, intent] = args;
                    response = await fetch('/api/nlp/add-doc', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ lang, utterance, intent }),
                    });
                    break;
                case 'train':
                    return this.handleControlCommand('train');
                case 'clear-docs':
                    return this.handleControlCommand('clear-docs');
                case 'list-intents':
                    response = await fetch('/api/nlp/list-intents');
                    break;
                case 'list-docs':
                    response = await fetch(`/api/nlp/list-docs?intent=${args[0] || ''}`);
                    break;
                
                // Query/Inference
                case 'query':
                    text = args.join(' ');
                    response = await fetch('/api/nlp/query', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text }),
                    });
                    break;
                case 'intent':
                    text = args.join(' ');
                    response = await fetch('/api/nlp/intent', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text }),
                    });
                    break;
                case 'classify':
                    text = args.join(' ');
                    response = await fetch('/api/nlp/classify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text }),
                    });
                    break;
                case 'entities':
                    text = args.join(' ');
                    response = await fetch('/api/nlp/entities', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ text }),
                    });
                    break;
                
                // Model Persistence
                case 'save':
                    [path] = args;
                    response = await fetch('/api/nlp/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path }),
                    });
                    break;
                case 'load':
                    [path] = args;
                    response = await fetch('/api/nlp/load', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ path }),
                    });
                    break;

                // Inspection
                case 'stats':
                    return this.handleControlCommand('stats');
                case 'info':
                    response = await fetch('/api/nlp/info');
                    break;
                case 'dump':
                    response = await fetch('/api/nlp/dump');
                    break;

                // Utility
                case 'help':
                    this.log('Commands: add-doc, train, clear-docs, list-intents, list-docs, query, intent, classify, entities, save, load, stats, info, dump, help, exit');
                    return;
                case 'exit':
                    this.log('Use the panel close button.');
                    return;

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

    get a() { return this.element; }
}
