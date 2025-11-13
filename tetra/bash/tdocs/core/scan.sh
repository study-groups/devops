#!/usr/bin/env bash

# TDOCS Scan - Manual discovery of markdown files

# Scan for markdown files in tetra/bash and tetra/docs
tdocs_scan() {
    local C_CYAN='\033[0;36m'
    local C_GREEN='\033[0;32m'
    local C_GRAY='\033[0;90m'
    local C_NC='\033[0m'

    echo -e "Scanning ${C_CYAN}tetra/bash${C_NC} and ${C_CYAN}tetra/docs${C_NC}..."
    echo ""

    # Find all markdown files
    local all_files=()
    while IFS= read -r file; do
        all_files+=("$file")
    done < <(find "$TETRA_SRC/bash" "$TETRA_SRC/docs" -name "*.md" -type f 2>/dev/null)

    local total=${#all_files[@]}
    local indexed=0
    local new=0
    local missing=0
    local new_files=()
    local missing_files=()

    # Check each file
    for file in "${all_files[@]}"; do
        local meta_file=$(tdoc_get_db_path "$file")

        if [[ -f "$meta_file" ]]; then
            # Has metadata - ensure rank is calculated
            indexed=$((indexed + 1))
            tdoc_db_ensure_rank "$file" 2>/dev/null
        else
            # New file without metadata
            new=$((new + 1))
            new_files+=("$file")

            # Create minimal db entry with defaults: type=scratch, intent=document, lifecycle=W (Working)
            tdoc_db_create "$file" "scratch" "document" "$TDOC_DEFAULT_LIFECYCLE" "" "" "" "" "" "" "" "" >/dev/null 2>&1
        fi

        # Check for missing/incomplete metadata
        if [[ -f "$meta_file" ]]; then
            local has_type=$(grep -q '"type"' "$meta_file" && echo "yes" || echo "no")
            if [[ "$has_type" == "no" ]]; then
                missing=$((missing + 1))
                missing_files+=("$file")
            fi
        fi
    done

    echo "Found ${C_GREEN}$total${C_NC} markdown files"
    echo ""
    echo "Indexed:        $indexed"
    echo "New:            $new"
    echo "Missing meta:   $missing"
    echo ""

    # Show new files
    if [[ $new -gt 0 ]]; then
        echo -e "${C_CYAN}New files:${C_NC}"
        for file in "${new_files[@]}"; do
            # Show relative to TETRA_SRC
            local rel_path="${file#$TETRA_SRC/}"
            echo "  $rel_path"
        done
        echo ""
        echo -e "Use ${C_GREEN}tdocs add <file>${C_NC} to add metadata"
    fi

    # Show files with missing metadata
    if [[ $missing -gt 0 ]]; then
        echo ""
        echo -e "${C_GRAY}Files with incomplete metadata:${C_NC}"
        for file in "${missing_files[@]}"; do
            local rel_path="${file#$TETRA_SRC/}"
            echo "  $rel_path"
        done
    fi
}

# Promote document to higher type
tdocs_promote_doc() {
    local doc_path="$1"

    if [[ ! -f "$doc_path" ]]; then
        echo "Error: File not found: $doc_path" >&2
        return 1
    fi

    # Get current metadata
    local meta=$(tdoc_get_metadata "$doc_path")

    if [[ -z "$meta" ]]; then
        echo "Error: No metadata for: $doc_path" >&2
        echo "Run: tdocs add $doc_path" >&2
        return 1
    fi

    local current_type=$(echo "$meta" | grep -o '"type": "[^"]*"' | cut -d'"' -f4)
    local current_timeless=$(echo "$meta" | grep -o '"timeless": [^,}]*' | awk '{print $2}' | tr -d ',')
    local current_rank=$(tdoc_get_rank "$doc_path")

    # Colors
    local C_CYAN='\033[0;36m'
    local C_GREEN='\033[0;32m'
    local C_GRAY='\033[0;90m'
    local C_NC='\033[0m'

    echo -e "${C_CYAN}$(basename "$doc_path")${C_NC}"
    echo ""
    echo "Current:  notes ($current_type, rank $current_rank)"
    echo ""
    echo "Promote to:"
    echo "  [1] guide (proven pattern)"
    echo "  [2] reference (canonical spec)"
    echo ""
    read -p "Choice: " choice

    local new_type=""
    case "$choice" in
        1)
            new_type="guide"
            ;;
        2)
            new_type="reference"
            ;;
        *)
            echo "Cancelled"
            return 0
            ;;
    esac

    # Ask for rename
    echo ""
    read -p "Rename? (optional): " new_name

    # Ask for timeless
    echo ""
    read -p "Make timeless? [Y/n]: " timeless_choice
    local new_timeless="true"
    if [[ "$timeless_choice" == "n" || "$timeless_choice" == "N" ]]; then
        new_timeless="false"
    fi

    # Update metadata
    local updated_meta=$(echo "$meta" | \
        sed "s/\"type\": \"[^\"]*\"/\"type\": \"$new_type\"/" | \
        sed "s/\"timeless\": [^,}]*/\"timeless\": $new_timeless/")

    # If no timeless field exists, add it
    if ! echo "$updated_meta" | grep -q '"timeless"'; then
        updated_meta=$(echo "$updated_meta" | sed 's/}$/, "timeless": '$new_timeless'}/')
    fi

    # Update frontmatter in file
    if tdoc_has_frontmatter "$doc_path"; then
        # Update existing frontmatter
        local temp_file=$(mktemp)
        awk -v type="$new_type" -v timeless="$new_timeless" '
            BEGIN { in_fm=0; }
            /^---$/ {
                if (NR==1) { in_fm=1; print; next; }
                else if (in_fm) { in_fm=0; print; next; }
            }
            in_fm {
                if (/^type:/) { print "type: " type; next; }
                if (/^timeless:/) { print "timeless: " timeless; next; }
                print;
                next;
            }
            !in_fm { print; }
        ' "$doc_path" > "$temp_file"

        # Check if we need to add timeless field
        if ! grep -q "^timeless:" "$temp_file"; then
            # Add timeless after type
            awk -v timeless="$new_timeless" '
                /^type:/ { print; print "timeless: " timeless; next; }
                { print; }
            ' "$temp_file" > "${temp_file}.2"
            mv "${temp_file}.2" "$temp_file"
        fi

        mv "$temp_file" "$doc_path"
    fi

    # Rename if requested
    local final_path="$doc_path"
    if [[ -n "$new_name" ]]; then
        local dir=$(dirname "$doc_path")
        final_path="$dir/$new_name"
        mv "$doc_path" "$final_path"

        # Update database path
        tdoc_db_update "$final_path" "$updated_meta"
    else
        # Just update metadata
        tdoc_db_update "$doc_path" "$updated_meta"
    fi

    # Recalculate rank
    local new_rank=$(tdoc_get_rank "$final_path")

    echo ""
    echo -e "${C_GREEN}✓ promoted${C_NC}"
    echo ""
    echo -e "${C_CYAN}$(basename "$final_path")${C_NC}"
    echo "type:      $new_type"
    echo "timeless:  $new_timeless"
    echo "rank:      $new_rank (was $current_rank)"
}

