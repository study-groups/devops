#!/usr/bin/env bash
# TDOCS REPL Completion - v3 (works with read -e using readline bindings)

# Ensure TDOCS_DIR is set
: "${TDOCS_DIR:=$TETRA_DIR/tdocs}"

# Helper: Get available modules from metadata
_tdocs_complete_get_modules() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.module' {} \; 2>/dev/null | \
            sort -u | \
            grep -v '^null$'
    fi
}

# Helper: Get available document paths
_tdocs_complete_get_docs() {
    if [[ -d "$TDOCS_DIR/db" ]]; then
        find "$TDOCS_DIR/db" -name "*.meta" -type f \
            -exec jq -r '.path' {} \; 2>/dev/null | \
            grep -v '^null$' | \
            xargs -n1 basename 2>/dev/null
    fi
}

# Helper: Get available document types
_tdocs_complete_get_types() {
    echo "spec guide reference bug-fix refactor plan summary investigation"
}

# This function is called by bind -x when TAB is pressed during read -e
_tdocs_repl_tab_complete() {
    local line="$READLINE_LINE"
    local point="$READLINE_POINT"

    # Parse the line into words
    local words=($line)
    local word_count=${#words[@]}

    # Get current word being completed
    local current_word=""
    local prev_word=""

    if [[ "$line" =~ [[:space:]]$ ]] || [[ $word_count -eq 0 ]]; then
        # Line ends with space or is empty - complete next word
        current_word=""
        if [[ $word_count -gt 0 ]]; then
            prev_word="${words[$((word_count-1))]}"
        fi
    else
        # Line doesn't end with space - complete current word
        if [[ $word_count -gt 0 ]]; then
            current_word="${words[$((word_count-1))]}"
            if [[ $word_count -gt 1 ]]; then
                prev_word="${words[$((word_count-2))]}"
            fi
        fi
    fi

    # Get command (first word)
    local cmd=""
    if [[ $word_count -gt 0 ]]; then
        cmd="${words[0]}"
    fi

    local completions=()

    # Determine completions based on context
    if [[ $word_count -eq 0 ]] || [[ -z "$cmd" && "$current_word" != -* ]]; then
        # Start of line - show all commands
        completions=(ls list view search filter tag init discover evidence audit env help exit quit)

        # Add registered slash commands
        if [[ -v REPL_SLASH_HANDLERS ]]; then
            for key in "${!REPL_SLASH_HANDLERS[@]}"; do
                # Avoid duplicates
                local found=0
                for comp in "${completions[@]}"; do
                    [[ "$comp" == "$key" ]] && found=1 && break
                done
                [[ $found -eq 0 ]] && completions+=("$key")
            done
        fi
    else
        case "$cmd" in
            ls|list)
                if [[ "$current_word" == --* ]]; then
                    completions=(--core --other --module --preview --tags)
                elif [[ "$prev_word" == "--module" ]]; then
                    completions=($(_tdocs_complete_get_modules))
                else
                    completions=($(_tdocs_complete_get_docs))
                fi
                ;;

            view|v)
                if [[ "$current_word" == --* ]]; then
                    completions=(--pager --meta-only --raw)
                else
                    completions=($(_tdocs_complete_get_docs))
                fi
                ;;

            filter|f)
                if [[ $word_count -eq 1 ]]; then
                    completions=(core other module clear reset)
                elif [[ "$prev_word" == "module" || ("${words[1]}" == "module" && $word_count -eq 2) ]]; then
                    completions=($(_tdocs_complete_get_modules))
                fi
                ;;

            tag)
                completions=($(_tdocs_complete_get_docs))
                ;;

            init)
                if [[ "$current_word" == --* ]]; then
                    completions=(--core --other --type --tags --module)
                elif [[ "$prev_word" == "--type" ]]; then
                    completions=($(_tdocs_complete_get_types))
                elif [[ "$prev_word" == "--module" ]]; then
                    completions=($(_tdocs_complete_get_modules))
                else
                    # For files, let bash do default completion
                    return
                fi
                ;;

            discover)
                if [[ "$current_word" == --* ]]; then
                    completions=(--auto-init --rebuild)
                fi
                ;;

            env)
                completions=(toggle set)
                ;;

            help|h|\?)
                completions=(ls view search filter tag init discover evidence audit env)
                if [[ -v REPL_SLASH_HANDLERS ]]; then
                    for key in "${!REPL_SLASH_HANDLERS[@]}"; do
                        completions+=("$key")
                    done
                fi
                ;;
        esac
    fi

    # Filter completions by current word
    local matches=()
    for comp in "${completions[@]}"; do
        if [[ -z "$current_word" ]] || [[ "$comp" == "$current_word"* ]]; then
            matches+=("$comp")
        fi
    done

    # Handle completion results
    if [[ ${#matches[@]} -eq 0 ]]; then
        # No matches - do nothing (or could beep)
        return
    elif [[ ${#matches[@]} -eq 1 ]]; then
        # Single match - complete it
        if [[ -n "$current_word" && ! "$line" =~ [[:space:]]$ ]]; then
            # Replace current word
            local prefix="${line% *}"
            if [[ "$prefix" == "$line" ]]; then
                # Only one word
                READLINE_LINE="${matches[0]} "
            else
                # Multiple words
                READLINE_LINE="$prefix ${matches[0]} "
            fi
        else
            # Append to line
            READLINE_LINE="${line}${matches[0]} "
        fi
        READLINE_POINT=${#READLINE_LINE}
    else
        # Multiple matches - show them
        echo ""
        echo "Options:"
        for match in "${matches[@]}"; do
            echo "  $match"
        done
        echo ""

        # Find common prefix
        local common="${matches[0]}"
        for match in "${matches[@]}"; do
            while [[ "${match:0:${#common}}" != "$common" ]]; do
                common="${common:0:$((${#common}-1))}"
            done
        done

        # If there's a common prefix longer than current word, complete to it
        if [[ -n "$common" && ${#common} -gt ${#current_word} ]]; then
            if [[ -n "$current_word" && ! "$line" =~ [[:space:]]$ ]]; then
                local prefix="${line% *}"
                if [[ "$prefix" == "$line" ]]; then
                    READLINE_LINE="$common"
                else
                    READLINE_LINE="$prefix $common"
                fi
            else
                READLINE_LINE="${line}$common"
            fi
            READLINE_POINT=${#READLINE_LINE}
        fi

        # Re-display prompt and line
        local prompt="${REPL_PROMPT:-> }"
        echo -n "$prompt$READLINE_LINE"
    fi
}

# Enable completion for REPL (uses bind -x for read -e)
tdocs_repl_enable_completion() {
    # Bind TAB to our completion function
    # This works with read -e because bind affects the readline instance
    bind -x '"\t": _tdocs_repl_tab_complete' 2>/dev/null || true

    # Configure readline for better UX
    bind 'set completion-ignore-case on' 2>/dev/null || true
    bind 'set show-all-if-ambiguous on' 2>/dev/null || true
    bind 'set colored-completion-prefix on' 2>/dev/null || true

    # Don't use default file completion
    bind 'set skip-completed-text on' 2>/dev/null || true
}

# Disable completion
tdocs_repl_disable_completion() {
    # Remove TAB binding
    bind -r '\t' 2>/dev/null || true
}

# Export functions
export -f _tdocs_complete_get_modules
export -f _tdocs_complete_get_docs
export -f _tdocs_complete_get_types
export -f _tdocs_repl_tab_complete
export -f tdocs_repl_enable_completion
export -f tdocs_repl_disable_completion
