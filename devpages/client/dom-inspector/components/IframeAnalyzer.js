/**
 * IframeAnalyzer.js - Deep analysis of iframe elements
 * Provides security, performance, and content analysis for iframe elements
 */

export class IframeAnalyzer {
    constructor() {
        // No initialization needed
    }

    /**
     * Create iframe deep dive section
     */
    createIframeDeepDive(iframe, createCollapsibleSection) {
        const content = document.createElement('div');
        content.style.cssText = `
            font-size: 12px;
            line-height: 1.4;
        `;
        
        let analysis = [];
        
        // Security analysis
        const sandbox = iframe.sandbox;
        const sandboxFeatures = sandbox ? Array.from(sandbox).join(', ') : 'None';
        analysis.push(`<div><strong>Security:</strong></div>`);
        analysis.push(`<div style="margin-left: 12px;">Sandbox: ${sandboxFeatures || 'Full access'}</div>`);
        analysis.push(`<div style="margin-left: 12px;">Same Origin: ${this.checkSameOrigin(iframe)}</div>`);
        
        // Loading analysis
        analysis.push(`<div style="margin-top: 8px;"><strong>Loading:</strong></div>`);
        analysis.push(`<div style="margin-left: 12px;">Strategy: ${iframe.loading || 'eager'}</div>`);
        analysis.push(`<div style="margin-left: 12px;">Referrer Policy: ${iframe.referrerPolicy || 'default'}</div>`);
        
        // Content analysis
        analysis.push(`<div style="margin-top: 8px;"><strong>Content Analysis:</strong></div>`);
        try {
            const iframeDoc = iframe.contentDocument;
            if (iframeDoc) {
                const scripts = iframeDoc.querySelectorAll('script').length;
                const links = iframeDoc.querySelectorAll('link[rel="stylesheet"], style').length;
                const forms = iframeDoc.querySelectorAll('form').length;
                const images = iframeDoc.querySelectorAll('img').length;
                
                analysis.push(`<div style="margin-left: 12px;">Scripts: ${scripts}</div>`);
                analysis.push(`<div style="margin-left: 12px;">Stylesheets: ${links}</div>`);
                analysis.push(`<div style="margin-left: 12px;">Forms: ${forms}</div>`);
                analysis.push(`<div style="margin-left: 12px;">Images: ${images}</div>`);
                
                // Check for potential issues
                const issues = [];
                if (scripts > 10) issues.push('High script count');
                if (forms > 0 && sandbox && !sandbox.contains('allow-forms')) issues.push('Forms blocked by sandbox');
                if (issues.length > 0) {
                    analysis.push(`<div style="margin-top: 8px; color: #dc3545;"><strong>Potential Issues:</strong></div>`);
                    issues.forEach(issue => {
                        analysis.push(`<div style="margin-left: 12px; color: #dc3545;">• ${issue}</div>`);
                    });
                }
            } else {
                analysis.push(`<div style="margin-left: 12px; color: #6c757d;">Content blocked (cross-origin)</div>`);
            }
        } catch (e) {
            analysis.push(`<div style="margin-left: 12px; color: #6c757d;">Content access denied</div>`);
        }
        
        // Performance analysis
        analysis.push(`<div style="margin-top: 8px;"><strong>Performance:</strong></div>`);
        const rect = iframe.getBoundingClientRect();
        analysis.push(`<div style="margin-left: 12px;">Viewport Size: ${Math.round(rect.width)}×${Math.round(rect.height)}</div>`);
        analysis.push(`<div style="margin-left: 12px;">Visibility: ${rect.width > 0 && rect.height > 0 ? 'Visible' : 'Hidden'}</div>`);
        
        // Recommendations
        const recommendations = this.getIframeRecommendations(iframe);
        if (recommendations.length > 0) {
            analysis.push(`<div style="margin-top: 8px;"><strong>Recommendations:</strong></div>`);
            recommendations.forEach(rec => {
                analysis.push(`<div style="margin-left: 12px; color: #28a745;">• ${rec}</div>`);
            });
        }
        
        content.innerHTML = analysis.join('');
        
        return createCollapsibleSection('iframe-deep-dive', 'Iframe Deep Dive', content, true);
    }

