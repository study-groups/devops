# tetra-self: Self-Management Module

Tetra's meta-module for installation, maintenance, and system hygiene.

## Overview

The `self` module provides commands for managing tetra's own infrastructure, following TCS 4.0 standards and TAS (Tetra Action Specification) patterns.

## Commands

### tetra-self audit

Inspect and categorize all files in TETRA_DIR.

**Usage**: `tetra-self audit [--detail]`

**Options**:
- `--detail` - Show detailed file listings for each category

**Categories**:
- **Essential**: Identity-defining files (tetra.sh, local.sh, aliases.sh)
- **Runtime**: Module data directories
- **Dependencies**: External tools (node_modules, nvm, pyenv, python)
- **Garbage**: Testing/debug files
- **Unknown**: Files needing review

**Example**:
```bash
tetra-self audit
tetra-self audit --detail
```

### tetra-self clean

Remove testing and experimental files from TETRA_DIR.

**Usage**: `tetra-self clean [--dry-run] [--purge]`

**Options**:
- `--dry-run` - Preview changes without executing
- `--purge` - Permanently delete instead of moving to /tmp/tetra-old/

**Default behavior**: Moves files to `/tmp/tetra-old/` (reversible)

**Files removed**:
- `debug_*.sh`
- `test_*.sh`
- Testing/debugging scripts
- Experimental code

**Example**:
```bash
tetra-self clean --dry-run     # Preview first
tetra-self clean               # Move to archive
tetra-self clean --purge       # Permanent deletion
```

### tetra-self install

Verify tetra installation and check bootstrap integrity.

**Usage**: `tetra-self install`

**Checks**:
- TETRA_SRC exists and is valid
- TETRA_DIR exists
- bootloader.sh is present
- Essential files are in place

**Example**:
```bash
tetra-self install
```

### tetra-self upgrade

Update tetra from git source repository.

**Usage**: `tetra-self upgrade`

**Requirements**:
- TETRA_SRC must be a git repository
- Network connectivity for git pull

**Process**:
1. Verify git repository
2. Pull latest changes
3. Reload bootloader
4. Report success/failure

**Example**:
```bash
tetra-self upgrade
```

### tetra-self backup

Create compressed backup of TETRA_DIR.

**Usage**: `tetra-self backup [--exclude-runtime] [--include-source]`

**Options**:
- `--exclude-runtime` - Don't backup module data directories
- `--include-source` - Also backup TETRA_SRC

**Output**: `/tmp/tetra-backup-YYYYMMDD-HHMMSS.tar.gz`

**Example**:
```bash
tetra-self backup                              # Full backup
tetra-self backup --exclude-runtime            # Essential files only
tetra-self backup --include-source             # Backup source too
```

### tetra-self restore

Restore TETRA_DIR from backup tarball.

**Usage**: `tetra-self restore <backup-file>`

**Safety**: Prompts for confirmation before overwriting files.

**Example**:
```bash
tetra-self restore /tmp/tetra-backup-20250102-143022.tar.gz
```

## TAS Integration

All self commands are registered in the TAS action registry and can be executed via TAS syntax:

```bash
# Via action executor
action_exec "self.audit"
action_exec "self.clean"
action_exec "self.backup"

# List self actions
action_list self
```

## TCS 4.0 Compliance

The self module follows TCS 4.0 standards:

- **TRS naming**: Records in `$TETRA_DIR/self/db/timestamp.type.kind.format`
- **Unified logging**: All operations log to `$TETRA_DIR/logs/tetra.jsonl`
- **Type contracts**: Actions declare contracts in registry
- **Module pattern**: MOD_SRC + MOD_DIR separation

## Module Structure

```
self/
├── docs/
│   ├── ARCHITECTURE.md   # Design philosophy
│   └── TASKS.md          # Implementation tasks
├── includes.sh           # Module loader
├── self.sh               # Command router
├── self_log.sh           # TCS 4.0 logging wrapper
├── audit.sh              # Inspection functions
├── clean.sh              # Cleanup functions
├── install.sh            # Install/upgrade functions
├── backup.sh             # Backup/restore functions
└── README.md             # This file
```

## Philosophy

The `self` module embodies tetra's self-referential design philosophy:

> Software that can inspect, maintain, and modify itself while running.

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed design rationale.

## Key Principles

