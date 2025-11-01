# TDOCS Tab Completion Guide

## Overview

The tdocs module provides intelligent tab completion in two contexts:
1. **Shell completion** - for the `tdocs` command in your shell
2. **REPL completion** - for interactive commands within the `tdocs repl`

## Shell Completion

### Usage

After loading the tdocs module, tab completion works automatically:

```bash
source ~/tetra/tetra.sh
tmod load tdocs

# Now try tab completion
tdocs <TAB>                    # Shows all available commands
tdocs init <TAB>               # Shows markdown files in current directory
tdocs init --<TAB>             # Shows available flags
tdocs ls --module <TAB>        # Shows available modules
```

### Available Completions

#### Commands
- `init` - Initialize document
- `view` - View document
- `tag` - Tag document
- `ls` - List documents
- `discover` - Discover new documents
- `search` - Search documents
- `evidence` - Get evidence for query
- `audit` - Audit documents
- `index` - Manage indexes
- `chuck` - Manage chuck documents
- `browse` / `repl` - Launch REPL
- `help` - Show help

#### Options by Command

**init**
- `--core` - Mark as core document
- `--other` - Mark as other document
- `--type` - Set type (auto-completes: spec, guide, reference, bug-fix, etc.)
- `--tags` - Add tags
- `--module` - Set module (auto-completes from existing modules)

**ls**
- `--core` - Show only core documents
- `--other` - Show only other documents
- `--module` - Filter by module (auto-completes)
- `--preview` - Show preview

**view**
- `--pager` - Use pager
- `--meta-only` - Show metadata only
- `--raw` - Show raw file

**discover**
- `--auto-init` - Auto-initialize discovered docs
- `--rebuild` - Rebuild index

**index**
- `--rebuild` - Rebuild index
- `--status` - Show index status

### Dynamic Completions

The shell completion intelligently completes:
- **Module names** - Extracted from existing document metadata
- **Document paths** - Shows paths to documents in the database
- **File paths** - Standard file completion for init/view commands

## REPL Completion

### Usage

Launch the REPL and use TAB to complete commands:

```bash
tdocs repl

# Inside REPL
ls <TAB>                       # Shows available options and documents
filter <TAB>                   # Shows: core, other, module, clear
filter module <TAB>            # Shows available modules
view <TAB>                     # Shows available documents
init --type <TAB>              # Shows document types
```

### Features

1. **Context-aware completion**
   - Completes based on current command and position
   - Shows relevant options for each context

2. **Interactive display**
   - Shows all available options with descriptions
   - Automatically completes when only one match

3. **Hierarchical navigation**
   - Tab through categories, modules, and documents
   - Build complex filters step-by-step

### Example Session

```bash
tdocs repl

[all x all x 0] docs ▶ <TAB>
Available options:
  ls                    List documents
  view                  View document
  search                Search documents
  filter                Set filters
  ...

[all x all x 0] docs ▶ filter <TAB>
Available options:
  core                  Show only core documents
  other                 Show only other documents
  module                Filter by module
  clear                 Clear all filters

[all x all x 0] docs ▶ filter module <TAB>
Available options:
  rag                   Module
  tdocs                 Module
  tree                  Module
  ...

[all x rag x 5] docs ▶ view <TAB>
Available options:
  REPL_FIXES.md         Document
  RAG_EVIDENCE.md       Document
  ...
```

## Document Context State

The REPL maintains state that affects completions:

### Filter State
```bash
filter core              # Now only completes core documents
filter module rag        # Now only completes rag module documents
filter clear             # Reset to all documents
```

### Context Navigation

Tab completion respects your current filter context:
- When `TDOCS_REPL_CATEGORY` is set (core/other), only those docs complete
- When `TDOCS_REPL_MODULE` is set, only that module's docs complete
- The prompt shows current context: `[category x module x count]`

## Implementation Details

### Files

1. **tdocs_completion.sh** - Shell command completion
   - Registered with bash's `complete` system
   - Works with `tdocs` command in any shell

2. **tdocs_repl_complete.sh** - REPL completion
   - Uses readline `bind -x` to bind TAB key
   - Context-aware completion based on input state

### Functions

**Shell Completion**
- `_tdocs_complete()` - Main completion function
- `_tdocs_shell_get_modules()` - Get available modules
- `_tdocs_shell_get_docs()` - Get available documents

**REPL Completion**
- `_tdocs_repl_complete()` - Main REPL completion (bound to TAB)
- `_tdocs_context_complete()` - Hierarchical context navigation
- `tdocs_repl_enable_completion()` - Enable in REPL
- `tdocs_repl_disable_completion()` - Disable on exit

### Readline Configuration

The REPL sets these readline options:
```bash
bind 'set completion-ignore-case on'      # Case-insensitive
bind 'set show-all-if-ambiguous on'       # Show all matches
bind 'set completion-query-items 200'     # Don't paginate small lists
bind 'set page-completions off'           # Custom display
```

## Advanced Usage

### Custom Completion Functions

You can extend completion by adding custom functions:

```bash
# Add to your shell init
_tdocs_custom_complete() {
    # Your custom completion logic
    echo "custom-option-1 custom-option-2"
}

# Hook into completion
# (modify _tdocs_repl_complete to call your function)
```

### Debugging

Enable completion debugging:
```bash
# See what completion function returns
set -x
tdocs ls --<TAB>
set +x

# Check if completion is registered
complete -p tdocs

# Test REPL completion function directly
_tdocs_get_modules
_tdocs_get_categories
```

## Comparison with Other Modules

tdocs completion follows the same patterns as:
- **org** - Uses tree-based completion
- **tsm** - Uses command registry completion
- **rag** - Uses dynamic completion

Key difference: tdocs REPL uses **bind -x** for TAB binding instead of bash's built-in completion, allowing more control over the display and interaction.

## Troubleshooting

### Completion not working in shell

1. Verify tdocs is loaded:
   ```bash
   declare -F tdocs >/dev/null && echo "loaded" || echo "not loaded"
   ```

2. Check completion is registered:
   ```bash
   complete -p tdocs
   # Should show: complete -F _tdocs_complete tdocs
   ```

3. Reload completion:
   ```bash
   source $TDOCS_SRC/tdocs_completion.sh
   ```

### Completion not working in REPL

1. Check if completion is enabled:
   ```bash
   # Inside REPL, press TAB - should show options
   ```

2. Verify bind settings:
   ```bash
   bind -P | grep '\\t'
   # Should show TAB bound to _tdocs_repl_complete
   ```

3. Re-enable completion:
   ```bash
   tdocs_repl_enable_completion
   ```

### No modules/documents showing

1. Check if database exists:
   ```bash
   ls -la $TDOCS_DIR/db/
   ```

2. Initialize database:
   ```bash
   tdocs discover --auto-init
   ```

3. Verify metadata:
   ```bash
   find $TDOCS_DIR/db -name "*.meta" | head -1 | xargs cat
   ```

## Future Enhancements

Possible improvements:
- [ ] Fuzzy matching for completions
- [ ] Recent command history completion
- [ ] Smart completion based on document content
- [ ] Tag-based completion (auto-complete tags as you type)
- [ ] Cross-module completion (complete based on module dependencies)
- [ ] Custom completion plugins

## See Also

- [bash/tree/complete.sh](../tree/complete.sh) - Tree-based completion system
- [bash/org/org_completion.sh](../org/org_completion.sh) - Organization completion
- [bash/repl/action_completion.sh](../repl/action_completion.sh) - REPL action completion
