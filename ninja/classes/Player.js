const X_VELOCITY = 150
const Y_VELOCITY = 150

class Player {
  constructor({ x, y, size, velocity = { x: 0, y: 0 } }) {
    this.x = x
    this.y = y
    this.width = size
    this.height = size
    this.velocity = velocity
    this.center = {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
    }

    this.loaded = false
    this.image = new Image()
    this.image.onload = () => {
      this.loaded = true
    }
    this.image.src = './images/player.png'

    // Player weapon
    this.weaponSpriteHasLoaded = false
    this.weaponSprite = new Image()
    this.weaponSprite.onload = () => {
      this.weaponSpriteHasLoaded = true
    }
    this.weaponSprite.src = './images/lance.png'

    this.currentFrame = 0
    this.elapsedTime = 0
    this.sprites = {
      walkDown: {
        x: 0,
        y: 0,
        width: 16,
        height: 16,
        frameCount: 4,
      },
      walkUp: {
        x: 16,
        y: 0,
        width: 16,
        height: 16,
        frameCount: 4,
      },
      walkLeft: {
        x: 32,
        y: 0,
        width: 16,
        height: 16,
        frameCount: 4,
      },
      walkRight: {
        x: 48,
        y: 0,
        width: 16,
        height: 16,
        frameCount: 4,
      },
      attackDown: {
        x: 0,
        y: 64,
        width: 16,
        height: 15,
        frameCount: 1,
      },
      attackUp: {
        x: 16,
        y: 64,
        width: 16,
        height: 15,
        frameCount: 1,
      },
      attackLeft: {
        x: 32,
        y: 64,
        width: 16,
        height: 15,
        frameCount: 1,
      },
      attackRight: {
        x: 48,
        y: 64,
        width: 16,
        height: 15,
        frameCount: 1,
      },
    }

    this.currentSprite = this.sprites.walkDown
    this.facing = 'down'
    this.isAttacking = false
    this.attackTimer = 0

    this.attackBoxes = {
      right: {
        xOffset: 10,
        yOffset: 9,
        width: 20,
        height: 5,
      },
      left: {
        xOffset: -16,
        yOffset: 9,
        width: 20,
        height: 5,
      },
      up: {
        xOffset: 2,
        yOffset: -15,
        width: 5,
        height: 20,
      },
      down: {
        xOffset: 2,
        yOffset: 10,
        width: 5,
        height: 20,
      },
    }

    this.attackBox = {
      x: this.x + this.attackBoxes[this.facing].xOffset,
      y: this.y + this.attackBoxes[this.facing].yOffset,
      width: this.attackBoxes[this.facing].width,
      height: this.attackBoxes[this.facing].height,
    }

    this.hasHitEnemy = false
    this.isInvincible = false
    this.elapsedInvincibilityTime = 0
    this.invincibilityInterval = 0.8
  }

  receiveHit() {
    if (this.isInvincible) return

    this.isInvincible = true
  }

  switchBackToIdleState() {
    switch (this.facing) {
      case 'down':
        this.currentSprite = this.sprites.walkDown
        break
      case 'up':
        this.currentSprite = this.sprites.walkUp
        break
      case 'right':
        this.currentSprite = this.sprites.walkRight
        break
      case 'left':
        this.currentSprite = this.sprites.walkLeft
        break
    }
  }

  attack() {
    switch (this.facing) {
      case 'down':
        this.currentSprite = this.sprites.attackDown
        break
      case 'up':
        this.currentSprite = this.sprites.attackUp
        break
      case 'right':
        this.currentSprite = this.sprites.attackRight
        break
      case 'left':
        this.currentSprite = this.sprites.attackLeft
        break
    }

    this.currentFrame = 0
    this.isAttacking = true
  }

  draw(c) {
    if (!this.loaded || !this.weaponSpriteHasLoaded) return

    // Red square debug code
    // c.fillStyle = 'rgba(0, 0, 255, 0.5)'
    // c.fillRect(this.x, this.y, this.width, this.height)

    // Attack box debug code
    // c.fillStyle = 'rgba(0, 0, 255, 0.5)'
    // c.fillRect(
    //   this.attackBox.x,
    //   this.attackBox.y,
    //   this.attackBox.width,
    //   this.attackBox.height
    // )

    let alpha = 1
    if (this.isInvincible) alpha = 0.5

    c.save()
    c.globalAlpha = alpha
    c.drawImage(
      this.image,
      this.currentSprite.x,
      this.currentSprite.y +
        this.currentSprite.height * this.currentFrame +
        0.5,
      this.currentSprite.width,
      this.currentSprite.height,
      this.x,
      this.y,
      this.width,
      this.height
    )
    c.restore()

    // Draw out our weapon
    if (this.isAttacking) {
      let angle = 0
      let xOffset = 0
      let yOffset = 0
      switch (this.facing) {
        case 'down':
          angle = 0
          xOffset = 5
          yOffset = 22
          break
        case 'up':
          angle = Math.PI
          xOffset = 4
          yOffset = -7

          break
        case 'right':
          angle = (Math.PI * 3) / 2
          xOffset = 22
          yOffset = 11

          break
        case 'left':
          angle = Math.PI / 2
          xOffset = -8
          yOffset = 12

          break
      }
      c.save()
      c.globalAlpha = alpha
      c.translate(this.x + xOffset, this.y + yOffset)
      c.rotate(angle)
      c.drawImage(this.weaponSprite, -3, -8, 6, 16)
      c.restore()
    }
  }

