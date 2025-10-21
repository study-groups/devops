# Org Enhanced REPL

## Summary

The org module now has an enhanced REPL with **Full Control Mode** featuring:

- **[org x env x mode] verb:noun>** dynamic prompt
- **Ctrl+E** - Cycle environments (Local → Dev → Staging → Production)
- **Ctrl+X,M** - Cycle modes (Inspect → Transfer → Execute)
- **Ctrl+X,A** - Cycle actions for current context
- **verb:noun** - Direct action execution
- **!command** - Shell command execution
- **No / prefix** - Full control, direct command input

## Files Created

1. **bash/org/actions.sh** - Verb:noun action definitions following Tetra Module Convention
2. **bash/org/org_repl_enhanced.sh** - Enhanced REPL with cycling and context-aware prompts
3. **bash/org/org_repl_keybindings.sh** - Readline key bindings for Ctrl+E/M/A

## Fixed Issues

1. **Terminal crash** - Removed `set -euo pipefail` from bash/org/compiler.sh:20
2. **Module loading** - Created `org()` wrapper function in includes.sh
3. **Full control mode** - Implemented direct command input without `/` prefix

## Usage

```bash
# Load org module
tmod load org

# Launch enhanced REPL
org

# Or directly
org repl
```

## REPL Features

### Prompt Format

```
[org-name x env x mode] current-action>
```

Example:
```
[pixeljam x Local x Inspect] view:toml>
```

### Navigation

- **Ctrl+E** - Cycle environment
  - Local → Dev → Staging → Production → Local
- **Ctrl+X,M** - Cycle mode
  - Inspect → Transfer → Execute → Inspect
- **Ctrl+X,A** - Cycle action
  - Cycles through available actions for current env x mode
- **Enter** - Execute current action (shown in prompt)

### Command Types

1. **Action execution** (verb:noun format)
   ```
   view:toml
   view:orgs
   compile:toml
   push:config
   ```

2. **Shell commands** (! prefix)
   ```
   !ls -la
   !cat tetra.toml
   !git status
   ```

3. **Built-in commands**
   ```
   help        - Show help
   actions     - List available actions for current context
   list        - List organizations
   active      - Show active organization
   exit        - Exit REPL
   ```

## Actions by Context

### Local x Inspect
- view:orgs
- view:toml
- view:secrets
- validate:toml
- list:templates

### Local x Transfer
- import:nh
- import:json
- export:toml
- backup:org

### Local x Execute
- compile:toml
- create:org
- switch:org
- refresh:config

### Dev x Inspect
- view:env
- check:connectivity
- view:services

### Dev x Transfer
- push:config
- pull:config
- sync:resources

### Dev x Execute
- deploy:services
- restart:service
- rollback:deployment

### Staging x Inspect
- view:env
- check:connectivity
- view:services

### Staging x Transfer
- push:config
- pull:config

### Staging x Execute
- deploy:services
- validate:deployment

### Production x Inspect
- view:env
- check:connectivity
- view:status

### Production x Transfer
- pull:config
- backup:remote

### Production x Execute
- validate:deployment
- check:health

## Architecture

Based on:
- **bash/repl** - Universal REPL system
- **bash/color** - Color system (already integrated)
- **demo/014** - Action patterns with verb:noun and env x mode contexts
- **Tetra Module Convention** - TCS 3.0 compliant action declarations

## Key Bindings Note

- Ctrl+M is normally mapped to Enter in terminals
- Ctrl+A is normally beginning-of-line
- Using Ctrl+X as prefix: Ctrl+X,M and Ctrl+X,A
- Ctrl+E works directly (not typically bound)

## Next Steps

- Implement actual action logic (currently shows placeholders)
- Add TDS integration for rich markdown help displays
- Connect to org_push/org_pull for remote operations
- Add tab completion for verb:noun actions
- Integrate with TSM for service management actions
