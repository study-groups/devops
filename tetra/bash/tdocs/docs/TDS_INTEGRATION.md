# TDOCS TDS Integration

TDOCS now uses the TDS (Tetra Display System) token-based theming system for all colors, including the REPL prompt.

## What Changed

### New Token System
- **File**: `ui/tdocs_tokens.sh`
- Defines semantic tokens that map to TDS palette references
- Tokens respond to theme changes (like RAG REPL)
- All colors are centralized and consistent

### Updated Rendering
- `tdoc_render_compact()` - List view now uses tokens and respects $COLUMNS
- `tdoc_render_category_badge()` - Uses `tdocs.category.*` tokens
- `tdoc_render_type_badge()` - Uses `tdocs.type.*` tokens
- `tdoc_render_status()` - Uses `tdocs.status.*` tokens
- Module names use `tdocs.module` token
- `_tdocs_repl_build_prompt()` - REPL prompt now uses tokens

### Layout Improvements
- Paths truncate in center with `...` when too long
- Width calculation accounts for terminal $COLUMNS
- Relative paths shown (relative to TETRA_SRC)
- No more wrapping issues

### REPL Prompt Colors
The REPL prompt `[(topic1 topic2) x level -> count] state >` now uses TDS tokens:

**Structure:**
- Brackets `[` `]` - Gray (`tdocs.prompt.bracket`)
- Parentheses `(` `)` - Gray (`tdocs.prompt.paren`)
- Separator `x` - Green (`tdocs.prompt.separator`)
- Arrow `->` - Gray (`tdocs.prompt.arrow.pipe`)
- Arrow `>` - Orange (`tdocs.prompt.arrow`)

**Topics:**
- Topic1 (category filter) - Green/Blue/Orange based on value
  - `all` - Green (`tdocs.prompt.filter.all`)
  - `core` - Blue (`tdocs.prompt.filter.core`)
  - `other` - Orange (`tdocs.prompt.filter.other`)
- Topic2 (module/filter) - Orange (`tdocs.prompt.topic2`)

**Level:**
- L0-L4 - Color coded by completeness (`tdocs.level.0` through `tdocs.level.4`)
  - L0 Red → L1 Orange → L2 Cyan → L3 Blue → L4 Green
- `all` - Green (`tdocs.prompt.level`)

**Other:**
- Document count - Purple (`tdocs.prompt.count`)
- State (browse/search/filter/edit) - Purple (`tdocs.prompt.state`)

## Token Categories

### Category Tokens
```bash
tdocs.category.core    # Blue - core documents
tdocs.category.other   # Orange - other documents
```

### Type Tokens
```bash
tdocs.type.specification
tdocs.type.standard
tdocs.type.guide
tdocs.type.reference
tdocs.type.example
tdocs.type.temporal
tdocs.type.investigation
tdocs.type.bug-fix
tdocs.type.refactor
tdocs.type.plan
tdocs.type.summary
```

### Status Tokens
```bash
tdocs.status.stable       # Green
tdocs.status.draft        # Muted
tdocs.status.deprecated   # Very muted
```

### List Display Tokens
```bash
tdocs.list.path        # Primary color for paths
tdocs.list.count       # Secondary for counts
tdocs.list.separator   # Tertiary for separators
```

### Completeness Level Tokens
```bash
tdocs.level.0   # Red - no docs
tdocs.level.1   # Orange - minimal
tdocs.level.2   # Yellow-green - working
tdocs.level.3   # Blue - complete
tdocs.level.4   # Green - exemplar
```

### Module Token
```bash
tdocs.module   # Accent color for module names
```

## Theme Support

All tokens resolve through TDS, so they:
- Change with theme switches (warm, cool, electric, etc.)
- Use consistent palette references
- Support graceful fallback when TDS unavailable

## Testing

```bash
# View available tokens
source ~/tetra/tetra.sh
tmodule tdocs
tds_show_tdocs_tokens

# Test list rendering
tdocs ls
tdocs ls --module tubes
```

## Example Output

### List View
With colors:
```
bash/tdocs/docs/SPEC.md          CORE   specification  tdocs
bash/rag/...QUICK_START.md      OTHER  guide          rag
```

Without colors (fallback):
```
bash/tdocs/docs/SPEC.md          CORE    specification  tdocs
bash/rag/docs/QUICK_START.md    OTHER   guide          rag
```

### REPL Prompt Examples

**New format:**
```
[(all all) x all -> 34] browse >           # Default - all filters, browse mode
[(core all) x all -> 12] browse >          # Core documents only
[(other tubes) x L4 -> 8] browse >         # Other docs, tubes module, L4 only
[(all tdocs) x L3 -> 5] search >           # tdocs module, L3, searching
[(core rag) x L2 -> 3] filter >            # Core + rag, L2, filtering
```

Color mapping:
- **Structure**: Gray brackets/parens, green `x`, gray `->`, orange `>`
- **Topics**: Green `all`, blue `core`, orange `other`/modules
- **Level**: Color coded L0(red) → L4(green), or green `all`
- **Count/State**: Purple

## Migration Notes

- Old `TDOC_TAG_COLORS` array still works (maps to new tokens)
- All rendering functions updated to use tokens
- No breaking changes to public API
