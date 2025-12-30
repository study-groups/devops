#!/usr/bin/env bash
# ctx.sh - Tetra Context Inspector
# Shows all module contexts, schemas, and color configuration
#
# Usage:
#   tetra ctx                 # Show all active contexts
#   tetra ctx <module>        # Show module's context + schema
#   tetra ctx schema <mod>    # Show module's schema only
#   tetra ctx colors          # Show color configuration
#   tetra ctx colors reload   # Reload color config

: "${TETRA_SRC:?TETRA_SRC must be set}"

# Source registry
source "$TETRA_SRC/bash/tetra/context_registry.sh"

# =============================================================================
# DISPLAY FUNCTIONS
# =============================================================================

# Show all active contexts
_tetra_ctx_all() {
    echo "TETRA CONTEXTS"
    echo "=============="
    echo ""

    local found=0
    for mod in $(ctx_modules); do
        if ctx_has_context "$mod"; then
            ctx_format_line "$mod"
            local schema=$(ctx_schema "$mod")
            _ctx_color "muted" "  Schema: $schema"
            echo ""
            echo ""
            found=1
        fi
    done

    if [[ $found -eq 0 ]]; then
        _ctx_color "muted" "No active contexts."
        echo ""
        echo ""
        echo "Set context with module commands:"
        for mod in $(ctx_modules); do
            local schema=$(ctx_schema "$mod")
            echo "  $mod ctx <$schema>"
        done
    fi
}

# Show specific module's context
_tetra_ctx_show_module() {
    local mod="$1"

    if ! ctx_is_module "$mod"; then
        echo "Unknown module: $mod" >&2
        echo "Available: $(ctx_modules | tr '\n' ' ')" >&2
        return 1
    fi

    local mod_upper="${mod^^}"
    local schema=$(ctx_schema "$mod")

    echo "$mod_upper Context"
    printf '=%.0s' {1..20}
    echo ""
    echo ""

    echo "Schema:   $schema"

    # Get current values
    local values
    read -ra values <<< "$(ctx_get_values "$mod")"
    local v1="${values[0]:-_}"
    local v2="${values[1]:-_}"
    local v3="${values[2]:-_}"

    echo -n "Current:  "
    ctx_format_line "$mod"

    echo ""
    echo "Slots:"

    # Get slot names
    IFS=':' read -ra slots <<< "$schema"

    local i=1
    for slot in "${slots[@]}"; do
        local val="${values[$((i-1))]:-_}"
        local desc=$(ctx_slot_desc "$mod" "$i")

        # Get slot color (can't nest ${} so use eval)
        local slot_color_var="CTX_SLOT${i}_COLOR"
        local slot_color="${!slot_color_var:-muted}"

        printf "  %-10s " "$slot"
        _ctx_color "$slot_color" "$val"
        printf "  "
        _ctx_color "muted" "($desc)"
        echo ""
        ((i++))
    done

    echo ""
    echo "Set with: $mod ctx <$schema>"
}

# Show schema only
_tetra_ctx_schema() {
    local mod="$1"

    if [[ -z "$mod" ]]; then
        echo "All Schemas:"
        echo ""
        for m in $(ctx_modules); do
            printf "  %-10s %s\n" "$m:" "$(ctx_schema "$m")"
        done
        return
    fi

    if ! ctx_is_module "$mod"; then
        echo "Unknown module: $mod" >&2
        return 1
    fi

    local schema=$(ctx_schema "$mod")
    echo "$mod: $schema"
    echo ""

    IFS=':' read -ra slots <<< "$schema"
    local i=1
    for slot in "${slots[@]}"; do
        local desc=$(ctx_slot_desc "$mod" "$i")
        printf "  slot%d: %-12s %s\n" "$i" "$slot" "$desc"
        ((i++))
    done
}

