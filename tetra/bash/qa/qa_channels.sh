#!/usr/bin/env bash
# qa_channels.sh - Channel management for QA system
#
# Architecture (v2):
#   $TETRA_DIR/qa/
#   ├── db/                  - THE canonical database (on the record)
#   ├── channels/
#   │   ├── 1/               - Working channel (qq1)
#   │   ├── 2/               - Scratch (qqq)
#   │   ├── 3/               - Scratch
#   │   ├── my-project/      - Named channel (promoted)
#   │   └── archive/         - Where cleared channels go
#   └── views/               - TOML-configured views
#
# Key changes from v1:
#   - No dual-write: qq → db, qq1 → channels/1, etc.
#   - Flat structure: no /db subdirectory in channels
#   - Lazy creation: channels created on first use
#   - Archive on clear: recoverable, not deleted
#   - Selector syntax: qq2:last, qq2:all promote foo, etc.

# =============================================================================
# CHANNEL DIRECTORY RESOLUTION
# =============================================================================

# Get the directory path for a channel (v2 - flat structure)
# Usage: _qa_get_channel_dir [channel]
# Examples:
#   _qa_get_channel_dir         -> $QA_DIR/db (main database)
#   _qa_get_channel_dir db      -> $QA_DIR/db (main database)
#   _qa_get_channel_dir 1       -> $QA_DIR/channels/1
#   _qa_get_channel_dir 2       -> $QA_DIR/channels/2
#   _qa_get_channel_dir foo     -> $QA_DIR/channels/foo (named)
_qa_get_channel_dir() {
    local channel="${1:-db}"
    local base="${QA_DIR:-$TETRA_DIR/qa}"

    case "$channel" in
        db|main|"")
            echo "$base/db"
            ;;
        [0-9]|[0-9]*)
            echo "$base/channels/$channel"
            ;;
        *)
            # Named channels (strip @ if present for filesystem)
            local name="${channel#@}"
            echo "$base/channels/$name"
            ;;
    esac
}

# Ensure channel directory exists (lazy creation)
_qa_ensure_channel() {
    local channel="${1:-db}"
    local dir="$(_qa_get_channel_dir "$channel")"
    [[ -d "$dir" ]] || mkdir -p "$dir"
    echo "$dir"
}

# For backwards compatibility - now just returns the channel dir (no /db)
_qa_get_channel_db() {
    _qa_get_channel_dir "$@"
}

# =============================================================================
# CHANNEL-AWARE QUERY
# =============================================================================

# Query to a specific channel (v2 - no dual-write)
# Usage: _qq_channel <channel> <query...>
# Each channel is independent - no automatic copying
_qq_channel() {
    local channel="$1"
    shift

    # Ensure channel exists (lazy creation)
    local channel_dir="$(_qa_ensure_channel "$channel")"

    # Save original QA_DIR
    local orig_qa_dir="$QA_DIR"
    local orig_db_dir="$QA_DB_DIR"

    # Point to channel directory (flat - no /db subdirectory)
    export QA_DIR="$(dirname "$channel_dir")"
    export QA_DB_DIR="$channel_dir"

    # Run query
    qa_query "$@"
    local rc=$?

    # Get the ID of the entry just created
    local last_id=$(_qa_last_id_in_dir "$channel_dir")

    # Update manifest
    if [[ -n "$last_id" ]]; then
        _qa_manifest_add "$channel" "$last_id"
    fi

    # Restore original
    export QA_DIR="$orig_qa_dir"
    export QA_DB_DIR="$orig_db_dir"

    return $rc
}

# =============================================================================
# CHANNEL-AWARE RETRIEVAL
# =============================================================================

