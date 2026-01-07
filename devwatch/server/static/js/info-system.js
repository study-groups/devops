/**
 * Info System - Clickable info icons throughout the interface
 * Provides contextual help without cluttering the UI
 */

class InfoSystem {
    constructor() {
        this.init();
    }

    init() {
        this.addInfoIcons();
        this.setupEventListeners();
        this.addStyles();
    }

    addInfoIcons() {
        // Add info icons to key elements in the admin interface
        this.addInfoIcon('testing-matrix-header', {
            title: 'Testing Matrix Dashboard',
            content: `
                <strong>Data Source:</strong> /api/testing-matrix (api.js:402)<br>
                <strong>Frontend:</strong> testing-matrix.js<br>
                <strong>Current Status:</strong> Mock data simulation<br><br>
                
                The matrix shows 3 browsers × 3 viewports × 3 environments = 27 total combinations.
                Click cells to select tests, then use "Run Selected" to execute.
            `
        });

        this.addInfoIcon('matrix-stats', {
            title: 'Matrix Statistics',
            content: `
                <strong>Total Combinations:</strong> All possible browser/viewport/environment combinations<br>
                <strong>Passing:</strong> Tests that completed successfully<br>
                <strong>Failing:</strong> Tests that completed with errors<br>
                <strong>Running:</strong> Currently executing tests<br>
                <strong>Pending:</strong> Not yet tested<br><br>
                
                Statistics update in real-time as tests complete.
            `
        });

        this.addInfoIcon('system-logging', {
            title: 'System Activity Log',
            content: `
                <strong>File Location:</strong> PW_DIR/logs/server/server.log<br>
                <strong>Storage:</strong> localStorage + backend logging<br>
                <strong>Types:</strong> INSTANT, PERIODIC, TEST, SUITE, MATRIX, SYSTEM<br><br>
                
                Logs are automatically filtered and searchable. Max 500 entries in memory.
            `
        });

        this.addInfoIcon('recent-runs-section', {
            title: 'Recent Test Runs',
            content: `
                <strong>Storage:</strong> localStorage (matrix-test-runs)<br>
                <strong>Retention:</strong> Last 10 runs<br>
                <strong>Data:</strong> Run ID, combinations, timestamps<br><br>
                
                Click any entry to view full test run details and results.
            `
        });

        // Add info icons to API endpoints if they exist
        this.addInfoToApiSection();
    }

    addInfoIcon(targetId, infoData) {
        const target = document.getElementById(targetId);
        if (!target) return;

        const infoIcon = document.createElement('span');
        infoIcon.className = 'info-icon';
        infoIcon.innerHTML = 'ⓘ';
        infoIcon.setAttribute('data-info', JSON.stringify(infoData));
        
        // Position the icon based on target type
        if (target.tagName === 'H1' || target.tagName === 'H2' || target.tagName === 'H3') {
            target.appendChild(infoIcon);
        } else {
            const header = target.querySelector('h2, h3, .section-header');
            if (header) {
                header.appendChild(infoIcon);
            } else {
                target.style.position = 'relative';
                infoIcon.style.position = 'absolute';
                infoIcon.style.top = '10px';
                infoIcon.style.right = '10px';
                target.appendChild(infoIcon);
            }
        }
    }

    addInfoToApiSection() {
        // Add info about API endpoints
        const apiInfo = {
            '/api/testing-matrix': 'Returns matrix dashboard data (browsers × viewports × environments)',
            '/api/testing-matrix/run': 'Starts matrix test execution for selected combinations',
            '/api/testing-matrix/status/:runId': 'Real-time test execution status updates',
            '/api/testing-matrix/results': 'Historical test results from master database',
            '/api/system/info': 'Server system information (memory, uptime, processes)',
            '/api/system/log': 'System activity logging endpoint'
        };

        // If there's an API section, add detailed info
        Object.entries(apiInfo).forEach(([endpoint, description]) => {
            const elements = document.querySelectorAll(`[data-endpoint="${endpoint}"]`);
            elements.forEach(el => {
                this.addInfoIcon(el.id || `api-${Date.now()}`, {
                    title: endpoint,
                    content: `
                        <strong>Endpoint:</strong> ${endpoint}<br>
                        <strong>Description:</strong> ${description}<br>
                        <strong>File:</strong> playwright/server/routes/api.js<br><br>
                        
                        <a href="${endpoint}" target="_blank">Test this endpoint →</a>
                    `
                });
            });
        });
    }

