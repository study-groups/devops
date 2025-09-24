#!/usr/bin/env bash

# Span TView Actions - Interactive operations for span management

# Source span modules
SPAN_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
source "$SPAN_DIR/span.sh"

# Handle span module actions
span_handle_action() {
    local action="$1"
    local env="$CURRENT_ENV"
    local item="$CURRENT_ITEM"

    case "$env:$action" in
        "TETRA:enter")
            span_tetra_enter_action "$item"
            ;;
        "TETRA:1"|"TETRA:2"|"TETRA:3"|"TETRA:4"|"TETRA:5"|"TETRA:6"|"TETRA:7"|"TETRA:8"|"TETRA:9")
            span_load_slot "${action#*:}"
            ;;
        "LOCAL:enter")
            span_local_enter_action "$item"
            ;;
        "DEV:enter")
            span_dev_enter_action "$item"
            ;;
        *)
            echo "Unknown span action: $env:$action"
            ;;
    esac
}

# TETRA environment actions
span_tetra_enter_action() {
    local item="$1"
    case "$item" in
        0)  # Span Storage Management
            span_show_storage_manager
            ;;
        1)  # Create New Multispan
            span_create_multispan_interactive
            ;;
        2)  # Search Across All Spans
            span_global_search
            ;;
        3)  # Export/Import Spans
            span_export_import_manager
            ;;
        *)
            echo "Invalid item: $item"
            ;;
    esac
}

# LOCAL environment actions
span_local_enter_action() {
    local item="$1"
    case "$item" in
        0)  # Analyze TOML Files
            span_analyze_toml_files
            ;;
        1)  # Scan Shell Scripts
            span_analyze_shell_files
            ;;
        2)  # Find Functions
            span_find_functions
            ;;
        3)  # Search Patterns
            span_search_patterns_interactive
            ;;
        *)
            echo "Invalid item: $item"
            ;;
    esac
}

# DEV environment actions
span_dev_enter_action() {
    local item="$1"
    case "$item" in
        0)  # SSH Status
            span_test_ssh_connection
            ;;
        1)  # Remote Configuration Files
            span_analyze_remote_configs
            ;;
        2)  # Service Definitions
            span_analyze_remote_services
            ;;
        3)  # Log Pattern Analysis
            span_analyze_remote_logs
            ;;
        *)
            echo "Invalid item: $item"
            ;;
    esac
}

# Specific action implementations

span_show_storage_manager() {
    cat << EOF

📦 Span Storage Manager

$(multispan_show_storage)

Commands:
  1-9    Load slot
  c      Clear slot
  r      Rename slot
  e      Export slot to file
  i      Import from file

Press any key to continue...
EOF
    read -n1 -s
}

span_create_multispan_interactive() {
    echo -n "Enter multispan name: "
    read -r name
    if [[ -n "$name" ]]; then
        multispan_create "$name"
        ACTIVE_SPAN_MULTISPAN="$name"
        echo "Created and activated multispan: $name"
    fi
    echo "Press any key to continue..."
    read -n1 -s
}

span_global_search() {
    echo -n "Enter search pattern: "
    read -r pattern
    if [[ -n "$pattern" ]]; then
        echo "Searching pattern '$pattern' across all stored spans..."
        for slot in {1..9}; do
            local -n storage_ref="SPAN_STORAGE_${slot}"
            if [[ ${#storage_ref[@]} -gt 0 ]]; then
                local desc="${SPAN_METADATA[$slot]:-slot_$slot}"
                echo "Searching in [$slot] $desc:"
                # Create temporary multispan to search
                multispan_create "temp_search_$slot"
                local -n temp_ref="MULTISPAN_temp_search_$slot"
                for key in "${!storage_ref[@]}"; do
                    temp_ref["$key"]="${storage_ref[$key]}"
                done
                multispan_search "temp_search_$slot" "$pattern"
                echo
            fi
        done
    fi
    echo "Press any key to continue..."
    read -n1 -s
}

span_analyze_toml_files() {
    echo "Analyzing TOML files in current directory..."
    local toml_files=(*.toml)
    if [[ -e "${toml_files[0]}" ]]; then
        multispan_create "toml_analysis"
        for file in "${toml_files[@]}"; do
            echo "  Analyzing: $file"
            # Find sections [section_name]
            local cursors=$(cursor_from_grep '^\[.*\]' "$file" "toml_section")
            while IFS= read -r cursor; do
                [[ -n "$cursor" ]] && multispan_add_cursor "toml_analysis" "$cursor"
            done <<< "$cursors"
        done
        ACTIVE_SPAN_MULTISPAN="toml_analysis"
        echo "Created multispan 'toml_analysis' with TOML sections"
    else
        echo "No TOML files found in current directory"
    fi
    echo "Press any key to continue..."
    read -n1 -s
}

span_analyze_shell_files() {
    echo "Analyzing shell scripts in current directory..."
    local sh_files=(*.sh)
    if [[ -e "${sh_files[0]}" ]]; then
        multispan_create "shell_analysis"
        for file in "${sh_files[@]}"; do
            echo "  Analyzing: $file"
            # Find function definitions
            local cursors=$(cursor_from_grep '^[a-zA-Z_][a-zA-Z0-9_]*()' "$file" "function_def")
            while IFS= read -r cursor; do
                [[ -n "$cursor" ]] && multispan_add_cursor "shell_analysis" "$cursor"
            done <<< "$cursors"
        done
        ACTIVE_SPAN_MULTISPAN="shell_analysis"
        echo "Created multispan 'shell_analysis' with function definitions"
    else
        echo "No shell files found in current directory"
    fi
    echo "Press any key to continue..."
    read -n1 -s
}

span_find_functions() {
    echo -n "Enter function name pattern: "
    read -r pattern
    if [[ -n "$pattern" ]]; then
        echo "Finding functions matching '$pattern'..."
        multispan_create "function_search"
        find . -name "*.sh" -type f | while read -r file; do
            local cursors=$(cursor_from_grep "$pattern.*(" "$file" "function_match")
            while IFS= read -r cursor; do
                [[ -n "$cursor" ]] && multispan_add_cursor "function_search" "$cursor"
            done <<< "$cursors"
        done
        ACTIVE_SPAN_MULTISPAN="function_search"
        echo "Created multispan 'function_search'"
    fi
    echo "Press any key to continue..."
    read -n1 -s
}

span_load_slot() {
    local slot="$1"
    local name="loaded_from_slot_$slot"

    echo "Loading multispan from slot [$slot]..."
    if multispan_load "$slot" "$name"; then
        ACTIVE_SPAN_MULTISPAN="$name"
        echo "Loaded and activated: $name"
        multispan_list "$name"
    else
        echo "Failed to load from slot [$slot]"
    fi
    echo "Press any key to continue..."
    read -n1 -s
}

# Additional utility functions for actions
span_test_ssh_connection() {
    echo "Testing SSH connection to DEV environment..."
    local ssh_prefix="${CURRENT_SSH_PREFIXES[dev_root]:-ssh dev}"
    if timeout 5 ${ssh_prefix#ssh } "echo 'SSH connection successful'"; then
        echo "✓ SSH connection established"
        echo "Ready for remote span analysis"
    else
        echo "✗ SSH connection failed"
        echo "Cannot perform remote span operations"
    fi
    echo "Press any key to continue..."
    read -n1 -s
}

# Export span action functions
export -f span_handle_action