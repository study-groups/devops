#!/usr/bin/env bash

# Module Log Generator - Eliminates duplicate logging boilerplate
# Usage: tetra_generate_module_log <module_name>
#
# This generates standard logging wrapper functions for any module.
# Instead of copy-pasting 70+ lines of boilerplate, modules can call:
#   tetra_generate_module_log "mymodule"
#
# This creates functions:
#   mymodule_log         - Generic log event
#   mymodule_log_try     - Log try/attempt
#   mymodule_log_success - Log success
#   mymodule_log_fail    - Log failure
#   mymodule_log_info    - Log info
#   mymodule_log_debug   - Log debug
#   mymodule_log_warn    - Log warning
#   mymodule_log_error   - Log error
#   mymodule_log_query   - Query module logs
#   mymodule_log_errors  - Query module errors

# Ensure unified logging is loaded
_tetra_ensure_unified_log() {
    if ! type tetra_log_event >/dev/null 2>&1; then
        source "${TETRA_SRC}/bash/utils/unified_log.sh"
    fi
}

# Generate logging wrapper functions for a module
# Args: $1 - module name (lowercase, e.g., "tsm", "rag")
tetra_generate_module_log() {
    local module="$1"

    if [[ -z "$module" ]]; then
        echo "Usage: tetra_generate_module_log <module_name>" >&2
        return 1
    fi

    _tetra_ensure_unified_log

    # Generic log event
    eval "${module}_log() {
        tetra_log_event ${module} \"\$@\"
    }"

    # Try events
    eval "${module}_log_try() {
        local verb=\"\$1\"
        local subject=\"\$2\"
        local metadata=\"\${3:-{}}\"
        tetra_log_try ${module} \"\$verb\" \"\$subject\" \"\$metadata\"
    }"

    # Success events
    eval "${module}_log_success() {
        local verb=\"\$1\"
        local subject=\"\$2\"
        local metadata=\"\${3:-{}}\"
        tetra_log_success ${module} \"\$verb\" \"\$subject\" \"\$metadata\"
    }"

    # Fail events
    eval "${module}_log_fail() {
        local verb=\"\$1\"
        local subject=\"\$2\"
        local metadata=\"\${3:-{}}\"
        tetra_log_fail ${module} \"\$verb\" \"\$subject\" \"\$metadata\"
    }"

    # Info events
    eval "${module}_log_info() {
        local verb=\"\$1\"
        local subject=\"\$2\"
        local metadata=\"\${3:-{}}\"
        tetra_log_info ${module} \"\$verb\" \"\$subject\" \"\$metadata\"
    }"

    # Debug events
    eval "${module}_log_debug() {
        local verb=\"\$1\"
        local subject=\"\$2\"
        local metadata=\"\${3:-{}}\"
        tetra_log_debug ${module} \"\$verb\" \"\$subject\" \"\$metadata\"
    }"

    # Warning events
    eval "${module}_log_warn() {
        local verb=\"\$1\"
        local subject=\"\$2\"
        local metadata=\"\${3:-{}}\"
        tetra_log_warn ${module} \"\$verb\" \"\$subject\" \"\$metadata\"
    }"

    # Error events
    eval "${module}_log_error() {
        local verb=\"\$1\"
        local subject=\"\$2\"
        local metadata=\"\${3:-{}}\"
        tetra_log_error ${module} \"\$verb\" \"\$subject\" \"\$metadata\"
    }"

    # Query helpers
    eval "${module}_log_query() {
        tetra_log_query_module ${module} \"\$@\"
    }"

    eval "${module}_log_errors() {
        ${module}_log_query | jq -c 'select(.status == \"fail\" or .level == \"ERROR\")'
    }"

    # Export the functions
    export -f "${module}_log"
    export -f "${module}_log_try"
    export -f "${module}_log_success"
    export -f "${module}_log_fail"
    export -f "${module}_log_info"
    export -f "${module}_log_debug"
    export -f "${module}_log_warn"
    export -f "${module}_log_error"
    export -f "${module}_log_query"
    export -f "${module}_log_errors"
}

# Convenience function to check if module logging is initialized
tetra_module_log_exists() {
    local module="$1"
    type "${module}_log" >/dev/null 2>&1
}
