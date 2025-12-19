#!/usr/bin/env bash
# Code wrapping utilities for TERRAIN bundler

# Wrap content with IIFE (Immediately Invoked Function Expression)
# Usage: bundler_wrap_iife content
bundler_wrap_iife() {
    local content="$1"
    cat <<EOF
(function() {
    'use strict';

$content

})();
EOF
}

# Wrap content as TERRAIN module
# Usage: bundler_wrap_terrain_module name content
bundler_wrap_terrain_module() {
    local name="$1"
    local content="$2"

    cat <<EOF
(function(TERRAIN) {
    'use strict';

    // Ensure TERRAIN exists
    if (!TERRAIN) {
        console.error('[$name] TERRAIN not found');
        return;
    }

    // Check if already registered
    if (TERRAIN.modules?.['$name']) {
        console.warn('[$name] Already registered');
        return;
    }

    // === BEGIN MODULE ===
$content
    // === END MODULE ===

    // Register with TERRAIN
    TERRAIN.register('$name', $name);

})(window.TERRAIN);
EOF
}

# Wrap content as standalone module with TERRAIN bridge shim
# Usage: bundler_wrap_standalone name content
bundler_wrap_standalone() {
    local name="$1"
    local content="$2"

    cat <<EOF
(function() {
    'use strict';

    // TERRAIN bridge shim for standalone use
    var TERRAIN = window.TERRAIN || (window.TERRAIN = {
        version: 'shim',
        modules: {},
        Events: {
            _handlers: {},
            on: function(e, h) {
                (this._handlers[e] = this._handlers[e] || []).push(h);
            },
            emit: function(e, d) {
                (this._handlers[e] || []).forEach(function(h) { h(d); });
            },
            off: function(e, h) {
                if (!this._handlers[e]) return;
                if (h) {
                    this._handlers[e] = this._handlers[e].filter(function(x) { return x !== h; });
                } else {
                    delete this._handlers[e];
                }
            }
        },
        Bridge: {
            _handlers: new Map(),
            send: function(target, event, data) {
                target.postMessage({ type: event, payload: data, source: 'terrain' }, '*');
            },
            broadcast: function(event, data) {
                var msg = { type: event, payload: data, source: 'terrain' };
                if (window.parent !== window) window.parent.postMessage(msg, '*');
                this._dispatch(event, data);
            },
            on: function(event, handler) {
                if (!this._handlers.has(event)) this._handlers.set(event, new Set());
                this._handlers.get(event).add(handler);
            },
            off: function(event, handler) {
                var h = this._handlers.get(event);
                if (h) handler ? h.delete(handler) : this._handlers.delete(event);
            },
            _dispatch: function(event, data) {
                var h = this._handlers.get(event);
                if (h) h.forEach(function(fn) { fn(data); });
                var w = this._handlers.get('*');
                if (w) w.forEach(function(fn) { fn(event, data); });
            }
        },
        register: function(name, mod) {
            this.modules[name] = mod;
            this[name] = mod;
        },
        get: function(name) {
            return this.modules[name];
        }
    });

    // Listen for cross-iframe messages
    window.addEventListener('message', function(e) {
        if (e.data?.source === 'terrain') {
            TERRAIN.Bridge._dispatch(e.data.type, e.data.payload);
        }
    });

    // === BEGIN MODULE ===
$content
    // === END MODULE ===

    // Register and expose globally
    TERRAIN.register('$name', $name);
    window.$name = $name;

})();
EOF
}

# Apply template file with substitutions
# Usage: bundler_apply_template template_file name content
bundler_apply_template() {
    local template="$1"
    local name="$2"
    local content="$3"

    [[ ! -f "$template" ]] && {
        echo "Error: Template not found: $template" >&2
        return 1
    }

    local template_content
    template_content=$(<"$template")

    # Replace placeholders
    template_content="${template_content//\{\{NAME\}\}/$name}"
    template_content="${template_content//\{\{MODULE_CONTENT\}\}/$content}"

    echo "$template_content"
}

# Strip comments from JavaScript (basic - preserves strings)
# Usage: bundler_strip_comments < input > output
bundler_strip_comments() {
    sed -e 's://.*$::g' -e '/^[[:space:]]*$/d'
}
