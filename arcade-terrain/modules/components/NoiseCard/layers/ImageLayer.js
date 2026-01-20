/**
 * ImageLayer - Layer 2: SVG/Image display with particle physics
 *
 * Features:
 * - Per-letter rendering with z-index control
 * - Collision detection for particles
 * - Dissolve/reform morphing effects
 * - Letter animation states (glow, shake)
 */

import { CollisionMask, LETTER_PATHS, LETTER_BOUNDS, SVG_VIEWBOX } from '../physics/CollisionMask.js';
import { ParticleSystem } from '../physics/ParticleSystem.js';
import { Morpher, LetterState } from '../physics/Morpher.js';

export class ImageLayer {
  constructor(width, height) {
    this.type = 'image';
    this.width = width;
    this.height = height;

    // Offscreen canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    // Config - read fill color from CSS variable to match original SVG styling
    const computedStyle = getComputedStyle(document.documentElement);
    const defaultFill = computedStyle.getPropertyValue('--paper-light').trim() || '#616161';

    this.config = {
      src: '#svg_arcade_logo',
      scale: 0.5,  // Match original cabinet-card sizing
      x: 0.5,
      y: 0.5,
      opacity: 1,
      backgroundColor: '#0a0a0a',
      invert: false,
      hue: 0,
      fillColor: defaultFill
    };

    // Letter paths (from SVG)
    this.letterPaths = LETTER_PATHS;

    // Per-letter animation states
    this.letterStates = {};
    for (const letter of Object.keys(LETTER_PATHS)) {
      this.letterStates[letter] = new LetterState(letter);
    }

    // Physics systems
    this.collisionMask = new CollisionMask(126, 14);
    this.collisionMask.rasterize(this.letterPaths);

    this.particles = new ParticleSystem(1000);
    this.morpher = new Morpher(this.particles, this.collisionMask);

    // Z-index manager reference (set by LayerManager)
    this.zManager = null;

    // SVG image cache (for fallback rendering)
    this._svgImage = null;
    this._svgWidth = SVG_VIEWBOX.width;
    this._svgHeight = SVG_VIEWBOX.height;

    this._loadSVG();
  }

  /**
   * Set z-index manager reference
   */
  setZManager(zManager) {
    this.zManager = zManager;
  }

  /**
   * Load SVG from DOM (fallback for non-per-letter rendering)
   */
  _loadSVG() {
    const selector = this.config.src;
    const svgElement = document.querySelector(selector);

    if (!svgElement) {
      console.warn(`[ImageLayer] SVG not found: ${selector}`);
      return;
    }

    // Create SVG wrapper with all paths
    const svgWrapper = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgWrapper.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgWrapper.setAttribute('viewBox', `0 0 ${this._svgWidth} ${this._svgHeight}`);
    svgWrapper.setAttribute('width', this._svgWidth);
    svgWrapper.setAttribute('height', this._svgHeight);

    // Clone paths with fill color
    const paths = svgElement.querySelectorAll('path');
    paths.forEach(p => {
      const clone = p.cloneNode(true);
      clone.setAttribute('fill', this.config.fillColor);
      clone.removeAttribute('style');
      svgWrapper.appendChild(clone);
    });

    // Serialize and load as image
    const svgString = new XMLSerializer().serializeToString(svgWrapper);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      this._svgImage = img;
      URL.revokeObjectURL(url);
      this._render();
    };
    img.onerror = () => {
      console.warn('[ImageLayer] Failed to load SVG image');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  /**
   * Internal render to offscreen canvas
   */
  _render() {
    const { scale, backgroundColor, invert, hue, fillColor } = this.config;
    const morphState = this.morpher.getState();

    // Dark background - covers everything
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.width, this.height);

    // Calculate logo bounds (needed for both letters and particles)
    const logoBounds = this._calculateLogoBounds(scale);

    // Determine what to render based on morph state
    const isAnimating = this.morpher.isAnimating();
    const stateChanged = this._lastState !== morphState;

    // DEBUG: log state changes
    if (stateChanged) {
      console.log('[ImageLayer] state:', morphState, 'animating:', isAnimating);
      this._lastState = morphState;
    }

    // Render based on state:
    // - idle: show letters
    // - pixelating/paused: show pixel blocks
    // - falling/swarming/forming: show nothing (just particles)
    // - complete: show letters (reform finished)
    if (morphState === 'idle' || morphState === 'complete') {
      this._renderLettersWithBounds(logoBounds, fillColor, invert, hue);
    } else if (morphState === 'pixelating' || morphState === 'paused') {
      this._renderPixelBlocks(logoBounds, invert, hue);
    }
    // else: falling/swarming/forming - just particles, no letters

    // Render particles within logo bounds
    this._renderParticles(logoBounds);
  }

  /**
   * Calculate where the logo is drawn on canvas
   */
  _calculateLogoBounds(scale) {
    const imgAspect = this._svgWidth / this._svgHeight;
    let drawWidth = this.width * scale;
    let drawHeight = drawWidth / imgAspect;

    if (drawHeight > this.height * scale) {
      drawHeight = this.height * scale;
      drawWidth = drawHeight * imgAspect;
    }

    return {
      x: (this.width - drawWidth) / 2,
      y: (this.height - drawHeight) / 2,
      width: drawWidth,
      height: drawHeight
    };
  }

