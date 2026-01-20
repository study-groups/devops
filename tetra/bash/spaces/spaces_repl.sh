#!/usr/bin/env bash
# spaces_repl.sh - Interactive REPL for DigitalOcean Spaces management
# Uses spaces.sh module with TES symbol resolution

# Only set strict mode when running as script, not when sourced
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    set -euo pipefail
fi

# Strong globals
: "${TETRA_SRC:?TETRA_SRC must be set}"
: "${TETRA_DIR:?TETRA_DIR must be set}"

# Module name
MOD_NAME="spaces-repl"

# Load dependencies
SPACES_MODULE="$TETRA_SRC/bash/spaces/spaces.sh"
if [[ -f "$SPACES_MODULE" ]]; then
    source "$SPACES_MODULE"
else
    echo "Error: spaces.sh not found at $SPACES_MODULE" >&2
    exit 1
fi

# Load repl core if available
source "$TETRA_SRC/bash/repl/core/repl.sh" 2>/dev/null || true

# Load completion system
COMPLETION_MODULE="$TETRA_SRC/bash/spaces/spaces_completion.sh"
if [[ -f "$COMPLETION_MODULE" ]]; then
    source "$COMPLETION_MODULE"
fi

# ═══════════════════════════════════════════════════════════
# STATE MANAGEMENT
# ═══════════════════════════════════════════════════════════

# Current session state
REPL_CURRENT_BUCKET=""
REPL_CURRENT_PATH=""
REPL_CONFIGURED=false

# Initialize spaces from secrets
repl_init() {
    echo "═══════════════════════════════════════════════════════════"
    echo "  SPACES REPL - DigitalOcean Spaces Manager"
    echo "═══════════════════════════════════════════════════════════"
    echo ""

    # Check for TETRA_ORG
    if [[ -z "${TETRA_ORG:-}" ]]; then
        echo "⚠ TETRA_ORG not set"
        echo ""
        echo "Available orgs:"
        ls -1 "$TETRA_DIR/orgs/" 2>/dev/null | sed 's/^/  /' || echo "  (none found)"
        echo ""
        read -p "Enter org name: " org_name
        if [[ -n "$org_name" ]]; then
            export TETRA_ORG="$org_name"
        else
            echo "Error: Organization required"
            return 1
        fi
    fi

    # Load secrets
    local secrets_file="$TETRA_DIR/orgs/$TETRA_ORG/secrets.env"
    if [[ -f "$secrets_file" ]]; then
        echo "Loading secrets from: $secrets_file"
        set -a
        source "$secrets_file"
        set +a
        REPL_CONFIGURED=true
    else
        echo "⚠ No secrets file found: $secrets_file"
        REPL_CONFIGURED=false
    fi

    # Check credentials
    if [[ -z "${DO_SPACES_KEY:-}" ]] || [[ -z "${DO_SPACES_SECRET:-}" ]]; then
        echo ""
        echo "⚠ No Spaces credentials configured"
        echo ""
        echo "To configure:"
        echo "  1. Create secrets file:"
        echo "     $secrets_file"
        echo ""
        echo "  2. Add credentials:"
        echo "     DO_SPACES_KEY=xxx"
        echo "     DO_SPACES_SECRET=xxx"
        echo ""
        REPL_CONFIGURED=false
        return 1
    fi

    # Get default bucket from tetra.toml
    local toml_file="$TETRA_DIR/orgs/$TETRA_ORG/tetra.toml"
    local bucket_source=""
    if [[ -f "$toml_file" ]]; then
        REPL_CURRENT_BUCKET=$(awk '/^\[storage\.s3\]/ {found=1; next} found && /^\[/ {exit} found && /^default_bucket/ {print}' "$toml_file" | cut -d'=' -f2 | tr -d ' "')
        if [[ -n "$REPL_CURRENT_BUCKET" ]]; then
            bucket_source="tetra.toml [storage.s3].default_bucket"
        fi
    fi

    echo ""
    echo "SESSION INFO:"
    echo "  Organization: $TETRA_ORG"
    if [[ -n "$REPL_CURRENT_BUCKET" ]]; then
        echo "  Bucket:       $REPL_CURRENT_BUCKET (from $bucket_source)"
    else
        echo "  Bucket:       <not set>"
    fi
    echo "  Configured:   $REPL_CONFIGURED"
    echo ""

    # Show available buckets
    local all_buckets
    all_buckets=$(spaces_completion_buckets 2>/dev/null | tr '\n' ' ')
    if [[ -n "$all_buckets" ]]; then
        echo "AVAILABLE BUCKETS:"
        for bucket in $all_buckets; do
            if [[ "$bucket" == "$REPL_CURRENT_BUCKET" ]]; then
                echo "  • $bucket (current)"
            else
                echo "  • $bucket"
            fi
        done
    fi

    return 0
}

