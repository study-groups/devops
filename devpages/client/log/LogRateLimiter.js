/**
 * @file LogRateLimiter.js
 * @description Rate limiting for logging to prevent spam
 */

/**
 * Rate limiter for log entries
 */
export class LogRateLimiter {
  constructor(maxPerSecond = 50) {
    this.maxPerSecond = maxPerSecond;
    this.logCounts = new Map();
  }

  /**
   * Check if a log entry should be allowed based on rate limits
   * @param {string} source - Log source (CLIENT, SERVER, etc.)
   * @param {string} type - Log type (REDUX, API, etc.)
   * @param {string} level - Log level (DEBUG, INFO, WARN, ERROR)
   * @returns {boolean} True if the log should be allowed
   */
  shouldAllow(source, type, level) {
    const key = `${source}:${type}:${level}`;
    const now = Date.now();
    const secondWindow = Math.floor(now / 1000);

    if (!this.logCounts.has(key)) {
      this.logCounts.set(key, { count: 0, window: secondWindow });
    }

    const entry = this.logCounts.get(key);

    // Reset count if we're in a new second
    if (entry.window !== secondWindow) {
      entry.count = 0;
      entry.window = secondWindow;
    }

    // Check if we're over the limit
    if (entry.count >= this.maxPerSecond) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Reset all rate limit counters
   */
  reset() {
    this.logCounts.clear();
  }

  /**
   * Get current rate limit stats
   * @returns {Object} Stats object with current counts
   */
  getStats() {
    const stats = {};
    const now = Date.now();
    const currentWindow = Math.floor(now / 1000);

    for (const [key, entry] of this.logCounts.entries()) {
      // Only include stats from current window
      if (entry.window === currentWindow) {
        stats[key] = {
          count: entry.count,
          maxPerSecond: this.maxPerSecond,
          remaining: Math.max(0, this.maxPerSecond - entry.count)
        };
      }
    }

    return stats;
  }
}

// Create and export singleton instance
export const logRateLimiter = new LogRateLimiter(50);
