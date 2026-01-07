/**
 * UrlResolver - Game URL and variant resolution
 *
 * Handles selecting the right game variant (default/demo/dev)
 * based on availability and user access.
 */

export class UrlResolver {
  /**
   * @param {string} apiGateway - Base path for game files API (e.g., '/api/game-files')
   */
  constructor(apiGateway = '/api/game-files') {
    this.apiGateway = apiGateway;
  }

  /**
   * Resolve game URL with variant selection
   * @param {object} game - Game config with engine topic
   * @param {object} user - User context { isAuth, role, subscription }
   * @param {string} [requestedVariant='default'] - Requested variant
   * @returns {{ url: string, variant: string, path: string, availableVariants: Array }}
   */
  resolve(game, user = {}, requestedVariant = 'default') {
    const engine = game.engine || {};

    // Determine which variant to use
    const variant = this.resolveVariant(engine, user, requestedVariant);
    const path = this.getVariantPath(engine, variant);

    if (!path) {
      throw new Error(`No valid path for game '${game.slug}' variant '${variant}'`);
    }

    return {
      url: `${this.apiGateway}/${path}`,
      variant,
      requestedVariant,
      path,
      availableVariants: this.getAvailableVariants(engine, user),
    };
  }

  /**
   * Resolve which variant to use
   */
  resolveVariant(engine, user, requested) {
    // If requested variant is available and accessible, use it
    if (this.isVariantAvailable(engine, requested) &&
        this.canAccessVariant(requested, user)) {
      return requested;
    }

    // Otherwise, select best available
    return this.selectBestVariant(engine, user);
  }

  /**
   * Get path for a variant
   */
  getVariantPath(engine, variant) {
    switch (variant) {
      case 'demo':
        return engine.path_demo || engine.path;
      case 'dev':
        return engine.path_dev || engine.path;
      default:
        return engine.path;
    }
  }

  /**
   * Check if variant is available
   */
  isVariantAvailable(engine, variant) {
    switch (variant) {
      case 'default':
        return !!engine.path;
      case 'demo':
        return !!engine.path_demo;
      case 'dev':
        return !!engine.path_dev;
      default:
        return false;
    }
  }

  /**
   * Check if user can access variant
   */
  canAccessVariant(variant, user) {
    if (variant === 'dev') {
      return user.role === 'dev' || user.role === 'admin';
    }
    return true;
  }

  /**
   * Get list of available variants for user
   */
  getAvailableVariants(engine, user) {
    return ['default', 'demo', 'dev']
      .filter(v => this.isVariantAvailable(engine, v) && this.canAccessVariant(v, user))
      .map(v => ({
        name: v,
        path: this.getVariantPath(engine, v),
        accessible: true,
      }));
  }

  /**
   * Select best available variant
   */
  selectBestVariant(engine, user) {
    // Prefer dev for dev/admin users
    if (this.isVariantAvailable(engine, 'dev') && this.canAccessVariant('dev', user)) {
      return 'dev';
    }
    // Then default
    if (this.isVariantAvailable(engine, 'default')) {
      return 'default';
    }
    // Finally demo
    if (this.isVariantAvailable(engine, 'demo')) {
      return 'demo';
    }

    throw new Error('No available variants');
  }
}
