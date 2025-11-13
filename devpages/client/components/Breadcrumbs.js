/**
 * Breadcrumbs.js - Clean Breadcrumb Navigation Component
 *
 * A stateless breadcrumb component that:
 * - Reads breadcrumbs from Redux state (computed from path)
 * - Dispatches navigation via PathNavigator service
 * - No side effects, no data fetching
 */

import { selectBreadcrumbs, selectCurrentPath } from '../store/slices/pathSlice.v2.js';
import { getPathNavigator } from '../services/PathNavigator.js';

export class BreadcrumbsComponent {
  constructor(store) {
    this.store = store;
    this.navigator = getPathNavigator();
    this.element = null;
    this.unsubscribe = null;
  }

  /**
   * Mount the component
   */
  mount(containerElement) {
    if (!containerElement) {
      console.error('[Breadcrumbs] No container element provided');
      return;
    }

    this.element = containerElement;

    // Subscribe to store changes
    this.unsubscribe = this.store.subscribe(() => {
      this.render();
    });

    // Initial render
    this.render();
  }

  /**
   * Render breadcrumbs
   */
  render() {
    if (!this.element) return;

    const state = this.store.getState();
    const breadcrumbs = selectBreadcrumbs(state);
    const currentPath = selectCurrentPath(state);

    // Build breadcrumb HTML
    const breadcrumbsHTML = breadcrumbs.map((crumb, index) => {
      const isLast = index === breadcrumbs.length - 1;
      const isCurrent = crumb.path === currentPath.pathname;

      if (isLast && isCurrent) {
        // Last breadcrumb (current location) - not clickable
        return `
          <span class="breadcrumb-item current">
            ${this._escapeHtml(crumb.name)}
          </span>
        `;
      } else {
        // Clickable breadcrumb
        return `
          <a href="#"
             class="breadcrumb-item link"
             data-path="${this._escapeHtml(crumb.path)}"
             title="Navigate to ${this._escapeHtml(crumb.path)}">
            ${this._escapeHtml(crumb.name)}
          </a>
          <span class="breadcrumb-separator">/</span>
        `;
      }
    }).join('');

    this.element.innerHTML = `
      <div class="breadcrumbs-container">
        ${breadcrumbsHTML}
      </div>
    `;

    // Attach click handlers
    this._attachHandlers();
  }

  /**
   * Attach event handlers
   */
  _attachHandlers() {
    if (!this.element) return;

    // Handle breadcrumb clicks
    const links = this.element.querySelectorAll('.breadcrumb-item.link');
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const path = e.currentTarget.dataset.path;
        if (path) {
          console.log('[Breadcrumbs] Navigating to:', path);
          this.navigator.navigateToBreadcrumb(path);
        }
      });
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Unmount and cleanup
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.element) {
      this.element.innerHTML = '';
      this.element = null;
    }
  }
}

/**
 * Factory function to create breadcrumb component
 */
export function createBreadcrumbsComponent(store, containerElement) {
  const component = new BreadcrumbsComponent(store);
  if (containerElement) {
    component.mount(containerElement);
  }
  return component;
}
