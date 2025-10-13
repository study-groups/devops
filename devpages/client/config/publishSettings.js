/**
 * PublishSettings - Configuration for publishing system
 * Defines defaults and options for publishing markdown to HTML
 */

/**
 * Default publish settings
 */
export const publishDefaults = {
  // CSS bundling
  bundleCSS: true,              // Include CSS in published HTML
  cssMode: 'inline',            // 'inline' | 'external-cdn' | 'none'
  includeBaseCSS: true,         // Include base styling CSS

  // Script handling
  bundleScripts: false,         // DON'T include JS by default (security)
  scriptSandbox: 'strict',      // 'strict' | 'trusted' | 'none'
  includeInlineScripts: false,  // Include frontmatter scripts
  includeExternalScripts: false, // Include js_includes

  // Meta tags and SEO
  includeMetaTags: true,        // SEO meta tags from frontmatter
  generateSitemap: false,       // Generate sitemap.xml
  robots: 'index,follow',       // robots meta tag

  // Publishing mode
  mode: 's3',                   // 's3' | 'local' | 'download'
  publicPath: 'published/',     // S3 prefix for published files

  // CDN and external resources
  cdnPath: null,                // Custom CDN override
  externalBaseURL: null,        // Base URL for external resources

  // Index generation
  indexPage: false,             // Generate index.html listing
  indexTemplate: 'default',     // Index template to use

  // Publishing workflow
  autoPublish: false,           // Auto-publish on save
  publishDrafts: false,         // Publish draft frontmatter files
  versionControl: true,         // Keep version history

  // Sanitization
  sanitizeHTML: true,           // Use DOMPurify
  allowIframes: false,          // Allow iframe tags
  allowScripts: false,          // Allow script tags (overridden by bundleScripts)

  // Plugin handling
  includePluginCSS: true,       // Bundle plugin CSS (KaTeX, Mermaid, etc.)
  includePluginScripts: false,  // Bundle plugin scripts (security risk)

  // Performance
  minifyCSS: false,             // Minify CSS in production
  minifyHTML: false,            // Minify HTML output
  compressImages: false,        // Optimize images before upload

  // Publishing metadata
  addGenerator: true,           // Add "generator" meta tag
  addTimestamp: true,           // Add publish timestamp
  addSourceInfo: false          // Add source file info (debug)
};

/**
 * CSS mode options
 */
export const cssModes = {
  inline: {
    id: 'inline',
    label: 'Inline CSS',
    description: 'Bundle all CSS directly in HTML (best for standalone pages)'
  },
  'external-cdn': {
    id: 'external-cdn',
    label: 'External CDN',
    description: 'Link to external CDN for plugin CSS (smaller files, requires internet)'
  },
  none: {
    id: 'none',
    label: 'No CSS',
    description: 'No CSS included (for custom styling)'
  }
};

/**
 * Script sandbox options
 */
export const scriptSandboxOptions = {
  strict: {
    id: 'strict',
    label: 'Strict (No Scripts)',
    description: 'No scripts included (safest option)'
  },
  trusted: {
    id: 'trusted',
    label: 'Trusted (Inline Only)',
    description: 'Only frontmatter inline scripts (moderate risk)'
  },
  none: {
    id: 'none',
    label: 'No Restrictions',
    description: 'All scripts included (security risk)'
  }
};

/**
 * Publish mode options
 */
export const publishModes = {
  s3: {
    id: 's3',
    label: 'DigitalOcean Spaces',
    description: 'Publish to S3-compatible storage (DigitalOcean Spaces)'
  },
  local: {
    id: 'local',
    label: 'Local Server',
    description: 'Publish to local server directory'
  },
  download: {
    id: 'download',
    label: 'Download HTML',
    description: 'Download HTML file to your computer'
  }
};

/**
 * Get publish settings from Redux store
 * @param {Object} state - Redux state
 * @returns {Object} Merged publish settings
 */
export function getPublishSettings(state) {
  const userSettings = state.settings?.publish || {};
  return { ...publishDefaults, ...userSettings };
}

/**
 * Get publish settings for a specific file (can override from frontmatter)
 * @param {Object} state - Redux state
 * @param {Object} frontMatter - Frontmatter object
 * @returns {Object} Merged settings
 */
export function getFilePublishSettings(state, frontMatter = {}) {
  const baseSettings = getPublishSettings(state);

  // Frontmatter can override publish settings
  const frontMatterOverrides = {};

  if (frontMatter.publish_settings) {
    Object.assign(frontMatterOverrides, frontMatter.publish_settings);
  }

  // Specific frontmatter fields can override settings
  if (frontMatter.bundle_css !== undefined) {
    frontMatterOverrides.bundleCSS = frontMatter.bundle_css;
  }

  if (frontMatter.bundle_scripts !== undefined) {
    frontMatterOverrides.bundleScripts = frontMatter.bundle_scripts;
  }

  if (frontMatter.robots !== undefined) {
    frontMatterOverrides.robots = frontMatter.robots;
  }

  return { ...baseSettings, ...frontMatterOverrides };
}

/**
 * Validate publish settings
 * @param {Object} settings - Settings to validate
 * @returns {Object} { valid, errors }
 */
export function validatePublishSettings(settings) {
  const errors = [];

  // Validate CSS mode
  if (settings.cssMode && !cssModes[settings.cssMode]) {
    errors.push(`Invalid cssMode: ${settings.cssMode}`);
  }

  // Validate script sandbox
  if (settings.scriptSandbox && !scriptSandboxOptions[settings.scriptSandbox]) {
    errors.push(`Invalid scriptSandbox: ${settings.scriptSandbox}`);
  }

  // Validate publish mode
  if (settings.mode && !publishModes[settings.mode]) {
    errors.push(`Invalid mode: ${settings.mode}`);
  }

  // Validate public path
  if (settings.publicPath && typeof settings.publicPath !== 'string') {
    errors.push('publicPath must be a string');
  }

  // Security checks
  if (settings.bundleScripts && settings.scriptSandbox === 'strict') {
    errors.push('Cannot bundle scripts with strict sandbox');
  }

  if (settings.allowScripts && !settings.sanitizeHTML) {
    errors.push('Allowing scripts without sanitization is dangerous');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get default settings for a specific mode
 * @param {string} mode - Publish mode ('preview', 'publish', 'export')
 * @returns {Object} Default settings for mode
 */
export function getDefaultsForMode(mode) {
  switch (mode) {
    case 'preview':
      return {
        ...publishDefaults,
        bundleScripts: true,
        includeInlineScripts: true,
        includeExternalScripts: true,
        scriptSandbox: 'none',
        sanitizeHTML: true,
        allowIframes: true
      };

    case 'publish':
      return {
        ...publishDefaults,
        bundleScripts: false,
        includeInlineScripts: false,
        includeExternalScripts: false,
        scriptSandbox: 'strict',
        sanitizeHTML: true,
        allowIframes: false,
        minifyCSS: true,
        minifyHTML: true
      };

    case 'export':
      return {
        ...publishDefaults,
        mode: 'download',
        bundleCSS: true,
        cssMode: 'inline',
        bundleScripts: false,
        includeMetaTags: true,
        sanitizeHTML: true
      };

    default:
      return publishDefaults;
  }
}

export default {
  publishDefaults,
  cssModes,
  scriptSandboxOptions,
  publishModes,
  getPublishSettings,
  getFilePublishSettings,
  validatePublishSettings,
  getDefaultsForMode
};
