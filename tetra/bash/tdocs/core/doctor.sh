#!/usr/bin/env bash
# TDOCS Doctor - Diagnose and repair issues

# Source constants for lifecycle validation
[[ -f "$TDOCS_SRC/core/tdocs_constants.sh" ]] && source "$TDOCS_SRC/core/tdocs_constants.sh"

# Check for stale database entries
tdoc_doctor_check_stale() {
    local stale=()

    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        local meta=$(cat "$meta_file")
        local doc_path=$(_tdocs_json_get "$meta" '.doc_path')

        if [[ -n "$doc_path" ]] && [[ ! -f "$doc_path" ]]; then
            stale+=("$meta_file:$doc_path")
        fi
    done

    echo "${#stale[@]}"
    if [[ ${#stale[@]} -gt 0 ]]; then
        printf '%s\n' "${stale[@]}"
    fi
}

# Check for documents without metadata
tdoc_doctor_check_missing() {
    local missing=()

    # Check top-level docs
    while IFS= read -r file; do
        [[ ! -f "$file" ]] && continue
        local meta=$(tdoc_get_metadata "$file")
        if [[ "$meta" == "{}" ]]; then
            missing+=("$file")
        fi
    done < <(find "$TETRA_SRC/docs" -name "*.md" -type f 2>/dev/null)

    # Check module docs
    while IFS= read -r file; do
        [[ ! -f "$file" ]] && continue
        local meta=$(tdoc_get_metadata "$file")
        if [[ "$meta" == "{}" ]]; then
            missing+=("$file")
        fi
    done < <(find "$TETRA_SRC/bash" -path "*/docs/*.md" -type f 2>/dev/null)

    echo "${#missing[@]}"
    if [[ ${#missing[@]} -gt 0 ]]; then
        printf '%s\n' "${missing[@]}"
    fi
}

# Check for lifecycle consistency issues
tdoc_doctor_check_lifecycle() {
    local issues=()

    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        local meta=$(cat "$meta_file")
        IFS=$'\t' read -r doc_path lifecycle <<< \
            "$(_tdocs_json_get_multi "$meta" '.doc_path' '.lifecycle')"

        # Check for missing lifecycle
        if [[ -z "$lifecycle" ]]; then
            issues+=("missing:$meta_file:$doc_path")
            continue
        fi

        # Check for invalid lifecycle values
        if ! tdoc_valid_lifecycle "$lifecycle" 2>/dev/null; then
            issues+=("invalid:$meta_file:$doc_path:$lifecycle")
        fi
    done

    echo "${#issues[@]}"
    if [[ ${#issues[@]} -gt 0 ]]; then
        printf '%s\n' "${issues[@]}"
    fi
}

# Check for duplicates (same doc_path in multiple .meta files)
tdoc_doctor_check_duplicates() {
    declare -A path_to_meta
    local duplicates=()

    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        local meta=$(cat "$meta_file")
        local doc_path=$(_tdocs_json_get "$meta" '.doc_path')

        # Skip if doc_path is empty
        [[ -z "$doc_path" ]] && continue

        # Create a safe key by replacing problematic characters
        local safe_key="${doc_path//[^a-zA-Z0-9_\/-]/_}"

        if [[ -n "${path_to_meta[$safe_key]:-}" ]]; then
            # Found duplicate
            duplicates+=("$doc_path:${path_to_meta[$safe_key]}:$meta_file")
        else
            path_to_meta[$safe_key]="$meta_file"
        fi
    done

    echo "${#duplicates[@]}"
    if [[ ${#duplicates[@]} -gt 0 ]]; then
        printf '%s\n' "${duplicates[@]}"
    fi
}

# Count total markdown files in codebase
tdoc_doctor_count_total_files() {
    if [[ -n "$TETRA_SRC" ]]; then
        find "$TETRA_SRC/bash" "$TETRA_SRC/docs" -name "*.md" -type f 2>/dev/null | wc -l | tr -d ' '
    else
        echo "0"
    fi
}

# Main doctor command
tdoc_doctor() {
    local action="${1:-}"
    local summary_only=false
    local fix=false
    local reindex=false
    local cleanup=false

    # Parse flags
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --summary)
                summary_only=true
                shift
                ;;
            --fix)
                fix=true
                shift
                ;;
            --reindex)
                reindex=true
                shift
                ;;
            --cleanup)
                cleanup=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                    TDOCS Health Check                     ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""

    # Check 1: Stale database entries
    echo "🔍 Checking for stale database entries..."
    local stale_output=$(tdoc_doctor_check_stale)
    local stale_count=$(echo "$stale_output" | head -1)
    local stale_list=$(echo "$stale_output" | tail -n +2)

    if [[ $stale_count -gt 0 ]]; then
        echo "   ❌ Found $stale_count stale database entries"
        if [[ "$summary_only" == false ]]; then
            echo ""
            while IFS=: read -r meta_file doc_path; do
                local rel_path="${doc_path#$TETRA_SRC/}"
                echo "      • $rel_path"
                echo "        → metadata: $(basename "$meta_file")"
            done <<< "$stale_list"
        fi
    else
        echo "   ✅ No stale entries found"
    fi
    echo ""

    # Check 2: Documents without metadata
    echo "🔍 Checking for documents without metadata..."
    local missing_output=$(tdoc_doctor_check_missing)
    local missing_count=$(echo "$missing_output" | head -1)
    local missing_list=$(echo "$missing_output" | tail -n +2)

    if [[ $missing_count -gt 0 ]]; then
        echo "   ⚠️  Found $missing_count documents without metadata"
        if [[ "$summary_only" == false ]]; then
            echo ""
            while IFS= read -r file; do
                local rel_path="${file#$TETRA_SRC/}"
                echo "      • $rel_path"
            done <<< "$missing_list"
        fi
    else
        echo "   ✅ All documents have metadata"
    fi
    echo ""

    # Check 3: Lifecycle consistency
    echo "🔍 Checking lifecycle consistency..."
    local lifecycle_output=$(tdoc_doctor_check_lifecycle)
    local lifecycle_count=$(echo "$lifecycle_output" | head -1)
    local lifecycle_list=$(echo "$lifecycle_output" | tail -n +2)

    if [[ $lifecycle_count -gt 0 ]]; then
        echo "   ❌ Found $lifecycle_count lifecycle issues"
        if [[ "$summary_only" == false ]]; then
            echo ""
            while IFS=: read -r issue_type meta_file doc_path value; do
                local rel_path="${doc_path#$TETRA_SRC/}"
                if [[ "$issue_type" == "missing" ]]; then
                    echo "      • $rel_path (missing lifecycle)"
                else
                    echo "      • $rel_path (invalid: '$value')"
                fi
            done <<< "$lifecycle_list"
        fi
    else
        echo "   ✅ All lifecycles valid"
    fi
    echo ""

    # Check 4: Duplicate entries
    echo "🔍 Checking for duplicate entries..."
    local dup_output=$(tdoc_doctor_check_duplicates)
    local dup_count=$(echo "$dup_output" | head -1)
    local dup_list=$(echo "$dup_output" | tail -n +2)

    if [[ $dup_count -gt 0 ]]; then
        echo "   ❌ Found $dup_count duplicate entries"
        if [[ "$summary_only" == false ]]; then
            echo ""
            while IFS=: read -r doc_path meta1 meta2; do
                local rel_path="${doc_path#$TETRA_SRC/}"
                echo "      • $rel_path"
                echo "        → $(basename "$meta1")"
                echo "        → $(basename "$meta2")"
            done <<< "$dup_list"
        fi
    else
        echo "   ✅ No duplicates found"
    fi
    echo ""

    # Check 5: Database directory health summary
    echo "🔍 Database health summary..."
    local db_files=$(find "$TDOCS_DB_DIR" -name "*.meta" -type f 2>/dev/null | wc -l | tr -d ' ')
    local total_files=$(tdoc_doctor_count_total_files)
    local unindexed=$((total_files - db_files))

    echo "   📊 Indexed: $db_files / $total_files total markdown files"
    [[ $unindexed -gt 0 ]] && echo "   📝 Unindexed: $unindexed"

    # Lifecycle breakdown
    declare -A lifecycle_counts
    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue
        local lc=$(jq -r '.lifecycle // empty' "$meta_file" 2>/dev/null)
        [[ -z "$lc" ]] && lc="W"
        ((lifecycle_counts[$lc]++))
    done

    if [[ ${#lifecycle_counts[@]} -gt 0 ]]; then
        echo "   📈 Lifecycle breakdown:"
        [[ -n "${lifecycle_counts[C]}" ]] && echo "      • Canonical: ${lifecycle_counts[C]}"
        [[ -n "${lifecycle_counts[S]}" ]] && echo "      • Stable: ${lifecycle_counts[S]}"
        [[ -n "${lifecycle_counts[W]}" ]] && echo "      • Working: ${lifecycle_counts[W]}"
        [[ -n "${lifecycle_counts[D]}" ]] && echo "      • Draft: ${lifecycle_counts[D]}"
        [[ -n "${lifecycle_counts[X]}" ]] && echo "      • Archived: ${lifecycle_counts[X]}"
    fi

    echo "   📁 Database location: $TDOCS_DB_DIR"
    echo ""

    # Summary
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    local total_issues=$((stale_count + missing_count + lifecycle_count + dup_count))

    if [[ $total_issues -eq 0 ]]; then
        echo "✨ All checks passed! Your tdocs database is healthy."
        echo ""
        return 0
    fi

    echo "📋 Issues Summary:"
    echo "   • Stale entries: $stale_count"
    echo "   • Missing metadata: $missing_count"
    echo "   • Lifecycle issues: $lifecycle_count"
    echo "   • Duplicates: $dup_count"
    echo "   • Total issues: $total_issues"
    echo ""

    # Apply operations based on flags
    if [[ "$fix" == true ]] || [[ "$cleanup" == true ]] || [[ "$reindex" == true ]]; then
        echo "🔧 Applying operations..."
        echo ""

        # Fix/cleanup: Remove stale entries
        if [[ "$fix" == true ]] || [[ "$cleanup" == true ]]; then
            if [[ $stale_count -gt 0 ]]; then
                echo "   Removing stale database entries..."
                local removed=0
                while IFS=: read -r meta_file doc_path; do
                    if [[ -f "$meta_file" ]]; then
                        rm "$meta_file"
                        ((removed++))
                    fi
                done <<< "$stale_list"
                echo "   ✅ Removed $removed stale entries"
            fi
        fi

        # Fix: Auto-index missing metadata
        if [[ "$fix" == true ]]; then
            if [[ $missing_count -gt 0 ]]; then
                echo "   Auto-indexing documents without metadata..."
                local indexed=0
                while IFS= read -r file; do
                    local module=$(tdoc_detect_module "$file" 2>/dev/null || echo "")
                    local type=$(tdoc_suggest_type "$file" 2>/dev/null || echo "guide")
                    local intent="document"
                    local tags=$(tdoc_suggest_tags "$file" 2>/dev/null || echo "")
                    tdoc_db_create "$file" "$type" "$intent" "${TDOC_DEFAULT_LIFECYCLE:-W}" "$tags" "$module" "" "" "" "" "" "" >/dev/null 2>&1
                    ((indexed++))
                done <<< "$missing_list"
                echo "   ✅ Indexed $indexed documents"
            fi

            # Fix lifecycle issues
            if [[ $lifecycle_count -gt 0 ]]; then
                echo "   Fixing lifecycle issues..."
                local fixed=0
                while IFS=: read -r issue_type meta_file doc_path value; do
                    if [[ ! -f "$meta_file" ]]; then
                        continue
                    fi

                    # Set to default lifecycle (W = Working)
                    local meta=$(cat "$meta_file")
                    local new_meta=""

                    if [[ "$issue_type" == "missing" ]]; then
                        # Add missing lifecycle field
                        new_meta=$(echo "$meta" | sed 's/}$/, "lifecycle": "W"}/')
                    else
                        # Replace invalid lifecycle with W
                        new_meta=$(echo "$meta" | sed 's/"lifecycle": "[^"]*"/"lifecycle": "W"/')
                    fi

                    if [[ -n "$new_meta" ]]; then
                        echo "$new_meta" > "$meta_file"
                        ((fixed++))
                    fi
                done <<< "$lifecycle_list"
                echo "   ✅ Fixed $fixed lifecycle issues"
            fi
        fi

        # Cleanup: Remove duplicates (keep newest)
        if [[ "$cleanup" == true ]]; then
            if [[ $dup_count -gt 0 ]]; then
                echo "   Removing duplicate entries (keeping newest)..."
                local removed_dups=0
                while IFS=: read -r doc_path meta1 meta2; do
                    # Keep the newest file (by modification time)
                    if [[ -f "$meta1" ]] && [[ -f "$meta2" ]]; then
                        if [[ "$meta1" -nt "$meta2" ]]; then
                            rm "$meta2"
                        else
                            rm "$meta1"
                        fi
                        ((removed_dups++))
                    fi
                done <<< "$dup_list"
                echo "   ✅ Removed $removed_dups duplicates"
            fi
        fi

        # Reindex: Recalculate all ranks
        if [[ "$reindex" == true ]]; then
            echo "   Recalculating all ranks..."
            local reindexed=0
            for meta_file in "$TDOCS_DB_DIR"/*.meta; do
                [[ ! -f "$meta_file" ]] && continue
                local meta=$(cat "$meta_file")
                local doc_path=$(_tdocs_json_get "$meta" '.doc_path')

                if [[ -f "$doc_path" ]]; then
                    tdoc_db_ensure_rank "$doc_path" 2>/dev/null
                    ((reindexed++))
                fi
            done
            echo "   ✅ Reindexed $reindexed documents"
        fi

        echo ""
        echo "✨ All operations completed successfully!"
        echo ""

        # Force recount in REPL
        TDOCS_REPL_DOC_COUNT=0
    else
        echo "💡 Available operations:"
        echo "   tdocs doctor --fix       Fix all detected issues"
        echo "   tdocs doctor --cleanup   Remove stale entries and duplicates"
        echo "   tdocs doctor --reindex   Recalculate all document ranks"
        echo ""
        echo "   Combine flags for multiple operations:"
        echo "   tdocs doctor --fix --reindex"
        echo ""
    fi
}

# Export functions
export -f tdoc_doctor_check_stale
export -f tdoc_doctor_check_missing
export -f tdoc_doctor_check_lifecycle
export -f tdoc_doctor_check_duplicates
export -f tdoc_doctor_count_total_files
export -f tdoc_doctor
