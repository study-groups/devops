# TMC Purge Plan - Rename to MIDI

**Date:** 2025-11-05
**Status:** Planning
**Goal:** Remove all "TMC" (Tetra MIDI Controller) references and rename to just "MIDI"

## Background

TMC (Tetra MIDI Controller) was the old concept/branding. We're modernizing to just use "MIDI" as the module name, keeping it simple and clear.

## Scope

### Files with TMC References

**Core Code** (24 files with TMC):
- `bash/midi/midi.sh` - Module header, variables, function names
- `bash/midi/core/mapper.sh` - All function names, variables
- `bash/midi/core/state.sh` - All function names
- `bash/midi/core/repl.sh` - Function names, prompts
- `bash/midi/core/learn.sh` - Function names
- `bash/midi/core/socket_server.sh` - Variable names
- `bash/midi/lib/errors.sh` - All constants and functions
- `bash/midi/completion.sh` - Function names
- `bash/midi/midi.js` - OSC/socket code
- `bash/midi/tmc.py` - **DELETE** (old Python bridge, obsolete)

**Documentation** (all .md files):
- `README.md` - Header, all examples
- `USAGE.md` - Throughout
- `QUICKSTART.md` - Commands and examples
- `STATUS.md` - Status updates
- `OSC_API.md` - API examples
- `REFACTORING_SUMMARY.md` - Historical doc
- `PROMPT_REFACTOR_COMPLETE.md` - Historical doc
- `docs/*.md` - All guides

**Test Files:**
- `bash/midi/tests/*.sh` - Function calls

## Renaming Strategy

### 1. Variables

| Old | New |
|-----|-----|
| `TMC_CONFIG_DIR` | `MIDI_CONFIG_DIR` |
| `TMC_HARDWARE_MAP` | `MIDI_HARDWARE_MAP` |
| `TMC_HARDWARE_REV` | `MIDI_HARDWARE_REV` |
| `TMC_SEMANTIC_MAP` | `MIDI_SEMANTIC_MAP` |
| `TMC_SEMANTIC_REV` | `MIDI_SEMANTIC_REV` |
| `TMC_ERR_*` | `MIDI_ERR_*` |
| `TMC_LOG_*` | `MIDI_LOG_*` |
| `TMC_COLOR_*` | `MIDI_COLOR_*` |

### 2. Functions

| Old | New | Notes |
|-----|-----|-------|
| `tmc_mapper_init()` | `midi_mapper_init()` | Core function |
| `tmc_load_device()` | `midi_load_device()` | **KEY - device loading** |
| `tmc_load_hardware_map()` | `midi_load_hardware_map()` | |
| `tmc_load_semantic_map()` | `midi_load_semantic_map()` | |
| `tmc_map_event()` | `midi_map_event()` | |
| `tmc_state_*()` | `midi_state_*()` | All state functions |
| `tmc_error()` | `midi_error()` | Error handling |
| `tmc_warn()` | `midi_warn()` | |
| `tmc_info()` | `midi_info()` | |
| `tmc_debug()` | `midi_debug()` | |
| `tmc_validate_*()` | `midi_validate_*()` | All validators |
| `tmc_sanitize_*()` | `midi_sanitize_*()` | All sanitizers |

### 3. Comments and Documentation

Replace all instances of:
- "TMC" → "MIDI"
- "Tetra MIDI Controller" → "MIDI Module" or just "MIDI"
- "tmc binary" → "midi binary" (if renaming C binary)

### 4. File Names

Consider renaming:
- `bash/midi/tmc.c` → `bash/midi/midi_bridge.c` (C MIDI bridge)
- `bash/midi/tmc.py` → **DELETE** (obsolete)

## Implementation Plan

### Phase 1: Core Code (Automated with sed)

```bash
cd ~/tetra/bash/midi

# Backup first
git stash
git checkout -b purge-tmc

# 1. Rename all TMC_ variables to MIDI_
find . -name "*.sh" -type f -exec sed -i '' 's/TMC_/MIDI_/g' {} +

# 2. Rename all tmc_ functions to midi_
find . -name "*.sh" -type f -exec sed -i '' 's/tmc_/midi_/g' {} +

# 3. Update comments and strings
find . -name "*.sh" -type f -exec sed -i '' 's/Tetra MIDI Controller/MIDI Module/g' {} +
find . -name "*.sh" -type f -exec sed -i '' 's/TMC/MIDI/g' {} +

# 4. JavaScript/Node files
sed -i '' 's/TMC/MIDI/g' midi.js
sed -i '' 's/tmc/midi/g' midi.js

# 5. Delete obsolete Python bridge
rm -f tmc.py
```

### Phase 2: Documentation

```bash
# Update all markdown files
find . -name "*.md" -type f -exec sed -i '' 's/TMC/MIDI/g' {} +
find . -name "*.md" -type f -exec sed -i '' 's/Tetra MIDI Controller/MIDI Module/g' {} +
find . -name "*.md" -type f -exec sed -i '' 's/tmc\./midi./g' {} +
find . -name "*.md" -type f -exec sed -i '' 's/\btmc\b/midi/g' {} +
```

### Phase 3: C Binary (Optional)

If we want to rename the C binary too:

```bash
# Rename C source
mv tmc.c midi_bridge.c

# Update build commands in docs
sed -i '' 's/tmc\.c/midi_bridge.c/g' README.md
sed -i '' 's/\btmc\b/midi_bridge/g' README.md
sed -i '' 's/\./tmc\b/\.\/midi_bridge/g' *.md
```

