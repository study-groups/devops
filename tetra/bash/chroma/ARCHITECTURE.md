# Chroma Architecture Plan

A robust markdown interpreter and code highlighter built on a plugin pipeline.

## Executive Summary

Chroma processes text through a **3-stage pipeline**:
1. **Parse** - Convert input to structured representation (CST)
2. **Transform** - Apply hooks/rules to modify structure
3. **Render** - Convert structure to colored terminal output

Each stage supports plugins that can be composed sequentially.

---

## Existing Assets (from exploration)

### Already Built (but buggy)
| Component | File | Status |
|-----------|------|--------|
| CST Parser | `core/cst.sh` | Has position-aware markdown→JSON |
| Parser Registry | `core/parser_registry.sh` | Self-registration system |
| Hook System | `tds/renderers/markdown_rules.sh` | PRE/POST hooks per element |
| Language Detection | `core/code_highlight.sh` | Shebang + pattern matching |
| LaTeX→Unicode | `parsers/latex.sh` | Math symbol translation |
| Semantic Colors | `tds/core/semantic_colors.sh` | Theme-aware color tokens |
| Theme Stack | `tds/core/theme_stack.sh` | Push/pop theme contexts |

### Working (in chroma_simple.sh)
- File/stdin input
- Margin/width control
- Basic color output
- Word wrapping

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         INPUT                                    │
│  file.md | stdin | clipboard                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 1: PARSE                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Markdown │  │   TOML   │  │   JSON   │  │  LaTeX   │        │
│  │  Parser  │  │  Parser  │  │  Parser  │  │  Parser  │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       └─────────────┴─────────────┴─────────────┘               │
│                              │                                   │
│                              ▼                                   │
│                     CST (JSON structure)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STAGE 2: TRANSFORM                            │
│                                                                  │
│  Hook: PRE_RENDER ──────────────────────────────────────────►   │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Transform Pipeline                          │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │    │
│  │  │ Expand  │  │ Resolve │  │  Code   │  │ Custom  │    │    │
│  │  │ Macros  │→ │  Links  │→ │ Detect  │→ │ Rules   │    │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│       │                                                          │
│       ▼                                                          │
│  Hook: POST_TRANSFORM ──────────────────────────────────────►   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    STAGE 3: RENDER                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Element Renderers                      │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │    │
│  │  │ Heading │  │  Code   │  │  List   │  │  Table  │    │    │
│  │  │Renderer │  │Renderer │  │Renderer │  │Renderer │    │    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘    │    │
│  │       │            │            │            │          │    │
│  │       │     ┌──────┴──────┐     │            │          │    │
│  │       │     │ bat/native  │     │            │          │    │
│  │       │     │  highlight  │     │            │          │    │
│  │       │     └─────────────┘     │            │          │    │
│  │       └────────────┴────────────┴────────────┘          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                              ▼                                   │
│                    TDS Semantic Colors                          │
│                    (theme-aware output)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         OUTPUT                                   │
│  terminal | pager | file                                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Plugin System Design

### Plugin Interface

```bash
# Every plugin implements this interface
declare -A CHROMA_PLUGIN_META=(
    [name]="plugin-name"
    [version]="1.0.0"
    [stage]="parse|transform|render"
    [priority]=50           # 0-100, lower runs first
    [formats]="md,markdown" # which formats this handles
)

# Required functions (named by convention)
plugin_name_init()      # Called on load
plugin_name_can_handle() # Returns 0 if plugin handles this input
plugin_name_process()    # Main processing function
plugin_name_cleanup()    # Called on unload
```

### Plugin Registry

```bash
# Global registries
declare -A CHROMA_PARSERS=()      # format → parse function
declare -A CHROMA_TRANSFORMS=()   # name → transform function
declare -A CHROMA_RENDERERS=()    # element_type → render function
declare -a CHROMA_PLUGIN_ORDER=() # execution order

# Registration
chroma_register_plugin() {
    local stage="$1" name="$2" fn="$3" priority="${4:-50}"
    # Add to appropriate registry
    # Sort by priority
}
```

### Hook Points

```bash
# Stage 1: Parse
PRE_PARSE      # Before any parsing
POST_PARSE     # After CST is built

# Stage 2: Transform
PRE_TRANSFORM  # Before transforms
POST_TRANSFORM # After transforms

# Stage 3: Render (per element type)
PRE_HEADING    POST_HEADING
PRE_CODE       POST_CODE
PRE_LIST       POST_LIST
PRE_TABLE      POST_TABLE
PRE_PARAGRAPH  POST_PARAGRAPH

# Global
PRE_RENDER     # Before any output
POST_RENDER    # After all output
```

---

## CST Structure

The CST (Concrete Syntax Tree) preserves source positions for error reporting:

```json
{
  "type": "document",
  "children": [
    {
      "type": "heading",
      "level": 1,
      "position": {"line": 1, "col": 1, "offset": 0},
      "raw": "# Title",
      "content": "Title",
      "children": []
    },
    {
      "type": "code_block",
      "language": "bash",
      "position": {"line": 3, "col": 1, "offset": 10},
      "raw": "```bash\necho hello\n```",
      "content": "echo hello",
      "children": []
    },
    {
      "type": "paragraph",
      "position": {"line": 7, "col": 1, "offset": 35},
      "children": [
        {"type": "text", "content": "Some "},
        {"type": "bold", "content": "bold"},
        {"type": "text", "content": " text"}
      ]
    }
  ]
}
```

