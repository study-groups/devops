#!/usr/bin/env bash

# Tetra Interactive Documentation Generator
# Uses Module Discovery AST to create browsable documentation

source "$HOME/src/devops/tetra/bash/utils/tetra-pre-flight-check.sh" check || exit 1

# Colors and formatting
declare -r RED='\033[0;31m'
declare -r GREEN='\033[0;32m'
declare -r BLUE='\033[0;34m'
declare -r YELLOW='\033[1;33m'
declare -r CYAN='\033[0;36m'
declare -r BOLD='\033[1m'
declare -r NC='\033[0m'

# Generate HTML documentation
generate_html_docs() {
    local output_dir="${1:-/tmp/tetra-docs}"
    local ast_data
    local templates_dir="$TETRA_SRC/bash/ast/templates"

    mkdir -p "$output_dir"

    # Get AST data
    ast_data="$($TETRA_SRC/bash/ast/module_discovery.sh discover)"

    # Copy static files
    cp "$templates_dir/styles.css" "$output_dir/"
    cp "$templates_dir/app.js" "$output_dir/"

    # Generate HTML using templates
    {
        cat "$templates_dir/header.html"

        # Generate module cards
        echo "$ast_data" | jq -r '
            .modules | to_entries[] |
            "<div class=\"module-card " + .value.type + "\" data-name=\"" + .key + "\" data-type=\"" + .value.type + "\">
                <div class=\"module-title\">" + .key +
                    (if .value.tview_integration then
                        "<span class=\"tview-badge\">TView</span>"
                    else
                        ""
                    end) +
                    (if .value.type == "legacy" then
                        "<span class=\"legacy-badge\">LEGACY</span>"
                    elif .value.type == "experimental" then
                        "<span class=\"experimental-badge\">EXPERIMENTAL</span>"
                    elif .value.type == "deprecated" then
                        "<span class=\"deprecated-badge\">DEPRECATED</span>"
                    else
                        ""
                    end) +
                "</div>
                <div class=\"module-type\">" + (.value.type | ascii_upcase) + "</div>
                <div class=\"function-list\">
                    <strong>Functions (" + (.value.functions | length | tostring) + "):</strong><br>" +
                    (.value.functions | map(
                        if .exported then
                            "<span class=\"function exported\">" + .name + "</span> <small>(exported)</small>"
                        else
                            "<span class=\"function\">" + .name + "</span>"
                        end
                    ) | join("<br>")) + "
                </div>" +
                (if (.value.dependencies | length) > 0 then
                    "<div class=\"deps\"><strong>Dependencies:</strong> " + (.value.dependencies | join(", ")) + "</div>"
                else
                    ""
                end) + "
            </div>"
        '

        cat "$templates_dir/footer.html"
    } > "$output_dir/index.html"

    echo "Documentation generated at: $output_dir/index.html"
    echo "Open in browser: open $output_dir/index.html"
    echo ""
    echo "To serve with TSM web server:"
    echo "  cd $output_dir"
    echo "  tsm start-webserver --port 8080"
    echo "  open http://localhost:8080"
}

# Generate markdown documentation
generate_markdown_docs() {
    local output_file="${1:-/tmp/tetra-docs.md}"
    local ast_data

    ast_data="$($TETRA_SRC/bash/ast/module_discovery.sh discover)"

    cat > "$output_file" << 'EOF'
# Tetra Module Documentation

*Generated from Module Discovery AST*

## Module Overview

EOF

    # Generate markdown table
    echo "$ast_data" | jq -r '
        "| Module | Type | Functions | Dependencies |",
        "|--------|------|-----------|--------------|",
        (.modules | to_entries[] |
        "| **\(.key)** | \(.value.type) | \(.value.functions | length) | \(.value.dependencies | join(\", \") // \"none\") |")
    ' >> "$output_file"

    echo -e "\n## Detailed Module Information\n" >> "$output_file"

    # Generate detailed sections
    echo "$ast_data" | jq -r '
        .modules | to_entries[] |
        "### \(.key) (\(.value.type))\n",
        "**Path:** `\(.value.path)`\n",
        (if (.value.dependencies | length) > 0 then
            "**Dependencies:** \(.value.dependencies | join(\", \"))\n"
        else
            ""
        end),
        "**Functions:**\n",
        (.value.functions | map(
            if .exported then
                "- `\(.name)` (exported) - line \(.line)"
            else
                "- `\(.name)` - line \(.line)"
            end
        ) | join("\n")),
        "\n---\n"
    ' >> "$output_file"

    echo "Markdown documentation generated at: $output_file"
}

