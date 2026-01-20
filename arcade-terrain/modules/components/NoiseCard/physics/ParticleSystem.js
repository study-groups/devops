/**
 * ParticleSystem - High-performance particle emitter with physics
 *
 * Uses Structure of Arrays (SoA) for cache-friendly iteration.
 * Supports collision detection, morphing targets, and visual effects.
 */

export class ParticleSystem {
  constructor(maxParticles = 1000) {
    this.maxParticles = maxParticles;

    // Structure of Arrays for performance
    this.x = new Float32Array(maxParticles);
    this.y = new Float32Array(maxParticles);
    this.vx = new Float32Array(maxParticles);
    this.vy = new Float32Array(maxParticles);
    this.life = new Float32Array(maxParticles);
    this.size = new Float32Array(maxParticles);

    // Morphing targets
    this.targetX = new Float32Array(maxParticles);
    this.targetY = new Float32Array(maxParticles);
    this.hasTarget = new Uint8Array(maxParticles);

    // Color (packed RGBA)
    this.color = new Uint32Array(maxParticles);

    // Active particle count
    this.count = 0;

    // Physics config
    this.config = {
      gravity: 0.0001,
      friction: 0.98,
      bounce: 0.7,
      attraction: 0.0005,
      maxSpeed: 0.015,
      decay: 0.002,
      defaultColor: 0xff9900ff, // Orange RGBA
      defaultSize: 2
    };

    // State
    this.enabled = false;
    this.morphing = false;
  }

  /**
   * Enable/disable particle system
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.count = 0;
    }
  }

  /**
   * Emit particles at a position
   * @param {number} x - X position (0-1)
   * @param {number} y - Y position (0-1)
   * @param {number} count - Number of particles
   * @param {number} spread - Velocity spread
   * @param {number} color - Color as packed RGBA
   */
  emit(x, y, count, spread = 0.01, color = null) {
    if (!this.enabled) return;

    const c = color || this.config.defaultColor;

    for (let i = 0; i < count && this.count < this.maxParticles; i++) {
      const idx = this.count++;

      this.x[idx] = x;
      this.y[idx] = y;
      this.vx[idx] = (Math.random() - 0.5) * spread;
      this.vy[idx] = (Math.random() - 0.5) * spread;
      this.life[idx] = 1.0;
      this.size[idx] = this.config.defaultSize;
      this.color[idx] = c;
      this.hasTarget[idx] = 0;
    }
  }

  /**
   * Emit particles at random positions
   */
  emitRandom(count, spread = 0.01) {
    for (let i = 0; i < count; i++) {
      this.emit(
        Math.random(),
        Math.random(),
        1,
        spread
      );
    }
  }

  /**
   * Emit particles at sampled positions (for dissolve effect)
   * @param {Array<{x: number, y: number}>} positions - Sample positions
   * @param {number} spread - Initial velocity spread
   */
  emitAtPositions(positions, spread = 0.02) {
    if (!this.enabled) return;

    for (const pos of positions) {
      if (this.count >= this.maxParticles) break;

      const idx = this.count++;
      this.x[idx] = pos.x;
      this.y[idx] = pos.y;
      this.vx[idx] = (Math.random() - 0.5) * spread;
      this.vy[idx] = (Math.random() - 0.5) * spread;
      this.life[idx] = 1.0;
      this.size[idx] = this.config.defaultSize;
      this.color[idx] = this.config.defaultColor;
      this.hasTarget[idx] = 0;
    }
  }

  /**
   * Assign morph targets to existing particles
   * @param {Array<{x: number, y: number}>} targets - Target positions
   */
  setTargets(targets) {
    this.morphing = true;

    const assignCount = Math.min(this.count, targets.length);
    for (let i = 0; i < assignCount; i++) {
      this.targetX[i] = targets[i].x;
      this.targetY[i] = targets[i].y;
      this.hasTarget[i] = 1;
    }

    // Clear targets for extra particles
    for (let i = assignCount; i < this.count; i++) {
      this.hasTarget[i] = 0;
    }
  }

  /**
   * Clear all morph targets
   */
  clearTargets() {
    this.morphing = false;
    for (let i = 0; i < this.count; i++) {
      this.hasTarget[i] = 0;
    }
  }

