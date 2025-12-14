#!/usr/bin/env bash

# Chroma Test Runner
# Usage: ./run_tests.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHROMA_DIR="$(dirname "$SCRIPT_DIR")"

# Source chroma
source "$CHROMA_DIR/chroma_simple.sh"

# Test state
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

#==============================================================================
# TEST FRAMEWORK
#==============================================================================

test_start() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "CHROMA TEST SUITE"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

test_end() {
    echo
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "RESULTS: $TESTS_PASSED/$TESTS_RUN passed, $TESTS_FAILED failed"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    return $TESTS_FAILED
}

assert_eq() {
    local name="$1"
    local expected="$2"
    local actual="$3"

    ((TESTS_RUN++))

    if [[ "$expected" == "$actual" ]]; then
        ((TESTS_PASSED++))
        echo "✓ $name"
        return 0
    else
        ((TESTS_FAILED++))
        echo "✗ $name"
        echo "  expected: $expected"
        echo "  actual:   $actual"
        return 1
    fi
}

assert_contains() {
    local name="$1"
    local needle="$2"
    local haystack="$3"

    ((TESTS_RUN++))

    if [[ "$haystack" == *"$needle"* ]]; then
        ((TESTS_PASSED++))
        echo "✓ $name"
        return 0
    else
        ((TESTS_FAILED++))
        echo "✗ $name"
        echo "  expected to contain: $needle"
        echo "  actual: $haystack"
        return 1
    fi
}

assert_line_count() {
    local name="$1"
    local expected="$2"
    local content="$3"

    local actual=$(echo "$content" | wc -l | tr -d ' ')

    ((TESTS_RUN++))

    if [[ "$expected" == "$actual" ]]; then
        ((TESTS_PASSED++))
        echo "✓ $name"
        return 0
    else
        ((TESTS_FAILED++))
        echo "✗ $name"
        echo "  expected lines: $expected"
        echo "  actual lines:   $actual"
        return 1
    fi
}

