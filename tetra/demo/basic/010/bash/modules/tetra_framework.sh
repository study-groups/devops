#!/usr/bin/env bash

# Tetra Simple Web Framework
# Unified TUI/Web data rendering with pub-sub architecture

# Framework state
declare -A TETRA_STATE=()
declare -A TETRA_SUBSCRIBERS=()
declare -A TETRA_COMPONENTS=()

# Render targets
declare -r RENDER_TERMINAL="terminal"
declare -r RENDER_HTML="html"
declare -r RENDER_JSON="json"

# Initialize framework
tetra_init() {
    TETRA_STATE["framework.version"]="1.0.0"
    TETRA_STATE["framework.initialized"]="true"

    # Set default render target
    TETRA_STATE["render.target"]="${1:-$RENDER_TERMINAL}"

    log_tetra "Framework initialized with target: ${TETRA_STATE["render.target"]}"
}

# Pub-Sub System
tetra_subscribe() {
    local event="$1"
    local callback="$2"

    if [[ -z "${TETRA_SUBSCRIBERS[$event]}" ]]; then
        TETRA_SUBSCRIBERS["$event"]="$callback"
    else
        TETRA_SUBSCRIBERS["$event"]+=" $callback"
    fi
}

tetra_publish() {
    local event="$1"
    shift
    local data="$*"

    if [[ -n "${TETRA_SUBSCRIBERS[$event]}" ]]; then
        for callback in ${TETRA_SUBSCRIBERS[$event]}; do
            $callback "$event" "$data"
        done
    fi
}

# State Management
tetra_set_state() {
    local key="$1"
    local value="$2"
    local old_value="${TETRA_STATE[$key]}"

    TETRA_STATE["$key"]="$value"

    # Publish state change
    tetra_publish "state.changed" "$key $old_value $value"
    tetra_publish "state.changed.$key" "$old_value $value"
}

tetra_get_state() {
    local key="$1"
    echo "${TETRA_STATE[$key]}"
}

# Component System
tetra_register_component() {
    local name="$1"
    local render_func="$2"

    TETRA_COMPONENTS["$name"]="$render_func"
    log_tetra "Registered component: $name -> $render_func"
}

tetra_render_component() {
    local name="$1"
    local render_target="${2:-$(tetra_get_state "render.target")}"
    shift 2
    local props="$*"

    local render_func="${TETRA_COMPONENTS[$name]}"
    if [[ -n "$render_func" ]]; then
        $render_func "$render_target" "$props"
    else
        log_tetra "ERROR: Component '$name' not found"
        return 1
    fi
}

# Unified Data Rendering
tetra_render_data() {
    local data="$1"
    local render_target="${2:-$(tetra_get_state "render.target")}"
    local format="${3:-auto}"

    case "$render_target" in
        "$RENDER_TERMINAL")
            _render_terminal "$data" "$format"
            ;;
        "$RENDER_HTML")
            _render_html "$data" "$format"
            ;;
        "$RENDER_JSON")
            _render_json "$data" "$format"
            ;;
        *)
            log_tetra "ERROR: Unknown render target: $render_target"
            return 1
            ;;
    esac
}

# Terminal rendering with UTF-8 styling
_render_terminal() {
    local data="$1"
    local format="$2"

    case "$format" in
        "json"|"ast")
            # Colored JSON output for terminal
            echo "$data" | jq -C '.' 2>/dev/null || echo "$data"
            ;;
        "table")
            _render_terminal_table "$data"
            ;;
        "list")
            _render_terminal_list "$data"
            ;;
        "card")
            _render_terminal_card "$data"
            ;;
        *)
            echo "$data"
            ;;
    esac
}

# HTML rendering
_render_html() {
    local data="$1"
    local format="$2"

    case "$format" in
        "json"|"ast")
            cat << EOF
<div class="json-viewer">
    <pre><code>$(echo "$data" | jq '.' 2>/dev/null || echo "$data" | sed 's/</\&lt;/g; s/>/\&gt;/g')</code></pre>
</div>
EOF
            ;;
        "table")
            _render_html_table "$data"
            ;;
        "list")
            _render_html_list "$data"
            ;;
        "card")
            _render_html_card "$data"
            ;;
        *)
            echo "<div class=\"tetra-content\">$data</div>"
            ;;
    esac
}

# JSON rendering for API
_render_json() {
    local data="$1"
    local format="$2"

    # Ensure valid JSON output
    if echo "$data" | jq '.' >/dev/null 2>&1; then
        echo "$data"
    else
        jq -n --arg data "$data" --arg format "$format" '{
            content: $data,
            format: $format,
            timestamp: now
        }'
    fi
}