    /**
     * Create iframe deep dive content (just the content, not the full section)
     */
    createIframeDeepDiveContent(iframe) {
        const content = document.createElement('div');
        content.style.cssText = `
            font-size: 12px;
            line-height: 1.4;
        `;
        
        let analysis = [];
        
        // Security analysis
        const sandbox = iframe.sandbox;
        const sandboxFeatures = sandbox ? Array.from(sandbox).join(', ') : 'None';
        analysis.push(`<div><strong>Security:</strong></div>`);
        analysis.push(`<div style="margin-left: 12px;">Sandbox: ${sandboxFeatures || 'Full access'}</div>`);
        analysis.push(`<div style="margin-left: 12px;">Same Origin: ${this.checkSameOrigin(iframe)}</div>`);
        
        // Loading analysis
        analysis.push(`<div style="margin-top: 8px;"><strong>Loading:</strong></div>`);
        analysis.push(`<div style="margin-left: 12px;">Strategy: ${iframe.loading || 'eager'}</div>`);
        analysis.push(`<div style="margin-left: 12px;">Referrer Policy: ${iframe.referrerPolicy || 'default'}</div>`);
        
        // Content analysis
        analysis.push(`<div style="margin-top: 8px;"><strong>Content Analysis:</strong></div>`);
        try {
            const iframeDoc = iframe.contentDocument;
            if (iframeDoc) {
                const scripts = iframeDoc.querySelectorAll('script').length;
                const links = iframeDoc.querySelectorAll('link[rel="stylesheet"], style').length;
                const forms = iframeDoc.querySelectorAll('form').length;
                const images = iframeDoc.querySelectorAll('img').length;
                
                analysis.push(`<div style="margin-left: 12px;">Scripts: ${scripts}</div>`);
                analysis.push(`<div style="margin-left: 12px;">Stylesheets: ${links}</div>`);
                analysis.push(`<div style="margin-left: 12px;">Forms: ${forms}</div>`);
                analysis.push(`<div style="margin-left: 12px;">Images: ${images}</div>`);
                
                // Check for potential issues
                const issues = [];
                if (scripts > 10) issues.push('High script count');
                if (forms > 0 && sandbox && !sandbox.contains('allow-forms')) issues.push('Forms blocked by sandbox');
                if (issues.length > 0) {
                    analysis.push(`<div style="margin-top: 8px; color: #dc3545;"><strong>Potential Issues:</strong></div>`);
                    issues.forEach(issue => {
                        analysis.push(`<div style="margin-left: 12px; color: #dc3545;">• ${issue}</div>`);
                    });
                }
            } else {
                analysis.push(`<div style="margin-left: 12px; color: #6c757d;">Content blocked (cross-origin)</div>`);
            }
        } catch (e) {
            analysis.push(`<div style="margin-left: 12px; color: #6c757d;">Content access denied</div>`);
        }
        
        // Performance analysis
        analysis.push(`<div style="margin-top: 8px;"><strong>Performance:</strong></div>`);
        const rect = iframe.getBoundingClientRect();
        analysis.push(`<div style="margin-left: 12px;">Viewport Size: ${Math.round(rect.width)}×${Math.round(rect.height)}</div>`);
        analysis.push(`<div style="margin-left: 12px;">Visibility: ${rect.width > 0 && rect.height > 0 ? 'Visible' : 'Hidden'}</div>`);
        
        // Recommendations
        const recommendations = this.getIframeRecommendations(iframe);
        if (recommendations.length > 0) {
            analysis.push(`<div style="margin-top: 8px;"><strong>Recommendations:</strong></div>`);
            recommendations.forEach(rec => {
                analysis.push(`<div style="margin-left: 12px; color: #28a745;">• ${rec}</div>`);
            });
        }
        
        content.innerHTML = analysis.join('');
        return content;
    }
    
    /**
     * Check if iframe is same origin
     */
    checkSameOrigin(iframe) {
        try {
            const iframeDoc = iframe.contentDocument;
            return iframeDoc ? 'Yes' : 'No';
        } catch (e) {
            return 'No (cross-origin)';
        }
    }
    
    /**
     * Get iframe recommendations
     */
    getIframeRecommendations(iframe) {
        const recommendations = [];
        
        if (!iframe.loading) {
            recommendations.push('Consider adding loading="lazy" for better performance');
        }
        
        if (!iframe.title) {
            recommendations.push('Add title attribute for accessibility');
        }
        
        if (!iframe.sandbox) {
            recommendations.push('Consider adding sandbox restrictions for security');
        }
        
        if (iframe.src && iframe.src.startsWith('http:') && location.protocol === 'https:') {
            recommendations.push('Mixed content: HTTPS page loading HTTP iframe');
        }
        
        return recommendations;
    }
} 