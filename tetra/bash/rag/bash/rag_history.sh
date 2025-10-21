#!/usr/bin/env bash
# RAG History Manager - Separate history that doesn't corrupt shell history
# Inspired by doctl and other CLI tools with isolated REPLs

: "${TETRA_DIR:=$HOME/.tetra}"
: "${RAG_HISTORY_FILE:=$TETRA_DIR/rag/history}"
: "${RAG_HISTORY_SIZE:=1000}"

# History state
RAG_HISTORY_POS=0
RAG_HISTORY_BUFFER=""

# Initialize history file
rag_history_init() {
    local history_dir=$(dirname "$RAG_HISTORY_FILE")
    [[ ! -d "$history_dir" ]] && mkdir -p "$history_dir"
    [[ ! -f "$RAG_HISTORY_FILE" ]] && touch "$RAG_HISTORY_FILE"

    # Don't disable bash history - we use separate REPL history tracking instead
}

# Save command to REPL history only (not shell history)
rag_history_add() {
    local cmd="$1"

    # Skip empty commands
    [[ -z "$cmd" ]] && return 0

    # Skip duplicate of last command
    local last_cmd
    last_cmd=$(tail -1 "$RAG_HISTORY_FILE" 2>/dev/null)
    [[ "$cmd" == "$last_cmd" ]] && return 0

    # Append to history file
    echo "$cmd" >> "$RAG_HISTORY_FILE"

    # Trim history to max size
    local line_count
    line_count=$(wc -l < "$RAG_HISTORY_FILE" 2>/dev/null || echo 0)
    if [[ $line_count -gt $RAG_HISTORY_SIZE ]]; then
        local temp_file
        temp_file=$(mktemp)
        tail -n "$RAG_HISTORY_SIZE" "$RAG_HISTORY_FILE" > "$temp_file"
        mv "$temp_file" "$RAG_HISTORY_FILE"
    fi

    # Reset position to end
    RAG_HISTORY_POS=0
}

# Get history entry by offset (0 = most recent, 1 = one back, etc.)
rag_history_get() {
    local offset="$1"
    tail -n $((offset + 1)) "$RAG_HISTORY_FILE" 2>/dev/null | head -1
}

# Navigate up in history (older commands)
rag_history_up() {
    local total_lines
    total_lines=$(wc -l < "$RAG_HISTORY_FILE" 2>/dev/null || echo 0)

    if [[ $total_lines -eq 0 ]]; then
        echo ""
        return
    fi

    # Increment position (go back in time)
    if [[ $RAG_HISTORY_POS -lt $total_lines ]]; then
        ((RAG_HISTORY_POS++))
    fi

    # Get command at position
    rag_history_get $RAG_HISTORY_POS
}

# Navigate down in history (newer commands)
rag_history_down() {
    # Decrement position (go forward in time)
    if [[ $RAG_HISTORY_POS -gt 0 ]]; then
        ((RAG_HISTORY_POS--))
    fi

    if [[ $RAG_HISTORY_POS -eq 0 ]]; then
        # Return to current buffer
        echo "$RAG_HISTORY_BUFFER"
    else
        # Get command at position
        rag_history_get $RAG_HISTORY_POS
    fi
}

# Search history (for Ctrl+R functionality)
rag_history_search() {
    local pattern="$1"

    if [[ -z "$pattern" ]]; then
        cat "$RAG_HISTORY_FILE" 2>/dev/null
        return
    fi

    grep -F "$pattern" "$RAG_HISTORY_FILE" 2>/dev/null | tail -20
}

# Get last N history entries
rag_history_list() {
    local count="${1:-20}"
    tail -n "$count" "$RAG_HISTORY_FILE" 2>/dev/null | nl -v 1
}

# Clear history
rag_history_clear() {
    > "$RAG_HISTORY_FILE"
    RAG_HISTORY_POS=0
    echo "RAG history cleared"
}

# Export history for backup
rag_history_export() {
    local output_file="${1:-}"

    if [[ -n "$output_file" ]]; then
        cp "$RAG_HISTORY_FILE" "$output_file"
        echo "History exported to $output_file"
    else
        cat "$RAG_HISTORY_FILE"
    fi
}

# Import history from backup
rag_history_import() {
    local input_file="$1"

    if [[ ! -f "$input_file" ]]; then
        echo "Error: File not found: $input_file" >&2
        return 1
    fi

    # Backup current history
    if [[ -f "$RAG_HISTORY_FILE" ]] && [[ -s "$RAG_HISTORY_FILE" ]]; then
        local backup_file="$RAG_HISTORY_FILE.backup.$(date +%Y%m%d_%H%M%S)"
        cp "$RAG_HISTORY_FILE" "$backup_file"
        echo "Current history backed up to $backup_file"
    fi

    # Import new history
    cat "$input_file" >> "$RAG_HISTORY_FILE"

    # Trim to max size
    local temp_file
    temp_file=$(mktemp)
    tail -n "$RAG_HISTORY_SIZE" "$RAG_HISTORY_FILE" > "$temp_file"
    mv "$temp_file" "$RAG_HISTORY_FILE"

    echo "History imported from $input_file"
}

# Cleanup on exit (no longer needed since we don't disable history)
rag_history_cleanup() {
    # No-op - we don't modify bash history state anymore
    :
}

# Stats about history usage
rag_history_stats() {
    local total_lines
    total_lines=$(wc -l < "$RAG_HISTORY_FILE" 2>/dev/null || echo 0)

    echo "RAG History Statistics"
    echo "======================"
    echo "Location: $RAG_HISTORY_FILE"
    echo "Total commands: $total_lines"
    echo "Max size: $RAG_HISTORY_SIZE"

    if [[ $total_lines -gt 0 ]]; then
        echo ""
        echo "Top 10 commands:"
        awk '{print $1}' "$RAG_HISTORY_FILE" | sort | uniq -c | sort -rn | head -10 | \
        while read count cmd; do
            printf "  %4d  %s\n" "$count" "$cmd"
        done
    fi
}

# CLI interface if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "${1:-}" in
        init)
            rag_history_init
            echo "History initialized"
            ;;
        add)
            rag_history_add "$2"
            ;;
        list)
            rag_history_list "${2:-20}"
            ;;
        search)
            rag_history_search "$2"
            ;;
        clear)
            rag_history_clear
            ;;
        export)
            rag_history_export "$2"
            ;;
        import)
            rag_history_import "$2"
            ;;
        stats)
            rag_history_stats
            ;;
        *)
            echo "Usage: rag_history.sh {init|add|list|search|clear|export|import|stats}"
            echo ""
            echo "Commands:"
            echo "  init              Initialize history file"
            echo "  add <cmd>         Add command to history"
            echo "  list [n]          List last N commands (default: 20)"
            echo "  search <pattern>  Search history for pattern"
            echo "  clear             Clear all history"
            echo "  export [file]     Export history to file"
            echo "  import <file>     Import history from file"
            echo "  stats             Show history statistics"
            exit 1
            ;;
    esac
fi
