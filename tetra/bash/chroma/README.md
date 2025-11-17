# Chroma - Terminal Markdown Viewer

**Beautifully render markdown in your terminal with theme-aware colors.**

Chroma is Tetra's native markdown viewer - a pure bash alternative to external tools. Powered by TDS (Tetra Display System), it provides:
- Beautiful terminal rendering with semantic colors
- Pipe support for command output
- Theme switching (warm, cool, neutral, electric)
- Rule-based in-place markdown modification with hooks

## Quick Start

```bash
# View a file
chroma README.md

# Pipe markdown
tsm help start | chroma
cat file.md | chroma

# With pager for long docs
chroma -p documentation.md

# Change theme
chroma -t warm README.md

# Apply transformation preset
chroma --preset markers file.md
```

## Features

### 1. Stdin Pipe Support

Chroma accepts piped markdown input, making it perfect for viewing help systems and generated content:

```bash
# TSM help integration
tsm help start | chroma
tsm help all | chroma -p

# Any markdown source
echo "# Test" | chroma
cat notes.md | chroma
```

### 2. Theme-Aware Rendering

Switch between TDS themes for different content types:

```bash
# Warm amber tones for planning
chroma -t warm PLAN.md

# Cool blue tones for logs
chroma -t cool debug.md

# Neutral green for system docs
chroma -t neutral README.md

# Electric purple for deploy docs
chroma -t electric DEPLOY.md
```

Available themes: `default`, `warm`, `cool`, `neutral`, `electric`

### 3. Rule-Based Markdown Modification

Transform markdown content before rendering using rules and hooks:

```bash
# Load preset transformations
chroma --preset markers file.md
# Highlights: TODO:, FIXME:, NOTE:, IMPORTANT:

chroma --preset bookmarks file.md
# Adds visual bookmarks to H1 headings

chroma --preset sections file.md
# Adds section separators to headings

# Custom transformation
chroma --rule "s/API/🔌 API/g" README.md

# List active rules
chroma --list-rules

# Clear all rules
chroma --clear-rules
```

### 4. Rule/Hook API

For advanced usage in scripts:

```bash
source $TETRA_SRC/bash/tds/chroma.sh

# Register transformation rule
chroma_register_rule "highlight_api" "s/API:/🔌 API:/g"

# Register hook function
my_heading_hook() {
    local level="$1"
    local text="$2"
    echo "★ $text"
}
chroma_register_hook "POST_HEADING" "my_heading_hook"

# Load preset
chroma_load_preset "markers"

# List all rules
chroma_list_rules

# Clear rules
chroma_clear_rules
```

## Hook Points

Hooks execute at specific points during rendering:

- `PRE_RENDER` - Before any processing starts
- `POST_HEADING` - After each heading is processed
- `PRE_CODE_BLOCK` - Before rendering code block
- `POST_CODE_BLOCK` - After rendering code block
- `POST_PARAGRAPH` - After each paragraph
- `POST_RENDER` - After all rendering complete

## Rule Presets

### markers
Highlights common code markers:
- `TODO:` → ⚠ TODO:
- `FIXME:` → 🔧 FIXME:
- `NOTE:` → 📝 NOTE:
- `IMPORTANT:` → ❗ IMPORTANT:

### bookmarks
Adds visual bookmark (🔖) to H1 headings

### sections
Adds decorative separators:
- H1: `━━━ Title ━━━`
- H2: `─── Title ───`

### all
Loads all presets

## Integration Examples

### TSM Help System

```bash
# Beautiful help output
tsm help start | chroma
tsm help pre-hooks | chroma -p

# With custom width
tsm help all | chroma -w 120 -p

# With markers preset
tsm help start | chroma --preset markers
```

### Documentation Workflow

```bash
# Review docs with warm theme
chroma -t warm -p ARCHITECTURE.md

# Preview with markers highlighted
chroma --preset markers -p CONTRIBUTING.md

# Custom transformation
chroma --rule "s/\[x\]/✓/g" CHECKLIST.md
```

### Script Integration

```bash
#!/usr/bin/env bash
source $TETRA_SRC/bash/tds/chroma.sh

# Generate and render markdown
generate_report | chroma -p

# Apply custom rules
chroma_register_rule "api" "s/API/🔌 API/g"
chroma_register_rule "db" "s/Database/💾 Database/g"
cat report.md | chroma
```

## Comparison with External Tools

Chroma is Tetra's pure bash alternative to external markdown viewers:

**Advantages:**
- ✓ No external dependencies
- ✓ Theme-aware (integrates with TDS)
- ✓ Extensible rule/hook system
- ✓ Consistent with Tetra ecosystem
- ✓ Fast for piped input

**When to use external tools:**
- Complex syntax highlighting needs
- Image rendering
- Interactive navigation

## Backward Compatibility

Chroma maintains compatibility with:

- **tdocs review** - Uses `tds_render_markdown()` for file previews
- **Legacy chroma code** - `chroma_render()` function still works
- **TDS markdown** - Can call `tds_markdown()` directly

## Files Modified/Created

### Modified
- `bash/tds/renderers/markdown.sh` - Added stdin pipe support
- `bash/tds/chroma.sh` - Rebranded as official viewer, added rule support

### Created
- `bash/tds/renderers/markdown_rules.sh` - Rule and hook system
- `bash/tds/test_chroma_pipe.sh` - Integration tests
- `bash/tds/CHROMA_README.md` - This documentation

## Environment Variables

- `CHROMA_PAGER` - Pager command (default: `less -R`)
- `TDS_ACTIVE_THEME` - Default theme to use
- `TDS_MARKDOWN_WIDTH` - Line width (default: terminal width)

## Command Reference

```
chroma [OPTIONS] [FILE|-]

Options:
  -p, --pager           Use pager for output
  -w, --width N         Set line width
  -t, --theme NAME      Switch TDS theme
  --preset NAME         Load rule preset
  --rule PATTERN        Add custom sed transformation
  --list-rules          Show active rules and hooks
  --clear-rules         Clear all rules and hooks
  -h, --help            Show help

Arguments:
  FILE                  Markdown file to render
  -                     Read from stdin (also default when piped)
```

## Next Steps

Potential enhancements:

1. **Span Marking Integration** - Use bash/rag span selectors to highlight specific line ranges
2. **Tree-sitter Support** - Phase 2: Semantic syntax highlighting for code blocks
3. **Interactive Mode** - Navigate between sections with keyboard
4. **Export Modes** - Convert to HTML, PDF, or other formats
5. **Custom Renderers** - TOML, YAML, JSON formatters

## See Also

- **TDS (Tetra Display System)** - `bash/tds/README.md`
- **TDS Markdown Renderer** - `bash/tds/renderers/markdown.sh`
- **TSM Help System** - `bash/tsm/core/help.sh`
- **tdocs** - `bash/tdocs/` - Document management system
