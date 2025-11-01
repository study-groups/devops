---
category: core
type: guide
tags: [org, tab-completion, tree, usage, examples]
module: org
created: 2025-10-31
updated: 2025-10-31
status: complete
evidence_weight: primary
---

# Org Module Tab Completion Guide

## Quick Start

After loading the org module, tab completion works automatically:

```bash
source ~/tetra/tetra.sh
tmod load org

org <TAB>           # Shows all top-level commands
org import <TAB>    # Shows: nh json env
org secrets <TAB>   # Shows: init validate load list copy
org env <TAB>       # Shows: list edit show validate
```

## Available Completions

### Top-Level Commands
```
org <TAB>
  list        active      switch      create
  import      discover    validate    compile
  secrets     push        pull        rollback
  history     init        promote     env
  diff        apply       help        repl
```

### Import Subcommands
```
org import <TAB>
  nh          # Import from NodeHolder
  json        # Import from JSON file
  env         # Import from .env file
```

### Secrets Management
```
org secrets <TAB>
  init        # Initialize secrets storage
  validate    # Validate secrets config
  load        # Load secrets for environment
  list        # List secret keys
  copy        # Copy secrets between envs
```

### Environment Management
```
org env <TAB>
  list        # List environments
  edit        # Edit environment config
  show        # Show environment config
  validate    # Validate environment config
```

## Dynamic Completions

Some commands provide dynamic completions based on your system state:

### Organization Names
```bash
org switch <TAB>        # Lists available organizations
org validate <TAB>      # Lists available organizations
org push <TAB>          # Lists available organizations
```

### Environment Names
```bash
org push myorg <TAB>    # Shows: local dev staging production
org pull myorg <TAB>    # Shows: local dev staging production
```

### Templates
```bash
org create --from-template <TAB>    # Lists available templates
```

### Files
```bash
org import json <TAB>               # Lists *.json files
org discover <TAB>                  # Lists *.json files
```

## Help Integration

### Quick Help (thelp)
```bash
thelp org.list                  # Quick help for list command
thelp org.import.nh             # Quick help for import nh
thelp org.secrets.init          # Quick help for secrets init
thelp --list org                # List all org commands
```

### In-REPL Help
```bash
org                             # Start REPL
> help list                     # Show help for list
> thelp import.nh               # Quick help in REPL
> h secrets.init                # Shorthand help
```

## Command Flags

All commands support `--help` and `-h`:
```bash
org list --help
org import --help
org secrets init --help
```

## Tips & Tricks

1. **Multi-level completion**: Keep pressing TAB to navigate hierarchies
   ```bash
   org <TAB>             # Level 1
   org import <TAB>      # Level 2
   org import nh <TAB>   # Level 3 (dynamic - shows directories)
   ```

2. **Partial matching**: Type part of a command and TAB
   ```bash
   org im<TAB>      # Expands to: org import
   org sec<TAB>     # Expands to: org secrets
   org env l<TAB>   # Expands to: org env list
   ```

3. **Command aliases**: Some commands have shortcuts
   ```bash
   org ls           # Alias for: org list
   org sw <TAB>     # Alias for: org switch
   ```

4. **Explore with TAB**: Not sure what's available? Just press TAB!
   ```bash
   org <TAB><TAB>           # Shows all options
   org import <TAB><TAB>    # Shows all import types
   ```

## Technical Details

### How It Works

1. **Tree Structure**: Commands are defined in `bash/org/org_tree.sh` as a hierarchical tree
2. **Completion Function**: `_org_complete()` in `bash/org/org_completion.sh` walks the tree
3. **Dynamic Functions**: Some completions call functions to get live data (e.g., `org_completion_orgs()`)
4. **Metadata**: Each command stores usage, description, and completion hints

### Files Involved

- `bash/org/org_tree.sh` - Command tree definition
- `bash/org/org_completion.sh` - Completion logic
- `bash/tree/complete.sh` - Generic tree completion
- `bash/tree/core.sh` - Tree data structure

### Customization

To add a new command with tab completion:

1. Add to tree in `org_tree.sh`:
   ```bash
   tree_insert "help.org.mycommand" "command" \
       title="My New Command" \
       usage="org mycommand <arg>" \
       handler="org_mycommand"
   ```

2. Completion works automatically!

For dynamic completion:
   ```bash
   tree_insert "help.org.mycommand" "command" \
       ... \
       completion_fn="my_completion_function"
   
   my_completion_function() {
       echo "option1 option2 option3"
   }
   ```

## Troubleshooting

**Completion not working?**
- Check if org module is loaded: `type org`
- Check completion registration: `complete -p org`
- Reload module: `tmod reload org`

**Seeing file completions instead?**
- The completion function isn't registered
- Check bash version: `bash --version` (needs 4.0+)
- Try manual registration: `complete -F _org_complete org`

**Dynamic completions empty?**
- Check if completion function exists: `type org_completion_orgs`
- Check if data directory exists: `ls $TETRA_DIR/orgs`

## Examples

### Complete Workflow
```bash
# Load module
tmod load org

# Explore commands
org <TAB>

# Create new org with completion
org create my-app

# Import with completion
org import <TAB>
org import nh <TAB>         # Shows NH directories
org import nh my-nodeholder my-app

# Work with secrets
org secrets <TAB>
org secrets init my-app
org secrets list my-app

# Deploy with environment completion
org push my-app <TAB>       # Shows environments
org push my-app staging

# Get help anytime
thelp org.push
org help
```

