// server/static/js/devwatch-icon-picker.js

class DevWatchPanelIconPicker {
    constructor() {
        this.modal = null;
        this.callback = null;
    }

    async show(callback) {
        this.callback = callback;
        if (!this.modal) {
            this._createModal();
        }
        await this._loadIcons();
        document.body.appendChild(this.modal);
        this.modal.style.display = 'block';
    }

    hide() {
        if (this.modal) {
            this.modal.style.display = 'none';
            document.body.removeChild(this.modal);
            this.modal = null;
        }
    }

    _createModal() {
        this.modal = document.createElement('div');
        this.modal.id = 'devwatch-icon-picker-modal';
        this.modal.className = 'pja-modal';
        this.modal.innerHTML = `
            <div class="pja-modal-content">
                <div class="pja-modal-header">
                    <h4>Select an Icon</h4>
                    <button id="devwatch-icon-picker-close" class="pja-modal-close">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-x"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div id="devwatch-icon-picker-grid" class="devwatch-icon-grid is-loading">
                    <div class="pja-loader"></div>
                </div>
            </div>
        `;

        this.modal.querySelector('#devwatch-icon-picker-close').addEventListener('click', () => this.hide());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });

        // Add styles
        if (!document.getElementById('devwatch-icon-picker-styles')) {
            const style = document.createElement('style');
            style.id = 'devwatch-icon-picker-styles';
            style.textContent = `
                .devwatch-modal { display: none; position: fixed; z-index: 1001; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0,0,0,0.6); backdrop-filter: blur(5px); }
                .devwatch-modal-content { background-color: var(--devwatch-bg-secondary); margin: 10% auto; padding: 0; border: 1px solid var(--devwatch-border-primary); width: 80%; max-width: 600px; border-radius: var(--devwatch-border-radius-lg); box-shadow: var(--devwatch-shadow-lg); overflow: hidden; }
                .devwatch-modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--devwatch-border-primary); padding: var(--devwatch-space-md) var(--devwatch-space-lg); background-color: var(--devwatch-bg-tertiary); }
                .devwatch-modal-header h4 { margin: 0; color: var(--devwatch-text-headings); }
                .devwatch-modal-close { background: transparent; border: none; color: var(--devwatch-text-muted); cursor: pointer; padding: 0.5rem; border-radius: var(--devwatch-border-radius-sm); }
                .devwatch-modal-close:hover { background-color: var(--devwatch-bg-hover); color: var(--devwatch-accent-primary); }
                .devwatch-icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 1rem; padding: var(--devwatch-space-lg); max-height: 50vh; overflow-y: auto; }
                .devwatch-icon-wrapper { display: flex; flex-direction: column; justify-content: center; align-items: center; padding: 0.5rem; border: 1px solid var(--devwatch-border-secondary); border-radius: var(--devwatch-border-radius-md); cursor: pointer; transition: all var(--devwatch-transition-fast); background-color: var(--devwatch-bg-primary); }
                .devwatch-icon-wrapper:hover { background-color: var(--devwatch-bg-hover); border-color: var(--devwatch-accent-primary); transform: translateY(-2px); }
                .devwatch-icon-wrapper.selected { border-color: var(--devwatch-accent-primary); background-color: var(--devwatch-accent-muted); box-shadow: 0 0 0 2px var(--devwatch-accent-primary); }
                .devwatch-icon { width: 48px; height: 48px; margin-bottom: 0.5rem; }
                .devwatch-icon-name { font-size: var(--devwatch-font-size-xs); color: var(--devwatch-text-muted); text-align: center; word-break: break-all; }
            `;
            document.head.appendChild(style);
        }
    }

    async _loadIcons() {
        const grid = this.modal.querySelector('#devwatch-icon-picker-grid');
        try {
            const response = await fetch('/api/icons');
            if (!response.ok) throw new Error('Failed to fetch icons');
            const iconFiles = await response.json();
            
            grid.innerHTML = '';
            grid.classList.remove('is-loading');

            iconFiles.forEach(iconFile => {
                const wrapper = document.createElement('div');
                wrapper.className = 'devwatch-icon-wrapper';
                wrapper.title = iconFile;
                wrapper.dataset.iconFile = iconFile;
                
                const img = document.createElement('img');
                img.src = `/static/icons/${iconFile}`;
                img.alt = iconFile;
                img.className = 'devwatch-icon';

                wrapper.appendChild(img);

                const name = document.createElement('span');
                name.className = 'devwatch-icon-name';
                name.textContent = iconFile;
                wrapper.appendChild(name);
                
                grid.appendChild(wrapper);

                wrapper.addEventListener('click', () => {
                    if (this.callback) {
                        this.callback(iconFile);
                    }
                    this.hide();
                });
            });

        } catch (error) {
            grid.innerHTML = `<p>Error loading icons: ${error.message}</p>`;
            grid.classList.remove('is-loading');
        }
    }
}

window.DevWatchPanelIconPicker = new DevWatchPanelIconPicker();