assert_line_width() {
    local name="$1"
    local max_width="$2"
    local content="$3"

    ((TESTS_RUN++))

    # Strip ANSI codes for visual width measurement
    local stripped=$(echo "$content" | sed 's/\x1b\[[0-9;]*m//g')

    local max_found=0
    while IFS= read -r line; do
        local len=${#line}
        (( len > max_found )) && max_found=$len
    done <<< "$stripped"

    if (( max_found <= max_width )); then
        ((TESTS_PASSED++))
        echo "✓ $name (max: $max_found)"
        return 0
    else
        ((TESTS_FAILED++))
        echo "✗ $name"
        echo "  expected max width: $max_width"
        echo "  actual max width:   $max_found"
        return 1
    fi
}

#==============================================================================
# TEST DATA
#==============================================================================

create_test_files() {
    mkdir -p "$SCRIPT_DIR/fixtures"

    # Simple text
    cat > "$SCRIPT_DIR/fixtures/simple.txt" << 'EOF'
Hello world.
This is a test.
EOF

    # Long lines for wrapping test
    cat > "$SCRIPT_DIR/fixtures/long.txt" << 'EOF'
This is a very long line that should be wrapped when the width is set to something smaller than the length of this line.
Short line.
Another very long line that contains many words and should definitely wrap at word boundaries when processed by the chroma tool.
EOF

    # Markdown content
    cat > "$SCRIPT_DIR/fixtures/markdown.md" << 'EOF'
# Heading 1

This is a paragraph with some text.

## Heading 2

- List item 1
- List item 2
- List item 3

1. Numbered item
2. Another item

> This is a blockquote

```bash
echo "code block"
```

---

**Bold** and `inline code` here.
EOF
}

#==============================================================================
# TESTS
#==============================================================================

test_file_input() {
    echo
    echo "── File Input ──"

    local output=$(chroma "$SCRIPT_DIR/fixtures/simple.txt")
    assert_contains "reads file" "Hello world" "$output"
    assert_contains "preserves content" "This is a test" "$output"
}

test_stdin_input() {
    echo
    echo "── Stdin Input ──"

    local output=$(echo "piped content" | chroma)
    assert_contains "reads stdin" "piped content" "$output"
}

test_margin() {
    echo
    echo "── Margin ──"

    local output=$(chroma -m 4 "$SCRIPT_DIR/fixtures/simple.txt")

    # Check left margin (4 spaces)
    assert_contains "left margin" "    Hello" "$output"

    # Check top margin (4 empty lines before content)
    local first_content_line=$(echo "$output" | grep -n "Hello" | head -1 | cut -d: -f1)
    assert_eq "top margin" "5" "$first_content_line"
}

test_width_wrapping() {
    echo
    echo "── Width Wrapping ──"

    # Force narrow width
    local output=$(chroma -w 40 "$SCRIPT_DIR/fixtures/long.txt")
    assert_line_width "respects width" 40 "$output"
}

test_margin_and_width() {
    echo
    echo "── Margin + Width ──"

    # margin 4, width 50 = lines should be "    " + up to 50 chars = 54 max
    local output=$(chroma -m 4 -w 50 "$SCRIPT_DIR/fixtures/long.txt")
    assert_line_width "margin + width" 54 "$output"
}

test_help() {
    echo
    echo "── Help ──"

    local output=$(chroma help)
    assert_contains "help shows usage" "USAGE" "$output"
    assert_contains "help shows options" "OPTIONS" "$output"
}

test_empty_lines_preserved() {
    echo
    echo "── Empty Lines ──"

    local output=$(chroma "$SCRIPT_DIR/fixtures/markdown.md")
    # Markdown has empty lines between sections
    local empty_count=$(echo "$output" | grep -c "^$")
    (( empty_count > 0 )) && ((TESTS_PASSED++)) && echo "✓ preserves empty lines ($empty_count)" || { ((TESTS_FAILED++)); echo "✗ preserves empty lines"; }
    ((TESTS_RUN++))
}

#==============================================================================
# PHASE 1: COLOR TESTS
#==============================================================================

assert_has_ansi() {
    local name="$1"
    local content="$2"

    ((TESTS_RUN++))

    # Check for ANSI escape sequence \033[ or \e[
    if [[ "$content" =~ $'\033'\[ ]]; then
        ((TESTS_PASSED++))
        echo "✓ $name"
        return 0
    else
        ((TESTS_FAILED++))
        echo "✗ $name (no ANSI codes found)"
        return 1
    fi
}

assert_ansi_reset() {
    local name="$1"
    local content="$2"

    ((TESTS_RUN++))

    # Check for reset code \033[0m at end of non-empty lines
    local has_reset=1
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        # Line should end with reset or have no color
        if [[ "$line" =~ $'\033'\[ ]] && [[ ! "$line" =~ $'\033'\[0m$ ]]; then
            has_reset=0
            break
        fi
    done <<< "$content"

    if (( has_reset )); then
        ((TESTS_PASSED++))
        echo "✓ $name"
        return 0
    else
        ((TESTS_FAILED++))
        echo "✗ $name (missing reset at line end)"
        return 1
    fi
}

test_colors() {
    echo
    echo "── Colors ──"

    local output=$(chroma "$SCRIPT_DIR/fixtures/simple.txt")
    assert_has_ansi "output has color codes" "$output"
    assert_ansi_reset "colors reset at line end" "$output"
}

test_color_disable() {
    echo
    echo "── Color Disable ──"

    local output=$(chroma --no-color "$SCRIPT_DIR/fixtures/simple.txt")

    ((TESTS_RUN++))
    if [[ ! "$output" =~ $'\033'\[ ]]; then
        ((TESTS_PASSED++))
        echo "✓ --no-color disables colors"
    else
        ((TESTS_FAILED++))
        echo "✗ --no-color disables colors"
    fi
}

#==============================================================================
# MAIN
#==============================================================================

main() {
    test_start
    create_test_files

    # Phase 0
    test_file_input
    test_stdin_input
    test_margin
    test_width_wrapping
    test_margin_and_width
    test_help
    test_empty_lines_preserved

    # Phase 1
    test_colors
    test_color_disable

    test_end
}

main "$@"
