# TDOCS Phase 2 Refactor - Next Steps

**Status**: 📋 Planned
**Risk Level**: Medium
**Estimated Effort**: 4-6 hours
**Goal**: Architectural improvements & data integrity

---

## Overview

Phase 2 tackles **architectural issues** identified during code review. These changes will improve data integrity, reduce confusion, and establish single sources of truth.

Unlike Phase 1 (safe cleanup), Phase 2 involves behavioral changes and requires careful migration.

---

## 🎯 Objectives

1. **Migrate category→lifecycle** - Eliminate binary core/other confusion
2. **Frontmatter sync validation** - Database as cache, frontmatter as source
3. **Consolidate color rendering** - TDS as single source of truth
4. **Define canonical types** - Reject invalid document types

---

## 1. Migrate Category to Lifecycle

### Problem

**Dual authority systems** causing confusion:

```bash
# OLD (binary)
category: "core" | "other"

# NEW (gradient)
lifecycle: "D" | "W" | "S" | "C" | "X"
```

Both fields exist in database schema. Code references both. Users confused about which to use.

### Solution

**Deprecate `category` field entirely**. Migrate to lifecycle-only.

#### Lifecycle Mapping

| Old Category | New Lifecycle | Evidence Weight | Meaning |
|--------------|---------------|-----------------|---------|
| `core` | `C` (Canonical) | 1.0 | Reference documentation |
| `core` | `S` (Stable) | 0.8 | Established patterns |
| `other` | `W` (Working) | 0.5 | Active development |
| `other` | `X` (Ephemeral) | 0.2 | Temporal/scratch |

#### Implementation Plan

**Step 1**: Add migration function
```bash
# core/database.sh
tdoc_migrate_category_to_lifecycle() {
    for meta_file in "$TDOCS_DB_DIR"/*.meta; do
        [[ ! -f "$meta_file" ]] && continue

        # Read current category
        local category=$(jq -r '.category // "other"' "$meta_file")

        # Map to lifecycle if not set
        local lifecycle=$(jq -r '.lifecycle // ""' "$meta_file")
        if [[ -z "$lifecycle" ]]; then
            case "$category" in
                core) lifecycle="C" ;;
                *) lifecycle="W" ;;
            esac

            # Update meta file
            jq ".lifecycle = \"$lifecycle\"" "$meta_file" > "$meta_file.tmp"
            mv "$meta_file.tmp" "$meta_file"
        fi
    done
}
```

**Step 2**: Remove category references
- `classify.sh:101-112` - `tdoc_suggest_category()` → DELETE
- `database.sh` - Remove `category` from schema
- `search.sh` - Update filters to use lifecycle

**Step 3**: Update help/docs
- Help text: "core/other" → "lifecycle grades (D/W/S/C/X)"
- README examples

**Validation**: Run migration, verify all docs have lifecycle, no category references remain

---

## 2. Frontmatter Sync Validation

### Problem

**Dual metadata storage** without sync:

1. **YAML frontmatter** inside `.md` files
2. **JSON metadata** in `$TDOCS_DB_DIR/*.meta` files

Which is source of truth? Can get out of sync. No validation.

### Solution

**Option C**: Database as cache, frontmatter as source of truth

#### Architecture

```
Document.md (YAML frontmatter)
    ↓ (source of truth)
    ↓
{timestamp}.meta (JSON)
    ↓ (cached copy)
    ↓
{timestamp}.meta.hash (frontmatter hash)
```

#### Implementation Plan

**Step 1**: Add hash tracking
```bash
# core/database.sh - Enhance tdoc_db_create()

# Calculate frontmatter hash
local frontmatter_hash=""
if tdoc_has_frontmatter "$doc_path"; then
    local fm=$(tdoc_parse_frontmatter "$doc_path")
    frontmatter_hash=$(echo "$fm" | shasum -a 256 | awk '{print $1}')
fi

# Add to metadata JSON
local meta_json="{
  \"timestamp\": $timestamp,
  \"doc_path\": \"$abs_path\",
  \"frontmatter_hash\": \"$frontmatter_hash\",
  \"needs_resync\": false,
  ...
}"
```

