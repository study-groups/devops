#!/usr/bin/env bash
# tls.sh - Time-ordered List with TDS styling
#
# Usage: source $TETRA_SRC/bash/tls/tls.sh

TLS_SRC="${TLS_SRC:-$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)}"
TLS_DIR="${TLS_DIR:-${TETRA_DIR:-$HOME/.tetra}/tls}"

source "$TLS_SRC/tls_complete.sh"

# =============================================================================
# CONFIGURATION
# =============================================================================

# Ensure config directory exists
[[ -d "$TLS_DIR" ]] || mkdir -p "$TLS_DIR"

# Load saved config if exists
[[ -f "$TLS_DIR/config" ]] && source "$TLS_DIR/config"

# Defaults (only if not already set)
TLS_LIMIT="${TLS_LIMIT:-20}"
TLS_DATE_FORMAT="${TLS_DATE_FORMAT:-%Y-%m-%d %H:%M}"
TLS_SHOW_HIDDEN="${TLS_SHOW_HIDDEN:-false}"
TLS_THEME="${TLS_THEME:-default}"
TLS_COLUMNS="${TLS_COLUMNS:-auto}"

# =============================================================================
# COLOR SETUP - defensive, never fails
# =============================================================================

_tls_init_colors() {
    # All colors empty by default (plain output)
    _TLS_C_HOT="" _TLS_C_WARM="" _TLS_C_NEUTRAL="" _TLS_C_DIM=""
    _TLS_C_DIR="" _TLS_C_EXEC="" _TLS_C_LINK="" _TLS_C_FILE=""
    _TLS_C_STAGED="" _TLS_C_MODIFIED="" _TLS_C_UNTRACKED="" _TLS_C_CLEAN=""
    _TLS_C_HEADING="" _TLS_C_CODE="" _TLS_C_CONFIG="" _TLS_C_RESET=""
    _TLS_C_BOLD="" _TLS_C_DIR_BOLD=""

    # Only use colors if stdout is terminal
    [[ ! -t 1 ]] && return

    # Basic ANSI fallbacks
    _TLS_C_BOLD=$'\e[1m'
    _TLS_C_DIM=$'\e[2m'
    _TLS_C_RESET=$'\e[0m'
    _TLS_C_DIR=$'\e[1;34m'        # Bold blue for directories
    _TLS_C_DIR_BOLD=$'\e[1;34m'   # Bold blue
    _TLS_C_EXEC=$'\e[1;32m'       # Bold green
    _TLS_C_LINK=$'\e[1;36m'       # Bold cyan
    _TLS_C_FILE=$'\e[0m'          # Normal
    _TLS_C_HOT=$'\e[32m'          # Green (< 1 hour)
    _TLS_C_WARM=$'\e[33m'         # Yellow (< 24 hours)
    _TLS_C_NEUTRAL=$'\e[0m'       # Normal
    _TLS_C_CODE=$'\e[33m'         # Yellow for .sh
    _TLS_C_CONFIG=$'\e[35m'       # Magenta for config files

    # Use TDS if available (overrides ANSI)
    declare -F tds_text_color >/dev/null 2>&1 || return
    declare -F reset_color >/dev/null 2>&1 || return

    _TLS_C_HOT=$(tds_text_color "interactive.success" 2>/dev/null) || true
    _TLS_C_WARM=$(tds_text_color "content.emphasis.bold" 2>/dev/null) || true
    _TLS_C_NEUTRAL=$(tds_text_color "text.primary" 2>/dev/null) || true
    _TLS_C_DIM=$(tds_text_color "text.secondary" 2>/dev/null) || true
    _TLS_C_DIR=$(tds_text_color "content.link" 2>/dev/null) || true
    _TLS_C_DIR_BOLD="${_TLS_C_BOLD}${_TLS_C_DIR}"
    _TLS_C_EXEC=$(tds_text_color "interactive.success" 2>/dev/null) || true
    _TLS_C_LINK=$(tds_text_color "content.emphasis.italic" 2>/dev/null) || true
    _TLS_C_FILE=$_TLS_C_DIM
    _TLS_C_STAGED=$_TLS_C_HOT
    _TLS_C_MODIFIED=$_TLS_C_WARM
    _TLS_C_UNTRACKED=$(tds_text_color "interactive.warning" 2>/dev/null) || true
    _TLS_C_CLEAN=$_TLS_C_DIM
    _TLS_C_HEADING=$(tds_text_color "content.heading.h2" 2>/dev/null) || true
    _TLS_C_CODE=$(tds_text_color "content.code.inline" 2>/dev/null) || true
    _TLS_C_CONFIG=$(tds_text_color "content.emphasis.italic" 2>/dev/null) || true
    _TLS_C_RESET=$(reset_color 2>/dev/null) || true
}

