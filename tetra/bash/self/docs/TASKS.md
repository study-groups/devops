# Tetra-Self Module Implementation Tasks

**Context**: Building a self-referential maintenance module for the tetra bash system. Module name: `self`. Commands: `tetra-self install|clean|audit|backup|restore|upgrade`.

## Module Structure

Location: `~/src/devops/tetra/bash/self/`

Directory layout:
```
self/
├── docs/
│   ├── ARCHITECTURE.md (✓ completed)
│   └── TASKS.md (this file)
├── includes.sh
├── self.sh
├── clean.sh
├── audit.sh
├── install.sh
└── backup.sh
```

## Tasks

### 1. Implement self.sh (Main Entry Point)

**Function**: `tetra-self [command] [options]`

**Commands**:
- `clean` - Move testing files to /tmp/tetra-old/
- `audit` - Report file inventory (essential/runtime/garbage/unknown)
- `install` - Fresh bootstrap from TETRA_SRC
- `upgrade` - Update from source
- `backup` - Create tarball of TETRA_DIR
- `restore <file>` - Restore from backup tarball

**Options**:
- `--dry-run` - Preview without executing
- `--detail` - Verbose output
- `--purge` - Delete instead of move (for clean)

**Implementation**:
```bash
#!/usr/bin/env bash
# tetra-self: Main entry point for self-management module

tetra-self() {
    local command="$1"
    shift

    case "$command" in
        clean)
            _tetra_self_clean "$@"
            ;;
        audit)
            _tetra_self_audit "$@"
            ;;
        install)
            _tetra_self_install "$@"
            ;;
        upgrade)
            _tetra_self_upgrade "$@"
            ;;
        backup)
            _tetra_self_backup "$@"
            ;;
        restore)
            _tetra_self_restore "$@"
            ;;
        *)
            echo "Usage: tetra-self {clean|audit|install|upgrade|backup|restore} [options]"
            return 1
            ;;
    esac
}
```

### 2. Implement clean.sh

**Purpose**: Remove testing/experimental files from TETRA_DIR