# Add document with fast defaults (preferred over init)
tdocs_add_doc() {
    local file="$1"

    if [[ -z "$file" ]]; then
        echo "Error: File path required" >&2
        echo "Usage: tdocs add <file>" >&2
        return 1
    fi

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    # Colors
    local C_CYAN='\033[0;36m'
    local C_GREEN='\033[0;32m'
    local C_GRAY='\033[2;37m'
    local C_NC='\033[0m'

    # Auto-detect defaults
    local default_type=$(tdoc_suggest_type "$file" 2>/dev/null || echo "guide")
    local default_tags=$(tdoc_suggest_tags "$file" 2>/dev/null || echo "")
    local default_module=$(tdoc_detect_module "$file" 2>/dev/null || echo "")
    local default_timeless="no"

    # Enhance default tags with date if not present
    if [[ -n "$default_tags" ]]; then
        if ! echo "$default_tags" | grep -q "$(date +%Y-)"; then
            default_tags="${default_tags},$(date +%Y-%m-%d)"
        fi
    else
        default_tags="$(date +%Y-%m-%d)"
    fi

    # Display file and defaults
    echo ""
    echo -e "${C_CYAN}$(basename "$file")${C_NC}"
    echo ""
    echo -e "  type:      ${C_GREEN}${default_type}${C_NC} ✓"
    echo -e "  timeless:  ${C_GREEN}${default_timeless}${C_NC} ✓"
    echo -e "  tags:      ${C_GREEN}${default_tags}${C_NC} ✓"
    if [[ -n "$default_module" ]]; then
        echo -e "  module:    ${C_GREEN}${default_module}${C_NC} ✓"
    fi
    echo ""
    echo -e "${C_GRAY}[enter to accept, or field name to edit]${C_NC}"

    # Single prompt for editing
    read -p "> " field_choice

    # If user wants to edit, allow field-by-field editing
    if [[ -n "$field_choice" ]]; then
        case "$field_choice" in
            type|t)
                echo "Type (spec/guide/reference/bug-fix/investigation/plan/summary):"
                read -p "> " new_type
                [[ -n "$new_type" ]] && default_type="$new_type"
                ;;
            timeless|time)
                echo "Timeless? (yes/no):"
                read -p "> " new_timeless
                [[ -n "$new_timeless" ]] && default_timeless="$new_timeless"
                ;;
            tags)
                echo "Tags (comma-separated):"
                read -p "> " new_tags
                [[ -n "$new_tags" ]] && default_tags="$new_tags"
                ;;
            module|mod|m)
                echo "Module:"
                read -p "> " new_module
                [[ -n "$new_module" ]] && default_module="$new_module"
                ;;
            *)
                echo "Unknown field: $field_choice (using defaults)"
                ;;
        esac
    fi

    # Convert timeless to boolean
    local timeless_bool="false"
    if [[ "$default_timeless" =~ ^[Yy] ]]; then
        timeless_bool="true"
    fi

    # Determine category (deprecated but needed for db)
    local category="other"

    # Auto-detect intent from type
    local default_intent="document"
    case "$default_type" in
        spec|specification|reference) default_intent="define" ;;
        guide) default_intent="instruct" ;;
        investigation) default_intent="analyze" ;;
        plan) default_intent="propose" ;;
    esac

    # Add frontmatter to file if it doesn't have one
    if ! tdoc_has_frontmatter "$file" 2>/dev/null; then
        # Create frontmatter
        local temp_file=$(mktemp)
        cat > "$temp_file" <<EOF
---
type: ${default_type}
intent: ${default_intent}
lifecycle: ${TDOC_DEFAULT_LIFECYCLE:-W}
timeless: ${timeless_bool}
tags: [${default_tags}]
module: ${default_module}
created: $(date +%Y-%m-%dT%H:%M:%SZ)
---

EOF
        cat "$file" >> "$temp_file"
        mv "$temp_file" "$file"
    fi

    # Create database entry: tdoc_db_create(path, type, intent, lifecycle, tags, module, level, implements, integrates, grounded_in, related_docs, supersedes)
    local timestamp=$(tdoc_db_create "$file" "$default_type" "$default_intent" "${TDOC_DEFAULT_LIFECYCLE:-W}" "$default_tags" "$default_module" "" "" "" "" "" "" 2>/dev/null)

    # Ensure rank is calculated
    tdoc_db_ensure_rank "$file" 2>/dev/null

    # Get rank for display
    local rank=$(tdoc_get_rank "$file" 2>/dev/null || echo "0.0")

    echo ""
    echo -e "${C_GREEN}✓ indexed${C_NC}  rank: ${C_GRAY}${rank}${C_NC}"
}

# Export functions
export -f tdocs_scan
export -f tdocs_promote_doc
export -f tdocs_add_doc