**Step 2**: Add sync validation
```bash
# core/database.sh
tdoc_check_sync() {
    local doc_path="$1"
    local meta_file=$(tdoc_get_db_path_by_doc "$doc_path")

    [[ ! -f "$meta_file" ]] && return 1

    # Get stored hash
    local stored_hash=$(jq -r '.frontmatter_hash // ""' "$meta_file")

    # Calculate current hash
    local current_hash=""
    if tdoc_has_frontmatter "$doc_path"; then
        local fm=$(tdoc_parse_frontmatter "$doc_path")
        current_hash=$(echo "$fm" | shasum -a 256 | awk '{print $1}')
    fi

    # Compare
    if [[ "$stored_hash" != "$current_hash" ]]; then
        # Mark for resync
        jq '.needs_resync = true' "$meta_file" > "$meta_file.tmp"
        mv "$meta_file.tmp" "$meta_file"
        return 1
    fi

    return 0
}
```

**Step 3**: Auto-resync on access
```bash
# core/database.sh - Update tdoc_db_get()

tdoc_db_get() {
    local doc_path="$1"
    local meta_file=$(tdoc_get_db_path_by_doc "$doc_path")

    # Check if needs resync
    if ! tdoc_check_sync "$doc_path"; then
        # Re-import from frontmatter
        tdoc_resync_from_frontmatter "$doc_path"
    fi

    cat "$meta_file"
}
```

**Step 4**: Add `tdocs doctor` check
```bash
# Check for stale metadata
tdocs doctor --sync-check
```

**Validation**: Modify frontmatter, verify metadata auto-updates

---

## 3. Consolidate Color Rendering

### Problem

**Multiple color sources**:
- `ui/preview.sh` - Hardcoded ANSI codes
- `ui/colors.sh` - Mix of TDS and fallbacks
- `ui/tags.sh` - TDS tokens with fallbacks
- `ui/color_explorer.sh` - Direct palette access

No single source of truth for colors.

### Solution

**TDS as canonical source**. All color rendering goes through TDS tokens.

#### Implementation Plan

**Step 1**: Audit hardcoded colors
```bash
# Find all hardcoded ANSI codes
grep -r "\\033\[" bash/tdocs/ui/
```

**Step 2**: Replace with TDS tokens
```bash
# Before (preview.sh:72)
echo -e "\033[1;36m${text}\033[0m"

# After
tds_text_color "text.heading.h1"
echo "${text}"
reset_color
```

**Step 3**: Define missing tokens
```bash
# If tokens don't exist, add to tds/themes/default.sh
TEXT_HEADING_H1="#1E90FF"  # Bright cyan
TEXT_HEADING_H2="#9370DB"  # Purple
TEXT_HEADING_H3="#FFD700"  # Gold
```

**Step 4**: Remove fallbacks
```bash
# ui/tags.sh - Remove "else" branches that use raw ANSI
if [[ "$TDS_LOADED" == "true" ]]; then
    tds_text_color "$token"
else
    # DELETE THIS BRANCH - require TDS
    echo "Error: TDS not loaded" >&2
    return 1
fi
```

**Validation**: Unset TDS, verify graceful error instead of fallback

---

## 4. Define Canonical Type Constants

### Problem

**Type validation is incomplete**:
- Function `tdoc_resolve_type()` referenced but not defined
- No central list of valid types
- Type aliases inconsistent (spec vs specification)

### Solution

**Define canonical types in constants, validate strictly**

#### Implementation Plan

**Step 1**: Define constants
```bash
# core/tdocs_constants.sh - Add type validation

# Canonical document types
declare -gA TDOC_CANONICAL_TYPES=(
    [specification]="specification"
    [standard]="standard"
    [reference]="reference"
    [guide]="guide"
    [example]="example"
    [integration]="integration"
    [plan]="plan"
    [investigation]="investigation"
    [bug-fix]="bug-fix"
    [refactor]="refactor"
    [summary]="summary"
    [scratch]="scratch"
)

# Type aliases (for user convenience)
declare -gA TDOC_TYPE_ALIASES=(
    [spec]="specification"
    [std]="standard"
    [ref]="reference"
    [tut]="guide"
    [ex]="example"
    [bug]="bug-fix"
)
```

