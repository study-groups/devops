/**
 * CSS File Renderer
 * Handles rendering of CSS file components and UI
 */

import { CssFileUtils } from '../utils/CssFileUtils.js';

export class CssFileRenderer {
  /**
   * Render summary section
   */
  static renderSummarySection(stats) {
    return `
      <div style="
        background: var(--color-background-secondary, #f8f9fa); 
        border: 1px solid var(--color-border, #e1e5e9);
        padding: 20px; 
        border-radius: 6px; 
        margin-bottom: 24px;
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--color-text, var(--color-foreground));">CSS Files Overview</h3>
          <div style="display: flex; gap: 8px;">
            <button class="refresh-css-btn" style="
              background: var(--color-primary); 
              color: var(--color-primary-foreground); 
              border: 1px solid var(--color-primary); 
              padding: var(--space-2) var(--space-4); 
              border-radius: var(--radius-md); 
              cursor: pointer; 
              font-size: var(--font-size-sm);
              font-weight: var(--font-weight-medium);
              transition: var(--transition-all);
            " onmouseover="this.style.background='var(--color-primary-hover)'; this.style.borderColor='var(--color-primary-hover)'" onmouseout="this.style.background='var(--color-primary)'; this.style.borderColor='var(--color-primary)'">
              Refresh
            </button>
            <button class="report-css-btn" style="
              background: var(--color-background-secondary);
              color: var(--color-foreground);
              border: 1px solid var(--color-border);
              padding: var(--space-2) var(--space-4);
              border-radius: var(--radius-md);
              cursor: pointer;
              font-size: var(--font-size-sm);
              font-weight: var(--font-weight-medium);
              transition: var(--transition-all);
            " onmouseover="this.style.background='var(--color-background-hover)'; this.style.borderColor='var(--color-border-hover)'" onmouseout="this.style.background='var(--color-background-secondary)'; this.style.borderColor='var(--color-border)'">
              Report
            </button>
            <button class="copy-files-btn" style="
              background: var(--color-info);
              color: var(--color-info-foreground);
              border: 1px solid var(--color-info);
              padding: var(--space-2) var(--space-4);
              border-radius: var(--radius-md);
              cursor: pointer;
              font-size: var(--font-size-sm);
              font-weight: var(--font-weight-medium);
              transition: var(--transition-all);
            " onmouseover="this.style.background='var(--color-info-background)'; this.style.color='var(--color-info)'" onmouseout="this.style.background='var(--color-info)'; this.style.color='var(--color-info-foreground)'">
              Copy Files
            </button>
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;">
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-primary, #0066cc); margin-bottom: 4px;">${stats.total}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">Total</div>
          </div>
          
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-success); margin-bottom: 4px;">${stats.enabled}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">Active</div>
          </div>
          
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-warning); margin-bottom: 4px;">${stats.disabled}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">Disabled</div>
          </div>
          
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-foreground-secondary); margin-bottom: 4px;">${stats.theme}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">Theme</div>
          </div>
          
          <div style="
            text-align: center; 
            padding: 12px 8px; 
            background: var(--color-background, white); 
            border: 1px solid var(--color-border, #e1e5e9);
            border-radius: 4px;
          ">
            <div style="font-size: 20px; font-weight: 700; color: var(--color-foreground-secondary); margin-bottom: 4px;">${stats.system}</div>
            <div style="font-size: 11px; color: var(--color-foreground-secondary, #666); font-weight: 500;">System</div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render categorized file list
   */
  static renderCategorizedFileList(fileManager) {
    const themeFiles = fileManager.getFilesByType('theme');
    const systemFiles = fileManager.getFilesByType('system');
    const allFiles = fileManager.getAllFiles();
    const appFiles = allFiles.filter(([h, f]) => f.isApp);
    const inlineStyles = allFiles.filter(([h, f]) => f.type === 'inline');
    const otherFiles = allFiles.filter(([h, f]) => !f.isTheme && !f.isSystem && !f.isApp && f.type !== 'inline');

    return `
      <div class="css-files-sections">
        ${this.renderCategory('Theme', themeFiles, 'theme')}
        ${this.renderCategory('System & Frameworks', systemFiles, 'system')}
        ${this.renderCategory('Application', appFiles, 'app')}
        ${this.renderCategory('Inline Styles', inlineStyles, 'inline')}
        ${this.renderCategory('Other', otherFiles, 'other')}
      </div>
    `;
  }

  /**
   * Render a category of CSS files
   */
  static renderCategory(title, files, categoryId) {
    if (!files || files.length === 0) return '';

    // Handle both Map (from fileManager.getFilesByType) and Array (from filters)
    const filesList = (files instanceof Map ? Array.from(files.entries()) : files)
      .map(([href, cssFile]) => this.renderCssFileItem(href, cssFile))
      .join('');

    return `
      <div class="css-category" style="margin-bottom: var(--space-4);">
        <h4 style="
          margin: 0 0 var(--space-2) 0; 
          font-size: var(--font-size-sm); 
          font-weight: var(--font-weight-semibold);
          color: var(--color-foreground); 
          padding: var(--space-2) var(--space-3);
          background: var(--color-background-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md) var(--radius-md) 0 0;
        ">
          ${title} (${files instanceof Map ? files.size : files.length})
        </h4>
        <div style="border: 1px solid var(--color-border); border-top: none; border-radius: 0 0 var(--radius-md) var(--radius-md); overflow: hidden;">
          ${filesList}
        </div>
      </div>
    `;
  }

  /**
   * Render individual CSS file item - compact design
   */
  static renderCssFileItem(href, cssFile) {
    const fileName = CssFileUtils.getFileNameFromPath(href);
    const isDisabled = cssFile.disabled;
    
    return `
      <div class="css-file-item" data-href="${href}" style="
        border-bottom: 1px solid var(--color-border); 
        background: var(--color-background-elevated); 
        transition: var(--transition-all);
        ${isDisabled ? 'opacity: 0.7; background: var(--color-background-secondary);' : ''}
      ">
        <div style="
          padding: var(--space-3); 
          display: flex; 
          justify-content: space-between; 
          align-items: center;
          gap: var(--space-3);
        " onmouseover="if(!${isDisabled}) this.style.background='var(--color-background-hover)'" onmouseout="this.style.background='transparent'">
        
        <div style="flex: 1; min-width: 0; display: flex; align-items: center; gap: var(--space-3);">
          <!-- Status indicator -->
          <div style="
            width: 6px; 
            height: 6px; 
            border-radius: 50%; 
            background: ${cssFile.type === 'external' ? 'var(--color-info)' : 'var(--color-warning)'};
            flex-shrink: 0;
          "></div>
          
          <!-- File info with badges on same row -->
          <div style="flex: 1; min-width: 0;">
            <div style="
              display: flex; 
              justify-content: space-between; 
              align-items: center; 
              gap: var(--space-2);
              margin-bottom: var(--space-1);
            ">
              <div style="
                font-weight: var(--font-weight-medium); 
                font-size: var(--font-size-sm); 
                color: var(--color-foreground);
                ${isDisabled ? 'text-decoration: line-through; color: var(--color-foreground-muted);' : ''}
                flex: 1;
                min-width: 0;
              ">
                ${fileName}
              </div>
              
              <!-- Compact badges on same row -->
              <div style="display: flex; flex-wrap: wrap; gap: var(--space-1); align-items: center; flex-shrink: 0;">
                <span style="
                  padding: 1px var(--space-1); 
                  background: ${cssFile.type === 'external' ? 'var(--color-info-background)' : 'var(--color-warning-background)'}; 
                  color: ${cssFile.type === 'external' ? 'var(--color-info)' : 'var(--color-warning)'}; 
                  border-radius: var(--radius-xs); 
                  font-size: var(--font-size-xs);
                  font-weight: var(--font-weight-medium);
                  text-transform: uppercase;
                ">
                  ${cssFile.type}
                </span>
                
                ${cssFile.ruleCount === -1 ? `
                  <span style="
                    padding: 1px var(--space-1); 
                    background: var(--color-warning-background); 
                    color: var(--color-warning); 
                    border-radius: var(--radius-xs); 
                    font-size: var(--font-size-xs);
                  ">
                    CORS
                  </span>
                ` : cssFile.ruleCount > 0 ? `
                  <span style="
                    padding: 1px var(--space-1); 
                    background: var(--color-success-background); 
                    color: var(--color-success); 
                    border-radius: var(--radius-xs); 
                    font-size: var(--font-size-xs);
                  ">
                    ${cssFile.ruleCount} rules
                  </span>
                ` : ''}
                
                ${cssFile.loadOrder ? `
                  <span style="
                    padding: 1px var(--space-1); 
                    background: var(--color-primary-background); 
                    color: var(--color-primary); 
                    border-radius: var(--radius-xs); 
                    font-size: var(--font-size-xs);
                    font-weight: var(--font-weight-medium);
                  ">
                    #${cssFile.loadOrder}
                  </span>
                ` : ''}
                
                ${cssFile.isLoaded === false ? `
                  <span style="
                    padding: 1px var(--space-1); 
                    background: var(--color-error-background); 
                    color: var(--color-error); 
                    border-radius: var(--radius-xs); 
                    font-size: var(--font-size-xs);
                    font-weight: var(--font-weight-medium);
                  ">
                    FAILED
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
        
        <!-- Actions -->
        <div style="display: flex; align-items: center; gap: var(--space-2); flex-shrink: 0;">
          <label style="display: flex; align-items: center; cursor: pointer;" title="${isDisabled ? 'Enable CSS file' : 'Disable CSS file'}">
            <input type="checkbox" class="css-toggle-checkbox" data-href="${href}" ${!isDisabled ? 'checked' : ''} style="
              margin: 0;
              width: 16px;
              height: 16px;
              cursor: pointer;
              accent-color: var(--color-primary);
            ">
          </label>
          
          <button class="view-css-btn" data-href="${href}" style="
            background: var(--color-primary); 
            color: var(--color-primary-foreground); 
            border: 1px solid var(--color-primary); 
            padding: var(--space-1) var(--space-2); 
            border-radius: var(--radius-sm); 
            cursor: pointer; 
            font-size: var(--font-size-xs);
            font-weight: var(--font-weight-medium);
            transition: var(--transition-all);
          " onmouseover="this.style.background='var(--color-primary-hover)'" onmouseout="this.style.background='var(--color-primary)'" title="View CSS content and analysis">
            View
          </button>
        </div>
        </div>
      </div>
    `;
  }
} 