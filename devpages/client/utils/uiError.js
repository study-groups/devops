/**
 * client/utils/uiError.js
 * Provides a function to display a fatal error overlay.
 */

export function showFatalError(error, context = 'uncaught') {
    // Prevent multiple error overlays
    if (document.getElementById('fatal-error-overlay')) {
        return;
    }

    const errorDetails = `
Context: ${context}
Error: ${error.message}
Stack: ${error.stack || 'No stack trace available'}
    `.trim();

    const overlay = document.createElement('div');
    overlay.id = 'fatal-error-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    overlay.style.color = 'white';
    overlay.style.zIndex = '999999';
    overlay.style.padding = '20px';
    overlay.style.boxSizing = 'border-box';
    overlay.style.fontFamily = 'monospace';

    overlay.innerHTML = `
        <div style="background: #1e1e1e; border: 1px solid #555; padding: 20px; height: 100%; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #555; margin-bottom: 10px;">
                <h2 style="margin: 0; color: #ff4d4d;">A Critical Error Occurred</h2>
                <div>
                    <button id="copy-runtime-error-btn" style="padding: 8px 12px; cursor: pointer; background-color: #007bff; color: white; border: none; border-radius: 4px; margin-right: 10px;">Copy Details</button>
                    <button id="dismiss-error-btn" style="padding: 8px 12px; cursor: pointer; background-color: #6c757d; color: white; border: none; border-radius: 4px;">Dismiss</button>
                </div>
            </div>
            <p>The application has encountered an unrecoverable error and may be unstable.</p>
            <p><strong>Context:</strong> ${context}</p>
            <p><strong>Error:</strong> ${error.message}</p>
            <details open>
                <summary style="cursor: pointer; font-weight: bold;">Stack Trace</summary>
                <pre style="white-space: pre-wrap; word-wrap: break-word; background: #2b2b2b; color: #f2f2f2; padding: 15px; border-radius: 5px; margin-top: 10px;">${error.stack || 'No stack'}</pre>
            </details>
        </div>
    `;

    document.body.appendChild(overlay);

    const copyBtn = document.getElementById('copy-runtime-error-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(errorDetails).then(() => {
                copyBtn.textContent = 'Copied!';
                copyBtn.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy Details';
                    copyBtn.style.backgroundColor = '#007bff';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy error to clipboard:', err);
            });
        });
    }

    const dismissBtn = document.getElementById('dismiss-error-btn');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            overlay.remove();
        });
    }
} 