# ═══════════════════════════════════════════════════════════
# REPL COMMANDS (wrappers around spaces.sh functions)
# ═══════════════════════════════════════════════════════════

# List files
repl_ls() {
    local symbol="${1:-}"

    # Build symbol from current state if not provided
    if [[ -z "$symbol" ]]; then
        if [[ -n "$REPL_CURRENT_BUCKET" ]]; then
            symbol="$REPL_CURRENT_BUCKET"
            if [[ -n "$REPL_CURRENT_PATH" ]]; then
                symbol="$symbol:$REPL_CURRENT_PATH"
            fi
        else
            symbol="@spaces"
        fi
    fi

    spaces_list "$symbol"
}

# Download file
repl_get() {
    local path="$1"
    local dest="${2:--}"

    if [[ -z "$path" ]]; then
        echo "Error: Path required" >&2
        echo "Usage: get <path> [dest]" >&2
        return 1
    fi

    # Build symbol
    local symbol="$REPL_CURRENT_BUCKET:$path"
    spaces_get "$symbol" "$dest"
}

# Upload file
repl_put() {
    local source="$1"
    local path="${2:-}"

    if [[ -z "$source" ]]; then
        echo "Error: Source file required" >&2
        echo "Usage: put <source> [remote-path] [options]" >&2
        return 1
    fi

    if [[ ! -f "$source" ]]; then
        echo "Error: File not found: $source" >&2
        return 1
    fi

    # Default path to basename if not provided
    if [[ -z "$path" ]]; then
        path=$(basename "$source")
    fi

    # Add current path prefix if set
    if [[ -n "$REPL_CURRENT_PATH" ]]; then
        path="$REPL_CURRENT_PATH/$path"
    fi

    # Build symbol
    local symbol="$REPL_CURRENT_BUCKET:$path"

    # Shift off source and path, rest are options
    shift 2 2>/dev/null || shift
    spaces_put "$source" "$symbol" "$@"
}

# Sync directory
repl_sync() {
    local source="$1"
    local dest="$2"
    shift 2 2>/dev/null || true

    if [[ -z "$source" ]] || [[ -z "$dest" ]]; then
        echo "Error: Source and destination required" >&2
        echo "Usage: sync <local-dir> <remote-path> [options]" >&2
        return 1
    fi

    # Determine direction
    if [[ -d "$source" ]]; then
        # Local to remote
        local remote_symbol="$REPL_CURRENT_BUCKET:$dest"
        spaces_sync "$source" "$remote_symbol" "$@"
    else
        # Remote to local
        local remote_symbol="$REPL_CURRENT_BUCKET:$source"
        spaces_sync "$remote_symbol" "$dest" "$@"
    fi
}

# Delete file
repl_rm() {
    local path="$1"

    if [[ -z "$path" ]]; then
        echo "Error: Path required" >&2
        echo "Usage: rm <path>" >&2
        return 1
    fi

    local symbol="$REPL_CURRENT_BUCKET:$path"
    spaces_delete "$symbol"
}

# Get public URL
repl_url() {
    local path="${1:-}"

    if [[ -z "$path" ]]; then
        echo "Error: Path required" >&2
        echo "Usage: url <path>" >&2
        return 1
    fi

    local symbol="$REPL_CURRENT_BUCKET:$path"
    spaces_url "$symbol"
}

# Set current bucket
repl_use() {
    local bucket="${1:-}"

    if [[ -z "$bucket" ]]; then
        echo "Current bucket: ${REPL_CURRENT_BUCKET:-<not set>}"
        echo "Current path:   ${REPL_CURRENT_PATH:-<not set>}"
        echo ""
        echo "Usage: use <bucket> [path]"
        return 0
    fi

    REPL_CURRENT_BUCKET="$bucket"
    REPL_CURRENT_PATH="${2:-}"

    echo "✓ Context set to: $bucket${REPL_CURRENT_PATH:+:$REPL_CURRENT_PATH}"
}

