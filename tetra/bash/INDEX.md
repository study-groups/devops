# Tetra TUI/REPL Architecture Documentation Index

## Document Overview

This comprehensive analysis covers the complete TUI and REPL architecture of the Tetra codebase. The documentation is organized into three complementary documents:

### 1. TUI_ARCHITECTURE_SUMMARY.md
**The Complete Reference** - In-depth technical documentation covering:
- Directory structure and all main implementations
- Screen layout and rendering architecture
- Mode switching mechanism and modal system
- Status display implementation (4-layer system)
- Theming and color system
- Input handling pipeline and completion system
- Animation and timing system (FPS/BPM)
- Command processing and module integration
- Complete file/function reference table
- Data flow examples and initialization sequences
- Key design patterns and refactoring notes

**Best for**: Understanding the full architecture, deep technical details, refactoring planning

### 2. TUI_FILE_TREE.txt
**Visual Organization** - ASCII tree visualization showing:
- Complete file directory hierarchy with annotations
- Key component relationships (dependency chain)
- File purposes organized by category
- Data flow patterns (input, rendering)
- Global state variables reference
- Execution modes and behaviors
- Testing and demo files location

**Best for**: Finding files, understanding organization, quick visual reference

### 3. QUICK_REFERENCE.md
**Developer Cheat Sheet** - Practical guide with:
- Main entry points for different use cases
- Core subsystems at a glance (quick table)
- Common tasks with code examples
- Key concepts explained simply
- Global variables reference
- Special keys and color codes
- Return codes and patterns
- Testing and debugging commands
- Troubleshooting tips

**Best for**: Day-to-day development, copy-paste examples, quick lookups

---

## Quick Navigation

### I Want To...

**Understand the high-level architecture**
1. Read: Overview section of TUI_ARCHITECTURE_SUMMARY.md
2. Look at: Dependency chain in TUI_FILE_TREE.txt
3. Reference: Core Subsystems section of QUICK_REFERENCE.md

**Find a specific file**
1. Use: TUI_FILE_TREE.txt (visual search)
2. Check: File Purposes by Category section
3. Confirm: Absolute path from directory listing

**Add REPL to my module**
1. Use: QUICK_REFERENCE.md "Add REPL to Module" example
2. Deep dive: Module Registry Pattern in TUI_ARCHITECTURE_SUMMARY.md
3. Reference: command_processor.sh in file summary table

**Debug why input isn't working**
1. Check: Quick Troubleshooting section in QUICK_REFERENCE.md
2. Use: "Debug Key Codes" testing commands
3. Read: Input Handling & Completion section in TUI_ARCHITECTURE_SUMMARY.md

**Create a full TUI application**
1. Use: "Create TUI Application" example in QUICK_REFERENCE.md
2. Reference: Initialization Sequence in TUI_ARCHITECTURE_SUMMARY.md
3. Study: Typical TUI Startup pattern

**Understand mode switching**
1. Read: Mode Switching Mechanism section in TUI_ARCHITECTURE_SUMMARY.md
2. Look at: Modal System in QUICK_REFERENCE.md
3. Check: tcurses_modal.sh and estovox/tui/modes.sh behavior

**Add status display**
1. Reference: Status Display Implementation in TUI_ARCHITECTURE_SUMMARY.md
2. Use: "Pattern: Status Indicator" in QUICK_REFERENCE.md
3. Check: log_footer_add function in tcurses_log_footer.sh

**Optimize rendering performance**
1. Read: Screen Layout & Rendering Architecture section
2. Check: Double-Buffering Pattern in QUICK_REFERENCE.md
3. Review: tcurses_buffer.sh differential rendering

**Add TAB completion**
1. Use: "Add TAB Completion" example in QUICK_REFERENCE.md
2. Deep dive: TAB Completion System in TUI_ARCHITECTURE_SUMMARY.md
3. Reference: tcurses_completion.sh and tcurses_readline.sh

---

## Key Sections by Interest

### For Architects/Designers
- Overview (TUI_ARCHITECTURE_SUMMARY.md)
- Directory Structure & Main Implementations
- Screen Layout & Rendering Architecture
- Mode Switching Mechanism
- Design Patterns and Refactoring Considerations

### For REPL Developers
- Module Integration Pattern (TUI_ARCHITECTURE_SUMMARY.md)
- Add REPL to Module (QUICK_REFERENCE.md)
- Command Processing & Module Integration (TUI_ARCHITECTURE_SUMMARY.md)
- Common Tasks section (QUICK_REFERENCE.md)

### For TUI Developers
- Rendering Approach (TUI_ARCHITECTURE_SUMMARY.md)
- Animation & Timing System
- Input Handling & Completion
- Create TUI Application example (QUICK_REFERENCE.md)

### For Maintainers/Debuggers
- Quick Troubleshooting (QUICK_REFERENCE.md)
- Testing & Debugging section
- Global State Variables section
- File organization reference

---

## Architecture at a Glance

