#!/usr/bin/env bash
# Self Tree - Help and Completion Tree Structure
# Defines the self (Tetra system management) command tree

# Source dependencies
source "$TETRA_SRC/bash/tree/core.sh"

# Initialize self tree under help.self namespace
self_tree_init() {
    local ns="help.self"

    # Root category
    tree_insert "$ns" "category" \
        title="Tetra System Management" \
        description="Manage and update the Tetra framework itself"

    # Update command
    tree_insert "$ns.update" "command" \
        title="Update Tetra" \
        description="Pull latest changes and update Tetra framework" \
        usage="tetra-self update"

    # Status command
    tree_insert "$ns.status" "command" \
        title="Show Tetra status" \
        description="Display Tetra installation info and git status" \
        usage="tetra-self status"

    # Version command
    tree_insert "$ns.version" "command" \
        title="Show Tetra version" \
        description="Display current Tetra version and commit" \
        usage="tetra-self version"

    # Doctor command
    tree_insert "$ns.doctor" "command" \
        title="Run system diagnostics" \
        description="Check Tetra installation health and dependencies" \
        usage="tetra-self doctor"

    # Test command
    tree_insert "$ns.test" "command" \
        title="Run Tetra tests" \
        description="Execute Tetra framework test suite" \
        usage="tetra-self test [module]"
}

# Export the init function
export -f self_tree_init
