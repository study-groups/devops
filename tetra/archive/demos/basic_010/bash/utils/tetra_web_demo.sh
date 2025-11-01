#!/usr/bin/env bash

# Tetra Web Demo - Unified AST Viewer
# Demonstrates TUI/Web data rendering with AST integration

source "$(dirname "${BASH_SOURCE[0]}")/tetra_framework.sh"

# AST integration
source_ast_data() {
    # Generate AST for current demo
    local ast_data="$($TETRA_SRC/bash/ast/module_discovery.sh discover 2>/dev/null || echo '{}')"
    tetra_set_state "ast.data" "$ast_data"
}

# Enhanced AST viewer component
ast_viewer_component() {
    local render_target="$1"
    local module_name="$2"

    local ast_data="$(tetra_get_state "ast.data")"
    local module_data="$(echo "$ast_data" | jq -r ".modules[\"$module_name\"] // empty" 2>/dev/null)"

    if [[ -z "$module_data" || "$module_data" == "null" ]]; then
        case "$render_target" in
            "$RENDER_TERMINAL")
                echo "❌ Module '$module_name' not found in AST"
                ;;
            "$RENDER_HTML")
                echo "<div class=\"error\">Module '$module_name' not found</div>"
                ;;
            "$RENDER_JSON")
                jq -n --arg module "$module_name" '{ error: "Module not found", module: $module }'
                ;;
        esac
        return
    fi

    case "$render_target" in
        "$RENDER_TERMINAL")
            _render_ast_terminal "$module_name" "$module_data"
            ;;
        "$RENDER_HTML")
            _render_ast_html "$module_name" "$module_data"
            ;;
        "$RENDER_JSON")
            echo "$module_data"
            ;;
    esac
}

# Terminal AST rendering with colors
_render_ast_terminal() {
    local module_name="$1"
    local module_data="$2"

    # Colors
    local BLUE='\033[34m'
    local GREEN='\033[32m'
    local YELLOW='\033[33m'
    local CYAN='\033[36m'
    local BOLD='\033[1m'
    local DIM='\033[2m'
    local NC='\033[0m'

    # Parse JSON data
    local type="$(echo "$module_data" | jq -r '.type // "unknown"')"
    local path="$(echo "$module_data" | jq -r '.path // "unknown"')"
    local tview_integration="$(echo "$module_data" | jq -r '.tview_integration // false')"
    local func_count="$(echo "$module_data" | jq -r '.functions | length')"
    local dep_count="$(echo "$module_data" | jq -r '.dependencies | length')"

    # Header
    echo -e "${BOLD}${BLUE}╭─ 📦 $module_name${NC}"
    echo -e "${BLUE}│${NC}"

    # Basic info
    echo -e "${BLUE}│${NC} ${BOLD}Type:${NC} $type"
    echo -e "${BLUE}│${NC} ${BOLD}Path:${NC} ${DIM}$path${NC}"
    echo -e "${BLUE}│${NC} ${BOLD}TView:${NC} $([ "$tview_integration" = "true" ] && echo -e "${GREEN}✓ Integrated${NC}" || echo -e "${DIM}✗ No${NC}")"
    echo -e "${BLUE}│${NC}"

    # Statistics
    echo -e "${BLUE}│${NC} ${BOLD}${CYAN}Statistics:${NC}"
    echo -e "${BLUE}│${NC}   Functions: ${GREEN}$func_count${NC}"
    echo -e "${BLUE}│${NC}   Dependencies: ${YELLOW}$dep_count${NC}"
    echo -e "${BLUE}│${NC}"

    # Functions list
    if [[ "$func_count" -gt 0 ]]; then
        echo -e "${BLUE}│${NC} ${BOLD}${CYAN}Functions:${NC}"
        echo "$module_data" | jq -r '.functions[] | "│   \(if .exported then "⚡" else "•" end) \(.name) \(if .exported then "(exported)" else "" end)"' | \
        while read -r line; do
            echo -e "${BLUE}$line${NC}"
        done
        echo -e "${BLUE}│${NC}"
    fi

    # Dependencies
    if [[ "$dep_count" -gt 0 ]]; then
        echo -e "${BLUE}│${NC} ${BOLD}${CYAN}Dependencies:${NC}"
        echo "$module_data" | jq -r '.dependencies[] | "│   → \(.)"' | \
        while read -r line; do
            echo -e "${BLUE}$line${NC}"
        done
        echo -e "${BLUE}│${NC}"
    fi

    echo -e "${BLUE}╰─${NC}"
}

