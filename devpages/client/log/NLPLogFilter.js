/**
 * NLPLogFilter.js - Natural language based log filtering system
 */

// Import logging utilities if needed
import { logDebug } from './core.js';

// Filter cache to avoid reprocessing the same queries
const queryCache = new Map();

// Default weights for different matching parts
const DEFAULT_WEIGHTS = {
  type: 2.0,      // Log type match (e.g., "BOOTSTRAP", "UI")
  level: 1.5,     // Log level match (e.g., "INFO", "ERROR")
  messageExact: 2.0, // Exact phrase in message
  messagePartial: 1.0, // Partial word match in message
  negative: -5.0  // Negative match (prefixed with NOT or -)
};

/**
 * Parses a natural language query into structured filter rules
 * @param {string} query - The natural language query
 * @returns {Object} Structured filter rules
 */
function parseQuery(query) {
  // Check cache first
  if (queryCache.has(query)) {
    return queryCache.get(query);
  }
  
  const normalizedQuery = query.trim();
  
  // Special case for empty query
  if (!normalizedQuery) {
    return { rules: [], original: query };
  }
  
  // Basic tokenization - split by spaces but keep quoted phrases together
  const tokens = [];
  let currentToken = '';
  let inQuotes = false;
  
  for (let i = 0; i < normalizedQuery.length; i++) {
    const char = normalizedQuery[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
      currentToken += char;
    } else if (char === ' ' && !inQuotes) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }
  
  if (currentToken) {
    tokens.push(currentToken);
  }
  
  // Process tokens into rules
  const rules = [];
  
  for (let token of tokens) {
    // Handle negation
    let isNegative = false;
    if (token.startsWith('-') || token.toLowerCase().startsWith('not ')) {
      isNegative = true;
      token = token.startsWith('-') ? token.slice(1) : token.slice(4);
    }
    
    // Handle quoted phrases
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1);
      rules.push({
        type: 'messageExact',
        value: token,
        weight: isNegative ? DEFAULT_WEIGHTS.negative : DEFAULT_WEIGHTS.messageExact,
        isNegative
      });
      continue;
    }
    
    // Check for specific field prefixes
    if (token.includes(':')) {
      const [field, value] = token.split(':', 2);
      const normalizedField = field.toLowerCase();
      
      if (normalizedField === 'type' || normalizedField === 't') {
        rules.push({
          type: 'type',
          value: value.toUpperCase(),
          weight: isNegative ? DEFAULT_WEIGHTS.negative : DEFAULT_WEIGHTS.type,
          isNegative
        });
      } else if (normalizedField === 'level' || normalizedField === 'l') {
        rules.push({
          type: 'level',
          value: value.toUpperCase(),
          weight: isNegative ? DEFAULT_WEIGHTS.negative : DEFAULT_WEIGHTS.level,
          isNegative
        });
      } else {
        // Default to partial message match for unknown field
        rules.push({
          type: 'messagePartial',
          value: token,
          weight: isNegative ? DEFAULT_WEIGHTS.negative : DEFAULT_WEIGHTS.messagePartial,
          isNegative
        });
      }
      continue;
    }
    
    // Level shortcuts
    if (token.toUpperCase() === 'ERROR' || token.toUpperCase() === 'ERR') {
      rules.push({
        type: 'level',
        value: 'ERROR',
        weight: isNegative ? DEFAULT_WEIGHTS.negative : DEFAULT_WEIGHTS.level,
        isNegative
      });
    } else if (token.toUpperCase() === 'WARN' || token.toUpperCase() === 'WARNING') {
      rules.push({
        type: 'level',
        value: 'WARN',
        weight: isNegative ? DEFAULT_WEIGHTS.negative : DEFAULT_WEIGHTS.level,
        isNegative
      });
    } else if (token.toUpperCase() === 'INFO') {
      rules.push({
        type: 'level',
        value: 'INFO',
        weight: isNegative ? DEFAULT_WEIGHTS.negative : DEFAULT_WEIGHTS.level,
        isNegative
      });
    } else if (token.toUpperCase() === 'DEBUG') {
      rules.push({
        type: 'level',
        value: 'DEBUG',
        weight: isNegative ? DEFAULT_WEIGHTS.negative : DEFAULT_WEIGHTS.level,
        isNegative
      });
    } else {
      // Default to partial message match
      rules.push({
        type: 'messagePartial',
        value: token,
        weight: isNegative ? DEFAULT_WEIGHTS.negative : DEFAULT_WEIGHTS.messagePartial,
        isNegative
      });
    }
  }
  
  const result = { rules, original: query };
  queryCache.set(query, result);
  return result;
}

