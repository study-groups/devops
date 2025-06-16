/**
 * Simplified PublishModal - orchestration only
 */
import { appStore } from '/client/appState.js';
import { logMessage } from '/client/log/index.js';
import { globalFetch } from '/client/globalFetch.js';
import { PublishAPI } from './PublishAPI.js';
import { createModalTemplate } from './PublishModalTemplate.js';
import { findEditor, ghostValue, loadStylesheet } from './PublishUtils.js';
import { renderMarkdown } from '/client/preview/renderer.js';
import { generateStaticHtmlForPublish } from '/client/utils/staticHtmlGenerator.js';
import { cssManager } from '/client/utils/CssManager.js';

export class PublishModal {
  constructor() {
    this.modal = null;
    this.isOpen = false;
    this.currentFile = null;
    this.spacesConfig = null;
    this.publishStatus = { isPublished: false, url: null };
    this.isProcessing = false;
    
    // Load CSS
    loadStylesheet('/client/components/publish/PublishModalStyles.css');
    
    this.createModal();
    this.loadSpacesConfig();
    this.checkPublishStatus();
  }

  async loadSpacesConfig() {
    this.spacesConfig = await PublishAPI.getSpacesConfig();
    this.updateConfigDisplay();
  }

  async checkPublishStatus() {
    const state = appStore.getState();
    const currentFile = state.file?.currentPathname;
    
    if (!currentFile) {
      this.publishStatus = { isPublished: false, url: null };
      return;
    }
    
    this.publishStatus = await PublishAPI.checkStatus(currentFile);
    this.updatePublishStatus();
  }

  createModal() {
    this.modal = document.createElement('div');
    this.modal.className = 'publish-modal-backdrop';

    const modalContent = document.createElement('div');
    modalContent.className = 'publish-modal-content';
    modalContent.innerHTML = createModalTemplate();

    this.modal.appendChild(modalContent);
    document.body.appendChild(this.modal);
    
    this.attachEventListeners();
  }

