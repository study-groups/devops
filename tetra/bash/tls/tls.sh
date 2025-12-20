#!/usr/bin/env bash

# TLS - Time-ordered List with TDS styling
# Main command implementation

# =============================================================================
# CONFIGURATION
# =============================================================================

# TLS_DIR set by includes.sh, fallback for direct sourcing
TLS_DIR="${TLS_DIR:-${TETRA_DIR:-$HOME/.tetra}/tls}"
TLS_CONFIG_FILE="${TLS_DIR}/config/tls.conf"

# Ensure config directory exists
[[ -d "$TLS_DIR/config" ]] || mkdir -p "$TLS_DIR/config"

# Load saved config if exists
[[ -f "$TLS_CONFIG_FILE" ]] && source "$TLS_CONFIG_FILE"

# Defaults (only if not already set)
TLS_LIMIT="${TLS_LIMIT:-20}"
TLS_DATE_FORMAT="${TLS_DATE_FORMAT:-%Y-%m-%d %H:%M}"
TLS_SHOW_HIDDEN="${TLS_SHOW_HIDDEN:-false}"
TLS_THEME="${TLS_THEME:-default}"
TLS_COLUMNS="${TLS_COLUMNS:-auto}"

# =============================================================================
# COLOR SETUP - uses TDS module config
# =============================================================================

# Get ANSI escape for a TLS color token
_tls_color() {
    local token="$1"
    if declare -f tds_module_escape >/dev/null 2>&1; then
        tds_module_escape "tls" "$token"
    else
        echo ""
    fi
}

