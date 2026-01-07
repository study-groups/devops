#!/bin/bash

# CSS files to remove
CSS_FILES=(
    "system-collapsible.css"
    "log-viewer.css"
    "pcb.css"
    "pja-ui-tabbed-view.css"
)

# Directory containing CSS files
CSS_DIR="/home/dev/src/pixeljam/pja/arcade/playwright/server/static/css"

# Backup directory
BACKUP_DIR="/home/dev/src/pixeljam/pja/arcade/playwright/server/static/css/backup_$(date +%Y%m%d_%H%M%S)"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup and remove files
for file in "${CSS_FILES[@]}"; do
    full_path="$CSS_DIR/$file"
    if [ -f "$full_path" ]; then
        cp "$full_path" "$BACKUP_DIR/"
        rm "$full_path"
        echo "Removed $file (backed up to $BACKUP_DIR)"
    else
        echo "File $file not found"
    fi
done

# Copy deletion manifest to backup
cp "$CSS_DIR/CSS_DELETION_MANIFEST.md" "$BACKUP_DIR/"

echo "CSS cleanup complete. Backup located in $BACKUP_DIR"
