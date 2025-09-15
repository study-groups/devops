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
    echo "Welcome to RAG Tools v001!"
    echo "Commands: cursor, mcursor, cat, mcat, help, tutorial, exit"
    echo "Use TAB for completion, '/help' for detailed help"
    echo ""
    
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
            cursor)
                _rag_repl_cursor $args
                ;;
            mcursor)  
                _rag_repl_mcursor $args
                ;;
            cat)
                _rag_repl_cat $args
                ;;
            mcat)
                _rag_repl_mcat $args
                ;;
            help|/help)
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
            exit|quit|/exit|/quit)
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

# REPL command implementations
_rag_repl_cursor() {
    local subcmd="$1"; shift
    local args="$*"
    
    case "$subcmd" in
        create)
            echo "Creating cursor: $args"
            rag_cursor_create $args
            ;;
        list|ls)
            echo "Listing cursors:"
            rag_cursor_list $args
            ;;
        show|display)
            echo "Showing cursor: $args"
            rag_cursor_show $args
            ;;
        delete|rm)
            echo "Deleting cursor: $args"  
            rag_cursor_delete $args
            ;;
        *)
            echo "cursor commands: create, list, show, delete"
            echo "Usage: cursor create <file> <start_line> <end_line>"
            ;;
    esac
}

_rag_repl_mcursor() {
    local subcmd="$1"; shift
    local args="$*"
    
    case "$subcmd" in
        create)
            echo "Creating multicursor: $args"
            rag_mcursor_create $args
            ;;
        list|ls)
            echo "Listing multicursors:"
            rag_mcursor_list $args
            ;;
        show|display)
            echo "Showing multicursor: $args"
            rag_mcursor_show $args
            ;;
        add)
            echo "Adding cursor to multicursor: $args"
            rag_mcursor_add $args
            ;;
        remove|rm)
            echo "Removing from multicursor: $args"
            rag_mcursor_remove $args
            ;;
        *)
            echo "mcursor commands: create, list, show, add, remove"
            echo "Usage: mcursor create <title>"
            echo "       mcursor add <mc_id> <cursor_id>"
            ;;
    esac
}

_rag_repl_cat() {
    local subcmd="$1"; shift
    local args="$*"
    
    if [[ -f "$subcmd" && "$subcmd" =~ \.mc$ ]]; then
        # Direct file view
        echo "Viewing MULTICAT file: $subcmd"
        mcinfo.sh "$subcmd"
    else
        case "$subcmd" in
            blocks)
                echo "Showing blocks: $args"
                rag_cat_blocks $args
                ;;
            info)
                echo "MULTICAT info: $args"
                mcinfo.sh $args
                ;;
            *)
                echo "cat commands: <file.mc>, blocks, info"
                echo "Usage: cat file.mc"
                echo "       cat blocks 1,3,7 file.mc"
                ;;
        esac
    fi
}

_rag_repl_mcat() {
    local subcmd="$1"; shift
    local args="$*"
    
    case "$subcmd" in
        from-cursors)
            echo "Creating MULTICAT from multicursor: $args"
            rag_mcat_from_cursors $args
            ;;
        from-files)
            echo "Creating MULTICAT from files: $args" 
            multicat.sh $args
            ;;
        *)
            # Assume it's a directory or file pattern
            echo "Creating MULTICAT: $subcmd $args"
            multicat.sh "$subcmd" $args
            ;;
    esac
}

_rag_repl_help() {
    local topic="$1"
    
    case "$topic" in
        cursor)
            cat <<EOF
CURSOR Commands:
  cursor create <file> <start_line> <end_line>  - Create new cursor
  cursor list                                   - List all cursors
  cursor show <cursor_id>                       - Show cursor details
  cursor delete <cursor_id>                     - Delete cursor

Examples:
  cursor create auth.js 10 25
  cursor list
  cursor show c_abc123
EOF
            ;;
        mcursor)
            cat <<EOF
MULTICURSOR Commands:
  mcursor create <title>                        - Create multicursor collection
  mcursor list                                  - List all multicursors  
  mcursor show <mc_id>                          - Show multicursor details
  mcursor add <mc_id> <cursor_id>               - Add cursor to collection
  mcursor remove <mc_id> <cursor_id>            - Remove cursor from collection

Examples:
  mcursor create "Authentication Fixes"
  mcursor add mc_def456 c_abc123
EOF
            ;;
        *)
            cat <<EOF
RAG Tools REPL Help:

Core Commands:
  cursor     - Individual cursor operations
  mcursor    - Multicursor collection operations  
  cat        - View MULTICAT files and blocks
  mcat       - Create MULTICAT files

Utilities:
  help <topic>    - Detailed help (cursor, mcursor, cat, mcat)
  tutorial        - Interactive tutorials
  functions       - List all available rag_* functions
  demo            - Show example workflows
  clear           - Clear screen
  exit            - Exit REPL

Use TAB for auto-completion!
EOF
            ;;
    esac
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
            COMPREPLY=($(compgen -W "cursor mcursor cat mcat help tutorial demo exit" -- "$cur"))
            ;;
        cursor)
            COMPREPLY=($(compgen -W "create list show delete" -- "$cur"))
            ;;
        mcursor)
            COMPREPLY=($(compgen -W "create list show add remove" -- "$cur"))
            ;;
        cat)
            COMPREPLY=($(compgen -f -X "!*.mc" -- "$cur"))
            [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=($(compgen -W "blocks info" -- "$cur"))
            ;;
        mcat)
            COMPREPLY=($(compgen -W "from-cursors from-files" -- "$cur"))
            [[ ${#COMPREPLY[@]} -eq 0 ]] && COMPREPLY=($(compgen -d -- "$cur"))
            ;;
    esac
}