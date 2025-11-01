#!/usr/bin/env bash

# Local AST generator for 010 demo modules
# Analyzes the shell scripts in the current directory

source "$(dirname "${BASH_SOURCE[0]}")/tetra_framework.sh"

# Generate AST for local modules
generate_local_ast() {
    local base_dir="${1:-$PWD}"

    echo "{"
    echo "  \"modules\": {"

    local first_module=true

    # Helper function to process each script file
    process_script_file() {
        local script_file="$1"
        local file_type="$2"

        local relative_path="${script_file#$base_dir/}"
        local module_name="$relative_path"

        # Skip framework files
        case "$(basename "$script_file")" in
            "tetra_framework.sh"|"tetra_web_demo.sh"|"local_ast.sh") return ;;
        esac

        [[ "$first_module" = false ]] && echo ","
        first_module=false

        echo "    \"$module_name\": {"
        echo "      \"path\": \"$script_file\","
        echo "      \"type\": \"$file_type\","
        echo "      \"tview_integration\": $(has_local_tview_integration "$script_file"),"
        echo "      \"functions\": ["

        # Extract functions
        local first_function=true
        while IFS=':' read -r line_num func_name; do
            [[ -z "$func_name" ]] && continue
            [[ "$first_function" = false ]] && echo ","
            first_function=false
            echo "        {"
            echo "          \"name\": \"$func_name\","
            echo "          \"line\": $line_num,"
            echo "          \"exported\": $(is_local_function_exported "$script_file" "$func_name")"
            echo -n "        }"
        done < <(extract_local_functions "$script_file")

        echo ""
        echo "      ],"

        # Extract dependencies
        echo "      \"dependencies\": ["
        local first_dep=true
        while read -r dep_file; do
            [[ -z "$dep_file" ]] && continue
            local dep_module=$(basename "$dep_file" .sh)
            [[ "$dep_module" == "$(basename "$script_file" .sh)" ]] && continue

            [[ "$first_dep" = false ]] && echo ","
            first_dep=false
            echo -n "        \"$dep_module\""
        done < <(extract_local_dependencies "$script_file")
        echo ""
        echo "      ],"
        echo "      \"lines\": $(wc -l < "$script_file" 2>/dev/null || echo 0),"
        echo "      \"variables\": [],"
        echo "      \"complexity\": \"$(determine_complexity "$script_file")\""
        echo -n "    }"
    }

    # Process components (application files)
    if [[ -d "$base_dir/bash/app" ]]; then
        find "$base_dir/bash/app" -name "*.sh" -type f | while read -r script_file; do
            process_script_file "$script_file" "component"
        done
    fi

    if [[ -d "$base_dir/bash/utils" ]]; then
        find "$base_dir/bash/utils" -name "*.sh" -type f | while read -r script_file; do
            process_script_file "$script_file" "component"
        done
    fi

    # Process modules (framework/reusable)
    if [[ -d "$base_dir/bash/modules" ]]; then
        find "$base_dir/bash/modules" -name "*.sh" -type f | while read -r script_file; do
            process_script_file "$script_file" "module"
        done
    fi

    if [[ -d "$base_dir/bash/tui" ]]; then
        find "$base_dir/bash/tui" -name "*.sh" -type f | while read -r script_file; do
            process_script_file "$script_file" "module"
        done
    fi

    # Process test files
    if [[ -d "$base_dir/tests" ]]; then
        find "$base_dir/tests" -name "*.sh" -type f | while read -r script_file; do
            process_script_file "$script_file" "test"
        done
    fi

    echo ""
    echo "  }"
    echo "}"
}

# Helper functions for local analysis
determine_local_type() {
    local module="$1"
    # This function is now deprecated - type is determined by directory structure
    echo "unknown"
}

determine_complexity() {
    local file="$1"
    local lines=$(wc -l < "$file" 2>/dev/null || echo 0)
    local func_count=$(extract_local_functions "$file" | wc -l)

    if [[ $lines -gt 500 ]] || [[ $func_count -gt 20 ]]; then
        echo "high"
    elif [[ $lines -gt 200 ]] || [[ $func_count -gt 10 ]]; then
        echo "medium"
    else
        echo "low"
    fi
}

has_local_tview_integration() {
    local file="$1"
    if grep -q "tview\|TView\|render_ui\|show_gamepad" "$file" 2>/dev/null; then
        echo "true"
    else
        echo "false"
    fi
}

extract_local_functions() {
    local file="$1"

    # Extract function definitions
    {
        # Match: function name() or function name {
        grep -n "^[[:space:]]*function[[:space:]]\+[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*[(){]" "$file" | \
        sed -E 's/^([0-9]+):.*function[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*[(){].*/\1:\2/'

        # Match: name() { but not if it's part of a longer word
        grep -n "^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*()[[:space:]]*{" "$file" | \
        sed -E 's/^([0-9]+):[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\(\)[[:space:]]*\{.*/\1:\2/'
    } | sort -n
}

is_local_function_exported() {
    local file="$1"
    local func="$2"
    if grep -q "export[[:space:]]\+-f[[:space:]]\+$func" "$file" 2>/dev/null; then
        echo "true"
    else
        echo "false"
    fi
}

