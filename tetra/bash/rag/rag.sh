#!/usr/bin/env bash

# RAG Module - Main entry point for RAG tools
# This file is loaded by tmod when you run "tmod load rag"

# RAG Module Environment Variables with proper override guards
: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${RAG_DIR:=$TETRA_DIR/rag}"

# RAG Directory Convention under TETRA_DIR (TCS 3.0 + TTM)
RAG_DB_DIR="${RAG_DIR}/db"
RAG_CONFIG_DIR="${RAG_DIR}/config"
RAG_LOGS_DIR="${RAG_DIR}/logs"
RAG_TXNS_DIR="${RAG_DIR}/txns"  # TTM transactions

# RAG Module Management
RAG_MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# RAG modules to source (REPL modules loaded on-demand via 'rag repl')
RAG_MODULES=(
    "$RAG_MODULE_DIR/bash/rag_selector.sh"
    "$RAG_MODULE_DIR/bash/aliases.sh"
    "$RAG_MODULE_DIR/bash/rag_tools.sh"
    "$RAG_MODULE_DIR/rag_extensions.sh"
)

# Source RAG modules
rag_source_modules() {
    local verbose="${1:-false}"
    local failed_modules=()

    for module in "${RAG_MODULES[@]}"; do
        if [[ -f "$module" ]]; then
            # Source in a protected context to prevent exit from killing terminal
            if source "$module" 2>/dev/null; then
                [[ "$verbose" == "true" ]] && echo "✓ Sourced: $(basename "$module")"
            else
                local exit_code=$?
                echo "⚠ Failed to source: $(basename "$module") (exit code: $exit_code)" >&2
                failed_modules+=("$(basename "$module")")
            fi
        else
            echo "⚠ Module not found: $(basename "$module")" >&2
            failed_modules+=("$(basename "$module")")
        fi
    done

    # Return success even if some modules failed to prevent terminal crash
    # The failed modules will be reported to stderr
    if [[ ${#failed_modules[@]} -gt 0 ]]; then
        echo "⚠ RAG module loaded with ${#failed_modules[@]} warning(s)" >&2
    fi
    return 0
}

# Initialize RAG environment
rag_init() {
    # Validate TETRA_DIR first
    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ Error: TETRA_DIR environment variable not set" >&2
        return 1
    fi

    # Create necessary directories
    mkdir -p "$RAG_DB_DIR" "$RAG_CONFIG_DIR" "$RAG_LOGS_DIR" "$RAG_TXNS_DIR"

    # Source modules
    rag_source_modules
}

# Main rag command interface
rag() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: rag <command> [args]

Flow Commands:
  flow start "<desc>"   Create new flow
  flow status           Show current flow status
  flow resume [id]      Resume flow from checkpoint
  flow list             List all flows

Context Commands:
  select "<query>"      Select evidence using ULM
  assemble              Assemble context to prompt.mdctx
  plan                  Preview assembly plan
  submit @qa            Submit to QA agent

Legacy Commands:
  repl                  Start interactive RAG REPL
  mc <files...>         Create MULTICAT from files/directories
  ms <file.mc>          Split MULTICAT back to files
  mi <file.mc>          Show MULTICAT file info
  status                Show RAG system status
  help                  Show help
  init                  Initialize RAG system

Examples:
  rag flow start "fix auth timeout"
  rag select "authentication error"
  rag assemble
  rag submit @qa
EOF
        return 0
    fi

    # Initialize if not already done
    rag_init

    shift || true

    case "$action" in
        "flow")
            local subcommand="${1:-status}"
            shift || true

            # Source flow manager (TTM)
            source "$RAG_SRC/core/flow_manager_ttm.sh"

            case "$subcommand" in
                "start")
                    flow_create "$@"
                    ;;
                "status")
                    flow_status "$@"
                    ;;
                "resume")
                    flow_resume "$@"
                    ;;
                "list")
                    flow_list "$@"
                    ;;
                *)
                    echo "Unknown flow subcommand: $subcommand"
                    echo "Available: start, status, resume, list"
                    return 1
                    ;;
            esac
            ;;
        "select")
            source "$RAG_SRC/core/evidence_selector.sh"
            source "$RAG_SRC/core/flow_manager_ttm.sh"
            select_evidence "$@"
            ;;
        "evidence")
            local subcmd="${1:-}"
            shift || true

            source "$RAG_SRC/core/evidence_selector.sh"
            source "$RAG_SRC/core/flow_manager_ttm.sh"

            case "$subcmd" in
                "add")
                    evidence_add "$@"
                    ;;
                "list")
                    local flow_dir="$(get_active_flow_dir)"
                    if [[ -n "$flow_dir" ]] && [[ -d "$flow_dir/ctx/evidence" ]]; then
                        echo "Evidence files:"
                        ls -1 "$flow_dir/ctx/evidence"
                    else
                        echo "No active flow or no evidence files"
                    fi
                    ;;
                *)
                    echo "Usage: rag evidence <add|list> [args]"
                    echo ""
                    echo "  add <selector>   Add evidence file with selector"
                    echo "  list             List evidence files in active flow"
                    echo ""
                    echo "Selector format:"
                    echo "  file                  Whole file"
                    echo "  file::100,200         Lines 100-200"
                    echo "  file::100             From line 100 to EOF"
                    echo "  file::100c,500c       Bytes 100-500"
                    echo "  file#tag1,tag2        With tags"
                    return 1
                    ;;
            esac
            ;;
        "assemble")
            source "$RAG_SRC/core/assembler.sh"
            source "$RAG_SRC/core/flow_manager_ttm.sh"
            assemble_ctx "$@"
            ;;
        "plan")
            source "$RAG_SRC/core/assembler.sh"
            source "$RAG_SRC/core/flow_manager_ttm.sh"
            plan_ctx "$@"
            ;;
        "submit")
            local target="${1:-}"
            if [[ "$target" != "@qa" ]]; then
                echo "Error: Only @qa target supported currently" >&2
                echo "Usage: rag submit @qa" >&2
                return 1
            fi
            source "$RAG_SRC/core/qa_submit.sh"
            source "$RAG_SRC/core/flow_manager_ttm.sh"
            submit_to_qa
            ;;
        "repl"|"r")
            # Source bash/repl system
            if [[ -f "$TETRA_SRC/bash/repl/repl.sh" ]]; then
                source "$TETRA_SRC/bash/repl/repl.sh"
                source "$RAG_SRC/bash/rag_prompts.sh"
                source "$RAG_SRC/bash/rag_commands.sh"

                # Register RAG prompts and commands
                rag_register_prompts
                rag_register_commands

                # Initialize evidence variables if there's an active flow
                source "$RAG_SRC/core/flow_manager_ttm.sh"
                source "$RAG_SRC/core/evidence_manager.sh"
                local active_flow=$(flow_active 2>/dev/null)
                if [[ -n "$active_flow" ]]; then
                    flow_init_evidence_vars "$active_flow" 2>/dev/null
                fi

                # Set history file
                export REPL_HISTORY_BASE="$RAG_DIR/.rag_history"

                # Start REPL in enhanced mode
                repl_run enhanced
            else
                echo "Error: bash/repl not found at $TETRA_SRC/bash/repl/" >&2
                echo "Falling back to legacy REPL..." >&2
                # Fallback to old rag_repl if available
                if command -v rag_repl >/dev/null 2>&1; then
                    rag_repl
                else
                    echo "Error: No REPL available" >&2
                    return 1
                fi
            fi
            ;;
        "example"|"ex")
            mc --example
            ;;
        "mc")
            mc "$@"
            ;;
        "ms")
            ms "$@"
            ;;
        "mi")
            mi "$@"
            ;;
        "status"|"s")
            rag_status
            ;;
        "help"|"h")
            rag_help
            ;;
        "init")
            rag_init
            echo "RAG system initialized"
            ;;
        *)
            echo "Unknown command: $action"
            echo "Use 'rag help' for available commands"
            return 1
            ;;
    esac
}