# =============================================================================
# CORE FUNCTIONS
# =============================================================================

_tls_format_time() {
    local mtime="$1"
    local now=$(date +%s)
    local age=$((now - mtime))
    local formatted=$(date -r "$mtime" +"$TLS_DATE_FORMAT" 2>/dev/null || date -d "@$mtime" +"$TLS_DATE_FORMAT" 2>/dev/null)

    if [[ $age -lt 3600 ]]; then
        printf "%s%s%s" "$_TLS_C_HOT" "$formatted" "$_TLS_C_RESET"
    elif [[ $age -lt 86400 ]]; then
        printf "%s%s%s" "$_TLS_C_WARM" "$formatted" "$_TLS_C_RESET"
    elif [[ $age -lt 604800 ]]; then
        printf "%s%s%s" "$_TLS_C_NEUTRAL" "$formatted" "$_TLS_C_RESET"
    else
        printf "%s%s%s" "$_TLS_C_DIM" "$formatted" "$_TLS_C_RESET"
    fi
}

_tls_format_type() {
    local path="$1"

    if [[ -d "$path" ]]; then
        printf "%sd%s" "$_TLS_C_DIR" "$_TLS_C_RESET"
    elif [[ -x "$path" ]]; then
        printf "%sx%s" "$_TLS_C_EXEC" "$_TLS_C_RESET"
    elif [[ -L "$path" ]]; then
        printf "%sl%s" "$_TLS_C_LINK" "$_TLS_C_RESET"
    else
        printf "%s.%s" "$_TLS_C_FILE" "$_TLS_C_RESET"
    fi
}

_tls_git_annotation() {
    local path="$1"
    local dir=$(dirname "$path")
    local file=$(basename "$path")

    if ! git -C "$dir" rev-parse --git-dir &>/dev/null; then
        printf "   "
        return
    fi

    local status=$(git -C "$dir" status --porcelain -- "$file" 2>/dev/null | head -1)

    if [[ -z "$status" ]]; then
        printf "%s · %s" "$_TLS_C_CLEAN" "$_TLS_C_RESET"
    elif [[ "$status" =~ ^[MADRC] ]]; then
        printf "%s + %s" "$_TLS_C_STAGED" "$_TLS_C_RESET"
    elif [[ "$status" =~ ^.M ]]; then
        printf "%s M %s" "$_TLS_C_MODIFIED" "$_TLS_C_RESET"
    elif [[ "$status" =~ ^\?\? ]]; then
        printf "%s ? %s" "$_TLS_C_UNTRACKED" "$_TLS_C_RESET"
    else
        printf "   "
    fi
}

_tls_format_name() {
    local path="$1"
    local name=$(basename "$path")

    if [[ -d "$path" ]]; then
        printf "%s%s/%s" "$_TLS_C_DIR" "$name" "$_TLS_C_RESET"
    elif [[ "$name" == *.sh ]]; then
        printf "%s%s%s" "$_TLS_C_CODE" "$name" "$_TLS_C_RESET"
    elif [[ "$name" == *.md ]]; then
        printf "%s%s%s" "$_TLS_C_DIR" "$name" "$_TLS_C_RESET"
    elif [[ "$name" == *.toml || "$name" == *.json || "$name" == *.yaml || "$name" == *.yml ]]; then
        printf "%s%s%s" "$_TLS_C_CONFIG" "$name" "$_TLS_C_RESET"
    elif [[ -x "$path" ]]; then
        printf "%s%s%s" "$_TLS_C_EXEC" "$name" "$_TLS_C_RESET"
    else
        printf "%s" "$name"
    fi
}

