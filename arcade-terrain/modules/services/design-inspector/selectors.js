/**
 * DesignInspector Selector Utilities
 * DOM traversal and selector generation
 */

let designIdCounter = 0;

/**
 * Generate a unique design ID for an element
 */
export function generateDesignId() {
  return `did-${Date.now()}-${++designIdCounter}`;
}

/**
 * Get the current theme from document
 */
export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'default';
}

/**
 * Convert RGB color string to hex
 */
export function rgbToHex(rgb) {
  if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return '#000000';
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return '#000000';
  const r = parseInt(match[1]).toString(16).padStart(2, '0');
  const g = parseInt(match[2]).toString(16).padStart(2, '0');
  const b = parseInt(match[3]).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/**
 * Get runtime selector for element (prefers data-design-id)
 */
export function getElementSelector(el) {
  if (el.dataset.designId) {
    return `[data-design-id="${el.dataset.designId}"]`;
  }
  if (el.id) {
    return `#${el.id}`;
  }
  const classes = Array.from(el.classList).filter(c => !c.startsWith('inspector-'));
  if (classes.length > 0) {
    return `.${classes.join('.')}`;
  }
  return null;
}

/**
 * Get CSS-file-friendly selector (prefers classes/ids over data-design-id)
 */
export function getCssSelector(el) {
  if (el.id) {
    return `#${el.id}`;
  }
  const classes = Array.from(el.classList).filter(c => !c.startsWith('inspector-') && !c.startsWith('did-'));
  if (classes.length > 0) {
    return `.${classes.join('.')}`;
  }
  // Build a path-based selector
  const path = [];
  let current = el;
  while (current && current !== document.body) {
    let segment = current.tagName.toLowerCase();
    if (current.id) {
      segment = `#${current.id}`;
      path.unshift(segment);
      break;
    } else {
      const cls = Array.from(current.classList).filter(c => !c.startsWith('inspector-'));
      if (cls.length > 0) {
        segment += `.${cls[0]}`;
      }
    }
    path.unshift(segment);
    current = current.parentElement;
  }
  return path.join(' > ');
}

/**
 * Build a full DOM path for display
 */
export function getDomPath(el) {
  const parts = [];
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
    } else if (current.classList.length > 0) {
      selector += `.${Array.from(current.classList).slice(0, 2).join('.')}`;
    }
    parts.unshift(selector);
    current = current.parentElement;
  }
  return parts.join(' > ');
}

/**
 * Get DOM path as array of {element, label} objects for clickable navigation
 */
export function getDomPathElements(el) {
  const elements = [];
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    let label = current.tagName.toLowerCase();
    if (current.id) {
      label += `#${current.id}`;
    } else if (current.classList.length > 0) {
      const classes = Array.from(current.classList)
        .filter(c => !c.startsWith('inspector-'))
        .slice(0, 2);
      if (classes.length > 0) {
        label += `.${classes.join('.')}`;
      }
    }
    elements.unshift({ element: current, label });
    current = current.parentElement;
  }
  return elements;
}

/**
 * Check if element is part of inspector UI
 */
export function isInspectorElement(el) {
  return el.closest('.design-panel, .design-fab, .inspector-panel, .inspector-hover-overlay, .inspector-selection-overlay');
}