  update(deltaTime, collisionBlocks) {
    if (!deltaTime) return

    // Update attack timer
    const timeToCompleteAttack = 0.3
    if (this.isAttacking && this.attackTimer < timeToCompleteAttack) {
      this.attackTimer += deltaTime
    } else if (this.isAttacking && this.attackTimer >= timeToCompleteAttack) {
      // Switch back to idle state
      this.isAttacking = false
      this.attackTimer = 0
      this.switchBackToIdleState()
      this.hasHitEnemy = false
    }

    this.elapsedTime += deltaTime

    if (this.isInvincible) {
      this.elapsedInvincibilityTime += deltaTime

      if (this.elapsedInvincibilityTime >= this.invincibilityInterval) {
        this.isInvincible = false
        this.elapsedInvincibilityTime = 0
      }
    }

    // 0 - 3
    const intervalToGoToNextFrame = 0.15

    if (this.elapsedTime > intervalToGoToNextFrame) {
      this.currentFrame =
        (this.currentFrame + 1) % this.currentSprite.frameCount
      this.elapsedTime -= intervalToGoToNextFrame
    }

    // Update horizontal position and check collisions
    this.updateHorizontalPosition(deltaTime)
    this.checkForHorizontalCollisions(collisionBlocks)

    // Update vertical position and check collisions
    this.updateVerticalPosition(deltaTime)
    this.checkForVerticalCollisions(collisionBlocks)

    this.center = {
      x: this.x + this.width / 2,
      y: this.y + this.height / 2,
    }

    this.attackBox = {
      x: this.x + this.attackBoxes[this.facing].xOffset,
      y: this.y + this.attackBoxes[this.facing].yOffset,
      width: this.attackBoxes[this.facing].width,
      height: this.attackBoxes[this.facing].height,
    }
  }

  updateHorizontalPosition(deltaTime) {
    this.x += this.velocity.x * deltaTime
  }

  updateVerticalPosition(deltaTime) {
    this.y += this.velocity.y * deltaTime
  }

  handleInput(keys) {
    this.velocity.x = 0
    this.velocity.y = 0

    if (this.isAttacking) return

    if (keys.d.pressed) {
      this.velocity.x = X_VELOCITY

      this.currentSprite = this.sprites.walkRight
      this.currentSprite.frameCount = 4
      this.facing = 'right'
    } else if (keys.a.pressed) {
      this.velocity.x = -X_VELOCITY

      this.currentSprite = this.sprites.walkLeft
      this.currentSprite.frameCount = 4
      this.facing = 'left'
    } else if (keys.w.pressed) {
      this.velocity.y = -Y_VELOCITY

      this.currentSprite = this.sprites.walkUp
      this.currentSprite.frameCount = 4
      this.facing = 'up'
    } else if (keys.s.pressed) {
      this.velocity.y = Y_VELOCITY

      this.currentSprite = this.sprites.walkDown
      this.currentSprite.frameCount = 4
      this.facing = 'down'
    } else {
      this.currentSprite.frameCount = 1
    }
  }

  checkForHorizontalCollisions(collisionBlocks) {
    const buffer = 0.0001
    for (let i = 0; i < collisionBlocks.length; i++) {
      const collisionBlock = collisionBlocks[i]

      // Check if a collision exists on all axes
      if (
        this.x <= collisionBlock.x + collisionBlock.width &&
        this.x + this.width >= collisionBlock.x &&
        this.y + this.height >= collisionBlock.y &&
        this.y <= collisionBlock.y + collisionBlock.height
      ) {
        // Check collision while player is going left
        if (this.velocity.x < -0) {
          this.x = collisionBlock.x + collisionBlock.width + buffer
          break
        }

        // Check collision while player is going right
        if (this.velocity.x > 0) {
          this.x = collisionBlock.x - this.width - buffer

          break
        }
      }
    }
  }

  checkForVerticalCollisions(collisionBlocks) {
    const buffer = 0.0001
    for (let i = 0; i < collisionBlocks.length; i++) {
      const collisionBlock = collisionBlocks[i]

      // If a collision exists
      if (
        this.x <= collisionBlock.x + collisionBlock.width &&
        this.x + this.width >= collisionBlock.x &&
        this.y + this.height >= collisionBlock.y &&
        this.y <= collisionBlock.y + collisionBlock.height
      ) {
        // Check collision while player is going up
        if (this.velocity.y < 0) {
          this.velocity.y = 0
          this.y = collisionBlock.y + collisionBlock.height + buffer
          break
        }

        // Check collision while player is going down
        if (this.velocity.y > 0) {
          this.velocity.y = 0
          this.y = collisionBlock.y - this.height - buffer
          break
        }
      }
    }
  }
}