  attachEventListeners() {
    const closeBtn = this.modal.querySelector('.publish-modal-close');
    const cancelBtn = this.modal.querySelector('.cancel-btn');
    const publishBtn = this.modal.querySelector('.publish-btn');
    const unpublishBtn = this.modal.querySelector('.unpublish-btn');
    const copyBtn = this.modal.querySelector('.copy-url-btn');
    const openBtn = this.modal.querySelector('.open-url-btn');
    const testSetupBtn = this.modal.querySelector('.btn-test-setup');
    const testPublishBtn = this.modal.querySelector('.btn-test-publish');
    const debugEndpointBtn = this.modal.querySelector('.btn-debug-endpoint');

    closeBtn?.addEventListener('click', () => this.close());
    cancelBtn?.addEventListener('click', () => this.close());
    publishBtn?.addEventListener('click', () => this.handlePublishWithStatus());
    unpublishBtn?.addEventListener('click', () => this.handleUnpublish());
    copyBtn?.addEventListener('click', () => this.handleCopyUrl());
    openBtn?.addEventListener('click', () => this.handleOpenUrl());
    testSetupBtn?.addEventListener('click', () => this.handleTestSetup());
    testPublishBtn?.addEventListener('click', () => this.handleTestPublish());
    debugEndpointBtn?.addEventListener('click', () => this.handleDebugEndpoint());

    // Close on backdrop click
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  updateConfigDisplay() {
    if (!this.spacesConfig) return;

    // Update endpoint
    const endpointEl = this.modal.querySelector('#modal-spaces-endpoint');
    if (endpointEl) {
      endpointEl.textContent = this.spacesConfig.endpointValue || 'Not Set';
      endpointEl.className = `config-value ${this.spacesConfig.endpointValue !== 'Not Set' ? 'configured' : 'not-configured'}`;
    }

    // Update region
    const regionEl = this.modal.querySelector('#modal-spaces-region');
    if (regionEl) {
      regionEl.textContent = this.spacesConfig.regionValue || 'Not Set';
      regionEl.className = `config-value ${this.spacesConfig.regionValue !== 'Not Set' ? 'configured' : 'not-configured'}`;
    }

    // Update bucket
    const bucketEl = this.modal.querySelector('#modal-spaces-bucket');
    if (bucketEl) {
      bucketEl.textContent = this.spacesConfig.bucketValue || 'Not Set';
      bucketEl.className = `config-value ${this.spacesConfig.bucketValue !== 'Not Set' ? 'configured' : 'not-configured'}`;
    }

    // Update access key (ghosted)
    const keyEl = this.modal.querySelector('#modal-spaces-key');
    if (keyEl) {
      const keyValue = this.spacesConfig.endpointValue; // Using endpoint as proxy for key existence
      keyEl.textContent = keyValue !== 'Not Set' ? ghostValue('DO_SPACES_KEY', 16) : 'Not Set';
      keyEl.className = `config-value ${keyValue !== 'Not Set' ? 'configured' : 'not-configured'}`;
    }
  }

  updatePublishStatus() {
    const state = appStore.getState();
    const currentFile = state.file?.currentPathname;
    
    // Update file name
    const fileNameEl = this.modal.querySelector('.file-name');
    if (fileNameEl) {
      fileNameEl.textContent = currentFile || 'No file selected';
    }

    // Update publish status
    const statusIndicator = this.modal.querySelector('.status-indicator');
    const statusText = this.modal.querySelector('.status-text');
    const publishBtn = this.modal.querySelector('.publish-btn');
    const unpublishBtn = this.modal.querySelector('.unpublish-btn');
    const successSection = this.modal.querySelector('.publish-success');
    const successUrlInput = this.modal.querySelector('.success-url-input');

    if (this.publishStatus.isPublished && this.publishStatus.url) {
      // Published state
      statusIndicator?.classList.remove('unpublished');
      statusIndicator?.classList.add('published');
      if (statusText) statusText.textContent = 'Published';
      
      if (publishBtn) publishBtn.style.display = 'none';
      if (unpublishBtn) unpublishBtn.style.display = 'inline-flex';
      
      if (successSection) successSection.style.display = 'block';
      if (successUrlInput) successUrlInput.value = this.publishStatus.url;
    } else {
      // Not published state
      statusIndicator?.classList.remove('published');
      statusIndicator?.classList.add('unpublished');
      if (statusText) statusText.textContent = 'Not published';
      
      if (publishBtn) publishBtn.style.display = 'inline-flex';
      if (unpublishBtn) unpublishBtn.style.display = 'none';
      
      if (successSection) successSection.style.display = 'none';
    }
  }

  async handleTestSetup() {
    const testBtn = this.modal.querySelector('.btn-test-setup');
    const testText = this.modal.querySelector('.test-text');
    const testSpinner = this.modal.querySelector('.test-spinner');
    const testIcon = this.modal.querySelector('.test-icon');
    const testResults = this.modal.querySelector('.test-results');

    // Set testing state
    testBtn.disabled = true;
    testText.style.display = 'none';
    testIcon.style.display = 'none';
    testSpinner.style.display = 'inline';

    try {
      const result = await PublishAPI.testSetup();
      
      // Show success
      testResults.className = 'test-results success';
      testResults.style.display = 'block';
      testResults.querySelector('.test-status').textContent = '✅ ' + result.message;
      
      const details = [];
      details.push(`Total response time: ${result.details.responseTime}ms`);
      
      if (result.details.spacesEndpoint) {
        details.push(`Spaces endpoint: ${result.details.spacesEndpoint}`);
      }
      
      if (result.details.tests) {
        const tests = result.details.tests;
        if (tests.spacesConfig?.responseTime) {
          details.push(`Config API: ${tests.spacesConfig.responseTime}ms`);
        }
        if (tests.publishEndpoint?.responseTime) {
          details.push(`Publish API: ${tests.publishEndpoint.responseTime}ms`);
        }
      }
      
      testResults.querySelector('.test-details').textContent = details.join('\n');
      
      logMessage('Setup test passed', 'info', 'PUBLISH_MODAL');
      
    } catch (error) {
      // Show error
      testResults.className = 'test-results error';
      testResults.style.display = 'block';
      testResults.querySelector('.test-status').textContent = '❌ Setup Test Failed';
      
      let errorDetails = error.message;
      
      // Add specific guidance based on error type
      if (error.message.includes('Configuration incomplete')) {
        errorDetails += '\n\n💡 Fix: Set missing DO Spaces environment variables';
      } else if (error.message.includes('timeout')) {
        errorDetails += '\n\n💡 Check: Server connectivity and DO Spaces network access';
      } else if (error.message.includes('Config:')) {
        errorDetails += '\n\n💡 Check: /api/spaces/config endpoint and environment variables';
      } else if (error.message.includes('Publish:')) {
        errorDetails += '\n\n💡 Check: /api/publish endpoint and server logs';
      }
      
      testResults.querySelector('.test-details').textContent = errorDetails;
      
      logMessage(`Setup test failed: ${error.message}`, 'error', 'PUBLISH_MODAL');
    } finally {
      // Reset button state
      testBtn.disabled = false;
      testText.style.display = 'inline';
      testIcon.style.display = 'inline';
      testSpinner.style.display = 'none';
    }
  }

  async handlePublishWithStatus() {
    const statusSection = this.modal.querySelector('.realtime-status');
    let publishController = null;
    
    const updateStatus = (step, progress = 0) => {
      const progressBar = statusSection.querySelector('.progress-bar');
      const statusText = statusSection.querySelector('.status-text');
      
      if (progressBar) progressBar.style.width = `${progress}%`;
      if (statusText) statusText.textContent = step;
    };

    try {
      updateStatus('🔍 Pre-flight checks...', 10);
      
      const state = appStore.getState();
      const currentFile = state.file?.currentPathname;

      if (!currentFile || state.file?.isDirectorySelected) {
        throw new Error('No file selected for publishing');
      }

      updateStatus('📝 Reading editor content...', 20);
      
      const editor = findEditor();
      if (!editor) {
        throw new Error('Markdown editor not found');
      }

      const content = editor.value || '';
      if (!content.trim()) {
        throw new Error('Editor content is empty');
      }

      updateStatus('🔄 Generating HTML (using unified renderer)...', 40);
      
      // Get publish mode from settings
      const publishMode = state.settings?.publish?.mode || 'local';
      
      // Use the unified static HTML generator with proper context
      const htmlContent = await generateStaticHtmlForPublish({
        markdownSource: content,
        originalFilePath: currentFile,
        publishMode: publishMode
      });

      updateStatus('🚀 Publishing to DigitalOcean Spaces...', 60);

      this.setProcessing(true, 'publish');
      this.hideError();

      publishController = new AbortController();

      const response = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pathname: currentFile,
          htmlContent: htmlContent
        }),
        signal: publishController.signal
      });

      const result = await response.json();
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || `Server error: ${response.status}`);
      }
      
      updateStatus('✅ Upload complete!', 100);
      
      this.publishStatus = { isPublished: true, url: result.url };
      this.updatePublishStatus();
      
      logMessage(`Successfully published: ${currentFile} to ${result.url} (${result.processingTime}ms)`, 'info', 'PUBLISH_MODAL');

    } catch (error) {
      if (error.name === 'AbortError') {
        updateStatus('❌ Cancelled by user', 0);
        logMessage('Publish cancelled by user', 'info', 'PUBLISH_MODAL');
      } else {
        updateStatus('❌ Failed', 0);
        logMessage(`Publish error: ${error.message}`, 'error', 'PUBLISH_MODAL');
        this.showError('Failed to publish', error.message, error.stack);
      }
    } finally {
      this.setProcessing(false, 'publish');
      publishController = null;
    }
  }

  async handleUnpublish() {
    if (this.isProcessing) return;

    const state = appStore.getState();
    const currentFile = state.file?.currentPathname;

    if (!currentFile) {
      this.showError('No file selected for unpublishing');
      return;
    }

    this.setProcessing(true, 'unpublish');
    this.hideError();

    try {
      await PublishAPI.unpublish(currentFile);
      
      // Update status
      this.publishStatus = { isPublished: false, url: null };
      this.updatePublishStatus();
      
      logMessage(`Successfully unpublished: ${currentFile}`, 'info', 'PUBLISH_MODAL');

    } catch (error) {
      logMessage(`Unpublish error: ${error.message}`, 'error', 'PUBLISH_MODAL');
      this.showError('Failed to unpublish', error.message, error.stack);
    } finally {
      this.setProcessing(false, 'unpublish');
    }
  }

  setProcessing(isProcessing, action) {
    this.isProcessing = isProcessing;
    
    const btn = this.modal.querySelector(action === 'publish' ? '.publish-btn' : '.unpublish-btn');
    const btnText = btn?.querySelector('.btn-text');
    const btnSpinner = btn?.querySelector('.btn-spinner');
    
    if (btn) {
      btn.disabled = isProcessing;
      if (btnText) btnText.style.display = isProcessing ? 'none' : 'inline';
      if (btnSpinner) btnSpinner.style.display = isProcessing ? 'inline' : 'none';
    }

    // Disable other actions during processing
    const otherBtns = this.modal.querySelectorAll('.publish-btn, .unpublish-btn, .cancel-btn');
    otherBtns.forEach(otherBtn => {
      if (otherBtn !== btn) {
        otherBtn.disabled = isProcessing;
      }
    });
  }

  showError(title, message = '', details = '') {
    const errorSection = this.modal.querySelector('.publish-error');
    const errorTitle = this.modal.querySelector('.error-title');
    const errorMessage = this.modal.querySelector('.error-message');
    const errorDetails = this.modal.querySelector('.error-details');
    const errorDetailsContent = this.modal.querySelector('.error-details-content');

    if (errorTitle) errorTitle.textContent = title;
    if (errorMessage) errorMessage.textContent = message;
    
    if (details && errorDetailsContent) {
      errorDetailsContent.textContent = details;
      errorDetails.style.display = 'block';
    } else if (errorDetails) {
      errorDetails.style.display = 'none';
    }

    if (errorSection) {
      errorSection.style.display = 'block';
    }
  }

  hideError() {
    const errorSection = this.modal.querySelector('.publish-error');
    if (errorSection) {
      errorSection.style.display = 'none';
    }
  }

  async handleCopyUrl() {
    if (!this.publishStatus.url) return;
    
    try {
      await navigator.clipboard.writeText(this.publishStatus.url);
      logMessage('Published URL copied to clipboard', 'info', 'PUBLISH_MODAL');
      
      // Show brief feedback
      const copyBtn = this.modal.querySelector('.copy-url-btn');
      if (copyBtn) {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 1500);
      }
    } catch (error) {
      logMessage(`Failed to copy URL: ${error.message}`, 'error', 'PUBLISH_MODAL');
      this.showError('Failed to copy URL', error.message);
    }
  }

  handleOpenUrl() {
    if (this.publishStatus.url) {
      window.open(this.publishStatus.url, '_blank');
    }
  }

  async open(filePath = null) {
    this.isOpen = true;
    this.modal.style.display = 'flex';
    
    // Load config and status
    await Promise.all([
      this.loadSpacesConfig(),
      this.checkPublishStatus()
    ]);
    
    this.updateConfigDisplay();
    this.updatePublishStatus();
    
    logMessage('Publish modal opened', 'debug', 'PUBLISH_MODAL');
  }

  close() {
    this.isOpen = false;
    this.modal.style.display = 'none';
    this.hideError();
    logMessage('Publish modal closed', 'debug', 'PUBLISH_MODAL');
  }

  destroy() {
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
    this.modal = null;
    this.isOpen = false;
    logMessage('Publish modal destroyed', 'debug', 'PUBLISH_MODAL');
  }

  async handlePublishWithRetry(retryCount = 0) {
    const maxRetries = 2;
    
    try {
      await this.handlePublish();
    } catch (error) {
      if (error.message.includes('timed out') && retryCount < maxRetries) {
        logMessage(`Publish attempt ${retryCount + 1} failed, retrying...`, 'warn', 'PUBLISH_MODAL');
        
        // Show retry message
        this.updateProgressMessage(`Retrying... (${retryCount + 1}/${maxRetries})`);
        
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        return this.handlePublishWithRetry(retryCount + 1);
      } else {
        throw error; // Re-throw if max retries reached or different error
      }
    }
  }

  async handleTestPublish() {
    const testBtn = this.modal.querySelector('.btn-test-publish');
    const testText = testBtn.querySelector('.test-text');
    const testSpinner = testBtn.querySelector('.test-spinner');
    const testIcon = testBtn.querySelector('.test-icon');
    const testResults = this.modal.querySelector('.test-results');

    // Set testing state
    testBtn.disabled = true;
    testText.style.display = 'none';
    testIcon.style.display = 'none';
    testSpinner.style.display = 'inline';

    try {
      const result = await PublishAPI.testPublish();
      
      // Show success
      testResults.className = 'test-results success';
      testResults.style.display = 'block';
      testResults.querySelector('.test-status').textContent = '✅ ' + result.message;
      testResults.querySelector('.test-details').textContent = `Minimal content published successfully in ${result.details.responseTime}ms`;
      
      logMessage('Test publish passed', 'info', 'PUBLISH_MODAL');
      
    } catch (error) {
      // Show error
      testResults.className = 'test-results error';
      testResults.style.display = 'block';
      testResults.querySelector('.test-status').textContent = '❌ Test Publish Failed';
      testResults.querySelector('.test-details').textContent = error.message;
      
      logMessage(`Test publish failed: ${error.message}`, 'error', 'PUBLISH_MODAL');
    } finally {
      // Reset button state
      testBtn.disabled = false;
      testText.style.display = 'inline';
      testIcon.style.display = 'inline';
      testSpinner.style.display = 'none';
    }
  }

  async handleDebugEndpoint() {
    const debugBtn = this.modal.querySelector('.btn-debug-endpoint');
    const debugText = debugBtn.querySelector('.test-text');
    const debugSpinner = debugBtn.querySelector('.test-spinner');
    const debugIcon = debugBtn.querySelector('.test-icon');
    const testResults = this.modal.querySelector('.test-results');

    // Set testing state
    debugBtn.disabled = true;
    debugText.style.display = 'none';
    debugIcon.style.display = 'none';
    debugSpinner.style.display = 'inline';

    try {
      const result = await PublishAPI.debugPublishEndpoint();
      
      if (result.success) {
        // Show success
        testResults.className = 'test-results success';
        testResults.style.display = 'block';
        testResults.querySelector('.test-status').textContent = '✅ ' + result.message;
        
        const details = [];
        if (result.details.responseTime) {
          details.push(`Response time: ${result.details.responseTime}ms`);
        }
        if (result.details.publishedUrl) {
          details.push(`Test URL: ${result.details.publishedUrl}`);
        }
        
        testResults.querySelector('.test-details').textContent = details.join('\n');
        
        logMessage('Endpoint debugging completed successfully - publish is working!', 'info', 'PUBLISH_MODAL');
      } else {
        // Show detailed error info
        testResults.className = 'test-results error';
        testResults.style.display = 'block';
        testResults.querySelector('.test-status').textContent = '🐛 ' + result.message;
        
        let details = '';
        
        if (result.details.errorMessage) {
          details += `❌ Server Error: ${result.details.errorMessage}\n\n`;
        }
        
        if (result.details.testPayload) {
          details += `📤 Test Payload:\n${JSON.stringify(result.details.testPayload, null, 2)}\n\n`;
        }
        
        if (result.details.serverResponse) {
          details += `📄 Server Response:\n${result.details.serverResponse}\n\n`;
        }
        
        if (result.details.responseTime) {
          details += `⏱️ Response Time: ${result.details.responseTime}ms\n`;
        }
        
        // Add specific guidance based on error
        if (result.details.errorMessage) {
          details += `\n🔧 Likely Fix:\n`;
          if (result.details.errorMessage.includes('pathname')) {
            details += `- Check pathname validation in server\n`;
          }
          if (result.details.errorMessage.includes('required')) {
            details += `- Check required field validation\n`;
          }
          if (result.details.errorMessage.includes('permission')) {
            details += `- Check file permission system\n`;
          }
          if (result.details.errorMessage.includes('user')) {
            details += `- Check authentication/user validation\n`;
          }
        }
        
        testResults.querySelector('.test-details').textContent = details;
        
        logMessage(`Endpoint debugging revealed 400 error: ${result.details.errorMessage}`, 'error', 'PUBLISH_MODAL');
      }
      
    } catch (error) {
      // Show error
      testResults.className = 'test-results error';
      testResults.style.display = 'block';
      testResults.querySelector('.test-status').textContent = '❌ Debug Failed';
      testResults.querySelector('.test-details').textContent = error.message;
      
      logMessage(`Endpoint debugging failed: ${error.message}`, 'error', 'PUBLISH_MODAL');
    } finally {
      // Reset button state
      debugBtn.disabled = false;
      debugText.style.display = 'inline';
      debugIcon.style.display = 'inline';
      debugSpinner.style.display = 'none';
    }
  }
}

// Singleton pattern
let publishModalInstance = null;

export function getPublishModal() {
  if (!publishModalInstance) {
    publishModalInstance = new PublishModal();
  }
  return publishModalInstance;
}

export function openPublishModal(filePath = null) {
  const modal = getPublishModal();
  modal.open(filePath);
} 