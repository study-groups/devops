# .tdocs Metadata Design

## Core Concept: Content-Addressable Documentation

Files are tracked by **content hash**, not path. This enables:
1. **Move/rename detection** - Same content = same doc, even if path changes
2. **Separate annotations** - Metadata stored in .tdocs, source files untouched
3. **History tracking** - See where files have been
4. **Conflict resolution** - Multiple files with same content? Show user.

## File Structure

```
.tdocs/
├── db/                          # Metadata by hash (content-addressed)
│   ├── abc123.meta              # Metadata for file with hash abc123
│   ├── abc123.tags              # Tags (for grep performance)
│   └── abc123.notes             # User annotations (optional)
├── index.json                   # Content hash → path mapping
├── paths.json                   # Path → hash reverse lookup (fast)
├── config.json                  # Local settings
└── history.log                  # Movement/change log
```

## Hash Scheme: Simple SHA256 Prefix

**Format:** First 12 chars of SHA256 (48 bits = ~281 trillion combos)

```bash
# Full hash
echo "# API Design" | shasum -a 256
# 7a3c8f9e1b2d4a5c6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9

# Short hash (first 12 chars)
# 7a3c8f9e1b2d

# Stored as: .tdocs/db/7a3c8f9e1b2d.meta
```

**Why 12 chars?**
- Git uses 7-12 for short hashes
- 48 bits = collision chance negligible for 1M files
- Human-readable in logs
- Fits in filename nicely

## Metadata File Format: .meta

**Simple YAML-ish format** (easy to read/write with sed/awk):

```yaml
# .tdocs/db/7a3c8f9e1b2d.meta
hash: 7a3c8f9e1b2d
content_hash: 7a3c8f9e1b2d4a5c6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9
current_path: API_DESIGN.md
type: spec
lifecycle: W
tags: api, design, v2
created: 2025-01-15T10:30:00Z
updated: 2025-01-16T14:22:00Z
first_seen: 2025-01-15T10:30:00Z
size: 4523
lines: 142
paths:
  - path: API_DESIGN.md
    seen: 2025-01-16T14:22:00Z
  - path: docs/api/DESIGN.md
    seen: 2025-01-15T10:30:00Z
```

**Why this format?**
- Simple key: value pairs
- Easy to grep: `grep "^type:" .tdocs/db/*.meta`
- Easy to update: `sed -i 's/^lifecycle: W/lifecycle: S/' file.meta`
- Human readable/editable
- Nested paths: list with - prefix

## Annotations File: .notes

**Separate file for user notes** (keeps .meta clean):

```yaml
# .tdocs/db/7a3c8f9e1b2d.notes
hash: 7a3c8f9e1b2d

# User annotations
summary: |
  Spec for v2 API changes. Breaking changes to auth flow.
  Need to coordinate with frontend team.

todo:
  - Review with security team
  - Update client SDK docs
  - Migration guide for v1 users

related:
  - abc456: AUTH_FLOW.md (depends on this)
  - def789: CLIENT_SDK.md (needs update)

links:
  - https://github.com/org/repo/issues/123
  - https://internal-wiki/api-v2-migration

# Section-specific notes (by line range or heading)
sections:
  - heading: "Authentication Changes"
    note: "CRITICAL: This breaks existing clients"
    lines: [45, 67]

  - heading: "Rate Limiting"
    note: "Consider adding per-user quotas"
    lines: [123, 145]
```

## Index File: index.json

**Fast lookups** (hash → path, path → hash):

```json
{
  "version": "1.0",
  "last_scan": "2025-01-16T14:22:00Z",
  "scan_roots": ["."],
  "exclude": ["node_modules", ".git"],

  "by_hash": {
    "7a3c8f9e1b2d": {
      "path": "API_DESIGN.md",
      "updated": "2025-01-16T14:22:00Z",
      "size": 4523
    },
    "abc456def789": {
      "path": "REFACTOR.md",
      "updated": "2025-01-15T10:30:00Z",
      "size": 2341
    }
  },

  "by_path": {
    "API_DESIGN.md": "7a3c8f9e1b2d",
    "REFACTOR.md": "abc456def789"
  }
}
```

## Hash Recognition Algorithms

### Algorithm 1: Full File Hash (Simple)

```bash
# Hash entire file
hash_file() {
    local file="$1"
    shasum -a 256 "$file" | awk '{print substr($1, 1, 12)}'
}

# Pros: Simple, deterministic
# Cons: Any change = new hash (even whitespace)
```

### Algorithm 2: Content Hash (Smart)

```bash
# Hash normalized content (ignore whitespace changes)
hash_content() {
    local file="$1"
    # Remove leading/trailing whitespace, normalize line endings
    sed 's/^[[:space:]]*//; s/[[:space:]]*$//' "$file" | \
        tr -d '\r' | \
        shasum -a 256 | \
        awk '{print substr($1, 1, 12)}'
}

# Pros: Resilient to formatting changes
# Cons: More complex
```

### Algorithm 3: Semantic Hash (Advanced - Phase 2)

