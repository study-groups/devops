#!/usr/bin/env bash
# Org Tree - Help and Completion Tree Structure
# Defines the organization management command tree

# Source dependencies
source "$TETRA_SRC/bash/tree/core.sh"

# Initialize org tree under help.org namespace
org_tree_init() {
    local ns="help.org"

    # Root category
    tree_insert "$ns" "category" \
        title="Organization Management System" \
        description="Multi-environment configuration and deployment management"

    # ========================================================================
    # CORE ORGANIZATION COMMANDS
    # ========================================================================

    # list - List organizations
    tree_insert "$ns.list" "command" \
        title="List all organizations" \
        description="Display all available organizations in the registry" \
        usage="org list [--verbose|--json]" \
        handler="org_list" \
        aliases="ls"

    # active - Show active organization
    tree_insert "$ns.active" "command" \
        title="Show active organization" \
        description="Display the currently active organization" \
        usage="org active" \
        handler="org_active"

    # switch - Switch active organization
    tree_insert "$ns.switch" "command" \
        title="Switch active organization" \
        description="Change the active organization context" \
        usage="org switch <org-name>" \
        handler="org_switch" \
        aliases="sw" \
        completion_fn="org_completion_orgs"

    # create - Create new organization
    tree_insert "$ns.create" "command" \
        title="Create new organization" \
        description="Initialize a new organization structure" \
        usage="org create <org-name> [--from-template <template>]" \
        handler="org_create"

    tree_insert "$ns.create.template" "parameter" \
        title="Template selection" \
        completion_fn="org_completion_templates"

    # ========================================================================
    # IMPORT COMMANDS
    # ========================================================================

    tree_insert "$ns.import" "category" \
        title="Import organization data" \
        description="Import from various formats (NH, JSON, ENV)"

    # import nh - Import from NodeHolder
    tree_insert "$ns.import.nh" "command" \
        title="Import from NodeHolder" \
        description="Convert NodeHolder digocean.json to organization format" \
        usage="org import nh <nh-dir> [org-name]" \
        handler="org_import" \
        completion_fn="org_completion_nh_dirs"

    # import json - Import from JSON
    tree_insert "$ns.import.json" "command" \
        title="Import from JSON" \
        description="Import organization from JSON file with optional mapping" \
        usage="org import json <json-file> [org-name] [--mapping <file>]" \
        handler="org_import"

    # import env - Import from ENV file
    tree_insert "$ns.import.env" "command" \
        title="Import from .env file" \
        description="Import environment variables from .env format" \
        usage="org import env <env-file> [org-name]" \
        handler="org_import"

    # ========================================================================
    # DISCOVERY & VALIDATION
    # ========================================================================

    # discover - Auto-discover fields
    tree_insert "$ns.discover" "command" \
        title="Auto-discover organization structure" \
        description="Analyze JSON and auto-discover field mappings" \
        usage="org discover <json-file> [--output <file>] [--org-name <name>]" \
        handler="org_discover"

    # validate - Validate organization
    tree_insert "$ns.validate" "command" \
        title="Validate organization structure" \
        description="Check organization TOML for errors and completeness" \
        usage="org validate [org-name] [--strict] [--json]" \
        handler="org_validate" \
        completion_fn="org_completion_orgs"

    # compile - Compile to TOML
    tree_insert "$ns.compile" "command" \
        title="Compile organization to TOML" \
        description="Generate final TOML configuration from source" \
        usage="org compile [org-name] [--force] [--dry-run]" \
        handler="tetra_compile_toml" \
        completion_fn="org_completion_orgs"

    # ========================================================================
    # SECRETS MANAGEMENT
    # ========================================================================

    tree_insert "$ns.secrets" "category" \
        title="Secrets management" \
        description="Manage organization secrets across environments"

    tree_insert "$ns.secrets.init" "command" \
        title="Initialize secrets storage" \
        description="Create secrets structure for organization" \
        usage="org secrets init <org-name>" \
        handler="org_secrets_init" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.secrets.validate" "command" \
        title="Validate secrets" \
        description="Check secrets configuration for completeness" \
        usage="org secrets validate <org-name>" \
        handler="org_secrets_validate" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.secrets.load" "command" \
        title="Load secrets for environment" \
        description="Export secrets for specific environment" \
        usage="org secrets load <org-name> <env>" \
        handler="org_secrets_load" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.secrets.list" "command" \
        title="List secrets" \
        description="Show all secret keys (values hidden)" \
        usage="org secrets list <org-name>" \
        handler="org_secrets_list" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.secrets.copy" "command" \
        title="Copy secrets between environments" \
        description="Duplicate secrets from one env to another" \
        usage="org secrets copy <org-name> <from-env> <to-env>" \
        handler="org_secrets_copy" \
        completion_fn="org_completion_orgs"

    # ========================================================================
    # DEPLOYMENT & SYNC
    # ========================================================================

    tree_insert "$ns.push" "command" \
        title="Push configuration to environment" \
        description="Deploy organization config to target environment" \
        usage="org push <org-name> <env> [--force] [--dry-run]" \
        handler="org_push" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.push.env" "parameter" \
        title="Target environment" \
        completion_fn="org_completion_envs"

    tree_insert "$ns.pull" "command" \
        title="Pull configuration from environment" \
        description="Sync local config from deployed environment" \
        usage="org pull <org-name> <env>" \
        handler="org_pull" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.pull.env" "parameter" \
        title="Source environment" \
        completion_fn="org_completion_envs"

    tree_insert "$ns.rollback" "command" \
        title="Rollback deployment" \
        description="Revert to previous deployment version" \
        usage="org rollback <org-name> <env> [--version <N>]" \
        handler="org_rollback" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.rollback.env" "parameter" \
        title="Target environment" \
        completion_fn="org_completion_envs"

    tree_insert "$ns.history" "command" \
        title="Deployment history" \
        description="View deployment history for organization" \
        usage="org history <org-name> [--env <env>] [--limit <N>]" \
        handler="org_history" \
        completion_fn="org_completion_orgs"

    # ========================================================================
    # MULTI-ENVIRONMENT CONFIG
    # ========================================================================

    tree_insert "$ns.init" "command" \
        title="Initialize multi-env config" \
        description="Set up environment-specific configuration structure" \
        usage="org init <org-name>" \
        handler="org_config_init" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.promote" "command" \
        title="Promote config between environments" \
        description="Promote configuration from one env to next (Dev→Staging→Prod)" \
        usage="org promote <org-name> <from-env> <to-env>" \
        handler="org_promote" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.env" "category" \
        title="Environment management" \
        description="Manage environment-specific configurations"

    tree_insert "$ns.env.list" "command" \
        title="List environments" \
        description="Show all configured environments" \
        usage="org env list [org-name]" \
        handler="org_config_list" \
        aliases="ls" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.env.edit" "command" \
        title="Edit environment config" \
        description="Open environment config in editor" \
        usage="org env edit <org-name> <env>" \
        handler="org_config_env_edit" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.env.show" "command" \
        title="Show environment config" \
        description="Display environment configuration" \
        usage="org env show <org-name> <env>" \
        handler="org_config_env_show" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.env.validate" "command" \
        title="Validate environment config" \
        description="Check environment configuration for errors" \
        usage="org env validate <org-name> <env>" \
        handler="org_config_validate" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.diff" "command" \
        title="Compare configurations" \
        description="Show differences between environment configs" \
        usage="org diff <org-name> <env1> <env2>" \
        handler="org_deploy_diff" \
        completion_fn="org_completion_orgs"

    tree_insert "$ns.apply" "command" \
        title="Apply configuration changes" \
        description="Apply pending configuration changes to environment" \
        usage="org apply <org-name> <env>" \
        handler="org_apply" \
        completion_fn="org_completion_orgs"

    # ========================================================================
    # UTILITY COMMANDS
    # ========================================================================

    tree_insert "$ns.help" "command" \
        title="Show help" \
        description="Display help information for org commands" \
        usage="org help [topic]" \
        handler="org_help"

    # ========================================================================
    # REPL-SPECIFIC
    # ========================================================================

    tree_insert "$ns.repl" "category" \
        title="REPL navigation" \
        description="Interactive REPL commands (takeover mode)"

    tree_insert "$ns.repl.env" "command" \
        title="Cycle environment" \
        description="Navigate through environments (Local→Dev→Staging→Production)" \
        usage="env | e" \
        handler="_org_cycle_env" \
        aliases="e"

    tree_insert "$ns.repl.mode" "command" \
        title="Cycle mode" \
        description="Navigate through modes (Inspect→Transfer→Execute)" \
        usage="mode | m" \
        handler="_org_cycle_mode" \
        aliases="m"

    tree_insert "$ns.repl.action" "command" \
        title="Cycle action" \
        description="Navigate through available actions for current env×mode" \
        usage="action | a" \
        handler="_org_cycle_action" \
        aliases="a"

    tree_insert "$ns.repl.next" "command" \
        title="Cycle all dimensions" \
        description="Navigate through action→mode→env in sequence" \
        usage="next | n" \
        handler="_org_cycle_all" \
        aliases="n"

    tree_insert "$ns.repl.actions" "command" \
        title="List actions" \
        description="Show all available actions for current context" \
        usage="actions" \
        handler="_org_show_actions"

    tree_insert "$ns.repl.status" "command" \
        title="Show REPL status" \
        description="Display current environment, mode, and action" \
        usage="status" \
        handler="_org_show_status"
}

# Export tree initialization
export -f org_tree_init
