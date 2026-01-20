/**
 * SliderGestures - Touch and mouse gesture handling for sliders
 *
 * Gesture Types:
 * - Drag left/right: Adjust value
 * - Swipe left: Archive slider
 * - Swipe right: Add to quick settings (future)
 * - Long press (800ms): MIDI learn mode (future)
 */

export class SliderGestures {
  constructor(sliderManager) {
    this.sliderManager = sliderManager;
    this.activeGesture = null;
    this.startPos = { x: 0, y: 0 };
    this.startTime = 0;
    this.longPressTimer = null;

    // Thresholds
    this.SWIPE_THRESHOLD = 50;      // px horizontal for swipe
    this.SWIPE_MAX_Y = 30;          // max vertical movement for swipe
    this.LONG_PRESS_MS = 800;       // ms for long press
    this.LONG_PRESS_MAX_MOVE = 10;  // max movement during long press
  }

  /**
   * Attach gesture handlers to a slider container
   */
  attach(container) {
    // Touch events
    container.addEventListener('touchstart', (e) => this._onStart(e, container), { passive: false });
    container.addEventListener('touchmove', (e) => this._onMove(e, container), { passive: false });
    container.addEventListener('touchend', (e) => this._onEnd(e, container));
    container.addEventListener('touchcancel', (e) => this._onEnd(e, container));

    // Mouse events (for desktop)
    container.addEventListener('mousedown', (e) => this._onStart(e, container));
    container.addEventListener('mousemove', (e) => this._onMove(e, container));
    container.addEventListener('mouseup', (e) => this._onEnd(e, container));
    container.addEventListener('mouseleave', (e) => this._onEnd(e, container));
  }

  _getPosition(e) {
    if (e.touches && e.touches.length > 0) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  }

  _onStart(e, container) {
    // Don't intercept if on the actual input range
    if (e.target.classList.contains('slider-input')) return;

    const pos = this._getPosition(e);
    this.startPos = pos;
    this.startTime = Date.now();
    this.activeGesture = {
      container,
      command: container.dataset.command,
      startValue: this._getCurrentValue(container)
    };

    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      if (this._isLongPress(pos)) {
        this._onLongPress(container);
      }
    }, this.LONG_PRESS_MS);

    container.classList.add('gesture-active');
  }

  _onMove(e, container) {
    if (!this.activeGesture || this.activeGesture.container !== container) return;

    const pos = this._getPosition(e);
    const deltaX = pos.x - this.startPos.x;
    const deltaY = pos.y - this.startPos.y;
    const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Cancel long press if moved too much
    if (movement > this.LONG_PRESS_MAX_MOVE) {
      this._cancelLongPress();
    }

    // Visual feedback for potential swipe
    if (Math.abs(deltaX) > 20 && Math.abs(deltaY) < this.SWIPE_MAX_Y) {
      container.style.transform = `translateX(${deltaX * 0.3}px)`;
      container.style.opacity = 1 - Math.abs(deltaX) / 200;
    }
  }

  _onEnd(e, container) {
    if (!this.activeGesture || this.activeGesture.container !== container) return;

    this._cancelLongPress();

    const pos = this._getPosition(e) || this.startPos;
    const deltaX = pos.x - this.startPos.x;
    const deltaY = pos.y - this.startPos.y;
    const duration = Date.now() - this.startTime;

    // Reset visual state
    container.style.transform = '';
    container.style.opacity = '';
    container.classList.remove('gesture-active');

    // Check for swipe
    const isSwipe = Math.abs(deltaX) > this.SWIPE_THRESHOLD &&
                    Math.abs(deltaY) < this.SWIPE_MAX_Y;

    if (isSwipe) {
      const direction = deltaX > 0 ? 'right' : 'left';
      this._onSwipe(container, direction);
    }

    this.activeGesture = null;
  }

  _isLongPress(currentPos) {
    const deltaX = currentPos.x - this.startPos.x;
    const deltaY = currentPos.y - this.startPos.y;
    const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    return movement < this.LONG_PRESS_MAX_MOVE;
  }

  _cancelLongPress() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  _getCurrentValue(container) {
    const input = container.querySelector('.slider-input');
    return input ? parseFloat(input.value) : 0;
  }

  _onSwipe(container, direction) {
    const command = container.dataset.command;

    if (direction === 'left') {
      // Archive the slider
      container.style.transition = 'transform 0.2s, opacity 0.2s';
      container.style.transform = 'translateX(-100%)';
      container.style.opacity = '0';

      setTimeout(() => {
        this.sliderManager.archive(command);
        container.style.transition = '';
        container.style.transform = '';
        container.style.opacity = '';
      }, 200);

      console.log(`[SliderGestures] Archived: ${command}`);
    } else if (direction === 'right') {
      // Future: Add to quick settings
      container.style.transition = 'transform 0.2s';
      container.style.transform = 'translateX(0)';

      console.log(`[SliderGestures] Quick settings: ${command} (not yet implemented)`);
    }
  }

  _onLongPress(container) {
    const command = container.dataset.command;

    // Visual feedback
    container.classList.add('long-press');

    // Future: MIDI learn mode
    console.log(`[SliderGestures] Long press on: ${command} (MIDI learn not yet implemented)`);

    setTimeout(() => {
      container.classList.remove('long-press');
    }, 500);
  }
}

export default SliderGestures;
