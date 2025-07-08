/**
 * Z-Index Analyzer - Integrated CSS Files Panel Component
 * Analyzes z-index usage across CSS files and provides management tools
 */

export class ZIndexAnalyzer {
  constructor() {
    this.zIndexData = new Map(); // CSS file href -> z-index analysis
    this.globalZIndexElements = new Map(); // DOM elements with z-index
    this.conflicts = [];
    this.recommendations = [];
    
    // Standardized z-index ranges
    this.zIndexRanges = {
      background: { min: -999, max: -1, name: 'Background', color: '#6c757d' },
      content: { min: 0, max: 99, name: 'Content', color: '#28a745' },
      ui: { min: 100, max: 999, name: 'UI Elements', color: '#17a2b8' },
      overlay: { min: 1000, max: 9999, name: 'Overlays', color: '#ffc107' },
      modal: { min: 10000, max: 99999, name: 'Modals', color: '#fd7e14' },
      system: { min: 100000, max: 999999, name: 'System', color: '#dc3545' },
      emergency: { min: 1000000, max: 9999999, name: 'Emergency', color: '#6f42c1' }
    };
  }

  /**
   * Analyze z-index usage in a CSS file
   */
  analyzeCssFile(cssFile) {
    const analysis = {
      href: cssFile.href,
      type: cssFile.type,
      zIndexRules: [],
      zIndexCount: 0,
      hasConflicts: false,
      rangeDistribution: {},
      extremeValues: []
    };

    try {
      if (cssFile.element && cssFile.element.sheet) {
        const rules = this.safeGetCssRules(cssFile.element.sheet);
        
        rules.forEach(rule => {
          if (rule.type === CSSRule.STYLE_RULE) {
            const zIndexValue = this.extractZIndexFromRule(rule);
            if (zIndexValue !== null) {
              const ruleInfo = {
                selector: rule.selectorText,
                zIndex: zIndexValue,
                range: this.categorizeZIndex(zIndexValue),
                specificity: this.calculateSpecificity(rule.selectorText),
                ruleText: rule.cssText
              };
              
              analysis.zIndexRules.push(ruleInfo);
              analysis.zIndexCount++;
              
              // Track extreme values
              if (Math.abs(zIndexValue) > 10000) {
                analysis.extremeValues.push(ruleInfo);
              }
            }
          }
        });

        // Calculate range distribution
        analysis.zIndexRules.forEach(rule => {
          const rangeKey = rule.range.key;
          analysis.rangeDistribution[rangeKey] = (analysis.rangeDistribution[rangeKey] || 0) + 1;
        });

        // Check for conflicts within this file
        analysis.hasConflicts = this.detectFileConflicts(analysis.zIndexRules);
      }
    } catch (error) {
      console.warn('[ZIndexAnalyzer] Error analyzing CSS file:', error);
      analysis.error = error.message;
    }

    this.zIndexData.set(cssFile.href, analysis);
    return analysis;
  }