# Interactive terminal browser
browse_modules() {
    local ast_data
    ast_data="$($TETRA_SRC/bash/ast/module_discovery.sh discover)"

    while true; do
        clear
        echo -e "${BOLD}🚀 Tetra Module Browser${NC}\n"

        # Show module list
        echo "$ast_data" | jq -r '
            .modules | to_entries[] |
            "\(.key) (\(.value.type)) - \(.value.functions | length) functions"
        ' | nl -w2 -s'. '

        echo -e "\n${CYAN}Commands:${NC}"
        echo "  <number> - View module details"
        echo "  f        - Search functions"
        echo "  d        - Show dependency graph"
        echo "  q        - Quit"

        read -p $'\n> ' choice

        case "$choice" in
            [0-9]*)
                local module_name
                module_name=$(echo "$ast_data" | jq -r ".modules | keys[$((choice-1))]" 2>/dev/null)
                if [[ "$module_name" != "null" && -n "$module_name" ]]; then
                    show_module_details "$ast_data" "$module_name"
                else
                    echo "Invalid module number"
                    sleep 1
                fi
                ;;
            "f")
                search_functions "$ast_data"
                ;;
            "d")
                show_dependency_graph
                ;;
            "q")
                break
                ;;
            *)
                echo "Invalid choice"
                sleep 1
                ;;
        esac
    done
}

show_module_details() {
    local ast_data="$1"
    local module_name="$2"

    clear
    echo -e "${BOLD}📦 Module: $module_name${NC}\n"

    echo "$ast_data" | jq -r "
        .modules[\"$module_name\"] |
        \"Path: \(.path)\",
        \"Type: \(.type)\",
        \"Functions: \(.functions | length)\",
        (if (.dependencies | length) > 0 then
            \"Dependencies: \(.dependencies | join(\\\", \\\"))\"
        else
            \"Dependencies: none\"
        end),
        \"\",
        \"Functions:\",
        (.functions | map(
            if .exported then
                \"  ✓ \(.name) (line \(.line)) - exported\"
            else
                \"  • \(.name) (line \(.line))\"
            end
        ) | join(\"\n\"))
    "

    read -p $'\nPress Enter to continue...'
}

search_functions() {
    local ast_data="$1"

    clear
    echo -e "${BOLD}🔍 Function Search${NC}\n"
    read -p "Enter function name to search: " search_term

    if [[ -n "$search_term" ]]; then
        echo -e "\n${GREEN}Results for '$search_term':${NC}\n"
        echo "$ast_data" | jq -r "
            .modules | to_entries[] as \$module |
            \$module.value.functions[] |
            select(.name | contains(\"$search_term\")) |
            \"\(.name) - \(\$module.key) (line \(.line))\"
        "
    fi

    read -p $'\nPress Enter to continue...'
}

show_dependency_graph() {
    clear
    echo -e "${BOLD}📊 Dependency Graph${NC}\n"
    $TETRA_SRC/bash/ast/module_discovery.sh deps
    read -p $'\nPress Enter to continue...'
}

# Serve documentation with TSM web server
serve_docs() {
    local port="${1:-8080}"
    local output_dir="${2:-/tmp/tetra-docs-server}"

    echo -e "${BOLD}🌐 Starting Tetra Documentation Server${NC}\n"

    # Generate fresh documentation
    generate_html_docs "$output_dir"

    echo -e "\n${GREEN}Starting web server on port $port...${NC}"

    # Change to docs directory and start server
    cd "$output_dir"

    # Check if TSM has start-webserver command, fallback to python
    if tsm help 2>/dev/null | grep -q "start-webserver"; then
        echo "Using TSM web server..."
        tsm start-webserver --port "$port"
    else
        echo "Using Python web server..."
        echo "Server running at: http://localhost:$port"
        echo "Press Ctrl+C to stop"
        python3 -m http.server "$port" 2>/dev/null || python -m SimpleHTTPServer "$port"
    fi
}

# Auto-serve with live reload
serve_live() {
    local port="${1:-8080}"
    local output_dir="${2:-/tmp/tetra-docs-live}"

    echo -e "${BOLD}🔄 Starting Live Documentation Server${NC}\n"
    echo "Watching for changes in $TETRA_SRC/bash/"

    while true; do
        # Generate documentation
        generate_html_docs "$output_dir" >/dev/null 2>&1

        # Start server in background if not running
        if ! pgrep -f "http.server $port" >/dev/null && ! pgrep -f "SimpleHTTPServer $port" >/dev/null; then
            cd "$output_dir"
            python3 -m http.server "$port" 2>/dev/null &
            SERVER_PID=$!
            echo -e "${GREEN}Server started at http://localhost:$port${NC}"
            echo "Documentation will auto-refresh every 30 seconds"
        fi

        sleep 30
    done
}

# Main execution
case "${1:-browse}" in
    "html")
        generate_html_docs "$2"
        ;;
    "markdown"|"md")
        generate_markdown_docs "$2"
        ;;
    "serve")
        serve_docs "$2" "$3"
        ;;
    "live")
        serve_live "$2" "$3"
        ;;
    "browse")
        browse_modules
        ;;
    *)
        echo "Usage: $0 [browse|html|markdown|serve|live] [port/output_path] [output_dir]"
        echo "  browse   - Interactive terminal browser (default)"
        echo "  html     - Generate HTML documentation"
        echo "  markdown - Generate Markdown documentation"
        echo "  serve    - Generate and serve HTML documentation"
        echo "  live     - Serve with auto-refresh every 30s"
        echo ""
        echo "Examples:"
        echo "  $0 serve 8080                    # Serve on port 8080"
        echo "  $0 live 9000                     # Live server on port 9000"
        echo "  $0 html ~/tetra-docs             # Generate to custom directory"
        ;;
esac