_tls_init_colors() {
    # All colors empty by default (plain output)
    _TLS_C_HOT="" _TLS_C_WARM="" _TLS_C_NEUTRAL="" _TLS_C_DIM=""
    _TLS_C_DIR="" _TLS_C_EXEC="" _TLS_C_LINK="" _TLS_C_FILE=""
    _TLS_C_STAGED="" _TLS_C_MODIFIED="" _TLS_C_UNTRACKED="" _TLS_C_CLEAN=""
    _TLS_C_HEADING="" _TLS_C_CODE="" _TLS_C_CONFIG="" _TLS_C_RESET=""
    _TLS_C_BOLD="" _TLS_C_DIR_BOLD=""

    # Only use colors if stdout is terminal
    [[ ! -t 1 ]] && return

    _TLS_C_BOLD=$'\e[1m'
    _TLS_C_RESET=$'\e[0m'

    # Use TDS module colors if available
    if declare -f tds_module_escape >/dev/null 2>&1; then
        _TLS_C_HOT=$(_tls_color "time.hot")
        _TLS_C_WARM=$(_tls_color "time.warm")
        _TLS_C_NEUTRAL=$(_tls_color "time.neutral")
        _TLS_C_DIM=$(_tls_color "time.cool")
        _TLS_C_DIR=$(_tls_color "file.directory")
        _TLS_C_DIR_BOLD="${_TLS_C_BOLD}${_TLS_C_DIR}"
        _TLS_C_EXEC=$(_tls_color "file.executable")
        _TLS_C_LINK=$(_tls_color "file.symlink")
        _TLS_C_FILE=$(_tls_color "file.regular")
        _TLS_C_CODE=$(_tls_color "file.code")
        _TLS_C_CONFIG=$(_tls_color "file.config")
        _TLS_C_STAGED=$(_tls_color "git.staged")
        _TLS_C_MODIFIED=$(_tls_color "git.modified")
        _TLS_C_UNTRACKED=$(_tls_color "git.untracked")
        _TLS_C_CLEAN=$(_tls_color "git.clean")
        _TLS_C_HEADING=$(_tls_color "ui.heading")
    else
        # Basic ANSI fallbacks
        _TLS_C_DIM=$'\e[2m'
        _TLS_C_DIR=$'\e[1;34m'
        _TLS_C_DIR_BOLD=$'\e[1;34m'
        _TLS_C_EXEC=$'\e[1;32m'
        _TLS_C_LINK=$'\e[1;36m'
        _TLS_C_FILE=$'\e[0m'
        _TLS_C_HOT=$'\e[32m'
        _TLS_C_WARM=$'\e[33m'
        _TLS_C_NEUTRAL=$'\e[0m'
        _TLS_C_CODE=$'\e[33m'
        _TLS_C_CONFIG=$'\e[35m'
        _TLS_C_STAGED=$'\e[32m'
        _TLS_C_MODIFIED=$'\e[33m'
        _TLS_C_UNTRACKED=$'\e[33m'
        _TLS_C_CLEAN=$'\e[2m'
        _TLS_C_HEADING=$'\e[1;36m'
    fi
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

_tls_friendly_date() {
    local mtime="$1"
    local now=$(date +%s)
    local age=$((now - mtime))

    if [[ $age -lt 60 ]]; then
        echo "just now"
    elif [[ $age -lt 3600 ]]; then
        local mins=$((age / 60))
        (( mins == 1 )) && echo "1 min ago" || echo "${mins} mins ago"
    elif [[ $age -lt 86400 ]]; then
        local hours=$((age / 3600))
        (( hours == 1 )) && echo "1 hour ago" || echo "${hours} hours ago"
    elif [[ $age -lt 172800 ]]; then
        echo "yesterday"
    elif [[ $age -lt 604800 ]]; then
        local days=$((age / 86400))
        echo "${days} days ago"
    elif [[ $age -lt 2592000 ]]; then
        local weeks=$((age / 604800))
        (( weeks == 1 )) && echo "1 week ago" || echo "${weeks} weeks ago"
    else
        date -r "$mtime" +"%b %d" 2>/dev/null || date -d "@$mtime" +"%b %d" 2>/dev/null
    fi
}

_tls_time_bucket() {
    local mtime="$1"
    local now=$(date +%s)
    local age=$((now - mtime))

    if [[ $age -lt 3600 ]]; then
        echo "hour"
    elif [[ $age -lt 86400 ]]; then
        echo "day"
    elif [[ $age -lt 604800 ]]; then
        echo "week"
    else
        echo "older"
    fi
}

_tls_human_size() {
    local bytes="$1"
    if [[ $bytes -lt 1024 ]]; then
        printf "%4dB" "$bytes"
    elif [[ $bytes -lt 1048576 ]]; then
        printf "%4.1fK" "$(echo "scale=1; $bytes/1024" | bc)"
    elif [[ $bytes -lt 1073741824 ]]; then
        printf "%4.1fM" "$(echo "scale=1; $bytes/1048576" | bc)"
    else
        printf "%4.1fG" "$(echo "scale=1; $bytes/1073741824" | bc)"
    fi
}

_tls_dir_count() {
    local dir="$1"
    local count=$(find "$dir" -maxdepth 1 -not -name ".*" -not -path "$dir" 2>/dev/null | wc -l | tr -d ' ')
    echo "$count"
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

    # Sort directories alphabetically (use readarray to avoid IFS issues)
    local sorted_dirs=()
    readarray -t sorted_dirs < <(printf '%s\n' "${dirs[@]}" | sort -f)
    dirs=("${sorted_dirs[@]}")

    # Sort recent files by mtime (newest first), then extract paths
    local sorted_recent=()
    if [[ ${#recent_files[@]} -gt 0 ]]; then
        while IFS= read -r line; do
            [[ -n "$line" ]] && sorted_recent+=("${line#*:}")
        done < <(printf '%s\n' "${recent_files[@]}" | sort -rn -t: -k1)
    fi

    # Sort older files alphabetically (use readarray to avoid IFS issues)
    local sorted_files=()
    readarray -t sorted_files < <(printf '%s\n' "${files[@]}" | sort -f)
    files=("${sorted_files[@]}")

    if [[ ${#dirs[@]} -eq 0 && ${#sorted_recent[@]} -eq 0 && ${#files[@]} -eq 0 ]]; then
        printf "%sNo files found%s\n" "$_TLS_C_DIM" "$_TLS_C_RESET"
        return
    fi

    if [[ "$show_long" == "true" ]]; then
        # Long format with timestamps
        _tls_list_long "$path" "$annotate"
    else
        # Rich default view with size/count and relative time
        _tls_list_rich dirs sorted_recent files
    fi
}

# Rich default view with details
_tls_list_rich() {
    local -n _dirs=$1
    local -n _recent=$2
    local -n _older=$3

    # Print directories with item counts
    if [[ ${#_dirs[@]} -gt 0 ]]; then
        for entry in "${_dirs[@]}"; do
            local name=$(basename "$entry")
            local count=$(_tls_dir_count "$entry")
            local mtime=$(stat -f %m "$entry" 2>/dev/null || echo 0)
            local ftime=$(_tls_friendly_date "$mtime")
            local tcolor=$(_tls_time_color "$mtime")

            printf "  %s%-24s%s %s%3d items%s  %s%s%s\n" \
                "$_TLS_C_DIR_BOLD" "${name}/" "$_TLS_C_RESET" \
                "$_TLS_C_DIM" "$count" "$_TLS_C_RESET" \
                "$tcolor" "$ftime" "$_TLS_C_RESET"
        done
    fi

    # Print recent files with size and time
    if [[ ${#_recent[@]} -gt 0 ]]; then
        [[ ${#_dirs[@]} -gt 0 ]] && printf "\n"
        printf "%s── recent ──%s\n" "$_TLS_C_DIM" "$_TLS_C_RESET"
        for entry in "${_recent[@]}"; do
            local name=$(basename "$entry")
            local size=$(stat -f %z "$entry" 2>/dev/null || echo 0)
            local hsize=$(_tls_human_size "$size")
            local mtime=$(stat -f %m "$entry" 2>/dev/null || echo 0)
            local ftime=$(_tls_friendly_date "$mtime")
            local tcolor=$(_tls_time_color "$mtime")
            local ncolor=$(_tls_name_color "$entry")

            printf "  %s%-24s%s %s%s%s  %s%s%s\n" \
                "$ncolor" "$name" "$_TLS_C_RESET" \
                "$_TLS_C_DIM" "$hsize" "$_TLS_C_RESET" \
                "$tcolor" "$ftime" "$_TLS_C_RESET"
        done
    fi

    # Print older files with size and time
    if [[ ${#_older[@]} -gt 0 ]]; then
        [[ ${#_dirs[@]} -gt 0 || ${#_recent[@]} -gt 0 ]] && printf "\n"
        for entry in "${_older[@]}"; do
            local name=$(basename "$entry")
            local size=$(stat -f %z "$entry" 2>/dev/null || echo 0)
            local hsize=$(_tls_human_size "$size")
            local mtime=$(stat -f %m "$entry" 2>/dev/null || echo 0)
            local ftime=$(_tls_friendly_date "$mtime")
            local tcolor=$(_tls_time_color "$mtime")
            local ncolor=$(_tls_name_color "$entry")

            printf "  %s%-24s%s %s%s%s  %s%s%s\n" \
                "$ncolor" "$name" "$_TLS_C_RESET" \
                "$_TLS_C_DIM" "$hsize" "$_TLS_C_RESET" \
                "$tcolor" "$ftime" "$_TLS_C_RESET"
        done
    fi
}

# Get time-based color for an mtime
_tls_time_color() {
    local mtime="$1"
    local now=$(date +%s)
    local age=$((now - mtime))

    if [[ $age -lt 3600 ]]; then
        echo "$_TLS_C_HOT"
    elif [[ $age -lt 86400 ]]; then
        echo "$_TLS_C_WARM"
    elif [[ $age -lt 604800 ]]; then
        echo "$_TLS_C_NEUTRAL"
    else
        echo "$_TLS_C_DIM"
    fi
}

# Get name color based on file type
_tls_name_color() {
    local path="$1"
    local name=$(basename "$path")

    if [[ -d "$path" ]]; then
        echo "$_TLS_C_DIR"
    elif [[ "$name" == *.sh ]]; then
        echo "$_TLS_C_CODE"
    elif [[ "$name" == *.md ]]; then
        echo "$_TLS_C_DIR"
    elif [[ "$name" == *.toml || "$name" == *.json || "$name" == *.yaml || "$name" == *.yml ]]; then
        echo "$_TLS_C_CONFIG"
    elif [[ -x "$path" ]]; then
        echo "$_TLS_C_EXEC"
    else
        echo ""
    fi
}

# Long format listing with size/count
_tls_list_long() {
    local path="${1:-.}"
    local annotate="${2:-false}"

    _tls_init_colors

    local entries=()
    while IFS= read -r line; do
        [[ -n "$line" ]] && entries+=("${line#* }")
    done < <(find "$path" -maxdepth 1 -not -name ".*" -not -path "$path" -exec stat -f '%m %N' {} \; 2>/dev/null | sort -rn)

    # Header
    printf "%s  %-16s  %-9s  " "$_TLS_C_HEADING" "Modified" "Size"
    [[ "$annotate" == "true" ]] && printf "Git "
    printf "Name%s\n" "$_TLS_C_RESET"
    printf "%s──────────────────────────────────────────────────────────────────%s\n" "$_TLS_C_DIM" "$_TLS_C_RESET"

    for file in "${entries[@]}"; do
        [[ ! -e "$file" ]] && continue
        local mtime=$(stat -f %m "$file" 2>/dev/null)

        printf "  "
        _tls_format_time "$mtime"
        printf "  "

        # Size column: item count for dirs, file size for files
        if [[ -d "$file" ]]; then
            local count=$(_tls_dir_count "$file")
            printf "%s%4d items%s  " "$_TLS_C_DIM" "$count" "$_TLS_C_RESET"
        else
            local size=$(stat -f %z "$file" 2>/dev/null || echo 0)
            local hsize=$(_tls_human_size "$size")
            printf "%s%9s%s  " "$_TLS_C_DIM" "$hsize" "$_TLS_C_RESET"
        fi

        [[ "$annotate" == "true" ]] && _tls_git_annotation "$file"
        _tls_format_name "$file"
        printf "\n"
    done
}

# Tree format listing with time-grouped hierarchy
_tls_tree() {
    local path="${1:-.}"
    local show_all="${2:-false}"

    _tls_init_colors

    # Bucket labels and colors
    declare -A bucket_label=(
        [hour]="Last Hour"
        [day]="Today"
        [week]="This Week"
        [older]="Older"
    )
    declare -A bucket_color=(
        [hour]="$_TLS_C_HOT"
        [day]="$_TLS_C_WARM"
        [week]="$_TLS_C_NEUTRAL"
        [older]="$_TLS_C_DIM"
    )

    # Collect files with mtimes
    local -A bucket_files=()
    local buckets=("hour" "day" "week" "older")

    for b in "${buckets[@]}"; do
        bucket_files[$b]=""
    done

    while IFS= read -r -d '' entry; do
        [[ "$entry" == "$path" ]] && continue
        local name=$(basename "$entry")
        [[ "$name" == .* ]] && [[ "$show_all" != "true" ]] && continue

        local mtime=$(stat -f %m "$entry" 2>/dev/null || echo 0)
        local bucket=$(_tls_time_bucket "$mtime")
        bucket_files[$bucket]+="$mtime:$entry"$'\n'
    done < <(find "$path" -maxdepth 1 -print0 2>/dev/null)

    # Print header
    printf "%s%s%s\n" "$_TLS_C_HEADING" "${path}" "$_TLS_C_RESET"

    local found_any=false

    for bucket in "${buckets[@]}"; do
        [[ -z "${bucket_files[$bucket]}" ]] && continue
        found_any=true

        # Sort entries in bucket by mtime (newest first)
        local sorted_entries=()
        while IFS= read -r line; do
            [[ -n "$line" ]] && sorted_entries+=("${line#*:}")
        done < <(printf '%s' "${bucket_files[$bucket]}" | sort -rn -t: -k1)

        local count=${#sorted_entries[@]}
        local color="${bucket_color[$bucket]}"
        local label="${bucket_label[$bucket]}"

        # Bucket header
        printf "%s├── %s%s%s (%d)%s\n" "$_TLS_C_DIM" "$color" "$label" "$_TLS_C_DIM" "$count" "$_TLS_C_RESET"

        local i=0
        for entry in "${sorted_entries[@]}"; do
            ((i++))
            local mtime=$(stat -f %m "$entry" 2>/dev/null || echo 0)
            local friendly=$(_tls_friendly_date "$mtime")
            local is_last=$(( i == count ))

            # Tree branch character
            local branch="├──"
            local prefix="│   "
            [[ $is_last == 1 ]] && branch="└──" && prefix="    "

            printf "%s│   %s%s " "$_TLS_C_DIM" "$branch" "$_TLS_C_RESET"
            _tls_format_name_simple "$entry"
            printf " %s%s%s\n" "$color" "$friendly" "$_TLS_C_RESET"
        done
    done

    [[ "$found_any" == "false" ]] && printf "%s└── (empty)%s\n" "$_TLS_C_DIM" "$_TLS_C_RESET"
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
            [[ -d "$TLS_DIR/config" ]] || mkdir -p "$TLS_DIR/config"
            cat > "$TLS_CONFIG_FILE" << EOF
# TLS configuration - generated $(date +%Y-%m-%d)
TLS_LIMIT="$TLS_LIMIT"
TLS_DATE_FORMAT="$TLS_DATE_FORMAT"
TLS_SHOW_HIDDEN="$TLS_SHOW_HIDDEN"
TLS_THEME="$TLS_THEME"
TLS_COLUMNS="$TLS_COLUMNS"
EOF
            echo "Saved to $TLS_CONFIG_FILE"
            ;;
        load)
            if [[ -f "$TLS_CONFIG_FILE" ]]; then
                source "$TLS_CONFIG_FILE"
                echo "Loaded from $TLS_CONFIG_FILE"
            else
                echo "No config file at $TLS_CONFIG_FILE"
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

    # Init colors for help output
    _tls_init_colors

    local h="$_TLS_C_HEADING"  # headings
    local c="$_TLS_C_CODE"     # commands/code
    local d="$_TLS_C_DIM"      # dim/descriptions
    local r="$_TLS_C_RESET"
    local b="$_TLS_C_BOLD"

    case "$topic" in
        list)
            printf "%stls list%s - List directory contents\n\n" "$h" "$r"
            printf "%sUSAGE:%s\n" "$b" "$r"
            printf "    %stls list%s [options] [path]\n" "$c" "$r"
            printf "    %stls%s [path]              %s(list is default)%s\n\n" "$c" "$r" "$d" "$r"
            printf "%sOPTIONS:%s\n" "$b" "$r"
            printf "    %s-l%s    Long format with timestamps\n" "$c" "$r"
            printf "    %s-a%s    Show git status annotations (with -l)\n\n" "$c" "$r"
            printf "%sOUTPUT:%s\n" "$b" "$r"
            printf "    Default: multi-column like ls\n"
            printf "      %s- Directories first (bold, sorted alphabetically)%s\n" "$d" "$r"
            printf "      %s- Recent files (< 24h, sorted by time, newest first)%s\n" "$d" "$r"
            printf "      %s- Older files (sorted alphabetically)%s\n\n" "$d" "$r"
            printf "    Long (%s-l%s): single column with timestamps\n" "$c" "$r"
            printf "      %s- All entries sorted by modification time%s\n" "$d" "$r"
            ;;
        config)
            printf "%stls config%s - Manage tls configuration\n\n" "$h" "$r"
            printf "%sUSAGE:%s\n" "$b" "$r"
            printf "    %stls config show%s           Show all settings\n" "$c" "$r"
            printf "    %stls config list%s           List available keys\n" "$c" "$r"
            printf "    %stls config get%s <key>      Get a setting\n" "$c" "$r"
            printf "    %stls config set%s <key> <v>  Set a setting\n" "$c" "$r"
            printf "    %stls config save%s           Save to config file\n" "$c" "$r"
            printf "    %stls config load%s           Load from config file\n" "$c" "$r"
            printf "    %stls config path%s           Show config directory\n\n" "$c" "$r"
            printf "%sKEYS:%s\n" "$b" "$r"
            printf "    %slimit%s        Number of entries for -l mode %s(default: 20)%s\n" "$c" "$r" "$d" "$r"
            printf "    %sdate_format%s  strftime format %s(default: %%Y-%%m-%%d %%H:%%M)%s\n" "$c" "$r" "$d" "$r"
            printf "    %sshow_hidden%s  Show hidden files %s(default: false)%s\n" "$c" "$r" "$d" "$r"
            printf "    %stheme%s        Color theme %s(default: default)%s\n" "$c" "$r" "$d" "$r"
            printf "    %scolumns%s      Column mode: auto or number %s(default: auto)%s\n" "$c" "$r" "$d" "$r"
            ;;
        colors)
            printf "%stls colors%s - Time-based color coding\n\n" "$h" "$r"
            printf "%sTIME COLORS%s (age of file):\n" "$b" "$r"
            printf "    %sGreen%s   = less than 1 hour (hot)\n" "$_TLS_C_HOT" "$r"
            printf "    %sYellow%s  = less than 1 day (warm)\n" "$_TLS_C_WARM" "$r"
            printf "    %sWhite%s   = less than 1 week (neutral)\n" "$_TLS_C_NEUTRAL" "$r"
            printf "    %sDim%s     = older (cool)\n\n" "$_TLS_C_DIM" "$r"
            printf "%sTYPE INDICATORS:%s\n" "$b" "$r"
            printf "    %sd%s = directory\n" "$_TLS_C_DIR" "$r"
            printf "    %sx%s = executable\n" "$_TLS_C_EXEC" "$r"
            printf "    %sl%s = symlink\n" "$_TLS_C_LINK" "$r"
            printf "    . = regular file\n\n"
            printf "%sGIT ANNOTATIONS%s (with -a):\n" "$b" "$r"
            printf "    %s+%s  = staged\n" "$_TLS_C_STAGED" "$r"
            printf "    %sM%s  = modified\n" "$_TLS_C_MODIFIED" "$r"
            printf "    %s?%s  = untracked\n" "$_TLS_C_UNTRACKED" "$r"
            printf "    %s·%s  = clean\n" "$_TLS_C_CLEAN" "$r"
            ;;
        tree)
            printf "%stls -t%s - Hierarchical time-grouped view\n\n" "$h" "$r"
            printf "%sUSAGE:%s\n" "$b" "$r"
            printf "    %stls -t%s [path]\n" "$c" "$r"
            printf "    %stls --tree%s [path]\n\n" "$c" "$r"
            printf "%sOUTPUT:%s\n" "$b" "$r"
            printf "    Files grouped by modification time:\n"
            printf "    %s├── Last Hour%s     %s(< 1 hour ago)%s\n" "$_TLS_C_HOT" "$r" "$d" "$r"
            printf "    %s├── Today%s         %s(< 24 hours ago)%s\n" "$_TLS_C_WARM" "$r" "$d" "$r"
            printf "    %s├── This Week%s     %s(< 7 days ago)%s\n" "$_TLS_C_NEUTRAL" "$r" "$d" "$r"
            printf "    %s└── Older%s         %s(> 7 days ago)%s\n\n" "$_TLS_C_DIM" "$r" "$d" "$r"
            printf "%sTIME FORMAT:%s\n" "$b" "$r"
            printf "    Friendly relative times: %sjust now%s, %s5 mins ago%s, %syesterday%s, etc.\n" "$c" "$r" "$c" "$r" "$c" "$r"
            ;;
        *)
            printf "%stls%s - Time-ordered List\n\n" "$h" "$r"
            printf "%sUSAGE:%s\n" "$b" "$r"
            printf "    %stls%s [flags] [path]\n\n" "$c" "$r"
            printf "%sFLAGS:%s\n" "$b" "$r"
            printf "    %s-t%s  Tree view %s(time-grouped hierarchy)%s\n" "$c" "$r" "$d" "$r"
            printf "    %s-l%s  Long view %s(detailed timestamps)%s\n" "$c" "$r" "$d" "$r"
            printf "    %s-a%s  Show hidden files\n" "$c" "$r"
            printf "    %s-g%s  Show git status %s(with -l)%s\n\n" "$c" "$r" "$d" "$r"
            printf "%sSUBCOMMANDS:%s\n" "$b" "$r"
            printf "    %sconfig%s          Manage configuration\n" "$c" "$r"
            printf "    %shelp%s [topic]    Show help\n\n" "$c" "$r"
            printf "%sEXAMPLES:%s\n" "$b" "$r"
            printf "    %stls%s                     Rich view with sizes & times\n" "$c" "$r"
            printf "    %stls -t%s                  Time-grouped tree view\n" "$c" "$r"
            printf "    %stls -l%s                  Long format listing\n" "$c" "$r"
            printf "    %stls -lg%s                 Long with git status\n" "$c" "$r"
            printf "    %stls -ta%s                 Tree with hidden files\n" "$c" "$r"
            printf "    %stls help colors%s         Color documentation\n\n" "$c" "$r"
            ;;
    esac
}

# =============================================================================
# COLOR COMMAND
# =============================================================================

_tls_color_cmd() {
    local subcmd="${1:-show}"
    shift 2>/dev/null || true

    case "$subcmd" in
        show|preview)
            if declare -f tds_module_show >/dev/null 2>&1; then
                tds_module_show "tls"
            else
                echo "TDS module config not available"
                return 1
            fi
            ;;
        init|reset)
            if declare -f tds_module_save >/dev/null 2>&1; then
                tds_module_save "tls"
                echo "Color config reset to defaults"
            else
                echo "TDS module config not available"
                return 1
            fi
            ;;
        edit)
            local config_file
            if declare -f tds_module_config_path >/dev/null 2>&1; then
                config_file=$(tds_module_config_path "tls")
                # Create if doesn't exist
                [[ -f "$config_file" ]] || tds_module_save "tls" >/dev/null
                ${EDITOR:-vi} "$config_file"
                # Reload after edit
                tds_module_load "tls" 2>/dev/null
            else
                echo "TDS module config not available"
                return 1
            fi
            ;;
        path)
            if declare -f tds_module_config_path >/dev/null 2>&1; then
                tds_module_config_path "tls"
            else
                echo "$TLS_DIR/config/colors.conf"
            fi
            ;;
        get)
            local token="$1"
            if [[ -z "$token" ]]; then
                echo "Usage: tls color get <token>"
                return 1
            fi
            if declare -f tds_module_color >/dev/null 2>&1; then
                tds_module_color "tls" "$token"
            else
                echo "TDS module config not available"
                return 1
            fi
            ;;
        help|*)
            cat << 'EOF'
tls color - Manage color configuration

USAGE:
    tls color show          Preview current colors
    tls color edit          Open config in $EDITOR
    tls color init          Reset to defaults
    tls color path          Show config file path
    tls color get <token>   Get hex color for token

TOKENS:
    time.hot, time.warm, time.neutral, time.cool
    file.directory, file.executable, file.symlink, file.code, file.config
    git.staged, git.modified, git.untracked, git.clean
    ui.heading, ui.separator
EOF
            ;;
    esac
}

# =============================================================================
# MAIN COMMAND
# =============================================================================

tls() {
    # Subcommands that aren't listing
    case "$1" in
        config|c) shift; _tls_config "$@"; return ;;
        color)    shift; _tls_color_cmd "$@"; return ;;
        help|h)   shift; _tls_help "$@"; return ;;
    esac

    # Parse flags for listing modes
    local path="." mode="rich" show_hidden="false" annotate="false"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -t|--tree)  mode="tree"; shift ;;
            -l|--long)  mode="long"; shift ;;
            -a|--all)   show_hidden="true"; shift ;;
            -g|--git)   annotate="true"; shift ;;
            -tl|-lt)    mode="long"; shift ;;  # -t with -l = long
            -ta|-at)    mode="tree"; show_hidden="true"; shift ;;
            -la|-al)    mode="long"; show_hidden="true"; shift ;;
            -lag|-gal|-alg|-gla|-lga|-agl) mode="long"; show_hidden="true"; annotate="true"; shift ;;
            -lg|-gl)    mode="long"; annotate="true"; shift ;;
            -*)         echo "Unknown option: $1"; return 1 ;;
            *)          path="$1"; shift ;;
        esac
    done

    # Store hidden setting temporarily
    local old_hidden="$TLS_SHOW_HIDDEN"
    [[ "$show_hidden" == "true" ]] && TLS_SHOW_HIDDEN="true"

    case "$mode" in
        tree) _tls_tree "$path" "$show_hidden" ;;
        long) _tls_list "$path" "true" "$annotate" ;;
        rich) _tls_list "$path" "false" "$annotate" ;;
    esac

    TLS_SHOW_HIDDEN="$old_hidden"
}

