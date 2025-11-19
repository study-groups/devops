# Bash Associative Array Rules for Tetra

## CRITICAL RULE: Always use `-gA` for global associative arrays

### ❌ WRONG - Will cause "syntax error: invalid arithmetic operator"
```bash
declare -A MY_ARRAY=(
    ["key.with.dots"]="value"
)
```

### ✅ CORRECT - Use -gA for global scope
```bash
declare -gA MY_ARRAY=(
    ["key.with.dots"]="value"
)
```

## Why This Matters

When you use `declare -A` without `-g`, the array is **local to the current function/scope**.

If the array contains keys with dots (like `"text.primary"`, `"content.heading.h1"`), and bash tries to access it from outside its scope, it will attempt **arithmetic expansion** and fail with:

```
bash: text.primary: syntax error: invalid arithmetic operator (error token is ".primary")
```

## The `-g` Flag

- `-g` = **global scope**
- Without `-g`, arrays are local to the function/script where declared
- With `-g`, arrays are accessible from any scope (parent, child, subshells)

## When to Use `-gA`

Use `-gA` for:
- ✅ Module-level configuration (TSM_*, TDS_*, TETRA_*)
- ✅ Color/theme mappings
- ✅ Service registries
- ✅ Token mappings
- ✅ ANY array that will be accessed from multiple functions/scopes

Use `-A` (local) for:
- Function-local temporary maps
- Parser state within a single function
- Short-lived data structures

## Pattern to Search For

Find all potentially broken arrays:
```bash
grep -r "^declare -A[^g]" bash/
```

## Auto-Fix Command

```bash
# Fix specific patterns
sed -i 's/^declare -A TSM_/declare -gA TSM_/g' file.sh
sed -i 's/^declare -A TDS_/declare -gA TDS_/g' file.sh
sed -i 's/^declare -A TETRA_/declare -gA TETRA_/g' file.sh
```

## Files Already Fixed

- ✅ `tds/tokens/color_tokens.sh` - TDS_COLOR_TOKENS
- ✅ `tds/tokens/repl_tokens.sh` - TDS_REPL_TOKENS
- ✅ `tds/tokens/unicode_explorer_tokens.sh` - TDS_UNICODE_TOKENS
- ✅ `color/color_*.sh` - All color system arrays
- ✅ `tsm/services/registry.sh` - TSM_*_PORTS, TSM_SERVICE_*
- ✅ `tsm/system/*.sh` - TSM monitoring arrays
- ✅ `utils/unified_log.sh` - TETRA_LOG_LEVEL_PRIORITY
- ✅ `repl/*.sh` - REPL_* arrays
- ✅ `ulm/ulm.sh` - ULM_* arrays
- ✅ `vox/vox_tui.sh` - VOX_* arrays
- ✅ `span/multispan.sh` - SPAN_STORAGE_* arrays

## Example Error Case

```bash
# File: tokens/color_tokens.sh
declare -A TDS_COLOR_TOKENS=(  # ❌ Missing -g
    ["text.primary"]="mode:7"
)

# Later, in another function:
tds_resolve_color() {
    local token="$1"
    local ref="${TDS_COLOR_TOKENS[$token]}"  # ❌ Fails! Array not in scope
    # Error: text.primary: syntax error: invalid arithmetic operator
}
```

## Fixed Version

```bash
# File: tokens/color_tokens.sh
declare -gA TDS_COLOR_TOKENS=(  # ✅ Global scope
    ["text.primary"]="mode:7"
)

# Later, in another function:
tds_resolve_color() {
    local token="$1"
    local ref="${TDS_COLOR_TOKENS[$token]}"  # ✅ Works! Array is global
}
```

## Checklist Before Committing

- [ ] All module-level arrays use `declare -gA`
- [ ] No `declare -A` for arrays accessed across functions
- [ ] Arrays with dotted keys MUST be global
- [ ] Run: `grep "^declare -A[^g]" file.sh` to verify

## Remember

**"When in doubt, use `-gA`"**

The performance difference is negligible, but the debugging pain is severe.
