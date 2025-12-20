# TSM Contributing Guide

## Bash Version Requirement

TSM requires **bash 5.2+**. Use modern bash features freely:
- `declare -n` (namerefs)
- `[[ -v variable ]]` (variable existence check)
- `readarray` / `mapfile`
- Associative arrays

## Coding Standards

### IFS Safety (CRITICAL)

IFS manipulation is the #1 source of subtle bugs. Follow these rules:

#### Never use these patterns:

```bash
# BAD: unset IFS corrupts state for subsequent code
IFS=$'\n' arr=($(cmd)); unset IFS

# BAD: IFS_OLD pattern fails when IFS is unset
local IFS_OLD="$IFS"
IFS=$'\n'
# ...code...
IFS="$IFS_OLD"  # Sets IFS to "" if it was unset!

# BAD: Word splitting depends on IFS
arr=($(some_command))

# BAD: for loops with command substitution
for item in $(seq 1 10); do
```

#### Always use these patterns:

```bash
# GOOD: readarray is IFS-independent
readarray -t arr < <(some_command)

# GOOD: while read is IFS-independent
while IFS= read -r line; do
    # ...
done < <(some_command)

# GOOD: IFS scoped to single command only
while IFS='|' read -r a b c; do
    # ...
done <<< "$data"

# GOOD: C-style for loop (no word splitting)
for ((i = 0; i < 10; i++)); do

# GOOD: Iterate array elements directly
for item in "${arr[@]}"; do
```

### Array Creation

```bash
# BAD
files=($(find . -name "*.sh"))
pids=($(lsof -ti :8000))
sorted=($(printf '%s\n' "${arr[@]}" | sort))

# GOOD
readarray -t files < <(find . -name "*.sh")
readarray -t pids < <(lsof -ti :8000)
readarray -t sorted < <(printf '%s\n' "${arr[@]}" | sort)
```

### Function Design

```bash
# Use local variables
my_function() {
    local input="$1"
    local result=""
    # ...
}

# Return values via stdout, not global variables
get_port() {
    echo "8080"
}
port=$(get_port)

# Use return codes for success/failure
check_port() {
    lsof -i ":$1" &>/dev/null
}
if check_port 8080; then
    echo "Port in use"
fi
```

### Error Handling

```bash
# Always quote variables
echo "$variable"
cmd "$path_with_spaces"

# Use [[ ]] not [ ]
if [[ -f "$file" ]]; then

# Check command existence
if command -v lsof &>/dev/null; then

# Handle errors explicitly
if ! some_command; then
    echo "Error: command failed" >&2
    return 1
fi
```

### Module Structure

TSM follows a layered architecture:

```
tsm/
├── core/           # Foundation (no external deps)
│   ├── config.sh       # Configuration loading
│   ├── runtime.sh      # Runtime directories/state
│   ├── utils.sh        # Utility functions
│   └── port_resolution.sh
├── process/        # Process management
│   ├── lifecycle.sh    # Start/stop/kill
│   ├── management.sh   # High-level operations
│   └── inspection.sh   # Status/info queries
├── services/       # Service definitions
│   ├── start.sh        # Service start logic
│   └── definitions.sh  # Service lookup
├── system/         # System diagnostics
│   └── doctor/         # Health checks
└── tests/          # Test suites
    ├── unit/
    └── integration/
```

**Dependencies flow downward only:**
- `services/` can depend on `process/` and `core/`
- `process/` can depend on `core/`
- `core/` has no internal dependencies

### Naming Conventions

```bash
# Public functions: tetra_tsm_* or tsm_*
tetra_tsm_start
tsm_port_available

# Private/internal functions: _tsm_*
_tsm_find_service
_tsm_parse_service_ref

# Constants: UPPERCASE
TSM_PORT_RANGE_START=8000
TSM_DIR="$TETRA_DIR/tsm"

# Local variables: lowercase_snake_case
local process_name="$1"
local start_time
```

### Testing

Run tests before committing:

```bash
# All tests
bash tests/run_all.sh

# Unit tests only (faster)
bash tests/run_all.sh --unit-only

# Skip shellcheck
bash tests/run_all.sh --skip-shellcheck
```

Add tests for new functionality in `tests/unit/` or `tests/integration/`.

### Shellcheck

All code must pass shellcheck with severity `warning`:

```bash
shellcheck -S warning -e SC1090,SC1091,SC2034 your_file.sh
```

Excluded rules:
- `SC1090`: Can't follow dynamic source
- `SC1091`: Not following sourced file
- `SC2034`: Variable appears unused (often exported)

### Commits

Follow conventional commits:

```
feat(tsm): Add new service type support
fix(doctor): Handle missing lsof gracefully
refactor(core): Extract port utilities
test(unit): Add IFS safety regression tests
docs(contributing): Add coding standards
```

## Common Pitfalls

1. **Forgetting to quote variables** - Always use `"$var"` not `$var`
2. **Using `[ ]` instead of `[[ ]]`** - `[[ ]]` is safer and more powerful
3. **Relying on IFS for word splitting** - Use explicit parsing instead
4. **Not checking if commands exist** - Use `command -v` before calling
5. **Ignoring return codes** - Check `$?` or use `if cmd; then`
6. **Modifying global state** - Use `local` for all function variables
