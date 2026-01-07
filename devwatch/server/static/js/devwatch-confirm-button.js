/**
 * DevWatchConfirmButton - A reusable component for in-button confirmation.
 *
 * This class enhances a standard button with a confirmation flow to prevent
 * accidental actions. It manages the button's text, appearance, and state,
 * and executes a callback upon successful confirmation.
 *
 * @param {HTMLElement} element - The button element to enhance.
 * @param {object} options - Configuration options.
 * @param {function} options.onConfirm - The callback to execute on confirmation.
 * @param {string} [options.initialText='Delete'] - The initial text of the button.
 * @param {string} [options.confirmText='Confirm?'] - The text shown during confirmation.
 * @param {number} [options.confirmTimeout=3000] - The time in ms to wait for confirmation.
 */
class DevWatchConfirmButton {
    constructor(element, options) {
        this.element = element;
        this.options = {
            initialText: 'Delete',
            confirmText: 'Confirm?',
            confirmTimeout: 3000,
            ...options,
        };

        this.state = 'initial'; // initial, confirming
        this.timeoutId = null;

        this.element.addEventListener('click', this.handleClick.bind(this));
        this.reset();
    }

    handleClick(e) {
        e.preventDefault();
        e.stopPropagation();

        if (this.state === 'initial') {
            this.state = 'confirming';
            this.element.textContent = this.options.confirmText;
            this.element.classList.add('is-confirming');

            this.timeoutId = setTimeout(() => {
                this.reset();
            }, this.options.confirmTimeout);

        } else if (this.state === 'confirming') {
            if (this.options.onConfirm) {
                this.options.onConfirm();
            }
            this.reset();
        }
    }

    reset() {
        clearTimeout(this.timeoutId);
        this.state = 'initial';
        this.element.textContent = this.options.initialText;
        this.element.classList.remove('is-confirming');
    }
}