  /**
   * Render pixel blocks during pixelation phase
   */
  _renderPixelBlocks(bounds, invert, hue) {
    const blocks = this.morpher.getPixelBlocks();
    if (!blocks || blocks.length === 0) return;

    // Apply global filters
    let filter = '';
    if (invert) filter += 'invert(1) ';
    if (hue) filter += `hue-rotate(${hue}deg) `;
    this.ctx.filter = filter || 'none';

    for (const block of blocks) {
      // Unpack color
      const color = block.color;
      const r = (color >> 24) & 0xff;
      const g = (color >> 16) & 0xff;
      const b = (color >> 8) & 0xff;

      this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;

      // Transform from normalized (0-1) to logo space
      const px = bounds.x + block.x * bounds.width;
      const py = bounds.y + block.y * bounds.height;
      const pw = block.width * bounds.width;
      const ph = block.height * bounds.height;

      // Draw blocky pixel
      this.ctx.fillRect(Math.floor(px), Math.floor(py), Math.ceil(pw) + 1, Math.ceil(ph) + 1);
    }

    this.ctx.filter = 'none';
  }

  /**
   * Render particles transformed to logo space
   */
  _renderParticles(bounds) {
    if (!this.particles.enabled || this.particles.count === 0) return;

    for (let i = 0; i < this.particles.count; i++) {
      const alpha = this.particles.life[i];
      const color = this.particles.color[i];

      // Unpack RGBA
      const r = (color >> 24) & 0xff;
      const g = (color >> 16) & 0xff;
      const b = (color >> 8) & 0xff;

      this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

      // Transform from normalized (0-1) to logo space
      const px = bounds.x + this.particles.x[i] * bounds.width;
      const py = bounds.y + this.particles.y[i] * bounds.height;
      const size = this.particles.size[i];

      this.ctx.fillRect(px, py, size, size);
    }
  }

  /**
   * Render individual letters with z-ordering and effects
   */
  _renderLettersWithBounds(bounds, fillColor, invert, hue) {
    const letters = Object.keys(this.letterPaths);

    // Sort by z-index if manager available
    let sorted;
    if (this.zManager) {
      sorted = letters
        .map(l => ({ letter: l, z: this.zManager.getZ(2, l) }))
        .sort((a, b) => a.z - b.z)
        .map(item => item.letter);
    } else {
      sorted = letters;
    }

    // Use pre-calculated bounds
    const { x: baseX, y: baseY, width: drawWidth, height: drawHeight } = bounds;

    // Scale factors
    const scaleX = drawWidth / this._svgWidth;
    const scaleY = drawHeight / this._svgHeight;

    // Apply global filters
    let filter = '';
    if (invert) filter += 'invert(1) ';
    if (hue) filter += `hue-rotate(${hue}deg) `;
    this.ctx.filter = filter || 'none';

    // Render each letter
    for (const letter of sorted) {
      const state = this.letterStates[letter];
      const pathData = this.letterPaths[letter];

      this.ctx.save();

      // Move to base position
      this.ctx.translate(baseX, baseY);
      this.ctx.scale(scaleX, scaleY);

      // Apply letter state transforms
      if (state.offsetX !== 0 || state.offsetY !== 0) {
        this.ctx.translate(state.offsetX / scaleX, state.offsetY / scaleY);
      }

      // Apply glow effect
      if (state.glow > 0.01) {
        this.ctx.shadowColor = fillColor;
        this.ctx.shadowBlur = state.glow * 20;
      } else {
        this.ctx.shadowBlur = 0;
      }

      // Draw the letter path
      const path = new Path2D(pathData);
      this.ctx.fillStyle = fillColor;
      this.ctx.fill(path);

      this.ctx.restore();
    }

    this.ctx.filter = 'none';
  }

  /**
   * Render to target context
   */
  render(ctx) {
    ctx.drawImage(this.canvas, 0, 0);
  }

  /**
   * Update animation states and particles
   */
  update(deltaTime) {
    // Update letter states
    for (const state of Object.values(this.letterStates)) {
      state.update(deltaTime);
    }

    // Update particles with collision
    this.particles.update(deltaTime, this.collisionMask, (letter, x, y) => {
      // Particle hit a letter
      if (this.letterStates[letter]) {
        this.letterStates[letter].onCollision();
      }
    });

    // Update morpher
    this.morpher.update(deltaTime);

    // Re-render
    this._render();
  }

  /**
   * Resize layer
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this._render();
  }

  // === Particle API ===

  /**
   * Enable/disable particles
   */
  enableParticles(enabled) {
    this.particles.setEnabled(enabled);
  }

  /**
   * Check if particles enabled
   */
  get particlesEnabled() {
    return this.particles.enabled;
  }

  /**
   * Emit particles at random positions
   */
  emitParticles(count) {
    this.particles.emitRandom(count, 0.01);
  }

  /**
   * Dissolve letters into particles
   * Now uses pixelation → pause → fall sequence
   */
  dissolve() {
    this.particles.setEnabled(true);
    this.morpher.dissolve(this.config.fillColor);
  }

  /**
   * Reform particles back into letters
   */
  reform() {
    this.morpher.reform();
  }

  /**
   * Cancel morph and reset
   */
  cancelMorph() {
    this.morpher.cancel();
    for (const state of Object.values(this.letterStates)) {
      state.reset();
    }
  }

  /**
   * Get morpher state
   */
  getMorphState() {
    return this.morpher.getState();
  }

  // === Config API ===

  /**
   * Get config
   */
  getConfig() {
    return {
      ...this.config,
      particlesEnabled: this.particles.enabled,
      particleCount: this.particles.getCount(),
      morphState: this.morpher.getState()
    };
  }

  /**
   * Set config
   */
  setConfig(config) {
    const srcChanged = config.src && config.src !== this.config.src;
    const colorChanged = config.fillColor && config.fillColor !== this.config.fillColor;

    Object.assign(this.config, config);

    if (srcChanged || colorChanged) {
      this._loadSVG();
    } else {
      this._render();
    }
  }
}

export default ImageLayer;
