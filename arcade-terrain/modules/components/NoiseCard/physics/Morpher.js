/**
 * Morpher - Shape morphing and dissolve/reform effects
 *
 * States:
 *   idle       - Normal rendering (letters visible)
 *   pixelating - Letters replaced with blocky pixel grid
 *   paused     - Brief pause showing pixelation
 *   falling    - Pixels fall with gravity
 *   swarming   - Particles moving freely
 *   forming    - Particles converging to target shape
 *   complete   - Formation finished, snapping to shape
 */

import { PixelExtractor } from './PixelExtractor.js';
import { EarthMover } from './EarthMover.js';
import { LETTER_PATHS } from './CollisionMask.js';

export class Morpher {
  constructor(particleSystem, collisionMask) {
    this.particles = particleSystem;
    this.collisionMask = collisionMask;

    this.state = 'idle';
    this.progress = 0;
    this.targetLetter = null;
    this.onStateChange = null;

    // Pixel extractor for rasterization
    this.pixelExtractor = new PixelExtractor();

    // Current pixel blocks (for pixelation render phase)
    this.pixelBlocks = null;

    // Original pixel positions (for reform targets)
    this.originalPositions = null;

    // Config
    this.config = {
      pixelateBlockSize: 2,    // SVG units per block
      pixelateDuration: 300,   // ms to show pixelation
      pauseDuration: 200,      // ms pause before falling
      fallGravity: 0.008,      // Gravity during fall phase (increased 10x)
      reformAttraction: 0.003  // Attraction strength during reform
    };

    // Timing
    this._stateStartTime = 0;
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get pixel blocks for rendering (during pixelating/paused phases)
   */
  getPixelBlocks() {
    return this.pixelBlocks;
  }

  /**
   * Dissolve letters into particles
   *
   * Phase 1: Pixelate - Render letters as blocky pixel grid
   * Phase 2: Pause - Brief hold
   * Phase 3: Fall - Pixels drop with gravity
   *
   * @param {string} fillColor - Color for pixels (from SVG fill)
   * @param {number} blockSize - Size of pixel blocks
   */
  dissolve(fillColor = '#616161', blockSize = null) {
    if (this.state !== 'idle') return;

    const bs = blockSize || this.config.pixelateBlockSize;

    // Extract pixel blocks from SVG paths
    this.pixelBlocks = this.pixelExtractor.extractBlocks(LETTER_PATHS, fillColor, bs);

    // Save original positions for later reform
    this.originalPositions = this.pixelBlocks.map(b => ({ x: b.x, y: b.y }));

    this.state = 'pixelating';
    this._stateStartTime = performance.now();
    this._notifyStateChange();
  }

  /**
   * Reform particles back into letter shape using Earth Mover assignment
   */
  reform() {
    if (this.state !== 'swarming' && this.state !== 'falling') return;

    this.state = 'forming';
    this.progress = 0;

    // Get current particle positions
    const particles = [];
    for (let i = 0; i < this.particles.count; i++) {
      particles.push({
        x: this.particles.x[i],
        y: this.particles.y[i]
      });
    }

    // Get target positions (original pixel locations)
    const targets = this.originalPositions || this.collisionMask.sampleAll(this.particles.count);

    // Use Earth Mover to find optimal assignment
    const assignment = EarthMover.assignSpatial(particles, targets);

    // Assign targets to particles based on optimal matching
    for (let i = 0; i < this.particles.count; i++) {
      const targetIdx = assignment[i];
      if (targetIdx >= 0 && targetIdx < targets.length) {
        this.particles.targetX[i] = targets[targetIdx].x;
        this.particles.targetY[i] = targets[targetIdx].y;
        this.particles.hasTarget[i] = 1;
      } else {
        this.particles.hasTarget[i] = 0;
      }
    }

    this.particles.morphing = true;

    // Increase attraction, disable decay and gravity during formation
    this.particles.config.attraction = this.config.reformAttraction;
    this.particles.config.decay = 0;
    this.particles.config.gravity = 0;

    this._notifyStateChange();
  }

  /**
   * Cancel current morph and return to idle
   */
  cancel() {
    this.particles.clear();
    this.particles.clearTargets();
    this.particles.config.attraction = 0.0005;
    this.particles.config.decay = 0.002;
    this.particles.config.gravity = 0.0001;
    this.pixelBlocks = null;
    this.originalPositions = null;
    this.state = 'idle';
    this._notifyStateChange();
  }

  /**
   * Update morpher state (call each frame)
   */
  update(deltaTime) {
    const now = performance.now();
    const elapsed = now - this._stateStartTime;

    switch (this.state) {
      case 'pixelating':
        // After pixelate duration, transition to paused
        if (elapsed >= this.config.pixelateDuration) {
          this.state = 'paused';
          this._stateStartTime = now;
          this._notifyStateChange();
        }
        break;

      case 'paused':
        // After pause, create particles and start falling
        if (elapsed >= this.config.pauseDuration) {
          this._startFalling();
        }
        break;

      case 'falling':
        // Check if particles have mostly settled (hit bottom or stopped)
        const fallingComplete = this._checkFallComplete();
        if (fallingComplete) {
          this.state = 'swarming';
          this.particles.config.gravity = 0.0001; // Reduce gravity for swarming
          this._notifyStateChange();
        }
        break;

      case 'forming':
        // Check if formation is complete
        if (this.particles.isFormationComplete(0.015)) {
          this.progress += 0.05;
          if (this.progress >= 1) {
            this.state = 'complete';
            this._notifyStateChange();

            // Return to idle after brief pause
            setTimeout(() => {
              if (this.state === 'complete') {
                this.particles.clear();
                this.particles.config.attraction = 0.0005;
                this.particles.config.decay = 0.002;
                this.particles.config.gravity = 0.0001;
                this.pixelBlocks = null;
                this.originalPositions = null;
                this.state = 'idle';
                this._notifyStateChange();
              }
            }, 500);
          }
        }
        break;
    }
  }

  /**
   * Start the falling phase - create particles from pixel blocks
   */
  _startFalling() {
    if (!this.pixelBlocks) return;

    // Enable particles
    this.particles.setEnabled(true);
    this.particles.clear();

    // Set high gravity for falling
    this.particles.config.gravity = this.config.fallGravity;
    this.particles.config.decay = 0; // Don't decay during fall

    // Create particles from pixel blocks
    for (const block of this.pixelBlocks) {
      if (this.particles.count >= this.particles.maxParticles) break;

      const idx = this.particles.count++;
      this.particles.x[idx] = block.x;
      this.particles.y[idx] = block.y;
      this.particles.vx[idx] = (Math.random() - 0.5) * 0.002; // Tiny horizontal spread
      this.particles.vy[idx] = 0; // Start stationary, gravity will pull
      this.particles.life[idx] = 1.0;
      this.particles.size[idx] = Math.max(2, block.width * 100); // Scale block size
      this.particles.color[idx] = block.color;
      this.particles.hasTarget[idx] = 0;
    }

    // Clear pixel blocks (particles take over)
    this.pixelBlocks = null;

    this.state = 'falling';
    this._stateStartTime = performance.now();
    this._notifyStateChange();
  }

  /**
   * Check if falling is mostly complete
   */
  _checkFallComplete() {
    if (this.particles.count === 0) return true;

    // Check how many particles are near the bottom or moving slowly
    let settled = 0;
    for (let i = 0; i < this.particles.count; i++) {
      const nearBottom = this.particles.y[i] > 0.85;
      const movingSlow = Math.abs(this.particles.vy[i]) < 0.001;

      if (nearBottom || movingSlow) settled++;
    }

    // Consider complete when 70% have settled
    return settled >= this.particles.count * 0.7;
  }

  /**
   * Set state change callback
   */
  setOnStateChange(callback) {
    this.onStateChange = callback;
  }

  _notifyStateChange() {
    console.log('[Morpher] State changed to:', this.state);
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  /**
   * Check if currently animating (not idle)
   */
  isAnimating() {
    return this.state !== 'idle';
  }

  /**
   * Check if letters should be hidden (during dissolve/swarm)
   */
  shouldHideLetters() {
    // Hide letters during ALL dissolve phases
    return ['pixelating', 'paused', 'falling', 'swarming', 'forming'].includes(this.state);
  }

  /**
   * Check if pixel blocks should be rendered
   */
  shouldShowPixelBlocks() {
    return this.state === 'pixelating' || this.state === 'paused';
  }
}

/**
 * LetterState - Per-letter animation state
 */
export class LetterState {
  constructor(letter) {
    this.letter = letter;

    // Transform
    this.scale = 1.0;
    this.rotation = 0;
    this.offsetX = 0;
    this.offsetY = 0;

    // Effects
    this.glow = 0;
    this.shake = 0;

    // Animation targets
    this.targetScale = 1.0;
    this.targetGlow = 0;
  }

  /**
   * Called when a particle hits this letter
   */
  onCollision() {
    this.targetGlow = 1.0;
    this.shake = 0.5;
  }

  /**
   * Update animation state
   */
  update(deltaTime) {
    const dt = deltaTime / 16.67;

    // Animate toward targets
    this.scale += (this.targetScale - this.scale) * 0.1 * dt;
    this.glow += (this.targetGlow - this.glow) * 0.05 * dt;

    // Decay effects
    this.targetGlow *= 0.95;
    this.shake *= 0.9;

    // Apply shake
    if (this.shake > 0.01) {
      this.offsetX = (Math.random() - 0.5) * this.shake * 4;
      this.offsetY = (Math.random() - 0.5) * this.shake * 4;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }

  /**
   * Reset to default state
   */
  reset() {
    this.scale = 1.0;
    this.rotation = 0;
    this.offsetX = 0;
    this.offsetY = 0;
    this.glow = 0;
    this.shake = 0;
    this.targetScale = 1.0;
    this.targetGlow = 0;
  }
}

export default Morpher;
