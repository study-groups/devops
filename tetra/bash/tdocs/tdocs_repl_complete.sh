#!/usr/bin/env bash
# tdocs REPL Tab Completion
# Intelligent context-aware completion for tdocs REPL

# Dependencies
if [[ -z "$TETRA_SRC" ]]; then
    echo "Error: TETRA_SRC must be set" >&2
    return 1
fi

# State tracking for hierarchical navigation
TDOCS_REPL_CONTEXT_PATH=""      # Current context path (for hierarchical navigation)
TDOCS_REPL_CONTEXT_LEVEL=0      # Depth in hierarchy

# Get available modules from database
_tdocs_get_modules() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.module' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$'
    fi
}

# Get available document types
_tdocs_get_types() {
    echo "spec guide reference bug-fix refactor plan summary investigation"
}

# Get document paths matching current filter
_tdocs_get_doc_paths() {
    local filter="${1:-}"

    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.path' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$' | \
            while read -r path; do
                # Filter by current word if provided
                [[ -z "$filter" || "$path" == *"$filter"* ]] && basename "$path"
            done
    fi
}

# Get categories (core/other)
_tdocs_get_categories() {
    echo "core other all"
}

# Get tags from database
_tdocs_get_tags() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.tags[]?' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$'
    fi
}

# Main REPL completion function (bound to TAB)
_tdocs_repl_complete() {
    local cur="${READLINE_LINE}"

    # Handle empty or whitespace-only input
    if [[ -z "$cur" || "$cur" =~ ^[[:space:]]*$ ]]; then
        cur=""
    fi

    local words=($cur)
    local word_count=${#words[@]}

    # Get current word being completed
    local current_word=""
    if [[ "$cur" =~ [[:space:]]$ ]] || [[ $word_count -eq 0 ]]; then
        # Line ends with space or is empty - complete next item
        current_word=""
    else
        # Line doesn't end with space - complete current word
        if [[ $word_count -gt 0 ]]; then
            current_word="${words[$((word_count-1))]}"
        fi
    fi

    # Get previous word (for context checking)
    local prev_word=""
    if [[ $word_count -gt 1 ]]; then
        prev_word="${words[$((word_count-2))]}"
    fi

    # Determine context
    local cmd=""
    if [[ $word_count -gt 0 ]]; then
        cmd="${words[0]}"
    fi

    local completions=()
    local descriptions=()

    # Context-based completion
    case "$cmd" in
        "")
            # No command yet - show available commands
            completions=(ls list view search filter tag init discover evidence audit env help exit quit)
            descriptions=(
                "List documents"
                "List documents (alias)"
                "View document"
                "Search documents"
                "Set filters"
                "Tag document"
                "Initialize document"
                "Discover documents"
                "Get evidence"
                "Audit documents"
                "Environment info"
                "Show help"
                "Exit REPL"
                "Exit REPL (alias)"
            )
            ;;

        ls|list)
            # Complete with filters and document paths
            if [[ "$current_word" == --* ]]; then
                completions=(--core --other --module --preview --tags)
                descriptions=(
                    "Show only core documents"
                    "Show only other documents"
                    "Filter by module"
                    "Show preview"
                    "Filter by tags"
                )
            elif [[ "$prev_word" == "--module" ]]; then
                # Complete module names
                completions=($(_tdocs_get_modules))
                for _ in "${completions[@]}"; do
                    descriptions+=("Module")
                done
            else
                # Show available documents
                completions=($(_tdocs_get_doc_paths "$current_word"))
                for _ in "${completions[@]}"; do
                    descriptions+=("Document")
                done
            fi
            ;;

        view|v)
            # Complete with document paths
            if [[ "$current_word" == --* ]]; then
                completions=(--pager --meta-only --raw)
                descriptions=(
                    "Use pager"
                    "Show metadata only"
                    "Show raw file"
                )
            else
                completions=($(_tdocs_get_doc_paths "$current_word"))
                for _ in "${completions[@]}"; do
                    descriptions+=("Document")
                done
            fi
            ;;

        filter|f)
            if [[ $word_count -eq 1 || "$cur" =~ [[:space:]]$ ]]; then
                # Show filter types
                completions=(core other module clear reset)
                descriptions=(
                    "Show only core documents"
                    "Show only other documents"
                    "Filter by module"
                    "Clear all filters"
                    "Reset filters (alias)"
                )
            elif [[ $word_count -gt 1 && "${words[1]}" == "module" ]]; then
                # Complete module names
                completions=($(_tdocs_get_modules))
                for _ in "${completions[@]}"; do
                    descriptions+=("Module")
                done
            fi
            ;;

        tag)
            # Complete with document paths
            completions=($(_tdocs_get_doc_paths "$current_word"))
            for _ in "${completions[@]}"; do
                descriptions+=("Document")
            done
            ;;

        init)
            if [[ "$current_word" == --* ]]; then
                completions=(--core --other --type --tags --module)
                descriptions=(
                    "Mark as core document"
                    "Mark as other document"
                    "Set document type"
                    "Add tags"
                    "Set module"
                )
            elif [[ "$prev_word" == "--type" ]]; then
                completions=($(_tdocs_get_types))
                for _ in "${completions[@]}"; do
                    descriptions+=("Document type")
                done
            elif [[ "$prev_word" == "--module" ]]; then
                completions=($(_tdocs_get_modules))
                for _ in "${completions[@]}"; do
                    descriptions+=("Module")
                done
            else
                # File completion (use compgen)
                local files=($(compgen -f -- "$current_word"))
                completions=("${files[@]}")
                for _ in "${completions[@]}"; do
                    descriptions+=("File")
                done
            fi
            ;;

        discover)
            if [[ "$current_word" == --* ]]; then
                completions=(--auto-init --rebuild)
                descriptions=(
                    "Auto-initialize discovered docs"
                    "Rebuild index"
                )
            fi
            ;;

        search|s)
            # No completion for search queries
            ;;

        evidence|e)
            # No completion for evidence queries
            ;;

        env)
            completions=(toggle set)
            descriptions=(
                "Toggle environment"
                "Set environment"
            )
            ;;

        help|h|\?)
            # Complete with command names
            completions=(ls view search filter tag init discover evidence audit env)
            for _ in "${completions[@]}"; do
                descriptions+=("Show help for command")
            done
            ;;

        *)
            # Unknown command - show available commands
            completions=(ls view search filter tag init discover evidence audit env help)
            descriptions=(
                "List documents"
                "View document"
                "Search documents"
                "Set filters"
                "Tag document"
                "Initialize document"
                "Discover documents"
                "Get evidence"
                "Audit documents"
                "Environment info"
                "Show help"
            )
            ;;
    esac

    # Filter completions by current word
    if [[ -n "$current_word" && "$cur" != *" " ]]; then
        local filtered_completions=()
        local filtered_descriptions=()
        local i=0
        for comp in "${completions[@]}"; do
            if [[ "$comp" == "$current_word"* ]]; then
                filtered_completions+=("$comp")
                filtered_descriptions+=("${descriptions[$i]}")
            fi
            ((i++))
        done
        completions=("${filtered_completions[@]}")
        descriptions=("${filtered_descriptions[@]}")
    fi

    # Handle completion display
    if [[ ${#completions[@]} -eq 0 ]]; then
        # No matches
        return
    elif [[ ${#completions[@]} -eq 1 ]]; then
        # Single match - complete it
        if [[ -n "$current_word" && "$cur" != *" " ]]; then
            # Replace current word
            local base="${cur% *}"
            if [[ "$base" == "$cur" ]]; then
                READLINE_LINE="${completions[0]} "
            else
                READLINE_LINE="$base ${completions[0]} "
            fi
        else
            # Append to line
            READLINE_LINE="$cur${completions[0]} "
        fi
        READLINE_POINT=${#READLINE_LINE}
    else
        # Multiple matches - show them with descriptions
        echo ""
        echo "Available options:"
        echo ""

        local i=0
        for comp in "${completions[@]}"; do
            local desc="${descriptions[$i]}"
            printf "  %-20s  %s\n" "$comp" "$desc"
            ((i++))
        done

        echo ""

        # Re-display prompt and current line
        if declare -f _tdocs_repl_build_prompt >/dev/null 2>&1; then
            _tdocs_repl_build_prompt
            echo -n "$REPL_PROMPT$cur"
        else
            echo -n "tdocs> $cur"
        fi
    fi
}

# Hierarchical navigation completion (for tabbing into context state)
# This allows navigating through: category -> module -> document
_tdocs_context_complete() {
    local level="$TDOCS_REPL_CONTEXT_LEVEL"
    local cur="${READLINE_LINE}"

    case "$level" in
        0)
            # Level 0: Select category (core/other/all)
            local categories=($(_tdocs_get_categories))
            echo ""
            echo "Select category:"
            for cat in "${categories[@]}"; do
                echo "  $cat"
            done
            echo ""
            ;;
        1)
            # Level 1: Select module
            local modules=($(_tdocs_get_modules))
            echo ""
            echo "Select module:"
            for mod in "${modules[@]}"; do
                echo "  $mod"
            done
            echo ""
            ;;
        2)
            # Level 2: Select document
            local docs=($(_tdocs_get_doc_paths))
            echo ""
            echo "Select document:"
            for doc in "${docs[@]}"; do
                echo "  $doc"
            done
            echo ""
            ;;
    esac
}

# Enable tab completion in tdocs REPL
tdocs_repl_enable_completion() {
    # Enable programmable completion
    set +o posix 2>/dev/null || true

    # Configure readline settings
    bind 'set completion-ignore-case on' 2>/dev/null || true
    bind 'set show-all-if-ambiguous on' 2>/dev/null || true
    bind 'set completion-query-items 200' 2>/dev/null || true
    bind 'set page-completions off' 2>/dev/null || true

    # Bind TAB to our custom completion function
    bind -x '"\t": _tdocs_repl_complete' 2>/dev/null || true

    # Bind Shift+TAB to navigate up in context (optional)
    # bind -x '"\e[Z": _tdocs_context_up' 2>/dev/null || true
}

# Disable completion
tdocs_repl_disable_completion() {
    # Restore default TAB behavior
    bind -r "\t" 2>/dev/null || true

    # Reset context state
    TDOCS_REPL_CONTEXT_PATH=""
    TDOCS_REPL_CONTEXT_LEVEL=0
}

# Navigate up in context hierarchy (Shift+TAB)
_tdocs_context_up() {
    if [[ $TDOCS_REPL_CONTEXT_LEVEL -gt 0 ]]; then
        ((TDOCS_REPL_CONTEXT_LEVEL--))
        TDOCS_REPL_CONTEXT_PATH="${TDOCS_REPL_CONTEXT_PATH%.*}"
        echo ""
        echo "Context level: $TDOCS_REPL_CONTEXT_LEVEL"
        _tdocs_context_complete
    fi
}

# Navigate down in context hierarchy (on selection)
_tdocs_context_down() {
    local selection="$1"
    ((TDOCS_REPL_CONTEXT_LEVEL++))
    TDOCS_REPL_CONTEXT_PATH="$TDOCS_REPL_CONTEXT_PATH.$selection"
}

# Export functions
export -f _tdocs_get_modules
export -f _tdocs_get_types
export -f _tdocs_get_doc_paths
export -f _tdocs_get_categories
export -f _tdocs_get_tags
export -f _tdocs_repl_complete
export -f _tdocs_context_complete
export -f _tdocs_context_up
export -f _tdocs_context_down
export -f tdocs_repl_enable_completion
export -f tdocs_repl_disable_completion
