// Markdown-it Loader
(function(global) {
    // Ensure window.APP exists
    global.APP = global.APP || {};
    global.APP.services = global.APP.services || {};

    // Load markdown-it and set global references
    function initMarkdownIt() {
        if (global.markdownit) {
            global.APP.services.markdownit = global.markdownit;
            return Promise.resolve(global.markdownit);
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = '/client/vendor/scripts/markdown-it.min.js';
            script.async = true;
            script.onload = () => {
                if (global.markdownit) {
                    global.APP.services.markdownit = global.markdownit;
                    resolve(global.markdownit);
                } else {
                    reject(new Error('markdown-it failed to load'));
                }
            };
            script.onerror = () => {
                reject(new Error('Failed to load markdown-it script'));
            };
            document.head.appendChild(script);
        });
    }

    // Expose initialization function
    global.initMarkdownIt = initMarkdownIt;
})(typeof window !== 'undefined' ? window : global);
