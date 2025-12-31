#!/usr/bin/env bash
# qa_views.sh - TOML-configured view collections for RAG export (v2)
#
# Views are curated collections of QA entries with TOML configuration.
# Useful for:
#   - Creating reference sets for RAG systems
#   - Bundling related entries for export
#   - Building training corpora with context/system prompts
#
# Storage:
#   $QA_DIR/views/<name>/
#     ├── view.toml              - Configuration with context
#     ├── <id>.prompt -> ...     - Symlink to source
#     ├── <id>.answer -> ...     - Symlink to source
#     └── view.manifest          - List of entry IDs

# =============================================================================
# VIEW DIRECTORY MANAGEMENT
# =============================================================================

# Get the views directory
_qa_views_dir() {
    echo "$QA_DIR/views"
}

# Get a specific view directory
_qa_view_dir() {
    local name="$1"
    echo "$(_qa_views_dir)/$name"
}

# Ensure views directory exists
_qa_ensure_views_dir() {
    mkdir -p "$(_qa_views_dir)"
}

# =============================================================================
# VIEW CREATION AND MANAGEMENT
# =============================================================================

# Create a new view with TOML configuration
# Usage: qa_view_create <name> [id...]
qa_view_create() {
    local name="$1"
    shift

    [[ -z "$name" ]] && { echo "Usage: qa view create <name> [id...]"; return 1; }

    # Validate name
    [[ ! "$name" =~ ^[a-zA-Z0-9_-]+$ ]] && {
        echo "Invalid view name (use a-z, 0-9, _, -)"
        return 1
    }

    local view_dir="$(_qa_view_dir "$name")"

    if [[ -d "$view_dir" ]]; then
        echo "View '$name' already exists"
        return 1
    fi

    _qa_ensure_views_dir
    mkdir -p "$view_dir"

    # Create TOML configuration
    cat > "$view_dir/view.toml" << EOF
[view]
name = "$name"
description = ""
created = "$(date -Iseconds)"

[source]
# Where entries come from (for reference)
channels = ["db"]

[context]
# RAG-specific configuration
# system_prompt = "You are a helpful assistant..."
# temperature = 0.7

[export]
format = "jsonl"
include_metadata = true
EOF

    # Initialize manifest
    echo "# View: $name" > "$view_dir/view.manifest"
    echo "# Created: $(date -Iseconds)" >> "$view_dir/view.manifest"
    echo "" >> "$view_dir/view.manifest"

    echo "Created view: $name"
    echo "  Config: $view_dir/view.toml"

    # Add initial entries if provided
    if [[ $# -gt 0 ]]; then
        qa_view_add "$name" "$@"
    fi
}

# Add entries to a view
# Usage: qa_view_add <name> <id...>
# Or:    qa_view_add <name> --from <channel> [--last N]
qa_view_add() {
    local name="$1"
    shift

    [[ -z "$name" ]] && { echo "Usage: qa view add <name> <id...>"; return 1; }

    local view_dir="$(_qa_view_dir "$name")"
    [[ ! -d "$view_dir" ]] && { echo "View '$name' not found"; return 1; }

    # Parse --from option
    local from_channel=""
    local last_n=0
    local ids=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --from)
                from_channel="$2"
                shift 2
                ;;
            --last)
                last_n="$2"
                shift 2
                ;;
            *)
                ids+=("$1")
                shift
                ;;
        esac
    done

    # If --from specified, get IDs from that channel
    if [[ -n "$from_channel" ]]; then
        local channel_dir="$(_qa_get_channel_dir "$from_channel")"
        if [[ ! -d "$channel_dir" ]]; then
            echo "Channel $from_channel not found"
            return 1
        fi

        local channel_ids
        if [[ $last_n -gt 0 ]]; then
            mapfile -t channel_ids < <(ls -t "$channel_dir"/*.answer 2>/dev/null | head -"$last_n" | xargs -I{} basename {} .answer)
        else
            mapfile -t channel_ids < <(ls -t "$channel_dir"/*.answer 2>/dev/null | xargs -I{} basename {} .answer)
        fi
        ids+=("${channel_ids[@]}")
    fi

    [[ ${#ids[@]} -eq 0 ]] && { echo "No IDs to add"; return 1; }

    local base="${QA_DIR:-$TETRA_DIR/qa}"
    local added=0
    for id in "${ids[@]}"; do
        # Find source files (v2 structure - flat channels)
        local src_dir=""

        # Check main db first
        if [[ -f "$base/db/$id.answer" ]]; then
            src_dir="$base/db"
        else
            # Check all channels (flat structure)
            for cdir in "$base/channels"/*/; do
                [[ -d "$cdir" ]] || continue
                [[ "$(basename "$cdir")" == "archive" ]] && continue
                if [[ -f "$cdir/$id.answer" ]]; then
                    src_dir="$cdir"
                    break
                fi
            done
        fi

        if [[ -z "$src_dir" ]]; then
            echo "  Not found: $id"
            continue
        fi

        # Calculate relative path for symlink
        local rel_path
        rel_path=$(python3 -c "import os; print(os.path.relpath('$src_dir', '$view_dir'))" 2>/dev/null)
        if [[ -z "$rel_path" ]]; then
            # Fallback to absolute paths if python not available
            rel_path="$src_dir"
        fi

        # Create symlinks (views use subset - no data/response)
        for ext in "${QA_VIEW_EXTENSIONS[@]}"; do
            if [[ -f "$src_dir/$id.$ext" ]]; then
                ln -sf "$rel_path/$id.$ext" "$view_dir/$id.$ext" 2>/dev/null
            fi
        done

        # Add to manifest
        echo "$id" >> "$view_dir/view.manifest"
        echo "  Added: $id"
        ((added++))
    done

    echo "Added $added entries to view '$name'"
}

