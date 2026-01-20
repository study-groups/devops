/**
 * DesignInspector Panel
 * UI creation and property rendering
 */

import { PROPERTY_SCHEMA, COLOR_TOKENS } from './config.js';
import { getCurrentTheme, getCssSelector, getDomPath, getDomPathElements } from './selectors.js';

// Store path elements for click handling
let currentPathElements = [];

/**
 * Create the inspector panel element
 */
export function createPanel() {
  const panel = document.createElement('div');
  panel.className = 'inspector-panel';
  panel.innerHTML = `
    <div class="inspector-panel-header">
      <span class="inspector-panel-title">Element Editor</span>
      <div class="inspector-panel-actions">
        <button class="inspector-btn" data-action="copyInfo" title="Copy info for LLM">Copy</button>
        <button class="inspector-btn" data-action="pick" title="Pick another element">Pick</button>
        <button class="inspector-btn-close" data-action="close">&times;</button>
      </div>
    </div>
    <div class="inspector-panel-info"></div>
    <div class="inspector-panel-body"></div>
    <div class="inspector-panel-footer">
      <button class="inspector-btn inspector-btn-primary" data-action="apply">Apply</button>
      <button class="inspector-btn" data-action="clear">Clear</button>
      <button class="inspector-btn" data-action="exportCss">CSS</button>
      <button class="inspector-btn" data-action="export">JSON</button>
      <button class="inspector-btn" data-action="import">Import</button>
    </div>
  `;
  document.body.appendChild(panel);
  return panel;
}

/**
 * Initialize panel dragging
 */
export function initPanelDrag(panel) {
  const header = panel.querySelector('.inspector-panel-header');
  let isDragging = false;
  let offset = { x: 0, y: 0 };

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('button')) return;
    isDragging = true;
    const rect = panel.getBoundingClientRect();
    offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    panel.style.transition = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const x = Math.max(0, Math.min(e.clientX - offset.x, window.innerWidth - panel.offsetWidth));
    const y = Math.max(0, Math.min(e.clientY - offset.y, window.innerHeight - panel.offsetHeight));
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    panel.style.transition = '';
  });
}

/**
 * Update the panel info section for an element
 */
export function updatePanelInfo(panel, el) {
  const theme = getCurrentTheme();
  const cssSelector = getCssSelector(el);
  const designId = el.dataset.designId || 'none';

  // Get path elements for clickable navigation
  currentPathElements = getDomPathElements(el);

  // Build clickable path HTML
  const pathLinks = currentPathElements.map((item, index) => {
    const isLast = index === currentPathElements.length - 1;
    const linkClass = isLast ? 'inspector-path-link inspector-path-link--current' : 'inspector-path-link';
    return `<a href="#" class="${linkClass}" data-path-index="${index}">${item.label}</a>`;
  }).join('<span class="inspector-path-sep"> &gt; </span>');

  const info = panel.querySelector('.inspector-panel-info');
  if (info) {
    info.innerHTML = `
      <div class="inspector-selector-row">
        <span class="inspector-selector-label">CSS:</span>
        <code class="inspector-selector-value">${cssSelector}</code>
      </div>
      <div class="inspector-path-row">
        <span class="inspector-path-label">Path:</span>
        <div class="inspector-path-links">${pathLinks}</div>
      </div>
      <div class="inspector-meta-row">
        <span class="inspector-meta-item">design-id: <strong>${designId}</strong></span>
        <span class="inspector-meta-item">Theme: <strong>${theme}</strong></span>
      </div>
    `;
  }
}

/**
 * Get the element at a specific path index
 */
export function getPathElement(index) {
  if (index >= 0 && index < currentPathElements.length) {
    return currentPathElements[index].element;
  }
  return null;
}

/**
 * Build property sections HTML for an element
 */