```bash
# Hash based on semantic structure (headings + key lines)
hash_semantic() {
    local file="$1"
    # Extract markdown structure
    grep -E '^#{1,6} |^```|^-|\*' "$file" | \
        shasum -a 256 | \
        awk '{print substr($1, 1, 12)}'
}

# Pros: Detects structural changes only
# Cons: Could miss important content edits
```

**Recommendation: Start with Algorithm 1 (simple), add others in Phase 2**

## Metadata Recognition Patterns

### Pattern 1: Exact Match
```bash
# File moved but unchanged
current_hash=$(hash_file "$file")
if [[ -f ".tdocs/db/${current_hash}.meta" ]]; then
    echo "Known file, update path"
    update_path_in_meta "$current_hash" "$file"
fi
```

### Pattern 2: Similarity Match (Fuzzy)
```bash
# File changed slightly - find closest match
similar_files() {
    local file="$1"
    local current_hash=$(hash_file "$file")

    # Check for meta files with similar names or old paths
    for meta in .tdocs/db/*.meta; do
        local old_path=$(grep "^current_path:" "$meta" | cut -d: -f2- | xargs)
        if [[ "$(basename "$old_path")" == "$(basename "$file")" ]]; then
            echo "Possible match: $meta (name similarity)"
        fi
    done
}
```

### Pattern 3: Frontmatter Hash (Hybrid)
```bash
# Hash frontmatter separately for stable identity
hash_frontmatter() {
    local file="$1"
    # Extract YAML frontmatter (between --- markers)
    awk '/^---$/{flag=!flag; next} flag' "$file" | \
        shasum -a 256 | \
        awk '{print substr($1, 1, 12)}'
}

# Store both in .meta:
# content_hash: abc123  (full file)
# fm_hash: def456      (frontmatter only)
```

## Detection Workflow

### Scan Algorithm
```
1. For each *.md file in scan root:

   a. Calculate hash

   b. Check index.json by_hash:
      - If found with different path → FILE MOVED
      - If found with same path → NO CHANGE
      - If not found → NEW FILE

   c. Check index.json by_path:
      - If path exists with different hash → CONTENT CHANGED
      - If path doesn't exist → NEW FILE or MOVED

   d. Action:
      - FILE MOVED: Update path in .meta, log to history
      - CONTENT CHANGED: Update hash, create new .meta, archive old
      - NEW FILE: Create new .meta
      - NO CHANGE: Skip

2. For each .meta file:

   a. Check if current_path still exists:
      - If not → FILE MISSING (might be moved)

   b. If missing, search for similar files:
      - Same basename?
      - Similar content hash?
      - Same frontmatter hash?

   c. If found → FILE MOVED
      If not found → FILE DELETED (archive .meta)
```

## Example: File Lifecycle

### Day 1: Create
```bash
# User creates file
echo "# API Design" > API_DESIGN.md

# Scan
tdocs scan

# Creates:
.tdocs/db/7a3c8f9e1b2d.meta
.tdocs/index.json (updated)
```

### Day 2: Move
```bash
# User reorganizes
mkdir docs/api
mv API_DESIGN.md docs/api/

# Scan
tdocs scan

# Detects:
- Hash 7a3c8f9e1b2d exists in index
- Path API_DESIGN.md missing
- Found docs/api/API_DESIGN.md with same hash
- Action: Update path in .meta, log movement
```

### Day 3: Edit
```bash
# User edits file
echo "New section" >> docs/api/API_DESIGN.md

# Scan
tdocs scan

# Detects:
- Path docs/api/API_DESIGN.md exists
- Hash changed: 7a3c8f9e1b2d → 9f8e7d6c5b4a
- Action: Create new .meta, link to old via supersedes
```

### Day 4: Annotate
```bash
# User adds notes (doesn't touch source file)
tdocs annotate docs/api/API_DESIGN.md

# Creates/updates:
.tdocs/db/9f8e7d6c5b4a.notes
```

## Benefits

1. **Source files stay clean** - No frontmatter pollution
2. **Survives moves** - Hash-based tracking
3. **Rich annotations** - Separate .notes files
4. **History** - See file evolution
5. **Fast lookups** - index.json for O(1) access
6. **Conflict detection** - Multiple files with same hash? Alert user
7. **Integration friendly** - Hash references work in rag evidence

## Implementation Priority

**Phase 1 (MVP):**
- Simple full-file hashing (Algorithm 1)
- Basic .meta format
- index.json with by_hash and by_path
- Move detection

**Phase 2:**
- .notes file support
- Frontmatter hash (hybrid)
- Similarity matching
- Content change tracking

**Phase 3:**
- Semantic hashing
- Conflict resolution UI
- Advanced annotations (section-specific)
- RAG integration with hash references

## RAG Integration Example

```bash
# Add evidence by hash (not path - survives moves!)
rag> e add hash:7a3c8f9e1b2d

# Or by path (resolves to hash)
rag> e add API_DESIGN.md
# Internally: Looks up hash, stores reference

# Evidence file references:
# hash:7a3c8f9e1b2d API_DESIGN.md (v2 API spec)
```

This scheme makes `.tdocs` a robust, content-addressed metadata layer!
