/**
 * AppLogFilter.js - Filtering logic for application log entries
 * Renamed from LogFilter.js and simplified by removing subtype functionality
 */

/**
 * AppLogFilter class to determine which application log entries should be displayed
 */
export class AppLogFilter {
  constructor(config = {}) {
    this.config = {
      enabled: true,
      typeFilters: {
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
   * Determines whether an application log entry should be displayed
   * @param {Object} entry - Application log entry to check
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

    // 3. From filtering (caller file/line info)
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

    // 4. Keyword filtering - Handle both string and array formats
    let excludeKeywords = this.config.keywordFilters.exclude;
    if (Array.isArray(excludeKeywords)) {
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
      includeKeywords = includeKeywords.join(' ');
    }

    if (includeKeywords && includeKeywords.trim() !== '') {
      const includeTerms = includeKeywords.toLowerCase().split(' ').filter(k => k);
      const messageForKeywordCheck = `${entry.level} ${entry.type} ${entry.message} ${entry.caller?.file || ''}`.toLowerCase();
      
      if (!includeTerms.some(keyword => messageForKeywordCheck.includes(keyword))) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Sets the global enabled state
   * @param {boolean} enabled - Whether application logging is enabled
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
   * Sets the types to include in application logs
   * @param {Array} types - Array of type strings to include
   */
  setIncludeTypes(types) {
    this.config.typeFilters.include = Array.isArray(types) ? [...types] : [];
    return this;
  }

  /**
   * Sets the types to exclude from application logs
   * @param {Array} types - Array of type strings to exclude
   */
  setExcludeTypes(types) {
    this.config.typeFilters.exclude = Array.isArray(types) ? [...types] : [];
    return this;
  }

  /**
   * Sets the log levels to include in application logs
   * @param {Array} levels - Array of level strings to include
   */
  setIncludeLevels(levels) {
    this.config.levelFilters.include = Array.isArray(levels) ? [...levels] : [];
    return this;
  }

  /**
   * Sets the log levels to exclude from application logs
   * @param {Array} levels - Array of level strings to exclude
   */
  setExcludeLevels(levels) {
    this.config.levelFilters.exclude = Array.isArray(levels) ? [...levels] : [];
    return this;
  }

  /**
   * Sets the "from" (source files) to include in application logs
   * @param {Array} sources - Array of source file strings to include
   */
  setIncludeFrom(sources) {
    this.config.fromFilters.include = Array.isArray(sources) ? [...sources] : [];
    return this;
  }

  /**
   * Sets the "from" (source files) to exclude from application logs
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
    this.config.levelFilters.include = [];
    this.config.levelFilters.exclude = [];
    this.config.fromFilters.include = [];
    this.config.fromFilters.exclude = [];
    this.config.keywordFilters.include = '';
    this.config.keywordFilters.exclude = '';
    return this;
  }

  /**
   * Get the current configuration
   * @returns {Object} - Filter configuration
   */
  getConfig() {
    return { ...this.config };
  }
} 