extract_local_dependencies() {
    local file="$1"

    # Look for source statements pointing to local files
    grep "source.*\.sh\|source.*/" "$file" 2>/dev/null | \
    sed -E 's/.*source[[:space:]]+["\x27]*([^"\x27[:space:]]+)["\x27]*.*/\1/' | \
    grep -E "\.sh$|/" | \
    while read -r dep_path; do
        if [[ "$dep_path" == *"/"* ]]; then
            # Extract filename from path
            basename "$dep_path" 2>/dev/null
        else
            # Already a filename
            echo "$dep_path"
        fi
    done | \
    grep "\.sh$" | sort -u
}

# Demo viewer for local modules
show_local_modules() {
    echo "🏠 Demo 010 Local Modules"
    echo "========================="

    # Initialize framework
    tetra_init "$RENDER_TERMINAL"

    # Generate local AST
    local ast_data="$(generate_local_ast)"
    tetra_set_state "local.ast" "$ast_data"

    echo
    echo "📊 Available local modules:"
    echo "$ast_data" | jq -r '.modules | keys[]' 2>/dev/null | while read -r module; do
        local type="$(echo "$ast_data" | jq -r ".modules[\"$module\"].type" 2>/dev/null)"
        local func_count="$(echo "$ast_data" | jq -r ".modules[\"$module\"].functions | length" 2>/dev/null)"
        printf "  • %-20s [%s] %d functions\n" "$module" "$type" "$func_count"
    done

    echo
    echo "🔍 Core modules analysis:"
    echo "$ast_data" | jq -r '.modules | to_entries[] | select(.value.type == "core") | "\(.key): \(.value.functions | length) functions"' 2>/dev/null

    echo
    echo "🧪 Test modules:"
    echo "$ast_data" | jq -r '.modules | to_entries[] | select(.value.type == "test") | "\(.key)"' 2>/dev/null | wc -l | xargs echo "  Total test modules:"

    echo
    echo "🎨 Theme modules:"
    echo "$ast_data" | jq -r '.modules | to_entries[] | select(.value.type == "theme") | "\(.key): \(.value.functions | length) functions"' 2>/dev/null
}

# Web integration
show_local_web() {
    local port="${1:-8080}"
    local output_dir="/tmp/tetra-010-demo"

    mkdir -p "$output_dir"

    # Generate AST data
    local ast_data="$(generate_local_ast)"

    # Create simple web viewer
    cat > "$output_dir/index.html" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Demo 010 Local Modules</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1000px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .module-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
        .module-card { background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .module-title { font-size: 1.2em; font-weight: bold; margin-bottom: 8px; }
        .module-type { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
        .type-core { background: #007AFF; color: white; }
        .type-test { background: #FF9500; color: white; }
        .type-debug { background: #FF3B30; color: white; }
        .type-component { background: #34C759; color: white; }
        .type-theme { background: #AF52DE; color: white; }
        .type-utility { background: #8E8E93; color: white; }
        .function-list { font-family: monospace; font-size: 13px; line-height: 1.4; }
        .stats { color: #666; font-size: 14px; margin-top: 10px; }
        .tview-badge { background: #5856D6; color: white; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-left: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Demo 010 Local Modules</h1>
            <p>Analysis of shell scripts in the current demo directory</p>
        </div>
        <div class="module-grid" id="moduleGrid">
        </div>
    </div>

    <script>
        const astData = $ast_data;

        function renderModules() {
            const grid = document.getElementById('moduleGrid');
            const modules = astData.modules;

            Object.keys(modules).forEach(moduleName => {
                const module = modules[moduleName];
                const card = document.createElement('div');
                card.className = 'module-card';

                card.innerHTML = \`
                    <div class="module-title">
                        \${moduleName}
                        <span class="module-type type-\${module.type}">\${module.type}</span>
                        \${module.tview_integration ? '<span class="tview-badge">TView</span>' : ''}
                    </div>
                    <div class="function-list">
                        \${module.functions.map(f => \`• \${f.name}\`).join('<br>')}
                    </div>
                    <div class="stats">
                        Functions: \${module.functions.length} |
                        Dependencies: \${module.dependencies.length}
                    </div>
                \`;

                grid.appendChild(card);
            });
        }

        renderModules();
    </script>
</body>
</html>
EOF

    echo "🌐 Starting local demo server on port $port"
    echo "📁 Files in: $output_dir"
    cd "$output_dir"

    if command -v python3 >/dev/null; then
        echo "🚀 Local modules: http://localhost:$port"
        python3 -m http.server "$port"
    else
        echo "Python3 not found - files ready in $output_dir"
    fi
}

# Main execution
case "${1:-show}" in
    "show")
        show_local_modules
        ;;
    "web")
        show_local_web "$2"
        ;;
    "ast")
        generate_local_ast
        ;;
    *)
        echo "Usage: $0 [show|web|ast] [port]"
        echo "  show - Display local modules analysis"
        echo "  web  - Start web viewer for local modules"
        echo "  ast  - Generate JSON AST for local modules"
        ;;
esac