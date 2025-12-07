/**
 * ConfirmModal - Generic confirmation dialog system
 *
 * A lightweight, theme-aware modal for critical actions using DevPages design tokens.
 * Registered on window.APP.services.confirmModal
 *
 * Usage:
 *   const confirmed = await window.APP.services.confirmModal.show({
 *     title: 'Delete Image?',
 *     message: 'Are you sure you want to delete "photo.jpg"?',
 *     confirmText: 'Delete',
 *     cancelText: 'Cancel',
 *     type: 'danger' // 'danger' | 'warning' | 'info'
 *   });
 */

export class ConfirmModal {
  static instance = null;
  static styleInjected = false;

  /**
   * Show confirmation modal and return a promise that resolves with true/false
   */
  static show(options = {}) {
    return new Promise((resolve) => {
      const modal = new ConfirmModal(options, resolve);
      modal.open();
    });
  }

  constructor(options, resolve) {
    this.options = {
      title: options.title || 'Confirm',
      message: options.message || 'Are you sure?',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      type: options.type || 'warning', // 'danger', 'warning', 'info'
      ...options
    };
    this.resolve = resolve;
    this.modal = null;

    // Inject styles once
    if (!ConfirmModal.styleInjected) {
      this.injectStyles();
      ConfirmModal.styleInjected = true;
    }
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .confirm-modal-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgb(0 0 0 / 50%);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: var(--z-modal-backdrop, 1040);
        animation: confirmModalFadeIn var(--transition-fast, 150ms) ease;
      }

