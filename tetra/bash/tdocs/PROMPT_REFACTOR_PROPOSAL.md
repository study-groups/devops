# TDOCS Prompt Refactor: Context Switching

## Problem
Current prompt is cluttered and doesn't support context switching:
```
[midi | scratch:65 spec:15 reference:3] 6 >
```

## Proposed Solution: Org-style Context Switching

### New Prompt Format

**Format**: `[context] filter × view → sort ▶`

**Examples**:
```bash
[all] type × compact ▶              # Default: all docs, filtered by type, compact view
[midi] module × detailed ▶          # Module context: midi docs only
[spec] type × compact → rank ▶      # Type context: specs, sorted by rank
[search:"osc"] query × compact ▶    # Search context
```

### Context Dimensions

**1. Context (Left side of bracket)**
- `all` - All documents (default)
- `midi`, `rag`, `tdocs` - Module filter
- `spec`, `guide`, `investigation` - Type filter
- `search:"query"` - Search results

**2. Filter Mode (After bracket)**
- `type` - Show type breakdown
- `module` - Show module breakdown
- `none` - No breakdown

**3. View Mode (After ×)**
- `compact` - Single line per doc
- `detailed` - Multi-line with metadata
- `preview` - With content preview

**4. Sort Mode (After →, optional)**
- `rank` - By relevance rank
- `time` - By recency
- `alpha` - Alphabetical
- _(omit for default relevance)_

### Keyboard Navigation

**Arrow Keys** (like org REPL):
- `←/→` - Cycle context (all → modules → types → search history)
- `↑/↓` - Cycle within context (midi → rag → tdocs)
- `Tab` - Cycle view mode (compact → detailed → preview)
- `Space` - Cycle sort mode (rank → time → alpha)

### Single-Key Mode

Press `ESC` to enter single-key mode for rapid navigation:
```bash
[midi] module × compact ⌨         # Single-key mode indicator
```

**Keys**:
- `m` - Switch to module context
- `t` - Switch to type context
- `a` - Switch to all (clear filters)
- `c` - Compact view
- `d` - Detailed view
- `p` - Preview view
- `r` - Sort by rank
- `t` - Sort by time
- `n` - Sort alphabetically (name)
- `ESC` - Exit single-key mode

### Implementation Strategy

#### Phase 1: Refactor State
```bash
# Current (cluttered)
TDOCS_REPL_MODULES=()
TDOCS_REPL_TYPE=()
TDOCS_REPL_INTENT=()
TDOCS_REPL_GRADE=()
TDOCS_REPL_LEVEL=""
TDOCS_REPL_TEMPORAL=""
TDOCS_REPL_SORT="relevance"
TDOCS_REPL_STATE="find"

# Proposed (clean)
TDOCS_CONTEXT="all"              # all|module:midi|type:spec|search:query
TDOCS_FILTER_MODE="type"         # type|module|none
TDOCS_VIEW_MODE="compact"        # compact|detailed|preview
TDOCS_SORT_MODE="rank"           # rank|time|alpha
TDOCS_SINGLE_KEY_MODE=false      # true|false
```

#### Phase 2: Context Switcher
```bash
tdocs_cycle_context() {
    local direction="${1:-next}"  # next|prev

    case "$TDOCS_CONTEXT" in
        all)
            # Cycle to first module or type
            [[ "$direction" == "next" ]] && TDOCS_CONTEXT="module:midi"
            ;;
        module:*)
            # Cycle through modules
            # ...
            ;;
        type:*)
            # Cycle through types
            # ...
            ;;
    esac

    tdocs_refresh_list
}
```

#### Phase 3: Key Handlers
```bash
repl_handle_arrow_left() { tdocs_cycle_context "prev"; }
repl_handle_arrow_right() { tdocs_cycle_context "next"; }
repl_handle_tab() { tdocs_cycle_view; }
repl_handle_space() { tdocs_cycle_sort; }
repl_handle_esc() { TDOCS_SINGLE_KEY_MODE=true; }
```

### Benefits

1. **Cleaner Prompt**: One context at a time, not all filters at once
2. **Keyboard Driven**: Navigate without typing commands
3. **Discoverable**: Press arrow keys to see what's available
4. **Consistent**: Follows org REPL patterns users already know
5. **Scalable**: Easy to add new context types (grade, intent, temporal)

### Migration Path

**Backward Compatible**:
- Keep existing commands (`find`, `filter`, `ls`)
- Add new keyboard shortcuts
- Gradually deprecate complex filter syntax

**Example Session**:
```bash
# Current way (still works)
[all] type × compact ▶
> find midi spec

# New way (keyboard only)
[all] type × compact ▶
  → → →     # Press right arrow 3 times
[midi] module × compact ▶
  Tab       # Toggle view
[midi] module × detailed ▶
  Space     # Toggle sort
[midi] module × detailed → time ▶
```

### Questions for User

1. **Context priority**: Which contexts matter most? (all, module, type, search, grade, intent?)
2. **Default view**: Compact or detailed?
3. **Show counts**: Display doc count in prompt like now? `[midi:6] module × compact ▶`
4. **Breakdown display**: Show type breakdown below prompt instead of inline?

```bash
[midi] module × compact ▶
  spec:2 guide:3 scratch:1
> _
```

5. **Backward compatibility**: Keep all current commands or simplify?
