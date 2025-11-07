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

        local meta=$(cat "$meta_file")
        local doc_path=$(echo "$meta" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)

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

    echo "Found ${#results[@]} result(s):"
    echo ""

    # Render results
    for meta in "${results[@]}"; do
        tdoc_render_compact "$meta" "$(echo "$meta" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)"
        echo ""
    done
}

# List documents with filters
tdoc_list_docs() {
    local show_preview=false
    local category=""
    local module=""
    local authority=""
    local doc_type=""
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
            --core)
                category="core"
                shift
                ;;
            --other)
                category="other"
                shift
                ;;
            --module)
                module="$2"
                shift 2
                ;;
            --authority)
                authority="$2"
                shift 2
                ;;
            --type)
                doc_type="$2"
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
  --authority <auth>   Filter by authority (comma-separated: canonical,stable,working)
  --type <type>        Filter by type (comma-separated: spec,guide,reference)
  --level <level>      Filter by level (L0-L4, L3+, L2-L4)
  --temporal <time>    Filter by time (last:7d, recent:2w, time:2025-11-01)
  --sort <mode>        Sort mode: relevance|time|authority|grade
  --tags <tags>        Filter by tags (comma-separated)
  --preview            Show metadata preview
  --numbered           Show line numbers for selection
  --detailed           Show front matter and content preview
  --no-color           Disable color output

EXAMPLES:
  tdoc list --authority canonical --type spec
  tdoc list --module rag,midi --authority stale
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
    [[ -n "$category" ]] && query_args+=("--category=$category")
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

    local authority_array=()
    [[ -n "$authority" ]] && IFS=',' read -ra authority_array <<< "$authority"

    local type_array=()
    [[ -n "$doc_type" ]] && IFS=',' read -ra type_array <<< "$doc_type"

    # Get documents from database
    local results=()
    local scored_results=()
    while IFS= read -r meta; do
        [[ -z "$meta" ]] && continue

        # Extract document metadata for filtering
        local doc_level=$(echo "$meta" | jq -r '.level // .completeness_level // ""' 2>/dev/null)
        local doc_timestamp=$(echo "$meta" | jq -r '.updated // .created // ""' 2>/dev/null)
        local doc_module=$(echo "$meta" | jq -r '.module // ""' 2>/dev/null)
        local doc_authority=$(echo "$meta" | jq -r '.authority // ""' 2>/dev/null)
        local doc_doc_type=$(echo "$meta" | jq -r '.doc_type // .type // ""' 2>/dev/null)
        local doc_grade=$(echo "$meta" | jq -r '.grade // ""' 2>/dev/null)

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

        # Apply authority filter (OR logic)
        if [[ ${#authority_array[@]} -gt 0 ]]; then
            local match=false
            for auth in "${authority_array[@]}"; do
                if [[ "$doc_authority" == "$auth" ]]; then
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
                if [[ "$doc_doc_type" == "$typ" ]]; then
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
        elif [[ "$sort_mode" == "authority" ]]; then
            # Authority priority: canonical=5, stable=4, working=3, draft=2, stale=1, archived=0
            case "$doc_authority" in
                canonical) score=5 ;;
                stable) score=4 ;;
                working) score=3 ;;
                draft) score=2 ;;
                stale) score=1 ;;
                *) score=0 ;;
            esac
        elif [[ "$sort_mode" == "grade" ]]; then
            # Grade priority: A=4, B=3, C=2, X=1, none=0
            case "$doc_grade" in
                A) score=4 ;;
                B) score=3 ;;
                C) score=2 ;;
                X) score=1 ;;
                *) score=0 ;;
            esac
        elif [[ "$sort_mode" == "level" ]]; then
            score=${doc_level#L}
            score=${score:-0}
        fi

        # Store with score for sorting
        scored_results+=("${score}|${meta}")
    done < <(tdoc_db_list "${query_args[@]}")

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

    echo "Found ${#sorted_results[@]} document(s):"
    echo ""

    # Clear and populate TDOCS_LAST_LIST if numbered mode
    if [[ "$numbered" == true ]]; then
        TDOCS_LAST_LIST=()
    fi

    # Render results
    local index=1
    local number_width=0

    # Calculate number width (for 3-digit numbers: "  1. " = 5 chars)
    if [[ "$numbered" == true ]]; then
        number_width=5
    fi

    for meta in "${sorted_results[@]}"; do
        local doc_path=$(echo "$meta" | jq -r '.doc_path // ""' 2>/dev/null)
        [[ -z "$doc_path" ]] && doc_path=$(echo "$meta" | grep -o '"doc_path": "[^"]*"' | cut -d'"' -f4)

        # Add to list if numbered
        if [[ "$numbered" == true ]]; then
            TDOCS_LAST_LIST+=("$doc_path")
        fi

        # Print number prefix if numbered
        if [[ "$numbered" == true ]]; then
            printf "\033[38;5;111m%3d.\033[0m " "$index"
        fi

        if [[ "$detailed" == true ]]; then
            tdoc_render_detailed "$meta" "$doc_path"
        elif [[ "$show_preview" == "true" ]]; then
            tdoc_render_list_with_preview "$meta"
        else
            tdoc_render_compact "$meta" "$doc_path" "$number_width"
        fi

        printf "\n"
        ((index++))
    done
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

# Auto-discover and index all documents
tdoc_discover_docs() {
    local auto_init="${1:-false}"  # --auto-init to automatically initialize all

    echo "Discovering documents..."
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

    echo "Discovery Summary:"
    echo "  Total found: ${#discovered[@]}"
    echo "  Already indexed: ${#already_indexed[@]}"
    echo "  Need indexing: ${#to_index[@]}"
    echo ""

    if [[ ${#to_index[@]} -eq 0 ]]; then
        echo "✓ All documents are indexed"
        return 0
    fi

    # Auto-init if requested
    if [[ "$auto_init" == "--auto-init" ]]; then
        echo "Auto-indexing ${#to_index[@]} document(s)..."
        echo ""

        local count=0
        for file in "${to_index[@]}"; do
            # Auto-detect metadata
            local module=$(tdoc_detect_module "$file")
            local category=$(tdoc_suggest_category "$file")
            local type=$(tdoc_suggest_type "$file")
            local tags=$(tdoc_suggest_tags "$file")

            # Create database entry without modifying the file
            local timestamp=$(tdoc_db_create "$file" "$category" "$type" "$tags" "$module" "discovered")

            ((count++))
            if (( count % 10 == 0 )); then
                echo "  Indexed $count/${#to_index[@]}..."
            fi
        done

        echo ""
        echo "✓ Indexed ${#to_index[@]} document(s)"
        echo ""
        echo "Note: Documents were indexed without modifying files"
        echo "Use 'tdocs init <file>' to add frontmatter to specific files"
    else
        echo "Documents needing indexing:"
        for file in "${to_index[@]}"; do
            local rel_path=${file#$TETRA_SRC/}
            echo "  $rel_path"
        done
        echo ""
        echo "Run 'tdocs discover --auto-init' to automatically index all"
    fi
}