# Format name for multi-column display (simple, no trailing slash logic here)
_tls_format_name_simple() {
    local path="$1"
    local name=$(basename "$path")

    if [[ -d "$path" ]]; then
        printf "%s%s/%s" "$_TLS_C_DIR_BOLD" "$name" "$_TLS_C_RESET"
    elif [[ "$name" == *.sh ]]; then
        printf "%s%s%s" "$_TLS_C_CODE" "$name" "$_TLS_C_RESET"
    elif [[ "$name" == *.md ]]; then
        printf "%s%s%s" "$_TLS_C_DIR" "$name" "$_TLS_C_RESET"
    elif [[ "$name" == *.toml || "$name" == *.json || "$name" == *.yaml || "$name" == *.yml ]]; then
        printf "%s%s%s" "$_TLS_C_CONFIG" "$name" "$_TLS_C_RESET"
    elif [[ -x "$path" ]]; then
        printf "%s%s%s" "$_TLS_C_EXEC" "$name" "$_TLS_C_RESET"
    else
        printf "%s" "$name"
    fi
}

# Get display width of a name (excluding ANSI codes)
_tls_name_width() {
    local path="$1"
    local name=$(basename "$path")
    [[ -d "$path" ]] && echo $((${#name} + 1)) || echo "${#name}"
}

# Multi-column output like ls
_tls_print_columns() {
    local -n items=$1
    local term_width=${COLUMNS:-80}
    local max_width=0
    local padding=2

    # Find max width
    for item in "${items[@]}"; do
        local w=$(_tls_name_width "$item")
        (( w > max_width )) && max_width=$w
    done

    local col_width=$((max_width + padding))
    local num_cols=$((term_width / col_width))
    (( num_cols < 1 )) && num_cols=1

    local count=0
    for item in "${items[@]}"; do
        local name_w=$(_tls_name_width "$item")
        _tls_format_name_simple "$item"
        local spaces=$((col_width - name_w))
        printf "%*s" "$spaces" ""
        ((count++))
        if (( count % num_cols == 0 )); then
            printf "\n"
        fi
    done
    # Final newline if needed
    (( count % num_cols != 0 )) && printf "\n"
}

_tls_list() {
    local path="${1:-.}"
    local show_long="${2:-false}"
    local annotate="${3:-false}"

    # Init colors
    _tls_init_colors

    # Collect directories and files separately
    local dirs=() files=() recent_files=()
    local now=$(date +%s)
    local day_ago=$((now - 86400))

    while IFS= read -r -d '' entry; do
        [[ "$entry" == "$path" ]] && continue
        local name=$(basename "$entry")
        [[ "$name" == .* ]] && [[ "$TLS_SHOW_HIDDEN" != "true" ]] && continue

        if [[ -d "$entry" ]]; then
            dirs+=("$entry")
        else
            local mtime=$(stat -f %m "$entry" 2>/dev/null || echo 0)
            if (( mtime > day_ago )); then
                recent_files+=("$mtime:$entry")
            else
                files+=("$entry")
            fi
        fi
    done < <(find "$path" -maxdepth 1 -print0 2>/dev/null)

    # Sort directories alphabetically
    IFS=$'\n' dirs=($(printf '%s\n' "${dirs[@]}" | sort -f)); unset IFS

    # Sort recent files by mtime (newest first), then extract paths
    local sorted_recent=()
    if [[ ${#recent_files[@]} -gt 0 ]]; then
        while IFS= read -r line; do
            [[ -n "$line" ]] && sorted_recent+=("${line#*:}")
        done < <(printf '%s\n' "${recent_files[@]}" | sort -rn -t: -k1)
    fi

    # Sort older files alphabetically
    IFS=$'\n' files=($(printf '%s\n' "${files[@]}" | sort -f)); unset IFS

    if [[ ${#dirs[@]} -eq 0 && ${#sorted_recent[@]} -eq 0 && ${#files[@]} -eq 0 ]]; then
        printf "%sNo files found%s\n" "$_TLS_C_DIM" "$_TLS_C_RESET"
        return
    fi

    if [[ "$show_long" == "true" ]]; then
        # Long format with timestamps
        _tls_list_long "$path" "$annotate"
    else
        # Multi-column format: dirs first (alpha), then recent files (by time), then old files (alpha)
        if [[ ${#dirs[@]} -gt 0 ]]; then
            _tls_print_columns dirs
        fi
        if [[ ${#sorted_recent[@]} -gt 0 ]]; then
            [[ ${#dirs[@]} -gt 0 ]] && printf "\n"
            printf "%s── recent (< 24h) ──%s\n" "$_TLS_C_DIM" "$_TLS_C_RESET"
            _tls_print_columns sorted_recent
        fi
        if [[ ${#files[@]} -gt 0 ]]; then
            [[ ${#dirs[@]} -gt 0 || ${#sorted_recent[@]} -gt 0 ]] && printf "\n"
            _tls_print_columns files
        fi
    fi
}

# Long format listing (original style)
_tls_list_long() {
    local path="${1:-.}"
    local annotate="${2:-false}"

    local entries=()
    while IFS= read -r line; do
        [[ -n "$line" ]] && entries+=("${line#* }")
    done < <(find "$path" -maxdepth 1 -not -name ".*" -not -path "$path" -exec stat -f '%m %N' {} \; 2>/dev/null | sort -rn)

    # Header
    printf "%s  %-16s  %s  %s" "$_TLS_C_HEADING" "Modified" "T" ""
    [[ "$annotate" == "true" ]] && printf "Git "
    printf "Name%s\n" "$_TLS_C_RESET"
    printf "%s────────────────────────────────────────────────────────────%s\n" "$_TLS_C_DIM" "$_TLS_C_RESET"

    for file in "${entries[@]}"; do
        [[ ! -e "$file" ]] && continue
        local mtime=$(stat -f %m "$file" 2>/dev/null)

        printf "  "
        _tls_format_time "$mtime"
        printf "  "
        _tls_format_type "$file"
        printf "  "
        [[ "$annotate" == "true" ]] && _tls_git_annotation "$file"
        _tls_format_name "$file"
        printf "\n"
    done
}

# =============================================================================
# CONFIG COMMAND
# =============================================================================

_tls_config() {
    local subcmd="${1:-show}"
    shift 2>/dev/null || true

    case "$subcmd" in
        show)
            echo "TLS Configuration:"
            echo "  limit       = $TLS_LIMIT"
            echo "  date_format = $TLS_DATE_FORMAT"
            echo "  show_hidden = $TLS_SHOW_HIDDEN"
            echo "  theme       = $TLS_THEME"
            echo "  columns     = $TLS_COLUMNS"
            echo ""
            echo "  config_dir  = $TLS_DIR"
            ;;
        list)
            echo "limit"
            echo "date_format"
            echo "show_hidden"
            echo "theme"
            echo "columns"
            ;;
        get)
            local key="$1"
            case "$key" in
                limit)       echo "$TLS_LIMIT" ;;
                date_format) echo "$TLS_DATE_FORMAT" ;;
                show_hidden) echo "$TLS_SHOW_HIDDEN" ;;
                theme)       echo "$TLS_THEME" ;;
                columns)     echo "$TLS_COLUMNS" ;;
                *) echo "Unknown key: $key"; return 1 ;;
            esac
            ;;
        set)
            local key="$1" val="$2"
            case "$key" in
                limit)       export TLS_LIMIT="$val" ;;
                date_format) export TLS_DATE_FORMAT="$val" ;;
                show_hidden) export TLS_SHOW_HIDDEN="$val" ;;
                theme)       export TLS_THEME="$val" ;;
                columns)     export TLS_COLUMNS="$val" ;;
                *) echo "Unknown key: $key"; return 1 ;;
            esac
            echo "$key = $val"
            ;;
        save)
            [[ -d "$TLS_DIR" ]] || mkdir -p "$TLS_DIR"
            cat > "$TLS_DIR/config" << EOF
# TLS configuration - generated $(date +%Y-%m-%d)
TLS_LIMIT="$TLS_LIMIT"
TLS_DATE_FORMAT="$TLS_DATE_FORMAT"
TLS_SHOW_HIDDEN="$TLS_SHOW_HIDDEN"
TLS_THEME="$TLS_THEME"
TLS_COLUMNS="$TLS_COLUMNS"
EOF
            echo "Saved to $TLS_DIR/config"
            ;;
        load)
            if [[ -f "$TLS_DIR/config" ]]; then
                source "$TLS_DIR/config"
                echo "Loaded from $TLS_DIR/config"
            else
                echo "No config file at $TLS_DIR/config"
                return 1
            fi
            ;;
        path)
            echo "$TLS_DIR"
            ;;
        *) echo "Unknown config command: $subcmd"; return 1 ;;
    esac
}

# =============================================================================
# HELP COMMAND
# =============================================================================

_tls_help() {
    local topic="${1:-}"

    case "$topic" in
        list)
            cat << 'EOF'
tls list - List directory contents

USAGE:
    tls list [options] [path]
    tls [path]              (list is default)

OPTIONS:
    -l    Long format with timestamps (like ls -l)
    -a    Show git status annotations (with -l)

OUTPUT:
    Default: multi-column like ls
      - Directories first (bold, sorted alphabetically)
      - Recent files (< 24h, sorted by time, newest first)
      - Older files (sorted alphabetically)

    Long (-l): single column with timestamps
      - All entries sorted by modification time
EOF
            ;;
        config)
            cat << 'EOF'
tls config - Manage tls configuration

USAGE:
    tls config show           Show all settings
    tls config list           List available keys
    tls config get <key>      Get a setting
    tls config set <key> <v>  Set a setting
    tls config save           Save to $TLS_DIR/config
    tls config load           Load from $TLS_DIR/config
    tls config path           Show config directory

KEYS:
    limit        Number of entries for -l mode (default: 20)
    date_format  strftime format (default: %Y-%m-%d %H:%M)
    show_hidden  Show hidden files (default: false)
    theme        Color theme (default: default)
    columns      Column mode: auto or number (default: auto)
EOF
            ;;
        colors)
            cat << 'EOF'
tls colors - Time-based color coding

TIME COLORS (age of file):
    Green   = less than 1 hour (hot)
    Yellow  = less than 1 day (warm)
    White   = less than 1 week (neutral)
    Dim     = older (cool)

TYPE INDICATORS:
    d = directory
    x = executable
    l = symlink
    . = regular file

GIT ANNOTATIONS (with -a):
    +  = staged
    M  = modified
    ?  = untracked
    ·  = clean
EOF
            ;;
        *)
            cat << 'EOF'
tls - Time-ordered List

USAGE:
    tls [command] [args]

COMMANDS:
    list [path]     List files by mtime (default)
    config          Manage configuration
    help [topic]    Show help

EXAMPLES:
    tls                     List current directory
    tls list -a             With git annotations
    tls list -n 10 ~/src    Top 10 in ~/src
    tls config set limit 50 Change default limit
    tls help colors         Color documentation

Use <TAB> to explore commands and options.
EOF
            ;;
    esac
}

