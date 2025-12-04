# Module Loading Reference

## How `tmod load <name>` works

1. Checks if module is already registered in `TETRA_MODULE_LOADERS`
2. If not, **auto-discovers** by looking for `$TETRA_SRC/bash/<name>/`
3. Registers and loads via `tetra_load_module`

## Loading precedence (boot/boot_core.sh)

When loading a module at path `$loader_path`:

1. `$loader_path/includes.sh` - if exists, source it (full control)
2. `$loader_path/<name>.sh` - if exists, source main file
3. `$loader_path/*.sh` - fallback: source all .sh files (except excluded)

## Minimal module structure

```
bash/mymod/
└── mymod.sh      # Just this works! Named after directory.
```

## Standard module structure

```
bash/mymod/
├── includes.sh   # Optional: explicit load order
├── mymod.sh      # Main command/entry point
└── mymod_*.sh    # Supporting files
```

## Tab completion

Register in main file:
```bash
complete -F _mymod_complete mymod
```

## Key globals

- `TETRA_MODULE_LOADERS[name]` - path to module
- `TETRA_MODULE_LOADED[name]` - true/false load status