    setupEventListeners() {
        // Handle info icon clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('info-icon')) {
                e.stopPropagation();
                const infoData = JSON.parse(e.target.getAttribute('data-info'));
                this.showInfoModal(infoData);
            }
        });

        // Close modal when clicking outside
        document.addEventListener('click', (e) => {
            const modal = document.getElementById('info-modal');
            if (modal && e.target === modal) {
                this.closeInfoModal();
            }
        });

        // ESC key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeInfoModal();
            }
        });
    }

    showInfoModal(infoData) {
        // Remove existing modal
        this.closeInfoModal();

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'info-modal';
        modal.className = 'info-modal';
        modal.innerHTML = `
            <div class="info-modal-content">
                <div class="info-modal-header">
                    <h3>${infoData.title}</h3>
                    <button class="info-modal-close" onclick="infoSystem.closeInfoModal()">×</button>
                </div>
                <div class="info-modal-body">
                    ${infoData.content}
                </div>
                <div class="info-modal-footer">
                    <button onclick="window.open('/static/system-info.html', '_blank')" class="info-btn-secondary">
                        📖 Full Documentation
                    </button>
                    <button onclick="infoSystem.closeInfoModal()" class="info-btn-primary">
                        Got it
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        
        // Animate in
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
        });
    }

    closeInfoModal() {
        const modal = document.getElementById('info-modal');
        if (modal) {
            modal.style.opacity = '0';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        }
    }

    addStyles() {
        const styles = document.createElement('style');
        styles.id = 'info-system-styles';
        styles.textContent = `
            .info-icon {
                display: inline-block;
                width: 18px;
                height: 18px;
                background: #00aa00;
                color: #000;
                border-radius: 50%;
                text-align: center;
                line-height: 18px;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                margin-left: 8px;
                transition: all 0.2s ease;
                user-select: none;
            }
            
            .info-icon:hover {
                background: #00ff00;
                transform: scale(1.1);
                box-shadow: 0 0 8px rgba(0, 255, 0, 0.5);
            }
            
            .info-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.8);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s ease;
                backdrop-filter: blur(4px);
            }
            
            .info-modal-content {
                background: #2a2a2a;
                border: 2px solid #00aa00;
                border-radius: 8px;
                max-width: 600px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                color: #00ff00;
            }
            
            .info-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #00aa00;
                background: #333;
            }
            
            .info-modal-header h3 {
                margin: 0;
                color: #00ff00;
            }
            
            .info-modal-close {
                background: none;
                border: none;
                color: #00ff00;
                font-size: 24px;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s ease;
            }
            
            .info-modal-close:hover {
                background: #ff4444;
                color: #fff;
            }
            
            .info-modal-body {
                padding: 20px;
                line-height: 1.6;
                color: #ccc;
            }
            
            .info-modal-body strong {
                color: #00ff00;
            }
            
            .info-modal-body a {
                color: #00aaff;
                text-decoration: none;
            }
            
            .info-modal-body a:hover {
                text-decoration: underline;
            }
            
            .info-modal-footer {
                padding: 15px 20px;
                border-top: 1px solid #333;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                background: #2a2a2a;
            }
            
            .info-btn-primary, .info-btn-secondary {
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-family: 'Courier New', monospace;
                font-size: 12px;
                border: 1px solid;
                transition: all 0.2s ease;
            }
            
            .info-btn-primary {
                background: #00aa00;
                color: #000;
                border-color: #00aa00;
            }
            
            .info-btn-primary:hover {
                background: #00ff00;
            }
            
            .info-btn-secondary {
                background: transparent;
                color: #00aa00;
                border-color: #00aa00;
            }
            
            .info-btn-secondary:hover {
                background: #00aa00;
                color: #000;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .info-modal-content {
                    width: 95%;
                    max-height: 90vh;
                }
                
                .info-modal-header {
                    padding: 15px;
                }
                
                .info-modal-body {
                    padding: 15px;
                }
                
                .info-modal-footer {
                    flex-direction: column;
                    padding: 15px;
                }
                
                .info-btn-primary, .info-btn-secondary {
                    width: 100%;
                    justify-content: center;
                }
            }
        `;
        document.head.appendChild(styles);
    }

    // Utility method to add info to any element
    addInfoToElement(selector, title, content) {
        const element = document.querySelector(selector);
        if (element) {
            this.addInfoIcon(element.id || `info-${Date.now()}`, { title, content });
        }
    }
}

// Initialize the info system
const infoSystem = new InfoSystem();