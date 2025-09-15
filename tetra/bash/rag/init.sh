#!/usr/bin/env bash
# RAG Tools Bootstrap - Following TETRA pattern
# Usage: source init.sh

# Follow TETRA convention: RAG_DIR=$TETRA_DIR/rag
if [ -n "$TETRA_DIR" ]; then
    RAG_DIR="$TETRA_DIR/rag"
elif [ -z "$RAG_DIR" ]; then
    RAG_DIR="${1:-$HOME/.rag}"
fi

[ -z "$RAG_SRC" ] && RAG_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Create storage directory if it doesn't exist
[[ ! -d "$RAG_DIR" ]] && mkdir -p "$RAG_DIR"

# Define the list of directories to search for scripts
DIRS=(
    "$RAG_SRC/bash"
    "$RAG_SRC/qa"
)

# Source .sh files from each directory, excluding bootstrap.sh and init.sh
for dir in "${DIRS[@]}"; do
  [ -d "$dir" ] || { echo "Directory $dir does not exist"; continue; }
  for f in "$dir"/*.sh; do
    [ -f "$f" ] || { echo "No .sh files in $dir"; continue; }
    [[ "$f" == *bootstrap.sh ]] && { continue; }
    [[ "$f" == *init.sh ]] && { continue; }
    [[ "$f" == *demo.sh ]] && { continue; }
    [[ "$f" == *test*.sh ]] && { continue; }
    [[ "$f" == *fzfgrep.sh ]] && { continue; }
    [[ "$f" == *help.sh ]] && { continue; }
    source "$f"
  done
done

# Export all RAG_ environment variables
for var in $(compgen -v | grep '^RAG_'); do
   export "$var=${!var}"
done

# Create the rag command dispatcher
rag() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat <<'EOF'
Usage: rag <command> [args]

Commands:
  cursor create <file> <start> [end]    Create cursor
  cursor list|ls                        List cursors
  cursor show <id>                      Show cursor
  cursor delete|rm <id>                 Delete cursor
  mcursor create <title>                Create multicursor
  mcursor add <mc_id> <cursor_id>       Add cursor to collection
  cat <file.mc>                         View MULTICAT file
  mcat <files...>                       Create MULTICAT from files
  repl                                  Start interactive REPL
  help                                  Show this help

Examples:
  rag cursor create auth.js 10 25
  rag mcursor create "Auth fixes"
  rag cat code.mc
  rag repl
EOF
        return 0
    fi

    shift || true

    case "$action" in
        cursor)
            rag_cursor_dispatch "$@"
            ;;
        mcursor)
            rag_mcursor_dispatch "$@"
            ;;
        cat)
            rag_cat_dispatch "$@"
            ;;
        mcat)
            rag_mcat_dispatch "$@"
            ;;
        repl)
            source "$RAG_SRC/bash/rag_repl.sh"
            rag_repl
            ;;
        help)
            rag
            ;;
        *)
            echo "rag: unknown command '$action'" >&2
            echo "Use 'rag help' for usage information"
            return 64
            ;;
    esac
}

# Dispatcher functions for each command group
rag_cursor_dispatch() {
    local subcmd="$1"; shift || true
    case "$subcmd" in
        create) rag_cursor_create "$@" ;;
        list|ls) rag_cursor_list "$@" ;;
        show|display) rag_cursor_show "$@" ;;
        delete|rm) rag_cursor_delete "$@" ;;
        *) echo "cursor commands: create, list, show, delete" ;;
    esac
}

rag_mcursor_dispatch() {
    local subcmd="$1"; shift || true
    case "$subcmd" in
        create) rag_mcursor_create "$@" ;;
        list|ls) rag_mcursor_list "$@" ;;
        show|display) rag_mcursor_show "$@" ;;
        add) rag_mcursor_add "$@" ;;
        remove|rm) rag_mcursor_remove "$@" ;;
        *) echo "mcursor commands: create, list, show, add, remove" ;;
    esac
}

rag_cat_dispatch() {
    local file="$1"
    if [[ -f "$file" && "$file" =~ \.mc$ ]]; then
        "$RAG_SRC/bash/mcinfo.sh" "$file"
    else
        echo "Usage: rag cat <file.mc>"
    fi
}

rag_mcat_dispatch() {
    "$RAG_SRC/bash/multicat.sh" "$@"
}

# Export RAG environment
export RAG_DIR RAG_SRC

# Optional quiet confirmation
[[ "${RAG_QUIET:-}" != "1" ]] && echo "RAG Tools loaded from $RAG_SRC. Use 'rag help' or 'rag repl'." >&2