#!/usr/bin/env bash
# tetra-self module includes

# Module paths
MOD_SRC="$TETRA_SRC/bash/self"
MOD_DIR="${MOD_DIR:-$TETRA_DIR/self}"

# Ensure module data directory exists
mkdir -p "$MOD_DIR"
mkdir -p "$MOD_DIR/db"

# Source TCS 4.0 action registry if available
if [[ -f "$TETRA_SRC/bash/actions/registry.sh" ]]; then
    source "$TETRA_SRC/bash/actions/registry.sh"
fi

# Source all components
source "$MOD_SRC/self_log.sh"

# Core infrastructure (module management)
source "$MOD_SRC/module_registry.sh"
source "$MOD_SRC/module_metadata.sh"
source "$MOD_SRC/module_index.sh"
source "$MOD_SRC/dev_modules.sh"

# Command implementations
source "$MOD_SRC/self.sh"
source "$MOD_SRC/audit.sh"
source "$MOD_SRC/clean.sh"
source "$MOD_SRC/install.sh"
source "$MOD_SRC/backup.sh"
source "$MOD_SRC/lint.sh"

# Note: preflight.sh, audit_modules.sh, legacy.sh, organize_tests.sh
# are standalone CLI scripts and are called directly, not sourced

# Register actions in TAS registry
if type action_register &>/dev/null; then
    # File management
    action_register "self" "audit" "Categorize system files" "[--detail] [--modules]" "no"
    action_register "self" "clean" "Remove testing files" "[--dry-run] [--purge]" "no"
    action_register "self" "organize" "Organize test files" "tests [analyze|organize|full]" "no"

    # Module management
    action_register "self" "modules.list" "List all modules" "" "no"
    action_register "self" "modules.index" "Rebuild module index" "" "no"
    action_register "self" "legacy.list" "Show legacy modules" "" "no"
    action_register "self" "legacy.classify" "Classify module status" "<module>" "no"
    action_register "self" "dev.list" "List dev modules" "" "no"
    action_register "self" "dev.register" "Register dev modules" "" "no"

    # Code quality
    action_register "self" "lint" "Run code quality checks" "[orphans|structure|dead|deps|git|status|all]" "no"
    action_register "self" "lint.orphans" "Find orphaned files" "" "no"
    action_register "self" "lint.structure" "Validate directory structure" "" "no"
    action_register "self" "lint.dead" "Detect unused modules" "" "no"
    action_register "self" "lint.deps" "Validate TETRA_SRC usage" "" "no"
    action_register "self" "lint.git" "Show git status" "" "no"
    action_register "self" "lint.status" "Health summary" "" "no"

    # System
    action_register "self" "preflight" "Validate environment" "[check|fix]" "no"
    action_register "self" "install" "Verify bootstrap" "" "no"
    action_register "self" "upgrade" "Update from git" "" "no"

    # Backup/restore
    action_register "self" "backup" "Create system backup" "[--exclude-runtime] [--include-source]" "no"
    action_register "self" "restore" "Restore from backup" "<backup-file>" "no"
fi