# Change directory within bucket
repl_cd() {
    local path="${1:-.}"

    if [[ "$path" == "." ]]; then
        REPL_CURRENT_PATH=""
        echo "✓ At bucket root"
    elif [[ "$path" == ".." ]]; then
        # Go up one level
        REPL_CURRENT_PATH="${REPL_CURRENT_PATH%/*}"
        echo "✓ Current path: ${REPL_CURRENT_PATH:-/}"
    else
        # Set absolute or relative path
        if [[ "$path" == /* ]]; then
            REPL_CURRENT_PATH="${path#/}"
        else
            if [[ -n "$REPL_CURRENT_PATH" ]]; then
                REPL_CURRENT_PATH="$REPL_CURRENT_PATH/$path"
            else
                REPL_CURRENT_PATH="$path"
            fi
        fi
        echo "✓ Current path: /$REPL_CURRENT_PATH"
    fi
}

# Show status
repl_status() {
    echo "═══════════════════════════════════════════════════════════"
    echo "  SPACES SESSION STATUS"
    echo "═══════════════════════════════════════════════════════════"
    echo ""
    echo "CONFIGURATION:"
    echo "  Organization: ${TETRA_ORG:-<not set>}"
    echo "  Configured:   $REPL_CONFIGURED"
    echo ""
    echo "CURRENT CONTEXT:"
    echo "  Bucket:       ${REPL_CURRENT_BUCKET:-<not set>}"
    echo "  Path:         ${REPL_CURRENT_PATH:-/}"
    echo ""
    echo "CREDENTIALS:"
    if [[ -n "${DO_SPACES_KEY:-}" ]]; then
        echo "  Access Key:   ${DO_SPACES_KEY:0:10}..."
    else
        echo "  Access Key:   <not set>"
    fi
}

# ═══════════════════════════════════════════════════════════
# REPL INTERFACE
# ═══════════════════════════════════════════════════════════

repl_help() {
    local topic="${1:-}"

    # Specific command help
    if [[ -n "$topic" ]]; then
        case "$topic" in
            use)
                cat <<'EOF'
COMMAND: use <bucket> [path]

Set the current bucket and optional path context for subsequent commands.

AVAILABLE BUCKETS:
EOF
                spaces_completion_buckets | sed 's/^/  /'
                cat <<'EOF'

EXAMPLES:
  use pja-games              # Set bucket to pja-games
  use pja-games games/       # Set bucket and path
  use                        # Show current context
EOF
                ;;
            cd)
                cat <<'EOF'
COMMAND: cd <path>

Change the current path within the bucket.

SPECIAL PATHS:
  .       Go to bucket root
  ..      Go up one directory level
  path/   Go to specific path (relative or absolute)

EXAMPLES:
  cd games/         # Change to games/ directory
  cd ..             # Go up one level
  cd .              # Go to root
EOF
                ;;
            ls|list)
                cat <<'EOF'
COMMAND: ls [path]

List files in the bucket. Uses current context if path not specified.

EXAMPLES:
  ls                         # List current path
  ls games/                  # List games/ directory
  ls pja-games:docs/         # List specific bucket:path (overrides context)
EOF
                ;;
            *)
                echo "No help available for: $topic"
                echo "Available commands: use cd ls get put rm sync url status help exit"
                ;;
        esac
        return 0
    fi

    # General help
    cat <<'EOF'
═══════════════════════════════════════════════════════════
  SPACES REPL COMMANDS
═══════════════════════════════════════════════════════════

NAVIGATION:
  use <bucket> [path]        Set current bucket/path context
  cd <path>                  Change path within bucket
  cd .                       Go to bucket root
  cd ..                      Go up one level

FILE OPERATIONS:
  ls [path]                  List files (uses current context)
  get <path> [dest]          Download file (- for stdout)
  put <file> [path] [opts]   Upload file
  rm <path>                  Delete file
  sync <src> <dest> [opts]   Sync directory
  url <path>                 Get public URL

UTILITIES:
  status                     Show session status
  help [command]             Show help (use 'help <command>' for details)
  exit                       Exit REPL

CONTEXT:
  Current context is shown in prompt: spaces:bucket:path>
  Commands use current bucket/path if not specified

EXAMPLES:
  use pja-games                      # Set bucket
  cd games/                          # Change to games/ directory
  ls                                 # List games/
  get manifest.json                  # Download games/manifest.json
  put local.json config.json         # Upload to games/config.json
  url manifest.json                  # Get public URL

  # With TES symbols (override context)
  ls pja-games:docs/                 # List specific path
  get pja-games:games.json -         # Download to stdout

S3CMD OPTIONS:
  put <file> <path> --acl public-read
  put <file> <path> --add-header="Cache-Control: max-age=3600"
  sync <dir> <path> --delete
  sync <dir> <path> --exclude "*.tmp"

TIP: Type 'help use' to see available buckets
EOF
}

# Command dispatcher
repl_command() {
    local cmd="${1:-}"
    shift 2>/dev/null || true

    case "$cmd" in
        use)
            repl_use "$@"
            ;;
        cd)
            repl_cd "$@"
            ;;
        ls|list)
            repl_ls "$@"
            ;;
        get|download)
            repl_get "$@"
            ;;
        put|upload)
            repl_put "$@"
            ;;
        rm|delete)
            repl_rm "$@"
            ;;
        sync)
            repl_sync "$@"
            ;;
        url|link)
            repl_url "$@"
            ;;
        status)
            repl_status
            ;;
        help|--help|-h)
            repl_help "$@"
            ;;
        exit|quit|q)
            echo "Goodbye!"
            return 1
            ;;
        "")
            # Empty command, just show prompt again
            ;;
        *)
            echo "Unknown command: $cmd" >&2
            echo "Type 'help' for available commands" >&2
            return 0
            ;;
    esac
}

# REPL completion handler (called by readline)
_spaces_repl_readline_complete() {
    local line="$READLINE_LINE"
    local point="$READLINE_POINT"

    # Get current word being completed
    local prefix="${line:0:$point}"
    local words=($prefix)
    local cur="${words[-1]}"
    local prev=""
    [[ ${#words[@]} -gt 1 ]] && prev="${words[-2]}"

    # Ensure tree is initialized
    if declare -F _spaces_ensure_tree >/dev/null 2>&1; then
        _spaces_ensure_tree 2>/dev/null
    fi

    # Get base commands
    local commands="use cd ls list get download put upload rm delete sync url link status help exit quit q"

    # Context-aware completion
    if [[ ${#words[@]} -eq 1 ]] || [[ -z "$prev" ]]; then
        # Completing first word - show commands
        local matches=$(compgen -W "$commands" -- "$cur")
    else
        # Completing arguments based on previous command
        case "${words[0]}" in
            use)
                # Complete bucket names
                local buckets=$(spaces_completion_buckets 2>/dev/null)
                local matches=$(compgen -W "$buckets" -- "$cur")
                ;;
            cd)
                # Complete paths
                local matches=$(compgen -W ". .. games/ docs/ assets/ config/ public/" -- "$cur")
                ;;
            put)
                # Complete local files
                local matches=$(compgen -f -- "$cur")
                ;;
            *)
                local matches=""
                ;;
        esac
    fi

    # If we have matches, show them
    if [[ -n "$matches" ]]; then
        local count=$(echo "$matches" | wc -l)
        if [[ $count -eq 1 ]]; then
            # Single match - insert it
            READLINE_LINE="${prefix%$cur}$matches "
            READLINE_POINT=${#READLINE_LINE}
        else
            # Multiple matches - show them
            echo ""
            echo "$matches" | column -c 80
            echo -n "$prompt$line"
        fi
    fi
}

# Main REPL loop
spaces_repl() {
    # Initialize
    if ! repl_init; then
        echo ""
        read -p "Continue anyway? (y/N): " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
            return 1
        fi
    fi

    echo ""
    echo "Type 'help' for commands, 'exit' to quit"
    echo ""

    # Enable readline and history
    set -o emacs 2>/dev/null || true

    # REPL loop
    while true; do
        # Build prompt
        local prompt="spaces"
        if [[ -n "$REPL_CURRENT_BUCKET" ]]; then
            prompt="$prompt:$REPL_CURRENT_BUCKET"
            if [[ -n "$REPL_CURRENT_PATH" ]]; then
                prompt="$prompt:$REPL_CURRENT_PATH"
            fi
        fi
        prompt="$prompt> "

        # Read command with readline support
        read -r -e -p "$prompt" line || break

        # Skip empty lines
        [[ -z "$line" ]] && continue

        # Add to history
        history -s "$line" 2>/dev/null || true

        # Parse and execute command
        eval "set -- $line"
        repl_command "$@" || break
    done

    echo ""
}

# Export functions
export -f repl_init
export -f repl_ls
export -f repl_get
export -f repl_put
export -f repl_sync
export -f repl_rm
export -f repl_url
export -f repl_use
export -f repl_cd
export -f repl_status
export -f repl_help
export -f repl_command
export -f spaces_repl

# Auto-start REPL if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    spaces_repl
fi
