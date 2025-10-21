# Help System Refactor Summary

**Date:** 2025-10-17
**Changes:** Refactored `/help` to be concise, renamed `/prompt` to `/cli`

---

## Changes Made

### 1. Concise `/help` Command

The `/help` command now shows only broad categories:

```
🔧 RAG Tools REPL

Categories:
  /flow        - Manage RAG flows (create, status, list)
  /evidence    - Add & manage evidence files
  /mc, /ms, /mi - MULTICAT operations
  /cli         - CLI prompt modes & settings
  /history     - REPL command history

Quick Reference:
  /help <topic>  - Detailed help (topics: flow, evidence, cli)
  /status        - Show system status
  /exit          - Exit REPL

Shell commands (no /) run directly. TAB for completion.
```

### 2. Topic-Specific Help

Detailed help is now accessed via topics:

```bash
/help flow      # Shows detailed flow command help
/help evidence  # Shows detailed evidence command help
/help cli       # Shows CLI prompt mode help
```

### 3. Renamed `/prompt` to `/cli`

To avoid confusion with RAG prompts (which we'll define separately):

**Before:**
```bash
/prompt                # Show current mode
/prompt minimal        # Set minimal mode
/prompt toggle         # Toggle modes
```

**After:**
```bash
/cli                   # Show current CLI prompt mode
/cli minimal           # Set minimal mode
/cli toggle            # Toggle modes
```

**Backwards Compatibility:** `/prompt` still works as an alias to `/cli`

---

## Rationale

### Why Rename to `/cli`?

1. **Clarity:** "CLI" clearly refers to the command-line interface prompt
2. **Avoid Confusion:** "Prompt" will be used for RAG context prompts
3. **Future-Proof:** Separates CLI concerns from RAG prompt engineering

### Why Concise Help?

1. **Better UX:** Quick reference without scrolling
2. **Progressive Disclosure:** Details available via `/help <topic>`
3. **Cleaner Welcome:** Less overwhelming for new users

---

## Updated Welcome Message

**Before:**
```
🔧 Welcome to RAG Tools Interactive REPL!
RAG commands: /evidence, /mc, /ms, /mi, /help, /status, /history, /exit
All other commands run as shell commands
Arrow keys & TAB work via rlwrap, '/help' for help
```

**After:**
```
🔧 Welcome to RAG Tools Interactive REPL!
Type '/help' for categories or '/help <topic>' for details
Shell commands (no /) run directly
Arrow keys & TAB completion enabled
```

---

## Migration Guide

### For Users

- `/prompt` → Use `/cli` (but `/prompt` still works)
- `/help` → Shows categories (use `/help <topic>` for details)

### For Scripts/Automation

- Update any scripts using `/prompt` to use `/cli`
- No breaking changes if using `/prompt` (backwards compatible)

### For Documentation

- Update all references from "prompt mode" to "CLI mode"
- Update examples to use `/cli` instead of `/prompt`

---

## Files Changed

1. **bash/rag_repl.sh**
   - Renamed `_rag_repl_prompt()` → `_rag_repl_cli()`
   - Refactored `_rag_repl_help()` to be concise
   - Updated case statement to handle `/cli|prompt`
   - Simplified welcome message

---

## Future: RAG Prompt System

Now that CLI prompts are `/cli`, we can define RAG prompts separately:

**RAG Prompts** will be:
- Context assembly instructions
- LLM system prompts
- Evidence selection strategies
- Output formatting rules

**CLI Prompts** are:
- Visual prompt in terminal (`>`, `rag>`, `[flow:stage] rag>`)
- Display modes (minimal, normal, twoline)
- Terminal UI settings

**Clear Separation:**
```bash
/cli minimal           # Terminal prompt appearance
/rag prompt set llm    # RAG context prompt (future)
```

---

## Testing

```bash
# Test CLI commands
rag
/cli                   # Should show current mode
/cli toggle            # Should toggle modes
/prompt                # Should still work (backwards compat)

# Test help system
/help                  # Should show categories
/help cli              # Should show CLI help
/help flow             # Should show flow workflow guide
/help evidence         # Should show evidence commands
```

---

**Summary:** Help is now concise with categories, and `/cli` replaces `/prompt` for clarity
while maintaining backwards compatibility.
