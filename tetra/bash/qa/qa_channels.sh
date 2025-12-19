#!/usr/bin/env bash
# qa_channels.sh - Channel management for QA system
#
# Architecture:
#   WORKING CHANNELS (all in /tmp/qa/{N}, cleared on reboot)
#     1 = primary working channel (qq) - dual-writes to main archive
#     2 = scratch (qqq alias)
#     3 = scratch
#     4 = scratch
#
#   PERSISTENT
#     main = $QA_DIR/db (auto-populated from channel 1)
#     @name = $QA_DIR/channels/{name}/db (named channels)

# =============================================================================
# CHANNEL DIRECTORY RESOLUTION
# =============================================================================

# Get the directory path for a channel
# Usage: _qa_get_channel_dir [channel]
# Examples:
#   _qa_get_channel_dir         -> /tmp/qa/1 (working channel)
#   _qa_get_channel_dir 1       -> /tmp/qa/1 (working channel)
#   _qa_get_channel_dir 2       -> /tmp/qa/2 (scratch)
#   _qa_get_channel_dir main    -> $QA_DIR (persistent archive)
#   _qa_get_channel_dir @research -> $QA_DIR/channels/research
_qa_get_channel_dir() {
    local channel="${1:-1}"
    case "$channel" in
        1|2|3|4)
            echo "/tmp/qa/$channel"
            ;;
        main|"")
            echo "$QA_DIR"
            ;;
        @*)
            echo "$QA_DIR/channels/${channel#@}"
            ;;
        *)
            echo "$QA_DIR"
            ;;
    esac
}

# Get the db subdirectory for a channel
_qa_get_channel_db() {
    local channel="${1:-1}"
    echo "$(_qa_get_channel_dir "$channel")/db"
}

# Ensure channel directory exists
_qa_ensure_channel() {
    local channel="${1:-1}"
    local dir="$(_qa_get_channel_dir "$channel")"
    mkdir -p "$dir/db"
}

# =============================================================================
# CHANNEL-AWARE QUERY
# =============================================================================

# Query to a specific channel
# Usage: _qq_channel <channel> <query...>
# Channel 1 dual-writes: /tmp/qa/1 + $QA_DIR/db (main archive)
_qq_channel() {
    local channel="$1"
    shift

    # Ensure channel exists
    _qa_ensure_channel "$channel"

    # Save original QA_DIR
    local orig_qa_dir="$QA_DIR"
    local orig_db_dir="$QA_DB_DIR"

    # Point to channel directory
    local channel_dir="$(_qa_get_channel_dir "$channel")"
    export QA_DIR="$channel_dir"
    export QA_DB_DIR="$channel_dir/db"

    # Run query
    qa_query "$@"
    local rc=$?

    # Get the ID of the entry just created
    local last_id=$(_qa_last_id_in_dir "$channel_dir/db")

    # Update manifest
    if [[ -n "$last_id" ]]; then
        _qa_manifest_add "$channel" "$last_id"

        # Channel 1 dual-writes to main archive
        if [[ "$channel" == "1" ]]; then
            local main_db="$orig_qa_dir/db"
            mkdir -p "$main_db"
            for ext in prompt answer data response meta metadata.json; do
                [[ -f "$channel_dir/db/$last_id.$ext" ]] && \
                    cp "$channel_dir/db/$last_id.$ext" "$main_db/"
            done
            _qa_manifest_add "main" "$last_id"
        fi
    fi

    # Restore original
    export QA_DIR="$orig_qa_dir"
    export QA_DB_DIR="$orig_db_dir"

    return $rc
}

# =============================================================================
# CHANNEL-AWARE RETRIEVAL
# =============================================================================

