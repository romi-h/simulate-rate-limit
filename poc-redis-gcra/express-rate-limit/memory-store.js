// /source/memory-store.ts
// A memory store for hit counts
/**
 * Calculates the time when all hit counters will be reset.
 *
 * @param windowMs {number} - The duration of a window (in milliseconds).
 *
 * @returns {Date}
 *
 * @private
 */
const calculateNextResetTime = (windowMs) => {
  const resetTime = new Date();
  resetTime.setMilliseconds(resetTime.getMilliseconds() + windowMs);
  return resetTime;
};
/**
 * A `Store` that stores the hit count for each client in memory.
 *
 * @public
 */
class MemoryStore {
  /**
   * Method that initializes the store.
   *
   * @param options {Options} - The options used to setup the middleware.
   */
  init(options) {
    // Get the duration of a window from the options
    this.windowMs = options.windowMs;
    // Then calculate the reset time using that
    this.resetTime = calculateNextResetTime(this.windowMs);
    // Initialise the hit counter map
    this.hits = {};
    // Reset hit counts for ALL clients every `windowMs` - this will also
    // re-calculate the `resetTime`
    const interval = setInterval(async () => {
      await this.resetAll();
    }, this.windowMs);
    if (interval.unref) {
      interval.unref();
    }
  }
  /**
   * Method to increment a client's hit counter.
   *
   * @param key {string} - The identifier for a client.
   *
   * @returns {IncrementResponse} - The number of hits and reset time for that client.
   *
   * @public
   */
  async increment(key) {
    var _a;
    const totalHits = ((_a = this.hits[key]) !== null && _a !== void 0 ? _a : 0) + 1;
    this.hits[key] = totalHits;
    return {
      totalHits,
      resetTime: this.resetTime,
    };
  }
  /**
   * Method to decrement a client's hit counter.
   *
   * @param key {string} - The identifier for a client.
   *
   * @public
   */
  async decrement(key) {
    const current = this.hits[key];
    if (current) {
      this.hits[key] = current - 1;
    }
  }
  /**
   * Method to reset a client's hit counter.
   *
   * @param key {string} - The identifier for a client.
   *
   * @public
   */
  async resetKey(key) {
    delete this.hits[key];
  }
  /**
   * Method to reset everyone's hit counter.
   *
   * @public
   */
  async resetAll() {
    this.hits = {};
    this.resetTime = calculateNextResetTime(this.windowMs);
  }
}
module.exports = {
  MemoryStore
};