export function buildPropertySections(el, overrides) {
  const computed = getComputedStyle(el);
  const theme = getCurrentTheme();
  const globalOverrides = overrides.global?.[`[data-design-id="${el.dataset.designId}"]`] || {};
  const themeOverrides = overrides.themes?.[theme]?.[`[data-design-id="${el.dataset.designId}"]`] || {};
  let html = '';

  for (const [key, section] of Object.entries(PROPERTY_SCHEMA)) {
    const collapsed = section.collapsed ? 'collapsed' : '';
    const scopeLabel = section.scope === 'theme' ? ' (theme)' : ' (global)';
    html += `
      <div class="inspector-section ${collapsed}" data-section="${key}" data-scope="${section.scope}">
        <div class="inspector-section-header">
          <span>${section.title}<span class="inspector-scope-badge">${scopeLabel}</span></span>
          <span class="toggle-icon">${section.collapsed ? '▶' : '▼'}</span>
        </div>
        <div class="inspector-section-content">
    `;

    for (const prop of section.properties) {
      const sectionOverrides = section.scope === 'theme' ? themeOverrides : globalOverrides;
      html += buildPropertyRow(prop, computed, sectionOverrides, section.scope);
    }

    html += `
        </div>
      </div>
    `;
  }

  return html;
}

/**
 * Build HTML for a single property row
 */
function buildPropertyRow(prop, computed, overrides, scope) {
  if (prop.type === 'grid') {
    return buildGridRow(prop, computed, overrides, scope);
  } else if (prop.type === 'quad') {
    return buildQuadRow(prop, computed, overrides, scope);
  } else if (prop.type === 'token') {
    return buildTokenRow(prop, computed, overrides, scope);
  } else if (prop.type === 'select') {
    return buildSelectRow(prop, computed, overrides, scope);
  } else {
    return buildTextRow(prop, computed, overrides, scope);
  }
}

function buildGridRow(prop, computed, overrides, scope) {
  let html = `<div class="inspector-grid-row">
    <label class="inspector-grid-label">${prop.label}</label>
    <div class="inspector-grid-inputs">`;

  for (const field of prop.fields) {
    const computedValue = computed.getPropertyValue(field.name) || '';
    const overrideValue = overrides[field.name];
    const value = overrideValue !== undefined ? overrideValue : computedValue;
    const isOverridden = overrideValue !== undefined;
    html += `
      <div class="inspector-grid-field ${isOverridden ? 'overridden' : ''}">
        <span class="inspector-grid-field-label">${field.label}</span>
        <input type="text" class="inspector-grid-input" data-prop="${field.name}" data-scope="${scope}" value="${value.trim()}" placeholder="${field.placeholder || ''}">
      </div>`;
  }

  html += `</div></div>`;
  return html;
}

function buildQuadRow(prop, computed, overrides, scope) {
  const sideLabels = ['T', 'R', 'B', 'L'];
  let html = `<div class="inspector-quad-row">
    <label class="inspector-quad-label">${prop.label}</label>
    <div class="inspector-quad-inputs">`;

  prop.sides.forEach((side, i) => {
    const computedValue = computed.getPropertyValue(side) || '0px';
    const overrideValue = overrides[side];
    const value = overrideValue !== undefined ? overrideValue : computedValue;
    const isOverridden = overrideValue !== undefined;
    html += `
      <div class="inspector-quad-field ${isOverridden ? 'overridden' : ''}">
        <span class="inspector-quad-side">${sideLabels[i]}</span>
        <input type="text" class="inspector-quad-input" data-prop="${side}" data-scope="${scope}" value="${value.trim()}" placeholder="0">
      </div>`;
  });

  html += `</div></div>`;
  return html;
}

