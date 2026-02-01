#!/usr/bin/env bash
# test-org-parity.sh - Verify sections <-> tetra.toml parity
set +e

source "$(dirname "$0")/test-framework.sh"

startup_test_setup "Org Parity Tests"

# Source modules
source "$TETRA_SRC/bash/org/org.sh"
source "$TETRA_SRC/bash/nh_bridge/nhb_import.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
JSON_FILE="$SCRIPT_DIR/fixtures/testorg-digocean.json"

# Setup: create org, import, build
_create_test_org "paritytest" >/dev/null
nhb_import "$JSON_FILE" "paritytest" "no-build" >/dev/null 2>&1
org_build "paritytest" >/dev/null 2>&1

PARITY_ORG_DIR="$TETRA_DIR/orgs/paritytest"
PARITY_TOML="$PARITY_ORG_DIR/tetra.toml"

# ─── Content Preservation ───

test_parity_section_content_preserved() {
    local sections_dir="$PARITY_ORG_DIR/sections"
    for file in "$sections_dir"/*.toml; do
        [[ -f "$file" ]] || continue
        # Every non-comment, non-empty line should appear in tetra.toml
        while IFS= read -r line; do
            [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
            if ! grep -qF "$line" "$PARITY_TOML"; then
                echo "Missing line from $(basename "$file"): $line" >&2
                return 1
            fi
        done < "$file"
    done
    return 0
}

# ─── Section Order ───

test_parity_section_order() {
    # Extract --- markers from tetra.toml, verify sorted
    local markers
    markers=$(grep '^# --- .*\.toml ---$' "$PARITY_TOML" | sed 's/# --- //;s/ ---//')
    local sorted
    sorted=$(echo "$markers" | sort)
    [[ "$markers" == "$sorted" ]]
}

# ─── No Extra Content ───

test_parity_no_extra_content() {
    # Every non-comment, non-empty, non-marker line in tetra.toml
    # should exist in one of the source sections
    local sections_dir="$PARITY_ORG_DIR/sections"
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^# ]] && continue

        local found=false
        for file in "$sections_dir"/*.toml; do
            [[ -f "$file" ]] || continue
            if grep -qF "$line" "$file"; then
                found=true
                break
            fi
        done

        if ! $found; then
            echo "Extra content in tetra.toml: $line" >&2
            return 1
        fi
    done < "$PARITY_TOML"
    return 0
}

# ─── Idempotent Rebuild ───

test_parity_rebuild_idempotent() {
    # Save current (strip timestamp line)
    local first
    first=$(grep -v '^# Built:' "$PARITY_TOML")

    # Rebuild
    org_build "paritytest" >/dev/null 2>&1

    local second
    second=$(grep -v '^# Built:' "$PARITY_TOML")

    [[ "$first" == "$second" ]]
}

# ─── Re-import Preserves Others ───

test_parity_nhb_reimport_preserves_others() {
    # Capture checksums of non-infrastructure sections
    local sections_dir="$PARITY_ORG_DIR/sections"
    local before_org before_storage
    before_org=$(md5sum "$sections_dir/00-org.toml" 2>/dev/null || md5 -q "$sections_dir/00-org.toml")
    before_storage=$(md5sum "$sections_dir/20-storage.toml" 2>/dev/null || md5 -q "$sections_dir/20-storage.toml")

    # Re-import
    nhb_import "$JSON_FILE" "paritytest" "no-build" >/dev/null 2>&1

    local after_org after_storage
    after_org=$(md5sum "$sections_dir/00-org.toml" 2>/dev/null || md5 -q "$sections_dir/00-org.toml")
    after_storage=$(md5sum "$sections_dir/20-storage.toml" 2>/dev/null || md5 -q "$sections_dir/20-storage.toml")

    [[ "$before_org" == "$after_org" ]] && [[ "$before_storage" == "$after_storage" ]]
}

# ─── Run ───

run_test "every section line appears in tetra.toml" test_parity_section_content_preserved
run_test "sections appear in alphabetical order" test_parity_section_order
run_test "no extra content in tetra.toml" test_parity_no_extra_content
run_test "rebuild is idempotent (modulo timestamp)" test_parity_rebuild_idempotent
run_test "re-import only changes 10-infrastructure" test_parity_nhb_reimport_preserves_others

startup_test_results "Org Parity Results"
exit $TESTS_FAILED
