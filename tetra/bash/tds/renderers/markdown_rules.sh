#!/usr/bin/env bash

# TDS Markdown Rules System
# In-place markdown modification with hooks and transformation rules
# Part of Chroma - Terminal Markdown Viewer

# ============================================================================
# HOOK SYSTEM
# ============================================================================

# Hook points during markdown rendering:
# - PRE_RENDER: Before any processing starts
# - POST_HEADING: After each heading is processed
# - PRE_CODE_BLOCK: Before rendering code block
# - POST_CODE_BLOCK: After rendering code block
# - POST_PARAGRAPH: After each paragraph
# - POST_RENDER: After all rendering complete

# Declare associative arrays for hooks
declare -gA CHROMA_HOOKS_PRE_RENDER=()
declare -gA CHROMA_HOOKS_POST_HEADING=()
declare -gA CHROMA_HOOKS_PRE_CODE_BLOCK=()
declare -gA CHROMA_HOOKS_POST_CODE_BLOCK=()
declare -gA CHROMA_HOOKS_POST_PARAGRAPH=()
declare -gA CHROMA_HOOKS_POST_RENDER=()

# Declare array for transformation rules
declare -ga CHROMA_RULES=()

# ============================================================================
# RULE REGISTRATION
# ============================================================================

# Register a transformation rule
# Args: rule_name sed_pattern
# Example: chroma_register_rule "highlight_todo" "s/TODO:/⚠ TODO:/g"
chroma_register_rule() {
    local rule_name="$1"
    local sed_pattern="$2"

    if [[ -z "$rule_name" || -z "$sed_pattern" ]]; then
        echo "Error: chroma_register_rule requires name and pattern" >&2
        return 1
    fi

    CHROMA_RULES+=("$rule_name:$sed_pattern")
}

# Register a hook function
# Args: hook_point function_name
# Example: chroma_register_hook "POST_HEADING" "my_heading_transform"
chroma_register_hook() {
    local hook_point="$1"
    local function_name="$2"

    if [[ -z "$hook_point" || -z "$function_name" ]]; then
        echo "Error: chroma_register_hook requires hook_point and function_name" >&2
        return 1
    fi

    # Verify function exists
    if ! declare -F "$function_name" >/dev/null 2>&1; then
        echo "Error: Function '$function_name' not found" >&2
        return 1
    fi

    case "$hook_point" in
        PRE_RENDER)
            CHROMA_HOOKS_PRE_RENDER["$function_name"]=1
            ;;
        POST_HEADING)
            CHROMA_HOOKS_POST_HEADING["$function_name"]=1
            ;;
        PRE_CODE_BLOCK)
            CHROMA_HOOKS_PRE_CODE_BLOCK["$function_name"]=1
            ;;
        POST_CODE_BLOCK)
            CHROMA_HOOKS_POST_CODE_BLOCK["$function_name"]=1
            ;;
        POST_PARAGRAPH)
            CHROMA_HOOKS_POST_PARAGRAPH["$function_name"]=1
            ;;
        POST_RENDER)
            CHROMA_HOOKS_POST_RENDER["$function_name"]=1
            ;;
        *)
            echo "Error: Unknown hook point '$hook_point'" >&2
            echo "Valid: PRE_RENDER, POST_HEADING, PRE_CODE_BLOCK, POST_CODE_BLOCK, POST_PARAGRAPH, POST_RENDER" >&2
            return 1
            ;;
    esac
}

# ============================================================================
# RULE EXECUTION
# ============================================================================

# Apply all registered rules to text
# Args: text
# Returns: transformed text
chroma_apply_rules() {
    local text="$1"
    local result="$text"

    for rule in "${CHROMA_RULES[@]}"; do
        local rule_name="${rule%%:*}"
        local sed_pattern="${rule#*:}"
        result=$(echo "$result" | sed -E "$sed_pattern")
    done

    echo "$result"
}

# Execute hooks for a given hook point
# Args: hook_point [args...]
chroma_execute_hooks() {
    local hook_point="$1"
    shift
    local hook_array_name="CHROMA_HOOKS_${hook_point}"

    # Get hook array reference
    local -n hooks="$hook_array_name" 2>/dev/null || return 0

    # Execute each registered hook
    for func in "${!hooks[@]}"; do
        if declare -F "$func" >/dev/null 2>&1; then
            "$func" "$@"
        fi
    done
}

