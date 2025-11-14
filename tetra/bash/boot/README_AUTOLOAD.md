# Tetra Auto-Loading System

Modules that are automatically loaded when you run `source ~/tetra/tetra.sh`

## How It Works

The bootloader (`bash/bootloader.sh`) automatically sources all `boot_*.sh` files in `bash/boot/`:

```bash
source "$BOOT_DIR/boot_core.sh"      # Required (core functions)
source "$BOOT_DIR/boot_modules.sh"   # Module system
source "$BOOT_DIR/boot_aliases.sh"   # Aliases
source "$BOOT_DIR/boot_prompt.sh"    # Prompt customization
source "$BOOT_DIR/boot_nginx.sh"     # Nginx utilities (NEW)
source "$BOOT_DIR/boot_spaces.sh"    # Spaces utilities (NEW)
# ... any other boot_*.sh files
```

## What's Auto-Loaded

### Core (Always Loaded)
- `boot_core.sh` - Core tetra functions
- `boot_modules.sh` - Module loading system
- `boot_aliases.sh` - Command aliases
- `boot_prompt.sh` - Shell prompt

### Nginx (Auto-Loaded)
- `bash/nginx/spaces_proxy.sh` - Nginx Spaces proxy functions
- `bash/nginx/nginx.sh` - Generic nginx helpers

**Available functions after `source ~/tetra/tetra.sh`:**
```bash
tetra_nginx_spaces_config       # Generate nginx config
tetra_nginx_spaces_deploy       # Deploy nginx config
tetra_nginx_spaces_list         # List configs
tetra_nginx_spaces_wizard       # Interactive setup
tetra_nginx_spaces_proxy        # Raw config output
```

### Spaces (Auto-Loaded)
- `bash/deploy/do-spaces.sh` - DO Spaces AWS CLI wrapper
- `bash/spaces/spaces.sh` - TES symbol resolution (@spaces:bucket)

**Available functions after `source ~/tetra/tetra.sh`:**
```bash
tetra_deploy_do_spaces_setup_from_env    # Setup AWS CLI vars
tetra_deploy_do_spaces_list_files        # List bucket files
tetra_deploy_do_spaces_status            # Show config
```

### Spaces REPL (NOT Auto-Loaded)

The Spaces REPL is **not** auto-loaded because:
1. It's interactive (enters REPL loop)
2. Only needed when explicitly wanted
3. Keeps boot time fast

**To use Spaces REPL:**
```bash
source ~/tetra/tetra.sh          # Auto-loads nginx + spaces functions
source $TETRA_SRC/bash/spaces/spaces_repl.sh
spaces_repl                       # Start interactive REPL
```

Or create a helper function (add to your shell rc file):
```bash
alias srepl='source $TETRA_SRC/bash/spaces/spaces_repl.sh && spaces_repl'
```

## Usage Examples

### Before Auto-Loading (OLD WAY)
```bash
# Had to remember to source manually
source ~/tetra/tetra.sh
source $TETRA_SRC/bash/nginx/spaces_proxy.sh  # Easy to forget!

tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3
```

### After Auto-Loading (NEW WAY)
```bash
# Just source tetra, nginx functions available immediately
source ~/tetra/tetra.sh

# Functions ready to use!
tetra_nginx_spaces_config devpages devpages.pixeljamarcade.com sfo3
tetra_nginx_spaces_deploy devpages prod
```

### With pj Helper
```bash
# Your existing workflow
pj  # Sources tetra + loads pixeljam-arcade context

# Nginx functions already available
tetra_nginx_spaces_config --dry-run devpages devpages.pixeljamarcade.com
```

## Check What's Loaded

```bash
# Check if nginx functions loaded
type tetra_nginx_spaces_config
echo $TETRA_NGINX_LOADED   # Should be "1"

# Check if spaces functions loaded
type tetra_deploy_do_spaces_setup_from_env
echo $TETRA_SPACES_LOADED  # Should be "1"

# List all tetra functions
compgen -A function | grep tetra_
```