/**
 * Scores a log entry against filter rules
 * @param {Object} logEntry - The log entry to score
 * @param {Array} rules - The filter rules
 * @returns {number} The match score (higher = better match)
 */
function scoreLogEntry(logEntry, rules) {
  if (!rules || rules.length === 0) {
    return 1; // No rules = show everything
  }
  
  let score = 0;
  let hasPositiveRule = false;
  let hasNegativeMatch = false;
  
  for (const rule of rules) {
    if (!rule.isNegative) {
      hasPositiveRule = true;
    }
    
    let matched = false;
    
    switch (rule.type) {
      case 'type':
        matched = logEntry.type.toUpperCase().includes(rule.value);
        break;
      
      case 'level':
        matched = logEntry.level.toUpperCase() === rule.value;
        break;
      
      case 'messageExact':
        matched = logEntry.message.includes(rule.value);
        break;
      
      case 'messagePartial':
        // For partial, we split into words and check for inclusion
        const words = logEntry.message.toLowerCase().split(/\s+/);
        matched = words.some(word => word.includes(rule.value.toLowerCase()));
        break;
    }
    
    if (matched && rule.isNegative) {
      hasNegativeMatch = true;
    }
    
    if (matched) {
      score += rule.weight;
    }
  }
  
  // Negative rules are strong excludes
  if (hasNegativeMatch) {
    return -999;
  }
  
  // If we have positive rules but no matches, hide the entry
  if (hasPositiveRule && score <= 0) {
    return -1;
  }
  
  return score;
}

/**
 * Filters log entries based on a natural language query
 * @param {Array} logEntries - Array of log entries to filter
 * @param {string} query - The natural language query
 * @returns {Array} Filtered log entries with scores
 */
export function filterLogEntries(logEntries, query) {
  const parsedQuery = parseQuery(query);
  
  // No query or empty query = show all
  if (!query.trim() || parsedQuery.rules.length === 0) {
    return logEntries.map(entry => ({ entry, score: 1 }));
  }
  
  return logEntries
    .map(entry => {
      const score = scoreLogEntry(entry, parsedQuery.rules);
      return { entry, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score); // Sort by score descending
}

/**
 * Applies NLP filter to DOM elements
 * @param {HTMLElement} logElement - The container with log entries
 * @param {string} query - The filter query
 * @returns {number} Number of visible entries after filtering
 */
export function applyNLPFilter(logElement, query) {
  if (!logElement) return 0;
  
  const allEntries = logElement.querySelectorAll('.log-entry');
  
  // If empty query, show all
  if (!query.trim()) {
    Array.from(allEntries).forEach(entry => {
      entry.classList.remove('log-entry-hidden-by-filter');
      entry.style.opacity = '1';
    });
    return allEntries.length;
  }
  
  const parsedQuery = parseQuery(query);
  let visibleCount = 0;
  
  Array.from(allEntries).forEach(entryElem => {
    // Extract data from the DOM element
    const logEntry = {
      type: entryElem.dataset.logType || 'GENERAL',
      level: entryElem.dataset.logLevel || 'INFO',
      message: entryElem.dataset.rawOriginalMessage || entryElem.textContent
    };
    
    const score = scoreLogEntry(logEntry, parsedQuery.rules);
    
    if (score > 0) {
      entryElem.classList.remove('log-entry-hidden-by-filter');
      // Optional: Use opacity to show relevance
      const opacity = Math.min(1, Math.max(0.7, score / 5));
      entryElem.style.opacity = opacity.toString();
      visibleCount++;
    } else {
      entryElem.classList.add('log-entry-hidden-by-filter');
    }
  });
  
  return visibleCount;
}

/**
 * Clears the query cache
 */
export function clearQueryCache() {
  queryCache.clear();
}

/**
 * Gets help text explaining filter syntax
 * @returns {string} Help text
 */
export function getFilterHelp() {
  return `
    <h4>NLP Log Filter Syntax</h4>
    <p>Examples:</p>
    <ul>
      <li><code>error</code> - Show error logs</li>
      <li><code>init bootstrap</code> - Show logs with "init" and "bootstrap"</li>
      <li><code>"failed to"</code> - Show logs with exact phrase "failed to"</li>
      <li><code>type:BOOTSTRAP level:ERROR</code> - Show ERROR logs from BOOTSTRAP</li>
      <li><code>auth -error</code> - Show auth logs that are not errors</li>
      <li><code>t:UI</code> - Show UI logs (shorthand for type:UI)</li>
      <li><code>l:WARN</code> - Show warnings (shorthand for level:WARN)</li>
    </ul>
  `;
}

// Export for use in LogPanel
export default {
  filterLogEntries,
  applyNLPFilter,
  clearQueryCache,
  getFilterHelp
};
