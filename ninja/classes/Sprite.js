class Sprite {
  constructor({ x, y, imageSrc = './images/leaf.png', velocity }) {
    this.x = x
    this.y = y
    this.width = 12
    this.height = 7
    this.center = {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
    }

    this.loaded = false
    this.image = new Image()
    this.image.onload = () => {
      this.loaded = true
    }
    this.image.src = imageSrc
    this.currentFrame = 0

    this.currentSprite = {
      x: 0,
      y: 0,
      width: 12,
      height: 7,
      frameCount: 6,
    }
    this.elapsedTime = 0
    this.velocity = velocity
    this.alpha = 1
    this.totalElapsedTime = 0
  }

  draw(c) {
    if (!this.loaded) return

    c.save()
    c.globalAlpha = this.alpha
    c.drawImage(
      this.image,
      this.currentSprite.x + this.currentSprite.width * this.currentFrame,
      this.currentSprite.y,
      this.currentSprite.width,
      this.currentSprite.height,
      this.x,
      this.y,
      this.width,
      this.height
    )
    c.restore()
  }

  update(deltaTime) {
    if (!deltaTime) return

    this.elapsedTime += deltaTime
    this.totalElapsedTime += deltaTime
    const intervalToGoToNextFrame = 0.15

    if (this.elapsedTime > intervalToGoToNextFrame) {
      this.currentFrame =
        (this.currentFrame + 1) % this.currentSprite.frameCount
      this.elapsedTime -= intervalToGoToNextFrame
    }

    // update sprite position
    this.x += this.velocity.x
    this.y += this.velocity.y

    // update leaf opacity / alpha
    const leafLifeInterval = 15
    if (this.totalElapsedTime > leafLifeInterval) {
      this.alpha -= 0.01
      this.alpha = Math.max(0, this.alpha)
    }
  }
}
