/**
 * Ask the browser once per page session to keep this site's storage, so Safari's
 * seven-day eviction cannot take a player's levels (watchlist 13). Chrome and
 * Safari decide silently; Firefox may prompt once. Never throws.
 *
 * @param {() => (StorageManager | undefined)} getManager e.g. `() => navigator.storage`; may throw
 */
export function createPersistRequest(getManager) {
  let asked = false;
  return {
    /** @returns {Promise<boolean | null>} null when not asked or unsupported */
    async request() {
      if (asked) return null;
      asked = true;
      /** @type {StorageManager | undefined} */
      let manager;
      try { manager = getManager(); } catch { return null; }
      if (!manager || typeof manager.persist !== 'function') return null;
      try {
        if (typeof manager.persisted === 'function' && await manager.persisted()) return true;
        return await manager.persist();
      } catch {
        return null;
      }
    },
  };
}
