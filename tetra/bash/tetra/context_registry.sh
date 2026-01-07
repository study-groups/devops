#!/usr/bin/env bash
# context_registry.sh - Central registry for module context schemas
# Provides query functions for tetra ctx inspector

: "${TETRA_SRC:?TETRA_SRC must be set}"

# =============================================================================
# COLOR CONFIG
# =============================================================================

CTX_COLORS_FILE="${HOME}/tetra/orgs/tetra/config/context_colors.env"

# Load color config
_ctx_load_colors() {
    [[ -f "$CTX_COLORS_FILE" ]] && source "$CTX_COLORS_FILE"
}

# Reload colors
ctx_colors_reload() {
    _ctx_load_colors
    echo "Reloaded: $CTX_COLORS_FILE"
}

# =============================================================================
# SCHEMA REGISTRY
# Maps module name -> schema string (slot1:slot2:slot3)
# =============================================================================

declare -gA CTX_SCHEMAS=(
    [tetra]="org:project:env"
    [tsm]="service:instance:env"
    [tdocs]="project:topic:subtopic"
    [deploy]="org:target:env"
    [tut]="org:subject:type"
    [games]="org:project:subject"
    [spaces]="org:bucket:path"
)

# Slot descriptions per module
declare -gA CTX_SLOT_DESC=(
    [tetra.1]="Organization name"
    [tetra.2]="Project/module name"
    [tetra.3]="Environment (dev, staging, prod)"

    [tsm.1]="Service name"
    [tsm.2]="Instance identifier"
    [tsm.3]="Environment (dev, staging, prod)"

    [tdocs.1]="Project name"
    [tdocs.2]="Documentation topic"
    [tdocs.3]="Subtopic or section"

    [deploy.1]="Organization name"
    [deploy.2]="Deployment target"
    [deploy.3]="Environment (dev, staging, prod)"

    [tut.1]="Organization name"
    [tut.2]="Tutorial subject"
    [tut.3]="Type (ref, guide, thesis)"

    [games.1]="Organization name"
    [games.2]="Game project"
    [games.3]="Subject/mode"

    [spaces.1]="Organization (tetra.toml source)"
    [spaces.2]="Bucket name"
    [spaces.3]="Path prefix"
)

# =============================================================================
# QUERY FUNCTIONS
# =============================================================================

# Get schema for a module
# Usage: ctx_schema <module>
ctx_schema() {
    local mod="$1"
    echo "${CTX_SCHEMAS[$mod]:-}"
}

# List all context-aware modules
ctx_modules() {
    printf '%s\n' "${!CTX_SCHEMAS[@]}" | sort
}

# Check if module has context support
ctx_is_module() {
    local mod="$1"
    [[ -n "${CTX_SCHEMAS[$mod]:-}" ]]
}

# Get slot names as array
# Usage: ctx_slots <module>
ctx_slots() {
    local mod="$1"
    local schema="${CTX_SCHEMAS[$mod]:-}"
    [[ -z "$schema" ]] && return 1
    IFS=':' read -ra slots <<< "$schema"
    printf '%s\n' "${slots[@]}"
}

# Get slot description
# Usage: ctx_slot_desc <module> <slot_num>
ctx_slot_desc() {
    local mod="$1"
    local num="$2"
    echo "${CTX_SLOT_DESC[$mod.$num]:-Slot $num}"
}

# =============================================================================
# COLOR RESOLUTION
# =============================================================================

# Get module prefix color (TDS token or ANSI fallback)
# Usage: ctx_module_color <module>
ctx_module_color() {
    local mod="$1"
    local mod_upper="${mod^^}"
    local var="${mod_upper}_CTX_COLOR"
    local ansi_var="${mod_upper}_CTX_ANSI"

    # Try TDS token first
    local token="${!var:-primary}"

    # If TDS available, resolve token
    if declare -f tds_semantic_color &>/dev/null; then
        tds_semantic_color "$token"
    else
        # Fallback to ANSI code
        echo "${!ansi_var:-7}"
    fi
}

# Get slot color based on position and value
# Usage: ctx_slot_color <slot_num> [value]
ctx_slot_color() {
    local num="$1"
    local value="${2:-}"
    local var="CTX_SLOT${num}_COLOR"
    local token="${!var:-muted}"

    # For slot3 (env), check semantic colors based on value
    if [[ "$num" == "3" && -n "$value" ]]; then
        local val_upper="${value^^}"
        local env_var="CTX_ENV_${val_upper}"
        [[ -n "${!env_var:-}" ]] && token="${!env_var}"
    fi

    # Resolve TDS token
    if declare -f tds_semantic_color &>/dev/null; then
        tds_semantic_color "$token"
    else
        echo "$token"
    fi
}

