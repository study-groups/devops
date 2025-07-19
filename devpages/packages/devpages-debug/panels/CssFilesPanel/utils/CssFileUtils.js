/**
 * CSS File Utilities
 * Common helper methods for CSS file operations
 */

export class CssFileUtils {
  /**
   * Extract filename from URL/path
   */
  static getFileNameFromPath(href) {
    try {
      return new URL(href).pathname.split('/').pop();
    } catch (e) {
      return href;
    }
  }

  /**
   * Get full path for display
   */
  static getFullPath(href, cssFile) {
    return cssFile.type === 'external' ? href : `(Inline Style: ${cssFile.id})`;
  }

  /**
   * Safely get rule count from a stylesheet, handling CORS restrictions
   */
  static safeGetRuleCount(sheet) {
    if (!sheet) return 0;
    
    const href = sheet.href || sheet.ownerNode?.href || '(unknown sheet)';
    console.log(`[CssFileUtils/safeGetRuleCount] Attempting to access rules for: ${href}`);

    try {
      const ruleCount = sheet.cssRules ? sheet.cssRules.length : 0;
      console.log(`[CssFileUtils/safeGetRuleCount] Successfully accessed rules for: ${href}. Count: ${ruleCount}`);
      return ruleCount;
    } catch (error) {
      console.log(`[CssFileUtils/safeGetRuleCount] CAUGHT an error for: ${href}. This is expected for CORS files.`);
      return -1; // Indicate CORS restriction
    }
  }

  /**
   * Safely get CSS rules from a stylesheet, handling CORS restrictions
   */
  static safeGetCssRules(sheet) {
    if (!sheet) return [];
    
    const href = sheet.href || sheet.ownerNode?.href || '(unknown sheet)';
    console.log(`[CssFileUtils/safeGetCssRules] Attempting to access rules for: ${href}`);

    try {
      const rules = Array.from(sheet.cssRules || []);
      console.log(`[CssFileUtils/safeGetCssRules] Successfully accessed rules for: ${href}. Count: ${rules.length}`);
      return rules;
    } catch (error) {
      console.log(`[CssFileUtils/safeGetCssRules] CAUGHT an error for: ${href}. This is expected for CORS files.`);
      return [];
    }
  }

  /**
   * Calculate CSS selector specificity
   */
  static calculateSpecificity(selector) {
    // Simple specificity calculation
    const ids = (selector.match(/#[a-zA-Z][\w-]*/g) || []).length;
    const classes = (selector.match(/\.[a-zA-Z][\w-]*/g) || []).length;
    const attributes = (selector.match(/\[[^\]]*\]/g) || []).length;
    const pseudoClasses = (selector.match(/:(?!:)[a-zA-Z][\w-]*/g) || []).length;
    const elements = (selector.match(/(?:^|[\s>+~])([a-zA-Z][\w-]*)/g) || []).length;
    const pseudoElements = (selector.match(/::[a-zA-Z][\w-]*/g) || []).length;
    
    const specificity = {
      inline: 0, // We don't handle inline styles here
      ids: ids,
      classes: classes + attributes + pseudoClasses,
      elements: elements + pseudoElements,
      total: (ids * 100) + ((classes + attributes + pseudoClasses) * 10) + (elements + pseudoElements)
    };
    
    specificity.toString = () => `(${specificity.inline},${specificity.ids},${specificity.classes},${specificity.elements})`;
    
    return specificity;
  }

  /**
   * Generate statistics about CSS files
   */
  static generateStats(fileManager) {
    return {
      total: fileManager.getAllFiles().length,
      enabled: fileManager.getFilesByStatus(true).length,
      disabled: fileManager.getFilesByStatus(false).length,
      theme: fileManager.getFilesByType('theme').length,
      system: fileManager.getFilesByType('system').length,
      app: fileManager.getFilesByType('other').filter(([h, f]) => f.isApp).length,
      other: fileManager.getFilesByType('other').filter(([h, f]) => !f.isApp).length,
    };
  }

  /**
   * Analyze performance metrics from files
   */
  static analyzePerformance(allFiles) {
    let totalRules = 0;
    let corsFiles = 0;
    let failedFiles = 0;
    let maxLoadOrder = 0;
    
    allFiles.forEach(([href, cssFile]) => {
      if (cssFile.ruleCount === -1) {
        corsFiles++;
      } else {
        totalRules += cssFile.ruleCount || 0;
      }
      
      if (cssFile.isLoaded === false) {
        failedFiles++;
      }
      
      if (cssFile.loadOrder && cssFile.loadOrder > maxLoadOrder) {
        maxLoadOrder = cssFile.loadOrder;
      }
    });
    
    return {
      totalRules,
      corsFiles,
      failedFiles,
      maxLoadOrder
    };
  }

  /**
   * Generate recommendations as plain text array
   */
  static generateRecommendationsText(stats, performanceData, zIndexData) {
    const recommendations = [];
    
    if (stats.disabled > 0) {
      recommendations.push(`Consider removing ${stats.disabled} disabled CSS files to reduce page weight.`);
    }
    
    if (performanceData.corsFiles > 0) {
      recommendations.push(`${performanceData.corsFiles} files are CORS-restricted. Consider self-hosting for better analysis.`);
    }
    
    if (performanceData.failedFiles > 0) {
      recommendations.push(`${performanceData.failedFiles} files failed to load. Check file paths and server availability.`);
    }
    
    if (zIndexData.conflicts.length > 0) {
      recommendations.push(`${zIndexData.conflicts.length} potential z-index conflicts detected. Review layering logic.`);
    }
    
    if (performanceData.totalRules > 1000) {
      recommendations.push(`High rule count (${performanceData.totalRules}). Consider CSS optimization and consolidation.`);
    }
    
    if (stats.total > 20) {
      recommendations.push(`Many CSS files (${stats.total}). Consider bundling for better performance.`);
    }
    
    if (recommendations.length === 0) {
      recommendations.push('No major issues detected. Your CSS setup looks good!');
    }
    
    return recommendations;
  }
} 