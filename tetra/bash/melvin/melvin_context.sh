#!/usr/bin/env bash

# MELVIN Context Detection - Universal Project Analysis
# Detects what kind of codebase MELVIN is analyzing

# Global context variables
export MELVIN_ROOT="${MELVIN_ROOT:-.}"
export MELVIN_CONTEXT="${MELVIN_CONTEXT:-unknown}"
export MELVIN_HAS_SELF=0

# Detect project context from directory structure
# Usage: melvin_detect_context [root_path]
# Returns: Context name (tetra, generic, custom)
melvin_detect_context() {
    local root="${1:-.}"

    # Resolve to absolute path
    root="$(cd "$root" 2>/dev/null && pwd)" || return 1

    # Is this tetra? Check multiple patterns
    if [[ -d "$root/bash/boot" ]]; then
        # Has bash/boot directory - strong indicator of tetra
        if [[ -f "$root/tetra.sh" ]] || [[ -f "$root/entrypoints/tetra.sh" ]] || [[ -n "$TETRA_SRC" && "$root" == "$TETRA_SRC" ]]; then
            echo "tetra"
            return 0
        fi
    fi

    # Check if we're inside tetra (subdirectory)
    local check_dir="$root"
    while [[ "$check_dir" != "/" ]]; do
        if [[ -d "$check_dir/bash/boot" ]]; then
            if [[ -f "$check_dir/tetra.sh" ]] || [[ -f "$check_dir/entrypoints/tetra.sh" ]] || [[ -n "$TETRA_SRC" && "$check_dir" == "$TETRA_SRC" ]]; then
                echo "tetra"
                return 0
            fi
        fi
        check_dir="$(dirname "$check_dir")"
    done

    # Check for custom configuration
    if [[ -f "$root/.melvin-config" ]]; then
        source "$root/.melvin-config"
        echo "${MELVIN_CONTEXT:-custom}"
        return 0
    fi

    # Check for .melvinrc in home
    if [[ -f "$HOME/.melvinrc" ]]; then
        source "$HOME/.melvinrc"
        # Check if this root matches a known project
        for project_name in "${!MELVIN_PROJECTS[@]}"; do
            if [[ "${MELVIN_PROJECTS[$project_name]}" == "$root" ]]; then
                echo "$project_name"
                return 0
            fi
        done
    fi

    # Generic bash project
    echo "generic"
}

# Set MELVIN's analysis root
# Usage: melvin_set_root [path]
melvin_set_root() {
    local root="${1:-.}"

    # Resolve to absolute path
    root="$(cd "$root" 2>/dev/null && pwd)"
    if [[ $? -ne 0 ]]; then
        echo "Error: Directory not found: $1" >&2
        return 1
    fi

    export MELVIN_ROOT="$root"
    export MELVIN_CONTEXT=$(melvin_detect_context "$MELVIN_ROOT")

    echo "MELVIN analyzing: $MELVIN_ROOT"
    echo "Context: $MELVIN_CONTEXT"

    # Load context-specific knowledge
    melvin_load_knowledge "$MELVIN_CONTEXT"

    # Check for tetra-self availability
    if [[ "$MELVIN_CONTEXT" == "tetra" ]]; then
        melvin_check_self_availability
    fi
}

# Check if tetra-self is available
melvin_check_self_availability() {
    if [[ -n "$TETRA_SRC" ]] && [[ -f "$TETRA_SRC/bash/self/includes.sh" ]]; then
        MELVIN_HAS_SELF=1
        echo "tetra-self: available"
    else
        MELVIN_HAS_SELF=0
        echo "tetra-self: not available (using generic fallback)"
    fi
}

# Get current context
melvin_get_context() {
    echo "$MELVIN_CONTEXT"
}

# Get current root
melvin_get_root() {
    echo "$MELVIN_ROOT"
}

# Validate context requirements
melvin_validate_context() {
    case "$MELVIN_CONTEXT" in
        tetra)
            if [[ ! -d "$MELVIN_ROOT/bash" ]]; then
                echo "Warning: tetra context but no bash/ directory found" >&2
                return 1
            fi
            ;;
        generic)
            # No specific requirements
            return 0
            ;;
        *)
            # Custom context - check if config exists
            if [[ ! -f "$MELVIN_ROOT/.melvin-config" ]]; then
                echo "Warning: Custom context but no .melvin-config found" >&2
                return 1
            fi
            ;;
    esac
    return 0
}

# Show context information
melvin_context_info() {
    echo "MELVIN Context Information"
    echo "=========================="
    echo ""
    echo "Root directory: $MELVIN_ROOT"
    echo "Context: $MELVIN_CONTEXT"
    echo ""

    case "$MELVIN_CONTEXT" in
        tetra)
            echo "Tetra Project Detected"
            echo "  • tetra.sh: $(ls -1 "$MELVIN_ROOT/tetra.sh" 2>/dev/null && echo "✓" || echo "✗")"
            echo "  • bash/boot: $(ls -d "$MELVIN_ROOT/bash/boot" 2>/dev/null && echo "✓" || echo "✗")"
            echo "  • tetra-self: $([[ $MELVIN_HAS_SELF -eq 1 ]] && echo "available ✓" || echo "not available ✗")"

            if [[ -d "$MELVIN_ROOT/bash" ]]; then
                local module_count=$(find "$MELVIN_ROOT/bash" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
                echo "  • Modules: $module_count"
            fi
            ;;
        generic)
            echo "Generic Bash Project"
            if [[ -d "$MELVIN_ROOT" ]]; then
                local sh_count=$(find "$MELVIN_ROOT" -name "*.sh" -type f 2>/dev/null | wc -l | tr -d ' ')
                echo "  • Shell scripts: $sh_count"

                local dir_count=$(find "$MELVIN_ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
                echo "  • Subdirectories: $dir_count"
            fi
            ;;
        *)
            echo "Custom Context: $MELVIN_CONTEXT"
            if [[ -f "$MELVIN_ROOT/.melvin-config" ]]; then
                echo "  • Configuration: .melvin-config ✓"
            fi
            ;;
    esac

    echo ""
    echo "Loaded knowledge domains:"
    for domain in "${!MELVIN_KNOWLEDGE_DOMAINS[@]}"; do
        echo "  • $domain"
    done
}

# Initialize context (called on module load)
melvin_init_context() {
    # Set default root if not already set
    if [[ "$MELVIN_ROOT" == "." ]]; then
        # Try TETRA_SRC first
        if [[ -n "$TETRA_SRC" ]]; then
            MELVIN_ROOT="$TETRA_SRC"
        else
            MELVIN_ROOT="$(pwd)"
        fi
    fi

    # Detect context
    MELVIN_CONTEXT=$(melvin_detect_context "$MELVIN_ROOT")

    # Load knowledge for context
    melvin_load_knowledge "$MELVIN_CONTEXT"

    # Check tetra-self
    if [[ "$MELVIN_CONTEXT" == "tetra" ]]; then
        melvin_check_self_availability
    fi
}

# Export functions
export -f melvin_detect_context
export -f melvin_set_root
export -f melvin_get_context
export -f melvin_get_root
export -f melvin_validate_context
export -f melvin_context_info
export -f melvin_check_self_availability
export -f melvin_init_context
