class DevWatchUIManager {
    constructor(initialState = {}) {
        this.state = this.createStateProxy(initialState);
        this.bindings = [];
        this.scanDOM();
        this.bindEvents();
        this.render(); 
    }

    createStateProxy(initialState) {
        const handler = {
            set: (target, property, value) => {
                target[property] = value;
                this.render();
                return true;
            }
        };
        return new Proxy(initialState, handler);
    }

    scanDOM() {
        document.querySelectorAll('[data-pja-bind-state]').forEach(el => {
            this.bindings.push({
                element: el,
                evaluators: this.parseBinding(el.dataset.pjaBindState)
            });
        });
    }

    parseBinding(bindingString) {
        // Simple key-value parser for now. Can be extended to support expressions.
        return bindingString.split(';').map(s => {
            const [target, source] = s.split(':').map(i => i.trim());
            const [targetType, targetProp] = target.split('.');
            return { targetType, targetProp, source };
        });
    }
    
    bindEvents() {
        document.body.addEventListener('click', (e) => {
            const actionElement = e.target.closest('[data-pja-action]');
            if (actionElement) {
                const { pjaAction, pjaPayload } = actionElement.dataset;
                if (pjaAction === 'ui.set_state') {
                    this.handleSetState(pjaPayload);
                }
            }
        });
    }

    handleSetState(payload) {
        try {
            const parsedPayload = JSON.parse(payload);
            Object.keys(parsedPayload).forEach(key => {
                // Using a simple property assignment. Can be extended for nested keys.
                this.state[key] = parsedPayload[key];
            });
        } catch (error) {
            console.error('Failed to parse pja-payload:', error);
        }
    }

    render() {
        this.bindings.forEach(({ element, evaluators }) => {
            evaluators.forEach(({ targetType, targetProp, source }) => {
                const value = this.state[source];
                if (targetType === 'class') {
                    // For boolean sources, toggle class based on truthiness
                    element.classList.toggle(targetProp, !!value);
                } else if (targetType === 'style') {
                    element.style[targetProp] = value;
                } else if (targetType === 'textContent') {
                    element.textContent = value;
                }
            });
        });
    }

    setState(key, value) {
        this.state[key] = value;
    }
}