# Helper functions
rag_status() {
    _tetra_status_header "RAG Tools"

    # Only show environment issues if they exist
    _tetra_status_validate_env "TETRA_DIR" "RAG_DIR" "RAG_SRC"

    # Tools status (compact, one line)
    local tools_status=""
    local rag_tools=(mc ms mi mf qpatch replace)
    for tool in "${rag_tools[@]}"; do
        if command -v "$tool" >/dev/null 2>&1; then
            tools_status+="✓$tool "
        else
            tools_status+="○$tool "
        fi
    done
    echo "Tools: $tools_status"

    # Directory status (compact)
    if [[ -n "$RAG_DIR" ]]; then
        if [[ -d "$RAG_DIR" ]]; then
            local dirs_status=""
            for subdir in db config logs index chunks contexts; do
                if [[ -d "$RAG_DIR/$subdir" ]]; then
                    dirs_status+="✓$subdir "
                else
                    dirs_status+="○$subdir "
                fi
            done
            echo "Dirs:  $dirs_status"

            # Show file counts if directory has content
            local total_files=$(find "$RAG_DIR" -type f 2>/dev/null | wc -l | tr -d ' ')
            if [[ $total_files -gt 0 ]]; then
                echo "Files: $total_files total"
            fi
        else
            echo "RAG directory missing: $(_tetra_format_path "$RAG_DIR")"
        fi
    fi
}

rag_help() {
    echo "🔧 RAG Tools Help:"
    echo ""
    echo "Core Commands:"
    echo "  rag repl             Start interactive REPL with all tools"
    echo "  rag example          Generate sample MULTICAT format"
    echo ""
    echo "MULTICAT Tools:"
    echo "  rag mc <files>       Create MULTICAT from files/directories"
    echo "  rag ms <file.mc>     Split MULTICAT back to individual files"
    echo "  rag mi <file.mc>     Show info about MULTICAT file"
    echo ""
    echo "System:"
    echo "  rag status           Show system status and available tools"
    echo "  rag init             Initialize RAG directories"
    echo ""
    echo "Interactive Mode:"
    echo "  All commands available without 'rag' prefix in REPL"
    echo "  Example: 'mc --example' instead of 'rag mc --example'"
}

# Source modules immediately when this file is loaded (protected to prevent terminal crash)
rag_source_modules || true

# Export essential module variables
export RAG_SRC RAG_DIR