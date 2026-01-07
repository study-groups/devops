/**
 * Enhanced Notification System
 * Replaces alert() calls with custom modals and contextual feedback
 */

class NotificationSystem {
    constructor() {
        this.modalContainer = null;
        this.notifications = [];
        this.init();
    }

    init() {
        this.createModalContainer();
        this.createNotificationContainer();
        this.addStyles();
    }

    createModalContainer() {
        this.modalContainer = document.createElement('div');
        this.modalContainer.id = 'notification-modal-container';
        this.modalContainer.innerHTML = `
            <div class="notification-backdrop" onclick="notificationSystem.closeModal()">
                <div class="notification-modal" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3 class="modal-title">
                            <span class="modal-icon"></span>
                            <span class="modal-title-text">Notification</span>
                        </h3>
                        <div class="modal-header-actions">
                            <button class="btn-copy-header" onclick="notificationSystem.copyDetails()" style="display: none;">
                                <span class="icon icon-clipboard"></span>
                                Copy
                            </button>
                            <button class="modal-close" onclick="notificationSystem.closeModal()">
                                <span class="icon icon-x"></span>
                            </button>
                        </div>
                    </div>
                    <div class="modal-content">
                        <div class="modal-message"></div>
                        <div class="modal-details" style="display: none;">
                            <div class="details-header">
                                <span class="icon icon-info"></span>
                                Technical Details
                            </div>
                            <div class="details-content">
                                <pre class="details-json"></pre>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        `;
        document.body.appendChild(this.modalContainer);
    }

    createNotificationContainer() {
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.id = 'notification-toast-container';
        document.body.appendChild(this.notificationContainer);
    }

    addStyles() {
        const styles = document.createElement('style');
        styles.textContent = `
            #notification-modal-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: none;
            }

            .notification-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }

            .notification-modal {
                background: #2a2a2a;
                border: 2px solid #00ff00;
                border-radius: 8px;
                max-width: 600px;
                width: 100%;
                max-height: 80vh;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                color: #00ff00;
            }

            .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #00aa00;
            }
            
            .modal-header-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .btn-copy-header {
                background: #333;
                border: 1px solid #555;
                color: #ccc;
                padding: 8px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 4px;
                transition: all 0.2s ease;
            }
            
            .btn-copy-header:hover {
                background: #444;
                color: #fff;
                border-color: #777;
            }
            
            .btn-copy-header:active {
                background: #00aa00;
                color: #fff;
                border-color: #00ff00;
                transform: scale(0.95);
            }

            .modal-title {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 0;
                font-size: 18px;
                font-weight: bold;
            }

            .modal-close {
                background: none;
                border: none;
                color: #00ff00;
                cursor: pointer;
                padding: 5px;
                border-radius: 3px;
                font-size: 16px;
            }

            .modal-close:hover {
                background: #333;
            }

            .modal-content {
                padding: 20px;
            }

            .modal-message {
                font-size: 16px;
                line-height: 1.5;
                margin-bottom: 15px;
            }

            .modal-details {
                margin-top: 20px;
                border-top: 1px solid #333;
                padding-top: 15px;
            }

            .details-header {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: bold;
                margin-bottom: 10px;
                color: #ffaa00;
            }

            .details-content {
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 4px;
                padding: 15px;
                margin-bottom: 10px;
            }

            .details-json {
                margin: 0;
                padding: 12px;
                font-family: 'Courier New', monospace;
                font-size: 16px;
                line-height: 1.4;
                color: #ccc;
                white-space: pre-wrap;
                word-break: break-all;
                max-height: 300px;
                overflow-y: auto;
                scrollbar-width: thin;
                scrollbar-color: #2a2a2a #1a1a1a;
            }
            
            .details-json::-webkit-scrollbar {
                width: 8px;
            }
            
            .details-json::-webkit-scrollbar-track {
                background: #1a1a1a;
                border-radius: 4px;
            }
            
            .details-json::-webkit-scrollbar-thumb {
                background: #2a2a2a;
                border-radius: 4px;
                border: 1px solid #1a1a1a;
            }
            
            .details-json::-webkit-scrollbar-thumb:hover {
                background: #333;
            }





            .btn {
                padding: 10px 20px;
                border-radius: 4px;
                cursor: pointer;
                font-family: 'Courier New', monospace;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 8px;
                border: none;
            }

            .btn-primary {
                background: #00aa00;
                color: #000;
            }

            .btn-primary:hover {
                background: #00ff00;
            }

            /* Toast Notifications */
            #notification-toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                max-width: 400px;
            }

            .notification-toast {
                background: #2a2a2a;
                border: 1px solid;
                border-radius: 6px;
                padding: 15px;
                margin-bottom: 10px;
                font-family: 'Courier New', monospace;
                animation: slideIn 0.3s ease-out;
                cursor: pointer;
                position: relative;
                overflow: hidden;
            }

            .notification-toast.success {
                border-color: #00aa00;
                background: #0a2a0a;
                color: #00ff00;
            }

            .notification-toast.error {
                border-color: #aa0000;
                background: #2a0a0a;
                color: #ff6666;
            }

            .notification-toast.warning {
                border-color: #aa6600;
                background: #2a1a0a;
                color: #ffaa00;
            }

            .notification-toast.info {
                border-color: #0066aa;
                background: #0a1a2a;
                color: #66aaff;
            }

            .toast-header {
                display: flex;
                align-items: center;
                gap: 8px;
                font-weight: bold;
                margin-bottom: 5px;
            }

            .toast-message {
                font-size: 14px;
                line-height: 1.4;
            }

            .toast-progress {
                position: absolute;
                bottom: 0;
                left: 0;
                height: 3px;
                background: currentColor;
                opacity: 0.6;
                animation: progressBar 5s linear;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes progressBar {
                from { width: 100%; }
                to { width: 0%; }
            }

            /* Button feedback styles */
            .btn-feedback {
                position: relative;
                overflow: hidden;
            }

            .btn-feedback.loading::after {
                content: '';
                position: absolute;
                top: 0;
                left: -100%;
                width: 100%;
                height: 100%;
                background: linear-gradient(90deg, 
                    transparent, 
                    rgba(255,255,255,0.2), 
                    transparent
                );
                animation: loading 1.5s infinite;
            }

            .btn-feedback.success {
                background: #00aa00 !important;
                color: #000 !important;
            }

            .btn-feedback.error {
                background: #aa0000 !important;
                color: #fff !important;
            }

            @keyframes loading {
                0% { left: -100%; }
                100% { left: 100%; }
            }
        `;
        document.head.appendChild(styles);
    }

