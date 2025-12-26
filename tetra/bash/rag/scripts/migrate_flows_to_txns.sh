#!/usr/bin/env bash
# migrate_flows_to_txns.sh - NO MIGRATION NEEDED
#
# NOTE: As of 2025-10-18, RAG flows remain in project-local rag/flows/ directories.
# This matches project-local artifact patterns.
#
# This script is kept for reference but is NO LONGER NEEDED because:
# - Flows stay in rag/flows/ (project-local)
# - TTM is configured to use rag/flows/ via TTM_TXNS_DIR override
# - No migration from legacy structure is required
#
# If you have flows in $TETRA_DIR/rag/txns/, you can manually copy them back to
# your project's rag/flows/ directory if needed.

echo "❌ Migration script is deprecated"
echo ""
echo "RAG flows now use project-local rag/flows/ directories."
echo "No migration is needed - your existing flows are already in the right place!"
echo ""
echo "Flow location: \$PWD/rag/flows/"
echo ""
exit 0

# Original migration script follows (disabled)

set -euo pipefail

# Defaults
: "${TETRA_DIR:=$HOME/.tetra}"
PROJECT_DIR="${1:-.}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}ℹ${NC} $*"
}

log_success() {
    echo -e "${GREEN}✓${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $*"
}

log_error() {
    echo -e "${RED}✗${NC} $*" >&2
}

# Validate project directory
if [[ ! -d "$PROJECT_DIR" ]]; then
    log_error "Project directory not found: $PROJECT_DIR"
    exit 1
fi

PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
RAG_DIR="$PROJECT_DIR/rag"
FLOWS_DIR="$RAG_DIR/flows"

# Check if rag/flows exists
if [[ ! -d "$FLOWS_DIR" ]]; then
    log_warn "No rag/flows directory found at: $FLOWS_DIR"
    log_info "Nothing to migrate."
    exit 0
fi

# Count flows (exclude active symlink)
FLOW_COUNT=$(find "$FLOWS_DIR" -mindepth 1 -maxdepth 1 -type d ! -name "active" | wc -l | tr -d ' ')

if [[ "$FLOW_COUNT" -eq 0 ]]; then
    log_warn "No flows found in $FLOWS_DIR"
    exit 0
fi

echo "======================================================================"
echo "  RAG Flow Migration: rag/flows → \$TETRA_DIR/rag/txns"
echo "======================================================================"
echo ""
log_info "Project: $PROJECT_DIR"
log_info "Source: $FLOWS_DIR"
log_info "Target: $TETRA_DIR/rag/txns"
log_info "Flows to migrate: $FLOW_COUNT"
echo ""

# Confirm migration
read -p "Proceed with migration? [y/N] " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log_warn "Migration cancelled"
    exit 0
fi

# Create target directory
TARGET_DIR="$TETRA_DIR/rag/txns"
mkdir -p "$TARGET_DIR"
log_success "Created $TARGET_DIR"

# Create backup
BACKUP_DIR="$RAG_DIR/flows.backup.$(date +%Y%m%d_%H%M%S)"
log_info "Creating backup: $BACKUP_DIR"
cp -R "$FLOWS_DIR" "$BACKUP_DIR"
log_success "Backup created"

# Migrate each flow
MIGRATED=0
FAILED=0
ACTIVE_FLOW=""

# Get active flow if exists
if [[ -L "$FLOWS_DIR/active" ]]; then
    ACTIVE_FLOW=$(basename "$(readlink -f "$FLOWS_DIR/active" 2>/dev/null || readlink "$FLOWS_DIR/active")")
    log_info "Active flow detected: $ACTIVE_FLOW"
fi

echo ""
log_info "Migrating flows..."
echo ""

for flow_dir in "$FLOWS_DIR"/*; do
    [[ -d "$flow_dir" ]] || continue

    flow_id=$(basename "$flow_dir")

    # Skip active symlink
    [[ "$flow_id" == "active" ]] && continue

    log_info "Migrating: $flow_id"

    # Target flow directory
    target_flow="$TARGET_DIR/$flow_id"

    # Check if already exists
    if [[ -d "$target_flow" ]]; then
        log_warn "  Flow already exists in target, skipping: $flow_id"
        ((FAILED++))
        continue
    fi

    # Copy entire flow directory
    if cp -R "$flow_dir" "$target_flow"; then
        log_success "  Copied: $flow_id"

        # Validate critical files
        if [[ -f "$target_flow/state.json" ]]; then
            log_success "  ✓ state.json"
        else
            log_warn "  ✗ state.json missing"
        fi

        if [[ -f "$target_flow/events.ndjson" ]]; then
            log_success "  ✓ events.ndjson"
        else
            log_warn "  ✗ events.ndjson missing"
        fi

        if [[ -d "$target_flow/ctx" ]]; then
            CTX_COUNT=$(find "$target_flow/ctx" -type f | wc -l | tr -d ' ')
            log_success "  ✓ ctx/ ($CTX_COUNT files)"
        else
            log_warn "  ✗ ctx/ missing"
        fi

        ((MIGRATED++))
    else
        log_error "  Failed to copy: $flow_id"
        ((FAILED++))
    fi

    echo ""
done

# Update active symlink
if [[ -n "$ACTIVE_FLOW" ]]; then
    log_info "Updating active flow symlink..."
    if [[ -d "$TARGET_DIR/$ACTIVE_FLOW" ]]; then
        ln -sf "$TARGET_DIR/$ACTIVE_FLOW" "$TARGET_DIR/active"
        log_success "Active flow linked: $ACTIVE_FLOW"
    else
        log_warn "Active flow not found in target: $ACTIVE_FLOW"
    fi
fi

# Summary
echo ""
echo "======================================================================"
echo "  Migration Summary"
echo "======================================================================"
log_success "Migrated: $MIGRATED flows"
[[ $FAILED -gt 0 ]] && log_warn "Failed: $FAILED flows"
log_info "Backup: $BACKUP_DIR"
log_info "Target: $TARGET_DIR"
echo ""

# Recommend next steps
echo "Next steps:"
echo "  1. Verify flows: ls -la $TARGET_DIR"
echo "  2. Test RAG with new TTM integration"
echo "  3. If all works, remove old flows: rm -rf $FLOWS_DIR"
echo "  4. Update project to use $TETRA_DIR/rag/txns"
echo ""

log_success "Migration complete!"