# =============================================================================
# MAIN COMMAND
# =============================================================================

tls() {
    local cmd="${1:-list}"

    # Handle options at top level (implicit list command)
    if [[ "$1" == -* ]]; then
        cmd="list"
    # Handle bare path as implicit list
    elif [[ -d "$1" ]] || [[ "$1" == */ ]]; then
        cmd="list"
    else
        shift 2>/dev/null || true
    fi

    case "$cmd" in
        list|l)
            local path="." show_long="false" annotate="false"
            while [[ $# -gt 0 ]]; do
                case "$1" in
                    -l) show_long="true"; shift ;;
                    -a) annotate="true"; shift ;;
                    -la|-al) show_long="true"; annotate="true"; shift ;;
                    -*) echo "Unknown option: $1"; return 1 ;;
                    *)  path="$1"; shift ;;
                esac
            done
            _tls_list "$path" "$show_long" "$annotate"
            ;;
        config|c) _tls_config "$@" ;;
        help|h) _tls_help "$@" ;;
        *) echo "Unknown command: $cmd"; echo "Try: tls help"; return 1 ;;
    esac
}

complete -F _tls_complete tls

export -f tls _tls_list _tls_list_long _tls_config _tls_help
export -f _tls_init_colors _tls_format_time _tls_format_type _tls_format_name _tls_git_annotation
export -f _tls_format_name_simple _tls_name_width _tls_print_columns
