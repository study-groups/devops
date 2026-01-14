/**
 * Toast notification system
 */

let container = null;

function ensureContainer() {
    if (!container) {
        container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    }
    return container;
}

export function toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    ensureContainer().appendChild(el);

    setTimeout(() => {
        el.classList.add('fade-out');
        setTimeout(() => el.remove(), 300);
    }, 4000);
}

export function success(message) {
    toast(message, 'success');
}

export function error(message) {
    toast(message, 'error');
}

export function warning(message) {
    toast(message, 'warning');
}

export function info(message) {
    toast(message, 'info');
}
