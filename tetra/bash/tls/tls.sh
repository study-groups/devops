#!/usr/bin/env bash

# TLS - Time-ordered List with TDS colors
# Main command implementation

# =============================================================================
# CONFIGURATION
# =============================================================================

TLS_DIR="${TLS_DIR:-${TETRA_DIR:-$HOME/.tetra}/tls}"
TLS_CONFIG_FILE="${TLS_DIR}/config/tls.conf"

[[ -d "$TLS_DIR/config" ]] || mkdir -p "$TLS_DIR/config"
[[ -f "$TLS_CONFIG_FILE" ]] && source "$TLS_CONFIG_FILE"

TLS_LIMIT="${TLS_LIMIT:-20}"
TLS_DATE_FORMAT="${TLS_DATE_FORMAT:-%Y-%m-%d %H:%M}"
TLS_SHOW_HIDDEN="${TLS_SHOW_HIDDEN:-false}"

# =============================================================================
# TDS COLOR SETUP
# =============================================================================

_TLS_HAS_TDS=false
_TLS_USE_COLOR=false

_tls_init_tds() {
    # Already loaded?
    if declare -F tds_text_color &>/dev/null; then
        _TLS_HAS_TDS=true
    elif [[ -f "${TETRA_SRC}/bash/tds/tds.sh" ]]; then
        source "${TETRA_SRC}/bash/tds/tds.sh" 2>/dev/null && _TLS_HAS_TDS=true
    fi

    # Use color if TDS available and TTY
    [[ "$_TLS_HAS_TDS" == true ]] && [[ -t 1 ]] && _TLS_USE_COLOR=true
}

# Initialize on load
_tls_init_tds

# =============================================================================
# COLOR HELPERS
# =============================================================================

# Time-based token
_tls_time_token() {
    local mtime="$1"
    local now=$(date +%s)
    local age=$((now - mtime))

    if [[ $age -lt 3600 ]]; then
        echo "status.success"      # hot - green
    elif [[ $age -lt 86400 ]]; then
        echo "status.warning"      # warm - yellow
    elif [[ $age -lt 604800 ]]; then
        echo "text.primary"        # neutral
    else
        echo "text.muted"          # old - dim
    fi
}

# File type token
_tls_file_token() {
    local path="$1"
    local name=$(basename "$path")

    if [[ -d "$path" ]]; then
        echo "action.primary"      # directories - bright
    elif [[ "$name" == *.sh ]]; then
        echo "action.secondary"    # scripts - orange
    elif [[ "$name" == *.md ]]; then
        echo "structural.primary"  # docs - teal
    elif [[ "$name" == *.toml || "$name" == *.json || "$name" == *.yaml || "$name" == *.yml ]]; then
        echo "action.focus"        # config - purple
    elif [[ -x "$path" ]]; then
        echo "status.success"      # executable - green
    else
        echo "text.primary"
    fi
}

# Git status token - uses TDS pattern registry
_tls_git_token() {
    tds_pattern_match "$1" "git" 2>/dev/null || echo "text.muted"
}

# Commit type token - uses TDS pattern registry
_tls_commit_type_token() {
    tds_pattern_match "$1" "commit" 2>/dev/null || echo "text.primary"
}

# =============================================================================
# GIT LOG COLORIZATION
# =============================================================================

# Colorize git log --oneline output from stdin
_tls_git_log_pipe() {
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        _tls_format_git_log_line "$line"
    done
}

