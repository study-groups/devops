# Test Tree-Based TAB Completion 🎯

## Quick Test Commands

### Test Org REPL

```bash
# Start org REPL
source ~/tetra/tetra.sh
tmod load org
org repl
```

**Try these:**
```
org> l<TAB>           # Should complete to "list"
org> sw<TAB>          # Should complete to "switch"
org> switch <TAB>     # Should show org names (pixeljam, devops, etc.)
org> im<TAB>          # Should complete to "import"
org> import <TAB>     # Should show: nh, json, env
org> import nh <TAB>  # Should show NodeHolder directories
```

### Test Tdocs REPL

```bash
# Start tdocs REPL
source ~/tetra/tetra.sh
tmod load tdocs
tdocs browse
```

**Try these:**
```
tdocs> v<TAB>         # Should complete to "view"
tdocs> ls <TAB>       # Should show document names from DB
tdocs> --<TAB>        # Should show flags: --core, --other, --module
tdocs> init --<TAB>   # Should show init-specific flags
```

## What Should Happen

✅ **Before** (static):
- TAB always showed first alphabetic match ("ls")
- Same completions regardless of context
- No dynamic values

✅ **After** (tree-based):
- TAB shows contextually appropriate completions
- Dynamic values (org names, file names, etc.)
- Cycles through multiple matches
- Matches CLI behavior exactly

## Debug Mode

If something seems wrong:

```bash
export REPL_TREE_DEBUG=1
org repl

org> switch <TAB>
# You'll see debug output:
[TREE] input='switch ' cursor=7
[TREE] current_word=''
[TREE] tree_path='help.org.switch'
```

## Expected Behavior

### Org REPL
- **Base level**: list, switch, create, import, discover, validate, etc.
- **switch <TAB>**: Actual org names from `TETRA_DIR/orgs/`
- **import <TAB>**: nh, json, env (subcommands)
- **import nh <TAB>**: NH directory names from `../nh/`

### Tdocs REPL
- **Base level**: ls, view, search, init, discover, tag, etc.
- **Flags**: --core, --other, --module, --preview, --tags
- **Dynamic**: Module names and document names from database

## If It Doesn't Work

### Check 1: Syntax
```bash
bash -n bash/repl/tree_completion.sh
bash -n bash/org/org_repl.sh
bash -n bash/tdocs/tdocs_repl.sh
```

All should pass ✓

### Check 2: Tree Exists
```bash
source ~/tetra/tetra.sh
tmod load org
tree_exists "help.org" && echo "✓ Tree exists" || echo "✗ Tree missing"
```

### Check 3: Functions Loaded
```bash
declare -f repl_tree_complete | head -3
declare -f repl_register_tree_completion | head -3
```

Should show function definitions.

## Success Criteria

✅ Enter key works (from previous fix)
✅ TAB cycles through completions
✅ Completions are contextual (change based on command)
✅ Dynamic values appear (org names, file names, etc.)
✅ Matches CLI mode behavior

## Report Results

Try the test commands above and let me know:
1. Which tests pass ✅
2. Which tests fail ✗
3. What you see when they fail

**Happy testing!** 🚀
