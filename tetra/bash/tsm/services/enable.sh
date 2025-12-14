#!/usr/bin/env bash

# TSM Service Enable/Disable
# Central services-enabled directory with org-prefixed symlinks

# Single services-enabled directory (consolidated)
TSM_SERVICES_ENABLED="$TETRA_DIR/tsm/services-enabled"

# Enable service (create symlink in central services-enabled)
# Usage: tsm enable [org/]service-name
tetra_tsm_enable() {
    local service_ref="$1"

    if [[ -z "$service_ref" ]]; then
        echo "Usage: tsm enable [org/]<service-name>"
        return 1
    fi

    # Use _found_ prefix to avoid nameref conflicts
    local _found_org _found_file
    if ! _tsm_find_service "$service_ref" _found_org _found_file; then
        echo "❌ Service not found: $service_ref"
        echo "Available services:"
        tetra_tsm_list_services
        return 1
    fi

    local parsed_org service_name
    _tsm_parse_service_ref "$service_ref" parsed_org service_name

    mkdir -p "$TSM_SERVICES_ENABLED"

    # Use org-prefixed link name for uniqueness
    local link_name="${_found_org}-${service_name}.tsm"
    local enabled_link="$TSM_SERVICES_ENABLED/$link_name"

    if [[ -L "$enabled_link" ]]; then
        echo "⚠️  Already enabled: $_found_org/$service_name"
        return 0
    fi

    ln -s "$_found_file" "$enabled_link"
    echo "✅ Enabled: $_found_org/$service_name"
    echo "Service will start automatically with tetra daemon"
}

# Disable service (remove symlink from central services-enabled)
# Usage: tsm disable [org/]service-name
tetra_tsm_disable() {
    local service_ref="$1"

    if [[ -z "$service_ref" ]]; then
        echo "Usage: tsm disable [org/]<service-name>"
        return 1
    fi

    # Use _found_ prefix to avoid nameref conflicts
    local _found_org _found_file
    if ! _tsm_find_service "$service_ref" _found_org _found_file; then
        echo "❌ Service not found: $service_ref"
        return 1
    fi

    local parsed_org service_name
    _tsm_parse_service_ref "$service_ref" parsed_org service_name

    local link_name="${_found_org}-${service_name}.tsm"
    local enabled_link="$TSM_SERVICES_ENABLED/$link_name"

    if [[ ! -L "$enabled_link" ]]; then
        echo "⚠️  Not enabled: $_found_org/$service_name"
        return 0
    fi

    rm "$enabled_link"
    echo "✅ Disabled: $_found_org/$service_name"
    echo "Service will not start automatically"
}

export -f tetra_tsm_enable
export -f tetra_tsm_disable
