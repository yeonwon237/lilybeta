/**
 * Central In-Flight Request Deduplicator for LilyBeta
 * 
 * Prevents identical duplicate requests generated concurrently by
 * React StrictMode, multiple mounted components, or rapid user clicks.
 * 
 * Guarantees:
 * - Simultaneous in-flight requests share a single network Promise.
 * - Promise is immediately purged from the dedupe map upon either
 *   successful resolution or rejection, preventing memory leaks and
 *   allowing subsequent retries.
 */

export class RequestDeduplicator {
  private static inFlight = new Map<string, Promise<any>>();
  private static dedupeCount = 0;

  /**
   * Execute an async action with deduplication by key.
   * If a request with `key` is currently in flight, returns the existing Promise.
   */
  static dedupe<T>(key: string, factory: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      this.dedupeCount++;
      return existing as Promise<T>;
    }

    const promise = factory().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);
    return promise;
  }

  /**
   * Check if a request is currently in flight.
   */
  static isInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  /**
   * Developer Telemetry: count how many requests were deduplicated.
   */
  static getDedupeCount(): number {
    return this.dedupeCount;
  }

  /**
   * Reset deduplicator state (useful for tests).
   */
  static reset(): void {
    this.inFlight.clear();
    this.dedupeCount = 0;
  }
}
