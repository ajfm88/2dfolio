let touchStartX = 0
let touchStartY = 0
let lastTapTime = 0
const DEAD_ZONE = 12

const resetKeys = () => {
  keys.w.pressed = false
  keys.a.pressed = false
  keys.s.pressed = false
  keys.d.pressed = false
}

canvas.addEventListener(
  'touchstart',
  (e) => {
    e.preventDefault()
    controlsVisible = false

    const touch = e.touches[0]
    touchStartX = touch.clientX
    touchStartY = touch.clientY

    const now = Date.now()
    if (now - lastTapTime < 300) {
      player.attack()
    }
    lastTapTime = now
  },
  { passive: false }
)

canvas.addEventListener(
  'touchmove',
  (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartX
    const dy = touch.clientY - touchStartY

    resetKeys()

    if (Math.abs(dx) < DEAD_ZONE && Math.abs(dy) < DEAD_ZONE) return

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) keys.d.pressed = true
      else keys.a.pressed = true
    } else {
      if (dy > 0) keys.s.pressed = true
      else keys.w.pressed = true
    }
  },
  { passive: false }
)

canvas.addEventListener(
  'touchend',
  (e) => {
    e.preventDefault()
    resetKeys()
  },
  { passive: false }
)
