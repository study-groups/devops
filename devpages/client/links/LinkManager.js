/**
 * LinkManager.js
 *
 * Centralized handler for rewriting URLs for images, links, and other resources
 * based on the current context (e.g., preview, publish). It uses settings from
 * linkSettings.js to determine how to transform paths.
 */

import { getLinkSettings } from '../settings/linkSettings.js';

const log = window.APP.services.log.createLogger('SYSTEM', 'LinkManager');

class LinkManager {
    constructor(context = 'preview', sourceFilePath = '') {
        this.settings = getLinkSettings(context);
        this.sourceFilePath = sourceFilePath;
        this.sourceDir = sourceFilePath ? sourceFilePath.substring(0, sourceFilePath.lastIndexOf('/')) : '';
    }

    /**
     * A simple path joining utility that handles './' and '../'.
     * @param {string} base - The base path (directory).
     * @param {string} relative - The relative path to join.
     * @returns {string} The resolved path.
     */
    simpleJoinPath(base, relative) {
        const baseParts = base.split('/').filter(p => p && p !== '.');
        const relativeParts = relative.split('/');

        for (const part of relativeParts) {
            if (part === '..') {
                if (baseParts.length > 0) {
                    baseParts.pop();
                }
            } else if (part && part !== '.') {
                baseParts.push(part);
            }
        }
        return baseParts.join('/');
    }

    /**
     * Resolves a path for a resource (like an image) based on the current context.
     * @param {string} resourcePath - The original path from the src or href attribute.
     * @returns {string} The rewritten path.
     */
    resolveResourcePath(resourcePath) {
        if (!resourcePath || resourcePath.startsWith('http') || resourcePath.startsWith('data:')) {
            return resourcePath; // Leave absolute URLs and data URIs unchanged
        }

        if (resourcePath.startsWith('/uploads/')) {
            return resourcePath; // This is a direct link to an uploaded asset, do not rewrite
        }

        const isRelative = resourcePath.startsWith('./') || resourcePath.startsWith('../');
        const isRootRelative = resourcePath.startsWith('/') && !resourcePath.startsWith('//');
        const isAbsolute = resourcePath.startsWith('http') || resourcePath.startsWith('data:') || isRootRelative;

        let finalPath;

        if (isRootRelative) {
            // It's root relative, e.g. /images/logo.svg. The path from the root of MD_DIR is images/logo.svg
            finalPath = resourcePath.substring(1);
        } else if (isRelative || !isAbsolute) {
            // It's explicitly relative (./foo.svg) or implicitly relative (foo.svg)
            finalPath = this.simpleJoinPath(this.sourceDir, resourcePath);
        } else {
            // Should not be reached, but as a fallback, return original path
            log.warn('UNHANDLED_PATH', `Unhandled resource path type: ${resourcePath}`);
            return resourcePath;
        }

        const resolvedUrl = `${this.settings.prefix}${encodeURIComponent(finalPath)}`;
        log.debug('REWRITE_RESOURCE', `Rewriting resource path: ${resourcePath} -> ${resolvedUrl}`);
        return resolvedUrl;
    }

    /**
     * Resolves a generic link. It determines if it's a link to another markdown document
     * or a link to a resource (like an image) and calls the appropriate resolver.
     * @param {string} linkPath - The original path from the href attribute.
     * @returns {string} The rewritten path.
     */
    resolveLink(linkPath) {
        if (!linkPath || linkPath.startsWith('http') || linkPath.startsWith('#') || linkPath.startsWith('mailto:') || linkPath.startsWith('tel:')) {
            return linkPath;
        }

        if (linkPath.endsWith('.md')) {
            return this.resolveMarkdownLink(linkPath);
        } else {
            return this.resolveResourcePath(linkPath);
        }
    }

    /**
     * Resolves a link to another markdown file.
     * @param {string} linkPath - The original path from the href attribute.
     * @returns {string} The rewritten path.
     */
    resolveMarkdownLink(linkPath) {
        if (!linkPath || !linkPath.endsWith('.md') || linkPath.startsWith('http')) {
            return linkPath;
        }

        const isRelative = linkPath.startsWith('./') || linkPath.startsWith('../');
        let finalPath;

        if (isRelative) {
            finalPath = this.simpleJoinPath(this.sourceDir, linkPath);
        } else {
            // Assume root-relative or just filename
            finalPath = linkPath.startsWith('/') ? linkPath : `/${linkPath}`;
        }
        
        const resolvedUrl = `${this.settings.markdownLinkPrefix}${finalPath}`;
        log.debug('REWRITE_MARKDOWN', `Rewriting markdown link: ${linkPath} -> ${resolvedUrl}`);
        return resolvedUrl;
    }
}

export default LinkManager; 