#!/usr/bin/env bash
# Deploy Tree - Help and Completion Tree Structure
# Defines the deploy (deployment management) command tree

# Source dependencies
source "$TETRA_SRC/bash/tree/core.sh"

# Initialize deploy tree under help.deploy namespace
deploy_tree_init() {
    local ns="help.deploy"

    # Root category
    tree_insert "$ns" "category" \
        title="Deployment Management" \
        description="Deploy and manage applications across environments"

    # Core deploy command
    tree_insert "$ns.deploy" "command" \
        title="Deploy application" \
        description="Deploy an application to specified environment" \
        usage="deploy <service> <environment>" \
        examples="deploy api production
deploy web staging"

    # Status command
    tree_insert "$ns.status" "command" \
        title="Show deployment status" \
        description="Display current deployment state for all services" \
        usage="deploy status [service]"

    # Rollback command
    tree_insert "$ns.rollback" "command" \
        title="Rollback deployment" \
        description="Revert to previous deployment version" \
        usage="deploy rollback <service> [version]"

    # List command
    tree_insert "$ns.list" "command" \
        title="List deployments" \
        description="Show deployment history and available versions" \
        usage="deploy list [service]"
}

# Export the init function
export -f deploy_tree_init
