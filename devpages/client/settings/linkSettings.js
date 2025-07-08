/**
 * linkSettings.js
 * 
 * Configuration for how links and image sources are handled in different contexts.
 * This allows for easy customization of path resolutions for previewing vs. publishing.
 */

export const linkSettings = {
    // Default settings applied to all contexts unless overridden
    base: {
        // Not used yet, but could define a default CDN or asset host
        assetPrefix: '', 
    },

    // Settings for the live in-app preview
    preview: {
        // In preview mode, all relative paths should point to the API endpoint
        // that serves file content. This ensures images and links work for authenticated users.
        prefix: '/api/files/content?pathname=',
        
        // Links to other .md files should be handled by the client-side router
        // so we don't add any specific prefix to them. They will be root-relative.
        markdownLinkPrefix: '', 
    },

    // Settings for publishing with relative links (e.g., for DigitalOcean Spaces)
    publishRelative: {
        // When publishing with relative links, we don't add a prefix.
        // The paths in the final HTML will be relative to the document's location.
        prefix: '',
        markdownLinkPrefix: '',
    },

    // Settings for publishing with absolute links
    publishAbsolute: {
        // The user can define a prefix, e.g., a CDN URL or a subfolder on their domain.
        // This will be prepended to all relative image/asset paths.
        prefix: 'https://your-cdn.com/assets', // Example prefix
        markdownLinkPrefix: 'https://your-site.com/docs', // Example prefix for markdown links
    },
};

/**
 * Gets the configuration for a specific context (e.g., 'preview', 'publishRelative').
 * @param {string} context - The context for which to get settings.
 * @returns {object} The resolved settings object.
 */
export function getLinkSettings(context = 'preview') {
    const contextSettings = linkSettings[context] || linkSettings.preview;
    return { ...linkSettings.base, ...contextSettings };
} 