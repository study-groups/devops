#!/usr/bin/env bash
# mf render - format, rank, and display search results

# Color codes (empty if no tty)
_mf_init_colors() {
    if [[ -t 1 ]]; then
        MF_C_RESET=$'\e[0m'
        MF_C_DIM=$'\e[2m'
        MF_C_BOLD=$'\e[1m'
        MF_C_CYAN=$'\e[36m'
        MF_C_YELLOW=$'\e[33m'
        MF_C_GREEN=$'\e[32m'
        MF_C_BLUE=$'\e[34m'
    else
        MF_C_RESET="" MF_C_DIM="" MF_C_BOLD=""
        MF_C_CYAN="" MF_C_YELLOW="" MF_C_GREEN="" MF_C_BLUE=""
    fi
}

# Human-readable relative date
_mf_human_date() {
    local filepath="$1"
    local mtime
    mtime=$(stat -f %m "$filepath" 2>/dev/null) || return
    local now
    now=$(date +%s)
    local diff=$((now - mtime))

    if ((diff < 60)); then
        echo "just now"
    elif ((diff < 3600)); then
        local mins=$((diff / 60))
        ((mins == 1)) && echo "1 min ago" || echo "${mins} mins ago"
    elif ((diff < 86400)); then
        local hrs=$((diff / 3600))
        ((hrs == 1)) && echo "1 hour ago" || echo "${hrs} hours ago"
    elif ((diff < 172800)); then
        echo "yesterday"
    elif ((diff < 604800)); then
        local days=$((diff / 86400))
        echo "${days} days ago"
    elif ((diff < 2592000)); then
        local weeks=$((diff / 604800))
        ((weeks == 1)) && echo "1 week ago" || echo "${weeks} weeks ago"
    elif ((diff < 31536000)); then
        local months=$((diff / 2592000))
        ((months == 1)) && echo "1 month ago" || echo "${months} months ago"
    else
        local years=$((diff / 31536000))
        ((years == 1)) && echo "1 year ago" || echo "${years} years ago"
    fi
}

# Render raw file list into numbered, grouped, ranked output
# stdin: newline-separated file paths
# $1: query (for filename scoring)
# $2: mode ("file" or "content")
_mf_render() {
    local query="$1"
    local mode="${2:-file}"
    local -a paths=()
    local -A match_counts=()
    local -A filename_scores=()
    local -A file_dates=()

    _mf_init_colors

    # Read paths from stdin
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        paths+=("$line")
    done

    ((${#paths[@]} == 0)) && return 0

    # Score each path
    local lc_query="${query,,}"
    for p in "${paths[@]}"; do
        local base="${p##*/}"
        local lc_base="${base,,}"

        # Filename score: boost if query appears in basename
        if [[ "$lc_base" == *"$lc_query"* ]]; then
            filename_scores["$p"]=10
        else
            filename_scores["$p"]=0
        fi

        # Match count via rg -c
        local count
        count=$(rg -c -i -- "$query" "$p" 2>/dev/null || echo 0)
        # rg -c can return multiple lines for multi-pattern; sum them
        count=$(echo "$count" | awk -F: '{s+=$NF}END{print s+0}')
        match_counts["$p"]=$count

        # Human date
        file_dates["$p"]=$(_mf_human_date "$p")
    done

    # Sort: filename_score desc, match_count desc, path alpha
    local -a sorted=()
    sorted=($(for p in "${paths[@]}"; do
        printf '%02d\t%05d\t%s\n' "${filename_scores[$p]}" "${match_counts[$p]}" "$p"
    done | sort -t$'\t' -k1,1nr -k2,2nr -k3,3 | cut -f3))

    # Save results for selection
    printf '%s\n' "${sorted[@]}" > "$MF_DIR/last_results"

    # Group by directory
    local -a ordered_dirs=()
    local -A dir_files=()
    for p in "${sorted[@]}"; do
        local dir="${p%/*}"
        if [[ -z "${dir_files[$dir]+x}" ]]; then
            ordered_dirs+=("$dir")
            dir_files["$dir"]=""
        fi
        dir_files["$dir"]+="$p"$'\n'
    done

    # Display
    local num=1
    for dir in "${ordered_dirs[@]}"; do
        local file_list="${dir_files[$dir]}"
        local count
        count=$(echo -n "$file_list" | grep -c .)

        # Directory header
        local short_dir="$dir"
        # Shorten relative to pwd if possible
        local pwd_prefix="$PWD/"
        if [[ "$dir" == "$PWD" ]]; then
            short_dir="."
        elif [[ "$dir" == "${pwd_prefix}"* ]]; then
            short_dir="${dir#$pwd_prefix}"
        fi

        printf '\n%s── %s%s %s(%d)%s ──%s\n' \
            "$MF_C_DIM" "$MF_C_CYAN" "$short_dir" "$MF_C_DIM" "$count" "$MF_C_DIM" "$MF_C_RESET"

        while IFS= read -r filepath; do
            [[ -z "$filepath" ]] && continue
            local base="${filepath##*/}"
            local mc="${match_counts[$filepath]}"
            local hdate="${file_dates[$filepath]}"
            local suffix=""
            if [[ "$mode" == "content" ]] && ((mc > 0)); then
                if ((mc == 1)); then
                    suffix="${MF_C_GREEN}1 match${MF_C_RESET}"
                else
                    suffix="${MF_C_GREEN}${mc} matches${MF_C_RESET}"
                fi
            fi
            # Format: [N]  filename                    date      matches
            printf ' %s[%d]%s  %-28s  %s%-12s%s  %s\n' \
                "$MF_C_YELLOW" "$num" "$MF_C_RESET" \
                "$base" \
                "$MF_C_DIM" "$hdate" "$MF_C_RESET" \
                "$suffix"
            ((num++))
        done <<< "$file_list"
    done
    echo
}

# Select result N from last search
_mf_select() {
    local n="$1"
    local results_file="$MF_DIR/last_results"

    if [[ ! -f "$results_file" ]]; then
        echo "No previous results. Run a search first." >&2
        return 1
    fi

    local filepath
    filepath=$(sed -n "${n}p" "$results_file")

    if [[ -z "$filepath" ]]; then
        local total
        total=$(wc -l < "$results_file")
        echo "Invalid selection: $n (have $((total)) results)" >&2
        return 1
    fi

    echo "$filepath"
    echo "---"
    cat "$filepath"
}
