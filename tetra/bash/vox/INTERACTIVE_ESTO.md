# Interactive esto Playback Design

## Overview

esto files can include interactive directives that control playback behavior, enable user interaction, and create guided learning experiences. This document proposes syntax for interactive features.

## Core Philosophy

**Interactive esto files should:**
- Work non-interactively by default (batch mode)
- Degrade gracefully when played without TUI
- Support both linear and non-linear navigation
- Enable voice-guided tutorials and courseware
- Integrate with vox TUI for visual feedback

## Directive Categories

### 1. Timing Control

Control playback timing and pauses:

```
@pause 1.5                    # Pause for 1.5 seconds
@pause_after_section 2.0      # Auto-pause after each section
@speed 1.5                    # Playback speed multiplier
@speed_range min=0.5 max=2.0  # Allow user speed control
```

**Use cases:**
- Allow listeners to absorb information
- Create natural breaks in long content
- Support different listening speeds

**Implementation:**
- Non-interactive: Insert silence into audio
- Interactive TUI: Visual countdown, allow skip

### 2. User Prompts

Pause for user input:

```
@prompt "Press enter to continue"
@prompt "Type 'skip' to skip this section"
@prompt_timeout 30            # Auto-continue after 30s
```

**Use cases:**
- Guided tutorials with self-paced sections
- Checkpoint confirmations
- Interactive learning flows

**Implementation:**
- Non-interactive: Ignored (audio continues)
- Interactive TUI: Wait for enter, show prompt
- CLI flag: `--prompts=auto` to skip all prompts

### 3. Navigation

Enable non-linear playback:

```
@skippoint name="advanced"
@bookmark name="important_section"
@goto skippoint="conclusion"  # Jump to section
@loop section=true count=3    # Repeat section
```

**Use cases:**
- Jump to specific content
- Skip optional material
- Review difficult sections

**Implementation:**
- Skippoints: Named audio offsets
- Bookmarks: Saved in `.vox/bookmarks.json`
- Goto: Supported in TUI with keybinds

### 4. Section Markers

Structure content hierarchically:

```
@begin chapter name=intro
  @begin section name=overview
    Content here
  @end section
@end chapter
```

**Use cases:**
- Generate table of contents
- Enable section-based navigation
- Track progress

**Implementation:**
- Maps to span hierarchy
- TUI shows section outline
- CLI: `vox play file.esto --section intro`

### 5. Interactive Code

Executable code examples:

```
@code "echo 'test' | vox play alloy" executable=true
@code_prompt "Try it: Generate audio with nova voice"
@code_validate "vox dry-run stdin sally < test.txt"
```

**Use cases:**
- Interactive tutorials
- Hands-on learning
- Command validation

**Implementation:**
- Non-interactive: Code shown as text
- Interactive TUI: Syntax-highlighted, press 'e' to execute
- Output shown in split pane

### 6. Quiz/Validation

Check understanding:

```
@quiz question="What command lists cache?" answer="vox cache stats"
@quiz type=multiple_choice options="a,b,c" correct=b
@validate_command "vox ls qa"  # Must run successfully
```

**Use cases:**
- Learning verification
- Tutorial checkpoints
- Certification tracking

**Implementation:**
- Non-interactive: Skipped
- Interactive TUI: Show question, wait for answer
- Scoring tracked in `.vox/progress.json`

### 7. Progress Tracking

Display learning progress:

```
@progress show_percent=true
@progress show_time_remaining=true
@checkpoint name="completed_basics"
```

**Use cases:**
- Motivation (gamification)
- Resume from last position
- Certificate generation

**Implementation:**
- Progress saved to `.vox/progress.json`
- TUI shows progress bar
- CLI: `vox resume file.esto` starts from last position

### 8. Context Help

Inline documentation:

```
@help topic="dry-run" available=true
@glossary term="cache" definition="Content-addressed storage"
@reference url="https://docs.example.com/vox"
```

**Use cases:**
- Just-in-time learning
- Reference lookup
- Glossary building

**Implementation:**
- Non-interactive: Ignored
- Interactive TUI: Press 'h' for help overlay
- Help content from `.vox/help.json`

### 9. Metadata

Document-level configuration:

