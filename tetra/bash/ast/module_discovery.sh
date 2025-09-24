#!/usr/bin/env bash

# Tetra Module Discovery AST
# Generates structured metadata about bash modules without complex semantic analysis

# AST Schema (JSON output):
# {
#   "modules": {
#     "module_name": {
#       "path": "/path/to/module",
#       "type": "core|extension|plugin",
#       "dependencies": ["module1", "module2"],
#       "functions": [
#         {
#           "name": "function_name",
#           "line": 42,
#           "doc": "Function description from comments",
#           "exported": true|false
#         }
#       ],
#       "variables": ["VAR1", "VAR2"],
#       "description": "Module description from header comments"
#     }
#   },
#   "dependency_graph": {
#     "module_name": ["depends_on1", "depends_on2"]
#   },
#   "function_index": {
#     "function_name": "module_name"
#   }
# }

# Parse a single bash file and extract module metadata
parse_bash_file() {
    local file_path="$1"
    local module_name="$2"

    # Extract functions - improved regex to avoid partial matches
    {
        # Match: function name() or function name {
        grep -n "^[[:space:]]*function[[:space:]]\+[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*[(){]" "$file_path" | \
        sed -E 's/^([0-9]+):.*function[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*[(){].*/\1:\2/'

        # Match: name() { but not if it's part of a longer word
        grep -n "^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*[[:space:]]*()[[:space:]]*{" "$file_path" | \
        sed -E 's/^([0-9]+):[[:space:]]*([a-zA-Z_][a-zA-Z0-9_]*)[[:space:]]*\(\)[[:space:]]*\{.*/\1:\2/'
    } | sort -n

    # Extract source statements for dependencies - more precise
    grep -n "^[[:space:]]*source[[:space:]]\|^[[:space:]]*\.[[:space:]]" "$file_path" | \
    grep -v "^#" | \
    sed -E 's/^[0-9]+:.*source[[:space:]]+["\x27]*([^"\x27[:space:]]+)["\x27]*.*/dep:\1/' | \
    sed -E 's/^[0-9]+:.*\.[[:space:]]+["\x27]*([^"\x27[:space:]]+)["\x27]*.*/dep:\1/' | \
    grep "^dep:" | sort -u

    # Extract exported functions
    grep -n "^[[:space:]]*export[[:space:]]\+-f" "$file_path" | \
    sed -E 's/^([0-9]+):.*export[[:space:]]+-f[[:space:]]+([a-zA-Z_][a-zA-Z0-9_]*).*/export:\2/'

    # Extract module description from header comments
    head -20 "$file_path" | grep "^#" | head -5
}

# Discover all tetra modules
discover_modules() {
    local tetra_bash_dir="${1:-$TETRA_SRC/bash}"

    echo "{"
    echo "  \"modules\": {"

    local first_module=true

    # Process each subdirectory as a module
    for module_dir in "$tetra_bash_dir"/*/; do
        if [[ -d "$module_dir" ]]; then
            local module_name=$(basename "$module_dir")
            local main_file="$module_dir/${module_name}.sh"

            # Skip if main module file doesn't exist
            [[ ! -f "$main_file" ]] && continue

            [[ "$first_module" = false ]] && echo ","
            first_module=false

            echo "    \"$module_name\": {"
            echo "      \"path\": \"$module_dir\","
            echo "      \"type\": \"$(determine_module_type "$module_name")\","
            echo "      \"tview_integration\": $(has_tview_integration "$module_dir"),"
            echo "      \"functions\": ["

            # Parse functions from main module file
            local first_function=true
            while IFS=':' read -r line_num func_name; do
                [[ -z "$func_name" ]] && continue
                [[ "$first_function" = false ]] && echo ","
                first_function=false
                echo "        {"
                echo "          \"name\": \"$func_name\","
                echo "          \"line\": $line_num,"
                echo "          \"exported\": $(is_function_exported "$main_file" "$func_name")"
                echo -n "        }"
            done < <(parse_bash_file "$main_file" "$module_name" | grep -v "^dep:" | grep -v "^export:" | grep -v "^#")

            echo ""
            echo "      ],"

            # Extract dependencies - deduplicated
            echo "      \"dependencies\": ["
            local first_dep=true
            local deps_found=()
            while read -r dep_line; do
                if [[ "$dep_line" == dep:* ]]; then
                    local dep_path="${dep_line#dep:}"
                    local dep_module=$(extract_module_name_from_path "$dep_path")
                    [[ -z "$dep_module" ]] && continue
                    [[ "$dep_module" == "$module_name" ]] && continue  # Skip self-references

                    # Check if already added
                    local already_added=false
                    for existing_dep in "${deps_found[@]}"; do
                        if [[ "$existing_dep" == "$dep_module" ]]; then
                            already_added=true
                            break
                        fi
                    done

                    if [[ "$already_added" == false ]]; then
                        [[ "$first_dep" = false ]] && echo ","
                        first_dep=false
                        echo -n "        \"$dep_module\""
                        deps_found+=("$dep_module")
                    fi
                fi
            done < <(parse_bash_file "$main_file" "$module_name")
            echo ""
            echo "      ]"
            echo -n "    }"
        fi
    done

    echo ""
    echo "  }"
    echo "}"
}

# Helper functions
determine_module_type() {
    local module="$1"
    case "$module" in
        tsm|tview|git|ssh|enc|deploy|nginx|sync|sys) echo "core" ;;
        agents|hotrod|reporting) echo "extension" ;;
        pb|node|pico|pm|tmux|user) echo "legacy" ;;
        anthropic|claude|melvin|nvm|paste|pbvm|ml) echo "experimental" ;;
        wip|graveyard) echo "deprecated" ;;
        *) echo "plugin" ;;
    esac
}

is_function_exported() {
    local file="$1"
    local func="$2"
    grep -q "export[[:space:]]\+-f[[:space:]]\+$func" "$file" && echo "true" || echo "false"
}

extract_module_name_from_path() {
    local path="$1"
    # Extract module name from various path formats
    if [[ "$path" == *"/bash/"* ]]; then
        echo "$path" | sed -E 's|.*/bash/([^/]+)/.*|\1|'
    elif [[ "$path" == *"tsm_"* ]]; then
        echo "tsm"
    elif [[ "$path" == *"tview_"* ]]; then
        echo "tview"
    fi
}

has_tview_integration() {
    local module_dir="$1"
    local tview_dir="$module_dir/tview"

    if [[ -d "$tview_dir" ]]; then
        echo "true"
    else
        echo "false"
    fi
}

# Generate dependency graph
generate_dependency_graph() {
    discover_modules | jq -r '
        .modules | to_entries[] |
        select(.value.dependencies | length > 0) |
        "\(.key): \(.value.dependencies | join(" "))"
    '
}

# Generate function index
generate_function_index() {
    discover_modules | jq -r '
        .modules | to_entries[] as $module |
        $module.value.functions[] |
        "\(.name): \($module.key)"
    '
}

# Main execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-discover}" in
        "discover")
            discover_modules "$2"
            ;;
        "deps")
            generate_dependency_graph
            ;;
        "functions")
            generate_function_index
            ;;
        *)
            echo "Usage: $0 [discover|deps|functions] [tetra_bash_dir]"
            echo "  discover  - Generate full module AST (default)"
            echo "  deps      - Show dependency graph"
            echo "  functions - Show function index"
            ;;
    esac
fi