**Files to move to /tmp/tetra-old/**:
```bash
debug_*.sh
test_*.sh
capture_terminal_state.sh
find_exit_status.sh
preflight_check.sh
safe_source_tetra.sh
source_with_trace.sh
tetra_safe.sh
README_test.md
actions.registry
```

**Files to preserve**:
- `tetra.sh` (essential)
- `local.sh` (trapdoor - commented out but kept)
- `aliases.sh` (sourced by local.sh)
- `node_modules/`, `nvm/`, `pyenv/` (module dependencies)
- All module data directories (tsm/, claude/, etc.)

**Implementation outline**:
```bash
#!/usr/bin/env bash
# clean.sh: Self-cleaning functions

_tetra_self_clean() {
    local dry_run=false
    local purge=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run) dry_run=true; shift ;;
            --purge) purge=true; shift ;;
            *) shift ;;
        esac
    done

    # Define garbage patterns
    local garbage_files=(
        "debug_*.sh"
        "test_*.sh"
        "capture_terminal_state.sh"
        "find_exit_status.sh"
        "preflight_check.sh"
        "safe_source_tetra.sh"
        "source_with_trace.sh"
        "tetra_safe.sh"
        "README_test.md"
        "actions.registry"
    )

    # Create archive location
    local archive_dir="/tmp/tetra-old"
    if [[ "$purge" == false ]]; then
        mkdir -p "$archive_dir"
    fi

    # Process each pattern
    local count=0
    for pattern in "${garbage_files[@]}"; do
        for file in "$TETRA_DIR"/$pattern; do
            if [[ -e "$file" ]]; then
                local basename=$(basename "$file")
                if [[ "$dry_run" == true ]]; then
                    echo "[DRY RUN] Would move: $basename"
                elif [[ "$purge" == true ]]; then
                    rm -rf "$file"
                    echo "Deleted: $basename"
                else
                    mv "$file" "$archive_dir/"
                    echo "Moved: $basename → $archive_dir/"
                fi
                ((count++))
            fi
        done
    done

    echo ""
    echo "Cleanup complete: $count file(s) processed"
    if [[ "$purge" == false && "$dry_run" == false ]]; then
        echo "Archive location: $archive_dir"
    fi
}
```

### 3. Implement audit.sh

**Purpose**: Categorize and report all files in TETRA_DIR

**Categories**:
1. **Essential** (identity-defining): tetra.sh, local.sh, aliases.sh
2. **Runtime** (module data): Directories matching known module names
3. **Dependencies** (external tools): node_modules, nvm, pyenv, python
4. **Garbage** (testing): Files matching test/debug patterns
5. **Unknown** (needs review): Everything else

**Implementation outline**:
```bash
#!/usr/bin/env bash
# audit.sh: Self-inspection and inventory functions

_tetra_self_audit() {
    local detail=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --detail) detail=true; shift ;;
            *) shift ;;
        esac
    done

    echo "Tetra Self Audit - $TETRA_DIR"
    echo ""

    # Essential files
    local essential_files=("tetra.sh" "local.sh" "aliases.sh")
    echo "Essential Files:"
    local essential_count=0
    for file in "${essential_files[@]}"; do
        if [[ -e "$TETRA_DIR/$file" ]]; then
            echo "  ✓ $file"
            ((essential_count++))
        fi
    done
    echo "  Total: $essential_count"
    echo ""

    # Runtime data directories (module directories)
    echo "Runtime Data Directories:"
    local runtime_count=0
    for dir in "$TETRA_DIR"/*/; do
        if [[ -d "$dir" ]]; then
            local dirname=$(basename "$dir")
            # Skip special directories
            if [[ "$dirname" != "node_modules" && \
                  "$dirname" != "nvm" && \
                  "$dirname" != "pyenv" && \
                  "$dirname" != "python" ]]; then
                if [[ "$detail" == true ]]; then
                    echo "  $dirname/"
                fi
                ((runtime_count++))
            fi
        fi
    done
    echo "  Total: $runtime_count directories"
    echo ""

    # Dependencies
    echo "Dependencies:"
    local deps=("node_modules" "nvm" "pyenv" "python")
    local dep_count=0
    for dep in "${deps[@]}"; do
        if [[ -e "$TETRA_DIR/$dep" ]]; then
            echo "  ✓ $dep/"
            ((dep_count++))
        fi
    done
    echo "  Total: $dep_count"
    echo ""

    # Garbage files
    echo "Garbage (Testing/Debug):"
    local garbage_patterns=("debug_*.sh" "test_*.sh" "*_safe.sh" "capture_*.sh" "find_*.sh" "preflight_*.sh" "source_with_*.sh")
    local garbage_count=0
    for pattern in "${garbage_patterns[@]}"; do
        for file in "$TETRA_DIR"/$pattern; do
            if [[ -e "$file" ]]; then
                echo "  $(basename "$file")"
                ((garbage_count++))
            fi
        done
    done
    if [[ $garbage_count -eq 0 ]]; then
        echo "  (none - clean!)"
    else
        echo "  Total: $garbage_count files"
    fi
    echo ""

    # Unknown files
    echo "Unknown Files (need review):"
    local unknown_count=0
    for item in "$TETRA_DIR"/{.*,*}; do
        if [[ -e "$item" ]]; then
            local basename=$(basename "$item")
            # Skip known items
            if [[ "$basename" != "." && \
                  "$basename" != ".." && \
                  ! " ${essential_files[@]} " =~ " ${basename} " && \
                  "$basename" != "node_modules" && \
                  "$basename" != "nvm" && \
                  "$basename" != "pyenv" && \
                  "$basename" != "python" && \
                  ! -d "$item" ]]; then
                # Check if it's a garbage file
                local is_garbage=false
                for pattern in "${garbage_patterns[@]}"; do
                    if [[ "$basename" == $pattern ]]; then
                        is_garbage=true
                        break
                    fi
                done
                if [[ "$is_garbage" == false ]]; then
                    echo "  $basename"
                    ((unknown_count++))
                fi
            fi
        fi
    done
    if [[ $unknown_count -eq 0 ]]; then
        echo "  (none)"
    else
        echo "  Total: $unknown_count items"
    fi
}
```

### 4. Implement install.sh

**Purpose**: Fresh installation or upgrade of tetra

**install command**:
- Verify TETRA_SRC is set and exists
- Verify TETRA_DIR is set
- Check bootloader.sh exists
- Source bootloader to initialize system
- Create MOD_DIR for all registered modules
- Report: "Tetra installed successfully"

**upgrade command**:
- Check if TETRA_SRC is a git repo
- If yes: `git pull` in TETRA_SRC
- If no: Report "Not a git repo, manual update required"
- Re-source bootloader.sh
- Report: "Tetra upgraded successfully"

**Implementation outline**:
```bash
#!/usr/bin/env bash
# install.sh: Installation and upgrade functions

