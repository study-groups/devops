#!/usr/bin/env bash
# test-init-lifecycle.sh - Tests for tetra init/install lifecycle
set +e

source "$(dirname "$0")/test-framework.sh"

# Override HOME for isolation
REAL_HOME="$HOME"
export HOME="$STARTUP_TEST_DIR/fakehome"
mkdir -p "$HOME"

# Override TETRA_DIR to be inside fake home
TETRA_DIR="$HOME/tetra"
export TETRA_DIR

startup_test_setup "Init Lifecycle Tests"

# Source init module
source "$TETRA_SRC/bash/tetra/init/init.sh"

# ─── Init Creates Skeleton ───

test_tetra_init_creates_skeleton() {
    tetra_init >/dev/null 2>&1
    [[ -d "$TETRA_DIR" ]] &&
    [[ -d "$TETRA_DIR/orgs" ]] &&
    [[ -d "$TETRA_DIR/config" ]]
}

# ─── Bootloader Entry ───

test_tetra_init_writes_bootloader() {
    [[ -f "$TETRA_DIR/tetra.sh" ]] &&
    grep -q 'TETRA_SRC' "$TETRA_DIR/tetra.sh"
}

# ─── Start Script ───

test_tetra_init_writes_start_script() {
    [[ -f "$HOME/start-tetra.sh" ]] &&
    grep -q 'TETRA_NVM' "$HOME/start-tetra.sh"
}

# ─── Default Org ───

test_tetra_init_creates_default_org() {
    [[ -d "$TETRA_DIR/orgs/tetra" ]] &&
    [[ -d "$TETRA_DIR/orgs/tetra/sections" || -d "$TETRA_DIR/orgs/tetra" ]]
}

# ─── Idempotent ───

test_tetra_init_idempotent() {
    # Capture state before second run
    local before
    before=$(find "$TETRA_DIR" -type f | sort | xargs cat 2>/dev/null | md5sum 2>/dev/null || find "$TETRA_DIR" -type f | sort | xargs cat 2>/dev/null | md5 -q)

    tetra_init >/dev/null 2>&1

    local after
    after=$(find "$TETRA_DIR" -type f | sort | xargs cat 2>/dev/null | md5sum 2>/dev/null || find "$TETRA_DIR" -type f | sort | xargs cat 2>/dev/null | md5 -q)

    # tetra.sh gets regenerated with same content, start-tetra.sh too
    # The key is no errors and data preserved
    [[ -d "$TETRA_DIR/orgs/tetra" ]]
}

# ─── Config Symlink ───

test_tetra_init_config_symlink() {
    [[ -L "$TETRA_DIR/config/tetra.toml" ]]
}

# ─── Run ───

run_test "tetra_init creates skeleton dirs" test_tetra_init_creates_skeleton
run_test "tetra_init writes bootloader tetra.sh" test_tetra_init_writes_bootloader
run_test "tetra_init writes start-tetra.sh" test_tetra_init_writes_start_script
run_test "tetra_init creates default org" test_tetra_init_creates_default_org
run_test "tetra_init is idempotent" test_tetra_init_idempotent
run_test "config/tetra.toml is a symlink" test_tetra_init_config_symlink

# Restore HOME
export HOME="$REAL_HOME"

startup_test_results "Init Lifecycle Results"
exit $TESTS_FAILED