  /**
   * Extract z-index value from CSS rule
   */
  extractZIndexFromRule(rule) {
    const zIndexMatch = rule.cssText.match(/z-index\s*:\s*([^;]+)/i);
    if (zIndexMatch) {
      const value = zIndexMatch[1].trim();
      if (value !== 'auto' && value !== 'inherit' && value !== 'initial') {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
          return numValue;
        }
      }
    }
    return null;
  }

  /**
   * Safely get CSS rules from stylesheet
   */
  safeGetCssRules(sheet) {
    try {
      return Array.from(sheet.cssRules || []);
    } catch (error) {
      return [];
    }
  }

  /**
   * Categorize z-index value into ranges
   */
  categorizeZIndex(zIndex) {
    for (const [key, range] of Object.entries(this.zIndexRanges)) {
      if (zIndex >= range.min && zIndex <= range.max) {
        return { key, ...range };
      }
    }
    return { key: 'unknown', name: 'Unknown', color: '#343a40' };
  }

  /**
   * Calculate CSS selector specificity
   */
  calculateSpecificity(selector) {
    const ids = (selector.match(/#[a-zA-Z][\w-]*/g) || []).length;
    const classes = (selector.match(/\.[a-zA-Z][\w-]*/g) || []).length;
    const attributes = (selector.match(/\[[^\]]*\]/g) || []).length;
    const pseudoClasses = (selector.match(/:(?!:)[a-zA-Z][\w-]*/g) || []).length;
    const elements = (selector.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length;
    
    return {
      ids,
      classes: classes + attributes + pseudoClasses,
      elements,
      total: (ids * 100) + ((classes + attributes + pseudoClasses) * 10) + elements,
      toString: () => `(${ids},${classes + attributes + pseudoClasses},${elements})`
    };
  }

  /**
   * Detect conflicts within a single CSS file
   */
  detectFileConflicts(zIndexRules) {
    const valueGroups = new Map();
    
    zIndexRules.forEach(rule => {
      if (!valueGroups.has(rule.zIndex)) {
        valueGroups.set(rule.zIndex, []);
      }
      valueGroups.get(rule.zIndex).push(rule);
    });

    // Check for multiple rules with same z-index
    for (const [zIndex, rules] of valueGroups) {
      if (rules.length > 1) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Scan DOM for elements with z-index
   */
  scanDOMElements() {
    this.globalZIndexElements.clear();
    const allElements = document.querySelectorAll('*');
    
    allElements.forEach(element => {
      const computedStyle = window.getComputedStyle(element);
      const zIndex = computedStyle.zIndex;
      
      if (zIndex !== 'auto' && zIndex !== '') {
        const zIndexValue = parseInt(zIndex, 10);
        if (!isNaN(zIndexValue)) {
          const elementInfo = {
            element,
            zIndex: zIndexValue,
            position: computedStyle.position,
            selector: this.generateSelector(element),
            range: this.categorizeZIndex(zIndexValue),
            bounds: element.getBoundingClientRect()
          };
          
          this.globalZIndexElements.set(element, elementInfo);
        }
      }
    });
  }

  /**
   * Generate CSS selector for element
   */
  generateSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    
    let selector = element.tagName.toLowerCase();
    
    if (element.classList.length > 0) {
      selector += '.' + Array.from(element.classList).slice(0, 2).join('.');
    }
    
    return selector;
  }

  /**
   * Generate comprehensive z-index statistics
   */
  generateStats() {
    const allAnalyses = Array.from(this.zIndexData.values());
    const totalRules = allAnalyses.reduce((sum, analysis) => sum + analysis.zIndexCount, 0);
    const filesWithZIndex = allAnalyses.filter(analysis => analysis.zIndexCount > 0).length;
    const conflictFiles = allAnalyses.filter(analysis => analysis.hasConflicts).length;
    
    // Global range distribution
    const globalRangeDistribution = {};
    Object.keys(this.zIndexRanges).forEach(key => {
      globalRangeDistribution[key] = allAnalyses.reduce((sum, analysis) => 
        sum + (analysis.rangeDistribution[key] || 0), 0);
    });

    // Extreme values across all files
    const allExtremeValues = allAnalyses.reduce((acc, analysis) => 
      acc.concat(analysis.extremeValues), []);

    return {
      totalFiles: allAnalyses.length,
      filesWithZIndex,
      totalRules,
      conflictFiles,
      globalRangeDistribution,
      extremeValues: allExtremeValues.length,
      domElements: this.globalZIndexElements.size
    };
  }

  /**
   * Render z-index subpanel
   */
  renderSubPanel() {
    const stats = this.generateStats();
    
    return `
      <div class="z-index-subpanel" style="
        margin-top: 20px;
        border: 1px solid var(--color-border, #e1e5e9);
        border-radius: 6px;
        overflow: hidden;
      ">
        ${this.renderSubPanelHeader(stats)}
        ${this.renderRangeDistribution(stats)}
        ${this.renderFileBreakdown()}
        ${this.renderQuickActions()}
      </div>
    `;
  }

  /**
   * Render subpanel header
   */
  renderSubPanelHeader(stats) {
    return `
      <div style="
        background: var(--color-info-background, #d1ecf1);
        border-bottom: 1px solid var(--color-border, #e1e5e9);
        padding: 16px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0; font-size: 14px; font-weight: 600; color: var(--color-info-text, #0c5460);">
            📏 Z-Index Analysis
          </h4>
          <button class="refresh-zindex-analysis" style="
            padding: 4px 8px;
            background: var(--color-info, #17a2b8);
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 11px;
          ">Refresh</button>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 8px;">
          <div style="text-align: center; padding: 8px; background: var(--color-background, white); border-radius: 4px;">
            <div style="font-size: 16px; font-weight: 700; color: var(--color-info, #17a2b8);">${stats.filesWithZIndex}</div>
            <div style="font-size: 10px; color: var(--color-foreground-secondary, #666);">Files</div>
          </div>
          
          <div style="text-align: center; padding: 8px; background: var(--color-background, white); border-radius: 4px;">
            <div style="font-size: 16px; font-weight: 700; color: var(--color-primary, #0066cc);">${stats.totalRules}</div>
            <div style="font-size: 10px; color: var(--color-foreground-secondary, #666);">Rules</div>
          </div>
          
          <div style="text-align: center; padding: 8px; background: var(--color-background, white); border-radius: 4px;">
            <div style="font-size: 16px; font-weight: 700; color: var(--color-success, #28a745);">${stats.domElements}</div>
            <div style="font-size: 10px; color: var(--color-foreground-secondary, #666);">DOM</div>
          </div>
          
          <div style="text-align: center; padding: 8px; background: var(--color-background, white); border-radius: 4px;">
            <div style="font-size: 16px; font-weight: 700; color: ${stats.conflictFiles > 0 ? 'var(--color-danger, #dc3545)' : 'var(--color-success, #28a745)'};">${stats.conflictFiles}</div>
            <div style="font-size: 10px; color: var(--color-foreground-secondary, #666);">Conflicts</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render range distribution chart
   */
  renderRangeDistribution(stats) {
    const maxCount = Math.max(...Object.values(stats.globalRangeDistribution), 1);
    
    return `
      <div style="padding: 16px; border-bottom: 1px solid var(--color-border, #e1e5e9);">
        <h5 style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600;">Range Distribution</h5>
        <div style="display: flex; gap: 4px; align-items: end; height: 60px;">
          ${Object.entries(this.zIndexRanges).map(([key, range]) => {
            const count = stats.globalRangeDistribution[key] || 0;
            const height = Math.max((count / maxCount) * 50, count > 0 ? 8 : 2);
            return `
              <div style="
                flex: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
              ">
                <div style="font-size: 10px; font-weight: 600;">${count}</div>
                <div style="
                  width: 100%;
                  height: ${height}px;
                  background: ${range.color};
                  border-radius: 2px;
                  opacity: ${count > 0 ? 1 : 0.3};
                "></div>
                <div style="font-size: 9px; color: var(--color-foreground-secondary, #666); text-align: center; line-height: 1.2;">
                  ${range.name}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render file breakdown
   */
  renderFileBreakdown() {
    const filesWithZIndex = Array.from(this.zIndexData.values())
      .filter(analysis => analysis.zIndexCount > 0)
      .sort((a, b) => b.zIndexCount - a.zIndexCount);

    if (filesWithZIndex.length === 0) {
      return `
        <div style="padding: 16px; text-align: center; color: var(--color-foreground-secondary, #666); font-size: 12px;">
          No z-index rules found in CSS files
        </div>
      `;
    }

    return `
      <div style="padding: 16px; max-height: 200px; overflow-y: auto;">
        <h5 style="margin: 0 0 12px 0; font-size: 12px; font-weight: 600;">Files with Z-Index Rules</h5>
        ${filesWithZIndex.map(analysis => `
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 8px;
            margin-bottom: 4px;
            background: var(--color-background-secondary, #f8f9fa);
            border-radius: 4px;
            font-size: 11px;
          ">
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 500; truncate;">${this.getFileName(analysis.href)}</div>
              ${analysis.hasConflicts ? '<div style="color: var(--color-danger, #dc3545); font-size: 10px;">⚠ Has conflicts</div>' : ''}
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="color: var(--color-primary, #0066cc); font-weight: 600;">${analysis.zIndexCount} rules</span>
              ${analysis.extremeValues.length > 0 ? `<span style="color: var(--color-warning, #ffc107); font-size: 10px;">⚡ ${analysis.extremeValues.length} extreme</span>` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Render quick actions
   */
  renderQuickActions() {
    return `
      <div style="padding: 12px 16px; background: var(--color-background-secondary, #f8f9fa); border-top: 1px solid var(--color-border, #e1e5e9);">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="scan-dom-zindex" style="
            padding: 4px 8px;
            background: var(--color-primary, #0066cc);
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
          ">Scan DOM</button>
          
          <button class="highlight-zindex-elements" style="
            padding: 4px 8px;
            background: var(--color-warning, #ffc107);
            color: black;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
          ">Highlight Elements</button>
          
          <button class="export-zindex-report" style="
            padding: 4px 8px;
            background: var(--color-info, #17a2b8);
            color: white;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 10px;
          ">Export Report</button>
        </div>
      </div>
    `;
  }

  /**
   * Get filename from href
   */
  getFileName(href) {
    if (href.startsWith('inline-style-')) {
      return `Inline Style #${href.split('-')[2]}`;
    }
    try {
      const url = new URL(href);
      return url.pathname.split('/').pop() || 'unknown.css';
    } catch (e) {
      return href.split('/').pop() || 'unknown.css';
    }
  }

  /**
   * Format z-index info for display in CSS file list
   */
  getZIndexInfo(cssFile) {
    const analysis = this.zIndexData.get(cssFile.href);
    if (!analysis || analysis.zIndexCount === 0) {
      return '';
    }

    const parts = [];
    
    // Add rule count
    parts.push(`${analysis.zIndexCount} z-index`);
    
    // Add range info
    const ranges = Object.entries(analysis.rangeDistribution)
      .filter(([key, count]) => count > 0)
      .map(([key, count]) => `${this.zIndexRanges[key]?.name || key}: ${count}`)
      .slice(0, 2); // Limit to 2 ranges
    
    if (ranges.length > 0) {
      parts.push(`(${ranges.join(', ')})`);
    }
    
    // Add warnings
    if (analysis.hasConflicts) {
      parts.push('⚠ conflicts');
    }
    if (analysis.extremeValues.length > 0) {
      parts.push(`⚡ ${analysis.extremeValues.length} extreme`);
    }

    return parts.join(' ');
  }

  /**
   * Setup event listeners for the subpanel
   */
  setupEventListeners(container) {
    container.addEventListener('click', (e) => {
      if (e.target.classList.contains('refresh-zindex-analysis')) {
        this.refreshAnalysis();
      } else if (e.target.classList.contains('scan-dom-zindex')) {
        this.scanDOMElements();
        this.refreshSubPanel();
      } else if (e.target.classList.contains('highlight-zindex-elements')) {
        this.highlightZIndexElements();
      } else if (e.target.classList.contains('export-zindex-report')) {
        this.exportReport();
      }
    });
  }

  /**
   * Refresh the analysis
   */
  refreshAnalysis() {
    // This will be called by the parent CSS Files Panel
    console.log('[ZIndexAnalyzer] Refreshing z-index analysis...');
    // Trigger parent panel refresh
    const refreshEvent = new CustomEvent('css-files-refresh');
    document.dispatchEvent(refreshEvent);
  }

  /**
   * Refresh just the subpanel
   */
  refreshSubPanel() {
    const subpanel = document.querySelector('.z-index-subpanel');
    if (subpanel) {
      const parent = subpanel.parentElement;
      subpanel.outerHTML = this.renderSubPanel();
      
      if (parent) {
        const newSubpanel = parent.querySelector('.z-index-subpanel');
        if (newSubpanel) {
          this.setupEventListeners(newSubpanel);
        }
      }
    }
  }

  /**
   * Highlight elements with z-index in the DOM
   */
  highlightZIndexElements() {
    // Remove existing highlights
    document.querySelectorAll('.zindex-highlight').forEach(el => {
      el.classList.remove('zindex-highlight');
    });
    
    // Add highlight styles
    if (!document.getElementById('zindex-highlight-styles')) {
      const styles = document.createElement('style');
      styles.id = 'zindex-highlight-styles';
      styles.textContent = `
        .zindex-highlight {
          outline: 2px solid #ff6b6b !important;
          outline-offset: 1px !important;
          background: rgba(255, 107, 107, 0.1) !important;
        }
      `;
      document.head.appendChild(styles);
    }
    
    // Scan and highlight
    this.scanDOMElements();
    this.globalZIndexElements.forEach((info, element) => {
      element.classList.add('zindex-highlight');
    });
    
    // Remove highlights after 3 seconds
    setTimeout(() => {
      document.querySelectorAll('.zindex-highlight').forEach(el => {
        el.classList.remove('zindex-highlight');
      });
    }, 3000);
  }

  /**
   * Export z-index analysis report
   */
  exportReport() {
    const stats = this.generateStats();
    const allAnalyses = Array.from(this.zIndexData.values());
    
    let report = 'Z-Index Analysis Report\n';
    report += '=====================\n\n';
    
    report += `Summary:\n`;
    report += `- Total CSS Files: ${stats.totalFiles}\n`;
    report += `- Files with Z-Index: ${stats.filesWithZIndex}\n`;
    report += `- Total Z-Index Rules: ${stats.totalRules}\n`;
    report += `- DOM Elements with Z-Index: ${stats.domElements}\n`;
    report += `- Files with Conflicts: ${stats.conflictFiles}\n\n`;
    
    report += `Range Distribution:\n`;
    Object.entries(stats.globalRangeDistribution).forEach(([key, count]) => {
      if (count > 0) {
        const range = this.zIndexRanges[key];
        report += `- ${range?.name || key}: ${count} rules\n`;
      }
    });
    report += '\n';
    
    report += `Files with Z-Index Rules:\n`;
    allAnalyses.filter(a => a.zIndexCount > 0).forEach(analysis => {
      report += `\n${this.getFileName(analysis.href)}:\n`;
      report += `  - Rules: ${analysis.zIndexCount}\n`;
      if (analysis.hasConflicts) report += `  - Has conflicts\n`;
      if (analysis.extremeValues.length > 0) report += `  - Extreme values: ${analysis.extremeValues.length}\n`;
      
      analysis.zIndexRules.forEach(rule => {
        report += `    ${rule.selector}: z-index: ${rule.zIndex} (${rule.range.name})\n`;
      });
    });
    
    // Create download
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'zindex-analysis-report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Clear all data
   */
  clear() {
    this.zIndexData.clear();
    this.globalZIndexElements.clear();
    this.conflicts = [];
    this.recommendations = [];
  }
} 