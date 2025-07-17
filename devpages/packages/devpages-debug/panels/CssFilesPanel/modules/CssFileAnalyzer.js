/**
 * CSS File Analyzer
 * Handles CSS file analysis and debugging functionality
 */

import { CssFileUtils } from '../utils/CssFileUtils.js';

export class CssFileAnalyzer {
  constructor() {
    this.cssRuleCache = new Map(); // Cache for computed styles
  }

  /**
   * Analyze CSS file for debugging information
   */
  async analyzeCssFile(cssFile) {
    const analysis = {
      rules: [],
      selectorCount: 0,
      propertyCount: 0,
      importantCount: 0,
      mediaQueries: [],
      keyframes: [],
      specificity: []
    };

    try {
      if (cssFile.element && cssFile.element.sheet) {
        const sheet = cssFile.element.sheet;
        const rules = CssFileUtils.safeGetCssRules(sheet);
        
        analysis.rules = rules;
        analysis.corsRestricted = rules.length === 0 && cssFile.ruleCount === -1;
        
        rules.forEach(rule => {
          if (rule.type === CSSRule.STYLE_RULE) {
            const selector = rule.selectorText;
            const properties = Array.from(rule.style);
            
            analysis.selectorCount++;
            analysis.propertyCount += properties.length;
            
            // Count !important declarations
            properties.forEach(prop => {
              if (rule.style.getPropertyPriority(prop) === 'important') {
                analysis.importantCount++;
              }
            });
            
            // Calculate specificity
            const specificity = CssFileUtils.calculateSpecificity(selector);
            analysis.specificity.push({
              selector,
              specificity: specificity.toString(),
              properties: properties.length
            });
            
          } else if (rule.type === CSSRule.MEDIA_RULE) {
            analysis.mediaQueries.push(rule.conditionText || rule.media.mediaText);
          } else if (rule.type === CSSRule.KEYFRAMES_RULE) {
            analysis.keyframes.push(rule.name);
          }
        });
        
        // Sort by specificity (descending)
        analysis.specificity.sort((a, b) => {
          const aSpec = CssFileUtils.calculateSpecificity(a.selector);
          const bSpec = CssFileUtils.calculateSpecificity(b.selector);
          return bSpec.total - aSpec.total;
        });
        
      }
    } catch (error) {
      console.warn('CSS analysis failed:', error);
    }

    return analysis;
  }

  /**
   * Get CSS file content for viewing
   */
  async getCssFileContent(cssFile, href) {
    if (cssFile.type === 'inline') {
      const content = cssFile.content || cssFile.element.textContent || cssFile.element.innerHTML;
      return content.trim() || '/* Empty inline style block */';
    } else {
      try {
        const response = await fetch(href, { credentials: 'include' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return await response.text();
      } catch (error) {
        return `/* Error loading CSS file: ${error.message} */\n\n/* This could be due to:\n - CORS restrictions\n - Network issues\n - File not found\n - Server error */`;
      }
    }
  }

  /**
   * Generate analysis sidebar content
   */
  generateAnalysisSidebar(cssFile, analysis) {
    const fileName = CssFileUtils.getFileNameFromPath(cssFile.href);

    return `
      <div style="
        background: var(--color-background-elevated); 
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md); 
        padding: var(--space-3);
        overflow-y: auto;
      ">
        <h4 style="margin: 0 0 var(--space-3) 0; color: var(--color-foreground); font-size: var(--font-size-sm);">Analysis</h4>
        
        <!-- File Stats -->
        <div style="margin-bottom: var(--space-3); padding: var(--space-2); background: var(--color-background-secondary); border-radius: var(--radius-sm);">
          <div style="font-size: var(--font-size-xs); line-height: 1.4;">
            <div><strong>Type:</strong> ${cssFile.type}</div>
            <div><strong>Media:</strong> ${cssFile.media}</div>
            <div><strong>Load Order:</strong> #${cssFile.loadOrder || 'N/A'}</div>
            <div><strong>Status:</strong> ${cssFile.disabled ? 'Disabled' : 'Active'}</div>
            <div><strong>Rules:</strong> ${cssFile.ruleCount === -1 ? 'CORS Restricted' : (cssFile.ruleCount || 0)}</div>
          </div>
        </div>

        ${analysis.corsRestricted ? `
          <div style="padding: var(--space-2); background: var(--color-warning-background); color: var(--color-warning); border-radius: var(--radius-sm); font-size: var(--font-size-xs); margin-bottom: var(--space-3);">
            <strong>CORS Policy:</strong> External file analysis limited by browser security
          </div>
        ` : analysis.rules.length > 0 ? `
          <!-- CSS Stats -->
          <div style="margin-bottom: var(--space-3);">
            <h5 style="margin: 0 0 var(--space-2) 0; font-size: var(--font-size-xs); color: var(--color-foreground-secondary);">CSS STATISTICS</h5>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-1); font-size: var(--font-size-xs);">
              <div>Rules: ${analysis.rules.length}</div>
              <div>Selectors: ${analysis.selectorCount}</div>
              <div>Properties: ${analysis.propertyCount}</div>
              <div>!important: ${analysis.importantCount}</div>
              <div>@media: ${analysis.mediaQueries.length}</div>
              <div>@keyframes: ${analysis.keyframes.length}</div>
            </div>
          </div>

          ${analysis.specificity.length > 0 ? `
            <!-- Top Specificity -->
            <div style="margin-bottom: var(--space-3);">
              <h5 style="margin: 0 0 var(--space-2) 0; font-size: var(--font-size-xs); color: var(--color-foreground-secondary);">HIGH SPECIFICITY</h5>
              <div style="font-size: var(--font-size-xs); font-family: var(--font-family-mono); max-height: 120px; overflow-y: auto;">
                ${analysis.specificity.slice(0, 5).map(item => `
                  <div style="margin-bottom: var(--space-1); padding: var(--space-1); background: var(--color-background-secondary); border-radius: var(--radius-xs); border-left: 2px solid var(--color-primary);">
                    <div style="font-weight: var(--font-weight-medium); color: var(--color-primary); margin-bottom: 1px; word-break: break-all;">${item.selector.length > 25 ? item.selector.substring(0, 25) + '...' : item.selector}</div>
                    <div style="color: var(--color-foreground-secondary);">${item.specificity}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${analysis.mediaQueries.length > 0 ? `
            <!-- Media Queries -->
            <div style="margin-bottom: var(--space-3);">
              <h5 style="margin: 0 0 var(--space-2) 0; font-size: var(--font-size-xs); color: var(--color-foreground-secondary);">MEDIA QUERIES</h5>
              <div style="font-size: var(--font-size-xs); font-family: var(--font-family-mono); max-height: 100px; overflow-y: auto;">
                ${analysis.mediaQueries.slice(0, 3).map(mq => `
                  <div style="margin-bottom: var(--space-1); padding: var(--space-1); background: var(--color-background-secondary); border-radius: var(--radius-xs);">
                    ${mq.length > 30 ? mq.substring(0, 30) + '...' : mq}
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        ` : '<div style="font-size: var(--font-size-xs); color: var(--color-foreground-muted);">No rules found</div>'}
        
        <div style="padding: var(--space-2); background: var(--color-info-background); color: var(--color-info); border-radius: var(--radius-sm); font-size: var(--font-size-xs);">
          <strong>Tip:</strong> Higher specificity = higher cascade priority. Rules with equal specificity are resolved by load order.
        </div>
      </div>
    `;
  }
} 