# Show color configuration
_tetra_ctx_colors() {
    local subcmd="${1:-show}"

    case "$subcmd" in
        reload)
            ctx_colors_reload
            ;;
        show|"")
            echo "Context Color Configuration"
            echo "============================"
            echo ""
            echo "Config: $CTX_COLORS_FILE"
            echo ""

            echo "Module Prefix Colors:"
            for mod in $(ctx_modules); do
                local mod_upper="${mod^^}"
                local var="${mod_upper}_CTX_COLOR"
                local color="${!var:-primary}"
                printf "  "
                _ctx_color "$color" "$mod_upper"
                printf "%*s → %s\n" "$((10 - ${#mod_upper}))" "" "$color"
            done
            echo ""

            echo "Slot Colors:"
            printf "  Slot1: %s\n" "${CTX_SLOT1_COLOR:-primary}"
            printf "  Slot2: %s\n" "${CTX_SLOT2_COLOR:-secondary}"
            printf "  Slot3: %s (semantic)\n" "${CTX_SLOT3_COLOR:-muted}"
            echo ""

            echo "Environment Colors (slot3):"
            for env in PROD STAGING DEV LOCAL QA; do
                local var="CTX_ENV_${env}"
                local color="${!var:-muted}"
                printf "  %-10s → " "$env"
                _ctx_color "$color" "$color"
                echo ""
            done
            ;;
        *)
            echo "Usage: tetra ctx colors [show|reload]" >&2
            return 1
            ;;
    esac
}

# Help
_tetra_ctx_help() {
    cat <<'EOF'
tetra ctx - Context Inspector

USAGE
  tetra ctx                 Show all active contexts
  tetra ctx all             Same as above
  tetra ctx <module>        Show module's context + schema
  tetra ctx schema          List all schemas
  tetra ctx schema <mod>    Show module's schema
  tetra ctx colors          Show color configuration
  tetra ctx colors reload   Reload color config from file
  tetra ctx help            This help

MODULES
EOF
    for mod in $(ctx_modules); do
        local schema=$(ctx_schema "$mod")
        printf "  %-10s %s\n" "$mod" "$schema"
    done

    cat <<'EOF'

SETTING CONTEXT
  Each module manages its own context:
    tsm ctx <service:instance:env>
    tdocs ctx <project:topic:subtopic>
    deploy ctx <org:target:env>

COLOR CONFIG
  Central config: ~/tetra/orgs/tetra/config/context_colors.env
  Uses TDS semantic tokens (primary, secondary, error, etc.)

EXAMPLES
  tetra ctx                  Show all active contexts
  tetra ctx tsm              Show TSM context + schema
  tetra ctx schema deploy    Show deploy schema only
  tetra ctx colors reload    Reload after editing config
EOF
}

# =============================================================================
# MAIN DISPATCHER
# =============================================================================

tetra_ctx() {
    local cmd="${1:-all}"
    shift 2>/dev/null || true

    case "$cmd" in
        all|show|"")
            _tetra_ctx_all
            ;;
        schema|schemas)
            _tetra_ctx_schema "$@"
            ;;
        colors|color)
            _tetra_ctx_colors "$@"
            ;;
        help|-h|--help)
            _tetra_ctx_help
            ;;
        *)
            # Check if it's a module name
            if ctx_is_module "$cmd"; then
                _tetra_ctx_show_module "$cmd"
            else
                echo "Unknown command or module: $cmd" >&2
                echo "Use 'tetra ctx help' for usage" >&2
                return 1
            fi
            ;;
    esac
}

# =============================================================================
# LEGACY SUPPORT (deprecated)
# =============================================================================

# Keep tetra_ctx_prompt for backward compat with REPLs
tetra_ctx_prompt() {
    local org="${TETRA_CTX_ORG:-_}"
    local proj="${TETRA_CTX_PROJECT:-_}"
    local topic="${TETRA_CTX_TOPIC:-_}"
    printf 'TETRA[%s:%s:%s]' "$org" "$proj" "$topic"
}

# Deprecation wrapper for old set syntax
_tetra_ctx_deprecated_set() {
    echo "DEPRECATED: 'tetra ctx <value>' is deprecated." >&2
    echo "Use module-specific commands instead:" >&2
    echo "  tsm ctx <service:instance:env>" >&2
    echo "  tdocs ctx <project:topic:subtopic>" >&2
    echo "" >&2
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f tetra_ctx tetra_ctx_prompt
export -f _tetra_ctx_all _tetra_ctx_show_module _tetra_ctx_schema
export -f _tetra_ctx_colors _tetra_ctx_help
