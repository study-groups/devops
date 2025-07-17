/**
 * CSS Analyzer - Analyzes CSS properties, selectors, and finds affected elements
 */

export class CssAnalyzer {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Find elements affected by a CSS file
   */
  async findAffectedElements(href) {
    try {
      // Check cache first
      if (this.cache.has(href)) {
        return this.cache.get(href);
      }

      let cssText;
      
      if (href.startsWith('<style')) {
        // Inline style
        const styleElements = document.querySelectorAll('style');
        const index = parseInt(href.match(/\d+/)?.[0] || '0') - 1;
        const styleElement = styleElements[index];
        cssText = styleElement ? (styleElement.textContent || styleElement.innerHTML) : '';
      } else {
        // External CSS file
        const response = await fetch(href);
        cssText = await response.text();
      }

      const affectedElements = this.analyzeAffectedElements(cssText);
      
      // Cache the result
      this.cache.set(href, affectedElements);
      
      return affectedElements;
      
    } catch (error) {
      console.error('[CssAnalyzer] Error finding affected elements:', error);
      return [];
    }
  }

  /**
   * Analyze CSS text to find affected elements
   */
  analyzeAffectedElements(cssText) {
    const elements = [];
    
    try {
      // Extract CSS rules using regex
      const ruleMatches = cssText.match(/[^{}]+\{[^{}]*\}/g) || [];
      
      ruleMatches.forEach(rule => {
        const selectorMatch = rule.match(/^([^{]+)\{/);
        const propertiesMatch = rule.match(/\{([^}]*)\}/);
        
        if (selectorMatch && propertiesMatch) {
          const selectors = selectorMatch[1].split(',').map(s => s.trim());
          const properties = this.extractProperties(propertiesMatch[1]);
          
          selectors.forEach(selector => {
            // Skip CSS at-rules and comments
            if (selector.startsWith('@') || selector.startsWith('/*')) {
              return;
            }
            
            // Clean up selector
            const cleanSelector = selector.trim();
            if (cleanSelector && this.isValidSelector(cleanSelector)) {
              elements.push({
                selector: cleanSelector,
                properties: properties,
                specificity: this.calculateSpecificity(cleanSelector),
                elementCount: this.countMatchingElements(cleanSelector)
              });
            }
          });
        }
      });
      
    } catch (error) {
      console.error('[CssAnalyzer] Error analyzing CSS:', error);
    }
    
    return elements.sort((a, b) => b.elementCount - a.elementCount);
  }

  /**
   * Extract CSS properties from a rule
   */
  extractProperties(propertiesText) {
    const properties = [];
    const propertyMatches = propertiesText.match(/[^;]+:[^;]+/g) || [];
    
    propertyMatches.forEach(prop => {
      const [property, value] = prop.split(':').map(s => s.trim());
      if (property && value) {
        properties.push(`${property}: ${value}`);
      }
    });
    
    return properties;
  }

  /**
   * Check if a selector is valid
   */
  isValidSelector(selector) {
    try {
      document.querySelector(selector);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Count elements matching a selector
   */
  countMatchingElements(selector) {
    try {
      return document.querySelectorAll(selector).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Calculate CSS specificity
   */
  calculateSpecificity(selector) {
    let specificity = { ids: 0, classes: 0, elements: 0 };
    
    // Count IDs
    const idMatches = selector.match(/#[^\s\+>~\.\[:]*/g);
    if (idMatches) specificity.ids = idMatches.length;
    
    // Count classes, attributes, and pseudo-classes
    const classMatches = selector.match(/(\.[^\s\+>~\#\[:]*|\[[^\]]*\]|:[^\s\+>~\.\#\[]*)/g);
    if (classMatches) specificity.classes = classMatches.length;
    
    // Count elements and pseudo-elements
    const elementMatches = selector.match(/[a-zA-Z][a-zA-Z0-9]*|::?[a-zA-Z][a-zA-Z0-9-]*/g);
    if (elementMatches) {
      // Filter out classes and IDs that might be caught
      const actualElements = elementMatches.filter(match => 
        !match.startsWith('.') && !match.startsWith('#') && !match.startsWith(':')
      );
      specificity.elements = actualElements.length;
    }
    
    return specificity;
  }

  /**
   * Get specificity score
   */
  getSpecificityScore(specificity) {
    return specificity.ids * 100 + specificity.classes * 10 + specificity.elements;
  }

  /**
   * Analyze CSS variables usage
   */
  analyzeCssVariables(cssText) {
    const variables = {
      defined: [],
      used: []
    };
    
    // Find CSS variable definitions
    const defineMatches = cssText.match(/--[a-zA-Z0-9-_]+\s*:\s*[^;]+/g) || [];
    defineMatches.forEach(match => {
      const [name, value] = match.split(':').map(s => s.trim());
      variables.defined.push({ name, value });
    });
    
    // Find CSS variable usage
    const useMatches = cssText.match(/var\(--[a-zA-Z0-9-_]+[^)]*\)/g) || [];
    useMatches.forEach(match => {
      const varName = match.match(/--[a-zA-Z0-9-_]+/)?.[0];
      if (varName && !variables.used.includes(varName)) {
        variables.used.push(varName);
      }
    });
    
    return variables;
  }

  /**
   * Analyze media queries
   */
  analyzeMediaQueries(cssText) {
    const mediaQueries = [];
    const mediaMatches = cssText.match(/@media[^{]+\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g) || [];
    
    mediaMatches.forEach(match => {
      const conditionMatch = match.match(/@media\s+([^{]+)/);
      if (conditionMatch) {
        const condition = conditionMatch[1].trim();
        const content = match.match(/\{([\s\S]*)\}$/)?.[1] || '';
        
        mediaQueries.push({
          condition,
          content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
          fullContent: content
        });
      }
    });
    
    return mediaQueries;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[CssAnalyzer] Cache cleared');
  }

  /**
   * Destroy the analyzer
   */
  destroy() {
    this.cache.clear();
    console.log('[CssAnalyzer] Destroyed');
  }
} 