#!/bin/bash
# Disable redundant files that have been migrated to core modules

# Parse arguments
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      echo "Usage: ./disable-redundant-files.sh [--dry-run]"
      echo
      echo "Options:"
      echo "  --dry-run   Show what would be done without making changes"
      echo "  --help      Show this help message"
      exit 0
      ;;
  esac
done

if [ "$DRY_RUN" = true ]; then
  echo "DRY RUN: Will show what would be done without making changes"
  echo
fi

echo "Disabling redundant files that have been migrated to core modules..."

# Helper function to disable a file
disable_file() {
  local file=$1
  local target="${file}.disabled"
  
  if [ -f "$file" ] && [ ! -f "$target" ]; then
    if [ "$DRY_RUN" = true ]; then
      echo "Would disable: $file -> $target"
    else
      mv "$file" "$target"
      echo "Disabled $file"
    fi
  elif [ -f "$target" ]; then
    echo "Already disabled: $file"
  else
    echo "File not found: $file"
  fi
}

# Helper function to check if a file is a compatibility layer
is_compatibility_layer() {
  local file=$1
  if grep -q "import.*from.*core\/index\|import.*from.*\/client\/core\|import.*from.*\/core\/" "$file"; then
    return 0  # true
  else
    return 1  # false
  fi
}

# View system files already migrated to core/views.js
disable_file "viewFix.js"
disable_file "fixViews.js"
disable_file "viewManager.js"

# Preview system files migrated to core/preview.js
disable_file "previewFix.js"
disable_file "previewManager.js"
disable_file "mermaidFix.js"  # Recently refactored

# Editor system files migrated to core/editor.js
disable_file "editorHotfix.js"
disable_file "editorFix.js"
disable_file "imageUploadFix.js"  # Recently refactored

# Auth system files migrated to core/auth.js
for file in authService.js authManager.js authDebug.js; do
  if [ -f "$file" ]; then
    if is_compatibility_layer "$file"; then
      echo "Keeping $file (compatibility layer)"
    else
      disable_file "$file"
    fi
  fi
done

# These files should be kept as compatibility layers
for file in auth.js login.js; do
  if [ -f "$file" ]; then
    if ! is_compatibility_layer "$file"; then
      echo "WARNING: $file should be a compatibility layer but doesn't import from core"
    else
      echo "Keeping $file (compatibility layer)"
    fi
  fi
done

if [ "$DRY_RUN" = true ]; then
  echo
  echo "This was a dry run. No changes were made."
else
  echo "Done! Disabled redundant files that have been migrated to core modules."
fi 