# Get the last ID from a specific db directory
_qa_last_id_in_dir() {
    local db_dir="$1"
    local file
    file=$(ls -t "$db_dir"/*.answer 2>/dev/null | head -1)
    [[ -n "$file" ]] && basename "$file" .answer
}

# Get the last ID from a channel
_qa_last_id() {
    local channel="${1:-1}"
    local db_dir="$(_qa_get_channel_db "$channel")"
    _qa_last_id_in_dir "$db_dir"
}

# Get answer from a specific channel
# Usage: _a_channel <channel> [index]
_a_channel() {
    local channel="$1"
    shift
    local index="${1:-0}"
    local db_dir="$(_qa_get_channel_db "$channel")"

    local files
    mapfile -t files < <(ls -t "$db_dir"/*.answer 2>/dev/null)

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No answers in channel $channel" >&2
        return 1
    fi

    local file="${files[$index]}"
    if [[ -z "$file" || ! -f "$file" ]]; then
        echo "No answer at index $index in channel $channel" >&2
        return 1
    fi

    local id=$(basename "$file" .answer)
    local total=${#files[@]}
    local prompt_preview=""
    [[ -f "$db_dir/$id.prompt" ]] && prompt_preview=$(head -n 1 "$db_dir/$id.prompt" | _truncate_middle)

    printf "[$id: $prompt_preview]\n\n"
    cat "$file"
    printf "\n[QA/$channel/$((index+1))/$total $id]\n"
}

# Get question from a specific channel
# Usage: _q_channel <channel> [index]
_q_channel() {
    local channel="$1"
    shift
    local index="${1:-0}"
    local db_dir="$(_qa_get_channel_db "$channel")"

    local files
    mapfile -t files < <(ls -t "$db_dir"/*.prompt 2>/dev/null)

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No questions in channel $channel" >&2
        return 1
    fi

    local file="${files[$index]}"
    if [[ -z "$file" || ! -f "$file" ]]; then
        echo "No question at index $index in channel $channel" >&2
        return 1
    fi

    cat "$file"
}

# =============================================================================
# MANIFEST MANAGEMENT
# =============================================================================

# Add entry to channel manifest
_qa_manifest_add() {
    local channel="$1"
    local id="$2"
    local manifest="$(_qa_get_channel_dir "$channel")/channel.manifest"
    echo "$id" >> "$manifest"
}

# List manifest entries
_qa_manifest_list() {
    local channel="${1:-1}"
    local manifest="$(_qa_get_channel_dir "$channel")/channel.manifest"
    [[ -f "$manifest" ]] && cat "$manifest"
}

# =============================================================================
# PROMOTION AND MOVEMENT
# =============================================================================

# Promote entry from working channel to persistent (main or named)
# Usage: qa_promote <src_channel> [id_or_dest] [dest]
# Examples:
#   qa_promote 2              # Last from ch2 -> main
#   qa_promote 3 @research    # Last from ch3 -> @research
#   qa_promote 2 1734567890   # Specific ID -> main
#   qa_promote 3 1734567890 @research  # Specific ID -> @research
# Note: Channel 1 already dual-writes to main, so promote is mainly for 2,3,4
qa_promote() {
    local src="$1"
    local id_or_dest="${2:-}"
    local dest="${3:-main}"

    # Validate source is a numbered channel
    case "$src" in
        1|2|3|4) ;;
        *)
            echo "Error: Can only promote from working channels (1, 2, 3, 4)" >&2
            return 1
            ;;
    esac

    # Parse args: qa promote 3 @research OR qa promote 3 ID @research
    if [[ "$id_or_dest" =~ ^@ ]] || [[ "$id_or_dest" == "main" ]]; then
        dest="$id_or_dest"
        id_or_dest=""
    fi

    local entry_id="${id_or_dest:-$(_qa_last_id "$src")}"

    if [[ -z "$entry_id" ]]; then
        echo "Error: No entries in channel $src to promote" >&2
        return 1
    fi

    local src_dir="$(_qa_get_channel_db "$src")"
    local dst_dir="$(_qa_get_channel_db "$dest")"

    # Ensure destination exists
    mkdir -p "$dst_dir"

    # Check source files exist
    if [[ ! -f "$src_dir/$entry_id.prompt" ]]; then
        echo "Error: Entry $entry_id not found in channel $src" >&2
        return 1
    fi

    # Copy all files for entry
    local copied=0
    for ext in prompt answer data response meta metadata.json; do
        if [[ -f "$src_dir/$entry_id.$ext" ]]; then
            cp "$src_dir/$entry_id.$ext" "$dst_dir/"
            ((copied++))
        fi
    done

    # Update destination manifest
    _qa_manifest_add "$dest" "$entry_id"

    echo "Promoted $entry_id: $src -> $dest ($copied files)"
}

# Move entry between named channels
# Usage: qa_move <src_channel> [id] <dest_channel>
qa_move() {
    local src="$1"
    local id_or_dest="${2:-}"
    local dest="${3:-}"

    # Parse args
    if [[ -z "$dest" ]]; then
        dest="$id_or_dest"
        id_or_dest=""
    fi

    local entry_id="${id_or_dest:-$(_qa_last_id "$src")}"

    if [[ -z "$entry_id" ]]; then
        echo "Error: No entries in channel $src to move" >&2
        return 1
    fi

    local src_dir="$(_qa_get_channel_db "$src")"
    local dst_dir="$(_qa_get_channel_db "$dest")"

    mkdir -p "$dst_dir"

    # Move files
    local moved=0
    for ext in prompt answer data response meta metadata.json; do
        if [[ -f "$src_dir/$entry_id.$ext" ]]; then
            mv "$src_dir/$entry_id.$ext" "$dst_dir/"
            ((moved++))
        fi
    done

    # Update manifests
    _qa_manifest_add "$dest" "$entry_id"

    echo "Moved $entry_id: $src -> $dest ($moved files)"
}

# =============================================================================
# CHANNEL LISTING AND MANAGEMENT
# =============================================================================

# List all channels with entry counts
qa_channels() {
    local show_all=true
    local show_named=false
    local show_temp=false

    while [[ "$1" =~ ^- ]]; do
        case "$1" in
            --named) show_named=true; show_all=false ;;
            --temp) show_temp=true; show_all=false ;;
            *) ;;
        esac
        shift
    done

    if $show_all || $show_temp; then
        echo "WORKING CHANNELS (/tmp/qa/N, clears on reboot)"
        for n in 1 2 3 4; do
            local dir="/tmp/qa/$n/db"
            local count=0
            [[ -d "$dir" ]] && count=$(ls "$dir"/*.answer 2>/dev/null | wc -l | tr -d ' ')
            local last_activity="-"
            if [[ $count -gt 0 ]]; then
                local newest=$(ls -t "$dir"/*.answer 2>/dev/null | head -1)
                if [[ -n "$newest" ]]; then
                    last_activity=$(stat -f "%Sm" -t "%H:%M" "$newest" 2>/dev/null || stat -c "%y" "$newest" 2>/dev/null | cut -d' ' -f2 | cut -d':' -f1-2)
                fi
            fi
            local note=""
            [[ "$n" == "1" ]] && note="(qq, dual-writes to main)"
            [[ "$n" == "2" ]] && note="(qqq scratch)"
            printf "  %-4s %3s entries   %-8s %s\n" "$n" "$count" "$last_activity" "$note"
        done
        echo ""
    fi

    if $show_all || $show_named; then
        echo "NAMED (persistent)"
        local found=0
        if [[ -d "$QA_DIR/channels" ]]; then
            for dir in "$QA_DIR/channels"/*/; do
                [[ -d "$dir" ]] || continue
                local name="@$(basename "$dir")"
                local count=0
                [[ -d "$dir/db" ]] && count=$(ls "$dir/db"/*.answer 2>/dev/null | wc -l | tr -d ' ')
                printf "  %-12s %3s entries\n" "$name" "$count"
                ((found++))
            done
        fi
        [[ $found -eq 0 ]] && echo "  (none - create with: qq @name \"query\")"
        echo ""
    fi

    if $show_all; then
        echo "MAIN ARCHIVE (\$QA_DIR/db)"
        local main_count=0
        [[ -d "$QA_DIR/db" ]] && main_count=$(ls "$QA_DIR/db"/*.answer 2>/dev/null | wc -l | tr -d ' ')
        printf "  main        %3s entries (auto-populated from qq/qq1)\n" "$main_count"
    fi
}

# Create a named channel explicitly
qa_channel_create() {
    local name="$1"
    [[ -z "$name" ]] && { echo "Usage: qa channel create @name"; return 1; }

    # Strip @ if present
    name="${name#@}"

    local dir="$QA_DIR/channels/$name"
    if [[ -d "$dir" ]]; then
        echo "Channel @$name already exists"
        return 0
    fi

    mkdir -p "$dir/db"
    echo "Created channel @$name"
}

# Delete a named channel
qa_channel_delete() {
    local name="$1"
    [[ -z "$name" ]] && { echo "Usage: qa channel delete @name"; return 1; }

    name="${name#@}"
    local dir="$QA_DIR/channels/$name"

    if [[ ! -d "$dir" ]]; then
        echo "Channel @$name not found"
        return 1
    fi

    local count=$(ls "$dir/db"/*.answer 2>/dev/null | wc -l | tr -d ' ')
    if [[ $count -gt 0 ]]; then
        echo "Warning: Channel @$name has $count entries"
        read -p "Delete anyway? [y/N] " confirm
        [[ "$confirm" != "y" && "$confirm" != "Y" ]] && return 1
    fi

    rm -rf "$dir"
    echo "Deleted channel @$name"
}

# Rename a named channel
qa_channel_rename() {
    local old="$1"
    local new="$2"

    [[ -z "$old" || -z "$new" ]] && { echo "Usage: qa channel rename @old @new"; return 1; }

    old="${old#@}"
    new="${new#@}"

    local old_dir="$QA_DIR/channels/$old"
    local new_dir="$QA_DIR/channels/$new"

    [[ ! -d "$old_dir" ]] && { echo "Channel @$old not found"; return 1; }
    [[ -d "$new_dir" ]] && { echo "Channel @$new already exists"; return 1; }

    mv "$old_dir" "$new_dir"
    echo "Renamed @$old -> @$new"
}

# Clear a working channel
qa_clear() {
    local channel="$1"

    if [[ "$channel" == "--all" ]]; then
        for n in 1 2 3 4; do
            local dir="/tmp/qa/$n"
            if [[ -d "$dir" ]]; then
                rm -rf "$dir"
                echo "Cleared channel $n"
            fi
        done
        return 0
    fi

    if [[ "$channel" == "--scratch" ]]; then
        # Clear only scratch channels (2,3,4), preserve channel 1
        for n in 2 3 4; do
            local dir="/tmp/qa/$n"
            if [[ -d "$dir" ]]; then
                rm -rf "$dir"
                echo "Cleared channel $n"
            fi
        done
        return 0
    fi

    case "$channel" in
        1|2|3|4)
            local dir="/tmp/qa/$channel"
            if [[ -d "$dir" ]]; then
                rm -rf "$dir"
                echo "Cleared channel $channel"
            else
                echo "Channel $channel is already empty"
            fi
            ;;
        *)
            echo "Error: Can only clear working channels (1, 2, 3, 4)"
            echo "  qa clear 2         Clear channel 2"
            echo "  qa clear --scratch Clear 2,3,4 (preserve 1)"
            echo "  qa clear --all     Clear all working channels"
            return 1
            ;;
    esac
}

# =============================================================================
# SHORTCUT FUNCTIONS
# =============================================================================

# Numbered channel query shortcuts
# qq1 = qq = channel 1 (dual-writes to /tmp/qa/1 + main)
# qq2, qq3, qq4 = scratch channels (temp only, no main copy)
qq1() { _qq_channel 1 "$@"; }
qq2() { _qq_channel 2 "$@"; }
qq3() { _qq_channel 3 "$@"; }
qq4() { _qq_channel 4 "$@"; }
qqq() { qq2 "$@"; }  # Scratch alias

# Numbered channel answer shortcuts
# a1 reads from /tmp/qa/1, a reads from main (archive)
a1() { _a_channel 1 "$@"; }
a2() { _a_channel 2 "$@"; }
a3() { _a_channel 3 "$@"; }
a4() { _a_channel 4 "$@"; }

# Numbered channel question shortcuts
q1() { _q_channel 1 "$@"; }
q2() { _q_channel 2 "$@"; }
q3() { _q_channel 3 "$@"; }
q4() { _q_channel 4 "$@"; }

# =============================================================================
# EXPORTS
# =============================================================================

export -f _qa_get_channel_dir _qa_get_channel_db _qa_ensure_channel
export -f _qq_channel _a_channel _q_channel
export -f _qa_last_id _qa_last_id_in_dir
export -f _qa_manifest_add _qa_manifest_list
export -f qa_promote qa_move qa_channels qa_clear
export -f qa_channel_create qa_channel_delete qa_channel_rename
export -f qq1 qq2 qq3 qq4 qqq
export -f a1 a2 a3 a4
export -f q1 q2 q3 q4