    // Main modal method - replaces alert()
    showModal(options) {
        const {
            title = 'Notification',
            message = '',
            type = 'info', // success, error, warning, info
            details = null, // object/string for technical details
            icon = null
        } = options;

        // Set title and icon
        const titleElement = this.modalContainer.querySelector('.modal-title-text');
        const iconElement = this.modalContainer.querySelector('.modal-icon');
        
        titleElement.textContent = title;
        
        // Set icon based on type
        const iconClass = icon || this.getIconForType(type);
        iconElement.className = `icon ${iconClass}`;

        // Set message
        const messageElement = this.modalContainer.querySelector('.modal-message');
        messageElement.innerHTML = message;

        // Handle details
        const detailsElement = this.modalContainer.querySelector('.modal-details');
        const copyHeaderButton = this.modalContainer.querySelector('.btn-copy-header');
        
        if (details) {
            detailsElement.style.display = 'block';
            copyHeaderButton.style.display = 'flex'; // Show copy button in header
            
            const jsonElement = this.modalContainer.querySelector('.details-json');
            
            let detailsText;
            if (typeof details === 'object') {
                detailsText = JSON.stringify(details, null, 2);
            } else {
                detailsText = details;
            }
            
            jsonElement.textContent = detailsText;
            this.currentDetails = detailsText;
        } else {
            detailsElement.style.display = 'none';
            copyHeaderButton.style.display = 'none'; // Hide copy button when no details
            this.currentDetails = null;
        }

        // Show modal
        this.modalContainer.style.display = 'block';
        
        // Focus management
        setTimeout(() => {
            const closeBtn = this.modalContainer.querySelector('.modal-close');
            if (closeBtn) closeBtn.focus();
        }, 100);
    }

