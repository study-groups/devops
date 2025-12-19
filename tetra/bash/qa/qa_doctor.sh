#!/usr/bin/env bash
# qa_doctor.sh - Diagnostic tools for QA system
#
# Provides:
#   - qa doctor  : Health check
#   - qa summary : Usage statistics
#   - qa gc      : Garbage collection

# =============================================================================
# DOCTOR - HEALTH CHECK
# =============================================================================

qa_doctor() {
    echo "QA System Health Check"
    echo "----------------------"
    echo ""

    # Config checks
    echo "Config:"
    local api_key=$(_get_openai_api 2>/dev/null)
    if [[ -n "$api_key" ]]; then
        local masked="${api_key:0:7}...${api_key: -4}"
        echo "  ok API key configured ($masked)"
    else
        echo "  !! API key not set (run: qa config apikey <key>)"
    fi

    local engine=$(_get_qa_engine 2>/dev/null)
    if [[ -n "$engine" ]]; then
        echo "  ok Engine: $engine"
    else
        echo "  !! Engine not set (run: qa config engine gpt-4o)"
    fi

    local context=$(_get_qa_context 2>/dev/null)
    if [[ -n "$context" ]]; then
        echo "  ok Context: ${#context} chars"
    else
        echo "  -- Context: (not set)"
    fi
    echo ""

    # Storage checks
    echo "Storage:"
    local main_count=0
    if [[ -d "$QA_DIR/db" ]]; then
        main_count=$(ls "$QA_DIR/db"/*.answer 2>/dev/null | wc -l | tr -d ' ')
        echo "  ok Main DB: $QA_DIR/db ($main_count entries)"
    else
        echo "  !! Main DB not found: $QA_DIR/db"
    fi

    # Named channels
    local named_count=0
    if [[ -d "$QA_DIR/channels" ]]; then
        named_count=$(find "$QA_DIR/channels" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
        if [[ $named_count -gt 0 ]]; then
            local names=$(ls -1 "$QA_DIR/channels" 2>/dev/null | tr '\n' ' ')
            echo "  ok Named channels: $named_count (@$names)"
        else
            echo "  -- Named channels: (none)"
        fi
    fi

    # Temp channels
    local temp_warnings=""
    for n in 2 3 4; do
        local dir="/tmp/qa/$n/db"
        if [[ -d "$dir" ]]; then
            local count=$(ls "$dir"/*.answer 2>/dev/null | wc -l | tr -d ' ')
            if [[ $count -gt 0 ]]; then
                temp_warnings+="  !! Temp channel $n has $count entries (will clear on reboot)\n"
            fi
        fi
    done
    if [[ -n "$temp_warnings" ]]; then
        printf "$temp_warnings"
    fi
    echo ""

    # Integrity checks
    echo "Integrity:"
    local orphan_responses=0
    local orphan_data=0
    local missing_answers=0

    if [[ -d "$QA_DIR/db" ]]; then
        # Check for .response files without matching .answer
        for resp in "$QA_DIR/db"/*.response; do
            [[ -f "$resp" ]] || continue
            local id=$(basename "$resp" .response)
            [[ ! -f "$QA_DIR/db/$id.answer" ]] && ((orphan_responses++))
        done

        # Check for .data files without matching .answer
        for data in "$QA_DIR/db"/*.data; do
            [[ -f "$data" ]] || continue
            local id=$(basename "$data" .data)
            [[ ! -f "$QA_DIR/db/$id.answer" ]] && ((orphan_data++))
        done

        # Check for .prompt files without matching .answer (failed queries)
        for prompt in "$QA_DIR/db"/*.prompt; do
            [[ -f "$prompt" ]] || continue
            local id=$(basename "$prompt" .prompt)
            [[ ! -f "$QA_DIR/db/$id.answer" ]] && ((missing_answers++))
        done
    fi

    if [[ $orphan_responses -eq 0 && $orphan_data -eq 0 && $missing_answers -eq 0 ]]; then
        echo "  ok All entries have .prompt + .answer"
    else
        [[ $orphan_responses -gt 0 ]] && echo "  !! $orphan_responses orphaned .response files"
        [[ $orphan_data -gt 0 ]] && echo "  !! $orphan_data orphaned .data files"
        [[ $missing_answers -gt 0 ]] && echo "  !! $missing_answers failed queries (prompt without answer)"
    fi
    echo ""

    # Recommendations
    local has_recommendations=false
    echo "Recommendations:"

    if [[ -n "$temp_warnings" ]]; then
        echo "  - Run 'qa promote N' to save temp work before reboot"
        has_recommendations=true
    fi

    if [[ $orphan_responses -gt 0 || $orphan_data -gt 0 ]]; then
        echo "  - Run 'qa gc' to clean orphan files"
        has_recommendations=true
    fi

    if [[ -z "$api_key" ]]; then
        echo "  - Set API key: qa config apikey <your-key>"
        has_recommendations=true
    fi

    if ! $has_recommendations; then
        echo "  (none - system healthy)"
    fi
}

# =============================================================================
# SUMMARY - USAGE STATISTICS
# =============================================================================

qa_summary() {
    local target="${1:-all}"

    echo "QA Summary"
    echo "----------"
    echo ""

    # Count entries across all channels
    local total=0
    declare -A channel_counts

    # Main channel
    local main_count=0
    if [[ -d "$QA_DIR/db" ]]; then
        main_count=$(ls "$QA_DIR/db"/*.answer 2>/dev/null | wc -l | tr -d ' ')
        channel_counts[main]=$main_count
        ((total += main_count))
    fi

    # Named channels
    if [[ -d "$QA_DIR/channels" ]]; then
        for dir in "$QA_DIR/channels"/*/; do
            [[ -d "$dir/db" ]] || continue
            local name="@$(basename "$dir")"
            local count=$(ls "$dir/db"/*.answer 2>/dev/null | wc -l | tr -d ' ')
            channel_counts[$name]=$count
            ((total += count))
        done
    fi

    # Temp channels
    for n in 2 3 4; do
        local dir="/tmp/qa/$n/db"
        if [[ -d "$dir" ]]; then
            local count=$(ls "$dir"/*.answer 2>/dev/null | wc -l | tr -d ' ')
            if [[ $count -gt 0 ]]; then
                channel_counts["temp/$n"]=$count
                ((total += count))
            fi
        fi
    done

    echo "Total entries: $total"
    echo ""

    echo "By Channel:"
    for channel in "${!channel_counts[@]}"; do
        local count=${channel_counts[$channel]}
        local pct=0
        [[ $total -gt 0 ]] && pct=$((count * 100 / total))
        printf "  %-12s %3s  (%2d%%)\n" "$channel" "$count" "$pct"
    done | sort -t'(' -k2 -rn
    echo ""

    # Activity stats (based on file timestamps)
    echo "Activity:"
    local today=$(date +%Y-%m-%d)
    local week_ago=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d 2>/dev/null)
    local month_ago=$(date -v-30d +%Y-%m-%d 2>/dev/null || date -d '30 days ago' +%Y-%m-%d 2>/dev/null)

    local today_count=0
    local week_count=0
    local month_count=0

    if [[ -d "$QA_DIR/db" ]]; then
        # Count by timestamp in filename
        local now=$(date +%s)
        local day_ago=$((now - 86400))
        local week_ago_ts=$((now - 604800))
        local month_ago_ts=$((now - 2592000))

        for f in "$QA_DIR/db"/*.answer; do
            [[ -f "$f" ]] || continue
            local ts=$(basename "$f" .answer)
            [[ "$ts" =~ ^[0-9]+$ ]] || continue

            if [[ $ts -gt $day_ago ]]; then
                ((today_count++))
            fi
            if [[ $ts -gt $week_ago_ts ]]; then
                ((week_count++))
            fi
            if [[ $ts -gt $month_ago_ts ]]; then
                ((month_count++))
            fi
        done
    fi

    printf "  Today:       %3s queries\n" "$today_count"
    printf "  This week:   %3s queries\n" "$week_count"
    printf "  This month:  %3s queries\n" "$month_count"
}

# =============================================================================
# GARBAGE COLLECTION
# =============================================================================

qa_gc() {
    local dry_run=false
    local aggressive=false

    while [[ "$1" =~ ^- ]]; do
        case "$1" in
            --dry-run|-n) dry_run=true ;;
            --aggressive) aggressive=true ;;
            *) ;;
        esac
        shift
    done

    echo "QA Garbage Collection"
    echo "---------------------"
    $dry_run && echo "(dry run - no files will be deleted)"
    echo ""

    local cleaned=0
    local db_dir="$QA_DIR/db"

    if [[ ! -d "$db_dir" ]]; then
        echo "No database directory found"
        return 0
    fi

    # Clean orphan .response files
    echo "Checking for orphan .response files..."
    for resp in "$db_dir"/*.response; do
        [[ -f "$resp" ]] || continue
        local id=$(basename "$resp" .response)
        if [[ ! -f "$db_dir/$id.answer" ]]; then
            echo "  Orphan: $id.response"
            if ! $dry_run; then
                rm "$resp"
                ((cleaned++))
            fi
        fi
    done

    # Clean orphan .data files
    echo "Checking for orphan .data files..."
    for data in "$db_dir"/*.data; do
        [[ -f "$data" ]] || continue
        local id=$(basename "$data" .data)
        if [[ ! -f "$db_dir/$id.answer" ]]; then
            echo "  Orphan: $id.data"
            if ! $dry_run; then
                rm "$data"
                ((cleaned++))
            fi
        fi
    done

    # Clean orphan .metadata.json files
    echo "Checking for orphan .metadata.json files..."
    for meta in "$db_dir"/*.metadata.json; do
        [[ -f "$meta" ]] || continue
        local id=$(basename "$meta" .metadata.json)
        if [[ ! -f "$db_dir/$id.answer" ]]; then
            echo "  Orphan: $id.metadata.json"
            if ! $dry_run; then
                rm "$meta"
                ((cleaned++))
            fi
        fi
    done

    # Aggressive mode: clean old entries
    if $aggressive; then
        echo ""
        echo "Aggressive mode: checking entries older than 90 days..."
        local now=$(date +%s)
        local cutoff=$((now - 7776000))  # 90 days

        for answer in "$db_dir"/*.answer; do
            [[ -f "$answer" ]] || continue
            local id=$(basename "$answer" .answer)
            [[ "$id" =~ ^[0-9]+$ ]] || continue

            if [[ $id -lt $cutoff ]]; then
                echo "  Old entry: $id ($(date -r "$id" +%Y-%m-%d 2>/dev/null || date -d "@$id" +%Y-%m-%d 2>/dev/null))"
                if ! $dry_run; then
                    rm -f "$db_dir/$id".*
                    ((cleaned++))
                fi
            fi
        done
    fi

    echo ""
    if $dry_run; then
        echo "Would clean $cleaned files (run without --dry-run to execute)"
    else
        echo "Cleaned $cleaned files"
    fi
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f qa_doctor qa_summary qa_gc
