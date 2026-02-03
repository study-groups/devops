# Tetra Project Instructions

## Bash Conventions

- **NO EXPORTS**: Never use `export -f` for bash functions. Functions are available in the current shell via `source`. Exporting functions pollutes child shells and is unnecessary for tetra modules.
- BASH VERSION REQUIREMENT: tetra requires bash 5.2 or higher. Use modern bash 5.2+ syntax freely.
- Strong globals: TETRA_SRC, TETRA_DIR are always available. Module pattern: MOD_SRC=$TETRA_SRC/bash/modname, MOD_DIR=$TETRA_DIR/modname

## TSM Convention

- Always use `tsm start <service>` and `tsm stop <service>` to manage services
- NEVER run `node server.js` or `python script.py` directly from shell
