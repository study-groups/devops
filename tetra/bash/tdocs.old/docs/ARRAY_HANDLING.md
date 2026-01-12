# Tetra Array Handling Guide

## The Problem: Associative Arrays and Subshells

In Bash 5.2 on macOS, **associative arrays CANNOT cross subshell boundaries**, regardless of how they're declared.

### What Doesn't Work
```bash
# These DO NOT work for subshells:
declare -A MY_ARRAY=(...)      # Local to function
declare -gA MY_ARRAY=(...)     # Global in current shell only
export -A MY_ARRAY             # SYNTAX ERROR - can't export arrays
```

### Shell Boundaries
- **Same shell**: Functions in the same shell session can share arrays
- **Subshell**: Any `$(...)`, `|`, or background `&` creates a new process
- **Export**: Only simple variables can be exported, not arrays

## The Tetra Pattern

Tetra uses **delimited strings** for data that needs to cross subshell boundaries.

### Pattern: Delimited Strings

See `bash/utils/module_state.sh` for the canonical example:

```bash
# Storage: Regular string variable (can be exported)
TETRA_FUNCTION_STATE=""

# Format: pipe-delimited with newline separators
# module|function|status|timestamp
# rag|rag_search|loaded|1699123456
# tdocs|tdocs_ls_docs|loaded|1699123457

# Set value (escape delimiters)
tetra_set_function_state() {
    local module="$1"
    local function_name="$2"
    local status="$3"

    # Escape pipe characters in data
    module="${module//|/__PIPE__}"
    function_name="${function_name//|/__PIPE__}"
    status="${status//|/__PIPE__}"

    # Build entry
    local entry="${module}|${function_name}|${status}|$(date +%s)"

    # Append to state string
    if [[ -z "$TETRA_FUNCTION_STATE" ]]; then
        TETRA_FUNCTION_STATE="$entry"
    else
        TETRA_FUNCTION_STATE="${TETRA_FUNCTION_STATE}"$'\n'"${entry}"
    fi
}

# Get value (parse and unescape)
tetra_get_function_state() {
    local module="$1"
    local function_name="$2"
    local escaped_module="${module//|/__PIPE__}"
    local escaped_function="${function_name//|/__PIPE__}"

    local IFS_OLD="$IFS"
    IFS=$'\n'

    for entry in $TETRA_FUNCTION_STATE; do
        local entry_module="${entry%%|*}"
        local rest="${entry#*|}"
        local entry_function="${rest%%|*}"
        local rest2="${rest#*|}"
        local entry_status="${rest2%%|*}"

        if [[ "$entry_module" == "$escaped_module" &&
              "$entry_function" == "$escaped_function" ]]; then
            IFS="$IFS_OLD"
            echo "${entry_status//__PIPE__/|}"  # Unescape
            return 0
        fi
    done

    IFS="$IFS_OLD"
    return 1
}
```

### Key Points
1. **Use regular string variables** - Can be exported with `export VARIABLE_NAME`
2. **Delimiter**: Use `|` for fields, `\n` for records
3. **Escape delimiters**: Replace `|` with `__PIPE__` in data
4. **Parse on read**: Split by delimiter, unescape when retrieving
5. **Export when needed**: `export TETRA_FUNCTION_STATE` for subshells

## Decision Matrix

### Use Associative Arrays (`declare -gA`) When:
- ✅ Data stays in **same shell** (REPL, single process)
- ✅ Need **fast lookups** by key
- ✅ Complex nested data structures
- ✅ No subshells or background processes

**Example**: TDS color tokens in REPL session
```bash
declare -gA TDS_COLOR_TOKENS=(
    [text.primary]="mode:7"
    [text.secondary]="mode:6"
)
```

### Use Delimited Strings When:
- ✅ Data crosses **subshells** (`$(...)`, `|`, `&`)
- ✅ Need to **export** to child processes
- ✅ Persistence across process boundaries
- ✅ Serialization to files/environment

**Example**: Module state that needs to persist
```bash
export TETRA_MODULE_STATE="tdocs|loaded|1699123456"
```

### Use JSON/TOML When:
- ✅ Complex nested structures
- ✅ Persistent storage (files)
- ✅ Human-readable config
- ✅ Inter-process communication

**Example**: Module configuration
```toml
[module]
name = "tdocs"
status = "loaded"
```

## Common Patterns in Tetra

### 1. REPL Session State (Same Shell)
```bash
# Use associative arrays - fast, no subshells
declare -gA TDOCS_PALETTE_ASSIGNMENTS=(
    [type]="nouns"
    [intent]="verbs"
)
```

### 2. Module Registry (Crosses Processes)
```bash
# Use delimited strings - can export
TETRA_MODULE_STATE=""
export TETRA_MODULE_STATE

tetra_register_module() {
    local entry="$1|loaded|$(date +%s)"
    TETRA_MODULE_STATE="${TETRA_MODULE_STATE:+$TETRA_MODULE_STATE$'\n'}$entry"
}
```

### 3. Config Files (Persistent)
```bash
# Use TOML/JSON - structured, human-readable
source "$TETRA_SRC/bash/utils/toml_parser.sh"
toml_parse "config.toml"
```

## Debugging Array Issues

### Check if array is accessible:
```bash
# In function
if [[ -v "MY_ARRAY[key]" ]]; then
    echo "Key exists: ${MY_ARRAY[key]}"
else
    echo "Key not found or array not accessible"
fi
```

### Check if you're in a subshell:
```bash
echo "Current BASHPID: $BASHPID"
echo "Parent shell PID: $$"
# If different, you're in a subshell
```

### Common mistakes:
```bash
# WRONG - array lost in subshell
cat file | while read line; do
    MY_ARRAY[$line]="value"  # Lost when pipe ends!
done

# RIGHT - process substitution (no subshell)
while read line; do
    MY_ARRAY[$line]="value"
done < file

# WRONG - array not exported
export MY_ARRAY  # Syntax error!

# RIGHT - convert to delimited string
MY_DATA=""
for key in "${!MY_ARRAY[@]}"; do
    MY_DATA+="$key|${MY_ARRAY[$key]}"$'\n'
done
export MY_DATA
```

## Summary

| Feature | Associative Array | Delimited String | JSON/TOML |
|---------|------------------|------------------|-----------|
| Same shell | ✅ Fast | ⚠️ Slower | ⚠️ Slowest |
| Subshells | ❌ No | ✅ Yes | ✅ Yes |
| Export | ❌ No | ✅ Yes | ✅ Yes (as string) |
| Lookup speed | ✅ O(1) | ⚠️ O(n) | ⚠️ O(n) |
| Complexity | ✅ High | ⚠️ Medium | ✅ High |
| Human-readable | ❌ No | ⚠️ Sort of | ✅ Yes |
| Persistence | ❌ No | ⚠️ Manual | ✅ Built-in |

**Tetra Convention:**
- REPL/single-process → `declare -gA`
- Cross-process/export → Delimited strings
- Config/persistence → TOML/JSON
