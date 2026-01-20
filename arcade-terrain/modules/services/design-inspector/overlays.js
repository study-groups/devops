/**
 * DesignInspector Overlays
 * Visual feedback for element selection
 */

/**
 * Create the selection overlay element
 */
export function createSelectionOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'inspector-selection-overlay';
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    border: 2px solid var(--accent-primary, #00e1cf);
    background: rgba(0, 225, 207, 0.1);
    z-index: 9998;
    display: none;
  `;
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Create the hover overlay element
 */
export function createHoverOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'inspector-hover-overlay';
  overlay.innerHTML = `<div class="inspector-hover-label"></div>`;
  overlay.style.cssText = `
    position: fixed;
    pointer-events: none;
    border: 2px dashed var(--two, #f04f4a);
    background: rgba(240, 79, 74, 0.1);
    z-index: 9997;
    display: none;
  `;
  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Show hover overlay on an element
 */
export function showHoverOverlay(overlay, el, selectedElement) {
  if (!overlay || el === selectedElement) return;

  const rect = el.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.top = rect.top + 'px';
  overlay.style.left = rect.left + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';

  const label = overlay.querySelector('.inspector-hover-label');
  if (label) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.classList.length > 0 ? `.${Array.from(el.classList).slice(0, 2).join('.')}` : '';
    label.textContent = `${tag}${id}${cls}`;
  }
}

/**
 * Hide hover overlay
 */
export function hideHoverOverlay(overlay) {
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Show selection overlay on an element
 */
export function showSelectionOverlay(overlay, el) {
  if (!overlay) return;
  const rect = el.getBoundingClientRect();
  overlay.style.display = 'block';
  overlay.style.top = rect.top + 'px';
  overlay.style.left = rect.left + 'px';
  overlay.style.width = rect.width + 'px';
  overlay.style.height = rect.height + 'px';
}

/**
 * Hide selection overlay
 */
export function hideSelectionOverlay(overlay) {
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * Remove all overlays
 */
export function removeOverlays(selectionOverlay, hoverOverlay) {
  if (selectionOverlay) selectionOverlay.remove();
  if (hoverOverlay) hoverOverlay.remove();
}
