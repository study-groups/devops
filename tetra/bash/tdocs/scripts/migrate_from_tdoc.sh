#!/usr/bin/env bash
# Migrate runtime data from tdoc → tdocs

set -euo pipefail

echo "=== tdoc → tdocs Migration ==="
echo ""

# Set up directories
TETRA_DIR="${TETRA_DIR:-$HOME/tetra}"
OLD_DIR="$TETRA_DIR/tdoc"
NEW_DIR="$TETRA_DIR/tdocs"

# Check if old directory exists
if [[ ! -d "$OLD_DIR" ]]; then
    echo "✓ No migration needed: $OLD_DIR does not exist"
    exit 0
fi

# Check if new directory already exists
if [[ -d "$NEW_DIR" ]]; then
    echo "⚠ Warning: $NEW_DIR already exists"
    echo ""
    read -p "Merge with existing tdocs directory? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Migration cancelled"
        exit 1
    fi
else
    mkdir -p "$NEW_DIR"
fi

# Create backup
BACKUP_DIR="$TETRA_DIR/tdoc.backup.$(date +%Y%m%d_%H%M%S)"
echo "Creating backup: $BACKUP_DIR"
cp -r "$OLD_DIR" "$BACKUP_DIR"
echo "✓ Backup created"
echo ""

# Migrate directories
echo "Migrating runtime data..."

# Copy database files
if [[ -d "$OLD_DIR/db" ]]; then
    echo "  - Database files..."
    mkdir -p "$NEW_DIR/db"
    cp -r "$OLD_DIR/db/"* "$NEW_DIR/db/" 2>/dev/null || true
fi

# Copy chuck files
if [[ -d "$OLD_DIR/chuck" ]]; then
    echo "  - Chuck documents..."
    mkdir -p "$NEW_DIR/chuck"
    cp -r "$OLD_DIR/chuck/"* "$NEW_DIR/chuck/" 2>/dev/null || true
fi

# Copy config files
if [[ -d "$OLD_DIR/config" ]]; then
    echo "  - Config files..."
    mkdir -p "$NEW_DIR/config"
    cp -r "$OLD_DIR/config/"* "$NEW_DIR/config/" 2>/dev/null || true
fi

# Copy cache files
if [[ -d "$OLD_DIR/cache" ]]; then
    echo "  - Cache files..."
    mkdir -p "$NEW_DIR/cache"
    cp -r "$OLD_DIR/cache/"* "$NEW_DIR/cache/" 2>/dev/null || true
fi

echo "✓ Runtime data copied"
echo ""

# Update path references in metadata files
echo "Updating path references in metadata files..."
UPDATED_COUNT=0

if [[ -d "$NEW_DIR/db" ]]; then
    while IFS= read -r meta_file; do
        if grep -q 'bash/tdoc/' "$meta_file" 2>/dev/null; then
            # Update paths
            sed -i.bak 's|bash/tdoc/|bash/tdocs/|g' "$meta_file"
            rm -f "${meta_file}.bak"
            ((UPDATED_COUNT++))
        fi
    done < <(find "$NEW_DIR/db" -name "*.meta" -type f 2>/dev/null)
fi

if [[ $UPDATED_COUNT -gt 0 ]]; then
    echo "✓ Updated $UPDATED_COUNT metadata files"
else
    echo "✓ No path references needed updating"
fi
echo ""

# Offer to remove old directory
echo "Migration complete!"
echo ""
echo "Migrated data:"
echo "  Database: $NEW_DIR/db/"
echo "  Chuck:    $NEW_DIR/chuck/"
echo "  Config:   $NEW_DIR/config/"
echo "  Cache:    $NEW_DIR/cache/"
echo ""
echo "Backup saved to: $BACKUP_DIR"
echo ""

read -p "Remove old tdoc directory? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$OLD_DIR"
    echo "✓ Old directory removed"
else
    echo "Old directory kept at: $OLD_DIR"
    echo "You can remove it manually later if the migration was successful"
fi

echo ""
echo "✓ Migration complete!"
echo ""
echo "Next steps:"
echo "  1. Test tdocs commands: tdocs ls"
echo "  2. Launch REPL: tdocs browse"
echo "  3. If everything works, you can remove the backup:"
echo "     rm -rf $BACKUP_DIR"
