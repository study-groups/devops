/**
 * DOMPurify Configuration
 * Centralized sanitization configs for preview and publish modes
 */

/**
 * Preview mode configuration - permissive for development
 */
export const PREVIEW_CONFIG = {
    ADD_TAGS: [
        'iframe', 'video', 'audio', 'source', 'track', 'style', 'link', 'meta',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary',
        'div', 'span', 'p', 'pre', 'code', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'a', 'br', 'hr',
        'em', 'strong', 'del', 'ins', 'blockquote', 'figure', 'figcaption'
    ],
    ADD_ATTR: [
        'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'srcdoc',
        'target', 'rel', 'type', 'href', 'media', 'charset', 'name', 'content',
        'property', 'http-equiv', 'open', 'id', 'class', 'style', 'width', 'height',
        'alt', 'title', 'datetime', 'cite', 'lang', 'start', 'value', 'colspan',
        'rowspan', 'scope', 'placeholder', 'required', 'disabled', 'checked',
        'selected', 'autoplay', 'controls', 'loop', 'muted', 'poster', 'preload',
        'reversed', 'for', 'accept', 'max', 'min', 'step', 'pattern', 'maxlength',
        'minlength', 'readonly', 'spellcheck', 'draggable', 'contenteditable'
    ],
    FORCE_BODY: false,
    ALLOW_DATA_ATTR: true,
    ALLOW_UNKNOWN_PROTOCOLS: true,
    WHOLE_DOCUMENT: false,
    USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
    ALLOW_ARIA_ATTR: true,
    ALLOW_COMMENTS: true
};

/**
 * Publish mode configuration - stricter for production
 */
export const PUBLISH_CONFIG = {
    ADD_TAGS: [
        'div', 'span', 'p', 'pre', 'code', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'a', 'br', 'hr',
        'em', 'strong', 'del', 'ins', 'blockquote', 'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'details', 'summary'
    ],
    ADD_ATTR: [
        'id', 'class', 'style', 'href', 'src', 'alt', 'title', 'width', 'height',
        'colspan', 'rowspan', 'scope', 'target', 'rel'
    ],
    FORCE_BODY: false,
    ALLOW_DATA_ATTR: false,
    WHOLE_DOCUMENT: false,
    USE_PROFILES: { html: true, svg: false, mathMl: true }
};

/**
 * Get configuration by mode
 * @param {string} mode - 'preview' or 'publish'
 * @returns {Object} DOMPurify configuration
 */
export function getConfig(mode = 'preview') {
    return mode === 'publish' ? PUBLISH_CONFIG : PREVIEW_CONFIG;
}
