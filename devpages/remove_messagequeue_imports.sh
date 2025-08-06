#!/bin/bash

echo "🔥 NUKING ALL MESSAGEQUEUE IMPORTS"
echo "=================================="
echo

# Find all files importing from messageQueue
echo "1. Files importing from messageQueue.js:"
grep -r "from.*messaging/messageQueue" . --include="*.js" | cut -d: -f1 | sort -u

echo
echo "2. Removing/commenting out broken imports..."

# List of files to fix
files_to_fix=(
    "client/dom-inspector/DomInspectorSettings.js"
    "client/examples/thunkUsage.js"
    "client/actions/editorActions.js"
    "client/actions/uiActions.js"
    "client/settings/panels/themes/ThemeSelectorPanel.js"
    "client/settings/panels/icons/Icons.js"
    "client/preview/plugins/css.js"
    "packages/devpages-debug/panels/CssFilesPanel/core/CssStateManager.js"
    "packages/devpages-debug/panels/dom-inspector/DomInspectorDebugPanel.js"
)

for file in "${files_to_fix[@]}"; do
    if [ -f "$file" ]; then
        echo "📝 Processing: $file"
        
        # Comment out the broken import
        sed -i 's|import.*from.*messaging/messageQueue.*|// REMOVED: messageQueue import (file deleted)|g' "$file"
        
        # Also comment out any ActionTypes usage since it came from messageQueue
        sed -i 's|ActionTypes\.|// ActionTypes.|g' "$file"
        
        echo "   ✅ Commented out messageQueue imports"
    else
        echo "   ⚠️  File not found: $file"
    fi
done

echo
echo "3. Adding Redux imports where needed..."

# Add Redux imports to files that were using dispatch
redux_files=(
    "client/dom-inspector/DomInspectorSettings.js"
    "client/actions/editorActions.js"
    "client/actions/uiActions.js"
    "client/settings/panels/themes/ThemeSelectorPanel.js"
    "client/settings/panels/icons/Icons.js"
    "client/preview/plugins/css.js"
)

for file in "${redux_files[@]}"; do
    if [ -f "$file" ]; then
        echo "📝 Adding Redux import to: $file"
        
        # Add Redux import at the top (after existing imports)
        sed -i '1a\import { appStore } from "/client/appState.js";' "$file"
        
        echo "   ✅ Added Redux import"
    fi
done

echo
echo "4. Verification - checking for remaining messageQueue references:"
remaining=$(grep -r "messaging/messageQueue" . --include="*.js" 2>/dev/null | wc -l)
echo "Remaining messageQueue imports: $remaining"

if [ "$remaining" -eq 0 ]; then
    echo "✅ ALL MESSAGEQUEUE IMPORTS NUKED SUCCESSFULLY!"
else
    echo "⚠️  Some imports may still exist:"
    grep -r "messaging/messageQueue" . --include="*.js" 2>/dev/null | head -5
fi

echo
echo "🎯 SUMMARY:"
echo "- Commented out all messageQueue imports"
echo "- Added Redux imports where dispatch was used"
echo "- Files may need manual fixes for dispatch usage"
echo "- Replace 'dispatch(action)' with 'appStore.dispatch(action)'"