      @keyframes confirmModalFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes confirmModalSlideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes confirmModalFadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }

      .confirm-modal-content {
        background: var(--color-bg-elevated, #ffffff);
        border-radius: var(--radius-xl, 12px);
        box-shadow: var(--shadow-xl);
        max-width: 400px;
        width: 90%;
        animation: confirmModalSlideIn var(--transition-base, 200ms) ease;
      }

      .confirm-modal-header {
        padding: var(--space-6, 1.5rem);
        border-bottom: 1px solid var(--color-border);
        background: var(--color-bg-alt);
      }

      .confirm-modal-title {
        font-size: var(--font-size-lg, 1.125rem);
        font-weight: var(--font-weight-semibold, 600);
        color: var(--color-fg, #111827);
        margin: 0;
        display: flex;
        align-items: center;
        gap: var(--space-2, 0.5rem);
      }

      .confirm-modal-icon {
        font-size: var(--font-size-2xl, 1.5rem);
        line-height: 1;
      }

      .confirm-modal-icon.danger {
        color: var(--color-red-500, #ea5a5a);
      }

      .confirm-modal-icon.warning {
        color: var(--color-yellow-500, #f59e0b);
      }

      .confirm-modal-icon.info {
        color: var(--color-blue-500, #3b82f6);
      }

      .confirm-modal-body {
        padding: var(--space-6, 1.5rem);
      }

      .confirm-modal-message {
        color: var(--color-fg-muted, #6b7280);
        line-height: var(--line-height-normal, 1.5);
        margin: 0;
      }

      .confirm-modal-footer {
        padding: var(--space-6, 1.5rem);
        border-top: 1px solid var(--color-border);
        display: flex;
        gap: var(--space-2, 0.5rem);
        justify-content: flex-end;
        background: var(--color-bg-alt);
      }

      .confirm-modal-btn {
        padding: var(--space-2, 0.5rem) var(--space-4, 1rem);
        border-radius: var(--radius-md, 6px);
        font-size: var(--font-size-sm, 0.875rem);
        font-weight: var(--font-weight-medium, 500);
        cursor: pointer;
        border: 1px solid transparent;
        transition: var(--transition-all);
        font-family: inherit;
      }

      .confirm-modal-btn:focus {
        outline: none;
        box-shadow: 0 0 0 3px var(--color-blue-100, rgba(59, 130, 246, 0.1));
      }

      .confirm-modal-btn-cancel {
        background: var(--color-bg, #ffffff);
        color: var(--color-fg, #374151);
        border-color: var(--color-border, #d1d5db);
      }

      .confirm-modal-btn-cancel:hover {
        background: var(--color-bg-alt, #f9fafb);
        border-color: var(--color-fg-muted, #9ca3af);
      }

      .confirm-modal-btn-confirm {
        background: var(--color-blue-500, #3b82f6);
        color: #ffffff;
        border-color: var(--color-blue-500, #3b82f6);
      }

      .confirm-modal-btn-confirm:hover {
        background: var(--color-blue-600, #2563eb);
      }

      .confirm-modal-btn-confirm.danger {
        background: var(--color-red-500, #ea5a5a);
        border-color: var(--color-red-500, #ea5a5a);
      }

      .confirm-modal-btn-confirm.danger:hover {
        background: var(--color-red-900, #7f1d1d);
      }

      .confirm-modal-btn-confirm.warning {
        background: var(--color-yellow-500, #f59e0b);
        border-color: var(--color-yellow-500, #f59e0b);
        color: var(--color-gray-900, #000);
      }

      .confirm-modal-btn-confirm.warning:hover {
        background: var(--color-yellow-900, #78350f);
        color: #fff;
      }
    `;
    document.head.appendChild(style);
  }

  open() {
    // Create backdrop
    this.modal = document.createElement('div');
    this.modal.className = 'confirm-modal-backdrop';

    // Icon based on type
    const icons = {
      danger: '⚠️',
      warning: '⚠️',
      info: 'ℹ️'
    };
    const icon = icons[this.options.type] || icons.warning;

    // Create modal content
    this.modal.innerHTML = `
      <div class="confirm-modal-content">
        <div class="confirm-modal-header">
          <h3 class="confirm-modal-title">
            <span class="confirm-modal-icon ${this.options.type}">${icon}</span>
            ${this.escapeHtml(this.options.title)}
          </h3>
        </div>
        <div class="confirm-modal-body">
          <p class="confirm-modal-message">${this.escapeHtml(this.options.message)}</p>
        </div>
        <div class="confirm-modal-footer">
          <button class="confirm-modal-btn confirm-modal-btn-cancel" data-action="cancel">
            ${this.escapeHtml(this.options.cancelText)}
          </button>
          <button class="confirm-modal-btn confirm-modal-btn-confirm ${this.options.type}" data-action="confirm">
            ${this.escapeHtml(this.options.confirmText)}
          </button>
        </div>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(this.modal);

    // Focus confirm button
    setTimeout(() => {
      const confirmBtn = this.modal.querySelector('[data-action="confirm"]');
      if (confirmBtn) confirmBtn.focus();
    }, 100);

    // Attach event listeners
    this.attachListeners();
  }

  attachListeners() {
    // Button clicks
    this.modal.addEventListener('click', (e) => {
      const action = e.target.dataset.action;
      if (action === 'confirm') {
        this.close(true);
      } else if (action === 'cancel') {
        this.close(false);
      }
    });

    // Backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close(false);
      }
    });

    // Keyboard shortcuts
    this.handleKeydown = (e) => {
      if (e.key === 'Escape') {
        this.close(false);
      } else if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        this.close(true);
      }
    };
    document.addEventListener('keydown', this.handleKeydown);
  }

  close(confirmed) {
    // Remove event listener
    if (this.handleKeydown) {
      document.removeEventListener('keydown', this.handleKeydown);
    }

    // Animate out
    if (this.modal) {
      this.modal.style.animation = 'confirmModalFadeOut var(--transition-fast, 150ms) ease';
      setTimeout(() => {
        if (this.modal && this.modal.parentNode) {
          this.modal.parentNode.removeChild(this.modal);
        }
        this.resolve(confirmed);
      }, 150);
    } else {
      this.resolve(confirmed);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Register on window.APP.services
if (typeof window !== 'undefined') {
  window.APP = window.APP || {};
  window.APP.services = window.APP.services || {};
  window.APP.services.confirmModal = ConfirmModal;
}
