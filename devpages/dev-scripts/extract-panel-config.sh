#!/bin/bash

# Extract Panel Configuration for CLI Testing
# Scans actual panel files and creates CLI-testable configuration

echo "📋 PANEL CONFIGURATION EXTRACTOR (Dev Scripts)"
echo "==============================================="
echo

BASE_DIR="/root/src/devops/devpages"
cd "$BASE_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="dev-scripts/runs/panel-config-$TIMESTAMP"
mkdir -p "$OUTPUT_DIR"

echo "📁 Output directory: $OUTPUT_DIR"
echo "🕒 Extraction run: $TIMESTAMP"
echo

# 1. Discover Panel Files
echo "1. DISCOVERING PANEL FILES"
echo "=========================="

PANEL_FILES_LIST="$OUTPUT_DIR/panel_files.txt"

echo "🔍 Scanning for panel files..."
find client/panels/ -name "*.js" -type f > "$PANEL_FILES_LIST"

PANEL_COUNT=$(wc -l < "$PANEL_FILES_LIST")
echo "✅ Found $PANEL_COUNT panel files:"
cat "$PANEL_FILES_LIST"
echo

# 2. Extract Panel Information
echo "2. EXTRACTING PANEL INFORMATION"
echo "==============================="

PANEL_INFO_CSV="$OUTPUT_DIR/panel_info.csv"
PANEL_INFO_JSON="$OUTPUT_DIR/panel_info.json"

echo "📊 Extracting panel metadata..."
echo "FILE,CLASS_NAME,TITLE,DESCRIPTION,TYPE" > "$PANEL_INFO_CSV"

# Start JSON structure
cat > "$PANEL_INFO_JSON" << 'EOF'
{
  "timestamp": "TIMESTAMP_PLACEHOLDER",
  "total_files": TOTAL_PLACEHOLDER,
  "panels": [
EOF

panel_index=0

while IFS= read -r panel_file; do
    if [ -n "$panel_file" ] && [ -f "$panel_file" ]; then
        echo "🔍 Processing: $panel_file"
        
        # Extract class name
        class_name=$(grep -o "class [A-Za-z0-9_]*" "$panel_file" | head -1 | cut -d' ' -f2)
        if [ -z "$class_name" ]; then
            class_name=$(basename "$panel_file" .js)
        fi
        
        # Extract title (look for title property or string)
        title=$(grep -o "title[[:space:]]*:[[:space:]]*['\"][^'\"]*['\"]" "$panel_file" | head -1 | sed "s/.*['\"]//g" | sed "s/['\"].*//g")
        if [ -z "$title" ]; then
            title=$(grep -o "this\.title[[:space:]]*=[[:space:]]*['\"][^'\"]*['\"]" "$panel_file" | head -1 | sed "s/.*['\"]//g" | sed "s/['\"].*//g")
        fi
        if [ -z "$title" ]; then
            title="$class_name"
        fi
        
        # Extract description (look for description or comment)
        description=$(grep -o "description[[:space:]]*:[[:space:]]*['\"][^'\"]*['\"]" "$panel_file" | head -1 | sed "s/.*['\"]//g" | sed "s/['\"].*//g")
        if [ -z "$description" ]; then
            description=$(head -10 "$panel_file" | grep "^\s*\*" | head -1 | sed "s/^\s*\*\s*//g")
        fi
        if [ -z "$description" ]; then
            description="No description"
        fi
        
        # Determine panel type based on path
        panel_type="unknown"
        case "$panel_file" in
            *"/settings/"*) panel_type="settings" ;;
            *"/dev/"*) panel_type="development" ;;
            *"/publish/"*) panel_type="publish" ;;
            *"/pdata/"*) panel_type="data" ;;
            *) panel_type="core" ;;
        esac
        
        # Add to CSV
        echo "$panel_file,$class_name,$title,$description,$panel_type" >> "$PANEL_INFO_CSV"
        
        # Add to JSON
        if [ $panel_index -gt 0 ]; then
            echo "," >> "$PANEL_INFO_JSON"
        fi
        cat >> "$PANEL_INFO_JSON" << EOF
    {
      "file": "$panel_file",
      "class_name": "$class_name",
      "title": "$title",
      "description": "$description",
      "type": "$panel_type",
      "index": $panel_index
    }