# Remove entries from a view
# Usage: qa_view_remove <name> <id...>
qa_view_remove() {
    local name="$1"
    shift

    [[ -z "$name" ]] && { echo "Usage: qa view remove <name> <id...>"; return 1; }

    local view_dir="$(_qa_view_dir "$name")"
    [[ ! -d "$view_dir" ]] && { echo "View '$name' not found"; return 1; }

    local removed=0
    for id in "$@"; do
        # Remove symlinks
        for ext in "${QA_VIEW_EXTENSIONS[@]}"; do
            rm -f "$view_dir/$id.$ext"
        done

        # Remove from manifest (but keep comments)
        if [[ -f "$view_dir/view.manifest" ]]; then
            grep -v "^$id$" "$view_dir/view.manifest" > "$view_dir/view.manifest.tmp"
            mv "$view_dir/view.manifest.tmp" "$view_dir/view.manifest"
        fi

        echo "  Removed: $id"
        ((removed++))
    done

    echo "Removed $removed entries from view '$name'"
}

# Delete a view
qa_view_delete() {
    local name="$1"

    [[ -z "$name" ]] && { echo "Usage: qa view delete <name>"; return 1; }

    local view_dir="$(_qa_view_dir "$name")"
    [[ ! -d "$view_dir" ]] && { echo "View '$name' not found"; return 1; }

    local count=$(ls "$view_dir"/*.answer 2>/dev/null | wc -l | tr -d ' ')
    if [[ $count -gt 0 ]]; then
        read -p "Delete view '$name' with $count refs? [y/N] " confirm
        [[ "$confirm" != "y" && "$confirm" != "Y" ]] && return 1
    fi

    rm -rf "$view_dir"
    echo "Deleted view: $name"
}

# List all views
qa_views() {
    local views_dir="$(_qa_views_dir)"

    echo "VIEWS"
    if [[ ! -d "$views_dir" ]]; then
        echo "  (none - create with: qa view create <name>)"
        return 0
    fi

    local found=0
    for dir in "$views_dir"/*/; do
        [[ -d "$dir" ]] || continue
        local name=$(basename "$dir")
        local count=$(ls "$dir"/*.answer 2>/dev/null | wc -l | tr -d ' ')
        printf "  %-20s %3s refs\n" "$name" "$count"
        ((found++))
    done

    [[ $found -eq 0 ]] && echo "  (none - create with: qa view create <name>)"
}

# Show view contents
qa_view_show() {
    local name="$1"

    [[ -z "$name" ]] && { echo "Usage: qa view show <name>"; return 1; }

    local view_dir="$(_qa_view_dir "$name")"
    [[ ! -d "$view_dir" ]] && { echo "View '$name' not found"; return 1; }

    echo "View: $name"
    echo "Path: $view_dir"

    # Show TOML config summary if present
    if [[ -f "$view_dir/view.toml" ]]; then
        echo ""
        echo "Config (view.toml):"
        # Extract key values from TOML
        local desc=$(grep -E '^description\s*=' "$view_dir/view.toml" 2>/dev/null | sed 's/.*=\s*"\(.*\)"/\1/')
        local format=$(grep -E '^format\s*=' "$view_dir/view.toml" 2>/dev/null | sed 's/.*=\s*"\(.*\)"/\1/')
        [[ -n "$desc" ]] && echo "  Description: $desc"
        [[ -n "$format" ]] && echo "  Export format: $format"
    fi

    echo ""
    echo "Entries:"

    for answer in "$view_dir"/*.answer; do
        [[ -f "$answer" ]] || continue
        local id=$(basename "$answer" .answer)
        local prompt=""
        [[ -L "$view_dir/$id.prompt" ]] && prompt=$(head -c 60 "$view_dir/$id.prompt" 2>/dev/null)
        printf "  %s: %.60s...\n" "$id" "$prompt"
    done
}

# View or edit TOML configuration
# Usage: qa_view_config <name> [edit]
qa_view_config() {
    local name="$1"
    local action="${2:-show}"

    [[ -z "$name" ]] && { echo "Usage: qa view config <name> [edit]"; return 1; }

    local view_dir="$(_qa_view_dir "$name")"
    [[ ! -d "$view_dir" ]] && { echo "View '$name' not found"; return 1; }

    local toml_file="$view_dir/view.toml"

    if [[ ! -f "$toml_file" ]]; then
        echo "No view.toml found. Creating default..."
        cat > "$toml_file" << EOF
[view]
name = "$name"
description = ""
created = "$(date -Iseconds)"

[source]
channels = ["db"]

[context]
# system_prompt = ""
# temperature = 0.7

[export]
format = "jsonl"
include_metadata = true
EOF
    fi

    case "$action" in
        show)
            cat "$toml_file"
            ;;
        edit)
            ${EDITOR:-vim} "$toml_file"
            ;;
        *)
            echo "Unknown action: $action (use show or edit)"
            return 1
            ;;
    esac
}

# =============================================================================
# VIEW EXPORT FOR RAG
# =============================================================================

# Export view as JSONL (one JSON object per line)
# Usage: qa_view_export <name> [--format jsonl|md|txt]
qa_view_export() {
    local name="$1"
    local format="${2:-jsonl}"

    [[ -z "$name" ]] && { echo "Usage: qa view export <name> [--format jsonl|md|txt]"; return 1; }

    # Handle --format flag
    if [[ "$name" == "--format" ]]; then
        format="$2"
        name="$3"
    fi

    local view_dir="$(_qa_view_dir "$name")"
    [[ ! -d "$view_dir" ]] && { echo "View '$name' not found" >&2; return 1; }

    case "$format" in
        jsonl|json)
            for answer in "$view_dir"/*.answer; do
                [[ -f "$answer" ]] || continue
                local id=$(basename "$answer" .answer)
                local prompt=""
                local ans=""
                [[ -f "$view_dir/$id.prompt" ]] && prompt=$(cat "$view_dir/$id.prompt")
                [[ -f "$view_dir/$id.answer" ]] && ans=$(cat "$view_dir/$id.answer")

                jq -nc \
                    --arg id "$id" \
                    --arg prompt "$prompt" \
                    --arg answer "$ans" \
                    '{id: $id, prompt: $prompt, answer: $answer}'
            done
            ;;

        md|markdown)
            echo "# View: $name"
            echo ""
            for answer in "$view_dir"/*.answer; do
                [[ -f "$answer" ]] || continue
                local id=$(basename "$answer" .answer)
                echo "## Entry: $id"
                echo ""
                echo "**Question:**"
                [[ -f "$view_dir/$id.prompt" ]] && cat "$view_dir/$id.prompt"
                echo ""
                echo "**Answer:**"
                [[ -f "$view_dir/$id.answer" ]] && cat "$view_dir/$id.answer"
                echo ""
                echo "---"
                echo ""
            done
            ;;

        txt|text)
            for answer in "$view_dir"/*.answer; do
                [[ -f "$answer" ]] || continue
                local id=$(basename "$answer" .answer)
                echo "=== $id ==="
                echo "Q: $(cat "$view_dir/$id.prompt" 2>/dev/null)"
                echo ""
                echo "A: $(cat "$view_dir/$id.answer" 2>/dev/null)"
                echo ""
            done
            ;;

        *)
            echo "Unknown format: $format (use jsonl, md, or txt)" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# MAIN VIEW COMMAND
# =============================================================================

qa_view() {
    local subcmd="${1:-list}"
    shift 2>/dev/null || true

    case "$subcmd" in
        create)
            qa_view_create "$@"
            ;;
        add)
            qa_view_add "$@"
            ;;
        remove|rm)
            qa_view_remove "$@"
            ;;
        delete|del)
            qa_view_delete "$@"
            ;;
        list|ls|"")
            qa_views
            ;;
        show)
            qa_view_show "$@"
            ;;
        config|cfg)
            qa_view_config "$@"
            ;;
        export)
            qa_view_export "$@"
            ;;
        *)
            echo "View commands (v2 with TOML):"
            echo "  create <name> [id...]    Create view with TOML config"
            echo "  add <name> <id...>       Add entries to view"
            echo "  add <name> --from 2      Add entries from channel"
            echo "  remove <name> <id...>    Remove entries from view"
            echo "  delete <name>            Delete view"
            echo "  list                     List all views"
            echo "  show <name>              Show view contents"
            echo "  config <name>            Show TOML configuration"
            echo "  config <name> edit       Edit TOML configuration"
            echo "  export <name> [format]   Export (jsonl, md, txt)"
            ;;
    esac
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _qa_views_dir _qa_view_dir _qa_ensure_views_dir
export -f qa_view_create qa_view_add qa_view_remove qa_view_delete
export -f qa_views qa_view_show qa_view_config qa_view_export qa_view
