# Vox esto Examples

This directory contains example esto files demonstrating vox features and interactive syntax.

## Files

### simple_tutorial.esto

A basic 3-minute tutorial covering vox essentials:
- Basic TTS commands
- File generation
- Caching behavior

**Usage:**
```bash
# Generate audio (non-interactive)
cat simple_tutorial.esto | vox generate alloy --output tutorial.mp3

# View content
cat simple_tutorial.esto
```

**Features demonstrated:**
- `@pause` directives
- Chapter structure
- Document metadata

### interactive_demo.esto

A comprehensive demo of interactive esto features:
- User prompts
- Executable code blocks
- Navigation (skippoints, bookmarks)
- Progress tracking
- Quiz questions
- Context help

**Usage:**
```bash
# Non-interactive playback (future)
vox play sally interactive_demo.esto

# Interactive TUI mode (future)
vox tui interactive_demo.esto

# View content
cat interactive_demo.esto
```

**Features demonstrated:**
- `@prompt` for user interaction
- `@code` with `executable=true`
- `@skippoint` and `@bookmark`
- `@checkpoint` for progress
- `@quiz` for validation
- `@help` and `@glossary`
- Event hooks with `@on_*`

### vox_tutorial.esto (in parent directory)

Full-length tutorial covering all vox capabilities:
- TTS basics
- Dry-run analysis
- Caching system
- QA integration
- Sound synthesis
- Advanced workflows

**Usage:**
```bash
# Generate complete tutorial audio
cat ../vox_tutorial.esto | vox generate sally --output full_tutorial.mp3
```

## esto Syntax Reference

### Document Metadata

```
@title "Document Title"
@voice sally
@author "Author Name"
@interactive true|false
@duration_estimate Nmin
@difficulty beginner|intermediate|advanced
@prerequisites "prerequisite_topic"
```

### Structure

```
@begin chapter name=chapter_id
  Content...

  @begin section name=section_id
    More content...
  @end section
@end chapter
```

### Timing Control

```
@pause 1.5                      # Pause for 1.5 seconds
@pause_after_section 2.0        # Auto-pause after sections
@speed 1.5                      # Playback speed multiplier
@speed_range min=0.5 max=2.0    # User-adjustable speed
```

### User Interaction

```
@prompt "Message to user"
@prompt_timeout 30              # Auto-continue after N seconds
```

### Code Blocks

```
@code "command here" executable=true
@code_prompt "Try it: explanation"
@code_validate "command"        # Must succeed
```

### Navigation

```
@skippoint name="section_id"
@bookmark name="bookmark_id"
@goto skippoint="section_id"
@loop section=true count=3
```

### Progress & Validation

```
@checkpoint name="milestone_id"
@quiz question="Question?" answer="answer"
@quiz type=multiple_choice options="a,b,c" correct=b
@validate_command "command"
@progress show_percent=true show_time_remaining=true
```

### Help & Context

```
@help topic="topic_name" available=true
@glossary term="term" definition="definition"
@reference url="https://example.com"
```

### Events (Future)

```
@on_section_start command="function_name"
@on_section_end command="function_name"
@on_pause hook="save_progress"
@on_code_execute validate=true
```

## Playback Modes

### 1. Non-Interactive Generation

Generate audio files without interaction:

```bash
cat tutorial.esto | vox generate voice --output file.mp3
```

**Behavior:**
- All prompts ignored
- Pauses converted to silence
- Code/quiz read as text
- No progress tracking

**Use case:** Audiobooks, podcasts, batch processing

### 2. CLI Interactive (Future)

Terminal-based interactive playback:

```bash
vox play voice tutorial.esto --interactive
```

**Behavior:**
- Prompts wait for enter
- Code shown with line numbers
- Quiz questions asked in terminal
- Progress saved to `.vox/progress.json`

**Use case:** Terminal learning, command-line courses

### 3. TUI Interactive (Future)

Full-featured visual interface:

```bash
vox tui tutorial.esto
```

**Behavior:**
- Visual section outline
- Syntax-highlighted code
- One-key navigation (j/k)
- Execute code in split pane
- Help overlay (press 'h')
- Visual quiz UI
- Progress bar

**Use case:** Rich learning experiences

## Creating Your Own esto Files

### Minimal Example

```
@title "My First Tutorial"
@voice alloy

@begin chapter name=intro
Hello! This is my first esto file.

@pause 1.0

It's easy to create audio content with vox.
@end chapter
```

### Interactive Example

```
@title "Interactive Lesson"
@voice nova
@interactive true

@begin chapter name=lesson
@prompt "Ready to begin? Press enter."

Let's learn something new!

@pause 1.0

@code "echo 'Try this command'" executable=true

@quiz question="What did you learn?" answer="something new"

Great job!
@end chapter
```

### Best Practices

1. **Start simple** - Begin with `@title`, `@voice`, and basic chapters
2. **Use pauses** - Give listeners time to absorb information
3. **Structure clearly** - Use chapters and sections for organization
4. **Add prompts sparingly** - Too many breaks are disruptive
5. **Test both modes** - Ensure content works interactively and non-interactively
6. **Provide context** - Use `@code_prompt` and `@help` to guide learners
7. **Track progress** - Add `@checkpoint` at logical breakpoints
8. **Validate learning** - Use `@quiz` to reinforce key concepts

## Implementation Status

### Currently Supported (via plain text conversion)

- ✅ Document metadata (`@title`, `@voice`)
- ✅ Chapter/section structure
- ✅ Content playback

### Planned (Phase 2)

- ⏳ `@pause` directives
- ⏳ `@prompt` user interaction
- ⏳ Section-based navigation
- ⏳ Progress tracking

### Future (Phase 3+)

- ⬜ `@code` execution
- ⬜ `@quiz` validation
- ⬜ `@help` context system
- ⬜ Event hooks
- ⬜ Full TUI mode

## Testing Your esto Files

### 1. Syntax Validation (Future)

```bash
vox validate tutorial.esto
```

### 2. Preview Structure

```bash
# Show chapter outline
grep '@begin chapter' tutorial.esto

# Show timing
grep '@pause' tutorial.esto
```

### 3. Generate Audio

```bash
# Test audio generation
cat tutorial.esto | vox generate alloy --output test.mp3

# Check file size and duration
ls -lh test.mp3
```

### 4. Dry-Run Analysis

```bash
# Estimate cost and check for issues
cat tutorial.esto | vox dry-run stdin nova
```

## Directory Structure

When working with esto projects:

```
project/
├── lessons/
│   ├── 01_intro.esto
│   ├── 02_basics.esto
│   └── 03_advanced.esto
├── audio/
│   ├── 01_intro.vox.sally.mp3
│   ├── 01_intro.vox.sally.spans
│   ├── 02_basics.vox.sally.mp3
│   └── 02_basics.vox.sally.spans
└── .vox/
    ├── config.toml           # Project config
    ├── progress.json         # Learning progress
    ├── bookmarks.json        # Saved positions
    └── cache/                # Temp files
```

## Contributing Examples

Have a great esto example? Consider adding it here!

**Guidelines:**
- Keep examples focused on one concept
- Include comments explaining syntax
- Test in both interactive and non-interactive modes
- Document any special requirements
- Follow naming convention: `<topic>_<type>.esto`

## Resources

- [INTERACTIVE_ESTO.md](../INTERACTIVE_ESTO.md) - Full syntax specification
- [NEXT.md](../NEXT.md) - Roadmap and upcoming features
- [README.md](../README.md) - Vox system documentation
- [DRY_RUN.md](../DRY_RUN.md) - Dry-run analysis guide

## License

All examples are MIT licensed as part of the tetra framework.
