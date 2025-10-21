# RAG REPL Color Scheme

The RAG REPL uses a semantic color system to provide visual feedback about flow states, command types, and system status.

## Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Cyan/Teal | #00D4AA | Primary headings, flow names |
| Blue | #7AA2F7 | Commands, labels |
| Light Purple | #BB9AF7 | Section headers |
| Dark Purple | #9D7CD8 | Subsections |
| Green | #9ECE6A | Success, valid, enabled |
| Orange | #E0AF68 | Warnings, submit stage |
| Red | #F7768E | Errors, validate stage, disabled |
| Gray | #565F89 | Secondary text, punctuation |

## Flow Stage Colors

The REPL prompt changes color based on the current flow stage:

```
[test-flow:NEW] rag>       # Blue - starting fresh
[test-flow:SELECT] rag>    # Light Purple - gathering evidence
[test-flow:ASSEMBLE] rag>  # Dark Purple - building context
[test-flow:SUBMIT] rag>    # Orange - submitting to agent
[test-flow:APPLY] rag>     # Bright Orange - applying changes
[test-flow:VALIDATE] rag>  # Red - validating results
[test-flow:DONE] rag>      # Green - success!
[test-flow:FAIL] rag>      # Red - failed
```

## Visual Elements

### Prompt Structure
- Gray brackets `[` `]` for structure
- Cyan flow name for visibility
- Colored stage name indicates progress
- Blue `rag>` for command entry

### Status Messages
- Green checkmarks `✓` for available/working
- Red crosses `✗` for missing/broken
- Orange warning `⚠` for attention needed
- Green bullets `•` for list items

### Help Text
- Cyan headings for major sections
- Purple headings for subsections
- Blue commands for action items
- Gray examples for reference
- Green examples in demo section

## Terminal Compatibility

The color system:
- Uses 256-color palette for wide terminal support
- Falls back to plain text if colors unavailable
- Tested on macOS Terminal, iTerm2, and standard terminals
- Respects `COLOR_ENABLED` flag for accessibility

## Color Philosophy

1. **Semantic**: Colors mean something (green=good, red=bad, blue=action)
2. **Consistent**: Same colors mean same things throughout
3. **Progressive**: Color intensity follows workflow progression
4. **Accessible**: Works without color, enhanced with color
5. **Readable**: High contrast, distinct colors, no harsh combinations

## Examples

### Welcome Message
```
🔧 Welcome to RAG Tools Interactive REPL!  (Cyan)
RAG commands: /evidence, /mc, /ms...      (Blue)
All other commands run as shell commands  (Purple)
Use TAB for completion, '/help'...        (Gray)
```

### Status Command
```
RAG Tools Status:          (Cyan)
═════════════════          (Gray)
RAG_DIR: /path/to/dir      (Blue label)
  ✓ mc                     (Green checkmark)
  ✗ missing-tool           (Red cross)
```

### Evidence List
```
Evidence files:            (Purple)
  • 100_flow_manager.md    (Green bullet, blue text)
  • 200_evidence.md        (Green bullet, blue text)
```

## Disabling Colors

Set `COLOR_ENABLED=0` in your environment or the REPL will automatically disable colors if the color system isn't available.
