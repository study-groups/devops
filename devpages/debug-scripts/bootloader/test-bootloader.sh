#!/bin/bash

# Bootloader Test Script
# Tests bootloader functionality and deep link navigation

echo "🔍 Bootloader Test Script"
echo "=========================="

# Check if we're in the right directory
if [ ! -f "client/bootloader.js" ]; then
    echo "❌ Error: Must be run from devpages root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected: /root/src/devops/devpages"
    exit 1
fi

echo "✅ Running from correct directory: $(pwd)"

# Check bootloader file exists and recent changes
echo ""
echo "📁 Bootloader File Status:"
if [ -f "client/bootloader.js" ]; then
    echo "   ✅ bootloader.js exists"
    echo "   📊 Size: $(wc -l < client/bootloader.js) lines"
    echo "   🕒 Modified: $(stat -c %y client/bootloader.js)"
    
    # Check for deep link navigation fix
    if grep -q "pathThunks.navigateToPath" client/bootloader.js; then
        echo "   ✅ Deep link navigation fix present"
    else
        echo "   ❌ Deep link navigation fix missing"
    fi
    
    # Check for navigation skipped (old broken code)
    if grep -q "NAVIGATION_SKIPPED" client/bootloader.js; then
        echo "   ❌ Old broken navigation code still present"
    else
        echo "   ✅ Old broken navigation code removed"
    fi
else
    echo "   ❌ bootloader.js not found"
    exit 1
fi

# Check related files
echo ""
echo "📁 Related Files:"
files=(
    "client/store/slices/pathSlice.js"
    "client/deepLink.js"
    "client/filesystem/fileSystemState.js"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file exists"
    else
        echo "   ❌ $file missing"
    fi
done

# Check debug scripts
echo ""
echo "🔧 Debug Scripts:"
debug_files=(
    "debug-scripts/bootloader/bootloader-debug.js"
    "debug-scripts/bootloader/deep-link-test.js"
)

for file in "${debug_files[@]}"; do
    if [ -f "$file" ]; then
        echo "   ✅ $file created"
    else
        echo "   ❌ $file missing"
    fi
done

# Generate test URLs
echo ""
echo "🔗 Test URLs for Deep Link Testing:"
base_url="http://localhost:3000"  # Adjust if different
test_paths=(
    "users/mike/bizcard/mr-bizcard-scratch.md"
    "users/mike/bizcard"
    "system/logs"
    "data/config.json"
)

for path in "${test_paths[@]}"; do
    echo "   ${base_url}/?pathname=${path}"
done

# Instructions
echo ""
echo "📋 Testing Instructions:"
echo "1. Start your application (if not already running)"
echo "2. Open browser console"
echo "3. Copy and paste debug-scripts/bootloader/bootloader-debug.js into console"
echo "4. Copy and paste debug-scripts/bootloader/deep-link-test.js into console"
echo "5. Test the URLs listed above"
echo "6. Check console output for navigation success/failure"

echo ""
echo "🔍 Manual Verification Steps:"
echo "1. Load URL with ?pathname=users/mike/bizcard/mr-bizcard-scratch.md"
echo "2. Check browser console for 'DEEP_LINK_NAVIGATION' success message"
echo "3. Verify the file loads in the UI"
echo "4. Check URL bar shows the pathname parameter"
echo "5. Test with directory: ?pathname=users/mike/bizcard"

echo ""
echo "✅ Bootloader test script complete"
echo "   Run the debug scripts in browser console for detailed analysis"