  /**
   * Update particle physics
   * @param {number} deltaTime - Time since last frame (ms)
   * @param {CollisionMask} collisionMask - Optional collision mask
   * @param {Function} onCollision - Callback(letter, x, y) when particle hits
   */
  update(deltaTime, collisionMask = null, onCollision = null) {
    if (!this.enabled || this.count === 0) return;

    const dt = deltaTime / 16.67; // Normalize to 60fps
    const { gravity, friction, bounce, attraction, maxSpeed, decay } = this.config;

    for (let i = 0; i < this.count; i++) {
      // Apply gravity
      this.vy[i] += gravity * dt;

      // Apply attraction to target if morphing
      if (this.hasTarget[i]) {
        const dx = this.targetX[i] - this.x[i];
        const dy = this.targetY[i] - this.y[i];
        this.vx[i] += dx * attraction * dt;
        this.vy[i] += dy * attraction * dt;
      }

      // Apply friction
      this.vx[i] *= friction;
      this.vy[i] *= friction;

      // Clamp speed
      const speed = Math.sqrt(this.vx[i] ** 2 + this.vy[i] ** 2);
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        this.vx[i] *= scale;
        this.vy[i] *= scale;
      }

      // Calculate new position
      const newX = this.x[i] + this.vx[i] * dt;
      const newY = this.y[i] + this.vy[i] * dt;

      // Collision detection
      if (collisionMask) {
        const hit = collisionMask.test(newX, newY);
        if (hit) {
          // Bounce
          this.vx[i] *= -bounce;
          this.vy[i] *= -bounce;

          // Callback for letter-specific effects
          if (onCollision) {
            const letter = collisionMask.testLetter(newX, newY);
            if (letter) {
              onCollision(letter, newX, newY);
            }
          }
        } else {
          this.x[i] = newX;
          this.y[i] = newY;
        }
      } else {
        this.x[i] = newX;
        this.y[i] = newY;
      }

      // Boundary bounce
      if (this.x[i] < 0) { this.x[i] = 0; this.vx[i] *= -bounce; }
      if (this.x[i] > 1) { this.x[i] = 1; this.vx[i] *= -bounce; }
      if (this.y[i] < 0) { this.y[i] = 0; this.vy[i] *= -bounce; }
      if (this.y[i] > 1) { this.y[i] = 1; this.vy[i] *= -bounce; }

      // Decay life
      this.life[i] -= decay * dt;
    }

    // Remove dead particles (swap with last)
    for (let i = this.count - 1; i >= 0; i--) {
      if (this.life[i] <= 0) {
        this._removeParticle(i);
      }
    }
  }

  /**
   * Remove particle by swapping with last
   */
  _removeParticle(idx) {
    this.count--;
    if (idx < this.count) {
      this.x[idx] = this.x[this.count];
      this.y[idx] = this.y[this.count];
      this.vx[idx] = this.vx[this.count];
      this.vy[idx] = this.vy[this.count];
      this.life[idx] = this.life[this.count];
      this.size[idx] = this.size[this.count];
      this.color[idx] = this.color[this.count];
      this.targetX[idx] = this.targetX[this.count];
      this.targetY[idx] = this.targetY[this.count];
      this.hasTarget[idx] = this.hasTarget[this.count];
    }
  }

  /**
   * Render particles to canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  render(ctx, width, height) {
    if (!this.enabled || this.count === 0) return;

    for (let i = 0; i < this.count; i++) {
      const alpha = this.life[i];
      const color = this.color[i];

      // Unpack RGBA
      const r = (color >> 24) & 0xff;
      const g = (color >> 16) & 0xff;
      const b = (color >> 8) & 0xff;

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

      const px = Math.floor(this.x[i] * width);
      const py = Math.floor(this.y[i] * height);
      const size = this.size[i];

      ctx.fillRect(px, py, size, size);
    }
  }

  /**
   * Clear all particles
   */
  clear() {
    this.count = 0;
    this.morphing = false;
  }

  /**
   * Get current particle count
   */
  getCount() {
    return this.count;
  }

  /**
   * Check if particles have reached their targets
   */
  isFormationComplete(threshold = 0.01) {
    if (!this.morphing) return false;

    let settled = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.hasTarget[i]) {
        const dx = this.targetX[i] - this.x[i];
        const dy = this.targetY[i] - this.y[i];
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < threshold) settled++;
      }
    }

    return settled >= this.count * 0.9;
  }
}

export default ParticleSystem;