# Format a single git log --oneline line
# Format: hash (refs) type(scope): message
# Example: cd924a6e (HEAD -> main) feat(gamma): add game spawning
_tls_format_git_log_line() {
    local line="$1"
    local hash="" refs="" rest="" type="" scope="" message=""

    # Extract hash (first word, 7-40 hex chars)
    local re_hash='^([a-f0-9]{7,40})[[:space:]]+(.*)'
    if [[ "$line" =~ $re_hash ]]; then
        hash="${BASH_REMATCH[1]}"
        rest="${BASH_REMATCH[2]}"
    else
        # No hash found, print as-is
        echo "$line"
        return
    fi

    # Extract refs if present: (HEAD -> main, origin/main)
    local re_refs='^\(([^)]+)\)[[:space:]]*(.*)'
    if [[ "$rest" =~ $re_refs ]]; then
        refs="${BASH_REMATCH[1]}"
        rest="${BASH_REMATCH[2]}"
    fi

    # Extract conventional commit type and optional scope
    # Matches: feat(scope): or feat: or just text
    local re_type='^([a-z]+)(\([^)]+\))?:[[:space:]]*(.*)'
    if [[ "$rest" =~ $re_type ]]; then
        type="${BASH_REMATCH[1]}"
        scope="${BASH_REMATCH[2]}"  # includes parens if present
        message="${BASH_REMATCH[3]}"
    else
        message="$rest"
    fi

    # Build colorized output
    if [[ "$_TLS_USE_COLOR" == true ]]; then
        # Hash - muted
        tds_text_color "text.muted"
        printf '%s' "$hash"
        reset_color
        printf ' '

        # Refs if present
        if [[ -n "$refs" ]]; then
            printf '('
            _tls_format_refs "$refs"
            printf ') '
        fi

        # Commit type if present
        if [[ -n "$type" ]]; then
            local token=$(_tls_commit_type_token "$type")
            tds_text_color "$token"
            printf '%s' "$type"
            reset_color
            # Scope in dimmer shade
            if [[ -n "$scope" ]]; then
                tds_text_color "text.tertiary"
                printf '%s' "$scope"
                reset_color
            fi
            tds_text_color "text.muted"
            printf ':'
            reset_color
            printf ' '
        fi

        # Message
        tds_text_color "text.primary"
        printf '%s' "$message"
        reset_color
        printf '\n'
    else
        # No color - print original
        echo "$line"
    fi
}