```
@title "Tutorial Title"
@voice sally
@author "Tetra Framework"
@interactive true              # Enable interactive features
@duration_estimate 15min
@difficulty beginner
@prerequisites "basic_bash"
```

**Use cases:**
- Library organization
- Prerequisite checking
- Difficulty filtering

**Implementation:**
- Parsed into `.vox.meta` file
- Used by tutorial browser
- Difficulty affects auto-speed

### 10. Events/Callbacks

Trigger actions during playback:

```
@on_section_start command="vox_highlight_section"
@on_section_end command="vox_wait_for_prompt"
@on_pause hook="save_progress"
@on_code_execute validate=true
```

**Use cases:**
- TUI integration
- Progress saving
- Custom workflows

**Implementation:**
- Hooks call bash functions
- Events in `.vox/events.json`
- Plugin system for extensions

## Example Interactive esto File

```
@title "Interactive Bash Tutorial"
@voice nova
@interactive true
@speed_range min=0.8 max=1.5

@begin chapter name=intro
@prompt "Welcome! Press enter to begin."

This is an interactive tutorial about bash scripting.

@pause 1.0

You can pause, replay sections, or skip ahead at any time.

@end chapter

@begin chapter name=basics
@section "Basic Commands"

Let's start with the ls command.

@pause 0.5

@code "ls -la" executable=true
@code_prompt "Try running this in your terminal"

@pause 1.0

@quiz question="What flag shows hidden files?" answer="-a"

Good! Let's continue.

@skippoint name="advanced_section"

@end chapter

@begin chapter name=advanced
This is advanced content.

@bookmark name="advanced_start"

@code "find . -name '*.sh' -exec bash -n {} \;" executable=true

@prompt "Ready for the quiz?"

@quiz question="What does -exec do?" type="open"

@end chapter
```

## Playback Modes

### 1. Non-Interactive (Batch)

```bash
cat tutorial.esto | vox generate sally --output tutorial.mp3
```

**Behavior:**
- All prompts ignored
- Pauses converted to silence
- Code blocks read as text
- Quiz questions read but not validated

**Use case:** Audiobook generation, podcast export

### 2. CLI Interactive

```bash
vox play sally tutorial.esto --interactive
```

**Behavior:**
- Prompts wait for enter
- Code blocks shown with line numbers
- Quiz questions asked in terminal
- Progress saved to `.vox/progress.json`

**Use case:** Terminal-based learning

### 3. TUI Interactive (Full Features)

```bash
vox tui tutorial.esto
```

**Behavior:**
- Visual section outline sidebar
- Syntax-highlighted code blocks
- One-key section navigation (j/k)
- Progress bar and time remaining
- Help overlay (press 'h')
- Execute code in split pane
- Visual quiz UI

**Use case:** Rich learning experience

## File Structure

When working with interactive esto files:

```
project/
├── tutorial.esto              # Source content
├── tutorial.vox.nova.mp3      # Generated audio
├── tutorial.vox.nova.spans    # Span/timing data
└── .vox/
    ├── progress.json          # User progress
    ├── bookmarks.json         # Saved positions
    ├── config.toml            # Project config
    └── help.json              # Help content
```

### progress.json Format

```json
{
  "file": "tutorial.esto",
  "voice": "nova",
  "last_position": 45.3,
  "last_section": "advanced_start",
  "completed_checkpoints": ["basics_complete"],
  "quiz_scores": {
    "basics_quiz": 0.8,
    "advanced_quiz": 1.0
  },
  "started_at": "2024-10-12T21:00:00Z",
  "last_updated": "2024-10-12T21:45:00Z",
  "total_time_spent": 2700
}
```

### bookmarks.json Format

```json
{
  "tutorial.esto": {
    "nova": [
      {
        "name": "cache_section",
        "section": "doc.ch[2].sec[1]",
        "time_offset": 123.4,
        "text_offset": 5678,
        "created_at": "2024-10-12T21:30:00Z"
      }
    ]
  }
}
```

## TUI Keybindings (Proposed)

When playing interactive esto files in TUI:

```
Navigation:
  j/k           Next/previous section
  space         Play/pause
  h/l           Rewind/forward 5s
  g/G           Jump to start/end
  /             Search sections

Interactive:
  enter         Confirm prompt
  e             Execute code block
  r             Replay current section
  b             Add bookmark
  ?             Show help overlay

Speed:
  [/]           Decrease/increase speed
  =             Reset to 1.0x

Progress:
  p             Show progress stats
  q             Quit (save progress)
```