_tetra_self_install() {
    echo "Installing tetra..."

    # Verify environment
    if [[ -z "$TETRA_SRC" ]]; then
        echo "Error: TETRA_SRC not set"
        return 1
    fi

    if [[ ! -d "$TETRA_SRC" ]]; then
        echo "Error: TETRA_SRC directory does not exist: $TETRA_SRC"
        return 1
    fi

    if [[ -z "$TETRA_DIR" ]]; then
        echo "Error: TETRA_DIR not set"
        return 1
    fi

    # Check bootloader exists
    local bootloader="$TETRA_SRC/bash/bootloader.sh"
    if [[ ! -f "$bootloader" ]]; then
        echo "Error: bootloader.sh not found at $bootloader"
        return 1
    fi

    # Ensure TETRA_DIR exists
    mkdir -p "$TETRA_DIR"

    # Check if tetra.sh exists in TETRA_DIR
    if [[ ! -f "$TETRA_DIR/tetra.sh" ]]; then
        echo "Warning: tetra.sh not found in TETRA_DIR"
        echo "You may need to manually create ~/tetra/tetra.sh that sources the bootloader"
    fi

    echo "✓ TETRA_SRC: $TETRA_SRC"
    echo "✓ TETRA_DIR: $TETRA_DIR"
    echo "✓ Bootloader: $bootloader"
    echo ""
    echo "Tetra installation verified successfully"
    echo "Run 'source ~/tetra/tetra.sh' to load tetra"
}

_tetra_self_upgrade() {
    echo "Upgrading tetra..."

    # Check if TETRA_SRC is a git repo
    if [[ -d "$TETRA_SRC/.git" ]]; then
        echo "Pulling latest changes from git..."
        (cd "$TETRA_SRC" && git pull)

        if [[ $? -eq 0 ]]; then
            echo "✓ Git pull successful"
            echo ""
            echo "Reloading tetra..."
            source "$TETRA_SRC/bash/bootloader.sh"
            echo "✓ Tetra upgraded successfully"
        else
            echo "Error: Git pull failed"
            return 1
        fi
    else
        echo "TETRA_SRC is not a git repository"
        echo "Manual update required"
        echo "Location: $TETRA_SRC"
        return 1
    fi
}
```

### 5. Implement backup.sh

**Purpose**: Backup and restore TETRA_DIR state

**backup command**:
```bash
BACKUP_FILE=/tmp/tetra-backup-$(date +%Y%m%d-%H%M%S).tar.gz
tar -czf $BACKUP_FILE -C $TETRA_DIR .
echo "Backup created: $BACKUP_FILE"
```

**restore command**:
```bash
tetra-self restore /tmp/tetra-backup-20250102-143022.tar.gz
# Verify file exists
# Extract to TETRA_DIR (prompt for confirmation)
# Report: "Restored from $BACKUP_FILE"
```

**Implementation outline**:
```bash
#!/usr/bin/env bash
# backup.sh: Backup and restore functions

