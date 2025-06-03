/**
 * LogFilter.js - Filtering logic for log entries
 */

/**
 * LogFilter class to determine which log entries should be displayed
 */
export class LogFilter {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      typeFilters: {
        include: [],
        exclude: []
      },
      subtypeFilters: {
        include: [],
        exclude: []
      },
      levelFilters: {
        include: [],
        exclude: []
      },
      fromFilters: {
        include: [],
        exclude: []
      },
      keywordFilters: {
        include: '',
        exclude: ''
      },
      ...config
    };
  }

  /**
   * Determines whether a log entry should be displayed
   * @param {Object} entry - Log entry to check
   * @returns {boolean} - True if the entry should be displayed
   */
  shouldDisplay(entry) {
    // Universal kill switch
    if (!this.config.enabled) {
      return false;
    }
    
    // Special handling for TIMING level if needed
    if (entry.level === 'TIMING' && this.config.detailedTimingEnabled === false) {
      return false;
    }
    
    // 1. Level filtering
    if (this.config.levelFilters.exclude.length > 0 && 
        this.config.levelFilters.exclude.includes(entry.level)) {
      return false;
    }
    
    if (this.config.levelFilters.include.length > 0 && 
        !this.config.levelFilters.include.includes(entry.level)) {
      return false;
    }
    
    // 2. Type filtering
    if (this.config.typeFilters.exclude.length > 0 && 
        this.config.typeFilters.exclude.includes(entry.type)) {
      return false;
    }
    
    if (this.config.typeFilters.include.length > 0 && 
        !this.config.typeFilters.include.includes(entry.type)) {
      return false;
    }
    
    // 3. Subtype filtering
    if (entry.subtype && this.config.subtypeFilters.exclude.length > 0 && 
        this.config.subtypeFilters.exclude.includes(entry.subtype)) {
      return false;
    }
    
    if (entry.subtype && this.config.subtypeFilters.include.length > 0 && 
        !this.config.subtypeFilters.include.includes(entry.subtype)) {
      return false;
    }

    // 4. From filtering (caller file/line info)
    if (entry.caller && entry.caller.file) {
      if (this.config.fromFilters.exclude.length > 0 && 
          this.config.fromFilters.exclude.includes(entry.caller.file)) {
        return false;
      }
      
      if (this.config.fromFilters.include.length > 0 && 
          !this.config.fromFilters.include.includes(entry.caller.file)) {
        return false;
      }
    }

    // 5. Keyword filtering - Handle both string and array formats
    let excludeKeywords = this.config.keywordFilters.exclude;
    if (Array.isArray(excludeKeywords)) {
      // If it's an array, join it into a string
      excludeKeywords = excludeKeywords.join(' ');
    }

    if (excludeKeywords && excludeKeywords.trim() !== '') {
      const excludeTerms = excludeKeywords.toLowerCase().split(/\s+/).filter(Boolean);
      const messageStr = String(entry.message).toLowerCase();
      
      if (excludeTerms.some(term => messageStr.includes(term))) {
        return false;
      }
    }

    let includeKeywords = this.config.keywordFilters.include;
    if (Array.isArray(includeKeywords)) {
      // If it's an array, join it into a string
      includeKeywords = includeKeywords.join(' ');
    }

    if (includeKeywords && includeKeywords.trim() !== '') {
      const includeTerms = includeKeywords.toLowerCase().split(' ').filter(k => k);
      const messageForKeywordCheck = `${entry.level} ${entry.type} ${entry.subtype || ''} ${entry.message} ${entry.caller?.file || ''}`.toLowerCase();
      
      if (!includeTerms.some(keyword => messageForKeywordCheck.includes(keyword))) {
        return false;
      }
    }
    
    // If the entry passed all filters, return true
    return true;
  }

  /**
   * Sets the global enabled state
   * @param {boolean} enabled - Whether logging is enabled
   */
  setEnabled(enabled) {
    this.config.enabled = Boolean(enabled);
    return this;
  }

  /**
   * Sets the detailed timing enabled state
   * @param {boolean} enabled - Whether detailed timing is enabled
   */
  setDetailedTimingEnabled(enabled) {
    this.config.detailedTimingEnabled = Boolean(enabled);
    return this;
  }

  /**
   * Sets the types to include in console logs
   * @param {Array} types - Array of type strings to include
   */
  setIncludeTypes(types) {
    this.config.typeFilters.include = Array.isArray(types) ? [...types] : [];
    return this;
  }

  /**
   * Sets the types to exclude from console logs
   * @param {Array} types - Array of type strings to exclude
   */
  setExcludeTypes(types) {
    this.config.typeFilters.exclude = Array.isArray(types) ? [...types] : [];
    return this;
  }

  /**
   * Sets the subtypes to include in console logs
   * @param {Array} subtypes - Array of subtype strings to include
   */
  setIncludeSubtypes(subtypes) {
    this.config.subtypeFilters.include = Array.isArray(subtypes) ? [...subtypes] : [];
    return this;
  }

  /**
   * Sets the subtypes to exclude from console logs
   * @param {Array} subtypes - Array of subtype strings to exclude
   */
  setExcludeSubtypes(subtypes) {
    this.config.subtypeFilters.exclude = Array.isArray(subtypes) ? [...subtypes] : [];
    return this;
  }

  /**
   * Sets the log levels to include in console logs
   * @param {Array} levels - Array of level strings to include
   */
  setIncludeLevels(levels) {
    this.config.levelFilters.include = Array.isArray(levels) ? [...levels] : [];
    return this;
  }

  /**
   * Sets the log levels to exclude from console logs
   * @param {Array} levels - Array of level strings to exclude
   */
  setExcludeLevels(levels) {
    this.config.levelFilters.exclude = Array.isArray(levels) ? [...levels] : [];
    return this;
  }

  /**
   * Sets the "from" (source files) to include in console logs
   * @param {Array} sources - Array of source file strings to include
   */
  setIncludeFrom(sources) {
    this.config.fromFilters.include = Array.isArray(sources) ? [...sources] : [];
    return this;
  }

  /**
   * Sets the "from" (source files) to exclude from console logs
   * @param {Array} sources - Array of source file strings to exclude
   */
  setExcludeFrom(sources) {
    this.config.fromFilters.exclude = Array.isArray(sources) ? [...sources] : [];
    return this;
  }

  /**
   * Sets keywords to include in logs (space-separated)
   * @param {string} keywords - Space-separated keywords to include
   */
  setIncludeKeywords(keywords) {
    this.config.keywordFilters.include = keywords || '';
    return this;
  }

  /**
   * Sets keywords to exclude from logs (space-separated)
   * @param {string} keywords - Space-separated keywords to exclude
   */
  setExcludeKeywords(keywords) {
    this.config.keywordFilters.exclude = keywords || '';
    return this;
  }

  /**
   * Clears all filters
   */
  clearAllFilters() {
    this.config.typeFilters.include = [];
    this.config.typeFilters.exclude = [];
    this.config.subtypeFilters.include = [];
    this.config.subtypeFilters.exclude = [];
    this.config.levelFilters.include = [];
    this.config.levelFilters.exclude = [];
    this.config.fromFilters.include = [];
    this.config.fromFilters.exclude = [];
    this.config.keywordFilters.include = '';
    this.config.keywordFilters.exclude = '';
    return this;
  }

  /**
   * Gets the current filter configuration
   * @returns {Object} - The filter configuration
   */
  getConfig() {
    return { ...this.config };
  }
} 