#!/usr/bin/env bash
# Tetra Action Registry
# Lightweight file-based action registration and discovery

# Registry file location
TETRA_ACTION_REGISTRY="${TETRA_DIR}/actions.registry"

# Initialize registry file if it doesn't exist
action_registry_init() {
    if [[ ! -f "$TETRA_ACTION_REGISTRY" ]]; then
        mkdir -p "$(dirname "$TETRA_ACTION_REGISTRY")"
        cat > "$TETRA_ACTION_REGISTRY" <<'EOF'
# Tetra Action Registry
# Format: module.action:description:params:tes_capable
# Example: org.validate:Validate organization structure:[--strict]:yes
EOF
    fi
}

# Register an action
# Usage: action_register module action description params tes_capable
action_register() {
    local module="$1"
    local action="$2"
    local description="$3"
    local params="${4:-}"
    local tes_capable="${5:-no}"

    action_registry_init

    # Remove existing entry if present
    local fqn="${module}.${action}"
    grep -v "^${fqn}:" "$TETRA_ACTION_REGISTRY" > "$TETRA_ACTION_REGISTRY.tmp" 2>/dev/null || true
    mv "$TETRA_ACTION_REGISTRY.tmp" "$TETRA_ACTION_REGISTRY"

    # Add new entry
    echo "${fqn}:${description}:${params}:${tes_capable}" >> "$TETRA_ACTION_REGISTRY"
}

# Check if action exists
# Usage: action_exists module.action
action_exists() {
    local fqn="$1"
    action_registry_init
    grep -q "^${fqn}:" "$TETRA_ACTION_REGISTRY" 2>/dev/null
}

# Get action info
# Usage: action_info module.action
action_info() {
    local fqn="$1"
    action_registry_init

    local line
    line=$(grep "^${fqn}:" "$TETRA_ACTION_REGISTRY" 2>/dev/null | head -1)

    if [[ -z "$line" ]]; then
        echo "Action not found: $fqn" >&2
        return 1
    fi

    # Parse fields
    IFS=':' read -r name desc params tes <<< "$line"

    # Display with TDS colors if available
    if type tds_text_color &>/dev/null; then
        tds_text_color "action.module"
        echo -n "${fqn%%.*}"
        tput sgr0
        tds_text_color "action.separator"
        echo -n "."
        tput sgr0
        tds_text_color "action.name"
        echo -n "${fqn#*.}"
        tput sgr0

        if [[ -n "$params" ]]; then
            echo -n " "
            tds_text_color "action.param"
            echo -n "$params"
            tput sgr0
        fi

        if [[ "$tes" == "yes" ]]; then
            echo -n " "
            tds_text_color "action.tes.prefix"
            echo -n "@"
            tput sgr0
            tds_text_color "action.tes.endpoint"
            echo -n "<endpoint>"
            tput sgr0
        fi

        echo ""
        tds_text_color "action.description"
        echo "  $desc"
        tput sgr0
    else
        # Fallback without colors
        if [[ "$tes" == "yes" ]]; then
            echo "${fqn} ${params} @<endpoint>"
        else
            echo "${fqn} ${params}"
        fi
        echo "  $desc"
    fi
}

# List actions (all or by module)
# Usage: action_list [module]
action_list() {
    local module_filter="$1"
    action_registry_init

    # Skip comment lines
    local pattern="^[^#]"
    if [[ -n "$module_filter" ]]; then
        pattern="^${module_filter}\."
    fi

    grep "$pattern" "$TETRA_ACTION_REGISTRY" 2>/dev/null | while IFS=':' read -r fqn desc params tes; do
        local module="${fqn%%.*}"
        local action="${fqn#*.}"

        if type tds_text_color &>/dev/null; then
            # Colored output
            tds_text_color "action.module"
            echo -n "$module"
            tput sgr0
            tds_text_color "action.separator"
            echo -n "."
            tput sgr0
            tds_text_color "action.name"
            printf "%-20s" "$action"
            tput sgr0

            if [[ -n "$params" ]]; then
                tds_text_color "action.param"
                printf "%-20s" "$params"
                tput sgr0
            else
                printf "%-20s" ""
            fi

            tds_text_color "action.description"
            echo "$desc"
            tput sgr0
        else
            # Plain output
            printf "%-30s %-20s %s\n" "$fqn" "$params" "$desc"
        fi
    done
}

# Get actions for tab completion
# Usage: action_complete_list [module]
action_complete_list() {
    local module_filter="$1"
    action_registry_init

    local pattern="^[^#]"
    if [[ -n "$module_filter" ]]; then
        pattern="^${module_filter}\."
    fi

    grep "$pattern" "$TETRA_ACTION_REGISTRY" 2>/dev/null | cut -d: -f1
}

# Get action parameter signature
# Usage: action_params module.action
action_params() {
    local fqn="$1"
    action_registry_init

    grep "^${fqn}:" "$TETRA_ACTION_REGISTRY" 2>/dev/null | head -1 | cut -d: -f3
}

# Check if action is TES-capable
# Usage: action_is_tes_capable module.action
action_is_tes_capable() {
    local fqn="$1"
    action_registry_init

    local tes
    tes=$(grep "^${fqn}:" "$TETRA_ACTION_REGISTRY" 2>/dev/null | head -1 | cut -d: -f4)
    [[ "$tes" == "yes" ]]
}

# Clear registry (for testing)
action_registry_clear() {
    rm -f "$TETRA_ACTION_REGISTRY"
}

# Export functions
export -f action_registry_init
export -f action_register
export -f action_exists
export -f action_info
export -f action_list
export -f action_complete_list
export -f action_params
export -f action_is_tes_capable
export -f action_registry_clear
