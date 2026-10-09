/**
 * Register the offline worker. A browser without service workers, or a page
 * that is not a secure context, simply stays online-only: there is nothing to
 * tell the player.
 * @param {string} url
 */
export function registerServiceWorker(url) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(url).catch(() => {});
}