# Get the last ID from a specific directory
_qa_last_id_in_dir() {
    local dir="$1"
    local file
    file=$(ls -t "$dir"/*.answer 2>/dev/null | head -1)
    [[ -n "$file" ]] && basename "$file" .answer
}

# Get the last ID from a channel
_qa_last_id() {
    local channel="${1:-db}"
    local dir="$(_qa_get_channel_dir "$channel")"
    _qa_last_id_in_dir "$dir"
}

# Get answer from a specific channel
# Usage: _a_channel <channel> [index]
_a_channel() {
    local channel="$1"
    shift
    local index="${1:-0}"
    local dir="$(_qa_get_channel_dir "$channel")"

    local files
    mapfile -t files < <(ls -t "$dir"/*.answer 2>/dev/null)

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
    [[ -f "$dir/$id.prompt" ]] && prompt_preview=$(head -n 1 "$dir/$id.prompt" | _truncate_middle)

    printf "[%s: %s]\n\n" "$id" "$prompt_preview"
    cat "$file"
    printf "\n[QA/%s/%d/%d %s]\n" "$channel" "$((index+1))" "$total" "$id"
}

# Get question from a specific channel
# Usage: _q_channel <channel> [index]
_q_channel() {
    local channel="$1"
    shift
    local index="${1:-0}"
    local dir="$(_qa_get_channel_dir "$channel")"

    local files
    mapfile -t files < <(ls -t "$dir"/*.prompt 2>/dev/null)

    if [[ ${#files[@]} -eq 0 ]]; then
        echo "No questions in channel $channel" >&2
        return 1
    fi

    local file="${files[$index]}"
    if [[ -z "$file" || ! -f "$file" ]]; then
        echo "No question at index $index in channel $channel" >&2
        return 1
    fi

    local id=$(basename "$file" .prompt)
    local total=${#files[@]}
    local answer_preview=""
    [[ -f "$dir/$id.answer" ]] && answer_preview=$(head -n 1 "$dir/$id.answer" | _truncate_middle)

    printf "[%s: %s]\n\n" "$id" "$answer_preview"
    cat "$file"
    printf "\n[Q/%s/%d/%d %s]\n" "$channel" "$((index+1))" "$total" "$id"
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

# Promote entry from channel to db or another channel
# Usage: qa_promote <src_channel> [id_or_dest] [dest]
# Examples:
#   qa_promote 2              # Last from ch2 -> db
#   qa_promote 3 my-project   # Last from ch3 -> channels/my-project
#   qa_promote 2 1734567890   # Specific ID -> db
#   qa_promote 3 1734567890 my-project  # Specific ID -> channels/my-project
qa_promote() {
    local src="$1"
    local id_or_dest="${2:-}"
    local dest="${3:-db}"

    # Parse args: qa promote 3 my-project OR qa promote 3 ID my-project
    if [[ -n "$id_or_dest" ]] && ! [[ "$id_or_dest" =~ ^[0-9]+$ ]]; then
        dest="$id_or_dest"
        id_or_dest=""
    fi

    local entry_id="${id_or_dest:-$(_qa_last_id "$src")}"

    if [[ -z "$entry_id" ]]; then
        echo "Error: No entries in channel $src to promote" >&2
        return 1
    fi

    local src_dir="$(_qa_get_channel_dir "$src")"
    local dst_dir="$(_qa_get_channel_dir "$dest")"

    # Ensure destination exists
    mkdir -p "$dst_dir"

    # Check source files exist
    if [[ ! -f "$src_dir/$entry_id.prompt" ]]; then
        echo "Error: Entry $entry_id not found in channel $src" >&2
        return 1
    fi

    # Copy all files for entry
    local copied=$(_qa_entry_copy "$src_dir" "$entry_id" "$dst_dir")

    # Update destination manifest
    _qa_manifest_add "$dest" "$entry_id"

    echo "Promoted $entry_id: $src -> $dest ($copied files)"
}

# Move entry between channels
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

    local src_dir="$(_qa_get_channel_dir "$src")"
    local dst_dir="$(_qa_get_channel_dir "$dest")"

    mkdir -p "$dst_dir"

    # Move all files for entry
    local moved=$(_qa_entry_move "$src_dir" "$entry_id" "$dst_dir")

    # Update manifests
    _qa_manifest_add "$dest" "$entry_id"

    echo "Moved $entry_id: $src -> $dest ($moved files)"
}

# =============================================================================
# CHANNEL LISTING AND MANAGEMENT
# =============================================================================

# List all channels with entry counts (v2 structure)
qa_channels() {
    local base="${QA_DIR:-$TETRA_DIR/qa}"

    echo "DATABASE (\$QA_DIR/db)"
    local db_count=0
    [[ -d "$base/db" ]] && db_count=$(ls "$base/db"/*.answer 2>/dev/null | wc -l | tr -d ' ')
    printf "  db          %3s entries (qq writes here)\n" "$db_count"
    echo ""

    echo "CHANNELS (\$QA_DIR/channels/)"
    local found=0
    if [[ -d "$base/channels" ]]; then
        for dir in "$base/channels"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            [[ "$name" == "archive" ]] && continue

            local count=0
            count=$(ls "$dir"/*.answer 2>/dev/null | wc -l | tr -d ' ')
            local last_activity="-"
            if [[ $count -gt 0 ]]; then
                local newest=$(ls -t "$dir"/*.answer 2>/dev/null | head -1)
                if [[ -n "$newest" ]]; then
                    last_activity=$(stat -f "%Sm" -t "%H:%M" "$newest" 2>/dev/null || stat -c "%y" "$newest" 2>/dev/null | cut -d' ' -f2 | cut -d':' -f1-2)
                fi
            fi

            local note=""
            [[ "$name" == "1" ]] && note="(qq1)"
            [[ "$name" == "2" ]] && note="(qqq scratch)"
            [[ "$name" == "3" ]] && note="(qq3)"
            [[ "$name" == "4" ]] && note="(qq4)"

            printf "  %-16s %3s entries   %-8s %s\n" "$name" "$count" "$last_activity" "$note"
            ((found++))
        done
    fi
    [[ $found -eq 0 ]] && echo "  (none - use qq2 or qq3 to create)"
    echo ""

    # Show archive if it exists
    if [[ -d "$base/channels/archive" ]]; then
        echo "ARCHIVE (\$QA_DIR/channels/archive/)"
        local archive_count=0
        for adir in "$base/channels/archive"/*/; do
            [[ -d "$adir" ]] || continue
            local date=$(basename "$adir")
            local acount=$(ls "$adir"/*.answer 2>/dev/null | wc -l | tr -d ' ')
            printf "  %-16s %3s entries\n" "$date" "$acount"
            ((archive_count++))
        done
        [[ $archive_count -eq 0 ]] && echo "  (empty)"
    fi
}

# Create a named channel explicitly (v2 - flat structure)
qa_channel_create() {
    local name="$1"
    [[ -z "$name" ]] && { echo "Usage: qa channel create <name>"; return 1; }

    # Strip @ if present
    name="${name#@}"
    local base="${QA_DIR:-$TETRA_DIR/qa}"
    local dir="$base/channels/$name"

    if [[ -d "$dir" ]]; then
        echo "Channel $name already exists"
        return 0
    fi

    mkdir -p "$dir"
    echo "Created channel $name"
}

# Delete a named channel
qa_channel_delete() {
    local name="$1"
    [[ -z "$name" ]] && { echo "Usage: qa channel delete <name>"; return 1; }

    name="${name#@}"
    local base="${QA_DIR:-$TETRA_DIR/qa}"
    local dir="$base/channels/$name"

    if [[ ! -d "$dir" ]]; then
        echo "Channel $name not found"
        return 1
    fi

    local count=$(ls "$dir"/*.answer 2>/dev/null | wc -l | tr -d ' ')
    if [[ $count -gt 0 ]]; then
        echo "Warning: Channel $name has $count entries"
        read -p "Delete anyway? [y/N] " confirm
        [[ "$confirm" != "y" && "$confirm" != "Y" ]] && return 1
    fi

    rm -rf "$dir"
    echo "Deleted channel $name"
}

# Rename a named channel
qa_channel_rename() {
    local old="$1"
    local new="$2"

    [[ -z "$old" || -z "$new" ]] && { echo "Usage: qa channel rename <old> <new>"; return 1; }

    old="${old#@}"
    new="${new#@}"
    local base="${QA_DIR:-$TETRA_DIR/qa}"

    local old_dir="$base/channels/$old"
    local new_dir="$base/channels/$new"

    [[ ! -d "$old_dir" ]] && { echo "Channel $old not found"; return 1; }
    [[ -d "$new_dir" ]] && { echo "Channel $new already exists"; return 1; }

    mv "$old_dir" "$new_dir"
    echo "Renamed $old -> $new"
}

# Clear a channel (v2 - archives instead of deleting)
qa_clear() {
    local channel="$1"
    local base="${QA_DIR:-$TETRA_DIR/qa}"
    local archive_dir="$base/channels/archive/$(date +%Y-%m-%d)"

    if [[ "$channel" == "--all" ]]; then
        mkdir -p "$archive_dir"
        for n in 1 2 3 4; do
            local dir="$base/channels/$n"
            if [[ -d "$dir" ]] && [[ -n "$(ls -A "$dir" 2>/dev/null)" ]]; then
                mv "$dir"/* "$archive_dir/" 2>/dev/null
                echo "Archived channel $n"
            fi
        done
        return 0
    fi

    if [[ "$channel" == "--scratch" ]]; then
        mkdir -p "$archive_dir"
        for n in 2 3 4; do
            local dir="$base/channels/$n"
            if [[ -d "$dir" ]] && [[ -n "$(ls -A "$dir" 2>/dev/null)" ]]; then
                mv "$dir"/* "$archive_dir/" 2>/dev/null
                echo "Archived channel $n"
            fi
        done
        return 0
    fi

    # Named or numbered channel
    local dir="$(_qa_get_channel_dir "$channel")"

    if [[ ! -d "$dir" ]] || [[ -z "$(ls -A "$dir" 2>/dev/null)" ]]; then
        echo "Channel $channel is already empty"
        return 0
    fi

    mkdir -p "$archive_dir"
    local count=$(ls "$dir"/*.answer 2>/dev/null | wc -l | tr -d ' ')
    mv "$dir"/* "$archive_dir/" 2>/dev/null
    echo "Archived $count entries from channel $channel to $archive_dir"
}

# =============================================================================
# SHORTCUT FUNCTIONS (factory pattern)
# =============================================================================

# qq1-4: Write to numbered channels
# q1-4:  View questions from numbered channels
# a1-4:  View answers from numbered channels

_qq_numbered() { _qq_channel "$@"; }
_a_numbered() { _a_channel "$@"; }
_q_numbered() { _q_channel "$@"; }

# Generate qq1-4, a1-4, q1-4 shortcuts dynamically
for _n in 1 2 3 4; do
    eval "qq${_n}() { _qq_numbered ${_n} \"\$@\"; }"
    eval "a${_n}() { _a_numbered ${_n} \"\$@\"; }"
    eval "q${_n}() { _q_numbered ${_n} \"\$@\"; }"
done
unset _n

# Note: qqq is defined in qa.sh with module loading check

# =============================================================================
# HELP
# =============================================================================

qa_channels_help() {
    cat << 'EOF'
QA CHANNELS

STRUCTURE
  $TETRA_DIR/qa/
  ├── db/                  - Main database (on the record)
  ├── channels/
  │   ├── 1-4/             - Numbered scratch channels
  │   ├── git/             - Named channel (tag)
  │   └── archive/         - Cleared entries
  └── views/               - TOML-configured views

ASK QUESTIONS (qq writes)
  qq my question           - Ask, write to db
  qq :git my question      - Ask, write to channel "git"
  qq :2 my question        - Ask, write to channel 2
  qq1 my question          - Ask, write to channel 1
  qqq my question          - Ask, write to channel 2 (scratch)

VIEW QUESTIONS (q reads)
  q                        - Last question from db
  q 5                      - 5th question back from db
  q git                    - Last question from channel "git"
  q git 5                  - 5th question back from "git"
  q1 / q2 / q3 / q4        - Last from numbered channels

VIEW ANSWERS (a reads)
  a                        - Last answer from db
  a 5                      - 5th answer back from db
  a git                    - Last answer from channel "git"
  a git 5                  - 5th answer back from "git"
  a1 / a2 / a3 / a4        - Last from numbered channels

CHANNEL MANAGEMENT
  qa channels              - List all channels with counts
  qa channel create foo    - Create named channel
  qa channel rename a b    - Rename channel
  qa channel delete foo    - Delete channel
  qa clear 2               - Archive channel 2 contents
  qa clear --scratch       - Archive channels 2,3,4
  qa promote 2 myproj      - Move channel 2 → myproj
  qa export git jsonl      - Export channel as JSONL
EOF
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _qa_get_channel_dir _qa_get_channel_db _qa_ensure_channel
export -f _qq_channel _a_channel _q_channel
export -f _qa_last_id _qa_last_id_in_dir
export -f _qa_manifest_add _qa_manifest_list
export -f qa_promote qa_move qa_channels qa_clear
export -f qa_channel_create qa_channel_delete qa_channel_rename
export -f _qq_numbered _a_numbered _q_numbered
export -f qq1 qq2 qq3 qq4 qqq
export -f a1 a2 a3 a4
export -f q1 q2 q3 q4
export -f qa_channels_help