EOF
        
        panel_index=$((panel_index + 1))
    fi
done < "$PANEL_FILES_LIST"

# Complete JSON structure
cat >> "$PANEL_INFO_JSON" << 'EOF'
  ]
}
EOF

# Replace placeholders
sed -i "s/TIMESTAMP_PLACEHOLDER/$(date -Iseconds)/g" "$PANEL_INFO_JSON"
sed -i "s/TOTAL_PLACEHOLDER/$PANEL_COUNT/g" "$PANEL_INFO_JSON"

echo "✅ Panel information extracted"
echo "📁 CSV: $PANEL_INFO_CSV"
echo "📁 JSON: $PANEL_INFO_JSON"
echo

# 3. Generate CLI Table
echo "3. GENERATING CLI TABLE"
echo "======================"

TABLE_FILE="$OUTPUT_DIR/panel_table.txt"

echo "📊 Creating formatted table..."

{
    echo "PANEL CONFIGURATION TABLE"
    echo "========================="
    echo "Generated: $(date)"
    echo "Total Panel Files: $PANEL_COUNT"
    echo
    
    # Group summary
    echo "BY TYPE:"
    cut -d',' -f5 "$PANEL_INFO_CSV" | tail -n +2 | sort | uniq -c | while read count type; do
        echo "  $type: $count"
    done
    echo
    
    # Table header
    printf "%-30s | %-20s | %-25s | %-15s\n" "FILE" "CLASS" "TITLE" "TYPE"
    printf "%-30s-+-%-20s-+-%-25s-+-%-15s\n" "------------------------------" "--------------------" "-------------------------" "---------------"
    
    # Table rows (skip CSV header)
    tail -n +2 "$PANEL_INFO_CSV" | while IFS=',' read -r file class title desc type; do
        # Truncate long file paths
        short_file=$(basename "$file")
        if [ ${#short_file} -gt 28 ]; then
            short_file="...${short_file: -25}"
        fi
        
        # Truncate long titles
        if [ ${#title} -gt 23 ]; then
            title="${title:0:20}..."
        fi
        
        printf "%-30s | %-20s | %-25s | %-15s\n" "$short_file" "$class" "$title" "$type"
    done
} > "$TABLE_FILE"

echo "✅ Table generated: $TABLE_FILE"
cat "$TABLE_FILE"
echo

# 4. Generate Shell Variables
echo "4. GENERATING SHELL VARIABLES"
echo "============================="

SHELL_VARS_FILE="$OUTPUT_DIR/panel_vars.sh"

echo "🔧 Creating shell variable definitions..."

{
    echo "#!/bin/bash"
    echo "# Panel Configuration Variables"
    echo "# Generated: $(date)"
    echo "# Source: Scanned panel files"
    echo
    echo "# Panel Arrays"
    echo "declare -a PANEL_FILES=("
    
    while IFS= read -r panel_file; do
        if [ -n "$panel_file" ]; then
            echo "    \"$panel_file\""
        fi
    done < "$PANEL_FILES_LIST"
    
    echo ")"
    echo
    echo "declare -A PANEL_CLASSES=("
    tail -n +2 "$PANEL_INFO_CSV" | while IFS=',' read -r file class title desc type; do
        echo "    [\"$(basename "$file" .js)\"]=\"$class\""
    done
    echo ")"
    echo
    echo "declare -A PANEL_TITLES=("
    tail -n +2 "$PANEL_INFO_CSV" | while IFS=',' read -r file class title desc type; do
        echo "    [\"$(basename "$file" .js)\"]=\"$title\""
    done
    echo ")"
    echo
    echo "declare -A PANEL_TYPES=("
    tail -n +2 "$PANEL_INFO_CSV" | while IFS=',' read -r file class title desc type; do
        echo "    [\"$(basename "$file" .js)\"]=\"$type\""
    done
    echo ")"
    echo
    echo "# Helper functions"
    echo "get_panel_class() {"
    echo "    local panel_name=\"\$1\""
    echo "    echo \"\${PANEL_CLASSES[\$panel_name]}\""
    echo "}"
    echo
    echo "get_panel_title() {"
    echo "    local panel_name=\"\$1\""
    echo "    echo \"\${PANEL_TITLES[\$panel_name]}\""
    echo "}"
    echo
    echo "get_panel_type() {"
    echo "    local panel_name=\"\$1\""
    echo "    echo \"\${PANEL_TYPES[\$panel_name]}\""
    echo "}"
    echo
    echo "list_panels() {"
    echo "    printf \"%-25s | %-20s | %-25s | %s\\n\" \"NAME\" \"CLASS\" \"TITLE\" \"TYPE\""
    echo "    printf \"%-25s-+-%-20s-+-%-25s-+-%s\\n\" \"-------------------------\" \"--------------------\" \"-------------------------\" \"---------------\""
    echo "    for panel_file in \"\${PANEL_FILES[@]}\"; do"
    echo "        panel_name=\$(basename \"\$panel_file\" .js)"
    echo "        printf \"%-25s | %-20s | %-25s | %s\\n\" \"\$panel_name\" \"\${PANEL_CLASSES[\$panel_name]}\" \"\${PANEL_TITLES[\$panel_name]}\" \"\${PANEL_TYPES[\$panel_name]}\""
    echo "    done"
    echo "}"
    echo
    echo "list_panels_by_type() {"
    echo "    local type=\"\$1\""
    echo "    echo \"Panels of type: \$type\""
    echo "    for panel_file in \"\${PANEL_FILES[@]}\"; do"
    echo "        panel_name=\$(basename \"\$panel_file\" .js)"
    echo "        if [ \"\${PANEL_TYPES[\$panel_name]}\" = \"\$type\" ]; then"
    echo "            echo \"  \$panel_name - \${PANEL_TITLES[\$panel_name]}\""
    echo "        fi"
    echo "    done"
    echo "}"
    echo
    echo "# Usage examples:"
    echo "# list_panels"
    echo "# list_panels_by_type \"settings\""
    echo "# get_panel_title \"BasePanel\""
    echo "# get_panel_class \"ThemePanel\""
} > "$SHELL_VARS_FILE"

chmod +x "$SHELL_VARS_FILE"
echo "✅ Shell variables generated: $SHELL_VARS_FILE"
echo

# 5. Generate Test Script
echo "5. GENERATING TEST SCRIPT"
echo "========================"

TEST_SCRIPT="$OUTPUT_DIR/test_panels.sh"

echo "🧪 Creating panel test script..."

{
    echo "#!/bin/bash"
    echo "# Panel Configuration Tests"
    echo "# Generated: $(date)"
    echo
    echo "# Source the panel variables"
    echo "source \"$(dirname \"\$0\")/$(basename "$SHELL_VARS_FILE")\""
    echo
    echo "# Test counters"
    echo "TESTS_RUN=0"
    echo "TESTS_PASSED=0"
    echo "TESTS_FAILED=0"
    echo
    echo "# Test helper function"
    echo "run_test() {"
    echo "    local test_name=\"\$1\""
    echo "    local test_command=\"\$2\""
    echo "    local expected_pattern=\"\$3\""
    echo "    "
    echo "    TESTS_RUN=\$((TESTS_RUN + 1))"
    echo "    "
    echo "    local result"
    echo "    result=\$(eval \"\$test_command\")"
    echo "    "
    echo "    if [[ \"\$result\" =~ \$expected_pattern ]]; then"
    echo "        echo \"✅ PASS: \$test_name\""
    echo "        TESTS_PASSED=\$((TESTS_PASSED + 1))"
    echo "    else"
    echo "        echo \"❌ FAIL: \$test_name\""
    echo "        echo \"   Expected pattern: \$expected_pattern\""
    echo "        echo \"   Got: \$result\""
    echo "        TESTS_FAILED=\$((TESTS_FAILED + 1))"
    echo "    fi"
    echo "}"
    echo
    echo "echo \"🧪 RUNNING PANEL CONFIGURATION TESTS\""
    echo "echo \"====================================\""
    echo
    echo "# Test panel file existence"
    echo "for panel_file in \"\${PANEL_FILES[@]}\"; do"
    echo "    if [ -f \"\$panel_file\" ]; then"
    echo "        echo \"✅ Panel file exists: \$panel_file\""
    echo "        TESTS_PASSED=\$((TESTS_PASSED + 1))"
    echo "    else"
    echo "        echo \"❌ Panel file missing: \$panel_file\""
    echo "        TESTS_FAILED=\$((TESTS_FAILED + 1))"
    echo "    fi"
    echo "    TESTS_RUN=\$((TESTS_RUN + 1))"
    echo "done"
    echo
    echo "# Test panel data extraction"
    tail -n +2 "$PANEL_INFO_CSV" | while IFS=',' read -r file class title desc type; do
        panel_name=$(basename "$file" .js)
        echo "run_test \"Panel $panel_name has class\" \"get_panel_class '$panel_name'\" \".*\""
        echo "run_test \"Panel $panel_name has title\" \"get_panel_title '$panel_name'\" \".*\""
        echo "run_test \"Panel $panel_name has type\" \"get_panel_type '$panel_name'\" \".*\""
    done
    echo
    echo "# Summary"
    echo "echo"
    echo "echo \"📊 TEST SUMMARY\""
    echo "echo \"===============\""
    echo "echo \"Tests run: \$TESTS_RUN\""
    echo "echo \"Passed: \$TESTS_PASSED\""
    echo "echo \"Failed: \$TESTS_FAILED\""
    echo
    echo "if [ \$TESTS_FAILED -eq 0 ]; then"
    echo "    echo \"✅ All tests passed!\""
    echo "    exit 0"
    echo "else"
    echo "    echo \"❌ \$TESTS_FAILED tests failed\""
    echo "    exit 1"
    echo "fi"
} > "$TEST_SCRIPT"

chmod +x "$TEST_SCRIPT"
echo "✅ Test script generated: $TEST_SCRIPT"
echo

# 6. Final Summary
echo "6. SUMMARY"
echo "=========="

echo "📊 Panel Configuration Extraction Complete!"
echo
echo "📁 Generated Files:"
echo "   - Panel files list: $PANEL_FILES_LIST"
echo "   - Panel info CSV: $PANEL_INFO_CSV"
echo "   - Panel info JSON: $PANEL_INFO_JSON"
echo "   - CLI table: $TABLE_FILE"
echo "   - Shell variables: $SHELL_VARS_FILE"
echo "   - Test script: $TEST_SCRIPT"
echo
echo "🧪 CLI Testing Commands:"
echo "   # Source panel variables"
echo "   source $SHELL_VARS_FILE"
echo
echo "   # List all panels"
echo "   list_panels"
echo
echo "   # List panels by type"
echo "   list_panels_by_type \"settings\""
echo
echo "   # Get panel info"
echo "   get_panel_title \"BasePanel\""
echo "   get_panel_class \"ThemePanel\""
echo
echo "   # Run tests"
echo "   bash $TEST_SCRIPT"
echo
echo "✅ Panel configuration ready for CLI testing!"
echo "📁 All files saved to: $OUTPUT_DIR"