### Phase 4: Testing

After renaming, test all functionality:

```bash
# Test module loading
tmod load midi

# Test REPL
midi repl

# Inside REPL:
devices          # List MIDI devices
device vmx8      # Load a device
map              # Show current mappings
learn            # Test learning mode
```

### Phase 5: Git Cleanup

```bash
# Review changes
git diff

# Commit
git add -A
git commit -m "refactor(midi): Purge TMC branding, rename to MIDI

- Rename all TMC_* variables to MIDI_*
- Rename all tmc_* functions to midi_*
- Update all documentation
- Delete obsolete tmc.py Python bridge
- Simplify branding from 'Tetra MIDI Controller' to 'MIDI Module'

BREAKING: All function and variable names changed from tmc_* to midi_*"

# Merge
git checkout main
git merge purge-tmc
```

## Breaking Changes

**All function calls change:**

Before:
```bash
tmc_load_device "vmx8"
tmc_map_event "CC" "1" "7" "64"
tmc_state_get "device_name"
```

After:
```bash
midi_load_device "vmx8"
midi_map_event "CC" "1" "7" "64"
midi_state_get "device_name"
```

**All environment variables change:**

Before:
```bash
export TMC_CONFIG_DIR="~/tetra/midi"
export TMC_INPUT_DEVICE=0
export TMC_OUTPUT_DEVICE=0
```

After:
```bash
export MIDI_CONFIG_DIR="~/tetra/midi"
export MIDI_INPUT_DEVICE=0
export MIDI_OUTPUT_DEVICE=0
```

## Migration Guide for Users

### If you have scripts calling TMC functions:

```bash
# Simple sed replacement in your scripts:
sed -i '' 's/tmc_/midi_/g' your_script.sh
sed -i '' 's/TMC_/MIDI_/g' your_script.sh
```

### If you have environment variables set:

Update your `~/.bashrc` or `~/.zshrc`:
```bash
# Old
export TMC_CONFIG_DIR="~/tetra/midi"

# New
export MIDI_CONFIG_DIR="~/tetra/midi"
```

### REPL commands stay the same:

All REPL commands remain unchanged:
- `device <name>` - Still works
- `map` - Still works
- `learn` - Still works
- `/start`, `/stop` - Still work

## Benefits

1. **Simpler branding** - "MIDI" instead of "TMC/Tetra MIDI Controller"
2. **Clearer naming** - `midi_*` functions are more intuitive
3. **Consistency** - Matches module name `tmod load midi`
4. **Less typing** - `MIDI_` is shorter than `TMC_`
5. **Better discoverability** - Functions group under `midi_*` prefix

## Risks

1. **Breaking changes** - All external scripts need updates
2. **Documentation debt** - Historical docs may reference TMC
3. **Muscle memory** - Users familiar with `tmc_*` need to adapt

## Decision Points

### Question 1: Rename C binary?

**Options:**
- A) Keep as `tmc` (users are used to it)
- B) Rename to `midi_bridge` (consistency)
- C) Rename to just `midi` (conflicts with bash function)

**Recommendation:** Keep as `tmc` for now, or rename to `midi_bridge`

### Question 2: Keep historical docs?

**Options:**
- A) Update in place (lose history)
- B) Move to `docs/historical/` (preserve)
- C) Add "deprecated" warnings

**Recommendation:** Option B - move historical docs

### Question 3: Compatibility shim?

Should we add aliases for backwards compatibility?

```bash
# In midi.sh
alias tmc_load_device='midi_load_device'
alias tmc_map_event='midi_map_event'
# etc...
```

**Recommendation:** No - clean break is better

## Files to Delete

1. `bash/midi/tmc.py` - Old Python bridge (obsolete)
2. Any `*tmc*` test files that are obsolete

## Priority Order

1. **HIGH**: Core code (mapper.sh, state.sh, errors.sh)
2. **HIGH**: Main entry point (midi.sh)
3. **MEDIUM**: REPL and learning (repl.sh, learn.sh)
4. **MEDIUM**: Documentation (README.md, USAGE.md)
5. **LOW**: Historical docs (move to archive)
6. **LOW**: Test files

## Validation Checklist

After purge, verify:
- [ ] Module loads: `tmod load midi`
- [ ] REPL launches: `midi repl`
- [ ] Devices list: `midi devices`
- [ ] Device loads: `device vmx8`
- [ ] Mapping works: `map`
- [ ] Learning works: `learn`
- [ ] No `tmc_*` function calls remain
- [ ] No `TMC_*` variables remain
- [ ] All docs updated
- [ ] Tests pass

## Timeline

- **Planning:** 30 minutes (this document)
- **Execution:** 2-3 hours (careful sed + testing)
- **Testing:** 1 hour (verify all functionality)
- **Documentation:** 30 minutes (update guides)

**Total: ~4 hours**

## Next Steps

1. ✅ Create this purge plan
2. Get user approval
3. Create git branch: `purge-tmc`
4. Execute Phase 1-2 (automated)
5. Manual review and testing
6. Execute Phase 3-5
7. Commit and merge

---

**Status:** ✅ Plan Complete - Awaiting Approval
**Impact:** BREAKING - All function/variable names change
**Benefit:** Cleaner, more intuitive naming aligned with module name
