#!/usr/bin/env bash

# Environment Capabilities Registry
# Defines what each environment can do and how to access it

# Environment definitions with capabilities
declare -gA ENV_CAPABILITIES=(
    # TETRA - Overview/coordination environment
    ["TETRA:type"]="overview"
    ["TETRA:description"]="Multi-environment coordination and overview"
    ["TETRA:access"]="local"
    ["TETRA:can_execute"]="false"
    ["TETRA:can_deploy"]="true"
    ["TETRA:can_monitor"]="true"
    ["TETRA:can_configure"]="true"

    # LOCAL - Development machine
    ["LOCAL:type"]="development"
    ["LOCAL:description"]="Local development environment"
    ["LOCAL:access"]="direct"
    ["LOCAL:can_execute"]="true"
    ["LOCAL:can_deploy"]="false"
    ["LOCAL:can_monitor"]="true"
    ["LOCAL:can_configure"]="true"

    # DEV - Development server
    ["DEV:type"]="remote"
    ["DEV:description"]="Development server environment"
    ["DEV:access"]="ssh"
    ["DEV:ssh_target"]="tetra@dev.pixeljamarcade.com"
    ["DEV:can_execute"]="true"
    ["DEV:can_deploy"]="true"
    ["DEV:can_monitor"]="true"
    ["DEV:can_configure"]="true"

    # STAGING - Staging/QA server
    ["STAGING:type"]="remote"
    ["STAGING:description"]="Staging/QA server environment"
    ["STAGING:access"]="ssh"
    ["STAGING:ssh_target"]="tetra@staging.pixeljamarcade.com"
    ["STAGING:can_execute"]="true"
    ["STAGING:can_deploy"]="true"
    ["STAGING:can_monitor"]="true"
    ["STAGING:can_configure"]="true"

    # PROD - Production server
    ["PROD:type"]="remote"
    ["PROD:description"]="Production server environment"
    ["PROD:access"]="ssh"
    ["PROD:ssh_target"]="tetra@prod.pixeljamarcade.com"
    ["PROD:can_execute"]="true"
    ["PROD:can_deploy"]="true"
    ["PROD:can_monitor"]="true"
    ["PROD:can_configure"]="false"  # Restricted config changes

    # QA - Quality assurance environment
    ["QA:type"]="remote"
    ["QA:description"]="Quality assurance environment"
    ["QA:access"]="ssh"
    ["QA:ssh_target"]="tetra@qa.pixeljamarcade.com"
    ["QA:can_execute"]="true"
    ["QA:can_deploy"]="true"
    ["QA:can_monitor"]="true"
    ["QA:can_configure"]="true"
)

# Get environment capability
get_env_capability() {
    local env="$1"
    local capability="$2"
    echo "${ENV_CAPABILITIES[${env}:${capability}]:-unknown}"
}

# Check if environment can perform action
env_can() {
    local env="$1"
    local action="$2"
    local capability=$(get_env_capability "$env" "can_$action")
    [[ "$capability" == "true" ]]
}

# Get environment access method
get_env_access_method() {
    local env="$1"
    get_env_capability "$env" "access"
}

# Get SSH target for remote environments
get_env_ssh_target() {
    local env="$1"
    get_env_capability "$env" "ssh_target"
}

# Get environment type (overview, development, remote)
get_env_type() {
    local env="$1"
    get_env_capability "$env" "type"
}

# Get environment description
get_env_description() {
    local env="$1"
    get_env_capability "$env" "description"
}

# List all environments of a specific type
list_envs_by_type() {
    local type="$1"
    local envs=()

    for env in TETRA LOCAL DEV STAGING PROD QA; do
        if [[ "$(get_env_type "$env")" == "$type" ]]; then
            envs+=("$env")
        fi
    done

    printf '%s\n' "${envs[@]}"
}