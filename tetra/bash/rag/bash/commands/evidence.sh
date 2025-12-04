#!/usr/bin/env bash
# commands/evidence.sh - Evidence command handlers

: "${RAG_SRC:=$TETRA_SRC/bash/rag}"

# Evidence command handler
rag_cmd_evidence() {
    # Lazy load evidence manager
    rag_require_evidence_manager

    local subcmd="$1"
    shift || true

    # Check if subcmd is a number - view evidence
    if [[ "$subcmd" =~ ^[0-9]+$ ]]; then
        # Viewing evidence by number
        local evidence_nums=("$subcmd" "$@")

        # Load TDS for rendering
        if [[ -f "$TETRA_SRC/bash/tds/tds.sh" ]]; then
            source "$TETRA_SRC/bash/tds/tds.sh"
        else
            echo "Error: TDS not available for rendering" >&2
            echo "Fallback to cat..." >&2
        fi

        for num in "${evidence_nums[@]}"; do
            # Get evidence variable (e.g., $e1, $e2)
            local var_name="e${num}"
            local evidence_file="${!var_name}"

            if [[ -z "$evidence_file" ]]; then
                echo "Error: No evidence at index $num" >&2
                echo "Use /e list to see available evidence" >&2
                continue
            fi

            if [[ ! -f "$evidence_file" ]]; then
                echo "Error: Evidence file not found: $evidence_file" >&2
                continue
            fi

            # Render with TDS if available, otherwise cat
            if command -v tds_markdown >/dev/null 2>&1; then
                # Use pager for files > 50 lines
                local line_count=$(wc -l < "$evidence_file" | tr -d ' ')
                if [[ $line_count -gt 50 ]]; then
                    tds_markdown --pager "$evidence_file"
                else
                    tds_markdown "$evidence_file"
                fi
            else
                cat "$evidence_file"
            fi

            # Add separator if viewing multiple files
            if [[ ${#evidence_nums[@]} -gt 1 ]]; then
                echo ""
                echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                echo ""
            fi
        done
        return 0
    fi

    case "$subcmd" in
        add)
            if command -v evidence_add >/dev/null 2>&1; then
                evidence_add "$@"
                # Refresh evidence variables
                flow_init_evidence_vars
            else
                echo "Error: evidence_add not available" >&2
            fi
            ;;
        list|ls|"")
            if command -v evidence_list >/dev/null 2>&1; then
                evidence_list
            else
                echo "Error: evidence_list not available" >&2
            fi
            ;;
        toggle)
            if command -v evidence_toggle >/dev/null 2>&1; then
                evidence_toggle "$@"
                # Refresh evidence variables
                flow_init_evidence_vars
            else
                echo "Error: evidence_toggle not available" >&2
            fi
            ;;
        status)
            if command -v evidence_status >/dev/null 2>&1; then
                evidence_status "$@"
            else
                echo "Error: evidence_status not available" >&2
            fi
            ;;
        *)
            echo "Usage: /evidence {add|list|toggle|status|<number>}"
            echo ""
            echo "  add <selector>   Add evidence file"
            echo "  list             List evidence files"
            echo "  toggle <id>      Toggle evidence on/off"
            echo "  status           Show evidence status"
            echo "  <number>         View evidence (e.g., /e 1 or /e 1 2 3)"
            ;;
    esac
}

# Select command handler
rag_cmd_select() {
    # Lazy load evidence selector
    rag_require_evidence_selector

    local query="$*"

    if [[ -z "$query" ]]; then
        echo "Usage: /select <query>"
        echo "Example: /select authentication error"
        return 1
    fi

    if command -v select_evidence >/dev/null 2>&1; then
        select_evidence "$query"
        # Refresh evidence variables
        flow_init_evidence_vars
    else
        echo "Error: select_evidence not available" >&2
    fi
}

export -f rag_cmd_evidence
export -f rag_cmd_select