# ============================================================================
# BUILT-IN TRANSFORMATION RULES
# ============================================================================

# Highlight TODO/FIXME/NOTE markers
chroma_rule_highlight_markers() {
    local text="$1"
    echo "$text" | sed -E \
        -e 's/TODO:/⚠ TODO:/g' \
        -e 's/FIXME:/🔧 FIXME:/g' \
        -e 's/NOTE:/📝 NOTE:/g' \
        -e 's/IMPORTANT:/❗ IMPORTANT:/g'
}

# Add visual bookmark to H1 headings
chroma_rule_bookmark_h1() {
    local level="$1"
    local text="$2"

    if [[ "$level" == "1" ]]; then
        echo "🔖 $text"
    else
        echo "$text"
    fi
}

# Add section markers for easier navigation
chroma_rule_section_markers() {
    local level="$1"
    local text="$2"

    case "$level" in
        1) echo "━━━ $text ━━━" ;;
        2) echo "─── $text ───" ;;
        *) echo "$text" ;;
    esac
}

# ============================================================================
# RULE PRESETS
# ============================================================================

# Load a preset collection of rules
# Args: preset_name
chroma_load_preset() {
    local preset="$1"

    case "$preset" in
        markers)
            # Highlight common code markers
            chroma_register_rule "todo" "s/TODO:/⚠ TODO:/g"
            chroma_register_rule "fixme" "s/FIXME:/🔧 FIXME:/g"
            chroma_register_rule "note" "s/NOTE:/📝 NOTE:/g"
            ;;

        bookmarks)
            # Add visual bookmarks to headings
            chroma_register_hook "POST_HEADING" "chroma_rule_bookmark_h1"
            ;;

        sections)
            # Add section separators
            chroma_register_hook "POST_HEADING" "chroma_rule_section_markers"
            ;;

        all)
            # Load all presets
            chroma_load_preset "markers"
            chroma_load_preset "bookmarks"
            ;;

        *)
            echo "Error: Unknown preset '$preset'" >&2
            echo "Available: markers, bookmarks, sections, all" >&2
            return 1
            ;;
    esac
}

# ============================================================================
# CLEAR RULES
# ============================================================================

# Clear all registered rules and hooks
chroma_clear_rules() {
    CHROMA_RULES=()
    CHROMA_HOOKS_PRE_RENDER=()
    CHROMA_HOOKS_POST_HEADING=()
    CHROMA_HOOKS_PRE_CODE_BLOCK=()
    CHROMA_HOOKS_POST_CODE_BLOCK=()
    CHROMA_HOOKS_POST_PARAGRAPH=()
    CHROMA_HOOKS_POST_RENDER=()
}

# ============================================================================
# LIST RULES
# ============================================================================

# List all registered rules and hooks
chroma_list_rules() {
    echo "Registered Transformation Rules:"
    if [[ ${#CHROMA_RULES[@]} -eq 0 ]]; then
        echo "  (none)"
    else
        for rule in "${CHROMA_RULES[@]}"; do
            local rule_name="${rule%%:*}"
            local sed_pattern="${rule#*:}"
            echo "  - $rule_name: $sed_pattern"
        done
    fi

    echo ""
    echo "Registered Hooks:"

    for hook_point in PRE_RENDER POST_HEADING PRE_CODE_BLOCK POST_CODE_BLOCK POST_PARAGRAPH POST_RENDER; do
        local hook_array_name="CHROMA_HOOKS_${hook_point}"
        local -n hooks="$hook_array_name" 2>/dev/null || continue

        if [[ ${#hooks[@]} -gt 0 ]]; then
            echo "  $hook_point:"
            for func in "${!hooks[@]}"; do
                echo "    - $func"
            done
        fi
    done
}

# Export functions
export -f chroma_register_rule
export -f chroma_register_hook
export -f chroma_apply_rules
export -f chroma_execute_hooks
export -f chroma_load_preset
export -f chroma_clear_rules
export -f chroma_list_rules
export -f chroma_rule_highlight_markers
export -f chroma_rule_bookmark_h1
export -f chroma_rule_section_markers
