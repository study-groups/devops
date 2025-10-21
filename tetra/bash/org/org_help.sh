#!/usr/bin/env bash
# Org Hierarchical Help System
# Discoverable help with tab completion

# Help content structure (hierarchical)
declare -gA ORG_HELP_TREE

org_help_init() {
    # Overview
    ORG_HELP_TREE['overview']='Organization Management

Manage multi-client infrastructures with Tetra organizations.

Each org has:
  - Infrastructure (from DigitalOcean via NodeHolder)
  - Environment mappings (@dev, @staging, @prod)
  - Secrets (credentials, API keys)
  - Deployment configs

Commands: list, switch, import, discover, compile, deploy
Tab completion: Type "org " and press TAB'

    # Quick Start
    ORG_HELP_TREE['quickstart']='Quick Start

From NodeHolder digocean.json to deployed Tetra:

  org import nh ~/nh/myorg myorg     # Import with discovery
  org secrets init myorg             # Create secrets template
  org compile myorg                  # Build final config
  org switch myorg                   # Make active
  org push myorg dev                 # Deploy

See: help workflow'

    # Import
    ORG_HELP_TREE['import']='Import Organizations

org import nh <nh-dir> [org]        NodeHolder directory
org import json <file> [org]        DigitalOcean JSON
org import env <file> [org]         Legacy .env file

Examples:
  org import nh ~/nh/pixeljam pixeljam
  org import json ~/data/do.json myorg --mapping mapping.json

Tab: Type "org import " and press TAB for options'

    # Workflow
    ORG_HELP_TREE['workflow']='Complete Workflow: NodeHolder → Tetra

1. Fetch (in NodeHolder):
   cd ../nh && nh_doctl_get_all

2. Import (in Tetra):
   org import nh ~/nh/myorg myorg

3. Secrets:
   org secrets init myorg
   $EDITOR $TETRA_DIR/org/myorg/secrets.env

4. Compile & Deploy:
   org compile myorg
   org switch myorg
   org push myorg dev

See: nh_show_workflow for details'

    # All commands
    ORG_HELP_TREE['commands']='Commands

MANAGEMENT:
  list, active, switch, create, validate

IMPORT:
  import nh/json/env, discover

SECRETS:
  secrets init/validate/load/list/copy

BUILD:
  compile, refresh

DEPLOY:
  push, pull, rollback, history

HELP:
  help [topic]    Tab completion available!'

    ORG_HELP_TREE['all']='Help Topics

overview, quickstart, import, workflow, commands

Type: help <topic>
Tab: Type "help " and press TAB'
}

# Display help
org_help() {
    local topic="${1:-overview}"

    [[ -z "${ORG_HELP_TREE['overview']}" ]] && org_help_init

    local content="${ORG_HELP_TREE[$topic]}"

    if [[ -z "$content" ]]; then
        echo "Unknown topic: $topic"
        echo ""
        echo "Available: ${!ORG_HELP_TREE[@]}"
        echo "Tab completion available"
        return 1
    fi

    echo ""
    echo "$content"
    echo ""
}

export -f org_help org_help_init