# Terminal Table Renderer
_render_terminal_table() {
    local data="$1"

    # Simple table using box drawing characters
    local width=60
    local separator="$(printf '─%.0s' $(seq 1 $width))"

    echo "┌$separator┐"
    echo "$data" | while read -r line; do
        printf "│ %-${width}s │\n" "$line"
    done
    echo "└$separator┘"
}

# Terminal List Renderer
_render_terminal_list() {
    local data="$1"

    echo "$data" | while read -r item; do
        echo "• $item"
    done
}

# Terminal Card Renderer
_render_terminal_card() {
    local data="$1"

    local title="$(echo "$data" | head -1)"
    local content="$(echo "$data" | tail -n +2)"

    echo "╭─ $title"
    echo "$content" | while read -r line; do
        echo "│ $line"
    done
    echo "╰─"
}

# HTML Table Renderer
_render_html_table() {
    local data="$1"

    cat << EOF
<table class="tetra-table">
    <tbody>
$(echo "$data" | while read -r line; do
    echo "        <tr><td>$line</td></tr>"
done)
    </tbody>
</table>
EOF
}

# HTML List Renderer
_render_html_list() {
    local data="$1"

    cat << EOF
<ul class="tetra-list">
$(echo "$data" | while read -r item; do
    echo "    <li>$item</li>"
done)
</ul>
EOF
}

# HTML Card Renderer
_render_html_card() {
    local data="$1"

    local title="$(echo "$data" | head -1)"
    local content="$(echo "$data" | tail -n +2)"

    cat << EOF
<div class="tetra-card">
    <h3 class="card-title">$title</h3>
    <div class="card-content">
$(echo "$content" | while read -r line; do
    echo "        <p>$line</p>"
done)
    </div>
</div>
EOF
}

# Logging
log_tetra() {
    local message="$1"
    local timestamp="$(date '+%H:%M:%S')"
    echo "[$timestamp] TETRA: $message" >&2
}

# Example Components
module_card_component() {
    local render_target="$1"
    local module_data="$2"

    # Parse module data (name:type:functions:deps)
    IFS=':' read -r name type func_count deps <<< "$module_data"

    case "$render_target" in
        "$RENDER_TERMINAL")
            cat << EOF
╭─ 📦 $name ($type)
│ Functions: $func_count
│ Dependencies: ${deps:-none}
╰─
EOF
            ;;
        "$RENDER_HTML")
            cat << EOF
<div class="module-card $type" data-name="$name">
    <div class="module-title">📦 $name</div>
    <div class="module-type">$type</div>
    <div class="module-stats">
        <span>Functions: $func_count</span>
        <span>Dependencies: ${deps:-none}</span>
    </div>
</div>
EOF
            ;;
        "$RENDER_JSON")
            jq -n \
                --arg name "$name" \
                --arg type "$type" \
                --arg func_count "$func_count" \
                --arg deps "$deps" \
                '{
                    component: "module_card",
                    data: {
                        name: $name,
                        type: $type,
                        function_count: ($func_count | tonumber),
                        dependencies: ($deps | split(",") | map(select(length > 0)))
                    }
                }'
            ;;
    esac
}

# Demo function showcasing the framework
tetra_demo() {
    echo "🚀 Tetra Simple Web Framework Demo"
    echo "================================="

    # Initialize framework
    tetra_init "$RENDER_TERMINAL"

    # Register components
    tetra_register_component "module_card" "module_card_component"

    # Subscribe to state changes
    tetra_subscribe "state.changed" "_demo_state_handler"

    # Demo data
    local demo_modules=(
        "tsm:core:15:tview,utils"
        "tview:core:8:tsm"
        "colors:extension:5:none"
    )

    echo
    echo "📊 Terminal Rendering:"
    echo "─────────────────────"

    # Render in terminal
    for module in "${demo_modules[@]}"; do
        tetra_render_component "module_card" "$RENDER_TERMINAL" "$module"
        echo
    done

    echo "🌐 HTML Rendering:"
    echo "─────────────────"

    # Render same data as HTML
    tetra_set_state "render.target" "$RENDER_HTML"
    for module in "${demo_modules[@]}"; do
        tetra_render_component "module_card" "$RENDER_HTML" "$module"
    done

    echo
    echo "📄 JSON API Rendering:"
    echo "─────────────────────"

    # Render as JSON
    tetra_set_state "render.target" "$RENDER_JSON"
    echo '{'
    echo '  "modules": ['
    local first=true
    for module in "${demo_modules[@]}"; do
        [[ "$first" == "false" ]] && echo ','
        first=false
        echo -n '    '
        tetra_render_component "module_card" "$RENDER_JSON" "$module"
    done
    echo
    echo '  ]'
    echo '}'
}

# Demo state change handler
_demo_state_handler() {
    local event="$1"
    local data="$2"
    log_tetra "State changed: $data"
}

# Export framework functions for use in other scripts
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # If run directly, show demo
    tetra_demo
fi