#!/usr/bin/env bash

# MELVIN Knowledge System - Pluggable Knowledge Domains
# Manages context-specific and generic bash knowledge

# Knowledge registry
declare -gA MELVIN_KNOWLEDGE_DOMAINS=()

# Concept storage
declare -gA MELVIN_CONCEPTS=()

# Pattern examples storage
declare -gA MELVIN_PATTERN_EXAMPLES=()

# Register knowledge domain
# Usage: melvin_register_knowledge <domain_name> <loader_function>
melvin_register_knowledge() {
    local domain="$1"
    local loader_func="$2"

    if [[ -z "$domain" ]] || [[ -z "$loader_func" ]]; then
        echo "Error: melvin_register_knowledge requires domain and loader function" >&2
        return 1
    fi

    MELVIN_KNOWLEDGE_DOMAINS["$domain"]="$loader_func"
}

# Load knowledge for context
# Usage: melvin_load_knowledge <context>
melvin_load_knowledge() {
    local context="$1"

    # Always load generic knowledge first
    melvin_load_generic_knowledge

    # Load context-specific knowledge
    if [[ -n "${MELVIN_KNOWLEDGE_DOMAINS[$context]}" ]]; then
        local loader="${MELVIN_KNOWLEDGE_DOMAINS[$context]}"
        if declare -f "$loader" >/dev/null 2>&1; then
            $loader
        fi
    fi
}

# Generic bash knowledge (always available)
melvin_load_generic_knowledge() {
    # Clear existing
    MELVIN_CONCEPTS=()
    MELVIN_PATTERN_EXAMPLES=()

    # Universal bash module patterns
    MELVIN_CONCEPTS["includes_pattern"]="Central includes.sh file for loading module functions and variables"
    MELVIN_CONCEPTS["actions_pattern"]="actions.sh defines user-facing commands and CLI interfaces"
    MELVIN_CONCEPTS["repl_pattern"]="Interactive *_repl.sh provides Read-Eval-Print-Loop interface"
    MELVIN_CONCEPTS["tui_pattern"]="Text UI in *_tui.sh files for full-screen interfaces"
    MELVIN_CONCEPTS["module_structure"]="Organized directory per module with standard files"
    MELVIN_CONCEPTS["testing"]="tests/ directory containing unit and integration tests"
    MELVIN_CONCEPTS["documentation"]="README.md for user docs, DEVNOTES.md for developer notes"
    MELVIN_CONCEPTS["exports"]="export -f for functions, export for variables"

    # Pattern examples
    MELVIN_PATTERN_EXAMPLES["includes_pattern"]="source \"\$MODULE_DIR/includes.sh\""
    MELVIN_PATTERN_EXAMPLES["actions_pattern"]="module_action() { case \"\$1\" in ...; esac }"
    MELVIN_PATTERN_EXAMPLES["repl_pattern"]="while read -e -p 'prompt> ' cmd; do ...; done"
}

# Get concept explanation
# Usage: melvin_get_concept <concept_name>
melvin_get_concept() {
    local concept="$1"

    if [[ -z "$concept" ]]; then
        echo "Error: Concept name required" >&2
        return 1
    fi

    if [[ -n "${MELVIN_CONCEPTS[$concept]}" ]]; then
        echo "${MELVIN_CONCEPTS[$concept]}"
        return 0
    else
        echo "Concept '$concept' not found in current knowledge domain" >&2
        return 1
    fi
}

# List all concepts
# Usage: melvin_list_concepts [filter]
melvin_list_concepts() {
    local filter="${1:-.*}"

    echo "Available Concepts:"
    echo "==================="
    echo ""

    for concept in $(printf '%s\n' "${!MELVIN_CONCEPTS[@]}" | sort); do
        if [[ "$concept" =~ $filter ]]; then
            printf "%-25s - %s\n" "$concept" "${MELVIN_CONCEPTS[$concept]}"
        fi
    done
}

# Get pattern example
# Usage: melvin_get_pattern_example <pattern_name>
melvin_get_pattern_example() {
    local pattern="$1"

    if [[ -n "${MELVIN_PATTERN_EXAMPLES[$pattern]}" ]]; then
        echo "${MELVIN_PATTERN_EXAMPLES[$pattern]}"
        return 0
    else
        return 1
    fi
}

