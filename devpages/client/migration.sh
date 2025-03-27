#!/bin/bash
# Migration script for DevPages refactoring

# Create a backup directory
BACKUP_DIR="client/old/backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Files to be disabled by renaming to .disabled
DISABLE_FILES=(
  "client/auth.js" 
  "client/authService.js"
  "client/login.js"
  "client/viewManager.js"
  "client/authManager.js"
  "client/authCompat.js"
  "client/authDebug.js"
)

# Disable files by renaming them
for file in "${DISABLE_FILES[@]}"; do
  if [ -f "$file" ]; then
    cp "$file" "$BACKUP_DIR/$(basename "$file")"
    mv "$file" "${file}.disabled"
    echo "Disabled: $file -> ${file}.disabled"
  else
    echo "Warning: File $file not found, skipping"
  fi
done

# Create symlinks for backward compatibility
echo "Creating symlinks for backward compatibility..."

# Auth symlinks
ln -sf core/auth.js client/auth.js
ln -sf core/auth.js client/authService.js
ln -sf core/auth.js client/login.js
ln -sf core/auth.js client/authManager.js
ln -sf core/auth.js client/authCompat.js
ln -sf core/auth.js client/authDebug.js

# View symlinks
ln -sf core/views.js client/viewManager.js
ln -sf core/views.js client/viewFix.js
ln -sf core/views.js client/fixViews.js

echo "Migration complete. Original files are backed up in $BACKUP_DIR"
echo "If everything works correctly, you can remove the .disabled files" 