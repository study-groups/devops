# {MODULE} Specification

**Version**: 1.0
**Status**: [Specification|Draft]
**Module Level**: [1|2|3|4]
**Date**: YYYY-MM-DD

<!--
INSTRUCTIONS:
- Replace {MODULE} with your module name (uppercase for heading, lowercase in frontmatter)
- Replace {module} with lowercase module name throughout
- Fill in each section below
- Remove sections marked (Optional) if not applicable
- Target length: 10-15KB (~500-700 lines)
- See TUBES_INTEGRATION_EXAMPLE.md for detailed examples
-->

```yaml
---
category: core
type: specification
module: {module}
completeness_level: [1|2|3|4]
status: [stable|evolving|deprecated]
evidence_weight: primary
implements:
  code: [{module}.sh, {module}_core.sh, ...]
  actions: [verb:noun, ...]
integrates:
  requires: [list required modules]
  provides: [capabilities this module provides]
  optional: [soft dependencies]
prereqs: [TAS_SPECIFICATION.md, ...]
---
```

## Overview

Brief description of what this module does and why it exists.

**Purpose**: [1-2 sentences on the problem this solves]

**Key Capabilities**:
- Capability 1
- Capability 2
- Capability 3

**Target Users**: [Who uses this module? Developers, ops, end-users?]

---

## Table of Contents

