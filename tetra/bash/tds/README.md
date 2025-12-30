# TDS - Tetra Display System

A layered display framework for terminal UIs with semantic color tokens and palette-based theming.

## Architecture

TDS implements a three-layer color resolution system:

```
Semantic Role → Color Token → Palette Reference → Hex Value
```

### Example Flow

```bash
tds_render_heading 1 "Title"
  ↓
content.heading.h1 (semantic role)
  ↓
secondary:0 (color token → palette reference)
  ↓
SECONDARY[0] → "0088FF" (hex value)
  ↓
ANSI escape sequence
```

## Directory Structure

```
tds/
├── tds.sh                    # Main entry point
├── tokens/
│   └── color_tokens.sh      # Semantic → Palette mapping
├── semantics/
│   └── typography.sh        # Heading, emphasis, paragraph rendering
└── renderers/
    └── markdown.sh          # Generic markdown renderer
```

## Usage

### Basic Usage

```bash
source $TETRA_SRC/bash/tds/tds.sh
tds_markdown file.md
```

### With Pager

```bash
tds_markdown --pager document.md
```

### Programmatic Rendering

```bash
source $TETRA_SRC/bash/tds/tds.sh

# Render heading
tds_render_heading 1 "My Title"

# Render paragraph
tds_render_paragraph "Lorem ipsum dolor sit amet..."

# Render code block
tds_render_code_header "bash"
tds_render_code_line "echo 'Hello, World!'"
tds_render_code_footer

# Use semantic tokens directly
tds_text_color "content.emphasis.bold"
echo "Important text"
reset_color
```

## Color Token System

### Token Categories

1. **Structural** - UI structure elements
   - `structural.primary`, `structural.secondary`, `structural.accent`

2. **Text** - Content text hierarchy
   - `text.primary`, `text.secondary`, `text.tertiary`, `text.muted`

3. **Interactive** - Clickable/navigable elements
   - `interactive.link`, `interactive.active`, `interactive.hover`

4. **Status** - State indicators
   - `status.success`, `status.warning`, `status.error`, `status.info`

5. **Content** - Specific content types
   - `content.heading.h1` through `content.heading.h4`
   - `content.code.inline`, `content.code.block`
   - `content.emphasis.bold`, `content.emphasis.italic`
   - `content.quote`, `content.list`, `content.link`, `content.hr`

### Token Resolution

Tokens map to palette references in the format `palette:index`:

- `primary:0` → `PRIMARY[0]` (rainbow colors for cycling)
- `secondary:0` → `SECONDARY[0]` (theme accent palette)
- `semantic:0` → `SEMANTIC[0]` (status colors: error/warn/success/info)
- `surface:0` → `SURFACE[0]` (background→foreground gradient)

## Color States

Tokens can be resolved in different states:

- `normal` - Base color from palette
- `bright` - Complementary/brighter variant
- `dim` - Theme-aware dimmed version

```bash
tds_text_color "text.primary" "normal"
tds_text_color "text.primary" "bright"
tds_text_color "text.primary" "dim"
```

## Typography Semantics

### Headings

```bash
tds_render_heading 1 "Top Level"
tds_render_heading 2 "Sub Level"
```

### Emphasis

```bash
tds_render_emphasis "bold" "Important"
tds_render_emphasis "italic" "Subtle"
tds_render_emphasis "code" "function_name"
```

### Lists

```bash
tds_render_list_item "First item" 0
tds_render_list_item "Nested item" 1
```

### Quotes

```bash
tds_render_quote "This is a quotation"
```

### Code Blocks

```bash
tds_render_code_header "bash"
tds_render_code_line "#!/bin/bash"
tds_render_code_line "echo 'Hello'"
tds_render_code_footer
```

## Markdown Renderer

The TDS markdown renderer supports:

- Headers (H1-H6)
- Bold `**text**`
- Italic `*text*` (basic support)
- Inline code `` `code` ``
- Code blocks with syntax labels
- Blockquotes `> text`
- Lists `- item` or `* item`
- Links `[text](url)`
- Horizontal rules `---`

All rendering uses semantic color tokens from the token system.

## Backward Compatibility

The original `qa/chroma.sh` has been refactored as a backward compatibility wrapper:

```bash
# Old code (still works)
source qa/chroma.sh
chroma file.md

# New code (recommended)
source tds/tds.sh
tds_markdown file.md
```

## Extending TDS

### Add New Token

Edit `tokens/color_tokens.sh`:

```bash
declare -A TDS_COLOR_TOKENS=(
    # ...
    [my.new.token]="semantic:2"    # Orange from SEMANTIC[2]
)
```

### Add New Renderer

Create `renderers/yaml.sh`:

```bash
source "$TDS_SRC/semantics/typography.sh"

tds_render_yaml() {
    local file="$1"
    # Use existing tokens
    tds_text_color "content.code.block"
    cat "$file"
    reset_color
}
```

### Create Theme

Create `themes/neon_theme.sh`:

```bash
# Override token mappings for neon theme
TDS_COLOR_TOKENS[text.primary]="verbs:7"
TDS_COLOR_TOKENS[content.heading.h1]="nouns:0"
# ...
```

## Dependencies

- Tetra color system (`bash/color/color_core.sh`, `color_palettes.sh`)
- Bash 5.2+
- `fmt` command (for line wrapping)

## Testing

View token palette:

```bash
source tds/tds.sh
tds_show_tokens
```

Test markdown rendering:

```bash
tds_markdown tds/test_markdown.md
```

## Integration

TDS is currently integrated with:

- **QA Module** - Markdown answer rendering via `chroma.sh` wrapper
- **Demo Framework** - Ready for integration (use TDS typography functions)

## Future Enhancements

- [ ] Theme system with runtime swapping
- [ ] Additional renderers (JSON, YAML, tables, logs)
- [ ] Widget library (menus, prompts, progress bars)
- [ ] Integration with TCurses primitives
- [ ] Mouse support for interactive elements
- [ ] Terminal feature detection and graceful degradation
