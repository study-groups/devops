# QA Viewer System Guide

## Overview

The QA module uses a simplified two-viewer system with chroma as the default.

**Viewers:** chroma (default) | raw

## Viewers

### Chroma (Default)
Custom markdown renderer built on tetra's color system with automatic line wrapping.

**Features:**
- Full control over color schemes
- Consistent with tetra UI
- Optimized for QA answers
- Theme-aware rendering
- Automatic line wrapping with fmt
- No external dependencies

**Usage:**
```bash
qa browse              # Default to chroma
qa browse chroma       # Explicit chroma
QA_VIEWER=chroma qa browse
```

### Raw (cat/less)
Plain text viewing with no formatting.

**Features:**
- No dependencies
- Fast for large files
- Works everywhere
- Uses less pager

**Usage:**
```bash
qa browse raw
qa viewer raw
```

## Interactive Viewer Switching

While browsing with fzf, use keyboard shortcuts to switch viewers:

**In chroma mode:**
- `r` → Switch to raw
- `i` → Quick view in less
- `Enter` → Full view in pager
- `q/Esc/Ctrl-C` → Quit

**In raw mode:**
- `c` → Switch to chroma
- `i` → Quick view in less
- `Enter` → Full view in pager
- `q/Esc/Ctrl-C` → Quit

## Configuration

### Set Default Viewer
```bash
# In your shell rc file
export QA_VIEWER=chroma  # Default

# Or set during session
qa viewer chroma
qa viewer raw
```

### One-Time Override
```bash
QA_VIEWER=raw qa search "capital"
QA_VIEWER=raw qa browse
```

### Check Current Viewer
```bash
qa viewer           # Shows current viewer
qa status           # Shows viewer in system status
```

## REPL Commands

Inside `qa repl`:
```
browse              # Use default viewer (chroma)
browse chroma       # Force chroma
browse raw          # Force raw text
viewer              # Show current viewer
viewer chroma       # Set viewer for session
viewer raw          # Set raw for session
```

## Chroma Features

### Color Scheme
- **H1 Headers:** Cyan/Teal (#00D4AA)
- **H2 Headers:** Blue (#7AA2F7)
- **H3 Headers:** Light Purple (#BB9AF7)
- **H4 Headers:** Dark Purple (#9D7CD8)
- **Bold Text:** Orange (#E0AF68)
- **Italic Text:** Green (#9ECE6A)
- **Code:** Red (#F7768E)
- **Code Blocks:** Blue (#7AA2F7)
- **Links:** Cyan (#00D4AA)
- **Quotes:** Gray (#565F89)
- **Lists:** Green bullets (#9ECE6A)

### Supported Markdown
- Headers (H1-H6)
- Bold, italic, inline code
- Code blocks with syntax labels
- Blockquotes
- Lists (unordered)
- Horizontal rules
- Links (basic)

### Command Line
```bash
chroma file.md              # Render to stdout
chroma --pager file.md      # Use pager
chroma --theme dark file.md # Set theme
chroma --help               # Show help
```

## Examples

### Search and View
```bash
# Search with chroma preview (default)
qa search "capital"

# Search with specific viewer
QA_VIEWER=raw qa search "france"
```

### Browse Sessions
```bash
# Use default viewer (chroma)
qa browse

# Explicit viewer choice
qa browse chroma
qa browse raw
```

### From REPL
```
qa> browse              # Use chroma (default)
qa> browse chroma       # Explicit chroma
qa> viewer raw          # Set for session
qa> browse              # Now uses raw
```

## Development

### Extending Chroma

Edit `chroma.sh`:
- Add new markdown syntax patterns
- Customize color schemes
- Add theme support
- Improve rendering logic
- Adjust fmt wrapping behavior

### Line Wrapping

Chroma uses `fmt` for automatic line wrapping:
- Wraps at terminal width (COLUMNS)
- Preserves code blocks (no wrapping)
- Maintains paragraph structure
- Works with all terminal sizes

## Troubleshooting

### Chroma not found
```bash
# Check if script exists
ls -l chroma.sh

# Run with full path
bash chroma.sh file.md

# Check QA_SRC is set
echo $QA_SRC
```

### Colors not showing
```bash
# Check terminal support
echo $TERM

# Test color output
bash chroma.sh /tmp/test.md

# Try with explicit path
bash /path/to/chroma.sh file.md
```

### Line wrapping issues
```bash
# Check terminal width
echo $COLUMNS

# Test fmt command
echo "long line here" | fmt -w 80

# Override terminal width
COLUMNS=100 bash chroma.sh file.md
```

### Switch to raw if issues
```bash
# Use raw viewer as fallback
qa browse raw
export QA_VIEWER=raw
```
