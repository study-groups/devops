// Shared UI Helpers for TETRA Dashboard

/**
 * Tab switching helper
 * @param {string} tabsSelector - container with .tab elements
 * @param {Object} options
 * @param {string} options.panelSelector - panels to toggle (optional)
 * @param {string} options.dataAttr - which data-* attribute to read (default: 'target')
 * @param {Function} options.onSwitch - callback(value, tab) on switch (optional)
 */
function setupTabs(tabsSelector, options = {}) {
    const { panelSelector, dataAttr = 'target', onSwitch } = options;
    document.querySelectorAll(`${tabsSelector} .tab`).forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll(`${tabsSelector} .tab`).forEach(t => t.classList.remove('active'));
            if (panelSelector) {
                document.querySelectorAll(panelSelector).forEach(p => p.classList.remove('active'));
            }
            tab.classList.add('active');
            const value = tab.dataset[dataAttr];
            if (panelSelector && value) {
                const panel = document.getElementById(value) ||
                              document.getElementById(`${value}-panel`) ||
                              document.getElementById(`preview-${value}`);
                if (panel) panel.classList.add('active');
            }
            if (onSwitch) onSwitch(value, tab);
        });
    });
}

/**
 * Delete confirmation helper - shows "del?" for 2s before allowing delete
 * @param {HTMLElement} btn - the delete button
 * @param {Function} onDelete - async function to call on confirm
 */
function setupDeleteButton(btn, onDelete) {
    btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (btn.classList.contains('confirm')) {
            await onDelete();
        } else {
            btn.classList.add('confirm');
            btn.textContent = 'del?';
            setTimeout(() => {
                btn.classList.remove('confirm');
                btn.textContent = 'Del';
            }, 2000);
        }
    });
}
