/**
 * Centralized configuration
 */

export const JWT_SECRET = process.env.JWT_SECRET || 'pbase-dev-secret';
export const JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';
