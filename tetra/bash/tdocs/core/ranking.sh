#!/usr/bin/env bash

# TDOCS Ranking System
# Type + Lifecycle based ranking with recency boost for fresh docs

# Get base rank by document type (uses constants)
tdoc_get_base_rank() {
    local doc_type="$1"

    # Use constant-based ranking
    local rank=$(tdoc_type_rank "$doc_type")
    if [[ -n "$rank" ]]; then
        echo "$rank"
    else
        # Fallback for unknown types
        echo "0.5"
    fi
}

# Calculate length bonus
tdoc_calculate_length_bonus() {
    local doc_path="$1"

    if [[ ! -f "$doc_path" ]]; then
        echo "0.0"
        return
    fi

    local word_count=$(wc -w < "$doc_path" 2>/dev/null | tr -d ' ')

    if [[ $word_count -gt 1000 ]]; then
        echo "0.02"  # Substantial document
    elif [[ $word_count -gt 500 ]]; then
        echo "0.01"  # Decent size
    else
        echo "0.0"   # Short
    fi
}

# Calculate metadata bonus
tdoc_calculate_metadata_bonus() {
    local has_module="$1"
    local tag_count="$2"

    local bonus=0.0

    # Module bonus
    if [[ -n "$has_module" && "$has_module" != "null" ]]; then
        bonus=$(awk "BEGIN {print $bonus + 0.01}")
    fi

    # Tag richness bonus
    if [[ $tag_count -ge 3 ]]; then
        bonus=$(awk "BEGIN {print $bonus + 0.01}")
    fi

    echo "$bonus"
}

# Calculate recency boost (inverted - boost fresh, not penalize)
tdoc_calculate_recency_boost() {
    local created="$1"
    local timeless="$2"
    local doc_type="$3"

    # No boost for timeless docs
    if [[ "$timeless" == "true" ]]; then
        echo "0.0"
        return
    fi

    # Only temporal doc types get recency boost
    case "$doc_type" in
        bug-fix|investigation|plan|summary|refactor)
            # Calculate days old
            local created_epoch=$(date -j -f "%Y-%m-%d" "$created" "+%s" 2>/dev/null)
            if [[ -z "$created_epoch" ]]; then
                # Try ISO format
                created_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${created%%Z*}" "+%s" 2>/dev/null)
            fi

            if [[ -z "$created_epoch" ]]; then
                echo "0.0"
                return
            fi

            local now=$(date +%s)
            local days_old=$(( (now - created_epoch) / 86400 ))

            # Inverted boost: 0.05 * exp(-days/14)
            # Fresh (day 0): 0.05
            # Week old: ~0.03
            # Two weeks: ~0.02
            # Month: ~0.01
            # Two months: ~0.0
            local boost=$(awk "BEGIN {print 0.05 * exp(-$days_old / 14)}")

            # Round to 2 decimals
            boost=$(printf "%.2f" "$boost")

            echo "$boost"
            ;;
        *)
            # Non-temporal types don't get recency boost
            echo "0.0"
            ;;
    esac
}

# Main ranking calculator
tdoc_calculate_rank() {
    local doc_path="$1"
    local doc_type="$2"
    local timeless="${3:-false}"
    local module="${4:-}"
    local tags="${5:-[]}"
    local created="${6:-$(date +%Y-%m-%d)}"
    local lifecycle="${7:-$TDOC_DEFAULT_LIFECYCLE}"  # NEW: lifecycle parameter

    # Get base rank from type
    local base_rank=$(tdoc_get_base_rank "$doc_type")

    # Get lifecycle multiplier
    local lifecycle_multiplier=$(tdoc_lifecycle_multiplier "$lifecycle")

    # Apply lifecycle multiplier to base rank
    local adjusted_base_rank=$(awk "BEGIN {print $base_rank * $lifecycle_multiplier}")

    # Calculate bonuses
    local length_bonus=$(tdoc_calculate_length_bonus "$doc_path")

    # Count tags (parse JSON array)
    local tag_count=$(echo "$tags" | grep -o ',' | wc -l | tr -d ' ')
    tag_count=$((tag_count + 1))
    if [[ "$tags" == "[]" || "$tags" == "" ]]; then
        tag_count=0
    fi

    local metadata_bonus=$(tdoc_calculate_metadata_bonus "$module" "$tag_count")

    # Calculate recency boost
    local recency_boost=$(tdoc_calculate_recency_boost "$created" "$timeless" "$doc_type")

    # Total rank = adjusted_base + bonuses + recency_boost
    local total_rank=$(awk "BEGIN {print $adjusted_base_rank + $length_bonus + $metadata_bonus + $recency_boost}")

    # Cap at reasonable max (canonical specs can go higher)
    local max_rank="2.0"  # Increased to allow canonical docs to rank higher
    total_rank=$(awk "BEGIN {if ($total_rank > $max_rank) print $max_rank; else print $total_rank}")

    # Round to 2 decimals
    total_rank=$(printf "%.2f" "$total_rank")

    # Return rank and factors as JSON
    cat <<EOF
{
  "rank": $total_rank,
  "base_rank": $base_rank,
  "factors": {
    "type_base": $base_rank,
    "lifecycle_multiplier": $lifecycle_multiplier,
    "adjusted_base": $adjusted_base_rank,
    "length_bonus": $length_bonus,
    "metadata_bonus": $metadata_bonus,
    "recency_boost": $recency_boost
  }
}
EOF
}

