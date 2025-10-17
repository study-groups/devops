# QA Browse Testing Guide

## Status

The QA browse system has been simplified to use only two viewers: chroma (default) and raw.

## System Features

1. **Chroma renderer** - Custom markdown renderer with fmt line wrapping
2. **Simple viewer switching** - Use `r` for raw, `c` for chroma
3. **Clean exit** - `q`, `Esc`, or `Ctrl-C` all work
4. **Helper functions** - info, delete, export, copy actions available

## Test the Browse Interface

### 1. Basic Browse (with chroma default)

```bash
source ~/src/devops/tetra/bash/qa/qa.sh
qa browse
```

**Expected:**
- FZF window opens with list of answers
- Header shows: `[chroma] i:info Enter:view r:raw q/Esc/^C:quit`
- Chroma-rendered preview with colors and fmt wrapping
- Preview window on right (99% height)

### 2. Test Browse Help

While in browse mode:
```
Press: /help
```

**Expected:**
- Shows help text from qa_browse_help
- Explains all navigation and viewer features
- Press `q` to exit help

### 3. Test Viewer Switching

While in chroma mode:
```
Press: r    (switch to raw)
```

**Expected:**
- View reloads in raw mode
- Header updates to: `[raw] i:info Enter:view c:chroma q/Esc/^C:quit`
- Preview shows plain text
- List position preserved

While in raw mode:
```
Press: c    (switch to chroma)
```

**Expected:**
- View reloads in chroma mode
- Header shows chroma keys
- Preview shows colored rendering

### 4. Test Info Action

While in browse mode:
```
Press: i
```

**Expected:**
- Shows answer metadata in less pager
- Displays ID, file size, line count
- Shows question text
- Lists all related files
- Press `q` to return

### 5. Test Enter/View Action

While in browse mode:
```
Press: Enter
```

**Expected:**
- Opens answer in full-screen pager
- Chroma mode: colored rendering with pager
- Raw mode: less pager
- Press `q` to return to browse

### 6. Test Exit

While in browse mode:
```
Press: q    (or Esc, or Ctrl-C)
```

**Expected:**
- Cleanly exits browse mode
- Returns to shell prompt
- No error messages

### 7. Test Chroma Line Wrapping

```bash
# Create a test file with long lines
cat > /tmp/long_test.md << 'EOF'
# Long Line Test

This is a very long line that should be wrapped by fmt when it exceeds the terminal width and we want to make sure it looks nice and readable without scrolling horizontally.
EOF

# Test chroma rendering
bash chroma.sh /tmp/long_test.md
```

**Expected:**
- Long lines wrapped at terminal width
- No horizontal scrolling needed
- Preserves markdown formatting
- Colors applied correctly

### 8. Test Explicit Viewer Selection

```bash
qa browse chroma    # Explicit chroma
qa browse raw       # Explicit raw
```

**Expected:**
- Starts in specified viewer mode
- Header reflects the viewer choice
- All features work normally

## Known Issues / Limitations

1. **Chroma not in PATH** - Uses full path `bash $QA_SRC/chroma.sh`, works without installing
2. **Viewer switching** - Exits and restarts browse with new viewer (slight flicker)
3. **Terminal width** - fmt uses $COLUMNS variable, ensure terminal sets it correctly

## Manual Override If Needed

```bash
# Use explicit viewer commands
qa browse chroma    # Force chroma (default)
qa browse raw       # Force raw

# Or set environment
export QA_VIEWER=chroma
qa browse           # Will use chroma

export QA_VIEWER=raw
qa browse           # Will use raw
```

## Testing Chroma Standalone

```bash
# Create test markdown
cat > /tmp/test.md << 'EOF'
# Test Document

This is **bold** and `code`.

## Section

- Item 1
- Item 2

```bash
echo "code block"
```
EOF

# Test chroma directly
bash ~/src/devops/tetra/bash/qa/chroma.sh /tmp/test.md

# With pager
bash ~/src/devops/tetra/bash/qa/chroma.sh --pager /tmp/test.md
```

## Debugging

If browse doesn't work:

```bash
# Check functions loaded
source qa.sh
declare -f qa_browse | head -20

# Check viewer detection
_qa_get_viewer

# Check test data exists
ls $QA_DIR/db/*.answer

# Create test data if needed
mkdir -p $QA_DIR/db
echo "Test answer" > $QA_DIR/db/999.answer
echo "Test question" > $QA_DIR/db/999.prompt

# Test with verbose output
bash -x $(which qa) browse 2>&1 | head -50
```

## Success Criteria

- [ ] Browse opens with fzf interface in chroma mode
- [ ] Chroma renders with colors and wrapped lines
- [ ] Viewer switching works (r for raw, c for chroma)
- [ ] Info (i) shows metadata in less
- [ ] Enter opens full view in pager
- [ ] Exit works (q, Esc, Ctrl-C)
- [ ] Raw mode shows plain text
- [ ] Long lines wrapped with fmt
- [ ] Headers show correct key bindings

## Quick Test Script

```bash
#!/usr/bin/env bash

# Setup
source ~/src/devops/tetra/bash/qa/qa.sh

# Create test answer if needed
if [[ ! -f "$QA_DIR/db/999.answer" ]]; then
    mkdir -p "$QA_DIR/db"
    cat > "$QA_DIR/db/999.answer" << 'EOF'
# Test Answer

This is a **test answer** with `code`.

## Features

- Feature 1
- Feature 2

```bash
echo "test"
```
EOF
    echo "Test question" > "$QA_DIR/db/999.prompt"
fi

# Show what we have
echo "QA_DIR: $QA_DIR"
echo "Answers: $(ls $QA_DIR/db/*.answer 2>/dev/null | wc -l)"
echo "Viewer: $(_qa_get_viewer)"
echo ""
echo "Ready to browse! Run: qa browse"
```

Run this script, then test the browse interface manually.
