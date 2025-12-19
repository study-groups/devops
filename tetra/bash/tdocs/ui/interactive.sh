#!/usr/bin/env bash

# TDOC Interactive UI
# Interactive tagging and initialization

# Interactive document initialization
tdoc_init_doc() {
    local file=""
    local category=""
    local type=""
    local tags=""
    local module=""
    local interactive=true

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --core)
                category="core"
                interactive=false
                shift
                ;;
            --other)
                category="other"
                interactive=false
                shift
                ;;
            --type)
                type="$2"
                shift 2
                ;;
            --tags)
                tags="$2"
                shift 2
                ;;
            --module)
                module="$2"
                shift 2
                ;;
            --help|-h)
                cat <<EOF
tdoc init - Initialize document with metadata

USAGE:
  tdoc init [OPTIONS] <file>

OPTIONS:
  --core               Mark as core document
  --other              Mark as other (working) document
  --type <type>        Document type
  --tags <tags>        Comma-separated tags
  --module <name>      Module name

EXAMPLES:
  # Interactive mode
  tdoc init bash/rag/docs/NEW_FEATURE.md

  # Non-interactive mode
  tdoc init docs/API_SPEC.md --core --type spec

EOF
                return 0
                ;;
            *)
                file="$1"
                shift
                ;;
        esac
    done

    if [[ -z "$file" ]]; then
        echo "Error: File path required" >&2
        echo "Try: tdoc init --help" >&2
        return 1
    fi

    # Check if file exists
    if [[ ! -f "$file" ]]; then
        echo "Warning: File does not exist: $file"
        printf "Create it? [y/N]: "
        read -r create_confirm
        if [[ ! "$create_confirm" =~ ^[Yy] ]]; then
            echo "Cancelled"
            return 1
        fi
        touch "$file"
    fi

    # Interactive classification if needed
    if [[ "$interactive" == "true" ]] && [[ -z "$category" || -z "$type" ]]; then
        local classification=$(tdoc_classify_interactive "$file")
        if [[ $? -ne 0 ]]; then
            return 1
        fi

        # Parse classification result
        IFS=':' read -r category type tags module <<< "$classification"
    fi

    # Auto-detect missing values
    [[ -z "$category" ]] && category=$(tdoc_suggest_category "$file")
    [[ -z "$type" ]] && type=$(tdoc_suggest_type "$file")
    [[ -z "$tags" ]] && tags=$(tdoc_suggest_tags "$file")
    [[ -z "$module" ]] && module=$(tdoc_detect_module "$file")

    # Add frontmatter to file
    tdoc_write_frontmatter "$file" "$category" "$type" "$tags" "$module" "draft"

    # Create database entry
    local timestamp=$(tdoc_db_create "$file" "$category" "$type" "$tags" "$module" "draft")

    echo ""
    echo "✓ Document initialized"
    echo "  File: $file"
    echo "  Category: $category"
    echo "  Type: $type"
    echo "  Tags: $tags"
    [[ -n "$module" ]] && echo "  Module: $module"
    echo "  Database ID: $timestamp"
}

# Interactive tag editor
tdoc_tag_interactive() {
    local file="$1"

    if [[ -z "$file" ]]; then
        echo "Error: File path required" >&2
        echo "Usage: tdoc tag <file>" >&2
        return 1
    fi

    if [[ ! -f "$file" ]]; then
        echo "Error: File not found: $file" >&2
        return 1
    fi

    # Get current metadata
    local meta=$(tdoc_get_metadata "$file")

    if [[ "$meta" == "{}" ]]; then
        echo "Error: No metadata found for $file" >&2
        echo "Run 'tdoc init $file' first" >&2
        return 1
    fi

    # Extract current values
    local category=$(_tdocs_json_get "$meta" '.category')
    local type=$(_tdocs_json_get "$meta" '.type')
    local module=$(_tdocs_json_get "$meta" '.module')

    # Parse tags array using jq
    local -a current_tags=()
    while IFS= read -r tag; do
        [[ -z "$tag" ]] && continue
        current_tags+=("$tag")
    done < <(echo "$meta" | jq -r '.tags[]? // empty' 2>/dev/null)

    # Interactive editor
    echo "┌─ Tag Editor: $(basename "$file")"
    echo "│"
    echo "│ Category: [$category]  Type: [$type]"
    [[ -n "$module" ]] && echo "│ Module: [$module]"
    echo "│"
    echo "│ Current tags:"

    if [[ ${#current_tags[@]} -eq 0 ]]; then
        echo "│   (none)"
    else
        echo -n "│   "
        for tag in "${current_tags[@]}"; do
            tdoc_render_tag "$tag"
            printf "  "
        done
        echo ""
    fi

    echo "│"
    echo "│ Commands:"
    echo "│   +<tag>  - Add tag"
    echo "│   -<tag>  - Remove tag"
    echo "│   done    - Save and exit"
    echo "│   cancel  - Exit without saving"
    echo "└─"

    local modified=false

    while true; do
        printf "\nCommand: "
        read -r cmd

        case "$cmd" in
            +*)
                local new_tag="${cmd#+}"
                current_tags+=("$new_tag")
                echo "Added: $new_tag"
                modified=true
                ;;
            -*)
                local remove_tag="${cmd#-}"
                local -a filtered=()
                for tag in "${current_tags[@]}"; do
                    [[ "$tag" != "$remove_tag" ]] && filtered+=("$tag")
                done
                current_tags=("${filtered[@]}")
                echo "Removed: $remove_tag"
                modified=true
                ;;
            done)
                break
                ;;
            cancel)
                echo "Cancelled"
                return 0
                ;;
            *)
                echo "Unknown command: $cmd"
                ;;
        esac

        # Show updated tags
        echo -n "Current: "
        for tag in "${current_tags[@]}"; do
            tdoc_render_tag "$tag"
            printf "  "
        done
        echo ""
    done

    if [[ "$modified" == "true" ]]; then
        # Convert array to comma-separated
        local new_tags=$(printf "%s," "${current_tags[@]}" | sed 's/,$//')

        # Update frontmatter
        tdoc_write_frontmatter "$file" "$category" "$type" "$new_tags" "$module" "stable"

        # Update database
        tdoc_db_update "$file" "tags=$new_tags"

        echo ""
        echo "✓ Tags updated"
    else
        echo ""
        echo "No changes made"
    fi
}