# Get rank for a document (from .meta or calculate)
tdoc_get_rank() {
    local doc_path="$1"

    # Get metadata
    local meta_file=$(tdoc_get_db_path "$doc_path")

    if [[ ! -f "$meta_file" ]]; then
        echo "0.0"
        return
    fi

    # Try to get cached rank
    local cached_rank=$(grep -o '"rank": [0-9.]*' "$meta_file" 2>/dev/null | cut -d' ' -f2)

    if [[ -n "$cached_rank" ]]; then
        echo "$cached_rank"
    else
        echo "0.0"
    fi
}

# Show ranking breakdown for a document
tdoc_show_rank_breakdown() {
    local doc_path="$1"

    if [[ ! -f "$doc_path" ]]; then
        echo "Error: File not found: $doc_path" >&2
        return 1
    fi

    # Get metadata
    local meta=$(tdoc_get_metadata "$doc_path")

    if [[ -z "$meta" ]]; then
        echo "No metadata for: $doc_path" >&2
        echo "Run: tdocs add $doc_path" >&2
        return 1
    fi

    local doc_type=$(echo "$meta" | grep -o '"type": "[^"]*"' | cut -d'"' -f4)
    local timeless=$(echo "$meta" | grep -o '"timeless": [^,}]*' | awk '{print $2}' | tr -d ',')
    local module=$(echo "$meta" | grep -o '"module": "[^"]*"' | cut -d'"' -f4)
    local tags=$(echo "$meta" | grep -o '"tags": \[[^\]]*\]')
    local created=$(echo "$meta" | grep -o '"created": "[^"]*"' | cut -d'"' -f4)

    # Calculate rank with breakdown
    local rank_json=$(tdoc_calculate_rank "$doc_path" "$doc_type" "$timeless" "$module" "$tags" "$created")

    local rank=$(echo "$rank_json" | grep -o '"rank": [0-9.]*' | cut -d' ' -f2)
    local base=$(echo "$rank_json" | grep -o '"type_base": [0-9.]*' | cut -d' ' -f2)
    local length=$(echo "$rank_json" | grep -o '"length_bonus": [0-9.]*' | cut -d' ' -f2)
    local metadata=$(echo "$rank_json" | grep -o '"metadata_bonus": [0-9.]*' | cut -d' ' -f2)
    local recency=$(echo "$rank_json" | grep -o '"recency_boost": [0-9.]*' | cut -d' ' -f2)

    # Get word count for display
    local word_count=$(wc -w < "$doc_path" 2>/dev/null | tr -d ' ')

    # Colors
    local C_CYAN='\033[0;36m'
    local C_GRAY='\033[0;90m'
    local C_GREEN='\033[0;32m'
    local C_NC='\033[0m'

    echo -e "${C_CYAN}$(basename "$doc_path")${C_NC}"
    echo ""
    echo -e "type:      ${doc_type}"
    echo -e "timeless:  ${timeless:-no}"
    echo -e "rank:      ${C_GREEN}${rank}${C_NC}"
    echo ""
    echo "Ranking breakdown:"
    printf "  base (%s)    %5s\n" "$doc_type" "$base"
    printf "  length         +%5s  (%s words)\n" "$length" "$word_count"
    printf "  metadata       +%5s  " "$metadata"
    if [[ -n "$module" && "$module" != "null" ]]; then
        echo "(module: $module)"
    else
        echo ""
    fi
    printf "  recency        +%5s  " "$recency"
    if [[ "$timeless" == "true" ]]; then
        echo "(timeless)"
    elif [[ $(awk "BEGIN {print ($recency > 0.01) ? 1 : 0}") -eq 1 ]]; then
        echo "(fresh!)"
    else
        echo ""
    fi
    echo "                 ─────"
    printf "  total           %5s\n" "$rank"
}

# Export functions
export -f tdoc_get_base_rank
export -f tdoc_calculate_length_bonus
export -f tdoc_calculate_metadata_bonus
export -f tdoc_calculate_recency_boost
export -f tdoc_calculate_rank
export -f tdoc_get_rank
export -f tdoc_show_rank_breakdown