function buildTokenRow(prop, computed, overrides, scope) {
  const computedValue = computed.getPropertyValue(prop.name) || '';
  const overrideValue = overrides[prop.name];
  const value = overrideValue !== undefined ? overrideValue : '';
  const isOverridden = overrideValue !== undefined;

  return `
    <div class="inspector-prop-row ${isOverridden ? 'overridden' : ''}">
      <label class="inspector-prop-label">${prop.label}</label>
      <select class="inspector-token-select" data-prop="${prop.name}" data-scope="${scope}">
        <option value="">-- computed --</option>
        ${COLOR_TOKENS.map(t => `<option value="${t.value}" ${value === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
      </select>
    </div>
  `;
}

function buildSelectRow(prop, computed, overrides, scope) {
  const computedValue = computed.getPropertyValue(prop.name) || '';
  const overrideValue = overrides[prop.name];
  const value = overrideValue !== undefined ? overrideValue : computedValue;
  const isOverridden = overrideValue !== undefined;

  return `
    <div class="inspector-prop-row ${isOverridden ? 'overridden' : ''}">
      <label class="inspector-prop-label">${prop.label}</label>
      <select class="inspector-select-input" data-prop="${prop.name}" data-scope="${scope}">
        ${prop.options.map(opt => `<option value="${opt}" ${value.includes(opt) ? 'selected' : ''}>${opt}</option>`).join('')}
      </select>
    </div>
  `;
}

function buildTextRow(prop, computed, overrides, scope) {
  const computedValue = computed.getPropertyValue(prop.name) || '';
  const overrideValue = overrides[prop.name];
  const value = overrideValue !== undefined ? overrideValue : computedValue;
  const isOverridden = overrideValue !== undefined;

  return `
    <div class="inspector-prop-row ${isOverridden ? 'overridden' : ''}">
      <label class="inspector-prop-label">${prop.label}</label>
      <input type="text" class="inspector-text-input" data-prop="${prop.name}" data-scope="${scope}" value="${value.trim()}" placeholder="${prop.placeholder || ''}">
    </div>
  `;
}

/**
 * Update the panel body with property sections
 */
export function updatePanelBody(panel, el, overrides) {
  const body = panel.querySelector('.inspector-panel-body');
  if (body) {
    body.innerHTML = buildPropertySections(el, overrides);
  }
}

/**
 * Show the panel
 */
export function showPanel(panel) {
  panel.classList.add('visible');
}

/**
 * Hide the panel
 */
export function hidePanel(panel) {
  panel.classList.remove('visible');
}

/**
 * Flash feedback on a button
 */
export function flashFeedback(btn, text) {
  const original = btn.textContent;
  btn.textContent = text;
  btn.classList.add('feedback-success');
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove('feedback-success');
  }, 1000);
}

/**
 * Generate formatted info string for LLM
 */
export function generateLLMInfo(el, overrides) {
  const computed = getComputedStyle(el);
  const theme = getCurrentTheme();
  const cssSelector = getCssSelector(el);
  const domPath = getDomPath(el);
  const designId = el.dataset.designId || 'none';

  let info = `## Element Inspector Info\n\n`;
  info += `**CSS Selector:** \`${cssSelector}\`\n`;
  info += `**DOM Path:** \`${domPath}\`\n`;
  info += `**Design ID:** ${designId}\n`;
  info += `**Theme:** ${theme}\n\n`;

  // Element tag and classes
  info += `**Tag:** ${el.tagName.toLowerCase()}\n`;
  if (el.className) {
    info += `**Classes:** ${el.className}\n`;
  }
  info += `\n`;

  // Computed styles by section
  info += `### Computed Styles\n\n`;

  for (const [key, section] of Object.entries(PROPERTY_SCHEMA)) {
    info += `#### ${section.title}\n`;

    for (const prop of section.properties) {
      if (prop.type === 'grid') {
        for (const field of prop.fields) {
          const value = computed.getPropertyValue(field.name).trim();
          if (value) {
            info += `- ${field.name}: ${value}\n`;
          }
        }
      } else if (prop.type === 'quad') {
        for (const side of prop.sides) {
          const value = computed.getPropertyValue(side).trim();
          if (value) {
            info += `- ${side}: ${value}\n`;
          }
        }
      } else {
        const value = computed.getPropertyValue(prop.name).trim();
        if (value) {
          info += `- ${prop.name}: ${value}\n`;
        }
      }
    }
    info += `\n`;
  }

  // Current overrides
  const globalOverrides = overrides.global?.[`[data-design-id="${designId}"]`] || {};
  const themeOverrides = overrides.themes?.[theme]?.[`[data-design-id="${designId}"]`] || {};

  if (Object.keys(globalOverrides).length > 0 || Object.keys(themeOverrides).length > 0) {
    info += `### Current Overrides\n\n`;

    if (Object.keys(globalOverrides).length > 0) {
      info += `#### Global Overrides\n`;
      for (const [prop, value] of Object.entries(globalOverrides)) {
        info += `- ${prop}: ${value}\n`;
      }
      info += `\n`;
    }

    if (Object.keys(themeOverrides).length > 0) {
      info += `#### Theme Overrides (${theme})\n`;
      for (const [prop, value] of Object.entries(themeOverrides)) {
        info += `- ${prop}: ${value}\n`;
      }
      info += `\n`;
    }
  }

  return info;
}

/**
 * Copy info to clipboard
 */
export async function copyInfoToClipboard(el, overrides) {
  const info = generateLLMInfo(el, overrides);
  await navigator.clipboard.writeText(info);
  return info;
}
