#!/usr/bin/env bash

# TDOC Search System
# Search and filter operations

# ============================================================================
# TEMPORAL FILTERING HELPERS
# ============================================================================

# Parse temporal filter to Unix timestamp range
# Supports: last:7d, last:2w, last:1m, recent:week, time:2025-11-01
tdoc_parse_temporal() {
    local filter="$1"
    local now=$(date +%s)
    local start_time=""

    # Extract prefix and value (e.g., "last:7d" -> "last" and "7d")
    local prefix="${filter%%:*}"
    local value="${filter#*:}"

    case "$prefix" in
        last|recent)
            # Parse relative time (7d, 2w, 1m, 3mo, 1y)
            if [[ "$value" =~ ^([0-9]+)([dwmy]|mo)$ ]]; then
                local num="${BASH_REMATCH[1]}"
                local unit="${BASH_REMATCH[2]}"

                case "$unit" in
                    d) start_time=$((now - num * 86400)) ;;        # days
                    w) start_time=$((now - num * 604800)) ;;       # weeks
                    m) start_time=$((now - num * 2592000)) ;;      # months (30 days)
                    mo) start_time=$((now - num * 2592000)) ;;     # months
                    y) start_time=$((now - num * 31536000)) ;;     # years
                esac
            # Named periods (today, week, month, quarter, year)
            elif [[ "$value" == "today" ]]; then
                local today_start=$(date -j -f "%Y-%m-%d" "$(date +%Y-%m-%d)" +%s 2>/dev/null || date -d "$(date +%Y-%m-%d)" +%s 2>/dev/null)
                start_time="$today_start"
            elif [[ "$value" == "week" ]]; then
                start_time=$((now - 604800))  # 7 days
            elif [[ "$value" == "month" ]]; then
                start_time=$((now - 2592000))  # 30 days
            elif [[ "$value" == "quarter" ]]; then
                start_time=$((now - 7776000))  # 90 days
            elif [[ "$value" == "year" ]]; then
                start_time=$((now - 31536000))  # 365 days
            fi
            ;;
        time|date)
            # Parse absolute date (2025-11-01)
            if [[ "$value" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
                start_time=$(date -j -f "%Y-%m-%d" "$value" +%s 2>/dev/null || date -d "$value" +%s 2>/dev/null)
            fi
            ;;
    esac

    echo "$start_time"
}

# Filter documents by temporal range
# Returns true if document timestamp is within range
tdoc_matches_temporal() {
    local doc_timestamp="$1"
    local start_time="$2"

    [[ -z "$start_time" ]] && return 0  # No filter
    [[ -z "$doc_timestamp" ]] && return 1  # No timestamp in doc

    # Check if document is newer than start_time
    [[ "$doc_timestamp" -ge "$start_time" ]]
}

# ============================================================================
# LEVEL FILTERING HELPERS
# ============================================================================

# Check if completeness level matches filter
# Supports: L3, L3+ (L3 and above), L2-L4 (range)
# IMPORTANT: Returns FALSE (1) if doc has no level set (treats unset as L0/None)
tdoc_matches_level() {
    local doc_level="$1"
    local filter="$2"

    [[ -z "$filter" ]] && return 0  # No filter - show all

    # If doc has no level set, treat as L0 (None)
    if [[ -z "$doc_level" ]]; then
        doc_level="0"
    fi

    # Remove 'L' prefix if present in both
    doc_level="${doc_level#L}"
    filter="${filter#L}"

    # Validate doc_level is numeric
    if [[ ! "$doc_level" =~ ^[0-4]$ ]]; then
        doc_level="0"  # Default to L0 if invalid
    fi

    # Single level (e.g., "3")
    if [[ "$filter" =~ ^[0-4]$ ]]; then
        [[ "$doc_level" == "$filter" ]]
        return $?
    fi

    # Level+ (e.g., "3+" means L3, L4)
    if [[ "$filter" =~ ^([0-4])\+$ ]]; then
        local min_level="${BASH_REMATCH[1]}"
        [[ "$doc_level" -ge "$min_level" ]]
        return $?
    fi

    # Level- (e.g., "2-" means L0, L1, L2)
    if [[ "$filter" =~ ^([0-4])-$ ]]; then
        local max_level="${BASH_REMATCH[1]}"
        [[ "$doc_level" -le "$max_level" ]]
        return $?
    fi

    # Range (e.g., "2-4" means L2, L3, L4)
    if [[ "$filter" =~ ^([0-4])-([0-4])$ ]]; then
        local min_level="${BASH_REMATCH[1]}"
        local max_level="${BASH_REMATCH[2]}"
        [[ "$doc_level" -ge "$min_level" && "$doc_level" -le "$max_level" ]]
        return $?
    fi

    return 1
}

# ============================================================================
# RELEVANCE SCORING HELPERS
# ============================================================================

# Calculate composite relevance score (0-100)
# Combines: recency (40%), completeness level (40%), context (20%)
tdoc_calculate_relevance() {
    local doc_timestamp="$1"
    local doc_level="$2"
    local doc_module="$3"
    local context_module="${4:-}"

    local score=0
    local now=$(date +%s)

    # Recency score (40 points max)
    # Newer docs score higher, decaying over 90 days
    if [[ -n "$doc_timestamp" ]]; then
        local age=$((now - doc_timestamp))
        local days=$((age / 86400))
        if [[ $days -le 90 ]]; then
            local recency_score=$((40 - (days * 40 / 90)))
            score=$((score + recency_score))
        fi
    fi

    # Completeness score (40 points max)
    # L4=40, L3=30, L2=20, L1=10, L0=0
    if [[ -n "$doc_level" ]]; then
        doc_level="${doc_level#L}"
        case "$doc_level" in
            4) score=$((score + 40)) ;;
            3) score=$((score + 30)) ;;
            2) score=$((score + 20)) ;;
            1) score=$((score + 10)) ;;
            0) score=$((score + 0)) ;;
        esac
    fi

    # Context score (20 points max)
    # Docs from current module context score higher
    if [[ -n "$doc_module" && -n "$context_module" && "$doc_module" == "$context_module" ]]; then
        score=$((score + 20))
    fi

    echo "$score"
}