    // Toast notification method
    showToast(options) {
        const {
            title = '',
            message = '',
            type = 'info',
            duration = 5000,
            persistent = false
        } = options;

        const toast = document.createElement('div');
        toast.className = `notification-toast ${type}`;
        
        const iconClass = this.getIconForType(type);
        
        toast.innerHTML = `
            <div class="toast-header">
                <span class="icon ${iconClass}"></span>
                ${title}
            </div>
            <div class="toast-message">${message}</div>
            ${!persistent ? '<div class="toast-progress"></div>' : ''}
        `;

        this.notificationContainer.appendChild(toast);

        // Auto-remove unless persistent
        if (!persistent) {
            setTimeout(() => {
                toast.style.animation = 'slideIn 0.3s ease-out reverse';
                setTimeout(() => {
                    if (toast.parentNode) {
                        toast.parentNode.removeChild(toast);
                    }
                }, 300);
            }, duration);
        }

        // Click to dismiss
        toast.addEventListener('click', () => {
            toast.style.animation = 'slideIn 0.3s ease-out reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });
    }

    // Button feedback method
    showButtonFeedback(buttonElement, options) {
        const {
            type = 'success', // success, error, loading
            message = '',
            duration = 2000,
            originalText = buttonElement.textContent
        } = options;

        // Store original state
        const originalClass = buttonElement.className;
        
        // Apply feedback state
        buttonElement.className = `${originalClass} btn-feedback ${type}`;
        
        if (message) {
            buttonElement.textContent = message;
        }

        // Restore original state
        if (type !== 'loading') {
            setTimeout(() => {
                buttonElement.className = originalClass;
                buttonElement.textContent = originalText;
            }, duration);
        }

        return {
            restore: () => {
                buttonElement.className = originalClass;
                buttonElement.textContent = originalText;
            }
        };
    }

    getIconForType(type) {
        const iconMap = {
            success: 'icon-check',
            error: 'icon-x',
            warning: 'icon-warning',
            info: 'icon-info'
        };
        return iconMap[type] || 'icon-info';
    }

    closeModal() {
        this.modalContainer.style.display = 'none';
    }

    copyDetails() {
        if (this.currentDetails) {
            navigator.clipboard.writeText(this.currentDetails).then(() => {
                // Update header copy button
                const copyHeaderBtn = this.modalContainer.querySelector('.btn-copy-header');
                if (copyHeaderBtn) {
                    const originalHtml = copyHeaderBtn.innerHTML;
                    copyHeaderBtn.innerHTML = '<span class="icon icon-check"></span>';
                    copyHeaderBtn.style.background = '#00aa00';
                    copyHeaderBtn.style.borderColor = '#00ff00';
                    copyHeaderBtn.style.color = '#fff';
                    
                    // Add success animation
                    copyHeaderBtn.style.transform = 'scale(1.1)';
                    setTimeout(() => {
                        copyHeaderBtn.style.transform = 'scale(1)';
                    }, 150);
                    
                    setTimeout(() => {
                        copyHeaderBtn.innerHTML = originalHtml;
                        copyHeaderBtn.style.background = '#333';
                        copyHeaderBtn.style.borderColor = '#555';
                        copyHeaderBtn.style.color = '#ccc';
                    }, 2000);
                }
                

            }).catch(err => {
                console.error('Failed to copy details:', err);
                this.showToast({
                    title: 'Copy Failed',
                    message: 'Could not copy to clipboard',
                    type: 'error'
                });
            });
        }
    }

    // Convenience methods that replace alert() patterns
    success(message, details = null) {
        this.showToast({
            title: 'Success',
            message,
            type: 'success'
        });
    }

    error(message, details = null) {
        this.showModal({
            title: 'Error',
            message,
            type: 'error',
            details
        });
    }

    warning(message, details = null) {
        this.showToast({
            title: 'Warning',
            message,
            type: 'warning',
            duration: 7000
        });
    }

    info(message, details = null) {
        this.showToast({
            title: 'Information',
            message,
            type: 'info'
        });
    }

    // Enhanced error method for debugging
    debugError(error, context = {}) {
        const details = {
            error: error.message || error,
            stack: error.stack || 'No stack trace available',
            timestamp: new Date().toISOString(),
            context: context
        };

        this.showModal({
            title: 'Debug Error',
            message: `An error occurred: ${error.message || error}`,
            type: 'error',
            details
        });
    }
}

// Global instance
const notificationSystem = new NotificationSystem();

// Backward compatibility - override alert for gradual migration
const originalAlert = window.alert;
window.alert = function(message) {
    notificationSystem.showModal({
        title: 'Alert',
        message: message,
        type: 'info'
    });
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationSystem;
}