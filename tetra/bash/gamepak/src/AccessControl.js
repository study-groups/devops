/**
 * AccessControl - Role/subscription access logic
 *
 * Ported from GameUrlResolver.js
 */

const DEFAULT_ROLE_HIERARCHY = {
  guest: 0,
  user: 1,
  premium: 2,
  dev: 3,
  admin: 4,
};

const DEFAULT_SUBSCRIPTION_HIERARCHY = {
  free: 0,
  basic: 1,
  pro: 2,
};

export class AccessControl {
  /**
   * @param {object} [config] - Access strategies from manifest._config
   */
  constructor(config = {}) {
    const strategies = config.access_strategies || {};

    this.roleHierarchy = strategies.role_based?.hierarchy || DEFAULT_ROLE_HIERARCHY;
    this.subscriptionHierarchy = strategies.subscription_based?.hierarchy || DEFAULT_SUBSCRIPTION_HIERARCHY;
  }

  /**
   * Check if user can access a game
   * @param {object} game - Game config with permissions topic
   * @param {object} user - User context { isAuth, role, subscription }
   * @returns {{ allowed: boolean, reason?: string, code?: string, accessLevel?: string }}
   */
  checkAccess(game, user = {}) {
    const permissions = game.permissions || {};

    // Check authentication requirement
    if (permissions.requires_auth && !user.isAuth) {
      return {
        allowed: false,
        reason: 'Authentication required',
        code: 'AUTH_REQUIRED',
      };
    }

    // Check role hierarchy
    const roleCheck = this.checkRole(permissions.min_role, user.role);
    if (!roleCheck.allowed) {
      return roleCheck;
    }

    // Dev/admin bypass subscription check
    if (user.role === 'dev' || user.role === 'admin') {
      return {
        allowed: true,
        accessLevel: this.determineAccessLevel(user),
        userRole: user.role,
        userSubscription: user.subscription,
      };
    }

    // Check subscription tier
    const subCheck = this.checkSubscription(permissions.min_subscription, user.subscription);
    if (!subCheck.allowed) {
      return subCheck;
    }

    return {
      allowed: true,
      accessLevel: this.determineAccessLevel(user),
      userRole: user.role,
      userSubscription: user.subscription,
    };
  }

  /**
   * Check role access
   */
  checkRole(requiredRole, userRole = 'guest') {
    if (!requiredRole) return { allowed: true };

    const required = this.roleHierarchy[requiredRole];
    const user = this.roleHierarchy[userRole];

    if (required === undefined) return { allowed: true };
    if (user === undefined) {
      return {
        allowed: false,
        reason: 'Invalid role',
        code: 'INVALID_ROLE',
      };
    }
    if (user < required) {
      return {
        allowed: false,
        reason: `Requires ${requiredRole} role`,
        code: 'INSUFFICIENT_ROLE',
      };
    }

    return { allowed: true };
  }

  /**
   * Check subscription access
   */
  checkSubscription(requiredSub, userSub = 'free') {
    if (!requiredSub) return { allowed: true };

    const required = this.subscriptionHierarchy[requiredSub];
    const user = this.subscriptionHierarchy[userSub];

    if (required === undefined) return { allowed: true };
    if (user === undefined) {
      return {
        allowed: false,
        reason: 'Invalid subscription',
        code: 'INVALID_SUBSCRIPTION',
      };
    }
    if (user < required) {
      return {
        allowed: false,
        reason: `Requires ${requiredSub} subscription`,
        code: 'INSUFFICIENT_SUBSCRIPTION',
      };
    }

    return { allowed: true };
  }

  /**
   * Determine user's access level string
   */
  determineAccessLevel(user) {
    if (!user.isAuth) return 'guest';
    if (user.role === 'admin') return 'admin';
    if (user.role === 'dev') return 'developer';

    const roleLevel = this.roleHierarchy[user.role] || 0;
    const subLevel = this.subscriptionHierarchy[user.subscription] || 0;

    if (roleLevel >= 2 || subLevel >= 2) return 'premium';
    if (roleLevel >= 1 || subLevel >= 1) return 'basic';

    return 'free';
  }
}