# Search documents by query (simple grep for now)
tdoc_search_docs() {
    local query="$1"
    shift
    local options=("$@")

    if [[ -z "$query" ]]; then
        echo "Error: Search query required" >&2
        return 1
    fi

    echo "Searching for: $query"
    echo ""

    local results=()

    # Search through database metadata
    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue
        [[ ! -s "$meta_file" ]] && continue  # Skip empty files

        local meta=$(cat "$meta_file")
        local doc_path=$(_tdocs_json_get "$meta" '.doc_path')

        # Skip if no doc_path found
        [[ -z "$doc_path" ]] && continue

        # Search in metadata
        if echo "$meta" | grep -qi "$query"; then
            results+=("$meta")
            continue
        fi

        # Search in document content
        if [[ -f "$doc_path" ]] && grep -qi "$query" "$doc_path" 2>/dev/null; then
            results+=("$meta")
        fi
    done

    if [[ ${#results[@]} -eq 0 ]]; then
        echo "No results found"
        return 0
    fi

    # Ensure all results have ranks calculated
    local results_with_ranks=()
    for meta in "${results[@]}"; do
        local doc_path=$(_tdocs_json_get "$meta" '.doc_path')
        tdoc_db_ensure_rank "$doc_path" 2>/dev/null

        # Re-read metadata with rank
        local updated_meta=$(tdoc_db_get_by_path "$doc_path")
        if [[ -n "$updated_meta" && "$updated_meta" != "{}" ]]; then
            results_with_ranks+=("$updated_meta")
        else
            results_with_ranks+=("$meta")
        fi
    done

    # Sort by rank (descending)
    local sorted_results=()
    while IFS= read -r scored_item; do
        sorted_results+=("${scored_item#*|}")
    done < <(
        for meta in "${results_with_ranks[@]}"; do
            local rank=$(_tdocs_json_get "$meta" '.rank' '0.0')
            echo "${rank}|${meta}"
        done | sort -t'|' -k1 -rn
    )

    echo "Found ${#sorted_results[@]} result(s):"
    echo ""

    # Store search results in TDOCS_LAST_LIST for numbered access
    TDOCS_LAST_LIST=()
    local index=1

    # Render results using consistent compact format
    for meta in "${sorted_results[@]}"; do
        local doc_path=$(_tdocs_json_get "$meta" '.doc_path')

        # Skip entries without valid doc_path
        if [[ -z "$doc_path" ]]; then
            echo "Warning: Skipping result with no doc_path" >&2
            continue
        fi

        # Add to list for numbered access
        TDOCS_LAST_LIST+=("$doc_path")

        # Display: number (blue) followed by compact metadata
        printf "\033[38;5;111m%3d.\033[0m " "$index"

        # Use the standard compact render function for consistency
        tdoc_render_compact "$meta" "$doc_path" "5" "false"

        echo ""
        ((index++))
    done
}

# Cache for list results (cleared when filters change)
declare -g TDOCS_LIST_CACHE=""
declare -g TDOCS_LIST_CACHE_KEY=""

# Check if cache is valid (newer than all .meta files)
_tdoc_cache_is_valid() {
    local cache_file="$1"

    [[ ! -f "$cache_file" ]] && return 1

    # Get cache timestamp (use canonical _tdocs_file_mtime from utils.sh)
    local cache_time=$(_tdocs_file_mtime "$cache_file" || echo 0)

    # Find newest .meta file
    local newest_meta=0
    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue
        local meta_time=$(_tdocs_file_mtime "$meta_file" || echo 0)
        [[ $meta_time -gt $newest_meta ]] && newest_meta=$meta_time
    done

    # Cache valid if newer than all .meta files
    [[ $cache_time -gt $newest_meta ]]
}

# List documents with filters
tdoc_list_docs() {
    local show_preview=false
    local module=""
    local type=""
    local intent=""
    local lifecycle=""
    local tags=""
    local level=""
    local temporal=""
    local sort_mode="relevance"
    local use_color=true
    local numbered=false
    local detailed=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --preview)
                show_preview=true
                shift
                ;;
            --module)
                module="$2"
                shift 2
                ;;
            --type)
                type="$2"
                shift 2
                ;;
            --intent)
                intent="$2"
                shift 2
                ;;
            --lifecycle)
                lifecycle="$2"
                shift 2
                ;;
            --tags)
                tags="$2"
                shift 2
                ;;
            --level)
                level="$2"
                shift 2
                ;;
            --temporal)
                temporal="$2"
                shift 2
                ;;
            --sort)
                sort_mode="$2"
                shift 2
                ;;
            --no-color)
                use_color=false
                shift
                ;;
            --numbered)
                numbered=true
                shift
                ;;
            --detailed)
                detailed=true
                shift
                ;;
            --help|-h)
                cat <<EOF
