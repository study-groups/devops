#!/usr/bin/env bash

# TDOCS Module Operations
# Module-aware document management and specification tracking

# Get completeness level name from number
tdoc_completeness_name() {
    local level="$1"

    case "$level" in
        0) echo "None" ;;
        1) echo "Minimal" ;;
        2) echo "Working" ;;
        3) echo "Complete" ;;
        4) echo "Exemplar" ;;
        *) echo "Unknown" ;;
    esac
}

# Get completeness level color
tdoc_completeness_color() {
    local level="$1"

    case "$level" in
        0) echo '\033[0;31m' ;;  # Red
        1) echo '\033[0;33m' ;;  # Yellow
        2) echo '\033[0;36m' ;;  # Cyan
        3) echo '\033[0;34m' ;;  # Blue
        4) echo '\033[0;32m' ;;  # Green
        *) echo '\033[0m' ;;     # Default
    esac
}

# Show all documents for a specific module
tdoc_module_docs() {
    local module_name="$1"

    if [[ -z "$module_name" ]]; then
        echo "Usage: tdocs module <module_name>"
        return 1
    fi

    # Colors
    local C_TITLE='\033[1;36m'
    local C_SECTION='\033[1;34m'
    local C_NC='\033[0m'

    echo -e "${C_TITLE}Module: ${module_name}${C_NC}"
    echo ""

    # Get all documents for this module
    local docs=$(tdoc_db_list --module="$module_name")

    if [[ -z "$docs" ]]; then
        echo "No documents found for module: $module_name"
        return 0
    fi

    # Parse and categorize documents
    local spec_doc=""
    local example_docs=()
    local standard_docs=()
    local other_docs=()
    local completeness_level=""

    while IFS= read -r meta_line; do
        [[ -z "$meta_line" ]] && continue

        # Extract fields from JSON
        IFS=$'\t' read -r doc_path type clevel <<< \
            "$(_tdocs_json_get_multi "$meta_line" '.doc_path' '.type' '.completeness_level')"

        # Store completeness level if found
        [[ -n "$clevel" ]] && completeness_level="$clevel"

        # Categorize by type
        case "$type" in
            specification)
                spec_doc="$doc_path"
                ;;
            example)
                example_docs+=("$doc_path")
                ;;
            standard)
                standard_docs+=("$doc_path")
                ;;
            *)
                other_docs+=("$doc_path")
                ;;
        esac
    done <<< "$docs"

    # Display completeness level if available
    if [[ -n "$completeness_level" ]]; then
        local level_name=$(tdoc_completeness_name "$completeness_level")
        local level_color=$(tdoc_completeness_color "$completeness_level")
        echo -e "${C_SECTION}Completeness:${C_NC} ${level_color}L${completeness_level} ${level_name}${C_NC}"
        echo ""
    fi

    # Display specification
    if [[ -n "$spec_doc" ]]; then
        echo -e "${C_SECTION}Specification:${C_NC}"
        echo "  $spec_doc"
        echo ""
    fi

    # Display examples
    if [[ ${#example_docs[@]} -gt 0 ]]; then
        echo -e "${C_SECTION}Examples:${C_NC}"
        for doc in "${example_docs[@]}"; do
            echo "  $doc"
        done
        echo ""
    fi

    # Display standards
    if [[ ${#standard_docs[@]} -gt 0 ]]; then
        echo -e "${C_SECTION}Standards:${C_NC}"
        for doc in "${standard_docs[@]}"; do
            echo "  $doc"
        done
        echo ""
    fi

    # Display other documents
    if [[ ${#other_docs[@]} -gt 0 ]]; then
        echo -e "${C_SECTION}Other:${C_NC}"
        for doc in "${other_docs[@]}"; do
            echo "  $doc"
        done
    fi
}

# Show specification for a module
tdoc_show_spec() {
    local module_name="$1"

    if [[ -z "$module_name" ]]; then
        echo "Usage: tdocs spec <module_name>"
        return 1
    fi

    # Find specification document for this module
    local spec_doc=""
    local docs=$(tdoc_db_list --module="$module_name")

    while IFS= read -r meta_line; do
        [[ -z "$meta_line" ]] && continue

        IFS=$'\t' read -r doc_path type <<< \
            "$(_tdocs_json_get_multi "$meta_line" '.doc_path' '.type')"

        if [[ "$type" == "specification" ]]; then
            spec_doc="$doc_path"
            break
        fi
    done <<< "$docs"

    if [[ -z "$spec_doc" ]]; then
        echo "No specification found for module: $module_name"
        return 1
    fi

    # View the specification
    tdoc_view_doc "$spec_doc"
}

# Audit module specifications
tdoc_audit_specs() {
    local show_missing_only=false
    local show_all=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --missing)
                show_missing_only=true
                shift
                ;;
            --all)
                show_all=true
                shift
                ;;
            *)
                shift
                ;;
        esac
    done

    # Use TDS colors if available, fallback to hardcoded
    if [[ "$TDS_LOADED" == "true" ]]; then
        echo ""
        tds_text_color "content.heading.h2"
        echo "Module Specification Audit"
        reset_color
        echo ""
    else
        echo ""
        echo -e "\033[1;36mModule Specification Audit\033[0m"
        echo ""
    fi

    # Find all modules (directories in bash/)
    local modules=()
    if [[ -d "$TETRA_SRC/bash" ]]; then
        while IFS= read -r module_dir; do
            local module=$(basename "$module_dir")
            modules+=("$module")
        done < <(find "$TETRA_SRC/bash" -maxdepth 1 -mindepth 1 -type d | sort)
    fi

    # Check each module for specification
    local total=0
    local with_spec=0
    local without_spec=0
    local with_spec_modules=()
    local without_spec_modules=()

    for module in "${modules[@]}"; do
        total=$((total + 1))

        # Check if module has a specification document
        local has_spec=false
        local spec_path=""
        local completeness=""
        local in_db=false

        # First check database for specification
        local docs=$(tdoc_db_list --module="$module" 2>/dev/null)

        if [[ -n "$docs" ]]; then
            while IFS= read -r meta_line; do
                [[ -z "$meta_line" ]] && continue

                IFS=$'\t' read -r type doc_path clevel <<< \
                    "$(_tdocs_json_get_multi "$meta_line" '.type' '.doc_path' '.completeness_level')"

                if [[ "$type" == "specification" ]]; then
                    has_spec=true
                    in_db=true
                    spec_path="$doc_path"
                    completeness="$clevel"
                    break
                fi
            done <<< "$docs"
        fi

        # If not in DB, check common spec file locations
        if [[ "$has_spec" == false ]]; then
            local potential_specs=(
                "$TETRA_SRC/bash/$module/MODULE_SPEC.md"
                "$TETRA_SRC/bash/$module/SPECIFICATION.md"
                "$TETRA_SRC/bash/$module/docs/SPECIFICATION.md"
                "$TETRA_SRC/bash/$module/docs/MODULE_SPEC.md"
            )

            for spec_file in "${potential_specs[@]}"; do
                if [[ -f "$spec_file" ]]; then
                    has_spec=true
                    spec_path="$spec_file"
                    break
                fi
            done
        fi

        if [[ "$has_spec" == true ]]; then
            with_spec=$((with_spec + 1))
            with_spec_modules+=("$module:$completeness:$spec_path:$in_db")
        else
            without_spec=$((without_spec + 1))
            without_spec_modules+=("$module")
        fi
    done

    # Display results
    if [[ "$show_missing_only" == false ]]; then
        # Show modules WITH specifications
        if [[ ${#with_spec_modules[@]} -gt 0 ]]; then
            if [[ "$TDS_LOADED" == "true" ]]; then
                tds_text_color "status.success"
                echo "Modules with specifications ($with_spec):"
                reset_color
            else
                echo -e "\033[0;32mModules with specifications ($with_spec):\033[0m"
            fi
            echo ""

            for entry in "${with_spec_modules[@]}"; do
                IFS=':' read -r module completeness spec_path in_db <<< "$entry"

                # Status indicator
                if [[ "$TDS_LOADED" == "true" ]]; then
                    tds_text_color "status.success"
                    printf "  ✓ "
                    reset_color
                else
                    printf "  \033[0;32m✓\033[0m "
                fi

                # Module name (fixed width for alignment)
                printf "%-15s" "$module"

                # Completeness level if available
                if [[ -n "$completeness" ]]; then
                    local level_name=$(tdoc_completeness_name "$completeness")
                    if [[ "$TDS_LOADED" == "true" ]]; then
                        tds_text_color "tdocs.level.$completeness"
                        printf " [L%s %-9s]" "$completeness" "$level_name"
                        reset_color
                    else
                        local level_color=$(tdoc_completeness_color "$completeness")
                        printf " ${level_color}[L%s %-9s]\033[0m" "$completeness" "$level_name"
                    fi
                else
                    printf "               "
                fi

                # Show if not in database
                if [[ "$in_db" == "false" ]]; then
                    if [[ "$TDS_LOADED" == "true" ]]; then
                        tds_text_color "status.warning"
                        printf " (not tracked)"
                        reset_color
                    else
                        printf " \033[0;33m(not tracked)\033[0m"
                    fi
                fi

                echo ""
            done
            echo ""
        fi
    fi

    # Show modules WITHOUT specifications
    if [[ ${#without_spec_modules[@]} -gt 0 ]]; then
        if [[ "$TDS_LOADED" == "true" ]]; then
            tds_text_color "status.error"
            echo "Modules without specifications ($without_spec):"
            reset_color
        else
            echo -e "\033[0;31mModules without specifications ($without_spec):\033[0m"
        fi
        echo ""

        # Show in columns (4 per row)
        local col=0
        for module in "${without_spec_modules[@]}"; do
            if [[ "$TDS_LOADED" == "true" ]]; then
                tds_text_color "status.error"
                printf "  ✗ "
                reset_color
                tds_text_color "text.secondary"
                printf "%-18s" "$module"
                reset_color
            else
                printf "  \033[0;31m✗\033[0m %-18s" "$module"
            fi

            col=$((col + 1))
            if [[ $col -eq 4 ]]; then
                echo ""
                col=0
            fi
        done
        [[ $col -ne 0 ]] && echo ""
        echo ""
    fi

    # Summary
    if [[ "$TDS_LOADED" == "true" ]]; then
        tds_text_color "content.heading.h3"
        printf "Summary: "
        reset_color
        tds_text_color "status.success"
        printf "%d" "$with_spec"
        reset_color
        printf "/"
        printf "%d" "$total"
        printf " modules with specifications"
        echo ""
    else
        echo "Summary: \033[0;32m$with_spec\033[0m/$total modules with specifications"
    fi

    if [[ $without_spec -gt 0 ]] && [[ "$show_missing_only" == false ]]; then
        echo ""
        if [[ "$TDS_LOADED" == "true" ]]; then
            tds_text_color "text.secondary"
            echo "Use --missing to show only modules without specifications"
            reset_color
        else
            echo -e "\033[0;90mUse --missing to show only modules without specifications\033[0m"
        fi
    fi

    echo ""
}

# Export functions
export -f tdoc_completeness_name
export -f tdoc_completeness_color
export -f tdoc_module_docs
export -f tdoc_show_spec
export -f tdoc_audit_specs
