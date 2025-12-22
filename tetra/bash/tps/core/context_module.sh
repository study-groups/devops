#!/usr/bin/env bash
# core/context_module.sh - Module context integration helper
#
# Reduces ~200 LOC of boilerplate across modules (deploy, tdocs, tut)
# to single registration calls.
#
# Usage:
#   tps_context_module_init <module> <prefix> <priority> <color>
#
# Example:
#   tps_context_module_init deploy DEPLOY 10 1    # red
#   tps_context_module_init tdocs TDOCS 20 4      # blue
#   tps_context_module_init tut TUT 30 2          # green
#
# This generates for each module:
#   - Provider functions: _${module}_prompt_{org,project,subject}
#   - Registration: _${module}_register_prompt, _${module}_unregister_prompt
#   - Persistence: _${module}_ctx_save, _${module}_ctx_load
#   - State check: _${module}_has_context
#
# Modules must define these variables before calling:
#   ${MODULE}_CTX_ORG, ${MODULE}_CTX_PROJECT, ${MODULE}_CTX_SUBJECT
#   ${MODULE}_CTX_FILE (persistence file path)
#   ${MODULE}_TPS_REGISTERED (initialized to 0)

# =============================================================================
# INPUT VALIDATION
# =============================================================================

# Validate module/prefix names to prevent shell injection
# Only allows alphanumeric and underscore (valid bash identifier chars)
_tps_validate_identifier() {
    local name="$1"
    local type="$2"
    if [[ ! "$name" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
        echo "tps_context_module_init: invalid $type '$name' (must be valid identifier)" >&2
        return 1
    fi
    return 0
}

# Validate numeric parameters
_tps_validate_number() {
    local value="$1"
    local name="$2"
    local min="${3:-0}"
    local max="${4:-99}"
    if [[ ! "$value" =~ ^[0-9]+$ ]] || (( value < min || value > max )); then
        echo "tps_context_module_init: invalid $name '$value' (must be $min-$max)" >&2
        return 1
    fi
    return 0
}

# =============================================================================
# MODULE INITIALIZATION
# =============================================================================

# Initialize context module with TPS integration
# Args: module prefix priority color
# Colors: 1=red, 2=green, 3=yellow, 4=blue, 5=magenta, 6=cyan, 7=white
tps_context_module_init() {
    local module="$1"
    local prefix="$2"
    local priority="${3:-50}"
    local color="${4:-7}"

    # SECURITY: Validate all inputs before using in eval
    _tps_validate_identifier "$module" "module" || return 1
    _tps_validate_identifier "$prefix" "prefix" || return 1
    _tps_validate_number "$priority" "priority" 0 99 || return 1
    _tps_validate_number "$color" "color" 1 8 || return 1

    local MODULE="${module^^}"  # Uppercase version

    # Generate provider functions
    eval "_${module}_prompt_org() { echo \"\${${MODULE}_CTX_ORG:-}\"; }"
    eval "_${module}_prompt_project() { echo \"\${${MODULE}_CTX_PROJECT:-}\"; }"
    eval "_${module}_prompt_subject() { echo \"\${${MODULE}_CTX_SUBJECT:-}\"; }"

    # Generate has_context check
    eval "_${module}_has_context() {
        [[ -n \"\${${MODULE}_CTX_ORG:-}\" || -n \"\${${MODULE}_CTX_PROJECT:-}\" || -n \"\${${MODULE}_CTX_SUBJECT:-}\" ]]
    }"

    # Generate register function
    eval "_${module}_register_prompt() {
        [[ \$${MODULE}_TPS_REGISTERED -eq 1 ]] && return
        if type tps_register_context_line &>/dev/null; then
            tps_register_context_line ${module} ${prefix} ${priority} ${color}
            tps_register_context org _${module}_prompt_org ${module}
            tps_register_context project _${module}_prompt_project ${module}
            tps_register_context subject _${module}_prompt_subject ${module}
            ${MODULE}_TPS_REGISTERED=1
        fi
    }"

    # Generate unregister function
    eval "_${module}_unregister_prompt() {
        [[ \$${MODULE}_TPS_REGISTERED -eq 0 ]] && return
        if type tps_unregister_context_line &>/dev/null; then
            tps_unregister_context_line ${module}
            ${MODULE}_TPS_REGISTERED=0
        fi
    }"

    # Generate save function
    eval "_${module}_ctx_save() {
        mkdir -p \"\$(dirname \"\$${MODULE}_CTX_FILE\")\"
        cat > \"\$${MODULE}_CTX_FILE\" <<CTXEOF
${MODULE}_CTX_ORG=\${${MODULE}_CTX_ORG}
${MODULE}_CTX_PROJECT=\${${MODULE}_CTX_PROJECT}
${MODULE}_CTX_SUBJECT=\${${MODULE}_CTX_SUBJECT}
CTXEOF
        if _${module}_has_context; then
            _${module}_register_prompt
        else
            _${module}_unregister_prompt
        fi
    }"

    # Generate load function
    eval "_${module}_ctx_load() {
        [[ ! -f \"\$${MODULE}_CTX_FILE\" ]] && return
        local key value
        while IFS='=' read -r key value; do
            [[ -z \"\$key\" || \"\$key\" == \\#* ]] && continue
            case \"\$key\" in
                ${MODULE}_CTX_ORG)     export ${MODULE}_CTX_ORG=\"\$value\" ;;
                ${MODULE}_CTX_PROJECT) export ${MODULE}_CTX_PROJECT=\"\$value\" ;;
                ${MODULE}_CTX_SUBJECT) export ${MODULE}_CTX_SUBJECT=\"\$value\" ;;
            esac
        done < \"\$${MODULE}_CTX_FILE\"
        if _${module}_has_context; then
            _${module}_register_prompt
        fi
    }"

    # Export generated functions
    export -f "_${module}_prompt_org" "_${module}_prompt_project" "_${module}_prompt_subject"
    export -f "_${module}_has_context"
    export -f "_${module}_register_prompt" "_${module}_unregister_prompt"
    export -f "_${module}_ctx_save" "_${module}_ctx_load"
}

