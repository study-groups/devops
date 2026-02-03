#!/usr/bin/env bash
# mf rules management
# Global rules: $MF_DIR/config/rules
# Project rules: .rag/config/rules (walks up tree)

MF_RULES_FILE="${MF_DIR:-$HOME/tetra/magicfind}/config/rules"

# Initialize rules file with defaults if it doesn't exist
_mf_rules_init() {
    local rules_dir="${MF_RULES_FILE%/*}"
    if [[ ! -f "$MF_RULES_FILE" ]]; then
        mkdir -p "$rules_dir"
        cat > "$MF_RULES_FILE" << 'RULES'
exclude node_modules directories
exclude .git directories
use macOS-compatible syntax (no GNU extensions like -printf)
prefer simple commands over complex pipelines
when searching file contents use rg -il for file listing or rg -in for matches with line numbers
RULES
    fi
}

# Get global rules as numbered list
_mf_rules_get() {
    [[ -f "$MF_RULES_FILE" ]] || return 0
    local num=1
    while IFS= read -r rule || [[ -n "$rule" ]]; do
        [[ -z "$rule" ]] && continue
        echo "$num. $rule"
        ((num++))
    done < "$MF_RULES_FILE"
}

# Find .rag/config/rules by walking up directory tree
_mf_rules_find_project() {
    local dir="$PWD"
    while [[ "$dir" != "/" ]]; do
        if [[ -f "$dir/.rag/config/rules" ]]; then
            echo "$dir/.rag/config/rules"
            return 0
        fi
        dir="${dir%/*}"
        [[ -z "$dir" ]] && dir="/"
    done
    return 1
}

# Get project-specific rules
_mf_rules_get_project() {
    local rag_file
    rag_file=$(_mf_rules_find_project) || return 0
    if [[ -f "$rag_file" ]]; then
        echo "# Project rules from $rag_file:"
        cat "$rag_file"
    fi
}

# Get all rules (global + project) for prompt injection
_mf_rules_all() {
    local rules=""

    # Global rules
    local global=$(_mf_rules_get)
    [[ -n "$global" ]] && rules+="Global rules:
$global

"

    # Project rules
    local project=$(_mf_rules_get_project)
    [[ -n "$project" ]] && rules+="$project"

    echo "$rules"
}

# Manage rules subcommand
_mf_rules() {
    _mf_rules_init
    local action="${1:-list}"
    shift 2>/dev/null || true

    case "$action" in
        list|show|"")
            echo "Global: $MF_RULES_FILE"
            local project=$(_mf_rules_find_project)
            [[ -n "$project" ]] && echo "Project: $project"
            echo "---"
            _mf_rules_get
            if [[ -n "$project" ]]; then
                echo ""
                echo "--- Project ---"
                cat "$project"
            fi
            ;;
        add)
            [[ -z "$*" ]] && { echo "Usage: mf rules add <rule>" >&2; return 1; }
            echo "$*" >> "$MF_RULES_FILE"
            echo "Added: $*"
            ;;
        rm|remove|del)
            local line_num="$1"
            [[ -z "$line_num" ]] && { echo "Usage: mf rules rm <number>" >&2; return 1; }
            if [[ "$line_num" =~ ^[0-9]+$ ]]; then
                local temp_file=$(mktemp)
                awk -v n="$line_num" 'NR != n' "$MF_RULES_FILE" > "$temp_file"
                mv "$temp_file" "$MF_RULES_FILE"
                echo "Removed rule #$line_num"
            else
                echo "Error: provide rule number" >&2
                return 1
            fi
            ;;
        clear)
            > "$MF_RULES_FILE"
            echo "Cleared all rules"
            ;;
        reset)
            rm -f "$MF_RULES_FILE"
            _mf_rules_init
            echo "Reset to defaults"
            ;;
        path)
            echo "Global: $MF_RULES_FILE"
            local project=$(_mf_rules_find_project)
            [[ -n "$project" ]] && echo "Project: $project"
            ;;
        *)
            echo "Unknown: $action" >&2
            echo "Actions: list, add, rm, clear, reset, path" >&2
            return 1
            ;;
    esac
}
