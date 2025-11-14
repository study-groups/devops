# TDS Markdown Rendering Architecture

Clean, token-based system for rendering markdown with full design control.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 3: Renderer (markdown_clean.sh)                  │
│ • Parses markdown syntax                                │
│ • Delegates to element renderers                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 2: Elements (markdown_elements.sh)               │
│ • md_render_heading()                                   │
│ • md_render_list_item()                                 │
│ • md_render_quote()                                     │
│ • md_render_code_block()                                │
│ • etc...                                                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Tokens (markdown_tokens.sh)                   │
│ • md_token_heading_h1()                                 │
│ • md_token_list_bullet()                                │
│ • md_token_code_border()                                │
│ • Each maps to: TDS color token + intensity             │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 0: TDS Color System                              │
│ • Theme palettes (warm, cool, neutral, electric)       │
│ • Color tokens (content.*, text.*, structure.*)        │
└─────────────────────────────────────────────────────────┘
```

## File Structure

```
tds/
├── semantics/
│   ├── markdown_tokens.sh      ← Token definitions
│   └── markdown_elements.sh    ← Element renderers
└── renderers/
    └── markdown_clean.sh        ← Main parser
```

## How to Customize

### 1. Change a Color

Edit theme file to change the base color:
```bash
# themes/warm.sh
content.heading.h1 → "#ff6b35"  # Warm orange
```

### 2. Change an Intensity

Edit token file:
```bash
# markdown_tokens.sh
md_token_list_bullet() {
    md_token "content.list" "dim"     # Change to "bright" or "normal"
}
```

### 3. Add a New Element

```bash
# 1. Add token (markdown_tokens.sh)
md_token_callout() {
    md_token "content.callout" "bright"
}

# 2. Add renderer (markdown_elements.sh)
md_render_callout() {
    local text="$1"
    md_token_callout
    printf "! %s\n" "$text"
    md_reset
}

# 3. Add parser rule (markdown_clean.sh)
if [[ "$line" =~ ^\!\![[:space:]]*(.+)$ ]]; then
    md_render_callout "${BASH_REMATCH[1]}"
    continue
fi
```

## Current Token Map

### Headings
- `md_token_heading_h1` → bright
- `md_token_heading_h2` → bright
- `md_token_heading_h3` → normal
- `md_token_heading_h4` → normal

### Code
- `md_token_code_border` → dim (│ ┌─ └─)
- `md_token_code_header` → dim (language label)
- `md_token_code_text` → normal (actual code)
- `md_token_code_inline` → normal (`inline`)

### Lists
- `md_token_list_bullet` → dim (•)
- `md_token_list_number` → dim (1. 2. 3.)
- `md_token_list_text` → normal (content)

### Quotes
- `md_token_quote_marker` → dim (▌)
- `md_token_quote_text` → normal (content)

### Links
- `md_token_link_text` → normal ([text])
- `md_token_link_url` → dim ((url))

### Emphasis
- `md_token_bold` → normal + ANSI bold
- `md_token_italic` → normal + ANSI italic

### Structure
- `md_token_hr` → dim (────)
- `md_token_text_primary` → normal
- `md_token_text_secondary` → normal

## Intensity Values

- `dim` → 50% brightness (`\033[2m`)
- `normal` → 100% brightness (default)
- `bright` → Bold weight (`\033[1m`)

## Usage

```bash
# Option 1: Use clean renderer directly
source $TDS_SRC/renderers/markdown_clean.sh
tds_markdown_clean README.md

# Option 2: With pager and custom width
tds_markdown_clean --pager --width 100 document.md

# Option 3: Integrate into tdocs
# Edit tdocs.sh to use tds_render_markdown_clean instead of tds_render_markdown
```

## Benefits

1. **Human Readable**: Each layer has clear responsibility
2. **Easy to Customize**: Change one token, affects all elements using it
3. **Themeable**: Works with all TDS themes automatically
4. **Extensible**: Add new elements without touching parser logic
5. **Testable**: Each layer can be tested independently
6. **Documented**: Self-documenting code structure

## Migration Path

The old `markdown.sh` and `typography.sh` remain for compatibility.
Switch to clean version when ready:

```bash
# In tds.sh, add:
source "$TDS_SRC/renderers/markdown_clean.sh"

# In tdocs.sh, replace:
tds_render_markdown → tds_render_markdown_clean
```