## Implementation Phases

### Phase 1: Basic Structure
- Parse `@begin/@end` blocks
- Support `@pause` and `@prompt`
- Basic section navigation

### Phase 2: Interactive Features
- Code execution
- Progress tracking
- Bookmarks

### Phase 3: Advanced
- Quiz system
- Event hooks
- Plugin architecture

### Phase 4: TUI Integration
- Visual section browser
- Split pane for code execution
- Rich progress UI

## Design Decisions

### Why esto over Markdown?

**Pros of esto:**
- Clean directive syntax (`@pause 1.5`)
- No ambiguity with content
- Easy to parse with bash/awk
- Hierarchical structure with `@begin/@end`

**Cons:**
- Not as widely known as Markdown
- Needs custom editor support

**Decision:** Use esto, but consider Markdown compatibility layer later

### Why Sidecar Files?

**Advantages:**
- Source file stays clean
- Progress/bookmarks don't pollute git
- Multiple voices = multiple progress files
- Easy to delete and regenerate

**Disadvantages:**
- More files to manage
- Must keep in sync

**Decision:** Use sidecar files, enforce with `.vox/` directory

### Why JSON for Metadata?

**Alternatives considered:**
- TOML: More human-readable but harder to update
- SQLite: Overkill for small data
- Plain text: Hard to query

**Decision:** JSON for machine data (progress, bookmarks), TOML for config

## Future Extensions

### Voice Acting Support

```
@cast character=alice voice=nova
@cast character=bob voice=onyx

@dialogue character=alice "Hello Bob!"
@dialogue character=bob "Hi Alice!"
```

### Adaptive Content

```
@adapt_speed based_on=quiz_performance
@adapt_difficulty based_on=progress
@recommend next_tutorial="advanced_bash"
```

### Social Features

```
@share bookmark="important_section"
@comment timestamp=45.3 text="Great explanation!"
@rating stars=5
```

### Analytics

```
@track event="section_completed"
@track event="code_executed" command="ls -la"
@analytics export="vox_analytics.json"
```

## Testing Strategy

Create test esto files for each feature:

```bash
tests/
├── basic.esto           # @pause, @prompt
├── navigation.esto      # @skippoint, @bookmark
├── code.esto            # @code executable
├── quiz.esto            # @quiz, @validate
└── full.esto            # All features combined
```

Test in all modes:
- Batch generation (no interaction)
- CLI interactive (basic prompts)
- TUI interactive (full features)

## CLI Flag Summary

```bash
vox play <voice> file.esto [options]

Interactive Options:
  --interactive             Enable interactive mode
  --prompts=<auto|manual>   Auto-skip or wait for prompts
  --section=<name>          Start at specific section
  --resume                  Resume from last position
  --speed=<float>           Playback speed (0.5-2.0)
  --no-progress             Don't save progress
  --execute-code            Auto-execute code blocks
  --skip-quiz               Skip all quiz questions

Output Options:
  --output=<file>           Generate non-interactive MP3
  --spans                   Generate span file
  --progress-file=<path>    Custom progress location
```

## Documentation Integration

Add to README.md:

```markdown
## Interactive esto Files

Create guided tutorials and interactive content:

- User prompts with `@prompt`
- Timed pauses with `@pause`
- Executable code with `@code`
- Quiz questions with `@quiz`
- Progress tracking across sessions

See [INTERACTIVE_ESTO.md](./INTERACTIVE_ESTO.md) for full syntax.
```

## Next Steps

1. Implement basic `@pause` and `@prompt` in `vox_esto.sh`
2. Add progress tracking to `vox_play_id()`
3. Create simple CLI interactive mode
4. Build TUI with section navigation
5. Add code execution support
6. Implement quiz system

## Success Criteria

Interactive esto is successful when:
- ✅ Tutorial creators can build guided experiences
- ✅ Learners can pause, navigate, and resume
- ✅ Code blocks can be executed inline
- ✅ Progress persists across sessions
- ✅ Non-interactive mode still works for audiobooks
- ✅ TUI provides rich visual feedback