---

## Implementation Phases

### Phase 2: Core Pipeline (Next)
Build the minimal pipeline without plugins first.

```bash
# chroma_simple.sh additions
chroma_parse()     # Input → CST (line-based, no JSON)
chroma_transform() # CST → CST (passthrough initially)
chroma_render()    # CST → colored output
```

**Tests to add:**
- [ ] Headers render with heading color
- [ ] Code blocks render with code color
- [ ] Lists render with bullets
- [ ] Bold/italic inline formatting

### Phase 3: TDS Integration
Wire up semantic colors properly.

```bash
# Token mapping
declare -A ELEMENT_TOKENS=(
    [heading.1]="content.heading.h1"
    [heading.2]="content.heading.h2"
    [code.block]="content.code.block"
    [code.inline]="content.code.inline"
    [list.bullet]="content.list"
    [quote]="content.quote"
    [text]="text.primary"
)
```

**Tests to add:**
- [ ] Colors change with theme (-t warm)
- [ ] TDS tokens used when available
- [ ] Fallback ANSI when TDS not loaded

### Phase 4: Plugin Infrastructure
Add plugin loading and hooks.

```bash
# Plugin loader
chroma_load_plugins() {
    for plugin in "$CHROMA_SRC/plugins"/*.sh; do
        source "$plugin"
    done
}

# Hook executor
chroma_run_hooks() {
    local hook="$1"
    shift
    for fn in "${CHROMA_HOOKS[$hook]}"; do
        "$fn" "$@"
    done
}
```

**Tests to add:**
- [ ] Plugin loads and registers
- [ ] Hooks fire in correct order
- [ ] Plugin can modify CST

### Phase 5: Code Highlighting
Integrate bat or native highlighting.

```bash
# Code renderer with bat fallback
_render_code_block() {
    local lang="$1" content="$2"

    if command -v bat &>/dev/null && [[ -n "$lang" ]]; then
        echo "$content" | bat --style=plain --language="$lang" --color=always
    else
        _chroma_color "content.code.block"
        printf "%s" "$content"
        _chroma_reset
    fi
}
```

**Tests to add:**
- [ ] bat used when available
- [ ] Fallback works without bat
- [ ] Language detection works

### Phase 6: Advanced Parsers
Port existing parsers to new system.

- [ ] TOML parser plugin
- [ ] JSON parser plugin
- [ ] LaTeX math plugin (transform stage)
- [ ] Claude output cleaner plugin

### Phase 7: Full CST
Implement proper JSON CST for complex transforms.

- [ ] Position tracking
- [ ] Nested inline parsing
- [ ] Table parsing
- [ ] Link/image handling

---

## File Structure (Target)

```
chroma/
├── chroma.sh              # Main entry (simple, <100 lines)
├── core/
│   ├── pipeline.sh        # Parse → Transform → Render
│   ├── cst.sh             # CST data structures
│   ├── registry.sh        # Plugin/hook registration
│   └── colors.sh          # TDS integration + fallback
├── parsers/
│   ├── markdown.sh        # Default markdown parser
│   ├── toml.sh            # TOML parser
│   ├── json.sh            # JSON parser
│   └── text.sh            # Plain text (passthrough)
├── transforms/
│   ├── latex.sh           # LaTeX → Unicode
│   ├── links.sh           # Link resolution
│   └── macros.sh          # Custom macro expansion
├── renderers/
│   ├── heading.sh         # Heading elements
│   ├── code.sh            # Code blocks (bat integration)
│   ├── list.sh            # Lists (bullet/numbered)
│   ├── table.sh           # Tables
│   └── inline.sh          # Bold/italic/code spans
├── themes/
│   └── tokens.sh          # Element → TDS token mapping
├── test/
│   ├── run_tests.sh
│   └── fixtures/
└── ROADMAP.md
```

---

## Key Design Decisions

### 1. Line-based CST First
Start with simple line-by-line parsing that returns bash arrays, not JSON.
JSON CST is Phase 7 for complex transforms.

```bash
# Simple CST: array of "type:content" strings
CST=(
    "heading:1:Title"
    "paragraph:Some text"
    "code:bash:echo hello"
)
```

### 2. TDS Optional
Chroma works without TDS using fallback ANSI.
When TDS is loaded, use semantic tokens for theme support.

### 3. bat Optional
Code highlighting works without bat (plain colored output).
When bat is available, use it for language-aware highlighting.

### 4. Plugins are Files
Each plugin is a single .sh file that self-registers on source.
No complex manifest system needed.

### 5. Hooks are Simple
Hooks are just arrays of function names called in order.
No complex event system needed.

---

## Next Steps

1. **Implement Phase 2** - Add element detection to chroma_simple.sh
2. **Add Phase 2 tests** - Headers, code, lists with colors
3. **Wire TDS colors** - Use _chroma_color with proper tokens
4. **Test with themes** - Verify -t warm changes colors

Start with the working chroma_simple.sh and evolve it incrementally.