# =============================================================================
# CONVENIENCE HELPERS
# =============================================================================

# Set context for any module
# Usage: tps_context_set <module> <org> [project] [subject]
tps_context_set() {
    local module="$1"
    local org="$2"
    local project="${3:-}"
    local subject="${4:-}"
    local MODULE="${module^^}"

    # Set variables via eval (needed for dynamic var names)
    eval "export ${MODULE}_CTX_ORG=\"\$org\""
    eval "export ${MODULE}_CTX_PROJECT=\"\$project\""
    eval "export ${MODULE}_CTX_SUBJECT=\"\$subject\""

    # Call module's save function
    "_${module}_ctx_save"
}

# Clear context for any module
# Usage: tps_context_clear <module>
tps_context_clear() {
    local module="$1"
    local MODULE="${module^^}"

    eval "export ${MODULE}_CTX_ORG=''"
    eval "export ${MODULE}_CTX_PROJECT=''"
    eval "export ${MODULE}_CTX_SUBJECT=''"

    "_${module}_ctx_save"
}

# Get context status for any module
# Usage: tps_context_status <module>
tps_context_status() {
    local module="$1"
    local MODULE="${module^^}"

    local org project subject
    eval "org=\"\${${MODULE}_CTX_ORG:-}\""
    eval "project=\"\${${MODULE}_CTX_PROJECT:-}\""
    eval "subject=\"\${${MODULE}_CTX_SUBJECT:-}\""

    echo "${module^^} Context"
    echo "$(printf '=%.0s' {1..20})"
    echo ""
    echo "  Org:     ${org:-(not set)}"
    echo "  Project: ${project:-(not set)}"
    echo "  Subject: ${subject:-(not set)}"
    echo ""
    echo "  Preview: ${MODULE}[${org:-?}:${project:-?}:${subject:-?}]"
}

# =============================================================================
# EXPORTS
# =============================================================================

export -f _tps_validate_identifier _tps_validate_number
export -f tps_context_module_init
export -f tps_context_set tps_context_clear tps_context_status
