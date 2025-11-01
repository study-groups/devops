# tdocs REPL - Hierarchical Navigation & Context Building Plan

## Current State (Completed ✅)

- [x] Refactored prompt to `[category x module x count] docs ▶` format
- [x] Uses tmpfile-based ANSI color rendering
- [x] Integrated with REPL color system
- [x] Modern REPL architecture (like rag module)

## New Requirements

### 1. TAB Completion for Hierarchical Drill-Down

**Goal**: Navigate document hierarchy using TAB to drill in, Shift-TAB to drill out

**Hierarchy Levels**:
```
All Docs (root)
  ├─ Category (core/other)
  │   └─ Module (org/rag/tsm/etc)
  │       └─ Document (specific file)
  │           └─ Section (headings)
  └─ ...
```

**Navigation Flow**:
```bash
# Start at root
[all x all x 156] docs ▶ <TAB>
  → Shows: core, other

[all x all x 156] docs ▶ core<TAB>
  → Drills into core category
  → Prompt becomes: [core x all x 89] docs ▶

[core x all x 89] docs ▶ <TAB>
  → Shows: Available modules (org, rag, tsm, etc.)

[core x all x 89] docs ▶ org<TAB>
  → Drills into org module
  → Prompt becomes: [core x org x 12] docs ▶

[core x org x 12] docs ▶ <TAB>
  → Shows: Document list for org module

[core x org x 12] docs ▶ README<TAB>
  → Views/opens README.md

[core x org x 12] docs ▶ <Shift-TAB>
  → Drills OUT to parent
  → Prompt becomes: [core x all x 89] docs ▶
```

**Implementation Approach**:
1. Create navigation stack: `TDOCS_NAV_STACK=()`
2. TAB handler: `_tdocs_tab_handler()`
   - If at leaf: show completions for current level
   - If selecting item: drill in and push to stack
3. Shift-TAB handler: `_tdocs_shift_tab_handler()`
   - Pop from stack
   - Update filters
   - Rebuild prompt

### 2. Context Building (RAG-like Static Spans)

**Goal**: Build context spanning multiple modules, similar to RAG flows but static

**Use Case**:
```bash
# User wants context about "authentication across modules"
[all x all x 156] docs ▶ /context new "auth flow"
Context: auth-flow-001 created

[all x all x 156] docs ▶ /context add org/AUTH.md
Added: org/AUTH.md → $c1

[all x all x 156] docs ▶ /context add rag/README.md#Authentication
Added: rag/README.md#Authentication → $c2

[all x all x 156] docs ▶ /context add tsm/SECURITY.md::100,200
Added: tsm/SECURITY.md (lines 100-200) → $c3

[all x all x 156] docs ▶ /context list
Context: auth-flow-001 (3 items, 1500 tokens)
  $c1: org/AUTH.md (full)
  $c2: rag/README.md#Authentication (section)
  $c3: tsm/SECURITY.md::100,200 (excerpt)

[all x all x 156] docs ▶ /context view $c1
<Shows org/AUTH.md with TDS rendering>

[all x all x 156] docs ▶ /context assemble
Assembled → ~/tetra/tdocs/contexts/auth-flow-001.mdctx
Token count: 1500
Ready for LLM submission

[all x all x 156] docs ▶ /context submit @claude
Submitting to Claude...
Response saved to: ~/tetra/tdocs/contexts/auth-flow-001.response.md
```

**Context Format** (similar to RAG evidence):
```
contexts/
  auth-flow-001/
    meta.json          # Context metadata
    items/
      001_org_AUTH.evidence.md
      002_rag_README#Auth.evidence.md
      003_tsm_SECURITY:100-200.evidence.md
    auth-flow-001.mdctx    # Assembled context
    auth-flow-001.response.md  # LLM response
```

### 3. Implementation Plan

#### Phase 1: TAB Navigation (Priority 1)

**Files to create/modify**:
- `bash/tdocs/navigation.sh` - Navigation stack and handlers
- `bash/tdocs/tdocs_repl.sh` - Integrate TAB/Shift-TAB bindings
- `bash/tdocs/completion.sh` - Context-aware completions

**Key Functions**:
```bash
# Navigation stack
tdocs_nav_push()      # Push level onto stack
tdocs_nav_pop()       # Pop level from stack
tdocs_nav_current()   # Get current level

# TAB handlers
_tdocs_tab_complete()      # Show completions for current level
_tdocs_shift_tab_up()      # Navigate up one level

# Level-specific completions
_tdocs_complete_categories()  # core, other
_tdocs_complete_modules()     # org, rag, tsm for selected category
_tdocs_complete_docs()        # Document files for selected module
_tdocs_complete_sections()    # Sections within a document
```