**Step 2**: Implement resolver
```bash
# core/tdocs_constants.sh
tdoc_resolve_type() {
    local type="$1"

    # Check if canonical
    if [[ -v "TDOC_CANONICAL_TYPES[$type]" ]]; then
        echo "$type"
        return 0
    fi

    # Check if alias
    if [[ -v "TDOC_TYPE_ALIASES[$type]" ]]; then
        echo "${TDOC_TYPE_ALIASES[$type]}"
        return 0
    fi

    # Invalid type
    echo "Error: Invalid document type '$type'" >&2
    echo "Valid types: ${!TDOC_CANONICAL_TYPES[@]}" >&2
    echo "Aliases: ${!TDOC_TYPE_ALIASES[@]}" >&2
    return 1
}

export -f tdoc_resolve_type
```

**Step 3**: Enforce validation
```bash
# core/database.sh - Update tdoc_db_create()

# Resolve and validate type
type=$(tdoc_resolve_type "$type") || {
    echo "Defaulting to 'scratch'" >&2
    type="scratch"
}
```

**Step 4**: Add type listing
```bash
# Add command: tdocs types
tdocs types
# Output:
# Canonical Types:
#   specification, standard, reference, guide, example,
#   integration, plan, investigation, bug-fix, refactor,
#   summary, scratch
#
# Aliases:
#   spec→specification, std→standard, ref→reference,
#   tut→guide, ex→example, bug→bug-fix
```

**Validation**: Try invalid type, verify error message + default

---

## Migration Strategy

### Phase 2A: Non-Breaking (Safe First)
1. ✅ Add `tdoc_resolve_type()` (missing function)
2. ✅ Add `frontmatter_hash` to schema (new field)
3. ✅ Add sync validation (warns but doesn't break)
4. ✅ Consolidate colors (TDS fallback if not loaded)

### Phase 2B: Breaking Changes (Announce + Migrate)
1. ⚠️ Run category→lifecycle migration
2. ⚠️ Require TDS for colors (no fallback)
3. ⚠️ Reject invalid types (was: silent default)

### Rollback Plan
- Keep archived code for 30 days
- Document migration steps
- Provide `tdocs doctor --migrate-v2` tool

---

## Success Criteria

- [ ] All docs have lifecycle (no category field)
- [ ] Frontmatter hash in all metadata files
- [ ] `tdocs doctor` detects out-of-sync docs
- [ ] No hardcoded ANSI codes (TDS only)
- [ ] `tdoc_resolve_type()` exists and validates
- [ ] Invalid types rejected with helpful error
- [ ] All tests pass
- [ ] Documentation updated

---

## Estimated Timeline

| Task | Hours | Risk |
|------|-------|------|
| Category→lifecycle migration | 1.5 | Low |
| Frontmatter sync validation | 2.0 | Medium |
| Color consolidation | 1.0 | Low |
| Type constants/validation | 0.5 | Low |
| Testing & documentation | 1.0 | Low |
| **Total** | **6.0** | **Medium** |

---

## Dependencies

- Phase 1 complete ✅
- TDS module loaded
- No pending PRs on tdocs

---

## Questions to Resolve

1. **Lifecycle default**: Should new docs default to `W` (working)?
2. **Migration timing**: Run migration automatically or require manual trigger?
3. **TDS requirement**: Hard fail if TDS not loaded, or graceful degradation?
4. **Type strictness**: Reject unknown types or allow with warning?

---

## Ready to Start Phase 2?

All Phase 1 work is complete. Phase 2 is planned and scoped.

**Next command**: Confirm approach, then begin with Phase 2A (non-breaking changes first).
