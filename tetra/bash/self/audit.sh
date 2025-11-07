#!/usr/bin/env bash
# audit.sh: Self-inspection and inventory functions

_tetra_self_audit() {
    local detail=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --detail) detail=true; shift ;;
            *) shift ;;
        esac
    done

    # Log start
    self_log_try "audit" "system"

    echo "Tetra Self Audit - $TETRA_DIR"
    echo ""

    # Essential files
    local essential_files=("tetra.sh" "local.sh" "aliases.sh")
    echo "Essential Files:"
    local essential_count=0
    for file in "${essential_files[@]}"; do
        if [[ -e "$TETRA_DIR/$file" ]]; then
            echo "  ✓ $file"
            ((essential_count++))
        fi
    done
    echo "  Total: $essential_count"
    echo ""

    # Runtime data directories (module directories)
    echo "Runtime Data Directories:"
    local runtime_count=0
    for dir in "$TETRA_DIR"/*/; do
        if [[ -d "$dir" ]]; then
            local dirname=$(basename "$dir")
            # Skip special directories
            if [[ "$dirname" != "node_modules" && \
                  "$dirname" != "nvm" && \
                  "$dirname" != "pyenv" && \
                  "$dirname" != "python" ]]; then
                if [[ "$detail" == true ]]; then
                    echo "  $dirname/"
                fi
                ((runtime_count++))
            fi
        fi
    done
    echo "  Total: $runtime_count directories"
    echo ""

    # Dependencies
    echo "Dependencies:"
    local deps=("node_modules" "nvm" "pyenv" "python")
    local dep_count=0
    for dep in "${deps[@]}"; do
        if [[ -e "$TETRA_DIR/$dep" ]]; then
            echo "  ✓ $dep/"
            ((dep_count++))
        fi
    done
    echo "  Total: $dep_count"
    echo ""

    # Garbage files
    echo "Garbage (Testing/Debug):"
    local garbage_patterns=("debug_*.sh" "test_*.sh" "*_safe.sh" "capture_*.sh" "find_*.sh" "preflight_*.sh" "source_with_*.sh")
    local garbage_count=0
    for pattern in "${garbage_patterns[@]}"; do
        for file in "$TETRA_DIR"/$pattern; do
            if [[ -e "$file" ]]; then
                echo "  $(basename "$file")"
                ((garbage_count++))
            fi
        done
    done
    if [[ $garbage_count -eq 0 ]]; then
        echo "  (none - clean!)"
    else
        echo "  Total: $garbage_count files"
    fi
    echo ""

    # Unknown files
    echo "Unknown Files (need review):"
    local unknown_count=0
    for item in "$TETRA_DIR"/{.*,*}; do
        if [[ -e "$item" ]]; then
            local basename=$(basename "$item")
            # Skip known items
            if [[ "$basename" != "." && \
                  "$basename" != ".." && \
                  ! " ${essential_files[@]} " =~ " ${basename} " && \
                  "$basename" != "node_modules" && \
                  "$basename" != "nvm" && \
                  "$basename" != "pyenv" && \
                  "$basename" != "python" && \
                  ! -d "$item" ]]; then
                # Check if it's a garbage file
                local is_garbage=false
                for pattern in "${garbage_patterns[@]}"; do
                    if [[ "$basename" == $pattern ]]; then
                        is_garbage=true
                        break
                    fi
                done
                if [[ "$is_garbage" == false ]]; then
                    echo "  $basename"
                    ((unknown_count++))
                fi
            fi
        fi
    done
    if [[ $unknown_count -eq 0 ]]; then
        echo "  (none)"
    else
        echo "  Total: $unknown_count items"
    fi
    echo ""

    # Summary
    echo "Summary:"
    echo "  Essential: $essential_count"
    echo "  Runtime: $runtime_count"
    echo "  Dependencies: $dep_count"
    echo "  Garbage: $garbage_count"
    echo "  Unknown: $unknown_count"

    # Log success
    local metadata="{\"essential\":$essential_count,\"runtime\":$runtime_count,\"dependencies\":$dep_count,\"garbage\":$garbage_count,\"unknown\":$unknown_count}"
    self_log_success "audit" "system" "$metadata"

    return 0
}

# Export function
export -f _tetra_self_audit