#### Phase 2: Context Building (Priority 2)

**Files to create/modify**:
- `bash/tdocs/context.sh` - Context management (inspired by rag/evidence)
- `bash/tdocs/tdocs_commands.sh` - Add /context commands

**Key Functions**:
```bash
# Context management
tdocs_context_new()        # Create new context
tdocs_context_add()        # Add document/section to context
tdocs_context_list()       # List items in context
tdocs_context_view()       # View specific item
tdocs_context_toggle()     # Enable/disable items
tdocs_context_assemble()   # Build final .mdctx file
tdocs_context_submit()     # Submit to LLM (optional)

# Evidence format (reuse from RAG)
_tdocs_create_evidence()   # Convert doc to evidence format
_tdocs_parse_selector()    # Parse file::100,200#tag syntax
```

#### Phase 3: Integration & Polish (Priority 3)

**Features**:
- Keyboard bindings: Ctrl-T for context menu
- Auto-refresh context on changes
- Token budget tracking
- Context statistics in prompt: `[core x org x 12 ⊕3] docs ▶`
  - `⊕3` = 3 items in active context
- Color coding for context items

### 4. User Experience Flow

**Scenario**: User wants to understand auth flow across modules

```bash
# 1. Launch tdocs REPL
$ tdocs
[all x all x 156] docs ▶

# 2. Create context
[all x all x 156] docs ▶ /context new "auth-flow"
✓ Context created: auth-flow-001

# 3. Navigate to find auth docs
[all x all x 156] docs ▶ core<TAB>
[core x all x 89] docs ▶ org<TAB>
[core x org x 12] docs ▶ <TAB>
  README.md
  AUTH.md
  DEPLOY.md
  ...

# 4. Add to context
[core x org x 12] docs ▶ AUTH<ENTER>
<Views AUTH.md>

[core x org x 12] docs ▶ /context add current
✓ Added org/AUTH.md → $c1
[core x org x 12 ⊕1] docs ▶

# 5. Navigate to next module
[core x org x 12 ⊕1] docs ▶ <Shift-TAB>
[core x all x 89 ⊕1] docs ▶ <Shift-TAB>
[all x all x 156 ⊕1] docs ▶ rag<TAB>
[all x rag x 8 ⊕1] docs ▶ README<ENTER>

# 6. Add specific section
[all x rag x 8 ⊕1] docs ▶ /context add current#Authentication
✓ Added rag/README.md#Authentication → $c2
[all x rag x 8 ⊕2] docs ▶

# 7. Assemble and view
[all x rag x 8 ⊕2] docs ▶ /context assemble
✓ Assembled: ~/tetra/tdocs/contexts/auth-flow-001.mdctx
  Token count: 1500

[all x rag x 8 ⊕2] docs ▶ /context view
<Shows assembled context with TDS rendering>
```

### 5. Technical Details

**Navigation State**:
```bash
TDOCS_NAV_STACK=()         # Stack of navigation levels
TDOCS_NAV_CURRENT=""       # Current level (category/module/doc)
TDOCS_NAV_TYPE=""          # Type (category|module|doc|section)
```

**Context State**:
```bash
TDOCS_CONTEXT_ACTIVE=""    # Active context ID
TDOCS_CONTEXT_DIR=""       # Context directory
TDOCS_CONTEXT_ITEMS=()     # Array of evidence items
```

**TAB Binding** (in readline mode):
```bash
bind '"\t": "\C-e\C-u_tdocs_tab_complete\n"'
bind '"\e[Z": "\C-e\C-u_tdocs_shift_tab_up\n"'  # Shift-TAB
```

### 6. Benefits

**For Users**:
- Fast hierarchical navigation without typing paths
- Build research contexts across modules
- Reusable context "recipes" for common queries
- Natural workflow: explore → collect → assemble

**For System**:
- Consistent with RAG flow patterns
- Reuses evidence format
- Integrates with existing TDS rendering
- Enables cross-module documentation queries

### 7. Next Steps

1. Implement `bash/tdocs/navigation.sh` - TAB/Shift-TAB handlers
2. Add navigation stack to REPL state
3. Create completion functions for each level
4. Test hierarchical navigation
5. Implement `bash/tdocs/context.sh` - Context management
6. Add /context commands to REPL
7. Test end-to-end workflow

---

**Status**: Plan documented, ready for implementation
**Dependencies**: bash/repl, bash/color, bash/tds, bash/tree
**Reference**: bash/rag (for evidence/context patterns)
