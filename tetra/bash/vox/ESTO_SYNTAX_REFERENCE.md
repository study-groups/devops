# esto Syntax Quick Reference

## Document Metadata

```
@title "Title"              # Document title
@voice sally                # Default voice (alloy|echo|fable|onyx|nova|shimmer)
@author "Name"              # Author name
@interactive true           # Enable interactive features
@duration_estimate 15min   # Estimated duration
@difficulty beginner        # beginner|intermediate|advanced
@prerequisites "topic"      # Required knowledge
```

## Structure

```
@begin chapter name=id      # Start chapter
@end chapter                # End chapter

@begin section name=id      # Start section (within chapter)
@end section                # End section

@begin meta                 # Metadata block (not read aloud)
@end meta                   # End metadata
```

## Timing

```
@pause 1.5                  # Pause for 1.5 seconds
@pause_after_section 2.0    # Auto-pause after each section
@speed 1.5                  # Playback speed (0.5-2.0)
@speed_range min=0.5 max=2  # Allow user speed control
```

## User Interaction

```
@prompt "message"           # Wait for user input
@prompt_timeout 30          # Auto-continue after N seconds
```

## Code Blocks

```
@code "command"             # Show code block
@code "command" executable=true  # Allow execution
@code_prompt "message"      # Instruction for code
@code_validate "command"    # Must run successfully
```

## Navigation

```
@skippoint name="id"        # Create skip point
@bookmark name="id"         # Create bookmark
@goto skippoint="id"        # Jump to skippoint
@loop section=true count=3  # Repeat section N times
```

## Progress & Validation

```
@checkpoint name="id"       # Progress checkpoint
@progress show_percent=true # Show progress percentage
@progress show_time_remaining=true  # Show time remaining

@quiz question="Q?" answer="A"  # Text quiz
@quiz type=multiple_choice options="a,b,c" correct=b  # Multiple choice
@validate_command "cmd"     # Validate command execution
```

## Help & Documentation

```
@help topic="name" available=true  # Make help available
@glossary term="term" definition="def"  # Define term
@reference url="https://..."  # External reference
```

## Events & Hooks (Future)

```
@on_section_start command="fn"  # Run function on section start
@on_section_end command="fn"    # Run function on section end
@on_pause hook="fn"             # Run on pause
@on_code_execute validate=true  # Validate code execution
```

## Advanced Features (Future)

```
@adapt_speed based_on=quiz_performance  # Adaptive speed
@adapt_difficulty based_on=progress     # Adaptive difficulty
@recommend next_tutorial="file.esto"    # Recommend next content

@cast character=alice voice=nova  # Voice casting
@dialogue character=alice "text"  # Character dialogue

@track event="name"             # Track analytics
@analytics export="file.json"   # Export analytics
```

## Example: Minimal esto

```
@title "Hello Vox"
@voice alloy

@begin chapter name=greeting
Hello world! This is my first esto file.
@end chapter
```

## Example: Interactive Tutorial

```
@title "Interactive Bash"
@voice nova
@interactive true

@begin chapter name=intro
@prompt "Ready? Press enter."

Welcome to this tutorial!

@pause 1.0
@end chapter

@begin chapter name=lesson
Let's learn the ls command.

@code "ls -la" executable=true
@code_prompt "Try running this command"

@pause 1.0

@quiz question="What flag shows hidden files?" answer="-a"

Great job!
@end chapter
```

## Playback Commands (Future)

```bash
# Non-interactive (generate audio file)
cat file.esto | vox generate sally --output audio.mp3

# CLI interactive (terminal prompts)
vox play sally file.esto --interactive

# TUI interactive (full features)
vox tui file.esto

# Resume from last position
vox resume file.esto

# Start at specific section
vox play sally file.esto --section advanced
```

## TUI Keybindings (Proposed)

```
Navigation:     j/k = next/prev section, g/G = start/end, / = search
Playback:       space = play/pause, h/l = rewind/forward, [/] = speed
Interactive:    enter = confirm, e = execute code, r = replay section
Bookmarks:      b = add bookmark, B = show bookmarks
Progress:       p = show progress, q = quit (save progress)
Help:           ? = help overlay
```

## File Structure

```
project/
├── tutorial.esto               # Source
├── tutorial.vox.sally.mp3      # Generated audio
├── tutorial.vox.sally.spans    # Timing/span data
└── .vox/
    ├── config.toml             # Project config
    ├── progress.json           # User progress
    ├── bookmarks.json          # Saved positions
    └── cache/                  # Temp files
```

## Best Practices

1. **Keep metadata at top** - `@title`, `@voice`, `@interactive`
2. **Use meaningful names** - chapter/section names should be descriptive
3. **Pause appropriately** - 0.5-2.0 seconds between concepts
4. **Prompt sparingly** - Too many prompts disrupt flow
5. **Structure clearly** - Logical chapter/section hierarchy
6. **Test both modes** - Interactive and non-interactive
7. **Validate syntax** - Use `vox validate file.esto` (future)
8. **Provide context** - Use `@code_prompt` and `@help`

## Common Patterns

### Tutorial Section

```
@begin chapter name=topic
@section "Topic Name"

Introduction to topic.

@pause 1.0

@code "example command" executable=true
@code_prompt "Try this command"

@pause 1.0

@quiz question="What did you learn?" answer="key_concept"

@checkpoint name="topic_complete"
@end chapter
```

### Timed Pause for Absorption

```
Key concept here.

@pause 2.0

Another important point.

@pause 2.0
```

### Interactive Checkpoint

```
You've completed the basics!

@checkpoint name="basics_done"
@prompt "Ready for advanced topics? Press enter."

@skippoint name="advanced_section"
```

### Code Exercise

```
Here's a practical exercise:

@code "git status" executable=true
@code_prompt "Check your repository status"

@pause 1.0

@validate_command "git status"

@quiz question="What command shows repo status?" answer="git status"
```

## Implementation Status

### Phase 1 (Current)
- ✅ Basic structure parsing
- ✅ Metadata extraction
- ✅ Content to TTS

### Phase 2 (Next)
- ⏳ `@pause` directives
- ⏳ `@prompt` interaction
- ⏳ Section navigation
- ⏳ Progress tracking

### Phase 3 (Future)
- ⬜ `@code` execution
- ⬜ `@quiz` validation
- ⬜ TUI mode
- ⬜ Event hooks

## Quick Start

1. **Create esto file:**
   ```bash
   cat > my_tutorial.esto << 'EOF'
   @title "My First Tutorial"
   @voice alloy

   @begin chapter name=intro
   Hello! This is my tutorial.
   @pause 1.0
   Let's learn something new!
   @end chapter
   EOF
   ```

2. **Generate audio:**
   ```bash
   cat my_tutorial.esto | vox generate alloy --output tutorial.mp3
   ```

3. **Play interactively (future):**
   ```bash
   vox play alloy my_tutorial.esto --interactive
   ```

## Resources

- [INTERACTIVE_ESTO.md](./INTERACTIVE_ESTO.md) - Full specification
- [examples/](./examples/) - Example esto files
- [NEXT.md](./NEXT.md) - Roadmap and features
- [README.md](./README.md) - Vox documentation
