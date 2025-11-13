# RAG REPL Demo

Interactive demonstration of the RAG REPL with context-aware tab completion and workflow visualization.

## Overview

This demo showcases the RAG (Retrieval-Augmented Generation) REPL system, highlighting:

- **Context-Aware Tab Completion**: Completion menus that change based on workflow state
- **Dynamic Prompt**: Visual feedback showing flow, stage, and evidence count
- **TDS Colors**: Beautiful terminal rendering with semantic colors
- **Complete Workflow**: From flow creation to evidence assembly to QA submission

## Running the Demo

### Basic Usage

```bash
bash/rag/demo_rag_repl.sh
```

### Speed Control

Control the demo pacing with the `DEMO_SPEED` environment variable:

```bash
# Slow pace (good for presentations)
DEMO_SPEED=slow bash/rag/demo_rag_repl.sh

# Medium pace (default)
DEMO_SPEED=medium bash/rag/demo_rag_repl.sh

# Fast pace (quick walkthrough)
DEMO_SPEED=fast bash/rag/demo_rag_repl.sh
```

**Timing by Speed:**
- **slow**: 2s short pauses, 3s medium, 5s long
- **medium**: 1s short pauses, 2s medium, 3s long (default)
- **fast**: 0.5s short pauses, 1s medium, 1.5s long

## Demo Flow

The demo walks through these steps:

### Step 1: Initial State
- Shows the RAG prompt with no active flow: `[no-flow x NEW x no-e] >`
- Demonstrates basic tab completion for slash commands
- Highlights that evidence commands show "create flow first" hint

### Step 2: Flow Creation
- Creates a new flow with `/flow create "question"`
- Prompt updates to show active flow: `[demo-20251 x SELECT x no-e] >`
- Tab completion hints now reflect flow-aware context

### Step 3: Evidence Addition
- Adds evidence files with `/e add file.sh`
- Prompt shows evidence count: `[demo-20251 x ASSEMBLE x 2e] >`
- Numeric tab completions (1, 2) appear for viewing evidence

### Step 4: Assembly Commands Appear
- With evidence added, assembly commands become available
- `/assemble`, `/submit`, `/r` now appear in completions
- Demonstrates context-aware menu changes

### Step 5: QA Integration
- Shows QA subcommands for history search
- Demonstrates how to add previous Q&A as evidence

### Step 6: Summary
- Complete workflow overview
- Key features recap
- Usage tips

## Features Demonstrated

### Context-Aware Completions

**No Flow Active:**
```
[no-flow x NEW x no-e] > /[TAB]
╭─ Available Commands
│ flow      Flow • Create and manage RAG flows
│ evidence  Evidence • Add/manage evidence (create flow first)
│ qa        QA • Search and retrieve from QA history
│ ...
```

**Flow Active with Evidence:**
```
[demo-flow x ASSEMBLE x 2e] > /[TAB]
╭─ Available Commands
│ flow      Flow • Create and manage RAG flows
│ evidence  Evidence • Add/manage evidence (flow active: 2e)
│ select    Assembly • Select evidence using query
│ assemble  Assembly • Build context from evidence
│ submit    Assembly • Submit assembled context to QA agent
│ ...
```

**Evidence Numeric Completions:**
```
[demo-flow x ASSEMBLE x 2e] > /e [TAB]
╭─ Evidence Subcommands (2 files)
│ add      Evidence • Add file as evidence with selector
│ list     Evidence • List all evidence files with variables
│ toggle   Evidence • Toggle evidence active/skipped
│ status   Evidence • Show context status and token budget
│ 1        Evidence • View evidence file #1
│ 2        Evidence • View evidence file #2
```

### Dynamic Prompt

The prompt reflects workflow state in real-time:

| State | Prompt | Meaning |
|-------|--------|---------|
| Initial | `[no-flow x NEW x no-e] >` | No flow created yet |
| Flow Created | `[demo-flow x SELECT x no-e] >` | Flow active, selecting evidence |
| Evidence Added | `[demo-flow x SELECT x 2e] >` | 2 evidence files added |
| Ready to Assemble | `[demo-flow x ASSEMBLE x 2e] >` | Ready for context assembly |
| Executing | `[demo-flow x EXECUTE x 2e] >` | Submitted to QA |

### Color Coding

- **Cyan**: Active flow name (grayed when no flow)
- **Yellow**: Current stage
- **Green**: Evidence count (grayed when no evidence)
- **Gray**: Brackets and separators
- **White**: Prompt arrow
- **Magenta**: Completion menu
- **Cyan**: Completion hints

## Requirements

- Bash 5.0+
- TETRA_SRC and TETRA_DIR environment variables set
- TDS (Tetra Display System) for color rendering
- Terminal with ANSI color support

## Related Files

- **rag_repl.sh**: Main RAG REPL implementation with tab completion
- **rag_commands.sh**: Slash command handlers
- **core/flow_manager_ttm.sh**: Flow state management
- **core/evidence_manager.sh**: Evidence handling

## Tab Completion Implementation

The tab completion system uses:

1. **`_rag_repl_generate_completions()`**: Context-aware completion generator
2. **Flow State Detection**: Reads active flow directory and evidence files
3. **Dynamic Hints**: Changes based on has_flow and has_evidence flags
4. **Category Grouping**: Flow, Evidence, Assembly, QA, KB, etc.
5. **Numeric Completions**: Generated from actual evidence count

See `rag_repl.sh` lines 422-580 for implementation details.

## Usage Tips

After watching the demo, try the real RAG REPL:

```bash
# Launch RAG REPL
rag repl

# In the REPL:
/[TAB]                          # See all commands
/flow create "your question"    # Create a flow
/e add path/to/file.sh         # Add evidence
/e [TAB]                        # See numeric completions
/assemble                       # Build context
/submit @qa                     # Send to QA agent
/r                              # View response
/help                           # Show help tree
```

## Customization

The demo script can be modified:

- Change `DEMO_SPEED` timing values (lines 19-32)
- Adjust sample code in `demo_setup()` (lines 107-145)
- Modify workflow steps in `demo_main()` (lines 191-500)
- Update menu items in `demo_tab_menu()` calls

## Troubleshooting

**Colors not showing?**
- Ensure TDS is loaded: `source $TETRA_SRC/bash/tds/tds.sh`
- Check terminal supports 256 colors: `echo $TERM`

**Demo too fast/slow?**
- Set DEMO_SPEED: `DEMO_SPEED=slow bash/rag/demo_rag_repl.sh`

**Cleanup issues?**
- Demo creates: `$TETRA_DIR/rag_demo/`
- Auto-cleanup on exit, but can manually: `rm -rf $TETRA_DIR/rag_demo`

## See Also

- `bash/tdocs/demo_tdocs.sh`: TDOCS module demo
- `bash/repl/demo_trepl.sh`: Universal REPL launcher demo
- `bash/tds/demo_tds.sh`: TDS color system demo
- `CLAUDE.md`: Tab completion implementation notes