```
┌─────────────────────────────────────────┐
│   Module-Specific REPLs (17 modules)    │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│         repl/ (Universal Framework)     │
├──────────────────┬──────────────────────┤
│  core/mode.sh    │  command_processor   │
│  core/input.sh   │  prompt_manager.sh   │
│  core/loop.sh    │                      │
└──────────────────┼──────────────────────┘
                   │
     ┌─────────────┴─────────────┐
     │                           │
┌────v────────────┐    ┌────────v────────┐
│  tui.sh          │    │  estovox/tui/   │
│  (Unified API)   │    │  (Domain TUI)    │
└────┬─────────────┘    └──────────────────┘
     │
┌────v────────────────────────────────────┐
│      tcurses/ (Terminal Primitives)     │
├────────────────────────────────────────┤
│ screen  input  buffer  animation       │
│ readline modal completion log_footer   │
│ repl    actions                         │
└────────────────────────────────────────┘
```

---

## Three-Layer Model

### Layer 1: tcurses/ - Terminal Primitives
- Raw terminal control
- ANSI escape codes
- Double-buffering
- Frame timing
- Modal system
- Input handling

### Layer 2: repl/ - REPL Framework
- Module registry pattern
- Command dispatch
- Prompt building
- Hybrid execution mode
- History management

### Layer 3: Module-Specific
- Module REPL (trepl entry)
- Custom commands
- Context-specific prompts
- Module-specific completion

---

## File Count Summary

- **tcurses/**: 15 main files + tests
- **repl/**: 14 main files + 3 core + tests
- **tui/**: 6 core/components/integration + demo
- **estovox/**: 6 TUI + 4 REPL variations
- **Module REPLs**: 17+ (org, rag, tdocs, etc.)

**Total**: 50+ TUI/REPL related files

---

## Standards & Patterns

### Naming Conventions
- `tcurses_*` - Terminal primitives (low-level)
- `repl_*` - REPL framework (mid-level)
- `tui_*` - Unified TUI API (high-level)
- `modal_*` - Modal system operations
- `log_footer_*` - Status log operations
- `header_*` - Header component operations

### State Management
- All global state in `declare -g` variables
- Prefix private variables with `_`
- Read-only state should document access patterns

### API Pattern
- Functions exported with `export -f`
- Return codes: 0=success, 1=error/exit, 2=state change
- Output via echo/printf to stdout

---

## Integration Checklist

When adding TUI/REPL to a new module:

- [ ] Source appropriate library (tcurses, repl, or tui)
- [ ] Initialize system (tcurses_screen_init or repl_run)
- [ ] Register module (repl_register_module)
- [ ] Add slash commands (repl_register_slash_command)
- [ ] Add prompt builder (repl_register_prompt_builder)
- [ ] Add completion (repl_register_completion_words)
- [ ] Setup cleanup trap (trap 'cleanup; exit' INT TERM EXIT)
- [ ] Implement main loop or call repl_run
- [ ] Test with demo script
- [ ] Register in trepl.sh if REPL
- [ ] Document shortcuts and commands

---

## Current Status

### Production-Ready (v1.0.0)
- tcurses/ - Complete terminal primitives
- repl/ - Universal REPL framework
- tui/ - Consolidated unified API
- 17 module REPLs implemented

### Experimental
- estovox/tui/ - Domain-specific speech synthesis TUI
- demo/basic/014 - Advanced action signature system

### Known Limitations
- No persistent theme/preference system
- Modal system could use event model
- Completion state scattered across multiple variables
- Color system tightly coupled to text_color()

---

## References

### Core Entry Points
- `/Users/mricos/src/devops/tetra/bash/tcurses/tcurses.sh`
- `/Users/mricos/src/devops/tetra/bash/repl/repl.sh`
- `/Users/mricos/src/devops/tetra/bash/tui/tui.sh`
- `/Users/mricos/src/devops/tetra/bash/repl/trepl.sh`

### Key Configuration
- `TETRA_SRC` - Tetra source root
- `TETRA_DIR` - Tetra data directory
- `COLOR_ENABLED` - Enable colors in output
- `REPL_HISTORY_FILE` - History file location

### Related Documentation
- `$TETRA_SRC/bash/repl/README.md` - REPL framework docs
- `$TETRA_SRC/bash/tui/README.md` - TUI framework docs
- Module-specific README.md files

---

## Next Steps for Refactoring

Based on the architectural analysis, potential improvements:

1. **Consolidate REPL components** - Reduce duplication between tcurses_repl.sh and tui/integration/repl.sh
2. **Extract completion state** - Create dedicated completion_state.sh module
3. **Event system** - Add event model for mode changes and state updates
4. **Theming system** - Persistent theme/preference management
5. **State validation** - Build-in validation for modal state machine
6. **Performance monitoring** - Built-in FPS/timing instrumentation

---

## How to Use These Documents

1. **Start here** - Read this INDEX.md for overview and navigation
2. **Quick start** - Use QUICK_REFERENCE.md for immediate needs
3. **Deep dive** - Consult TUI_ARCHITECTURE_SUMMARY.md for details
4. **Find files** - Use TUI_FILE_TREE.txt for visual navigation
5. **Iterate** - Jump between docs as needed using references

---

## Document Metadata

- **Created**: November 2024
- **Scope**: Complete Tetra TUI/REPL architecture
- **Coverage**: tcurses/, repl/, tui/, estovox/ directories
- **Language**: Bash
- **Version**: Tetra v1.0.0+ (tcurses/repl/tui)

---

**Last Updated**: Analysis complete - ready for refactoring review

