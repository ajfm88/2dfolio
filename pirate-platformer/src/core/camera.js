/**
 * World-space top-left of the virtual view.
 * Clamp degrades to centring when the world is smaller than the view
 * (ported intent from Super Pirate World groups.py camera_constraint,
 * without the inverted-range bug).
 */
export function createCamera() {
  const cam = { x: 0, y: 0 };

  /**
   * @param {number} targetX world px, follow point
   * @param {number} targetY world px
   * @param {number} viewW
   * @param {number} viewH
   * @param {number} worldW
   * @param {number} worldH
   */
  function follow(targetX, targetY, viewW, viewH, worldW, worldH) {
    let x = targetX - viewW / 2;
    let y = targetY - viewH / 2;

    if (worldW <= viewW) x = (worldW - viewW) / 2;
    else x = Math.max(0, Math.min(x, worldW - viewW));

    if (worldH <= viewH) y = (worldH - viewH) / 2;
    else y = Math.max(0, Math.min(y, worldH - viewH));

    cam.x = Math.round(x);
    cam.y = Math.round(y);
  }

  return {
    get x() {
      return cam.x;
    },
    get y() {
      return cam.y;
    },
    follow,
  };
}
