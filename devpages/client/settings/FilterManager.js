// FilterManager.js
// Centralized manager for console log filters (types, levels, keywords - no subtypes)

const STORAGE_KEYS = {
  typeInclude: 'consoleTypeFiltersInclude',
  typeExclude: 'consoleTypeFiltersExclude',
  levelInclude: 'consoleLevelFiltersInclude',
  levelExclude: 'consoleLevelFiltersExclude',
  keywordInclude: 'consoleKeywordFiltersInclude',
  keywordExclude: 'consoleKeywordFiltersExclude',
};

function loadArray(key) {
  try {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : [];
  } catch {
    return [];
  }
}

function saveArray(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

const FilterManager = {
  // --- Types ---
  getIncludeTypes() { return loadArray(STORAGE_KEYS.typeInclude); },
  setIncludeTypes(arr) { saveArray(STORAGE_KEYS.typeInclude, arr); },
  getExcludeTypes() { return loadArray(STORAGE_KEYS.typeExclude); },
  setExcludeTypes(arr) { saveArray(STORAGE_KEYS.typeExclude, arr); },



  // --- Levels ---
  getIncludeLevels() { return loadArray(STORAGE_KEYS.levelInclude); },
  setIncludeLevels(arr) { saveArray(STORAGE_KEYS.levelInclude, arr); },
  getExcludeLevels() { return loadArray(STORAGE_KEYS.levelExclude); },
  setExcludeLevels(arr) { saveArray(STORAGE_KEYS.levelExclude, arr); },

  // --- Keywords ---
  getIncludeKeywords() { return loadArray(STORAGE_KEYS.keywordInclude); },
  setIncludeKeywords(arr) { saveArray(STORAGE_KEYS.keywordInclude, arr); },
  getExcludeKeywords() { return loadArray(STORAGE_KEYS.keywordExclude); },
  setExcludeKeywords(arr) { saveArray(STORAGE_KEYS.keywordExclude, arr); },

  // --- Bulk load/save ---
  loadAllFilters() {
    return {
      typeFilters: {
        include: this.getIncludeTypes(),
        exclude: this.getExcludeTypes(),
      },
      levelFilters: {
        include: this.getIncludeLevels(),
        exclude: this.getExcludeLevels(),
      },
      keywordFilters: {
        include: this.getIncludeKeywords(),
        exclude: this.getExcludeKeywords(),
      },
    };
  },

  clearAllFilters() {
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  }
};

export default FilterManager; 