# HTML AST rendering with modal support
_render_ast_html() {
    local module_name="$1"
    local module_data="$2"

    # Parse JSON data
    local type="$(echo "$module_data" | jq -r '.type // "unknown"')"
    local path="$(echo "$module_data" | jq -r '.path // "unknown"')"
    local tview_integration="$(echo "$module_data" | jq -r '.tview_integration // false')"

    cat << EOF
<div class="ast-viewer $type" data-module="$module_name">
    <div class="ast-header">
        <h3>📦 $module_name</h3>
        <div class="ast-badges">
            <span class="type-badge $type">$type</span>
            $([ "$tview_integration" = "true" ] && echo '<span class="tview-badge">TView</span>')
        </div>
    </div>

    <div class="ast-content">
        <div class="ast-section">
            <h4>📍 Location</h4>
            <code class="path">$path</code>
        </div>

        <div class="ast-section">
            <h4>⚡ Functions</h4>
            <div class="function-list">
$(echo "$module_data" | jq -r '.functions[] |
    "<div class=\"function-item \(if .exported then "exported" else "" end)\">
        <span class=\"func-name\">\(.name)</span>
        <span class=\"func-meta\">line \(.line)\(if .exported then " (exported)" else "" end)</span>
    </div>"')
            </div>
        </div>

        <div class="ast-section">
            <h4>🔗 Dependencies</h4>
            <div class="deps-list">
$(echo "$module_data" | jq -r '.dependencies[] | "<span class=\"dep-item\">\(.)</span>"')
            </div>
        </div>

        <div class="ast-section">
            <h4>📄 Raw AST</h4>
            <div class="json-viewer">
                <pre><code>$(echo "$module_data" | jq '.')</code></pre>
            </div>
        </div>
    </div>
</div>
EOF
}

# Web server integration
tetra_serve_web() {
    local port="${1:-8080}"
    local output_dir="/tmp/tetra-web-demo"

    mkdir -p "$output_dir"

    # Generate HTML page
    cat > "$output_dir/index.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tetra AST Viewer Demo</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .demo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .demo-section { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .terminal-output { background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 4px; font-family: 'Courier New', monospace; white-space: pre-wrap; font-size: 14px; line-height: 1.4; }
        .html-output { border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
        .controls { margin-bottom: 15px; }
        .btn { background: #007AFF; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 8px; }
        .btn:hover { background: #0056b3; }
        .module-select { padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-right: 8px; }

        /* HTML output styling */
        .ast-viewer { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
        .ast-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #ddd; }
        .ast-header h3 { margin: 0; color: #333; }
        .ast-badges { margin-top: 8px; }
        .type-badge, .tview-badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-right: 8px; }
        .type-badge { background: #007AFF; color: white; }
        .tview-badge { background: #28a745; color: white; }
        .ast-content { padding: 15px; }
        .ast-content p { margin-bottom: 10px; }
        .function-details { margin: 10px 0; }
        .func-item { display: flex; align-items: center; padding: 6px 0; border-bottom: 1px solid #eee; }
        .func-item:last-child { border-bottom: none; }
        .func-type { font-family: monospace; font-weight: bold; margin-right: 8px; width: 30px; }
        .exported .func-type { color: #007AFF; }
        .internal .func-type { color: #6c757d; }
        .func-name { font-family: monospace; font-weight: 500; margin-right: 8px; }
        .func-meta { font-size: 12px; color: #6c757d; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Tetra Unified AST Viewer Demo</h1>
            <p>Same data rendered in Terminal ASCII and HTML DOM formats</p>
        </div>

        <div class="controls">
            <select class="module-select" id="moduleSelect">
                <option value="">Select a module...</option>
            </select>
            <button class="btn" onclick="renderModule()">Render</button>
            <button class="btn" onclick="renderAll()">Show All</button>
        </div>

        <div class="demo-grid">
            <div class="demo-section">
                <h3>Terminal Output (ASCII)</h3>
                <div class="terminal-output" id="terminalOutput">Select a module to see terminal rendering...</div>
            </div>

            <div class="demo-section">
                <h3>HTML Output (DOM)</h3>
                <div class="html-output" id="htmlOutput">Select a module to see HTML rendering...</div>
            </div>
        </div>
    </div>

    <script>
        // Mock data for demo
        const mockModules = {
            'tsm': {
                type: 'core',
                path: '/tetra/bash/tsm/',
                tview_integration: true,
                functions: [
                    { name: 'tsm_start', line: 45, exported: true },
                    { name: 'tsm_stop', line: 67, exported: true },
                    { name: '_tsm_helper', line: 89, exported: false }
                ],
                dependencies: ['utils', 'tview']
            },
            'tview': {
                type: 'core',
                path: '/tetra/bash/tview/',
                tview_integration: false,
                functions: [
                    { name: 'tview_init', line: 23, exported: true },
                    { name: 'render_ui', line: 156, exported: false }
                ],
                dependencies: ['colors']
            }
        };

        // Populate module selector
        const moduleSelect = document.getElementById('moduleSelect');
        Object.keys(mockModules).forEach(module => {
            const option = document.createElement('option');
            option.value = module;
            option.textContent = module;
            moduleSelect.appendChild(option);
        });

        function renderModule() {
            const module = moduleSelect.value;
            if (!module) return;

            const data = mockModules[module];

            // Terminal rendering
            document.getElementById('terminalOutput').textContent =
                renderTerminal(module, data);

            // HTML rendering
            document.getElementById('htmlOutput').innerHTML =
                renderHTML(module, data);
        }

        function renderTerminal(module, data) {
            const tview = data.tview_integration ? 'YES Integrated' : 'NO';
            return `+-- MODULE ${module}
|
| Type: ${data.type}
| Path: ${data.path}
| TView: ${tview}
|
| Statistics:
|   Functions: ${data.functions.length}
|   Dependencies: ${data.dependencies.length}
|
| Functions:
${data.functions.map(f => `|   ${f.exported ? '[E]' : '[I]'} ${f.name} ${f.exported ? '(exported)' : ''}`).join('\n')}
|
| Dependencies:
${data.dependencies.map(d => `|   --> ${d}`).join('\n')}
|
+--`;
        }

        function renderHTML(module, data) {
            return `
                <div class="ast-viewer ${data.type}">
                    <div class="ast-header">
                        <h3>MODULE: ${module}</h3>
                        <div class="ast-badges">
                            <span class="type-badge">${data.type}</span>
                            ${data.tview_integration ? '<span class="tview-badge">TView</span>' : ''}
                        </div>
                    </div>
                    <div class="ast-content">
                        <p><strong>Path:</strong> <code>${data.path}</code></p>
                        <p><strong>Functions:</strong> ${data.functions.length}</p>
                        <div class="function-details">
                            ${data.functions.map(f =>
                                `<div class="func-item ${f.exported ? 'exported' : 'internal'}">
                                    <span class="func-type">[${f.exported ? 'E' : 'I'}]</span>
                                    <span class="func-name">${f.name}</span>
                                    <span class="func-meta">${f.exported ? '(exported)' : ''}</span>
                                </div>`
                            ).join('')}
                        </div>
                        <p><strong>Dependencies:</strong> ${data.dependencies.join(', ')}</p>
                    </div>
                </div>
            `;
        }

        function renderAll() {
            Object.keys(mockModules).forEach(module => {
                moduleSelect.value = module;
                renderModule();
            });
        }
    </script>
</body>
</html>
EOF

    echo "🌐 Starting Tetra Web Demo on port $port"
    echo "📁 Files in: $output_dir"
    echo "📱 Dashboard: http://localhost:$port/web/dashboard.html"

    if command -v python3 >/dev/null; then
        echo "🚀 Server: http://localhost:$port"
        python3 -m http.server "$port"
    else
        echo "Python3 not found - files ready in $output_dir"
        echo "Open web/dashboard.html in your browser"
    fi
}

# CLI demo
tetra_cli_demo() {
    echo "🚀 Tetra Unified AST Demo"
    echo "========================="

    # Initialize
    tetra_init "$RENDER_TERMINAL"
    source_ast_data

    # Register AST viewer component
    tetra_register_component "ast_viewer" "ast_viewer_component"

    echo
    echo "📊 Available modules:"
    local ast_data="$(tetra_get_state "ast.data")"
    echo "$ast_data" | jq -r '.modules | keys[]' 2>/dev/null | head -5 | while read -r module; do
        echo "  • $module"
    done

    echo
    echo "🖥️ Terminal AST View (first module):"
    echo "────────────────────────────────────"
    local first_module="$(echo "$ast_data" | jq -r '.modules | keys[0]' 2>/dev/null)"
    if [[ -n "$first_module" && "$first_module" != "null" ]]; then
        tetra_render_component "ast_viewer" "$RENDER_TERMINAL" "$first_module"
    else
        echo "No modules found in AST"
    fi

    echo
    echo "🌐 To see web demo: ./tetra_web_demo.sh serve 8080"
}

# Main execution
case "${1:-demo}" in
    "serve")
        tetra_serve_web "$2"
        ;;
    "demo")
        tetra_cli_demo
        ;;
    *)
        echo "Usage: $0 [demo|serve] [port]"
        echo "  demo  - Show CLI demo"
        echo "  serve - Start web server demo"
        ;;
esac