_tetra_self_backup() {
    local exclude_runtime=false
    local include_source=false

    # Parse options
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --exclude-runtime) exclude_runtime=true; shift ;;
            --include-source) include_source=true; shift ;;
            *) shift ;;
        esac
    done

    local timestamp=$(date +%Y%m%d-%H%M%S)
    local backup_file="/tmp/tetra-backup-$timestamp.tar.gz"

    echo "Creating backup of TETRA_DIR..."
    echo "Source: $TETRA_DIR"
    echo "Target: $backup_file"

    # Build tar command
    local tar_opts="-czf"
    local exclude_opts=""

    if [[ "$exclude_runtime" == true ]]; then
        # Exclude module data directories
        for dir in "$TETRA_DIR"/*/; do
            if [[ -d "$dir" ]]; then
                local dirname=$(basename "$dir")
                if [[ "$dirname" != "node_modules" && \
                      "$dirname" != "nvm" && \
                      "$dirname" != "pyenv" ]]; then
                    exclude_opts="$exclude_opts --exclude=$dirname"
                fi
            fi
        done
    fi

    # Create backup
    tar $tar_opts "$backup_file" -C "$TETRA_DIR" $exclude_opts .

    if [[ $? -eq 0 ]]; then
        echo "✓ Backup created successfully"
        echo "Location: $backup_file"
        local size=$(du -h "$backup_file" | cut -f1)
        echo "Size: $size"
    else
        echo "Error: Backup failed"
        return 1
    fi

    # Optionally backup source
    if [[ "$include_source" == true ]]; then
        local source_backup="/tmp/tetra-src-backup-$timestamp.tar.gz"
        echo ""
        echo "Creating backup of TETRA_SRC..."
        tar -czf "$source_backup" -C "$TETRA_SRC" .
        echo "✓ Source backup: $source_backup"
    fi
}

_tetra_self_restore() {
    local backup_file="$1"

    if [[ -z "$backup_file" ]]; then
        echo "Usage: tetra-self restore <backup-file>"
        return 1
    fi

    if [[ ! -f "$backup_file" ]]; then
        echo "Error: Backup file not found: $backup_file"
        return 1
    fi

    echo "WARNING: This will overwrite files in $TETRA_DIR"
    echo "Backup file: $backup_file"
    read -p "Continue? [y/N] " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Restoring from backup..."
        tar -xzf "$backup_file" -C "$TETRA_DIR"

        if [[ $? -eq 0 ]]; then
            echo "✓ Restore successful"
            echo "You may need to reload tetra: source ~/tetra/tetra.sh"
        else
            echo "Error: Restore failed"
            return 1
        fi
    else
        echo "Restore cancelled"
    fi
}
```

### 6. Create includes.sh

**Purpose**: Module entry point that sources all components

```bash
#!/usr/bin/env bash
# tetra-self module includes

MOD_SRC="$TETRA_SRC/bash/self"
MOD_DIR="${MOD_DIR:-$TETRA_DIR/self}"

# Ensure module data directory exists
mkdir -p "$MOD_DIR"

# Source all components
source "$MOD_SRC/self.sh"
source "$MOD_SRC/clean.sh"
source "$MOD_SRC/audit.sh"
source "$MOD_SRC/install.sh"
source "$MOD_SRC/backup.sh"
```

### 7. Register Module in boot_modules.sh

**Location**: `~/src/devops/tetra/bash/boot/boot_modules.sh`

**Add line** (alphabetically with other modules):
```bash
tetra_register_module "self" "tetra-self"
```

This creates a lazy-load stub that loads the module on first use.

### 8. Document local.sh Trapdoor Pattern

**Location**: `~/tetra/tetra.sh` line 9

**Current**:
```bash
#source $TETRA_DIR/local.sh
```

**Add comment above**:
```bash
# local.sh is a trapdoor for users who know what they're doing
# Commented out by default = no monkeybusiness
# Uncomment to enable user-specific functions (sendpic, sdu, etc.)
#source $TETRA_DIR/local.sh
```

### 9. Create Module README

**Location**: `~/src/devops/tetra/bash/self/README.md`

**Contents**:
```markdown
# tetra-self: Self-Management Module

Tetra's meta-module for installation, maintenance, and hygiene.

## Commands

### tetra-self clean
Remove testing and experimental files from TETRA_DIR

Options:
- `--dry-run` - Preview without executing
- `--purge` - Delete instead of moving to /tmp/tetra-old/

### tetra-self audit
Inspect and categorize all files in TETRA_DIR

Options:
- `--detail` - Show detailed file listings

### tetra-self install
Verify tetra installation and initialize system

### tetra-self upgrade
Update tetra from source (requires git repo)

### tetra-self backup
Create compressed backup of TETRA_DIR

Options:
- `--exclude-runtime` - Don't backup module data directories
- `--include-source` - Also backup TETRA_SRC

### tetra-self restore
Restore TETRA_DIR from backup tarball

Usage: `tetra-self restore /tmp/tetra-backup-TIMESTAMP.tar.gz`

## Philosophy

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for details on self-referential software design.

## Module Structure

```
self/
├── docs/
│   ├── ARCHITECTURE.md  # Technical article
│   └── TASKS.md         # Implementation tasks
├── includes.sh          # Module loader
├── self.sh              # Command router
├── clean.sh             # Cleanup functions
├── audit.sh             # Inspection functions
├── install.sh           # Install/upgrade functions
└── backup.sh            # Backup/restore functions
```
```

### 10. Initial Cleanup

**Execute**:
```bash
source ~/tetra/tetra.sh  # Load tetra
tetra-self clean         # Move garbage to /tmp/tetra-old/
```

**Expected**: 12+ files moved to /tmp/tetra-old/

### 11. Verification

**Execute**:
```bash
tetra-self audit
```

**Expected output**:
- Essential: 3 files
- Runtime: ~20+ directories
- Dependencies: 4 directories
- Garbage: 0 files
- Unknown: <5 items

---

## Key Architectural Decisions

1. **Module name**: `self` (not maint/tidy/meta)
2. **Command pattern**: `tetra-self [command]` (natural language: "tetra, clean yourself")
3. **Garbage disposal**: Move to `/tmp/tetra-old/` (not delete, reversible)
4. **Dependencies**: Keep node_modules, nvm, pyenv in TETRA_DIR (needed by modules)
5. **local.sh**: Keep commented out, add documentation explaining trapdoor pattern
6. **Module location**: `TETRA_SRC/bash/self/` (source) + `TETRA_DIR/self/` (runtime data)
7. **Documentation**: Use `docs/` subdirectory for scalability

## Invariants to Preserve

1. TETRA_SRC and TETRA_DIR must remain valid paths
2. tetra.sh must remain at TETRA_DIR/tetra.sh
3. bootloader.sh must remain at TETRA_SRC/bash/bootloader.sh
4. Module pattern: MOD_SRC=$TETRA_SRC/bash/[name], MOD_DIR=$TETRA_DIR/[name]
5. Bootstrap chain: tetra.sh → bootloader.sh → boot_core.sh → boot_modules.sh

## Success Criteria

After implementation:
1. `tetra-self audit` produces clean categorized report
2. `tetra-self clean` moves all garbage files, leaves essential/runtime intact
3. `tetra-self backup` creates restorable tarball
4. `tetra-self install` can bootstrap fresh tetra from TETRA_SRC
5. TETRA_DIR contains only: tetra.sh, local.sh, aliases.sh + module directories + dependencies
6. System remains fully functional after cleanup

---

## Implementation Order

Suggested implementation sequence:

1. ✓ Create directory structure (`bash/self/` and `bash/self/docs/`)
2. ✓ Write documentation (ARCHITECTURE.md, TASKS.md)
3. Create self.sh (command router)
4. Create audit.sh (read-only, safe to test first)
5. Create clean.sh (test with --dry-run first!)
6. Create install.sh (verify, don't modify)
7. Create backup.sh (creates new files, doesn't modify existing)
8. Create includes.sh (ties it all together)
9. Register in boot_modules.sh
10. Test each command
11. Document local.sh trapdoor
12. Create README.md
13. Run initial cleanup
14. Final verification audit

---

**Status**: Directory structure and documentation complete. Ready to implement functional components.
