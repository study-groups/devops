/**
 * Terrain Popups Module
 * Modal dialog system
 */
(function() {
    'use strict';

    const TerrainPopups = {
        /**
         * Initialize popups module
         */
        init: function() {
            // Close popup on overlay click
            const overlay = document.getElementById('popup-overlay');
            if (overlay) {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        this.close();
                    }
                });
            }

            // Close on escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.close();
                }
            });
        },

        /**
         * Show popup with HTML content
         */
        show: function(htmlContent) {
            const body = document.getElementById('popup-body');
            const overlay = document.getElementById('popup-overlay');
            if (body && overlay) {
                body.innerHTML = htmlContent;
                overlay.classList.add('active');
            }
        },

        /**
         * Close popup
         */
        close: function() {
            const overlay = document.getElementById('popup-overlay');
            if (overlay) {
                overlay.classList.remove('active');
            }
        },

        /**
         * Show alert dialog
         */
        alert: function(message, onClose) {
            const content = `
                <div style="text-align: center;">
                    <p style="white-space: pre-line; line-height: 1.6; margin-bottom: var(--gap-lg);">${message}</p>
                    <button id="alert-ok-btn" class="popup-btn">OK</button>
                </div>
            `;
            this.show(content);

            setTimeout(() => {
                document.getElementById('alert-ok-btn').addEventListener('click', () => {
                    this.close();
                    if (onClose) onClose();
                });
            }, 50);
        },

        /**
         * Show confirm dialog
         */
        confirm: function(message, onConfirm, onCancel) {
            const content = `
                <div style="text-align: center;">
                    <p style="white-space: pre-line; line-height: 1.6; margin-bottom: var(--gap-lg);">${message}</p>
                    <div style="display: flex; gap: var(--gap-sm); justify-content: center;">
                        <button id="confirm-cancel-btn" class="popup-btn popup-btn-cancel">Cancel</button>
                        <button id="confirm-ok-btn" class="popup-btn popup-btn-confirm">Confirm</button>
                    </div>
                </div>
            `;
            this.show(content);

            setTimeout(() => {
                document.getElementById('confirm-ok-btn').addEventListener('click', () => {
                    this.close();
                    if (onConfirm) onConfirm();
                });
                document.getElementById('confirm-cancel-btn').addEventListener('click', () => {
                    this.close();
                    if (onCancel) onCancel();
                });
            }, 50);
        },

        /**
         * Show prompt dialog
         */
        prompt: function(message, onSubmit, onCancel) {
            const content = `
                <div style="text-align: center;">
                    <p style="white-space: pre-line; line-height: 1.6; margin-bottom: var(--gap-md);">${message}</p>
                    <input type="text" id="prompt-input" class="popup-input">
                    <div style="display: flex; gap: var(--gap-sm); justify-content: center; margin-top: var(--gap-md);">
                        <button id="prompt-cancel-btn" class="popup-btn popup-btn-cancel">Cancel</button>
                        <button id="prompt-ok-btn" class="popup-btn popup-btn-confirm">OK</button>
                    </div>
                </div>
            `;
            this.show(content);

            setTimeout(() => {
                const input = document.getElementById('prompt-input');
                input.focus();

                const submitHandler = () => {
                    this.close();
                    if (onSubmit) onSubmit(input.value);
                };

                document.getElementById('prompt-ok-btn').addEventListener('click', submitHandler);
                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') submitHandler();
                });
                document.getElementById('prompt-cancel-btn').addEventListener('click', () => {
                    this.close();
                    if (onCancel) onCancel();
                });
            }, 50);
        }
    };

    // Export
    window.Terrain = window.Terrain || {};
    window.Terrain.Popups = TerrainPopups;

})();
