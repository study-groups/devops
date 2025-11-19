/**
 * linkSettings.js
 *
 * Provides link rewriting settings for different contexts (preview, publish, etc.)
 * Used by LinkManager to determine how to transform URLs for images, links, and resources
 */

/**
 * Get link settings for a specific context
 * @param {string} context - The context ('preview', 'publish', etc.)
 * @returns {Object} Settings object with baseURL, imageRoot, etc.
 */
export function getLinkSettings(context = 'preview') {
  const settings = {
    preview: {
      baseURL: '/',
      imageRoot: '/images',
      assetRoot: '/assets',
      rewriteAbsolutePaths: false,
      rewriteRelativePaths: true,
      // In preview mode, paths are typically served from the development server
      pathPrefix: ''
    },
    publish: {
      baseURL: '/',
      imageRoot: '/images',
      assetRoot: '/assets',
      rewriteAbsolutePaths: true,
      rewriteRelativePaths: true,
      // In publish mode, paths may need to be adjusted for deployment
      pathPrefix: ''
    },
    local: {
      baseURL: 'file://',
      imageRoot: './images',
      assetRoot: './assets',
      rewriteAbsolutePaths: true,
      rewriteRelativePaths: true,
      // In local mode, paths are relative to the file system
      pathPrefix: './'
    }
  };

  return settings[context] || settings.preview;
}

/**
 * Get default link settings
 * @returns {Object} Default settings
 */
export function getDefaultLinkSettings() {
  return getLinkSettings('preview');
}

export default {
  getLinkSettings,
  getDefaultLinkSettings
};
