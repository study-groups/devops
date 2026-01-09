#!/bin/bash

echo "🔍 COMPREHENSIVE REDUX & IMPORT DAMAGE DIAGNOSIS"
echo "=================================================="
echo

# 1. Find all Redux slices that exist but might not be imported
echo "1. REDUX SLICES AUDIT:"
echo "----------------------"
echo "🔍 Redux slices that exist:"
find client/store/slices -name "*Slice.js" -o -name "*slice.js" | sort

echo
echo "🔍 Checking which slices are imported in appState.js:"
imported_slices=$(grep -o "from.*slices/[^'\"]*" client/appState.js | sed "s/.*slices\///g" | sed "s/'//g" | sed "s/\"//g" | sort)
echo "$imported_slices"

echo
echo "🔍 Slices that exist but might not be imported:"
existing_slices=$(find client/store/slices -name "*Slice.js" -o -name "*slice.js" | sed 's/.*\///g' | sort)
for slice in $existing_slices; do
    if ! echo "$imported_slices" | grep -q "$slice"; then
        echo "❌ MISSING: $slice"
    fi
done

echo
echo "2. REDUX REDUCER AUDIT:"
echo "-----------------------"
echo "🔍 Reducers in combineReducers:"
grep -A 20 "combineReducers" client/appState.js | grep -E "^\s*[a-zA-Z]+:" | sed 's/[[:space:]]*//g' | sed 's/:.*//g'

echo
echo "🔍 Checking for components accessing undefined Redux state:"
echo "Searching for state.XXXX patterns..."
grep -r "getState().*\." client/ --include="*.js" | grep -v node_modules | head -20

echo
echo "3. MISSING EXPORTS AUDIT:"
echo "-------------------------"
echo "🔍 Looking for import errors (functions imported but not exported):"
# This is a simplified check - would need more sophisticated parsing for full accuracy
grep -r "import.*{.*}" client/ --include="*.js" | grep -E "(resetToDefaults|initializeAuth|checkAuth)" | head -10

echo
echo "4. BROKEN IMPORT PATHS:"
echo "----------------------"
echo "🔍 Imports using absolute paths that might be broken:"
grep -r "from ['\"]/" client/ --include="*.js" | grep -v node_modules | head -10

echo
echo "5. AUTH SYSTEM SPECIFIC CHECKS:"
echo "-------------------------------"
echo "🔍 Files accessing auth state:"
grep -r "authState\|auth\.\|isAuthenticated" client/ --include="*.js" | wc -l
echo "Files found ^"

echo
echo "🔍 Auth reducer connection:"
grep -A 5 -B 5 "auth.*authReducer" client/appState.js

echo
echo "6. PATH MANAGER SPECIFIC CHECKS:"
echo "--------------------------------"
echo "🔍 PathManager related files:"
find . -name "*[Pp]ath*[Mm]anager*" -o -name "*[Mm]anager*[Pp]ath*"

echo
echo "🔍 Components that might be PathManager:"
find client/ -name "*.js" -exec grep -l "path.*manager\|manager.*path\|PathManager\|pathManager" {} \;

echo
echo "7. BOOTLOADER COMPONENT REGISTRATION:"
echo "-------------------------------------"
echo "🔍 Components registered in bootloader:"
grep -A 2 -B 2 "name.*auth\|name.*path" client/bootloader.js

echo
echo "🔍 Components that depend on 'auth':"
grep -A 1 -B 1 "dependencies.*auth" client/bootloader.js

echo
echo "✅ DIAGNOSIS COMPLETE"
echo "Check above for missing connections, broken imports, and unregistered components"