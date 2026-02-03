/**
 * TetraUI Editor - CodeMirror wrapper for TOML/config editing
 *
 * Usage:
 *   const editor = TetraUI.Editor.create(container, opts);
 *   editor.getValue()
 *   editor.setValue(content)
 *   editor.destroy()
 *
 * Requires CodeMirror 5 to be loaded via CDN or locally.
 * Falls back to textarea if CodeMirror not available.
 */

window.TetraUI = window.TetraUI || {};

TetraUI.Editor = {
    /**
     * Check if CodeMirror is available
     */
    hasCodeMirror: function() {
        return typeof CodeMirror !== 'undefined';
    },

    /**
     * Create an editor instance
     * @param {HTMLElement|string} container
     * @param {Object} opts
     */
    create: function(container, opts) {
        var el = typeof container === 'string'
            ? document.querySelector(container)
            : container;
        if (!el) return null;

        opts = opts || {};
        var mode = opts.mode || 'toml';
        var value = opts.value || '';
        var onChange = opts.onChange || function() {};
        var onSave = opts.onSave || null;
        var readOnly = opts.readOnly || false;

        el.classList.add('tetra-editor');

        // Try CodeMirror first
        if (this.hasCodeMirror()) {
            return this._createCodeMirror(el, {
                mode: mode,
                value: value,
                onChange: onChange,
                onSave: onSave,
                readOnly: readOnly
            });
        }

        // Fallback to textarea
        return this._createTextarea(el, {
            value: value,
            onChange: onChange,
            onSave: onSave,
            readOnly: readOnly
        });
    },

    /**
     * Create CodeMirror editor
     */
    _createCodeMirror: function(container, opts) {
        var wrapper = document.createElement('div');
        container.appendChild(wrapper);

        var cm = CodeMirror(wrapper, {
            value: opts.value,
            mode: opts.mode,
            theme: 'tetra',
            lineNumbers: true,
            lineWrapping: true,
            readOnly: opts.readOnly,
            tabSize: 2,
            indentWithTabs: false,
            extraKeys: {
                'Cmd-S': function() { if (opts.onSave) opts.onSave(); },
                'Ctrl-S': function() { if (opts.onSave) opts.onSave(); }
            }
        });

        cm.on('change', function() {
            opts.onChange(cm.getValue());
        });

        return {
            type: 'codemirror',
            cm: cm,
            container: container,

            getValue: function() {
                return cm.getValue();
            },

            setValue: function(val) {
                cm.setValue(val);
            },

            focus: function() {
                cm.focus();
            },

            refresh: function() {
                cm.refresh();
            },

            setOption: function(key, val) {
                cm.setOption(key, val);
            },

            destroy: function() {
                container.innerHTML = '';
                container.classList.remove('tetra-editor');
            }
        };
    },

    /**
     * Create textarea fallback
     */
    _createTextarea: function(container, opts) {
        var textarea = document.createElement('textarea');
        textarea.className = 'tetra-editor__textarea';
        textarea.value = opts.value;
        textarea.spellcheck = false;
        textarea.readOnly = opts.readOnly;

        container.appendChild(textarea);

        textarea.addEventListener('input', function() {
            opts.onChange(textarea.value);
        });

        textarea.addEventListener('keydown', function(e) {
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                if (opts.onSave) opts.onSave();
            }
        });

        return {
            type: 'textarea',
            textarea: textarea,
            container: container,

            getValue: function() {
                return textarea.value;
            },

            setValue: function(val) {
                textarea.value = val;
            },

            focus: function() {
                textarea.focus();
            },

            refresh: function() {
                // No-op for textarea
            },

            setOption: function() {
                // No-op for textarea
            },

            destroy: function() {
                container.innerHTML = '';
                container.classList.remove('tetra-editor');
            }
        };
    },

    /**
     * Load CodeMirror from CDN
     * @param {Function} callback
     */
    loadCodeMirror: function(callback) {
        if (this.hasCodeMirror()) {
            callback();
            return;
        }

        var baseUrl = 'https://cdn.jsdelivr.net/npm/codemirror@5';

        // Load CSS
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = baseUrl + '/lib/codemirror.min.css';
        document.head.appendChild(link);

        // Load JS
        var script = document.createElement('script');
        script.src = baseUrl + '/lib/codemirror.min.js';
        script.onload = function() {
            // Load TOML mode
            var tomlScript = document.createElement('script');
            tomlScript.src = baseUrl + '/mode/toml/toml.min.js';
            tomlScript.onload = callback;
            document.head.appendChild(tomlScript);
        };
        document.head.appendChild(script);
    }
};
