#!/usr/bin/env bash

# RAG Module - Main entry point for RAG tools
# This file is loaded by tmod when you run "tmod load rag"

# RAG Module Environment Variables with proper override guards
: "${RAG_SRC:=$TETRA_SRC/bash/rag}"
: "${RAG_DIR:=$TETRA_DIR/rag}"

# RAG Directory Convention under TETRA_DIR
RAG_DB_DIR="${RAG_DIR}/db"
RAG_CONFIG_DIR="${RAG_DIR}/config"
RAG_LOGS_DIR="${RAG_DIR}/logs"

# RAG Module Management
RAG_MODULE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# RAG modules to source
RAG_MODULES=(
    "$RAG_MODULE_DIR/bash/rag_cursor.sh"
    "$RAG_MODULE_DIR/bash/rag_mcursor.sh"
    "$RAG_MODULE_DIR/bash/rag_repl.sh"
    "$RAG_MODULE_DIR/bash/aliases.sh"
    "$RAG_MODULE_DIR/rag_extensions.sh"
)

# Source RAG modules
rag_source_modules() {
    local verbose="${1:-false}"

    for module in "${RAG_MODULES[@]}"; do
        if [[ -f "$module" ]]; then
            source "$module"
            [[ "$verbose" == "true" ]] && echo "✓ Sourced: $(basename "$module")"
        else
            echo "⚠ Module not found: $(basename "$module")" >&2
        fi
    done
}

# Initialize RAG environment
rag_init() {
    # Validate TETRA_DIR first
    if [[ -z "$TETRA_DIR" ]]; then
        echo "❌ Error: TETRA_DIR environment variable not set" >&2
        return 1
    fi

    # Create necessary directories
    mkdir -p "$RAG_DB_DIR" "$RAG_CONFIG_DIR" "$RAG_LOGS_DIR"

    # Source modules
    rag_source_modules
}

# Main rag command interface
rag() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: rag <command> [args]

Commands:
  repl                  Start interactive RAG REPL
  example               Generate example MULTICAT with 2 sample files
  mc <files...>         Create MULTICAT from files/directories
  ms <file.mc>          Split MULTICAT back to files
  mi <file.mc>          Show MULTICAT file info
  status                Show RAG system status
  help                  Show help
  init                  Initialize RAG system

Examples:
  rag repl              Start interactive mode
  rag example           See MULTICAT format example
  rag mc -r src/        Create MULTICAT from src directory
  rag ms output.mc      Extract files from MULTICAT
  rag mi code.mc        Show what's in a MULTICAT file
EOF
        return 0
    fi

    # Initialize if not already done
    rag_init

    shift || true

    case "$action" in
        "repl"|"r")
            rag_repl
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

# Source modules immediately when this file is loaded
rag_source_modules

# Export essential module variables
export RAG_SRC RAG_DIR