# =============================================================================
# CONTEXT VALUE GETTERS
# Query module's current context values via TPS
# =============================================================================

# Get module's current context values
# Usage: ctx_get_values <module>
# Returns: slot1 slot2 slot3 (space-separated)
ctx_get_values() {
    local mod="$1"
    local mod_upper="${mod^^}"

    # Try unified TPS API first
    if declare -f tps_ctx &>/dev/null; then
        local org proj subj
        org=$(tps_ctx get "$mod" org 2>/dev/null)
        proj=$(tps_ctx get "$mod" project 2>/dev/null)
        subj=$(tps_ctx get "$mod" subject 2>/dev/null)
        echo "$org" "$proj" "$subj"
        return
    fi

    # Try module-specific variables
    local org_var="${mod_upper}_CTX_ORG"
    local proj_var="${mod_upper}_CTX_PROJECT"
    local subj_var="${mod_upper}_CTX_SUBJECT"

    # Handle deploy's non-standard naming
    [[ "$mod" == "deploy" ]] && {
        proj_var="${mod_upper}_CTX_TARGET"
        subj_var="${mod_upper}_CTX_ENV"
    }

    # Handle tetra's topic naming
    [[ "$mod" == "tetra" ]] && subj_var="${mod_upper}_CTX_TOPIC"

    echo "${!org_var:-}" "${!proj_var:-}" "${!subj_var:-}"
}

# Check if module has any context set
# Usage: ctx_has_context <module>
ctx_has_context() {
    local mod="$1"
    local values
    read -ra values <<< "$(ctx_get_values "$mod")"
    [[ -n "${values[0]}" || -n "${values[1]}" || -n "${values[2]}" ]]
}

# =============================================================================
# DISPLAY HELPERS
# =============================================================================

# Apply color to text (TDS or ANSI fallback)
_ctx_color() {
    local token="$1"
    local text="$2"

    if declare -f tds_color &>/dev/null; then
        tds_color "$token" "$text"
    else
        # ANSI fallback
        local code=""
        case "$token" in
            primary)   code="36" ;;
            secondary) code="32" ;;
            muted)     code="90" ;;
            error)     code="31" ;;
            warning)   code="33" ;;
            success)   code="32" ;;
            info)      code="34" ;;
            pending)   code="35" ;;
            *)         code="0" ;;
        esac
        printf '\e[%sm%s\e[0m' "$code" "$text"
    fi
}

# Format context line with colors
# Usage: ctx_format_line <module>
ctx_format_line() {
    local mod="$1"
    local mod_upper="${mod^^}"
    local schema="${CTX_SCHEMAS[$mod]:-}"
    [[ -z "$schema" ]] && return 1

    local values
    read -ra values <<< "$(ctx_get_values "$mod")"

    local v1="${values[0]:-_}"
    local v2="${values[1]:-_}"
    local v3="${values[2]:-_}"

    # Get colors
    local prefix_color_var="${mod_upper}_CTX_COLOR"
    local prefix_color="${!prefix_color_var:-primary}"

    # Build colored output
    _ctx_color "$prefix_color" "$mod_upper"
    printf "["
    _ctx_color "${CTX_SLOT1_COLOR:-primary}" "$v1"
    printf ":"
    _ctx_color "${CTX_SLOT2_COLOR:-secondary}" "$v2"
    printf ":"

    # Slot3 with env-aware coloring
    local slot3_color="${CTX_SLOT3_COLOR:-muted}"
    if [[ "$v3" != "_" ]]; then
        local v3_upper="${v3^^}"
        local env_var="CTX_ENV_${v3_upper}"
        [[ -n "${!env_var:-}" ]] && slot3_color="${!env_var}"
    fi
    _ctx_color "$slot3_color" "$v3"
    printf "]\n"
}

# =============================================================================
# INITIALIZATION
# =============================================================================

_ctx_load_colors

# =============================================================================
# EXPORTS
# =============================================================================

export CTX_COLORS_FILE
export -f ctx_schema ctx_modules ctx_is_module ctx_slots ctx_slot_desc
export -f ctx_module_color ctx_slot_color
export -f ctx_get_values ctx_has_context
export -f ctx_format_line ctx_colors_reload
export -f _ctx_color _ctx_load_colors