1. [Architecture](#1-architecture)
2. [Design Decisions](#2-design-decisions)
3. [API / Interface](#3-api--interface)
4. [Action Registry](#4-action-registry)
5. [REPL Integration](#5-repl-integration) (Level 3+)
6. [Transaction Support](#6-transaction-support) (Optional)
7. [Storage Pattern](#7-storage-pattern)
8. [Configuration](#8-configuration)
9. [Dependencies](#9-dependencies)
10. [Examples](#10-examples)
11. [See Also](#11-see-also)

---

## 1. Architecture

### 1.1 Components

Describe the main components of your module:

```
bash/{module}/
├── includes.sh           # Module loader
├── {module}.sh           # Main dispatcher
├── {module}_paths.sh     # TCS 4.0 paths (Level 4)
├── {module}_core.sh      # Business logic (Level 4)
├── actions.sh            # TUI integration (Level 2+)
├── {module}_repl.sh      # REPL (Level 3+)
└── ...
```

**Component Diagram** (optional):
```
User → {module}.sh → {module}_core.sh → External System
         ↓
    actions.sh (TUI)
         ↓
    {module}_repl.sh (Interactive)
```

### 1.2 Data Flow

Describe how data flows through your module:

```
Input → Processing → Output
  ↓         ↓          ↓
[detail]  [detail]  [detail]
```

### 1.3 State Management

How does your module manage state?

- Stateless? Explain why
- Database? Describe pattern (see Section 7)
- In-memory? Describe lifecycle

---

## 2. Design Decisions

Document key architectural choices with rationale.

### Decision 1: [Name of Decision]

**Context**: [What problem were you solving?]

**Decision**: [What did you choose?]

**Rationale**: [Why did you choose this over alternatives?]

**Consequences**: [What are the trade-offs?]

**Alternatives Considered**:
- Alternative A: [Why not chosen]
- Alternative B: [Why not chosen]

### Decision 2: [Name of Decision]

[Repeat pattern above]

### Decision 3: [Name of Decision]

[Repeat pattern above]

---

## 3. API / Interface

### 3.1 Public Functions

Document all public functions (those called by users or other modules):

#### `{module}_function_name()`

**Purpose**: [Brief description]

**Arguments**:
- `$1` - arg_name (type): Description
- `$2` - arg_name (type): Description

**Returns**: [What does it return? Exit code? Output?]

**Example**:
```bash
{module}_function_name "value1" "value2"
```

**Side Effects**:
- Creates files in $MOD_DIR/...
- Modifies state...

#### `{module}_another_function()`

[Repeat pattern above for each public function]

### 3.2 CLI Interface (if applicable)

```bash
{module} <subcommand> [arguments]

COMMANDS:
  create       Create new resource
  list         List all resources
  delete       Delete resource
  help         Show help

EXAMPLES:
  {module} create myresource
  {module} list
```

---

## 4. Action Registry

### 4.1 TAS Integration

Following TAS_SPECIFICATION.md, this module provides verb:noun actions:

**Environment × Mode Matrix**:

| Environment | Mode | Actions |
|-------------|------|---------|
| Local | Inspect | view:{resource}, list:{resources} |
| Local | Execute | create:{resource}, delete:{resource} |
| Dev | Execute | deploy:{service}, restart:{service} |
| ... | ... | ... |

### 4.2 Action Implementations

Actions are defined in `actions.sh`:

```bash
{module}_action_verb_noun() {
    local arg1="$1"
    local arg2="$2"

    # Log start
    tetra_log_info "{module}" "verb" "compact" "jsonl" "$arg1"

    # Execute core function
    if {module}_core_function "$arg1" "$arg2"; then
        tetra_log_success "{module}" "verb" "compact" "jsonl" "$arg1"
        return 0
    else
        tetra_log_error "{module}" "verb" "compact" "jsonl" "$arg1"
        return 1
    fi
}
```

### 4.3 Action Registration

[Explain how actions are registered, if applicable]

---

## 5. REPL Integration

**(Level 3+ only - skip this section for Level 1-2 modules)**

### 5.1 REPL Commands

Interactive commands available in `{module}_repl`:

| Command | Description | Example |
|---------|-------------|---------|
| create <name> | Create resource | `create myresource` |
| list | List all | `list` |
| /help | Show help | `/help` |

### 5.2 REPL Handler

From `{module}_repl.sh`:

```bash
{module}_repl_handler() {
    local input="$1"

    case "$input" in
        create*)
            {module}_repl_create ${input#create }
            ;;
        list)
            {module} list
            ;;
        *)
            echo "Unknown command: $input"
            return 1
            ;;
    esac
}
```

### 5.3 Slash Commands

Registered slash commands:

```bash
repl_register_slash_command "/{module}" {module}_repl
repl_register_slash_command "/{command}" {module}_command
```

---

## 6. Transaction Support

**(Optional - only if module uses TTS)**

### 6.1 Transaction Usage

This module uses TTS for:
- Multi-step operation X
- Complex workflow Y

### 6.2 FSM Stages

```
NEW → SELECT → ASSEMBLE → EXECUTE → VALIDATE → DONE
                                                ↘ FAIL
```

**Stage Descriptions**:
- **SELECT**: [What happens in this stage]
- **ASSEMBLE**: [What happens in this stage]
- **EXECUTE**: [What happens in this stage]
- **VALIDATE**: [What happens in this stage]

### 6.3 Transaction Storage

```
$MOD_DIR/txns/{txn-id}/
├── state.json        # Current FSM state
├── events.ndjson     # Audit log
├── ctx/              # Evidence files
└── artifacts/        # Outputs
```

---

## 7. Storage Pattern

### 7.1 Database Structure

Describe your module's database/storage pattern:

**Level 1-2**: Simple files or no storage
**Level 3**: Basic database
**Level 4**: TCS 4.0 timestamped database

```
$MOD_DIR/
├── db/                      # Primary database
│   ├── {timestamp}.json    # Timestamped entries
│   └── ...
├── config/                  # Configuration
│   └── settings.conf
├── cache/                   # Temporary data
└── logs/                    # Module logs
```

### 7.2 Data Format

**Metadata Entry** ({timestamp}.json):
```json
{
  "timestamp": 1699027845,
  "resource_id": "example",
  "type": "resource_type",
  "status": "active",
  "created": "2025-11-03T10:30:45Z",
  "updated": "2025-11-03T10:30:45Z",
  "metadata": {
    "key": "value"
  }
}
```

### 7.3 Database Operations

```bash
# Create
{module}_db_create() {
    local timestamp=$(date +%s)
    echo "$json" > "$MOD_DIR/db/${timestamp}.json"
}

# Read
{module}_db_get() {
    local timestamp="$1"
    cat "$MOD_DIR/db/${timestamp}.json"
}

# List
{module}_db_list() {
    for file in "$MOD_DIR/db"/*.json; do
        cat "$file"
    done
}
```

---

## 8. Configuration

### 8.1 Configuration Files

**Location**: `$MOD_DIR/config/`

**Files**:
- `settings.conf` - Main configuration
- `profiles/*.conf` - Profile-specific configs

**Format**: [Bash, TOML, JSON, YAML?]

### 8.2 Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| OPTION_NAME | string | "value" | What it controls |
| OPTION_NUM | integer | 10 | What it controls |

### 8.3 Configuration Loading

```bash
{module}_load_config() {
    local config_file="$MOD_DIR/config/settings.conf"

    if [[ -f "$config_file" ]]; then
        source "$config_file"
    fi
}
```

---

## 9. Dependencies

### 9.1 Required Dependencies

**Hard Dependencies** (module won't work without these):
- `utils` - Core utilities
- `logging` - Unified logging
- [other required modules]

### 9.2 Optional Dependencies

**Soft Dependencies** (features enhanced if available):
- `tds` - Color rendering
- `tsm` - Service management
- [other optional modules]

### 9.3 External Dependencies

**System Requirements**:
- Bash 5.2+
- [external tools: jq, curl, etc.]

### 9.4 Integration Points

**This module provides to**:
- Module A: Capability X
- Module B: Capability Y

**This module requires from**:
- Module C: Capability Z

---

## 10. Examples

### 10.1 Basic Usage

```bash
# Initialize module
source $TETRA_SRC/bash/{module}/includes.sh

# Basic operation
{module} create example "Example resource"

# List resources
{module} list

# View details
{module} view example
```

### 10.2 Advanced Usage

```bash
# Complex operation
{module} operation --option value

# Pipeline usage
{module} list | grep pattern | {module} process

# Integration with other modules
rag query "topic" | {module} process
```

### 10.3 Common Patterns

#### Pattern 1: [Name]
```bash
# Use case description
{module} command1
{module} command2
```

#### Pattern 2: [Name]
```bash
# Use case description
{module} command3 | command4
```

---

## 11. See Also

### Related Specifications
- **MODULE_SYSTEM_SPECIFICATION.md** - Module system architecture
- **TAS_SPECIFICATION.md** - Action system (if using actions)
- **TRS_SPECIFICATION.md** - REPL system (if Level 3+)
- **TTS_TETRA_TRANSACTION_STANDARD.md** - Transactions (if applicable)
- **TCS_4.0_LOGGING_STANDARD.md** - Logging patterns

### Module Documentation
- **README.md** - User guide and quickstart
- **{MODULE}_GUIDE.md** - Detailed how-to guides
- **{MODULE}_REFERENCE.md** - Quick reference

### Examples
- **TUBES_INTEGRATION_EXAMPLE.md** - Complete integration example
- **bash/tubes/** - Gold standard Level 4 module
- **bash/org/** - Level 3 example
- **bash/tsm/TSM_SPECIFICATION.md** - Another module spec

### Tools
- **bash/utils/audit_modules.sh** - Check module completeness
- **tdocs module {module}** - View all docs for this module
- **tdocs spec {module}** - View this specification

---

## Appendix: Specification Checklist

Use this checklist when creating a module specification:

**Required Sections** (all modules):
- [ ] Frontmatter with metadata
- [ ] Overview with purpose and capabilities
- [ ] Architecture section
- [ ] Design Decisions (at least 2-3)
- [ ] API / Interface documentation
- [ ] Storage Pattern
- [ ] Dependencies
- [ ] Examples
- [ ] See Also references

**Level 2+ Requirements**:
- [ ] Action Registry section (TAS integration)
- [ ] Configuration section

**Level 3+ Requirements**:
- [ ] REPL Integration section
- [ ] Interactive command documentation

**Level 4 Requirements**:
- [ ] Complete examples with tests
- [ ] Database pattern documentation
- [ ] Path functions documentation
- [ ] Integration examples

**Quality Checks**:
- [ ] No TODO markers in final version
- [ ] All code examples tested
- [ ] Links to other specs verified
- [ ] Consistent with MODULE_COMPLETENESS_CRITERIA.md
- [ ] Size: 10-15KB (~500-700 lines)

---

## Notes for Authors

### Writing Style

- **Be concise** - Target 500-700 lines total
- **Be specific** - Show actual code, not pseudocode
- **Be consistent** - Follow existing spec patterns (TAS, TRS, etc.)
- **Be current** - Reference actual file paths and functions

### Common Mistakes to Avoid

1. **Too much detail** - Don't document every internal function, focus on public API
2. **Out of date** - Keep spec in sync with code
3. **Missing rationale** - Always explain "why", not just "what"
4. **No examples** - Every section needs concrete examples
5. **Broken links** - Verify all See Also references

### When to Update

Update the specification when:
- Major architectural changes
- New public APIs added
- Design decisions change
- Integration points change
- Breaking changes introduced

Minor bug fixes and internal refactoring don't require spec updates.

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | YYYY-MM-DD | [Name] | Initial specification |

<!-- Future versions: -->
<!-- | 1.1 | YYYY-MM-DD | [Name] | Added feature X | -->
