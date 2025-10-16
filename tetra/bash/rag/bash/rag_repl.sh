#!/usr/bin/env bash
# RAG REPL - Interactive educational interface for RAG tools
# ABSOLUTELY NO AUTO-START ALLOWED

# Debugging function
rag_debug() {
    local message="$1"
    echo "[RAG REPL DEBUG] $message" >&2
}

# Capture call stack for debugging
rag_trace_call_stack() {
    rag_debug "Call stack:"
    local frame=0
    while caller $frame; do
        ((frame++))
    done
}

rag_repl() {
    echo "🔧 Welcome to RAG Tools Interactive REPL!"
    echo "Commands: mc, ms, mi, mf, qpatch, replace, example, help, status, exit"
    echo "Use TAB for completion, 'help' for detailed help"
    echo ""

    # Initialize RAG environment
    [[ ! -d "$RAG_DIR" ]] && mkdir -p "$RAG_DIR"

    local input cmd args
    while true; do
        read -e -p "rag> " input

        # Handle empty input
        [[ -z "$input" ]] && continue

        # Add to history
        history -s "$input"

        # Parse command and arguments
        read -r cmd args <<< "$input"

        case "$cmd" in
            # Core porcelain functions
            mc)
                _rag_repl_mc $args
                ;;
            ms)
                _rag_repl_ms $args
                ;;
            mi)
                _rag_repl_mi $args
                ;;
            mf)
                _rag_repl_mf $args
                ;;
            qpatch)
                _rag_repl_qpatch $args
                ;;
            replace)
                _rag_repl_replace $args
                ;;
            example)
                _rag_repl_example $args
                ;;
            # System commands
            status)
                _rag_repl_status
                ;;
            pwd)
                pwd
                ;;
            ls)
                ls $args
                ;;
            help|/help|h)
                _rag_repl_help $args
                ;;
            tutorial|/tutorial)
                _rag_repl_tutorial $args
                ;;
            functions|/functions)
                _rag_repl_functions
                ;;
            clear)
                clear
                ;;
            exit|quit|/exit|/quit|q)
                echo "Exiting RAG REPL. Happy coding!"
                break
                ;;
            *)
                echo "Unknown command: $cmd"
                echo "Try 'help' for available commands"
                ;;
        esac
    done
}

# New porcelain command implementations for REPL
_rag_repl_mc() {
    echo "Creating MULTICAT: $*"
    mc "$@"
}

_rag_repl_ms() {
    echo "Splitting MULTICAT: $*"
    ms "$@"
}

_rag_repl_mi() {
    echo "MULTICAT info: $*"
    mi "$@"
}

_rag_repl_mf() {
    echo "Finding files: $*"
    mf "$@"
}

_rag_repl_qpatch() {
    echo "Applying patch: $*"
    qpatch "$@"
}

_rag_repl_replace() {
    echo "Replacing content: $*"
    replace "$@"
}

_rag_repl_example() {
    echo "📄 Generating MULTICAT example with 2 files..."
    mc --example
}

_rag_repl_status() {
    echo "RAG Tools Status:"
    echo "================="
    echo "RAG_DIR: ${RAG_DIR:-<not set>}"
    echo "RAG_SRC: ${RAG_SRC:-<not set>}"
    echo ""
    echo "Available tools:"
    for tool in mc ms mi mf qpatch replace; do
        if command -v "$tool" >/dev/null 2>&1; then
            echo "  ✓ $tool"
        else
            echo "  ✗ $tool"
        fi
    done
    echo ""
    echo "Storage directories:"
    [[ -d "$RAG_DIR" ]] && echo "  ✓ $RAG_DIR" || echo "  ✗ $RAG_DIR (missing)"
}

_rag_repl_help() {
    local topic="$1"

    cat <<EOF
🔧 RAG Tools REPL Help:

Core Commands:
  mc <files...>        - Create MULTICAT from files/directories
  ms <file.mc>         - Split MULTICAT back to files
  mi <file.mc>         - Show MULTICAT file info
  mf <pattern> <dir>   - Find files with ranking
  qpatch <patch>       - Apply patches intelligently
  replace <old> <new>  - Replace content in files
  example              - Generate example MULTICAT with 2 sample files

System Commands:
  status               - Show RAG system status
  pwd                  - Show current directory
  ls <args>            - List files
  clear                - Clear screen
  exit, quit, q        - Exit REPL
  functions            - List all available rag_* functions

Examples:
  example              - Generate sample MULTICAT to learn the format
  mc -r src/           - Create MULTICAT from src directory
  ms output.mc         - Extract files from MULTICAT
  mi code.mc           - Show what's in a MULTICAT file
  mf "*.js" ./src      - Find JavaScript files
  qpatch --dry-run fix.patch  - Test patch application

Use TAB for auto-completion!
EOF
}

_rag_repl_tutorial() {
    echo "Tutorials are manual. Use specific commands."
}

_rag_repl_demo() {
    echo "Demo workflows are manual. Use individual commands."
}

_rag_repl_functions() {
    echo "Available rag_* functions:"
    declare -F | grep "rag_" | sed 's/declare -f /  /' | sort
}

# Enable REPL completion for main commands
_rag_repl_complete() {
    local cur="${COMP_WORDS[COMP_CWORD]}"
    local prev="${COMP_WORDS[COMP_CWORD-1]}"

    case "$prev" in
        "rag>")
            COMPREPLY=($(compgen -W "mc ms mi mf qpatch replace example status pwd ls help functions clear exit quit q" -- "$cur"))
            ;;
        mc)
            COMPREPLY=($(compgen -f -- "$cur"))
            [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=($(compgen -d -- "$cur"))
            ;;
        ms|mi)
            COMPREPLY=($(compgen -f -X "!*.mc" -- "$cur"))
            ;;
        ls)
            COMPREPLY=($(compgen -f -- "$cur"))
            ;;
    esac
}