1. **Safe self-modification**: Read-only audit before changes
2. **Reversible operations**: Move to archive, don't delete
3. **Bootstrap integrity**: Verify essential files remain intact
4. **Dual directory**: TETRA_SRC (code) vs TETRA_DIR (state)
5. **Named identity**: tetra.sh defines system identity

## Example Workflows

### System Health Check
```bash
tetra-self audit
tetra-self install  # Verify bootstrap
```

### Spring Cleaning
```bash
tetra-self audit --detail       # Review garbage files
tetra-self clean --dry-run      # Preview cleanup
tetra-self clean                # Execute cleanup
tetra-self audit                # Verify clean state
```

### Backup Before Upgrade
```bash
tetra-self backup
tetra-self upgrade
# If problems occur:
tetra-self restore /tmp/tetra-backup-YYYYMMDD-HHMMSS.tar.gz
```

### Fresh Bootstrap
```bash
tetra-self install              # Verify installation
tetra-self audit                # Check file inventory
tetra-self clean                # Remove cruft
```

## Logging

All self commands log to the unified TCS 4.0 log:

```bash
# View self module logs
tetra_log_query_module self

# View recent self operations
tail -20 $TETRA_DIR/logs/tetra.jsonl | jq 'select(.module=="self")'
```

## Invariants

The self module preserves these system invariants:

1. TETRA_SRC and TETRA_DIR remain valid paths
2. tetra.sh remains at TETRA_DIR/tetra.sh
3. bootloader.sh remains at TETRA_SRC/bash/bootloader.sh
4. Module pattern: MOD_SRC=$TETRA_SRC/bash/[name], MOD_DIR=$TETRA_DIR/[name]
5. Bootstrap chain: tetra.sh → bootloader.sh → boot_core.sh → boot_modules.sh

## Success Criteria

After using self module:

✅ `tetra-self audit` produces clean categorized report
✅ `tetra-self clean` removes garbage, preserves essential files
✅ `tetra-self backup` creates restorable tarball
✅ `tetra-self install` verifies bootstrap integrity
✅ System remains fully functional
✅ All operations logged to tetra.jsonl

## Related Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - Self-referential design philosophy
- [TASKS.md](docs/TASKS.md) - Implementation details
- [TCS 4.0 Logging](../../docs/TCS_4.0_LOGGING_STANDARD.md) - Logging specification
- [TAS Specification](../../docs/TAS_SPECIFICATION.md) - Action syntax
- [TRS Specification](../../docs/TRS_SPECIFICATION.md) - Record naming

## Code Quality & Validation Tools

The self module also includes tools for code quality validation and CI integration.

### validate_paths.sh - Hardcoded Path Detection

Finds and fixes hardcoded paths that violate TETRA_SRC conventions.

**Usage:**
```bash
validate_paths.sh [directory]           # Scan directory
validate_paths.sh --check-file <file>   # Check single file
validate_paths.sh --fix-file <file>     # Fix single file (creates backup)
```

### shellcheck_report.sh - Code Quality Analysis

Comprehensive shellcheck integration with reporting.

**Usage:**
```bash
shellcheck_report.sh [directory]            # Scan directory
shellcheck_report.sh --module <name>        # Scan module
shellcheck_report.sh --critical-only [dir]  # Errors only
```

### ci_validate.sh - CI Validation Pipeline

Complete validation suite for continuous integration.

**Usage:**
```bash
ci_validate.sh              # Run all checks
ci_validate.sh --strict     # Fail on any warning
ci_validate.sh --quick      # Critical checks only
```

### error_handling.sh - Error Handling Library

Standardized error handling patterns for bash scripts.

**Usage in scripts:**
```bash
source "$TETRA_SRC/bash/self/error_handling.sh"
tetra_error_setup
tetra_require_env TETRA_SRC TETRA_DIR
tetra_validate_tetra_src
```

See **LEGACY_CODE_REMEDIATION.md** for detailed documentation on these tools.

---

## Support

For issues or questions:
1. Run `tetra-self audit` to check system state
2. Check `$TETRA_DIR/logs/tetra.jsonl` for errors
3. Verify environment: `echo $TETRA_SRC $TETRA_DIR`
4. Test bootstrap: `source ~/tetra/tetra.sh`
5. Run CI validation: `bash/self/ci_validate.sh --quick`
