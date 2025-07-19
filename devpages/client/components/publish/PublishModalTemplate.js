/**
 * HTML template for the publish modal
 */
export function createModalTemplate() {
  return `
    <div class="publish-modal-header">
      <h2 class="publish-modal-title">
        <span class="publish-icon">🌐</span>
        Publish to Digital Ocean Spaces
      </h2>
      <button class="publish-modal-close" type="button" aria-label="Close">
        <span>&times;</span>
      </button>
    </div>
    
    <div class="publish-modal-body">
      <!-- File Info Section -->
      <div class="publish-section">
        <div class="publish-file-info">
          <div class="publish-file-name">
            <span class="file-icon">📄</span>
            <span class="file-name">No file selected</span>
          </div>
          <div class="publish-file-status">
            <span class="status-indicator unpublished">●</span>
            <span class="status-text">Not published</span>
          </div>
        </div>
      </div>

      <!-- Configuration Status -->
      <div class="publish-section">
        <div class="config-header">
          <h3 class="section-title">Configuration Status</h3>
          <div class="test-buttons">
            <button class="btn btn-secondary btn-sm btn-test-setup" type="button" data-test-type="setup">
              <span class="test-icon">🔧</span>
              <span class="test-text">Check Setup</span>
              <span class="test-spinner" style="display: none;">⟳</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-test-publish" type="button" data-test-type="publish">
              <span class="test-icon">🧪</span>
              <span class="test-text">Test Publish</span>
              <span class="test-spinner" style="display: none;">⟳</span>
            </button>
            <button class="btn btn-secondary btn-sm btn-debug-endpoint" type="button" data-test-type="debug">
              <span class="test-icon">🐛</span>
              <span class="test-text">Debug Endpoint</span>
              <span class="test-spinner" style="display: none;">⟳</span>
            </button>
          </div>
        </div>
        <div class="config-status-grid">
          <div class="config-item">
            <div class="config-label">Endpoint:</div>
            <div class="config-value" id="modal-spaces-endpoint">Loading...</div>
          </div>
          <div class="config-item">
            <div class="config-label">Region:</div>
            <div class="config-value" id="modal-spaces-region">Loading...</div>
          </div>
          <div class="config-item">
            <div class="config-label">Bucket:</div>
            <div class="config-value" id="modal-spaces-bucket">Loading...</div>
          </div>
          <div class="config-item">
            <div class="config-label">Access Key:</div>
            <div class="config-value" id="modal-spaces-key">Loading...</div>
          </div>
        </div>
        
        <!-- Test Results -->
        <div class="test-results" style="display: none;">
          <div class="test-status"></div>
          <div class="test-details"></div>
        </div>
      </div>

      <!-- Publish Options -->
      <div class="publish-section">
        <h3 class="section-title">Publish Options</h3>
        <div class="publish-options">
          <label class="publish-option">
            <input type="checkbox" class="bundle-css-checkbox" checked>
            <span class="option-text">Bundle CSS inline (recommended)</span>
            <span class="option-description">Includes all CSS directly in the HTML file for better compatibility</span>
          </label>
        </div>
      </div>

      <!-- Real-time Status -->
      <div class="publish-section">
        <div class="realtime-status" style="display: none;">
          <div class="status-header">
            <span class="status-icon">📊</span>
            <span class="status-title">Publishing Status</span>
          </div>
          <div class="status-details">
            <div class="status-step">Ready to publish</div>
            <div class="status-progress-bar">
              <div class="status-progress" style="width: 0%"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Display -->
      <div class="publish-error" style="display: none;">
        <div class="error-header">
          <span class="error-icon">⚠️</span>
          <span class="error-title">Publish Error</span>
        </div>
        <div class="error-message"></div>
        <div class="error-details" style="display: none;">
          <details>
            <summary>Technical Details</summary>
            <pre class="error-details-content"></pre>
          </details>
        </div>
      </div>

      <!-- Success Display -->
      <div class="publish-success" style="display: none;">
        <div class="success-header">
          <span class="success-icon">✅</span>
          <span class="success-title">Published Successfully!</span>
        </div>
        <div class="success-url-container">
          <input type="text" class="success-url-input" readonly>
          <button class="copy-url-btn" type="button">Copy</button>
          <button class="open-url-btn" type="button">Open</button>
        </div>
      </div>
    </div>

    <div class="publish-modal-footer">
      <div class="modal-actions">
        <button class="btn btn-secondary cancel-btn" type="button">Cancel</button>
        <button class="btn btn-ghost unpublish-btn" type="button" style="display: none;">
          <span class="btn-text">Unpublish</span>
          <span class="btn-spinner" style="display: none;">⟳</span>
        </button>
        <button class="btn btn-primary publish-btn" type="button">
          <span class="btn-text">Publish</span>
          <span class="btn-spinner" style="display: none;">⟳</span>
        </button>
      </div>
    </div>
  `;
} 