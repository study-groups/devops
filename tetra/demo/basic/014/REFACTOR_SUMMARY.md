# Demo 014 Refactor Summary

## Key Changes

### 1. Execution Contexts (was "Environment")
**Concept**: Contexts define WHERE actions execute FROM

- **HELP** - Meta-environment for learning (shows help actions)
- **Local** - Your machine (local operations only)
- **Dev** - Development server (full access)
- **Staging** - Pre-production (read-heavy, controlled writes)
- **Production** - Live systems (read-only + emergency writes)

**Navigation**: Press `e` to cycle through contexts

### 2. Enhanced Action Signatures
Format: `verb:noun :: (inputs) → output [where effects]`

**Components**:
- `verb:noun` - Action identifier (colorized)
- `::` - Endpoint operator (TES binding)
- `(inputs)` - Required input data/files
- `→` - Flow operator (data transformation)
- `output` - Primary result (@tui[content])
- `[where effects]` - Side effects (files written)

**Example**:
```
fetch:config :: () → @tui[content] [where @local[~/Downloads/config.toml]]
```

### 3. Action Metadata
Each action declares:
- `exec_at` - Where command runs (always @local)
- `source_at` - Where data comes from
- `target_at` - Where data goes to
- `inputs` - Required files/data
- `output` - Primary destination
- `effects` - Side effects
- `can` - Capabilities
- `cannot` - Limitations
- `tes_operation` - read/write/execute/local

### 4. UI Improvements

**Header** (5 lines with tabs for alignment):
```
Demo 014: Action Signatures | Dev × Transfer
Context:    [Dev] Local Staging Production
Mode:       [Transfer] Inspect Execute
Action:     [fetch×config] (2/3)
Status:     ○ idle
```

**Footer** (4 lines, centered, 50 chars):
```
──────────────────────────────────────────────────
         e=context  d=mode  f=action  i=detail
           Enter=exec  s=sigs  l=log
                c=clear  q=quit

```

### 5. Action Detail View
Press `i` to toggle detailed signature view showing:
- Full signature with all components
- Execution metadata (runs_at, reads_from, writes_to)
- Capabilities (can/cannot)
- TES operation type
- Immediate execution flag

### 6. HELP Environment
Special context that explains the system:
- `help:signatures` - Action signature anatomy
- `help:contexts` - Execution contexts explained
- `help:modes` - Operation modes (Inspect/Transfer/Execute)
- `help:operations` - TES operations (read/write/execute)

### 7. File Transfer Actions
Context-aware operations:
- `fetch:config` - Download from remote → local
- `push:config` - Upload from local → remote
- `sync:files` - Rsync directories

Each shows:
- Source and target endpoints
- Command that would execute
- Safety warnings (demo mode)

## Navigation

| Key | Action |
|-----|--------|
| `e` | Cycle context (HELP/Local/Dev/Staging/Production) |
| `d` | Cycle mode (Inspect/Transfer/Execute) |
| `f` | Cycle action |
| `i` | Toggle action detail view |
| `Enter` | Execute action |
| `s` | Show all signatures |
| `l` | Show execution log |
| `c` | Clear content |
| `q` | Quit |

## Action Registry

Actions are organized by context + mode:

**HELP (all modes)**:
- help:signatures, help:contexts, help:modes, help:operations

**Local:Inspect**:
- show:demo, show:help, view:env, view:toml, status:local

**Dev:Transfer**:
- fetch:config, push:config, sync:files

**Production:Inspect**:
- view:env, status:remote

## Status Buffer
New `@tui[status]` concept - permanent status line shows:
- Current state symbol (○ ▶ ✓ ✗)
- State name (idle/executing/success/error)
- Execution feedback

## Typography
Operators carried forward:
- `::` - Endpoint operator (TES binding)
- `→` - Flow operator (data flow)
- `×` - Cross operator (context × mode)
- `@` - Route operator (endpoint designation)

## Running

```bash
./demo/basic/014/demo.sh
```

Start in HELP context to learn the system, then switch to Local/Dev/Staging/Production to explore file transfer operations.