# Format refs like "HEAD -> main, origin/main, origin/HEAD"
_tls_format_refs() {
    local refs="$1"
    local first=true
    local re_head_branch='HEAD[[:space:]]*->[[:space:]]*(.*)'

    # Split on comma
    IFS=',' read -ra parts <<< "$refs"
    for part in "${parts[@]}"; do
        part="${part## }"  # trim leading space
        part="${part%% }"  # trim trailing space

        [[ "$first" == true ]] || printf ', '
        first=false

        if [[ "$part" == HEAD* ]]; then
            # HEAD -> branch
            tds_text_color "status.error"
            printf 'HEAD'
            reset_color
            if [[ "$part" =~ $re_head_branch ]]; then
                tds_text_color "text.muted"
                printf ' -> '
                reset_color
                tds_text_color "status.success"
                printf '%s' "${BASH_REMATCH[1]}"
                reset_color
            fi
        elif [[ "$part" == origin/* ]]; then
            # Remote branch
            tds_text_color "status.warning"
            printf '%s' "$part"
            reset_color
        elif [[ "$part" == tag:* ]]; then
            # Tag
            tds_text_color "action.focus"
            printf '%s' "$part"
            reset_color
        else
            # Local branch
            tds_text_color "status.success"
            printf '%s' "$part"
            reset_color
        fi
    done
}

# =============================================================================
# CORE FUNCTIONS
# =============================================================================

_tls_format_time() {
    local mtime="$1"
    local formatted=$(date -r "$mtime" +"$TLS_DATE_FORMAT" 2>/dev/null || date -d "@$mtime" +"$TLS_DATE_FORMAT" 2>/dev/null)

    if [[ "$_TLS_USE_COLOR" == true ]]; then
        local token=$(_tls_time_token "$mtime")
        tds_text_color "$token"
        printf '%s' "$formatted"
        reset_color
    else
        printf '%s' "$formatted"
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

# Format a single file path (for pipe mode)
_tls_format_path() {
    local path="$1"
    local annotate="${2:-false}"
    [[ ! -e "$path" ]] && { echo "$path"; return; }

    local name=$(basename "$path")
    local mtime=$(stat -f %m "$path" 2>/dev/null || echo 0)
    local ftime=$(_tls_friendly_date "$mtime")

    if [[ "$_TLS_USE_COLOR" == true ]]; then
        local file_token=$(_tls_file_token "$path")
        local time_token=$(_tls_time_token "$mtime")

        printf "  "
        [[ "$annotate" == "true" ]] && _tls_git_annotation "$path"
        tds_text_color "$file_token"
        if [[ -d "$path" ]]; then
            printf "%-30s" "${name}/"
        else
            printf "%-30s" "$name"
        fi
        reset_color
        printf "  "
        tds_text_color "$time_token"
        printf "%s" "$ftime"
        reset_color
        printf "\n"
    else
        printf "  "
        [[ "$annotate" == "true" ]] && _tls_git_annotation "$path"
        if [[ -d "$path" ]]; then
            printf "%-30s  %s\n" "${name}/" "$ftime"
        else
            printf "%-30s  %s\n" "$name" "$ftime"
        fi
    fi
}

# Read file paths from stdin and format with tls styling
_tls_pipe() {
    local show_long="${1:-false}"
    local annotate="${2:-false}"

    if [[ "$show_long" == "true" ]]; then
        # Print header for long format
        if [[ "$_TLS_USE_COLOR" == true ]]; then
            tds_text_color "structural.primary"
            printf "  "
            [[ "$annotate" == "true" ]] && printf "Git "
            printf "%-16s  %-9s  Name\n" "Modified" "Size"
            reset_color
            tds_text_color "text.dim"
            printf "──────────────────────────────────────────────────────────────────\n"
            reset_color
        else
            printf "  "
            [[ "$annotate" == "true" ]] && printf "Git "
            printf "%-16s  %-9s  Name\n" "Modified" "Size"
            printf "──────────────────────────────────────────────────────────────────\n"
        fi
    fi

    while IFS= read -r path; do
        [[ -z "$path" ]] && continue
        if [[ "$show_long" == "true" ]]; then
            _tls_format_path_long "$path" "$annotate"
        else
            _tls_format_path "$path" "$annotate"
        fi
    done
}

# Format a single file path in long format (for pipe mode)
_tls_format_path_long() {
    local path="$1"
    local annotate="${2:-false}"

    if [[ ! -e "$path" ]]; then
        printf "  "
        [[ "$annotate" == "true" ]] && printf "    "
        printf "%-16s  %9s  %s\n" "?" "?" "$path"
        return
    fi

    local mtime=$(stat -f %m "$path" 2>/dev/null || echo 0)
    local name=$(basename "$path")

    printf "  "
    [[ "$annotate" == "true" ]] && _tls_git_annotation "$path"
    _tls_format_time "$mtime"
    printf "  "

    if [[ -d "$path" ]]; then
        local count=$(_tls_dir_count "$path")
        if [[ "$_TLS_USE_COLOR" == true ]]; then
            tds_text_color "text.muted"
            printf "%4d items" "$count"
            reset_color
        else
            printf "%4d items" "$count"
        fi
    else
        local size=$(stat -f %z "$path" 2>/dev/null || echo 0)
        local hsize=$(_tls_human_size "$size")
        if [[ "$_TLS_USE_COLOR" == true ]]; then
            tds_text_color "text.muted"
            printf "%9s" "$hsize"
            reset_color
        else
            printf "%9s" "$hsize"
        fi
    fi

    printf "  "
    _tls_format_name "$path"
    echo
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
    find "$dir" -maxdepth 1 -not -name ".*" -not -path "$dir" 2>/dev/null | wc -l | tr -d ' '
}

_tls_format_name() {
    local path="$1"
    local name=$(basename "$path")
    local suffix=""
    [[ -d "$path" ]] && suffix="/"

    if [[ "$_TLS_USE_COLOR" == true ]]; then
        local token=$(_tls_file_token "$path")
        tds_text_color "$token"
        printf '%s%s' "$name" "$suffix"
        reset_color
    else
        printf '%s%s' "$name" "$suffix"
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
    local symbol=" · " git_status="clean"

    if [[ -z "$status" ]]; then
        symbol=" · "; git_status="clean"
    elif [[ "$status" =~ ^[MADRC] ]]; then
        symbol=" + "; git_status="staged"
    elif [[ "$status" =~ ^.M ]]; then
        symbol=" M "; git_status="modified"
    elif [[ "$status" =~ ^\?\? ]]; then
        symbol=" ? "; git_status="untracked"
    else
        printf "   "; return
    fi

    if [[ "$_TLS_USE_COLOR" == true ]]; then
        local token=$(_tls_git_token "$git_status")
        tds_text_color "$token"
        printf '%s' "$symbol"
        reset_color
    else
        printf '%s' "$symbol"
    fi
}

_tls_name_width() {
    local path="$1"
    local name=$(basename "$path")
    [[ -d "$path" ]] && echo $((${#name} + 1)) || echo "${#name}"
}

# =============================================================================
# LIST FUNCTIONS
# =============================================================================

_tls_list() {
    local path="${1:-.}"
    local show_long="${2:-false}"
    local annotate="${3:-false}"

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

    # Sort
    local sorted_dirs=()
    readarray -t sorted_dirs < <(printf '%s\n' "${dirs[@]}" | sort -f)
    dirs=("${sorted_dirs[@]}")

    local sorted_recent=()
    if [[ ${#recent_files[@]} -gt 0 ]]; then
        while IFS= read -r line; do
            [[ -n "$line" ]] && sorted_recent+=("${line#*:}")
        done < <(printf '%s\n' "${recent_files[@]}" | sort -rn -t: -k1)
    fi

    local sorted_files=()
    readarray -t sorted_files < <(printf '%s\n' "${files[@]}" | sort -f)
    files=("${sorted_files[@]}")

    if [[ ${#dirs[@]} -eq 0 && ${#sorted_recent[@]} -eq 0 && ${#files[@]} -eq 0 ]]; then
        if [[ "$_TLS_USE_COLOR" == true ]]; then
            tds_text_color "text.muted"
            echo "No files found"
            reset_color
        else
            echo "No files found"
        fi
        return
    fi

    if [[ "$show_long" == "true" ]]; then
        _tls_list_long "$path" "$annotate"
    else
        _tls_list_rich dirs sorted_recent files
    fi
}

_tls_list_rich() {
    local -n _dirs=$1
    local -n _recent=$2
    local -n _older=$3

    # Directories
    for entry in "${_dirs[@]}"; do
        local name=$(basename "$entry")
        local count=$(_tls_dir_count "$entry")
        local mtime=$(stat -f %m "$entry" 2>/dev/null || echo 0)
        local ftime=$(_tls_friendly_date "$mtime")

        printf "  "
        if [[ "$_TLS_USE_COLOR" == true ]]; then
            tds_text_color "action.primary"
            printf "%-24s" "${name}/"
            reset_color
            tds_text_color "text.muted"
            printf " %3d items  " "$count"
            local token=$(_tls_time_token "$mtime")
            tds_text_color "$token"
            printf "%s" "$ftime"
            reset_color
        else
            printf "%-24s %3d items  %s" "${name}/" "$count" "$ftime"
        fi
        echo
    done

    # Recent files
    if [[ ${#_recent[@]} -gt 0 ]]; then
        [[ ${#_dirs[@]} -gt 0 ]] && echo
        if [[ "$_TLS_USE_COLOR" == true ]]; then
            tds_text_color "text.muted"
            echo "── recent ──"
            reset_color
        else
            echo "── recent ──"
        fi
        for entry in "${_recent[@]}"; do
            _tls_print_file_line "$entry"
        done
    fi

    # Older files
    if [[ ${#_older[@]} -gt 0 ]]; then
        [[ ${#_dirs[@]} -gt 0 || ${#_recent[@]} -gt 0 ]] && echo
        for entry in "${_older[@]}"; do
            _tls_print_file_line "$entry"
        done
    fi
}

_tls_print_file_line() {
    local entry="$1"
    local name=$(basename "$entry")
    local size=$(stat -f %z "$entry" 2>/dev/null || echo 0)
    local hsize=$(_tls_human_size "$size")
    local mtime=$(stat -f %m "$entry" 2>/dev/null || echo 0)
    local ftime=$(_tls_friendly_date "$mtime")

    printf "  "
    if [[ "$_TLS_USE_COLOR" == true ]]; then
        local name_token=$(_tls_file_token "$entry")
        tds_text_color "$name_token"
        printf "%-24s" "$name"
        reset_color
        tds_text_color "text.muted"
        printf " %s  " "$hsize"
        local time_token=$(_tls_time_token "$mtime")
        tds_text_color "$time_token"
        printf "%s" "$ftime"
        reset_color
    else
        printf "%-24s %s  %s" "$name" "$hsize" "$ftime"
    fi
    echo
}

_tls_list_long() {
    local path="${1:-.}"
    local annotate="${2:-false}"

    local entries=()
    while IFS= read -r line; do
        [[ -n "$line" ]] && entries+=("${line#* }")
    done < <(find "$path" -maxdepth 1 -not -name ".*" -not -path "$path" -exec stat -f '%m %N' {} \; 2>/dev/null | sort -rn)

    # Header
    if [[ "$_TLS_USE_COLOR" == true ]]; then
        tds_text_color "structural.primary"
        printf "  %-16s  %-9s  " "Modified" "Size"
        [[ "$annotate" == "true" ]] && printf "Git "
        printf "Name"
        reset_color
        echo
        tds_text_color "text.dim"
        printf "──────────────────────────────────────────────────────────────────"
        reset_color
        echo
    else
        printf "  %-16s  %-9s  " "Modified" "Size"
        [[ "$annotate" == "true" ]] && printf "Git "
        echo "Name"
        echo "──────────────────────────────────────────────────────────────────"
    fi

    for file in "${entries[@]}"; do
        [[ ! -e "$file" ]] && continue
        local mtime=$(stat -f %m "$file" 2>/dev/null)

        printf "  "
        _tls_format_time "$mtime"
        printf "  "

        if [[ -d "$file" ]]; then
            local count=$(_tls_dir_count "$file")
            if [[ "$_TLS_USE_COLOR" == true ]]; then
                tds_text_color "text.muted"
                printf "%4d items" "$count"
                reset_color
            else
                printf "%4d items" "$count"
            fi
        else
            local size=$(stat -f %z "$file" 2>/dev/null || echo 0)
            local hsize=$(_tls_human_size "$size")
            if [[ "$_TLS_USE_COLOR" == true ]]; then
                tds_text_color "text.muted"
                printf "%9s" "$hsize"
                reset_color
            else
                printf "%9s" "$hsize"
            fi
        fi

        printf "  "
        [[ "$annotate" == "true" ]] && _tls_git_annotation "$file"
        _tls_format_name "$file"
        echo
    done
}

_tls_tree() {
    local path="${1:-.}"
    local show_all="${2:-false}"

    declare -A bucket_label=(
        [hour]="Last Hour"
        [day]="Today"
        [week]="This Week"
        [older]="Older"
    )
    declare -A bucket_token=(
        [hour]="status.success"
        [day]="status.warning"
        [week]="text.primary"
        [older]="text.muted"
    )

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

    # Header
    if [[ "$_TLS_USE_COLOR" == true ]]; then
        tds_text_color "structural.primary"
        printf '%s' "$path"
        reset_color
    else
        printf '%s' "$path"
    fi
    echo

    local found_any=false

    for bucket in "${buckets[@]}"; do
        [[ -z "${bucket_files[$bucket]}" ]] && continue
        found_any=true

        local sorted_entries=()
        while IFS= read -r line; do
            [[ -n "$line" ]] && sorted_entries+=("${line#*:}")
        done < <(printf '%s' "${bucket_files[$bucket]}" | sort -rn -t: -k1)

        local count=${#sorted_entries[@]}
        local token="${bucket_token[$bucket]}"
        local label="${bucket_label[$bucket]}"

        # Bucket header
        if [[ "$_TLS_USE_COLOR" == true ]]; then
            tds_text_color "text.muted"
            printf "├── "
            tds_text_color "$token"
            printf "%s" "$label"
            tds_text_color "text.muted"
            printf " (%d)" "$count"
            reset_color
        else
            printf "├── %s (%d)" "$label" "$count"
        fi
        echo

        local i=0
        for entry in "${sorted_entries[@]}"; do
            ((i++))
            local mtime=$(stat -f %m "$entry" 2>/dev/null || echo 0)
            local friendly=$(_tls_friendly_date "$mtime")
            local is_last=$(( i == count ))
            local branch="├──"
            [[ $is_last == 1 ]] && branch="└──"

            if [[ "$_TLS_USE_COLOR" == true ]]; then
                tds_text_color "text.muted"
                printf "│   %s " "$branch"
                reset_color
                _tls_format_name "$entry"
                printf " "
                tds_text_color "$token"
                printf "%s" "$friendly"
                reset_color
            else
                printf "│   %s " "$branch"
                printf "%s " "$(basename "$entry")"
                printf "%s" "$friendly"
            fi
            echo
        done
    done

    if [[ "$found_any" == "false" ]]; then
        if [[ "$_TLS_USE_COLOR" == true ]]; then
            tds_text_color "text.muted"
            echo "└── (empty)"
            reset_color
        else
            echo "└── (empty)"
        fi
    fi
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
            echo "  config_dir  = $TLS_DIR"
            ;;
        get)
            local key="$1"
            case "$key" in
                limit)       echo "$TLS_LIMIT" ;;
                date_format) echo "$TLS_DATE_FORMAT" ;;
                show_hidden) echo "$TLS_SHOW_HIDDEN" ;;
                *) echo "Unknown key: $key"; return 1 ;;
            esac
            ;;
        set)
            local key="$1" val="$2"
            case "$key" in
                limit)       export TLS_LIMIT="$val" ;;
                date_format) export TLS_DATE_FORMAT="$val" ;;
                show_hidden) export TLS_SHOW_HIDDEN="$val" ;;
                *) echo "Unknown key: $key"; return 1 ;;
            esac
            echo "$key = $val"
            ;;
        save)
            [[ -d "$TLS_DIR/config" ]] || mkdir -p "$TLS_DIR/config"
            cat > "$TLS_CONFIG_FILE" << EOF
TLS_LIMIT="$TLS_LIMIT"
TLS_DATE_FORMAT="$TLS_DATE_FORMAT"
TLS_SHOW_HIDDEN="$TLS_SHOW_HIDDEN"
EOF
            echo "Saved to $TLS_CONFIG_FILE"
            ;;
        *) echo "Usage: tls config {show|get|set|save}"; return 1 ;;
    esac
}

# =============================================================================
# HELP COMMAND
# =============================================================================

_tls_help() {
    if [[ "$_TLS_USE_COLOR" == true ]]; then
        tds_text_color "structural.primary"
        echo "tls - Time-ordered List"
        reset_color
        echo
        tds_text_color "text.primary"
        echo "USAGE:"
        reset_color
        echo "    tls [flags] [path]"
        echo "    command | tls -     (file pipe mode)"
        echo "    git log | tls -L    (git log colorizer)"
        echo
        tds_text_color "text.primary"
        echo "FLAGS:"
        reset_color
        echo "    -t  Tree view (time-grouped)"
        echo "    -l  Long view (detailed)"
        echo "    -a  Show hidden files"
        echo "    -g  Show git status"
        echo "    -   Read paths from stdin (pipe mode)"
        echo "    -L  Colorize git log --oneline output"
        echo
        tds_text_color "text.primary"
        echo "PIPE SHORTCUTS:"
        reset_color
        echo "    -l-   Long format pipe      -g-   Git status pipe"
        echo "    -lg-  Long + git pipe       -gl-  Same as -lg-"
        echo
        tds_text_color "text.primary"
        echo "EXAMPLES:"
        reset_color
        echo "    tls                       List current directory"
        echo "    tls -lg                   Long format with git status"
        echo "    mf core | tls -           Pipe file list through tls"
        echo "    git log --oneline | tls -L  Colorize git log"
        echo
        tds_text_color "text.primary"
        echo "COMMIT TYPES:"
        reset_color
        echo "    feat (green)    fix (orange)   refactor (blue)"
        echo "    docs (purple)   test (teal)    chore (muted)"
        echo
        tds_text_color "text.primary"
        echo "SUBCOMMANDS:"
        reset_color
        echo "    config  Manage configuration"
        echo "    help    Show this help"
    else
        echo "tls - Time-ordered List"
        echo
        echo "USAGE:"
        echo "    tls [flags] [path]"
        echo "    command | tls -     (file pipe mode)"
        echo "    git log | tls -L    (git log colorizer)"
        echo
        echo "FLAGS:"
        echo "    -t  Tree view    -l  Long view"
        echo "    -a  Hidden       -g  Git status"
        echo "    -   Pipe mode    -L  Git log colorizer"
        echo
        echo "PIPE SHORTCUTS:"
        echo "    -l-  Long pipe   -g-  Git pipe   -lg-  Long+git pipe"
        echo
        echo "EXAMPLES:"
        echo "    mf core | tls -             Pipe with default format"
        echo "    git log --oneline | tls -L  Colorize git log"
        echo
        echo "SUBCOMMANDS: config, help"
    fi
}

# =============================================================================
# MAIN COMMAND
# =============================================================================

tls() {
    case "$1" in
        config|c) shift; _tls_config "$@"; return ;;
        help|h)   shift; _tls_help "$@"; return ;;
    esac

    local path="." mode="rich" show_hidden="false" annotate="false" pipe_mode="false" log_mode="false"

    while [[ $# -gt 0 ]]; do
        case "$1" in
            -|--pipe)   pipe_mode="true"; shift ;;
            -t|--tree)  mode="tree"; shift ;;
            -l|--long)  mode="long"; shift ;;
            -a|--all)   show_hidden="true"; shift ;;
            -g|--git)   annotate="true"; shift ;;
            -L|--log)   log_mode="true"; pipe_mode="true"; shift ;;
            -tl|-lt)    mode="long"; shift ;;
            -ta|-at)    mode="tree"; show_hidden="true"; shift ;;
            -la|-al)    mode="long"; show_hidden="true"; shift ;;
            -lg|-gl)    mode="long"; annotate="true"; shift ;;
            # Pipe mode shortcuts
            -l-)        mode="long"; pipe_mode="true"; shift ;;
            -g-)        annotate="true"; pipe_mode="true"; shift ;;
            -lg-|-gl-)  mode="long"; annotate="true"; pipe_mode="true"; shift ;;
            -*)         echo "Unknown option: $1"; return 1 ;;
            *)          path="$1"; shift ;;
        esac
    done

    # Pipe mode: read from stdin
    if [[ "$pipe_mode" == "true" ]]; then
        if [[ "$log_mode" == "true" ]]; then
            _tls_git_log_pipe
        else
            local long_flag="false"
            [[ "$mode" == "long" ]] && long_flag="true"
            _tls_pipe "$long_flag" "$annotate"
        fi
        return
    fi

    local old_hidden="$TLS_SHOW_HIDDEN"
    [[ "$show_hidden" == "true" ]] && TLS_SHOW_HIDDEN="true"

    case "$mode" in
        tree) _tls_tree "$path" "$show_hidden" ;;
        long) _tls_list "$path" "true" "$annotate" ;;
        rich) _tls_list "$path" "false" "$annotate" ;;
    esac

    TLS_SHOW_HIDDEN="$old_hidden"
}