tdoc list - List documents with filters

USAGE:
  tdoc list [OPTIONS]

OPTIONS:
  --module <name>      Filter by module (comma-separated: rag,midi,tdocs)
  --lifecycle <stage>  Filter by lifecycle (comma-separated: D,W,S,C,X)
  --type <type>        Filter by type (comma-separated: spec,guide,reference)
  --level <level>      Filter by level (L0-L4, L3+, L2-L4)
  --temporal <time>    Filter by time (last:7d, recent:2w, time:2025-11-01)
  --sort <mode>        Sort mode: relevance|time|lifecycle
  --tags <tags>        Filter by tags (comma-separated)
  --preview            Show metadata preview
  --numbered           Show line numbers for selection
  --detailed           Show front matter and content preview
  --no-color           Disable color output

EXAMPLES:
  tdoc list --lifecycle C --type spec
  tdoc list --module rag,midi --lifecycle S,C
  tdoc list --type guide --temporal last:7d
  tdoc list --sort time --preview

EOF
                return 0
                ;;
            *)
                shift
                ;;
        esac
    done

    # Build query
    local query_args=()
    [[ -n "$module" ]] && query_args+=("--module=$module")
    [[ -n "$tags" ]] && query_args+=("--tags=$tags")

    # Parse temporal filter if provided
    local temporal_start=""
    if [[ -n "$temporal" ]]; then
        temporal_start=$(tdoc_parse_temporal "$temporal")
    fi

    # Parse multi-value filters (comma-separated)
    local module_array=()
    [[ -n "$module" ]] && IFS=',' read -ra module_array <<< "$module"

    local type_array=()
    [[ -n "$type" ]] && IFS=',' read -ra type_array <<< "$type"

    local intent_array=()
    [[ -n "$intent" ]] && IFS=',' read -ra intent_array <<< "$intent"

    local lifecycle_array=()
    [[ -n "$lifecycle" ]] && IFS=',' read -ra lifecycle_array <<< "$lifecycle"

    # Check cache (key based on all filter parameters)
    local cache_key="${module}|${type}|${intent}|${lifecycle}|${level}|${temporal}|${sort_mode}"
    if [[ "$cache_key" == "$TDOCS_LIST_CACHE_KEY" ]] && [[ -n "$TDOCS_LIST_CACHE" ]]; then
        # Use cached scored results
        local scored_results=()
        while IFS= read -r line; do
            scored_results+=("$line")
        done <<< "$TDOCS_LIST_CACHE"
    else
        # Build fresh results and cache them
        local results=()
        local scored_results=()
    while IFS= read -r meta; do
        [[ -z "$meta" ]] && continue

        # Extract metadata using jq with fallbacks
        IFS=$'\t' read -r doc_level doc_timestamp doc_module doc_type doc_intent doc_lifecycle <<< \
            "$(_tdocs_json_get_multi "$meta" \
                '.level // .completeness_level' \
                '.updated // .created' \
                '.module' '.type' '.intent' '.lifecycle')"

        # Convert ISO timestamp to Unix epoch if needed
        if [[ "$doc_timestamp" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2} ]]; then
            doc_timestamp=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${doc_timestamp%%.*}" +%s 2>/dev/null || \
                           date -d "${doc_timestamp%%.*}" +%s 2>/dev/null || echo "")
        fi

        # Apply module filter (OR logic)
        if [[ ${#module_array[@]} -gt 0 ]]; then
            local match=false
            for mod in "${module_array[@]}"; do
                if [[ "$mod" == "*" ]] || [[ "$doc_module" == "$mod" ]] || \
                   ([[ "$mod" == "" ]] && [[ -z "$doc_module" ]]); then
                    match=true
                    break
                fi
            done
            [[ "$match" == false ]] && continue
        fi

        # Apply type filter (OR logic)
        if [[ ${#type_array[@]} -gt 0 ]]; then
            local match=false
            for typ in "${type_array[@]}"; do
                if [[ "$doc_type" == "$typ" ]]; then
                    match=true
                    break
                fi
            done
            [[ "$match" == false ]] && continue
        fi

        # Apply intent filter (OR logic)
        if [[ ${#intent_array[@]} -gt 0 ]]; then
            local match=false
            for int in "${intent_array[@]}"; do
                if [[ "$doc_intent" == "$int" ]]; then
                    match=true
                    break
                fi
            done
            [[ "$match" == false ]] && continue
        fi

        # Apply lifecycle filter (OR logic)
        if [[ ${#lifecycle_array[@]} -gt 0 ]]; then
            local match=false
            for lc in "${lifecycle_array[@]}"; do
                if [[ "$doc_lifecycle" == "$lc" ]]; then
                    match=true
                    break
                fi
            done
            [[ "$match" == false ]] && continue
        fi

        # Apply level filter
        if [[ -n "$level" ]]; then
            if ! tdoc_matches_level "$doc_level" "$level"; then
                continue
            fi
        fi

        # Apply temporal filter
        if [[ -n "$temporal_start" ]]; then
            if ! tdoc_matches_temporal "$doc_timestamp" "$temporal_start"; then
                continue
            fi
        fi

        # Calculate relevance score for sorting
        local score=0
        if [[ "$sort_mode" == "relevance" ]]; then
            score=$(tdoc_calculate_relevance "$doc_timestamp" "$doc_level" "$doc_module" "$module")
        elif [[ "$sort_mode" == "time" ]]; then
            score=${doc_timestamp:-0}
        elif [[ "$sort_mode" == "grade" ]]; then
            # Grade priority: A=4, B=3, C=2, X=1
            case "$doc_grade" in
                A) score=4 ;;
                B) score=3 ;;
                C) score=2 ;;
                X) score=1 ;;
                *) score=2 ;;  # Default to C
            esac
        elif [[ "$sort_mode" == "level" ]]; then
            score=${doc_level#L}
            score=${score:-0}
        fi

        # Store with score for sorting
        scored_results+=("${score}|${meta}")
    done < <(tdoc_db_list "${query_args[@]}")

        # Cache the scored results
        TDOCS_LIST_CACHE_KEY="$cache_key"
        TDOCS_LIST_CACHE=$(printf '%s\n' "${scored_results[@]}")
    fi

    # Sort results based on sort_mode
    local sorted_results=()
    if [[ "$sort_mode" == "alpha" ]]; then
        # Alphabetical sort by document path
        while IFS= read -r scored_item; do
            sorted_results+=("${scored_item#*|}")
        done < <(printf '%s\n' "${scored_results[@]}" | sort -t'|' -k2)
    else
        # Numeric sort (descending for relevance/time/level)
        while IFS= read -r scored_item; do
            sorted_results+=("${scored_item#*|}")
        done < <(printf '%s\n' "${scored_results[@]}" | sort -t'|' -k1 -rn)
    fi

    if [[ ${#sorted_results[@]} -eq 0 ]]; then
        echo "No documents found"
        return 0
    fi

    # Clear and populate TDOCS_LAST_LIST if numbered mode
    if [[ "$numbered" == true ]]; then
        TDOCS_LAST_LIST=()
    fi

    # Use metadata as-is (ranks should be pre-calculated during scan)
    local sorted_results_with_ranks=("${sorted_results[@]}")

    # Group results by type (based on base rank)
    local reference_docs=()
    local guide_docs=()
    local notes_docs=()
    local unranked_docs=()

    for meta in "${sorted_results_with_ranks[@]}"; do
        IFS=$'\t' read -r doc_type rank <<< \
            "$(_tdocs_json_get_multi "$meta" '.type' '.rank')"

        # Classify by type
        case "$doc_type" in
            spec|standard|reference)
                reference_docs+=("$meta")
                ;;
            guide|example|integration)
                guide_docs+=("$meta")
                ;;
            bug-fix|investigation|plan|summary|refactor)
                notes_docs+=("$meta")
                ;;
            *)
                if [[ -z "$rank" ]]; then
                    unranked_docs+=("$meta")
                else
                    # Has rank but unknown type, put in guide
                    guide_docs+=("$meta")
                fi
                ;;
        esac
    done

    # Display total count with enhanced information
    local total=$((${#reference_docs[@]} + ${#guide_docs[@]} + ${#notes_docs[@]} + ${#unranked_docs[@]}))

    # Count lifecycle breakdown from results
    local lifecycle_counts=()
    declare -A lifecycle_map=()
    for meta in "${sorted_results_with_ranks[@]}"; do
        local lc=$(_tdocs_json_get "$meta" '.lifecycle' 'W')
        lifecycle_map[$lc]=$((${lifecycle_map[$lc]:-0} + 1))
    done

    # Build lifecycle summary
    local lifecycle_summary=""
    [[ -n "${lifecycle_map[C]}" ]] && lifecycle_summary+="C:${lifecycle_map[C]} "
    [[ -n "${lifecycle_map[S]}" ]] && lifecycle_summary+="S:${lifecycle_map[S]} "
    [[ -n "${lifecycle_map[W]}" ]] && lifecycle_summary+="W:${lifecycle_map[W]} "
    [[ -n "${lifecycle_map[D]}" ]] && lifecycle_summary+="D:${lifecycle_map[D]} "
    [[ -n "${lifecycle_map[X]}" ]] && lifecycle_summary+="X:${lifecycle_map[X]}"

    # Simple display without expensive filesystem scan
    echo "Found ${total} document(s)"

    # Show lifecycle breakdown
    if [[ -n "$lifecycle_summary" ]]; then
        echo "Lifecycle: ${lifecycle_summary}"
    fi
    echo ""

    # Render results by group
    local index=1
    local number_width=5

    # Render all documents in single-line compact format (no group headers)
    local all_docs=()
    all_docs+=("${reference_docs[@]}")
    all_docs+=("${guide_docs[@]}")
    all_docs+=("${notes_docs[@]}")
    all_docs+=("${unranked_docs[@]}")

    for meta in "${all_docs[@]}"; do
        local doc_path=$(_tdocs_json_get "$meta" '.doc_path')

        # Add to list if numbered
        if [[ "$numbered" == true ]]; then
            TDOCS_LAST_LIST+=("$doc_path")
            printf "\033[38;5;111m%3d.\033[0m " "$index"
            ((index++))
        fi

        # Use compact rendering (single line or detailed based on flag)
        tdoc_render_compact "$meta" "$doc_path" "$number_width" "$detailed"
        # Only add newline if not already added by detailed mode
        if [[ "$detailed" != "true" ]]; then
            printf "\n"
        fi
    done

    return 0
}

# Audit documents - find those without metadata
tdoc_audit_docs() {
    echo "Auditing documents for metadata..."
    echo ""

    local missing=()

    # Check top-level docs
    for file in "$TETRA_SRC/docs"/**/*.md; do
        [[ ! -f "$file" ]] && continue

        local meta=$(tdoc_get_metadata "$file")
        if [[ "$meta" == "{}" ]]; then
            missing+=("$file")
        fi
    done

    # Check module docs
    for file in "$TETRA_SRC/bash"/*/docs/**/*.md; do
        [[ ! -f "$file" ]] && continue

        local meta=$(tdoc_get_metadata "$file")
        if [[ "$meta" == "{}" ]]; then
            missing+=("$file")
        fi
    done

    if [[ ${#missing[@]} -eq 0 ]]; then
        echo "✓ All documents have metadata"
        return 0
    fi

    echo "Found ${#missing[@]} document(s) without metadata:"
    echo ""

    for file in "${missing[@]}"; do
        echo "  $file"
    done

    echo ""
    echo "Run 'tdocs init <file>' to add metadata"
    echo "Or run 'tdocs discover' to auto-index all documents"
}

# Scan and index all documents
tdoc_scan_docs() {
    local dry_run="${1:-false}"  # --dry-run to preview only

    echo "Scanning documents..."
    echo ""

    local discovered=()
    local already_indexed=()
    local to_index=()

    # Scan top-level docs
    while IFS= read -r file; do
        [[ ! -f "$file" ]] && continue
        discovered+=("$file")

        local meta=$(tdoc_get_metadata "$file")
        if [[ "$meta" == "{}" ]]; then
            to_index+=("$file")
        else
            already_indexed+=("$file")
        fi
    done < <(find "$TETRA_SRC/docs" -name "*.md" -type f 2>/dev/null)

    # Scan module docs
    while IFS= read -r file; do
        [[ ! -f "$file" ]] && continue
        discovered+=("$file")

        local meta=$(tdoc_get_metadata "$file")
        if [[ "$meta" == "{}" ]]; then
            to_index+=("$file")
        else
            already_indexed+=("$file")
        fi
    done < <(find "$TETRA_SRC/bash" -path "*/docs/*.md" -type f 2>/dev/null)

    echo "Scan Summary:"
    echo "  Total found: ${#discovered[@]}"
    echo "  Already indexed: ${#already_indexed[@]}"
    echo "  Need indexing: ${#to_index[@]}"
    echo ""

    if [[ ${#to_index[@]} -eq 0 ]]; then
        echo "✓ All documents are indexed"
        return 0
    fi

    # Index by default, unless --dry-run
    if [[ "$dry_run" == "--dry-run" ]]; then
        echo "Documents needing indexing:"
        for file in "${to_index[@]}"; do
            local rel_path=${file#$TETRA_SRC/}
            echo "  $rel_path"
        done
        echo ""
        echo "Run 'tdocs scan' to index all"
    else
        echo "Indexing ${#to_index[@]} document(s)..."
        echo ""

        local count=0
        for file in "${to_index[@]}"; do
            # Auto-detect metadata
            local module=$(tdoc_detect_module "$file")
            local type=$(tdoc_suggest_type "$file")
            local tags=$(tdoc_suggest_tags "$file")

            # Auto-detect intent from type
            local intent="document"
            case "$type" in
                spec|specification|reference) intent="define" ;;
                guide) intent="instruct" ;;
                investigation) intent="analyze" ;;
                plan) intent="propose" ;;
            esac

            # Create database entry: tdoc_db_create(path, type, intent, grade, tags, module, level, implements, integrates, grounded_in, related_docs, supersedes)
            local timestamp=$(tdoc_db_create "$file" "$type" "$intent" "C" "$tags" "$module" "" "" "" "" "" "")

            ((count++))
            if (( count % 10 == 0 )); then
                echo "  Indexed $count/${#to_index[@]}..."
            fi
        done

        echo ""
        echo "✓ Indexed ${#to_index[@]} document(s)"
        echo ""
        echo "Note: Documents were indexed without modifying files"
        echo "Use 'tdocs add <file>' to edit metadata for specific files"
    fi
}