## Adding Your Own Auto-Loaded Module

Create a new boot file:

```bash
# Create boot_mymodule.sh
cat > $TETRA_SRC/bash/boot/boot_mymodule.sh <<'EOF'
#!/usr/bin/env bash
# boot_mymodule.sh - Auto-load my custom module

if [[ -f "$TETRA_SRC/bash/mymodule/mymodule.sh" ]]; then
    source "$TETRA_SRC/bash/mymodule/mymodule.sh"
    export TETRA_MYMODULE_LOADED=1
fi
EOF

# Next time you source tetra, it's auto-loaded!
source ~/tetra/tetra.sh
```

## Performance Impact

Auto-loading modules adds minimal overhead:
- Each module: ~1-5ms
- Total boot time typically < 100ms
- Acceptable tradeoff for convenience

To measure boot time:
```bash
source ~/tetra/tetra.sh
echo "Boot time: ${TETRA_BOOT_TIME_MS}ms"
```

## Disabling Auto-Load (If Needed)

To temporarily disable a boot module:

```bash
# Rename to disable
mv $TETRA_SRC/bash/boot/boot_nginx.sh \
   $TETRA_SRC/bash/boot/boot_nginx.sh.disabled

# Or delete it
rm $TETRA_SRC/bash/boot/boot_nginx.sh
```

## Module Loading Order

1. `boot_core.sh` (required, loads first)
2. `boot_log.sh` (logging system)
3. `boot_modules.sh` (module system)
4. All other `boot_*.sh` files (alphabetically)
5. `zzz_final.sh` (cleanup, loads last)

## Environment Variables Set

After auto-loading:

```bash
TETRA_SRC              # Strong global, always set
TETRA_DIR              # User data directory
TETRA_ORG              # Current organization (if set)
TETRA_NGINX_LOADED=1   # Nginx functions loaded
TETRA_SPACES_LOADED=1  # Spaces functions loaded
TETRA_BOOT_TIME_MS     # Boot time in milliseconds
```

## Troubleshooting

### "Command not found" after sourcing tetra
```bash
# Check if boot file exists
ls -la $TETRA_SRC/bash/boot/boot_nginx.sh

# Check if module file exists
ls -la $TETRA_SRC/bash/nginx/spaces_proxy.sh

# Check load status
echo $TETRA_NGINX_LOADED

# Manually source if needed
source $TETRA_SRC/bash/nginx/spaces_proxy.sh
```

### Functions work in one shell but not another
```bash
# Make sure to source tetra in each new shell
# Or add to your ~/.bashrc or ~/.zshrc:
source ~/tetra/tetra.sh
```

### Boot time too slow
```bash
# Check boot time
source ~/tetra/tetra.sh
echo "Boot: ${TETRA_BOOT_TIME_MS}ms"

# Disable unused modules
mv $TETRA_SRC/bash/boot/boot_UNUSED.sh{,.disabled}
```

## Best Practices

1. **Core modules** → Auto-load via `boot_*.sh`
2. **Interactive REPLs** → Manual load only
3. **Heavy modules** → Consider lazy loading
4. **Org-specific** → Load via org init, not boot

## Quick Reference

| Module | Auto-Loaded? | How to Use |
|--------|--------------|------------|
| nginx spaces_proxy | ✅ Yes | Just `source ~/tetra/tetra.sh` |
| spaces utilities | ✅ Yes | Just `source ~/tetra/tetra.sh` |
| spaces REPL | ❌ No | `source spaces_repl.sh && spaces_repl` |
| tdocs | ❌ No | Load when needed |
| org functions | ✅ Yes | Via boot_modules |

## Summary

**You no longer need to remember:**
```bash
source $TETRA_SRC/bash/nginx/spaces_proxy.sh  ❌ OLD
```

**Just do:**
```bash
source ~/tetra/tetra.sh  ✅ NEW - Everything auto-loads!
```