# Add concept dynamically
# Usage: melvin_add_concept <name> <explanation>
melvin_add_concept() {
    local name="$1"
    local explanation="$2"

    if [[ -z "$name" ]] || [[ -z "$explanation" ]]; then
        echo "Error: Name and explanation required" >&2
        return 1
    fi

    MELVIN_CONCEPTS["$name"]="$explanation"
}

# Add pattern example
# Usage: melvin_add_pattern_example <pattern> <example>
melvin_add_pattern_example() {
    local pattern="$1"
    local example="$2"

    if [[ -z "$pattern" ]] || [[ -z "$example" ]]; then
        echo "Error: Pattern and example required" >&2
        return 1
    fi

    MELVIN_PATTERN_EXAMPLES["$pattern"]="$example"
}

# Show concept with context
# Usage: melvin_explain_concept <concept_name>
melvin_explain_concept() {
    local concept="$1"

    if [[ -z "$concept" ]]; then
        echo "Usage: melvin explain concept <concept_name>"
        return 1
    fi

    local explanation=$(melvin_get_concept "$concept")
    if [[ $? -ne 0 ]]; then
        echo "Unknown concept: $concept"
        echo ""
        echo "Try: melvin concepts"
        return 1
    fi

    echo "📚 Concept: $concept"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "$explanation"
    echo ""

    # Show example if available
    local example=$(melvin_get_pattern_example "$concept")
    if [[ $? -eq 0 ]]; then
        echo "Example:"
        echo "  $example"
        echo ""
    fi

    # Show real-world examples from codebase
    melvin_show_concept_examples "$concept"
}

# Find examples of concept in current codebase
# Usage: melvin_show_concept_examples <concept>
melvin_show_concept_examples() {
    local concept="$1"

    # Context-specific example finding
    case "$concept" in
        includes_pattern)
            melvin_find_includes_examples
            ;;
        actions_pattern)
            melvin_find_actions_examples
            ;;
        repl_pattern)
            melvin_find_repl_examples
            ;;
        *)
            # Generic: search for relevant files
            ;;
    esac
}

# Find includes.sh examples
melvin_find_includes_examples() {
    local examples=$(find "$MELVIN_ROOT" -name "includes.sh" -type f 2>/dev/null | head -5)

    if [[ -n "$examples" ]]; then
        echo "Examples from codebase:"
        while IFS= read -r file; do
            local rel_path="${file#$MELVIN_ROOT/}"
            echo "  • $rel_path"
        done <<< "$examples"
        echo ""
    fi
}

# Find actions.sh examples
melvin_find_actions_examples() {
    local examples=$(find "$MELVIN_ROOT" -name "actions.sh" -type f 2>/dev/null | head -5)

    if [[ -n "$examples" ]]; then
        echo "Examples from codebase:"
        while IFS= read -r file; do
            local rel_path="${file#$MELVIN_ROOT/}"
            echo "  • $rel_path"
        done <<< "$examples"
        echo ""
    fi
}

# Find REPL examples
melvin_find_repl_examples() {
    local examples=$(find "$MELVIN_ROOT" -name "*_repl.sh" -type f 2>/dev/null | head -5)

    if [[ -n "$examples" ]]; then
        echo "Examples from codebase:"
        while IFS= read -r file; do
            local rel_path="${file#$MELVIN_ROOT/}"
            echo "  • $rel_path"
        done <<< "$examples"
        echo ""
    fi
}

# List all knowledge domains
melvin_list_knowledge_domains() {
    echo "Registered Knowledge Domains:"
    echo "=============================="
    echo ""

    if [[ ${#MELVIN_KNOWLEDGE_DOMAINS[@]} -eq 0 ]]; then
        echo "No knowledge domains registered"
        return 0
    fi

    for domain in "${!MELVIN_KNOWLEDGE_DOMAINS[@]}"; do
        local loader="${MELVIN_KNOWLEDGE_DOMAINS[$domain]}"
        local status="✓"

        if ! declare -f "$loader" >/dev/null 2>&1; then
            status="✗ (loader not found)"
        fi

        printf "  %-15s %s\n" "$domain" "$status"
    done
}

# Export functions
export -f melvin_register_knowledge
export -f melvin_load_knowledge
export -f melvin_load_generic_knowledge
export -f melvin_get_concept
export -f melvin_list_concepts
export -f melvin_get_pattern_example
export -f melvin_add_concept
export -f melvin_add_pattern_example
export -f melvin_explain_concept
export -f melvin_show_concept_examples
export -f melvin_find_includes_examples
export -f melvin_find_actions_examples
export -f melvin_find_repl_examples
export -f melvin_list_knowledge_domains
