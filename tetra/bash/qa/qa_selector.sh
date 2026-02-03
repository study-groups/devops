#!/usr/bin/env bash
# qa_ops.sh - Channel operations (export, promote, merge, clear)
#
# These are exposed via `qa` subcommands:
#   qa export [channel] [format]   - Export entries
#   qa promote <src> <dest>        - Move channel to new name
#   qa merge <channel>             - Copy channel entries to db
#   qa summary [channel]           - LLM summary of channel

# =============================================================================
# EXPORT
# =============================================================================

# Export channel entries in various formats
# Usage: qa_export [channel] [format]
# Examples:
#   qa_export              - Export db as jsonl
#   qa_export git          - Export channel "git" as jsonl
#   qa_export git md       - Export channel "git" as markdown
#   qa_export --all jsonl  - Export everything
qa_export() {
    local channel="db"
    local format="jsonl"

    # Parse args
    if [[ "$1" == "--all" ]]; then
        shift
        format="${1:-jsonl}"
        _qa_export_all "$format"
        return
    fi

    if [[ -n "$1" && "$1" != -* ]]; then
        channel="$1"
        shift
    fi
    [[ -n "$1" ]] && format="$1"

    local dir="$(_qa_get_channel_dir "$channel")"
    if [[ ! -d "$dir" ]]; then
        echo "Channel '$channel' not found" >&2
        return 1
    fi

    local -a ids
    mapfile -t ids < <(_qa_get_entry_ids "$channel")

    if [[ ${#ids[@]} -eq 0 ]]; then
        echo "Channel '$channel' is empty" >&2
        return 1
    fi

    _qa_format_entries "$dir" "$format" "${ids[@]}"
}

# Export all channels
_qa_export_all() {
    local format="${1:-jsonl}"
    local base="${QA_DIR:-$TETRA_DIR/qa}"

    # Export db
    echo "# db" >&2
    qa_export db "$format"

    # Export each channel
    if [[ -d "$base/channels" ]]; then
        for dir in "$base/channels"/*/; do
            [[ -d "$dir" ]] || continue
            local name=$(basename "$dir")
            [[ "$name" == "archive" ]] && continue
            local count=$(_qa_count_entries "$dir")
            [[ $count -eq 0 ]] && continue
            echo "# $name" >&2
            qa_export "$name" "$format"
        done
    fi
}

# Format entries in specified format
_qa_format_entries() {
    local dir="$1"
    local format="$2"
    shift 2
    local -a ids=("$@")

    case "$format" in
        jsonl)
            for id in "${ids[@]}"; do
                local prompt=$(cat "$dir/$id.prompt" 2>/dev/null | jq -Rs .)
                local answer=$(cat "$dir/$id.answer" 2>/dev/null | jq -Rs .)
                echo "{\"id\":\"$id\",\"prompt\":$prompt,\"answer\":$answer}"
            done
            ;;
        md|markdown)
            for id in "${ids[@]}"; do
                echo "## $id"
                echo ""
                echo "**Q:** $(cat "$dir/$id.prompt" 2>/dev/null)"
                echo ""
                echo "**A:** $(cat "$dir/$id.answer" 2>/dev/null)"
                echo ""
                echo "---"
                echo ""
            done
            ;;
        txt|text)
            for id in "${ids[@]}"; do
                echo "[$id]"
                echo "Q: $(cat "$dir/$id.prompt" 2>/dev/null)"
                echo "A: $(cat "$dir/$id.answer" 2>/dev/null)"
                echo ""
            done
            ;;
        *)
            echo "Unknown format: $format" >&2
            echo "Valid formats: jsonl, md, txt" >&2
            return 1
            ;;
    esac
}

# =============================================================================
# PROMOTE / MERGE
# =============================================================================

# Promote (rename) a channel
# Usage: qa_promote <src> <dest>
# Example: qa_promote 2 my-project
qa_promote_channel() {
    local src="$1"
    local dest="$2"

    if [[ -z "$src" || -z "$dest" ]]; then
        echo "Usage: qa promote <source-channel> <dest-name>" >&2
        return 1
    fi

    _qa_validate_channel "$dest" || return 1

    local src_dir="$(_qa_get_channel_dir "$src")"
    local base="${QA_DIR:-$TETRA_DIR/qa}"
    local dest_dir="$base/channels/$dest"

    if [[ ! -d "$src_dir" ]]; then
        echo "Source channel '$src' not found" >&2
        return 1
    fi

    if [[ -d "$dest_dir" ]]; then
        echo "Destination channel '$dest' already exists" >&2
        return 1
    fi

    mv "$src_dir" "$dest_dir"
    echo "Promoted: $src -> $dest"
}

# Merge channel entries into db (copy, not move)
# Usage: qa_merge <channel>
qa_merge_channel() {
    local channel="$1"

    if [[ -z "$channel" ]]; then
        echo "Usage: qa merge <channel>" >&2
        return 1
    fi

    local src_dir="$(_qa_get_channel_dir "$channel")"
    local base="${QA_DIR:-$TETRA_DIR/qa}"
    local dest_dir="$base/db"

    if [[ ! -d "$src_dir" ]]; then
        echo "Channel '$channel' not found" >&2
        return 1
    fi

    mkdir -p "$dest_dir"

    local -a ids
    mapfile -t ids < <(_qa_get_entry_ids "$channel")

    if [[ ${#ids[@]} -eq 0 ]]; then
        echo "Channel '$channel' is empty" >&2
        return 1
    fi

    local count=0
    for id in "${ids[@]}"; do
        _qa_entry_copy "$src_dir" "$id" "$dest_dir" >/dev/null
        ((count++))
    done

    echo "Merged $count entries from '$channel' to db"
}

# =============================================================================
# SUMMARY
# =============================================================================

# Generate LLM summary of channel contents
# Usage: qa_summary [channel]
qa_summary() {
    local channel="${1:-db}"
    local dir="$(_qa_get_channel_dir "$channel")"

    if [[ ! -d "$dir" ]]; then
        echo "Channel '$channel' not found" >&2
        return 1
    fi

    # Collect all Q&A pairs
    local context=""
    local count=0
    for f in "$dir"/*.prompt; do
        [[ -f "$f" ]] || continue
        local id=$(basename "$f" .prompt)
        local question=$(cat "$f")
        local answer=$(cat "${f%.prompt}.answer" 2>/dev/null)
        context+="Q: $question"$'\n'"A: $answer"$'\n\n'
        ((count++))
    done

    if [[ $count -eq 0 ]]; then
        echo "Channel '$channel' is empty" >&2
        return 1
    fi

    echo "Generating summary of $count Q&A pairs..." >&2

    qq "Summarize this Q&A session concisely. Highlight key topics, decisions, and any action items:

$context"
}

# =============================================================================
# FILTER (for advanced queries)
# =============================================================================

# Filter entries since a time
# Usage: _qa_filter_since <timespec> <ids...>
_qa_filter_since() {
    local timespec="$1"
    shift
    local -a ids=("$@")

    local cutoff=$(_qa_date_ago "$timespec")
    [[ -z "$cutoff" || "$cutoff" == "0" ]] && cutoff=0

    for id in "${ids[@]}"; do
        [[ "$id" -ge "$cutoff" ]] && echo "$id"
    done
}

# Functions available via source - no export -f needed
